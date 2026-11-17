// Contract-conformance checks for fixtures (and, later, other plain data). Each returns a list of
// human-readable issues; an empty list means consistent. These are referential/semantic checks the
// TypeScript types cannot express. Full world validation (reachability, colliders) belongs to T004/T005.
import {
  AWARD_KINDS,
  BRANCH_SIDES,
  CLIENT_CONNECTION_STATES,
  CONNECTION_STATUSES,
  DEDUCTION_REASONS,
  DEFAULT_TUNING,
  GAME_EVENT_TYPES,
  INTERACTABLE_STATES,
  INTERACTABLE_TYPES,
  LOCOMOTION_STATES,
  MATCH_MODES,
  MATCH_PHASES,
  NO_WINNER_REASONS,
  PARTICIPATION_STATES,
  POLICE_STATES,
  PROTOCOL_LIMITS,
  PROTOCOL_VERSION,
  QUALITY_PRESETS,
  ROBBER_AI_STATES,
  ROBBER_LOCOMOTION,
  ROUTE_NODE_KINDS,
  TRAVEL_MODES,
  VEHICLE_ACCESS,
  VEHICLE_AVAILABILITY,
  VEHICLE_TYPES,
  WORLD_SCHEMA_VERSION,
  ZONE_KINDS,
  parseNickname,
  parseRoomCode,
  type AuthoritativeSnapshot,
  type GameEvent,
  type GameTuning,
  type MatchResult,
  type PlayerRecord,
  type RouteEdge,
  type RouteProgress,
  type TravelMode,
  type UiViewModel,
  type Vec3,
  type Volume,
  type WorldData,
} from "@stopthatguy/shared";

const EPSILON_M = 0.01;

const isOneOf = (value: unknown, allowed: readonly string[]) => typeof value === "string" && allowed.includes(value);
const isFiniteVec = (v: Vec3) => [v.x, v.y, v.z].every(Number.isFinite);
const samePoint = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) < 1e-6;
const isUint32 = (n: number) => Number.isInteger(n) && n >= 0 && n <= PROTOCOL_LIMITS.maxUint32;

export function polylineLength(points: readonly Vec3[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    total += Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
  }
  return total;
}

function indexById<T extends { id: string }>(items: readonly T[], label: string, add: (m: string) => void): Map<string, T> {
  const map = new Map<string, T>();
  for (const item of items) {
    if (map.has(item.id)) add(`duplicate ${label} id ${item.id}`);
    map.set(item.id, item);
  }
  return map;
}

function volumeIssues(volume: Volume, label: string): string[] {
  if (!isFiniteVec(volume.center)) return [`${label}: non-finite center`];
  if (volume.shape === "box") {
    const h = volume.halfExtents;
    return h.x > 0 && h.y > 0 && h.z > 0 && Number.isFinite(volume.yaw) ? [] : [`${label}: box extents must be positive`];
  }
  return volume.radiusM > 0 && volume.heightM > 0 ? [] : [`${label}: cylinder size must be positive`];
}

const VEHICLE_MODE: Record<string, TravelMode> = { bicycle: "bicycle", scooter: "scooter", lift: "lift" };

