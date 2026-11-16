// TEST DATA — authoritative snapshots and event sequences for each contract scenario.
// Deterministic constants on FIXTURE_WORLD; never live multiplayer state.
import {
  brandId,
  CONFIG_VERSION,
  DEFAULT_TUNING,
  PROTOCOL_VERSION,
  type AuthoritativeSnapshot,
  type EdgeId,
  type GameEvent,
  type GameEventPayload,
  type InteractableId,
  type InteractableRecord,
  type MatchRecord,
  type MatchResult,
  type PlayerId,
  type PlayerRecord,
  type PoliceId,
  type PoliceRecord,
  type Pose,
  type RobberRecord,
  type RouteProgress,
  type VehicleAccess,
  type VehicleId,
  type VehicleRecord,
  type VehicleType,
} from "@stopthatguy/shared";
import { deepFreeze } from "./freeze.js";
import { FIXTURE_IDS, FIXTURE_WORLD } from "./world.js";

export const FIXTURE_PLAYER_IDS = {
  ana: brandId<PlayerId>("fixture-player-ana"),
  bruno: brandId<PlayerId>("fixture-player-bruno"),
  carla: brandId<PlayerId>("fixture-player-carla"),
  dina: brandId<PlayerId>("fixture-player-dina"),
} as const;
export const FIXTURE_VEHICLE_IDS = {
  bicycle: brandId<VehicleId>("v-bicycle"),
  shopScooter: brandId<VehicleId>("v-shop-scooter"),
  lift: brandId<VehicleId>("v-lift"),
} as const;
export const FIXTURE_POLICE_ID = brandId<PoliceId>("p-1");
export const FIXTURE_INTERACTABLE_IDS = {
  shopTheft: brandId<InteractableId>("i-shop-theft"),
  borrowNpc: brandId<InteractableId>("i-borrow-npc"),
} as const;
export const FIXTURE_ROOM_CODE = "FX7KQ";

const { ana: ANA, bruno: BRUNO, carla: CARLA, dina: DINA } = FIXTURE_PLAYER_IDS;
const { bicycle: BICYCLE, shopScooter: SCOOTER, lift: LIFT } = FIXTURE_VEHICLE_IDS;
const E = FIXTURE_IDS.edges;

const toTicks = (ms: number) => Math.round((ms * DEFAULT_TUNING.timing.simulationHz) / 1000);
const T = DEFAULT_TUNING.timing;
export const FIXTURE_CHASE_START_TICK = toTicks(T.countdownMs + T.introMs);
export const FIXTURE_CHASE_END_TICK = FIXTURE_CHASE_START_TICK + toTicks(T.chaseTimeLimitMs);

// Headings (geometry.ts convention): north = +Z, east = +X, west = -X.
const NORTH = 0;
const EAST = Math.PI / 2;
const WEST = -Math.PI / 2;

const pose = (x: number, y: number, z: number, yaw: number): Pose => ({ position: { x, y, z }, yaw });
const at = (edgeId: EdgeId, distanceM: number, laneIndex: number, lateralOffsetM: number): RouteProgress => ({
  edgeId,
  distanceM,
  laneIndex,
  lateralOffsetM,
});

function match(fields: Partial<MatchRecord>): MatchRecord {
  return {
    roomCode: FIXTURE_ROOM_CODE,
    mode: "normal",
    phase: "lobby",
    tick: 0,
    seed: 20261116,
    phaseEndsAtTick: null,
    chaseStartTick: null,
    chaseEndTick: null,
    robberRouteId: null,
    versions: { protocolVersion: PROTOCOL_VERSION, worldVersion: FIXTURE_WORLD.worldVersion, configVersion: CONFIG_VERSION },
    hostId: ANA,
    result: null,
    ...fields,
  };
}

function chaseMatch(tick: number, result: MatchResult | null = null): MatchRecord {
  return match({
    phase: result ? "results" : "chase",
    tick,
    chaseStartTick: FIXTURE_CHASE_START_TICK,
    chaseEndTick: FIXTURE_CHASE_END_TICK,
    robberRouteId: FIXTURE_IDS.routes.robberRiver,
    result,
  });
}

