import {
  MATCH_MODES,
  PROTOCOL_VERSION,
  WORLD_SCHEMA_VERSION,
  brandId,
  parseNickname,
  parseRoomCode,
  type AuthoritativeSnapshot,
  type GameEvent,
  type GameTuning,
  type InteractableId,
  type InteractableRecord,
  type MatchRecord,
  type PlayerId,
  type PlayerRecord,
  type PoliceId,
  type PoliceRecord,
  type RobberRecord,
  type RouteProgress,
  type RoutePlacement,
  type SimulationSetup,
  type VehicleId,
  type VehicleRecord,
} from "@stopthatguy/shared";
import { getFixedDeltaMs, msToTicks } from "./clock.js";
import { clonePlain } from "./copy.js";
import { copyMovementMemory, type MovementMemory } from "./movement/kernel.js";
import { poseOnRoute } from "./movement/geometry.js";
import { indexWorld, type WorldIndex } from "./movement/world-index.js";
import { createRng, nextInt, type RngState } from "./rng.js";

/**
 * Opaque handle for one match. Callers can only pass it back to the Simulation methods; the data lives
 * in a module-private WeakMap, so no caller can read or mutate internals directly.
 */
declare const stateBrand: unique symbol;
export interface SimulationState {
  readonly [stateBrand]: "SimulationState";
}

/**
 * Private simulation data. Public records use the shared contract types; everything else (RNG,
 * event queue, world index) never leaves the package. Snapshots and events are deep copies.
 */
export interface InternalState {
  readonly tuning: GameTuning;
  readonly world: WorldIndex;
  readonly fixedDeltaMs: number;
  readonly match: MatchRecord;
  /** Ordered by joinOrder. */
  readonly players: PlayerRecord[];
  readonly movementByPlayer: Map<PlayerId, MovementMemory>;
  readonly playersById: ReadonlyMap<string, PlayerRecord>;
  readonly robber: RobberRecord;
  readonly vehicles: VehicleRecord[];
  readonly police: PoliceRecord[];
  readonly interactables: InteractableRecord[];
  readonly rng: RngState;
  nextEventId: number;
  readonly pendingEvents: GameEvent[];
}

const internals = new WeakMap<SimulationState, InternalState>();

export function toInternal(state: SimulationState): InternalState {
  const internal = internals.get(state);
  if (!internal) throw new TypeError("not a SimulationState created by createInitialState");
  return internal;
}

function invalidSetup(message: string): never {
  throw new RangeError(`Invalid simulation setup: ${message}`);
}

function validateSetup(setup: SimulationSetup): void {
  const { tuning, world } = setup;
  const t = tuning.timing;
  getFixedDeltaMs(tuning);
  const m = tuning.movement;
  if (![m.runSpeedMps, m.sprintSpeedMps, m.staminaMax, m.sprintStaminaPerSecond,
    m.accelerationMps2, m.coastMps2, m.brakeMps2, m.laneShiftMs,
    m.bodyRadiusM, m.bodyHeightM, tuning.junction.approachTimeMs,
    tuning.junction.approachWindowMinM, tuning.junction.approachWindowMaxM].every((n) => Number.isFinite(n) && n > 0)
    || ![m.staminaRecoveryPerSecond, m.staminaRecoveryDelayMs, m.collisionSkinM,
      tuning.junction.turnInputBufferMs].every((n) => Number.isFinite(n) && n >= 0)
    || tuning.junction.approachWindowMaxM < tuning.junction.approachWindowMinM
    || tuning.junction.turnInputBufferMs > 250 || m.sprintSpeedMps < m.runSpeedMps) invalidSetup("invalid movement tuning");
  if (![t.countdownMs, t.introMs].every((ms) => Number.isFinite(ms) && ms >= 0)) invalidSetup("countdown/intro must be ≥ 0 ms");
  if (!Number.isFinite(t.chaseTimeLimitMs) || msToTicks(t.chaseTimeLimitMs, tuning) < 1) invalidSetup("chase must last at least one tick");
  if (world.schemaVersion !== WORLD_SCHEMA_VERSION) invalidSetup(`world schema ${world.schemaVersion} ≠ ${WORLD_SCHEMA_VERSION}`);
  if (!MATCH_MODES.includes(setup.mode)) invalidSetup("unknown mode");
  const code = parseRoomCode(setup.roomCode);
  if (!code.ok || code.value !== setup.roomCode) invalidSetup("room code is not a normalized room code");

  const count = setup.participants.length;
  const min = setup.mode === "practice" ? tuning.room.minPlayersPractice : tuning.room.minPlayersNormal;
  if (count < min || count > tuning.room.maxPlayers) invalidSetup(`${count} participants; ${setup.mode} needs ${min}–${tuning.room.maxPlayers}`);
  const ids = new Set<string>();
  const joinOrders = new Set<number>();
  for (const p of setup.participants) {
    const nick = parseNickname(p.nickname);
    if (!nick.ok || nick.value !== p.nickname) invalidSetup(`participant ${p.playerId} has an invalid nickname`);
    if (!Number.isInteger(p.joinOrder) || p.joinOrder < 0) invalidSetup(`participant ${p.playerId} has an invalid joinOrder`);
    if (ids.has(p.playerId) || joinOrders.has(p.joinOrder)) invalidSetup("duplicate participant id or joinOrder");
    ids.add(p.playerId);
    joinOrders.add(p.joinOrder);
  }
  const playerSpawns = world.spawns.filter((s) => s.kind === "player").length;
  if (playerSpawns < count) invalidSetup(`world has ${playerSpawns} player spawns for ${count} participants`);
  if (!world.spawns.some((s) => s.kind === "robber")) invalidSetup("world has no robber spawn");
}