export function checkWorldConsistency(world: WorldData): string[] {
  const issues: string[] = [];
  const add = (m: string) => issues.push(m);
  if (world.schemaVersion !== WORLD_SCHEMA_VERSION) add(`schemaVersion ${world.schemaVersion} ≠ ${WORLD_SCHEMA_VERSION}`);

  const sectors = indexById(world.sectors, "sector", add);
  const nodes = indexById(world.nodes, "node", add);
  const edges = indexById(world.edges, "edge", add);
  indexById(world.junctions, "junction", add);
  indexById([...world.colliders, ...world.cameraObstructions], "collider", add);
  const zones = indexById(world.zones, "zone", add);
  indexById(world.spawns, "spawn", add);
  indexById(world.routes, "route", add);

  for (const node of world.nodes) {
    if (!sectors.has(node.sectorId)) add(`node ${node.id}: unknown sector`);
    if (!isOneOf(node.kind, ROUTE_NODE_KINDS)) add(`node ${node.id}: invalid kind`);
    if (!isFiniteVec(node.position)) add(`node ${node.id}: non-finite position`);
  }

  for (const edge of world.edges) {
    const from = nodes.get(edge.from);
    const to = nodes.get(edge.to);
    if (!from || !to) add(`edge ${edge.id}: unknown endpoint node`);
    if (!sectors.has(edge.sectorId)) add(`edge ${edge.id}: unknown sector`);
    const first = edge.centerline[0];
    const last = edge.centerline[edge.centerline.length - 1];
    if (edge.centerline.length < 2 || !first || !last || !edge.centerline.every(isFiniteVec)) {
      add(`edge ${edge.id}: centerline needs ≥ 2 finite points`);
    } else {
      if (from && !samePoint(first, from.position)) add(`edge ${edge.id}: centerline does not start at ${edge.from}`);
      if (to && !samePoint(last, to.position)) add(`edge ${edge.id}: centerline does not end at ${edge.to}`);
      const measured = polylineLength(edge.centerline);
      if (Math.abs(measured - edge.lengthM) > EPSILON_M) add(`edge ${edge.id}: lengthM ${edge.lengthM} ≠ centerline ${measured.toFixed(3)}`);
    }
    const lanes = edge.laneOffsetsM;
    if (lanes.length === 0 || !lanes.every((o, i) => Number.isFinite(o) && (i === 0 || o > lanes[i - 1]!))) {
      add(`edge ${edge.id}: lane offsets must be non-empty, finite and ascending`);
    }
    if (edge.allowedModes.length === 0 || !edge.allowedModes.every((m) => isOneOf(m, TRAVEL_MODES))) {
      add(`edge ${edge.id}: invalid allowedModes`);
    }
    if (edge.speedLimitMps !== null && !(edge.speedLimitMps > 0)) add(`edge ${edge.id}: speed limit must be positive`);
  }

  const junctionsByEdge = new Map(world.junctions.map((j) => [j.fromEdgeId as string, j]));
  for (const j of world.junctions) {
    const from = edges.get(j.fromEdgeId);
    if (!nodes.has(j.nodeId)) add(`junction ${j.id}: unknown node`);
    if (!from) add(`junction ${j.id}: unknown incoming edge`);
    else {
      if (from.to !== j.nodeId) add(`junction ${j.id}: incoming edge does not end at its node`);
      if (!(j.window.startM >= 0 && j.window.startM < j.window.endM && j.window.endM <= from.lengthM + EPSILON_M)) {
        add(`junction ${j.id}: window outside incoming edge`);
      }
    }
    if (j.branches.length === 0) add(`junction ${j.id}: no branches`);
    const sides = j.branches.map((b) => b.side);
    if (new Set(sides).size !== sides.length) add(`junction ${j.id}: duplicate branch side`);
    for (const b of j.branches) {
      const target = edges.get(b.toEdgeId);
      if (!isOneOf(b.side, BRANCH_SIDES)) add(`junction ${j.id}: invalid side`);
      if (!target) add(`junction ${j.id}: unknown branch edge ${b.toEdgeId}`);
      else {
        if (target.from !== j.nodeId) add(`junction ${j.id}: branch ${b.toEdgeId} does not start at the junction node`);
        if (b.allowedModes.length === 0 || !b.allowedModes.every((m) => target.allowedModes.includes(m))) {
          add(`junction ${j.id}: branch ${b.side} modes must be a non-empty subset of ${target.id}`);
        }
      }
    }
  }

  // Every incoming edge to a non-exit node needs a way on; dead ends need a forward turnaround.
  for (const edge of world.edges) {
    const end = nodes.get(edge.to);
    if (!end || end.kind === "exit") continue;
    const j = junctionsByEdge.get(edge.id);
    if (!j) add(`edge ${edge.id}: no junction where it ends (player would be stranded)`);
    else if (end.kind === "deadEnd" && !j.branches.some((b) => b.side === "forward")) add(`edge ${edge.id}: dead end without turnaround`);
  }

  for (const c of [...world.colliders, ...world.cameraObstructions]) issues.push(...volumeIssues(c, `collider ${c.id}`));
  for (const z of world.zones) {
    if (!isOneOf(z.kind, ZONE_KINDS)) add(`zone ${z.id}: invalid kind`);
    if (!sectors.has(z.sectorId)) add(`zone ${z.id}: unknown sector`);
    issues.push(...volumeIssues(z.volume, `zone ${z.id}`));
  }

  for (const s of world.spawns) {
    const edge = edges.get(s.placement.edgeId);
    if (!edge) {
      add(`spawn ${s.id}: unknown edge`);
      continue;
    }
    issues.push(...placementIssues(edge, s.placement.distanceM, s.placement.laneIndex, `spawn ${s.id}`));
    if (s.kind === "vehicle") {
      if (!isOneOf(s.vehicleType, VEHICLE_TYPES) || !isOneOf(s.access, VEHICLE_ACCESS)) add(`spawn ${s.id}: invalid vehicle`);
      const mode = VEHICLE_MODE[s.vehicleType];
      if (mode && !edge.allowedModes.includes(mode)) add(`spawn ${s.id}: ${s.vehicleType} not allowed on ${edge.id}`);
    }
  }

  for (const r of world.routes) {
    if (r.edgeIds.length === 0) add(`route ${r.id}: empty`);
    r.edgeIds.forEach((edgeId, i) => {
      const edge = edges.get(edgeId);
      if (!edge) return add(`route ${r.id}: unknown edge ${edgeId}`);
      if (r.kind === "lift" && !edge.allowedModes.includes("lift")) add(`route ${r.id}: lift not allowed on ${edgeId}`);
      const next = r.edgeIds[i + 1];
      if (next !== undefined && !junctionsByEdge.get(edgeId)?.branches.some((b) => b.toEdgeId === next)) {
        add(`route ${r.id}: no junction branch from ${edgeId} to ${next}`);
      }
    });
    if (r.kind === "robberEscape") {
      const exitZone = zones.get(r.exitZoneId);
      if (exitZone?.kind !== "escape") add(`route ${r.id}: exitZoneId must reference an escape zone`);
      const lastEdge = edges.get(r.edgeIds[r.edgeIds.length - 1] ?? "");
      if (!lastEdge || nodes.get(lastEdge.to)?.kind !== "exit") add(`route ${r.id}: must end at an exit node`);
    }
  }
  return issues;
}