const NICKNAMES: Record<PlayerId, string> = {
  [ANA]: "Fixture Ana",
  [BRUNO]: "Fixture Bruno",
  [CARLA]: "Fixture Carla",
  [DINA]: "Fixture Dina",
};
const JOIN_ORDER: Record<PlayerId, number> = { [ANA]: 0, [BRUNO]: 1, [CARLA]: 2, [DINA]: 3 };

function player(id: PlayerId, fields: Partial<PlayerRecord> = {}): PlayerRecord {
  return {
    id,
    nickname: NICKNAMES[id] ?? "Fixture",
    joinOrder: JOIN_ORDER[id] ?? 0,
    ready: true,
    connection: "connected",
    participation: "active",
    locomotion: "onFoot",
    pose: pose(0, 0, 0, NORTH),
    route: null,
    speedMps: 0,
    stamina: DEFAULT_TUNING.movement.staminaMax,
    status: { stunnedUntilTick: null, protectedUntilTick: null, sabotageCooldownUntilTick: null, wanted: false },
    vehicleId: null,
    seatIndex: null,
    lastProcessedInputSequence: 0,
    lastProcessedActionId: 0,
    ...fields,
  };
}

function vehicle(id: VehicleId, type: VehicleType, access: VehicleAccess, fields: Partial<VehicleRecord>): VehicleRecord {
  return {
    id,
    type,
    access,
    availability: "available",
    pose: pose(0, 0, 0, NORTH),
    route: null,
    speedMps: 0,
    ownerId: null,
    passengerIds: type === "lift" ? Array.from({ length: DEFAULT_TUNING.vehicles.liftPassengerSeats }, () => null) : [],
    stolen: false,
    ...fields,
  };
}

// Parked at their FIXTURE_WORLD spawns.
const parkedBicycle = () =>
  vehicle(BICYCLE, "bicycle", "public", { pose: pose(6, 0.4, 38.5, EAST), route: at(E.junctionEast, 6, 1, 1.5) });
const parkedScooter = () =>
  vehicle(SCOOTER, "scooter", "shop", { pose: pose(15, 1, 38.5, EAST), route: at(E.junctionEast, 15, 1, 1.5) });
const lift = (fields: Partial<VehicleRecord> = {}) =>
  vehicle(LIFT, "lift", "public", { pose: pose(1.5, 0, 20, NORTH), route: at(E.bankNorth, 20, 1, 1.5), ...fields });

function police(fields: Partial<PoliceRecord> = {}): PoliceRecord {
  return {
    id: FIXTURE_POLICE_ID,
    pose: pose(-12, 0, 40, WEST),
    route: at(E.junctionWest, 12, 0, 0),
    speedMps: 3,
    state: "patrolling",
    targetId: null,
    arrestStartTick: null,
    ...fields,
  };
}

function interactables(shop: Partial<InteractableRecord> = {}): InteractableRecord[] {
  return [
    { id: FIXTURE_INTERACTABLE_IDS.shopTheft, type: "shopTheft", zoneId: FIXTURE_IDS.zones.shop, state: "idle", actorId: null, progress: 0, ...shop },
    { id: FIXTURE_INTERACTABLE_IDS.borrowNpc, type: "borrowPoint", zoneId: null, state: "idle", actorId: null, progress: 0 },
  ];
}

function robber(fields: Partial<RobberRecord>): RobberRecord {
  return {
    pose: pose(40, 1.5, 38.5, EAST),
    route: at(E.eastRoad, 10, 1, 1.5),
    speedMps: 8,
    locomotion: "scooter",
    aiState: "fleeing",
    escapeTargetZoneId: FIXTURE_IDS.zones.riverEscape,
    ...fields,
  };
}

const wanted = { stunnedUntilTick: null, protectedUntilTick: null, sabotageCooldownUntilTick: null, wanted: true };

/** Lobby: Ana hosts; Carla is not ready yet, so the match cannot start. */
export const FIXTURE_LOBBY_SNAPSHOT: AuthoritativeSnapshot = deepFreeze({
  match: match({}),
  players: [player(ANA), player(BRUNO), player(CARLA, { ready: false })],
  robber: null,
  vehicles: [parkedBicycle(), parkedScooter(), lift()],
  police: [police()],
  interactables: interactables(),
});