function routeAt(world: WorldIndex, placement: RoutePlacement): RouteProgress {
  const edge = world.edges.get(placement.edgeId)?.edge;
  const offset = edge?.laneOffsetsM[placement.laneIndex];
  if (!edge || offset === undefined || !(placement.distanceM >= 0 && placement.distanceM <= edge.lengthM)) {
    invalidSetup(`spawn placement on ${placement.edgeId} is outside the route graph`);
  }
  return { edgeId: placement.edgeId, distanceM: placement.distanceM, laneIndex: placement.laneIndex, lateralOffsetM: offset };
}

/**
 * Builds the countdown-phase state at tick 0. Deterministic for a given setup: the only randomness
 * is the seeded robber route choice. `setup` is read, never mutated or retained except as read-only
 * references to `world` and `tuning`.
 */
export function createInitialState(setup: SimulationSetup): SimulationState {
  validateSetup(setup);
  const { tuning } = setup;
  const world = indexWorld(setup.world);
  const ticks = (ms: number) => msToTicks(ms, tuning);
  const rng = createRng(setup.seed);

  const escapeRoutes = setup.world.routes.filter((r) => r.kind === "robberEscape");
  const robberRoute = escapeRoutes.length > 0 ? escapeRoutes[nextInt(rng, escapeRoutes.length)]! : null;

  const playerSpawns = setup.world.spawns.filter((s) => s.kind === "player");
  const participants = [...setup.participants].sort((a, b) => a.joinOrder - b.joinOrder);
  const players: PlayerRecord[] = participants.map((p, i) => {
    const route = routeAt(world, playerSpawns[i]!.placement);
    return {
      id: p.playerId,
      nickname: p.nickname,
      joinOrder: p.joinOrder,
      ready: true,
      connection: "connected",
      participation: "active",
      locomotion: "onFoot",
      pose: poseOnRoute(world, route),
      route,
      speedMps: 0,
      stamina: tuning.movement.staminaMax,
      status: { stunnedUntilTick: null, protectedUntilTick: null, sabotageCooldownUntilTick: null, wanted: false },
      vehicleId: null,
      seatIndex: null,
      lastProcessedInputSequence: 0,
      lastProcessedActionId: 0,
    };
  });

  const robberSpawn = setup.world.spawns.find((s) => s.kind === "robber")!;
  const robberRouteProgress = routeAt(world, robberSpawn.placement);
  const robber: RobberRecord = {
    pose: poseOnRoute(world, robberRouteProgress),
    route: robberRouteProgress,
    speedMps: 0,
    locomotion: "onFoot",
    aiState: "departing",
    escapeTargetZoneId: robberRoute?.kind === "robberEscape" ? robberRoute.exitZoneId : null,
  };

  const vehicles: VehicleRecord[] = [];
  const police: PoliceRecord[] = [];
  for (const spawn of setup.world.spawns) {
    if (spawn.kind === "vehicle") {
      const route = routeAt(world, spawn.placement);
      vehicles.push({
        id: brandId<VehicleId>(spawn.id),
        type: spawn.vehicleType,
        access: spawn.access,
        availability: "available",
        pose: poseOnRoute(world, route),
        route,
        speedMps: 0,
        ownerId: null,
        passengerIds: spawn.vehicleType === "lift" ? Array.from({ length: tuning.vehicles.liftPassengerSeats }, () => null) : [],
        stolen: false,
      });
    } else if (spawn.kind === "police") {
      const route = routeAt(world, spawn.placement);
      police.push({
        id: brandId<PoliceId>(spawn.id),
        pose: poseOnRoute(world, route),
        route,
        speedMps: 0,
        state: "patrolling",
        targetId: null,
        arrestStartTick: null,
      });
    }
  }
  const interactables: InteractableRecord[] = setup.world.zones
    .filter((z) => z.kind === "shop")
    .map((z) => ({ id: brandId<InteractableId>(z.id), type: "shopTheft", zoneId: z.id, state: "idle", actorId: null, progress: 0 }));

  // The first chase tick is reached by a step, so it is at least 1 even with zero countdown/intro.
  const chaseStartTick = Math.max(1, ticks(tuning.timing.countdownMs + tuning.timing.introMs));
  const match: MatchRecord = {
    roomCode: setup.roomCode,
    mode: setup.mode,
    phase: "countdown",
    tick: 0,
    seed: setup.seed,
    phaseEndsAtTick: Math.min(ticks(tuning.timing.countdownMs), chaseStartTick),
    chaseStartTick,
    chaseEndTick: chaseStartTick + ticks(tuning.timing.chaseTimeLimitMs),
    robberRouteId: robberRoute?.id ?? null,
    versions: { protocolVersion: PROTOCOL_VERSION, worldVersion: setup.world.worldVersion, configVersion: tuning.configVersion },
    hostId: players[0]!.id,
    result: null,
  };

  const internal: InternalState = {
    tuning,
    world,
    fixedDeltaMs: getFixedDeltaMs(tuning),
    match,
    players,
    movementByPlayer: new Map(players.map((p) => [p.id, copyMovementMemory()])),
    playersById: new Map<PlayerId, PlayerRecord>(players.map((p) => [p.id, p])),
    robber,
    vehicles,
    police,
    interactables,
    rng,
    nextEventId: 1,
    pendingEvents: [],
  };
  const handle = Object.freeze(Object.create(null)) as SimulationState;
  internals.set(handle, internal);
  return handle;
}

/** A fresh deep copy of the public records. Not frozen; mutating it has no effect on the simulation. */
export function readSerializableState(state: SimulationState): AuthoritativeSnapshot {
  const s = toInternal(state);
  return clonePlain({
    match: s.match,
    players: s.players,
    robber: s.robber,
    vehicles: s.vehicles,
    police: s.police,
    interactables: s.interactables,
  });
}