function placementIssues(edge: RouteEdge, distanceM: number, laneIndex: number, label: string): string[] {
  const issues: string[] = [];
  if (!(distanceM >= 0 && distanceM <= edge.lengthM + EPSILON_M)) issues.push(`${label}: distance outside ${edge.id}`);
  if (!Number.isInteger(laneIndex) || laneIndex < 0 || laneIndex >= edge.laneOffsetsM.length) issues.push(`${label}: lane outside ${edge.id}`);
  return issues;
}

export function checkSnapshotConsistency(s: AuthoritativeSnapshot, world: WorldData, tuning: GameTuning = DEFAULT_TUNING): string[] {
  const issues: string[] = [];
  const add = (m: string) => issues.push(m);
  const edges = new Map(world.edges.map((e) => [e.id as string, e]));
  const zones = new Map(world.zones.map((z) => [z.id as string, z]));
  const routes = new Set(world.routes.map((r) => r.id as string));
  const route = (r: RouteProgress | null, label: string) => {
    if (!r) return;
    const edge = edges.get(r.edgeId);
    if (!edge) return add(`${label}: unknown edge ${r.edgeId}`);
    issues.push(...placementIssues(edge, r.distanceM, r.laneIndex, label));
    if (!Number.isFinite(r.lateralOffsetM)) add(`${label}: non-finite lateral offset`);
  };

  const m = s.match;
  if (!isOneOf(m.phase, MATCH_PHASES) || !isOneOf(m.mode, MATCH_MODES)) add("match: invalid phase or mode");
  const v = m.versions;
  if (v.protocolVersion !== PROTOCOL_VERSION || v.worldVersion !== world.worldVersion || v.configVersion !== tuning.configVersion) {
    add("match: versions do not match protocol/world/config");
  }
  const code = parseRoomCode(m.roomCode);
  if (!code.ok || code.value !== m.roomCode) add("match: room code invalid or not normalized");
  if (!isUint32(m.tick) || !isUint32(m.seed)) add("match: tick and seed must be uint32");
  if (m.robberRouteId !== null && !routes.has(m.robberRouteId)) add("match: unknown robber route");
  if ((m.result !== null) !== (m.phase === "results")) add("match: result must be set exactly in the results phase");
  if (m.phase === "lobby" && (s.robber !== null || m.chaseStartTick !== null)) add("lobby: robber and chase ticks must be unset");
  if (m.phase === "chase" || m.phase === "results") {
    if (s.robber === null) add(`${m.phase}: robber missing`);
    // Ticks keep advancing during results, so a result is checked by the tick it resolved on.
    const tick = m.phase === "results" && m.result ? m.result.resolvedAtTick : m.tick;
    if (m.chaseStartTick === null || m.chaseEndTick === null || tick < m.chaseStartTick || tick > m.chaseEndTick) {
      add(`${m.phase}: tick outside chase window`);
    }
  }

  const players = indexById(s.players, "player", add);
  const vehicles = indexById(s.vehicles, "vehicle", add);
  indexById(s.police, "police", add);
  indexById(s.interactables, "interactable", add);
  if (s.players.length > tuning.room.maxPlayers) add("too many players");
  if (!s.players.every((p, i) => i === 0 || p.joinOrder > s.players[i - 1]!.joinOrder)) add("players must be ordered by unique joinOrder");
  if (m.hostId !== null && players.get(m.hostId)?.connection !== "connected") add("match: host must be a connected player");

  for (const p of s.players) issues.push(...playerIssues(p, s, vehicles, tuning));
  for (const p of s.players) route(p.route, `player ${p.id}`);

  for (const vehicle of s.vehicles) {
    const label = `vehicle ${vehicle.id}`;
    if (!isOneOf(vehicle.type, VEHICLE_TYPES) || !isOneOf(vehicle.access, VEHICLE_ACCESS) || !isOneOf(vehicle.availability, VEHICLE_AVAILABILITY)) {
      add(`${label}: invalid enum`);
    }
    route(vehicle.route, label);
    if (vehicle.stolen && vehicle.access !== "shop") add(`${label}: only shop vehicles can be stolen`);
    const seats = vehicle.type === "lift" ? tuning.vehicles.liftPassengerSeats : 0;
    if (vehicle.passengerIds.length !== seats) add(`${label}: expected ${seats} passenger seats`);
    if (vehicle.type === "lift") {
      if (vehicle.ownerId !== null) add(`${label}: the lift has no player owner`);
    } else if ((vehicle.availability === "inUse") !== (vehicle.ownerId !== null)) {
      add(`${label}: availability must be inUse exactly when owned`);
    }
    if (vehicle.ownerId !== null) {
      const owner = players.get(vehicle.ownerId);
      if (owner?.vehicleId !== vehicle.id || owner.locomotion !== vehicle.type) add(`${label}: owner does not ride it`);
    }
    vehicle.passengerIds.forEach((id, seat) => {
      if (id === null) return;
      const passenger = players.get(id);
      if (passenger?.vehicleId !== vehicle.id || passenger.seatIndex !== seat || passenger.locomotion !== "passenger") {
        add(`${label}: passenger ${id} does not match seat ${seat}`);
      }
    });
  }

  for (const officer of s.police) {
    if (!isOneOf(officer.state, POLICE_STATES)) add(`police ${officer.id}: invalid state`);
    if (officer.targetId !== null && !players.has(officer.targetId)) add(`police ${officer.id}: unknown target`);
    if ((officer.state === "arresting") !== (officer.arrestStartTick !== null)) add(`police ${officer.id}: arrestStartTick must match arresting state`);
    route(officer.route, `police ${officer.id}`);
  }

  for (const item of s.interactables) {
    const label = `interactable ${item.id}`;
    if (!isOneOf(item.type, INTERACTABLE_TYPES) || !isOneOf(item.state, INTERACTABLE_STATES)) add(`${label}: invalid enum`);
    if (item.zoneId !== null && !zones.has(item.zoneId)) add(`${label}: unknown zone`);
    if (item.actorId !== null && !players.has(item.actorId)) add(`${label}: unknown actor`);
    if (!(item.progress >= 0 && item.progress <= 1)) add(`${label}: progress outside 0..1`);
    if (item.state !== "inProgress" && (item.actorId !== null || item.progress !== 0)) add(`${label}: only inProgress has an actor/progress`);
  }

  if (s.robber) {
    const r = s.robber;
    if (!isOneOf(r.aiState, ROBBER_AI_STATES) || !isOneOf(r.locomotion, ROBBER_LOCOMOTION)) add("robber: invalid enum");
    if (r.escapeTargetZoneId !== null && zones.get(r.escapeTargetZoneId)?.kind !== "escape") add("robber: target must be an escape zone");
    route(r.route, "robber");
  }
  if (m.result) issues.push(...resultIssues(m.result, s));
  return issues;
}