/** Active chase: Ana sprints, Bruno rides the public bicycle, Carla runs; the robber flees by scooter. */
export const FIXTURE_CHASE_SNAPSHOT: AuthoritativeSnapshot = deepFreeze({
  match: chaseMatch(3000),
  players: [
    player(ANA, {
      pose: pose(10, 0.67, 41.5, EAST),
      route: at(E.junctionEast, 10, 0, -1.5),
      speedMps: 6,
      stamina: 55,
      lastProcessedInputSequence: 2600,
      lastProcessedActionId: 14,
    }),
    player(BRUNO, {
      locomotion: "bicycle",
      vehicleId: BICYCLE,
      pose: pose(18, 1.2, 38.5, EAST),
      route: at(E.junctionEast, 18, 1, 1.5),
      speedMps: 7,
      lastProcessedInputSequence: 2610,
      lastProcessedActionId: 9,
    }),
    player(CARLA, {
      pose: pose(-1.5, 0, 30, NORTH),
      route: at(E.bankNorth, 30, 0, -1.5),
      speedMps: 4,
      lastProcessedInputSequence: 2590,
      lastProcessedActionId: 5,
    }),
  ],
  robber: robber({}),
  vehicles: [
    vehicle(BICYCLE, "bicycle", "public", {
      availability: "inUse",
      ownerId: BRUNO,
      pose: pose(18, 1.2, 38.5, EAST),
      route: at(E.junctionEast, 18, 1, 1.5),
      speedMps: 7,
    }),
    parkedScooter(),
    lift({ pose: pose(1.5, 0, 26, NORTH), route: at(E.bankNorth, 26, 1, 1.5), speedMps: 3 }),
  ],
  police: [police()],
  interactables: interactables(),
});

/** Vehicles and passengers: Bruno owns the bicycle, Carla rides the lift in seat 0, Ana is mid-theft at the shop. */
export const FIXTURE_VEHICLE_SNAPSHOT: AuthoritativeSnapshot = deepFreeze({
  match: chaseMatch(4200),
  players: [
    player(ANA, { pose: pose(15, 1, 41.5, EAST), route: at(E.junctionEast, 15, 0, -1.5), stamina: 80 }),
    player(BRUNO, {
      locomotion: "bicycle",
      vehicleId: BICYCLE,
      pose: pose(50, 1, 38.5, EAST),
      route: at(E.eastRoad, 20, 1, 1.5),
      speedMps: 7,
    }),
    player(CARLA, {
      locomotion: "passenger",
      vehicleId: LIFT,
      seatIndex: 0,
      pose: pose(5, 0.33, 38.5, EAST),
      route: null,
      speedMps: 3,
    }),
  ],
  robber: robber({ pose: pose(50, -0.3, 59.5, NORTH), route: at(E.eastRoad, 40, 0, -1.5) }),
  vehicles: [
    vehicle(BICYCLE, "bicycle", "public", {
      availability: "inUse",
      ownerId: BRUNO,
      pose: pose(50, 1, 38.5, EAST),
      route: at(E.eastRoad, 20, 1, 1.5),
      speedMps: 7,
    }),
    parkedScooter(),
    lift({ pose: pose(5, 0.33, 38.5, EAST), route: at(E.junctionEast, 5, 1, 1.5), speedMps: 3, passengerIds: [CARLA, null] }),
  ],
  police: [police()],
  interactables: interactables({ state: "inProgress", actorId: ANA, progress: 0.5 }),
});

/** Wanted: Ana stole the shop scooter and is pursued by police. */
export const FIXTURE_WANTED_SNAPSHOT: AuthoritativeSnapshot = deepFreeze({
  match: chaseMatch(5400),
  players: [
    player(ANA, {
      locomotion: "scooter",
      vehicleId: SCOOTER,
      pose: pose(48.5, 0.34, 49.95, NORTH),
      route: at(E.eastRoad, 30, 0, -1.5),
      speedMps: 9,
      status: wanted,
    }),
    player(BRUNO, {
      locomotion: "bicycle",
      vehicleId: BICYCLE,
      pose: pose(51.5, -0.99, 69.9, NORTH),
      route: at(E.eastRoad, 50, 1, 1.5),
      speedMps: 7,
    }),
    player(CARLA, { pose: pose(30, 0.8, 52, NORTH), route: at(E.eastStairs, 12, 0, 0), speedMps: 4 }),
  ],
  robber: robber({ pose: pose(40.1, -1, 71.5, WEST), route: at(E.eastRoad, 60, 1, 1.5), aiState: "escaping" }),
  vehicles: [
    vehicle(BICYCLE, "bicycle", "public", {
      availability: "inUse",
      ownerId: BRUNO,
      pose: pose(51.5, -0.99, 69.9, NORTH),
      route: at(E.eastRoad, 50, 1, 1.5),
      speedMps: 7,
    }),
    vehicle(SCOOTER, "scooter", "shop", {
      availability: "inUse",
      ownerId: ANA,
      stolen: true,
      pose: pose(48.5, 0.34, 49.95, NORTH),
      route: at(E.eastRoad, 30, 0, -1.5),
      speedMps: 9,
    }),
    lift(),
  ],
  police: [police({ state: "pursuing", targetId: ANA, pose: pose(25, 1.67, 41.5, EAST), route: at(E.junctionEast, 25, 0, -1.5), speedMps: 6 })],
  interactables: interactables({ state: "used" }),
});

/**
 * Arrested / forfeit / spectator: Ana was arrested (scooter released, still wanted), Carla left and
 * forfeited, Dina is a non-competing spectator. How a player enters "spectator" participation is
 * not specified yet (T028/T034); Dina exists only to exercise the contract value.
 */
export const FIXTURE_ARRESTED_SNAPSHOT: AuthoritativeSnapshot = deepFreeze({
  match: chaseMatch(6000),
  players: [
    player(ANA, { participation: "arrested", pose: pose(48.5, 0.2, 52, NORTH), route: at(E.eastRoad, 32, 0, -1.5), status: wanted }),
    player(BRUNO, {
      locomotion: "bicycle",
      vehicleId: BICYCLE,
      pose: pose(42, -1, 71.5, WEST),
      route: at(E.eastRoad, 58, 1, 1.5),
      speedMps: 7,
    }),
    player(CARLA, { connection: "left", participation: "forfeit" }),
    player(DINA, { participation: "spectator" }),
  ],
  robber: robber({ pose: pose(34, -1, 71.5, WEST), route: at(E.eastRoad, 66, 1, 1.5), aiState: "escaping" }),
  vehicles: [
    vehicle(BICYCLE, "bicycle", "public", {
      availability: "inUse",
      ownerId: BRUNO,
      pose: pose(42, -1, 71.5, WEST),
      route: at(E.eastRoad, 58, 1, 1.5),
      speedMps: 7,
    }),
    vehicle(SCOOTER, "scooter", "shop", { stolen: true, pose: pose(48.5, 0.2, 52, NORTH), route: at(E.eastRoad, 32, 0, -1.5) }),
    lift(),
  ],
  police: [police({ pose: pose(48.5, 0.2, 50, NORTH), route: at(E.eastRoad, 30, 0, -1.5) })],
  interactables: interactables({ state: "used" }),
});

const CAPTURE_TICK = 9000;
const ESCAPE_TICK = 8100;

/** Ana captures the robber while wanted: the theft deduction does not reverse her win. */
export const FIXTURE_CAPTURE_RESULT: MatchResult = deepFreeze<MatchResult>({
  outcome: "capture",
  reason: "captured",
  winnerId: ANA,
  resolvedAtTick: CAPTURE_TICK,
  awards: [
    { kind: "mainPrize", playerId: ANA, value: null },
    { kind: "longestFootDistance", playerId: CARLA, value: 812 },
    { kind: "mostTransportChanges", playerId: BRUNO, value: 3 },
    { kind: "highestDamageDeduction", playerId: ANA, value: 250 },
  ],
  stats: [
    { playerId: ANA, footDistanceM: 640, transportChanges: 2, damageDeduction: 250 },
    { playerId: BRUNO, footDistanceM: 310, transportChanges: 3, damageDeduction: 0 },
    { playerId: CARLA, footDistanceM: 812, transportChanges: 1, damageDeduction: 0 },
  ],
  deductions: [{ playerId: ANA, reason: "vehicleTheft", amount: 250 }],
});