function playerIssues(p: PlayerRecord, s: AuthoritativeSnapshot, vehicles: Map<string, AuthoritativeSnapshot["vehicles"][number]>, tuning: GameTuning): string[] {
  const issues: string[] = [];
  const add = (m: string) => issues.push(`player ${p.id}: ${m}`);
  const nick = parseNickname(p.nickname);
  if (!nick.ok || nick.value !== p.nickname) add("nickname invalid or not normalized");
  if (!isOneOf(p.connection, CONNECTION_STATUSES) || !isOneOf(p.participation, PARTICIPATION_STATES) || !isOneOf(p.locomotion, LOCOMOTION_STATES)) {
    add("invalid enum");
  }
  if (!(p.stamina >= 0 && p.stamina <= tuning.movement.staminaMax)) add("stamina out of range");
  if (!isUint32(p.lastProcessedInputSequence) || !isUint32(p.lastProcessedActionId)) add("ack counters must be uint32");
  const vehicle = p.vehicleId === null ? undefined : vehicles.get(p.vehicleId);
  if (p.vehicleId !== null && !vehicle) add("unknown vehicle");
  switch (p.locomotion) {
    case "onFoot":
      if (p.vehicleId !== null || p.seatIndex !== null) add("on foot but has a vehicle/seat");
      break;
    case "passenger":
      if (vehicle?.passengerIds[p.seatIndex ?? -1] !== p.id) add("passenger seat mismatch");
      if (p.route !== null) add("passengers carry no route");
      break;
    default:
      if (vehicle?.type !== p.locomotion || vehicle.ownerId !== p.id || p.seatIndex !== null) add(`${p.locomotion} rider must own a ${p.locomotion}`);
  }
  if ((p.participation === "arrested" || p.participation === "forfeit") && p.vehicleId !== null) add("arrested/forfeit players must be dismounted");
  if (s.match.phase === "lobby" && p.locomotion !== "onFoot") add("lobby players are on foot");
  return issues;
}