export const FIXTURE_ESCAPE_RESULT: MatchResult = deepFreeze<MatchResult>({
  outcome: "noWinner",
  reason: "escaped",
  winnerId: null,
  resolvedAtTick: ESCAPE_TICK,
  awards: [{ kind: "longestFootDistance", playerId: CARLA, value: 905 }],
  stats: [
    { playerId: ANA, footDistanceM: 520, transportChanges: 1, damageDeduction: 0 },
    { playerId: BRUNO, footDistanceM: 300, transportChanges: 2, damageDeduction: 0 },
    { playerId: CARLA, footDistanceM: 905, transportChanges: 2, damageDeduction: 0 },
  ],
  deductions: [],
});

export const FIXTURE_TIMEOUT_RESULT: MatchResult = deepFreeze<MatchResult>({
  outcome: "noWinner",
  reason: "timeout",
  winnerId: null,
  resolvedAtTick: FIXTURE_CHASE_END_TICK,
  awards: [{ kind: "mostTransportChanges", playerId: BRUNO, value: 2 }],
  stats: [
    { playerId: ANA, footDistanceM: 1210, transportChanges: 0, damageDeduction: 0 },
    { playerId: BRUNO, footDistanceM: 450, transportChanges: 2, damageDeduction: 0 },
    { playerId: CARLA, footDistanceM: 1100, transportChanges: 1, damageDeduction: 0 },
  ],
  deductions: [],
});

function resultsSnapshot(tick: number, result: MatchResult, robberRecord: RobberRecord, ana: Partial<PlayerRecord>): AuthoritativeSnapshot {
  return {
    match: chaseMatch(tick, result),
    players: [
      player(ANA, { pose: pose(36, -1, 71.5, WEST), route: at(E.eastRoad, 64, 1, 1.5), ...ana }),
      player(BRUNO, { locomotion: "bicycle", vehicleId: BICYCLE, pose: pose(42, -1, 71.5, WEST), route: at(E.eastRoad, 58, 1, 1.5) }),
      player(CARLA, { pose: pose(30, -0.5, 65, NORTH), route: at(E.eastStairs, 25, 0, 0) }),
    ],
    robber: robberRecord,
    vehicles: [
      vehicle(BICYCLE, "bicycle", "public", {
        availability: "inUse",
        ownerId: BRUNO,
        pose: pose(42, -1, 71.5, WEST),
        route: at(E.eastRoad, 58, 1, 1.5),
      }),
      parkedScooter(),
      lift(),
    ],
    police: [police()],
    interactables: interactables(),
  };
}

/** Results: capture victory (winner Ana, wanted, with a fictional theft deduction). */
export const FIXTURE_CAPTURE_RESULT_SNAPSHOT: AuthoritativeSnapshot = deepFreeze({
  ...resultsSnapshot(
    CAPTURE_TICK,
    FIXTURE_CAPTURE_RESULT,
    robber({ pose: pose(35, -1, 71.5, WEST), route: at(E.eastRoad, 65, 1, 1.5), speedMps: 0, locomotion: "onFoot", aiState: "captured" }),
    { status: wanted },
  ),
  vehicles: [
    vehicle(BICYCLE, "bicycle", "public", { availability: "inUse", ownerId: BRUNO, pose: pose(42, -1, 71.5, WEST), route: at(E.eastRoad, 58, 1, 1.5) }),
    vehicle(SCOOTER, "scooter", "shop", { stolen: true, pose: pose(38, -1, 71.5, WEST), route: at(E.eastRoad, 62, 1, 1.5) }),
    lift(),
  ],
  interactables: interactables({ state: "used" }),
});

/** Results: the robber reached the riverfront exit; no capture winner. */
export const FIXTURE_ESCAPE_RESULT_SNAPSHOT: AuthoritativeSnapshot = deepFreeze(
  resultsSnapshot(
    ESCAPE_TICK,
    FIXTURE_ESCAPE_RESULT,
    robber({ pose: pose(30, -1, 71.5, WEST), route: at(E.eastRoad, 70.092, 1, 1.5), speedMps: 0, aiState: "escaped" }),
    {},
  ),
);

/** Results: the time limit expired; no capture winner. */
export const FIXTURE_TIMEOUT_RESULT_SNAPSHOT: AuthoritativeSnapshot = deepFreeze(
  resultsSnapshot(FIXTURE_CHASE_END_TICK, FIXTURE_TIMEOUT_RESULT, robber({ speedMps: 0 }), {}),
);

export const FIXTURE_SNAPSHOTS = deepFreeze({
  lobby: FIXTURE_LOBBY_SNAPSHOT,
  chase: FIXTURE_CHASE_SNAPSHOT,
  vehicles: FIXTURE_VEHICLE_SNAPSHOT,
  wanted: FIXTURE_WANTED_SNAPSHOT,
  arrested: FIXTURE_ARRESTED_SNAPSHOT,
  captureResult: FIXTURE_CAPTURE_RESULT_SNAPSHOT,
  escapeResult: FIXTURE_ESCAPE_RESULT_SNAPSHOT,
  timeoutResult: FIXTURE_TIMEOUT_RESULT_SNAPSHOT,
});

function events(list: [number, GameEventPayload][]): GameEvent[] {
  return list.map(([tick, payload], index) => ({ ...payload, id: index + 1, tick }));
}

const START: GameEventPayload = { type: "matchStarted", chaseStartTick: FIXTURE_CHASE_START_TICK };

/** Event stream ending in a capture victory (includes a cancelled first attempt while riding too fast). */
export const FIXTURE_CAPTURE_EVENTS: readonly GameEvent[] = deepFreeze(
  events([
    [FIXTURE_CHASE_START_TICK, START],
    [700, { type: "mounted", playerId: BRUNO, vehicleId: BICYCLE }],
    [4300, { type: "theftDetected", playerId: ANA, interactableId: FIXTURE_INTERACTABLE_IDS.shopTheft, vehicleId: SCOOTER }],
    [4300, { type: "wantedChanged", playerId: ANA, wanted: true }],
    [4301, { type: "mounted", playerId: ANA, vehicleId: SCOOTER }],
    [8980, { type: "captureStarted", playerId: ANA }],
    [8985, { type: "captureCancelled", playerId: ANA, reason: "tooFast" }],
    [8987, { type: "dismounted", playerId: ANA, vehicleId: SCOOTER }],
    [8990, { type: "captureStarted", playerId: ANA }],
    [CAPTURE_TICK, { type: "captureResolved", playerId: ANA }],
    [CAPTURE_TICK, { type: "matchEnded", result: FIXTURE_CAPTURE_RESULT }],
  ]),
);

/** Event stream with lift, shove, arrest and an escape (no winner). */
export const FIXTURE_ESCAPE_EVENTS: readonly GameEvent[] = deepFreeze(
  events([
    [FIXTURE_CHASE_START_TICK, START],
    [1200, { type: "liftBoarded", playerId: CARLA, vehicleId: LIFT, seatIndex: 0 }],
    [1500, { type: "liftExited", playerId: CARLA, vehicleId: LIFT }],
    [2000, { type: "shoveResolved", attackerId: BRUNO, targetId: CARLA, hit: true }],
    [2100, { type: "shoveResolved", attackerId: CARLA, targetId: null, hit: false }],
    [4300, { type: "theftDetected", playerId: ANA, interactableId: FIXTURE_INTERACTABLE_IDS.shopTheft, vehicleId: SCOOTER }],
    [4300, { type: "wantedChanged", playerId: ANA, wanted: true }],
    [5990, { type: "arrested", playerId: ANA, policeId: FIXTURE_POLICE_ID }],
    [ESCAPE_TICK, { type: "robberEscaped", exitZoneId: FIXTURE_IDS.zones.riverEscape }],
    [ESCAPE_TICK, { type: "matchEnded", result: FIXTURE_ESCAPE_RESULT }],
  ]),
);