function resultIssues(result: MatchResult, s: AuthoritativeSnapshot): string[] {
  const issues: string[] = [];
  const add = (m: string) => issues.push(`result: ${m}`);
  const players = new Set(s.players.map((p) => p.id as string));
  if (result.outcome === "capture") {
    if (result.reason !== "captured" || !players.has(result.winnerId)) add("capture needs reason captured and an existing winner");
    if (s.robber?.aiState !== "captured") add("robber must be captured");
  } else {
    if (!isOneOf(result.reason, NO_WINNER_REASONS) || result.winnerId !== null) add("no-winner result must have a valid reason and no winner");
    if (result.reason === "escaped" && s.robber?.aiState !== "escaped") add("robber must have escaped");
    if (result.awards.some((a) => a.kind === "mainPrize")) add("main prize requires a capture");
  }
  for (const a of result.awards) {
    if (!isOneOf(a.kind, AWARD_KINDS) || !players.has(a.playerId)) add(`invalid award ${a.kind}`);
    if (a.kind === "mainPrize" && a.playerId !== result.winnerId) add("main prize must go to the winner");
  }
  for (const st of result.stats) if (!players.has(st.playerId)) add("stats reference an unknown player");
  for (const d of result.deductions) {
    if (!players.has(d.playerId) || !isOneOf(d.reason, DEDUCTION_REASONS) || !(d.amount >= 0)) add("invalid deduction");
  }
  if (result.resolvedAtTick > s.match.tick) add("resolved after the snapshot tick");
  return issues;
}

export function checkEventSequence(events: readonly GameEvent[]): string[] {
  const issues: string[] = [];
  events.forEach((event, i) => {
    const previous = events[i - 1];
    if (!isOneOf(event.type, GAME_EVENT_TYPES)) issues.push(`event ${event.id}: unknown type`);
    if (!Number.isInteger(event.id) || event.id < 1 || (previous && event.id <= previous.id)) issues.push(`event ${event.id}: IDs must increase`);
    if (previous && event.tick < previous.tick) issues.push(`event ${event.id}: tick went backwards`);
    if (event.type === "matchEnded" && i !== events.length - 1) issues.push(`event ${event.id}: matchEnded must be last`);
  });
  return issues;
}

export function checkViewModel(view: UiViewModel): string[] {
  const issues: string[] = [];
  const add = (m: string) => issues.push(m);
  if (view.dataSource !== "server" && view.dataSource !== "fixture") add("invalid dataSource");
  if (!isOneOf(view.connection.state, CLIENT_CONNECTION_STATES)) add("invalid connection state");
  if (view.phase !== null && !isOneOf(view.phase, MATCH_PHASES)) add("invalid phase");
  if (!isOneOf(view.settings.quality, QUALITY_PRESETS) || !(view.settings.volume >= 0 && view.settings.volume <= 1)) add("invalid settings");
  if (view.phase === "lobby" && !view.lobby) add("lobby phase without lobby view");
  if (view.phase === "results" && !view.result) add("results phase without result view");
  if (view.localPlayer && !(view.localPlayer.staminaFraction >= 0 && view.localPlayer.staminaFraction <= 1)) add("stamina fraction outside 0..1");
  if (view.timer && !(view.timer.remainingMs >= 0)) add("negative timer");
  for (const p of view.lobby?.players ?? []) {
    const nick = parseNickname(p.nickname);
    if (!nick.ok || nick.value !== p.nickname) add(`lobby nickname invalid: ${p.id}`);
  }
  if (view.lobby && view.lobby.players.filter((p) => p.isLocal).length !== 1) add("lobby needs exactly one local player");
  return issues;
}
