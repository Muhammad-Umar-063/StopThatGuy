// World-data validation for authored maps and fixtures (pure; no Node or browser APIs).
//
// Phase 1 checks the structure of untrusted data: unknown fields, types, finite coordinates, positive
// dimensions, lane and mode definitions, enumerations. Phase 2 runs only on structurally valid data and
// checks identities, references and local topology. Phase 3 (T005) runs only when phases 1–2 found no
// errors and checks layout: foot reachability from player spawns, reachable exits, per-mode continuation
// (no mode stranded at an edge end), spawn/collider and spawn/spawn clearance, grade limits and turn-path
// ground heights. Not covered: collider placement relative to routes, lateral slope, dynamic blockers.
import {
  BRANCH_SIDES,
  ROUTE_NODE_KINDS,
  TRAVEL_MODES,
  VEHICLE_ACCESS,
  VEHICLE_TYPES,
  WORLD_SCHEMA_VERSION,
  ZONE_KINDS,
  type ColliderPrimitive,
  type RouteEdge,
  type Spawn,
  type TravelMode,
  type Vec3,
  type WorldData,
  type WorldIssueCode,
  type WorldValidationIssue,
  type WorldValidationReport,
} from "@stopthatguy/shared";

const EPSILON_M = 0.01;
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/;
const VERSION_LABEL = /^[A-Za-z0-9._-]{1,32}$/;
const SPAWN_KINDS = ["player", "robber", "police", "vehicle"] as const;
const ROUTE_KINDS = ["robberEscape", "police", "lift"] as const;
const VEHICLE_MODE: Record<string, TravelMode> = { bicycle: "bicycle", scooter: "scooter", lift: "lift" };

type Add = (severity: WorldValidationIssue["severity"], code: WorldIssueCode, message: string, refs: string[]) => void;

export function validateWorldData(input: unknown): WorldValidationReport {
  const issues: WorldValidationIssue[] = [];
  const add: Add = (severity, code, message, refs) => issues.push({ severity, code, message, refs });
  if (checkStructure(input, add)) {
    checkReferences(input as WorldData, add);
    if (!issues.some((issue) => issue.severity === "error")) checkLayout(input as WorldData, add);
  }
  const record = typeof input === "object" && input !== null ? (input as Record<string, unknown>) : {};
  return {
    schemaVersion: typeof record.schemaVersion === "number" ? record.schemaVersion : -1,
    worldVersion: typeof record.worldVersion === "string" ? record.worldVersion : "",
    ok: !issues.some((issue) => issue.severity === "error"),
    issues,
  };
}

export function polylineLength(points: readonly Vec3[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    total += Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
  }
  return total;
}

// --- Phase 1: structure ------------------------------------------------------------------------

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const isFiniteNumber = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const includes = (list: readonly string[], v: unknown) => typeof v === "string" && list.includes(v);

function checkStructure(input: unknown, add: Add): boolean {
  let ok = true;
  const bad = (path: string, message: string, id?: string) => {
    ok = false;
    add("error", "invalidValue", `${path}: ${message}`, id ? [id, path] : [path]);
  };
  const keys = (o: Obj, allowed: readonly string[], path: string, id?: string) => {
    for (const key of Object.keys(o)) if (!allowed.includes(key)) bad(`${path}.${key}`, "unknown field", id);
    for (const key of allowed) if (!(key in o)) bad(`${path}.${key}`, "missing field", id);
  };
  const ref = (v: unknown, path: string, id?: string) => {
    if (typeof v !== "string" || !ID_PATTERN.test(v)) bad(path, "must be an ID (1–64 of [A-Za-z0-9._:-])", id);
  };
  const vec = (v: unknown, path: string, id?: string) => {
    if (!isObj(v) || !isFiniteNumber(v.x) || !isFiniteNumber(v.y) || !isFiniteNumber(v.z) || Object.keys(v).length !== 3) {
      bad(path, "must be {x, y, z} with finite numbers", id);
    }
  };
  const modes = (v: unknown, path: string, id?: string) => {
    if (!Array.isArray(v) || v.length === 0 || !v.every((m) => includes(TRAVEL_MODES, m)) || new Set(v).size !== v.length) {
      bad(path, `must be a non-empty list of distinct modes (${TRAVEL_MODES.join(", ")})`, id);
    }
  };
  const enumValue = (v: unknown, allowed: readonly string[], path: string, id?: string) => {
    if (!includes(allowed, v)) bad(path, `must be one of ${allowed.join(", ")}`, id);
  };
  const positive = (v: unknown, path: string, id?: string) => {
    if (!isFiniteNumber(v) || v <= 0) bad(path, "must be a finite number > 0", id);
  };
  const volume = (v: unknown, path: string, extra: readonly string[], id?: string) => {
    if (!isObj(v)) return bad(path, "must be a box or cylinder volume", id);
    if (v.shape === "box") {
      keys(v, [...extra, "shape", "center", "halfExtents", "yaw"], path, id);
      vec(v.center, `${path}.center`, id);
      vec(v.halfExtents, `${path}.halfExtents`, id);
      const h = v.halfExtents;
      if (isObj(h) && ![h.x, h.y, h.z].every((n) => isFiniteNumber(n) && n > 0)) bad(`${path}.halfExtents`, "must all be > 0", id);
      if (!isFiniteNumber(v.yaw)) bad(`${path}.yaw`, "must be a finite number", id);
    } else if (v.shape === "cylinder") {
      keys(v, [...extra, "shape", "center", "radiusM", "heightM"], path, id);
      vec(v.center, `${path}.center`, id);
      positive(v.radiusM, `${path}.radiusM`, id);
      positive(v.heightM, `${path}.heightM`, id);
    } else bad(`${path}.shape`, "must be box or cylinder", id);
  };
  const items = (key: string, check: (item: Obj, path: string, id: string) => void) => {
    const list = (input as Obj)[key];
    if (!Array.isArray(list)) return bad(`$.${key}`, "must be an array");
    list.forEach((item: unknown, index) => {
      const path = `$.${key}[${index}]`;
      if (!isObj(item)) return bad(path, "must be an object");
      if (typeof item.id !== "string" || !ID_PATTERN.test(item.id)) return bad(`${path}.id`, "must be an ID (1–64 of [A-Za-z0-9._:-])");
      check(item, path, item.id);
    });
  };

  if (!isObj(input)) {
    bad("$", "world data must be an object");
    return false;
  }
  keys(input, ["schemaVersion", "worldVersion", "sectors", "nodes", "edges", "junctions", "colliders", "zones", "spawns", "routes", "cameraObstructions"], "$");
  if (input.schemaVersion !== WORLD_SCHEMA_VERSION) bad("$.schemaVersion", `must be ${WORLD_SCHEMA_VERSION}`);
  if (typeof input.worldVersion !== "string" || !VERSION_LABEL.test(input.worldVersion)) bad("$.worldVersion", "must be 1–32 of [A-Za-z0-9._-]");

  items("sectors", (o, path, id) => {
    keys(o, ["id", "label"], path, id);
    if (typeof o.label !== "string") bad(`${path}.label`, "must be a string", id);
  });
  items("nodes", (o, path, id) => {
    keys(o, ["id", "position", "kind", "sectorId"], path, id);
    vec(o.position, `${path}.position`, id);
    enumValue(o.kind, ROUTE_NODE_KINDS, `${path}.kind`, id);
    ref(o.sectorId, `${path}.sectorId`, id);
  });
  items("edges", (o, path, id) => {
    keys(o, ["id", "from", "to", "centerline", "lengthM", "laneOffsetsM", "allowedModes", "speedLimitMps", "label", "sectorId"], path, id);
    ref(o.from, `${path}.from`, id);
    ref(o.to, `${path}.to`, id);
    ref(o.sectorId, `${path}.sectorId`, id);
    if (!Array.isArray(o.centerline) || o.centerline.length < 2) bad(`${path}.centerline`, "needs at least 2 points", id);
    else o.centerline.forEach((p: unknown, i) => vec(p, `${path}.centerline[${i}]`, id));
    positive(o.lengthM, `${path}.lengthM`, id);
    const lanes = o.laneOffsetsM;
    if (!Array.isArray(lanes) || lanes.length === 0 || !lanes.every((v: unknown, i) => isFiniteNumber(v) && (i === 0 || v > (lanes[i - 1] as number)))) {
      bad(`${path}.laneOffsetsM`, "must be a non-empty list of finite offsets in strictly ascending (left-to-right) order", id);
    }
    modes(o.allowedModes, `${path}.allowedModes`, id);
    if (o.speedLimitMps !== null) positive(o.speedLimitMps, `${path}.speedLimitMps`, id);
    if (o.label !== null && typeof o.label !== "string") bad(`${path}.label`, "must be a string or null", id);
  });
  items("junctions", (o, path, id) => {
    keys(o, ["id", "nodeId", "fromEdgeId", "window", "branches"], path, id);
    ref(o.nodeId, `${path}.nodeId`, id);
    ref(o.fromEdgeId, `${path}.fromEdgeId`, id);
    const w = o.window;
    if (!isObj(w) || !isFiniteNumber(w.startM) || !isFiniteNumber(w.endM) || !(w.startM >= 0 && w.startM < w.endM) || Object.keys(w).length !== 2) {
      bad(`${path}.window`, "must be {startM, endM} with 0 ≤ startM < endM", id);
    }
    if (!Array.isArray(o.branches) || o.branches.length === 0) return bad(`${path}.branches`, "must be a non-empty array", id);
    o.branches.forEach((b: unknown, i) => {
      const bPath = `${path}.branches[${i}]`;
      if (!isObj(b)) return bad(bPath, "must be an object", id);
      keys(b, ["side", "toEdgeId", "turnPath", "allowedModes"], bPath, id);
      enumValue(b.side, BRANCH_SIDES, `${bPath}.side`, id);
      ref(b.toEdgeId, `${bPath}.toEdgeId`, id);
      if (!Array.isArray(b.turnPath)) bad(`${bPath}.turnPath`, "must be an array", id);
      else b.turnPath.forEach((p: unknown, j) => vec(p, `${bPath}.turnPath[${j}]`, id));
      modes(b.allowedModes, `${bPath}.allowedModes`, id);
    });
  });
  items("colliders", (o, path, id) => volume(o, path, ["id"], id));
  items("cameraObstructions", (o, path, id) => volume(o, path, ["id"], id));
  items("zones", (o, path, id) => {
    keys(o, ["id", "kind", "volume", "sectorId"], path, id);
    enumValue(o.kind, ZONE_KINDS, `${path}.kind`, id);
    volume(o.volume, `${path}.volume`, [], id);
    ref(o.sectorId, `${path}.sectorId`, id);
  });
  items("spawns", (o, path, id) => {
    const vehicle = o.kind === "vehicle";
    keys(o, vehicle ? ["id", "kind", "placement", "vehicleType", "access"] : ["id", "kind", "placement"], path, id);
    enumValue(o.kind, SPAWN_KINDS, `${path}.kind`, id);
    const p = o.placement;
    if (!isObj(p)) return bad(`${path}.placement`, "must be an object", id);
    keys(p, ["edgeId", "distanceM", "laneIndex"], `${path}.placement`, id);
    ref(p.edgeId, `${path}.placement.edgeId`, id);
    if (!isFiniteNumber(p.distanceM) || p.distanceM < 0) bad(`${path}.placement.distanceM`, "must be a finite number ≥ 0", id);
    if (!Number.isInteger(p.laneIndex) || (p.laneIndex as number) < 0) bad(`${path}.placement.laneIndex`, "must be an integer ≥ 0", id);
    if (vehicle) {
      enumValue(o.vehicleType, VEHICLE_TYPES, `${path}.vehicleType`, id);
      enumValue(o.access, VEHICLE_ACCESS, `${path}.access`, id);
    }
  });
  items("routes", (o, path, id) => {
    const escape = o.kind === "robberEscape";
    keys(o, escape ? ["id", "kind", "edgeIds", "exitZoneId"] : ["id", "kind", "edgeIds"], path, id);
    enumValue(o.kind, ROUTE_KINDS, `${path}.kind`, id);
    if (!Array.isArray(o.edgeIds) || o.edgeIds.length === 0) bad(`${path}.edgeIds`, "must be a non-empty array", id);
    else o.edgeIds.forEach((e: unknown, i) => ref(e, `${path}.edgeIds[${i}]`, id));
    if (escape) ref(o.exitZoneId, `${path}.exitZoneId`, id);
  });
  return ok;
}

// --- Phase 2: identities, references and local topology -----------------------------------------

function checkReferences(world: WorldData, add: Add): void {
  const error = (code: WorldIssueCode, message: string, ...refs: string[]) => add("error", code, message, refs);
  const index = <T extends { id: string }>(list: readonly T[], label: string): Map<string, T> => {
    const map = new Map<string, T>();
    for (const item of list) {
      if (map.has(item.id)) error("duplicateId", `duplicate ${label} id ${item.id}`, item.id);
      map.set(item.id, item);
    }
    return map;
  };
  const samePoint = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) < 1e-6;

  const sectors = index(world.sectors, "sector");
  const nodes = index(world.nodes, "node");
  const edges = index(world.edges, "edge");
  index(world.junctions, "junction");
  index([...world.colliders, ...world.cameraObstructions], "collider");
  const zones = index(world.zones, "zone");
  index(world.spawns, "spawn");
  index(world.routes, "route");

  for (const node of world.nodes) {
    if (!sectors.has(node.sectorId)) error("danglingReference", `node ${node.id}: unknown sector ${node.sectorId}`, node.id);
  }
  for (const edge of world.edges) {
    const from = nodes.get(edge.from);
    const to = nodes.get(edge.to);
    if (!from || !to) error("danglingReference", `edge ${edge.id}: unknown endpoint node`, edge.id);
    if (!sectors.has(edge.sectorId)) error("danglingReference", `edge ${edge.id}: unknown sector ${edge.sectorId}`, edge.id);
    if (from && !samePoint(edge.centerline[0]!, from.position)) error("invalidValue", `edge ${edge.id}: centerline does not start at ${edge.from}`, edge.id);
    if (to && !samePoint(edge.centerline[edge.centerline.length - 1]!, to.position)) {
      error("invalidValue", `edge ${edge.id}: centerline does not end at ${edge.to}`, edge.id);
    }
    const measured = polylineLength(edge.centerline);
    if (Math.abs(measured - edge.lengthM) > EPSILON_M) {
      error("invalidValue", `edge ${edge.id}: lengthM ${edge.lengthM} ≠ centerline ${measured.toFixed(3)}`, edge.id);
    }
  }

  const junctionsByEdge = new Map(world.junctions.map((j) => [j.fromEdgeId as string, j]));
  for (const j of world.junctions) {
    const from = edges.get(j.fromEdgeId);
    if (!nodes.has(j.nodeId)) error("danglingReference", `junction ${j.id}: unknown node ${j.nodeId}`, j.id);
    if (!from) error("danglingReference", `junction ${j.id}: unknown incoming edge ${j.fromEdgeId}`, j.id);
    else {
      if (from.to !== j.nodeId) error("invalidValue", `junction ${j.id}: incoming edge does not end at its node`, j.id);
      if (j.window.endM > from.lengthM + EPSILON_M) error("invalidValue", `junction ${j.id}: window outside incoming edge`, j.id);
    }
    const sides = j.branches.map((b) => b.side);
    if (new Set(sides).size !== sides.length) error("invalidValue", `junction ${j.id}: duplicate branch side`, j.id);
    for (const b of j.branches) {
      const target = edges.get(b.toEdgeId);
      if (!target) {
        error("danglingReference", `junction ${j.id}: unknown branch edge ${b.toEdgeId}`, j.id, b.toEdgeId);
        continue;
      }
      if (target.from !== j.nodeId) error("invalidValue", `junction ${j.id}: branch ${b.toEdgeId} does not start at the junction node`, j.id);
      if (!b.allowedModes.every((m) => target.allowedModes.includes(m))) {
        error("illegalVehicleRoute", `junction ${j.id}: branch ${b.side} modes must be a non-empty subset of ${target.id}`, j.id, target.id);
      }
    }
  }

  // Every edge into a non-exit node needs a way on; a dead end needs a forward turnaround.
  for (const edge of world.edges) {
    const end = nodes.get(edge.to);
    if (!end || end.kind === "exit") continue;
    const j = junctionsByEdge.get(edge.id);
    if (!j) error("missingTurnaround", `edge ${edge.id}: no junction where it ends (player would be stranded)`, edge.id);
    else if (end.kind === "deadEnd" && !j.branches.some((b) => b.side === "forward")) {
      error("missingTurnaround", `edge ${edge.id}: dead end ${end.id} has no forward turnaround branch`, edge.id, end.id);
    }
  }

  for (const z of world.zones) {
    if (!sectors.has(z.sectorId)) error("danglingReference", `zone ${z.id}: unknown sector ${z.sectorId}`, z.id);
  }

  for (const s of world.spawns) {
    const edge = edges.get(s.placement.edgeId);
    if (!edge) {
      error("danglingReference", `spawn ${s.id}: unknown edge ${s.placement.edgeId}`, s.id);
      continue;
    }
    placement(edge, s.placement.distanceM, s.placement.laneIndex, `spawn ${s.id}`, s.id, error);
    if (s.kind === "vehicle") {
      const mode = VEHICLE_MODE[s.vehicleType];
      if (mode && !edge.allowedModes.includes(mode)) error("illegalVehicleRoute", `spawn ${s.id}: ${s.vehicleType} not allowed on ${edge.id}`, s.id, edge.id);
    }
  }
  if (!world.spawns.some((s) => s.kind === "player")) error("invalidValue", "world has no player spawn", "$.spawns");
  if (!world.spawns.some((s) => s.kind === "robber")) error("invalidValue", "world has no robber spawn", "$.spawns");

  for (const r of world.routes) {
    r.edgeIds.forEach((edgeId, i) => {
      const edge = edges.get(edgeId);
      if (!edge) return error("danglingReference", `route ${r.id}: unknown edge ${edgeId}`, r.id, edgeId);
      if (r.kind === "lift" && !edge.allowedModes.includes("lift")) error("illegalVehicleRoute", `route ${r.id}: lift not allowed on ${edgeId}`, r.id, edgeId);
      const next = r.edgeIds[i + 1];
      if (next !== undefined && edges.has(next) && !junctionsByEdge.get(edgeId)?.branches.some((b) => b.toEdgeId === next)) {
        error(r.kind === "robberEscape" ? "unreachableExit" : "invalidValue", `route ${r.id}: no junction branch from ${edgeId} to ${next}`, r.id);
      }
    });
    if (r.kind === "robberEscape") {
      const zone = zones.get(r.exitZoneId);
      if (!zone) error("danglingReference", `route ${r.id}: unknown exit zone ${r.exitZoneId}`, r.id, r.exitZoneId);
      else if (zone.kind !== "escape") error("invalidValue", `route ${r.id}: exit zone ${zone.id} is a ${zone.kind} zone, not an escape zone`, r.id, zone.id);
      const last = edges.get(r.edgeIds[r.edgeIds.length - 1]!);
      if (last && nodes.get(last.to)?.kind !== "exit") error("unreachableExit", `route ${r.id}: does not end at an exit node`, r.id);
    }
  }
  if (!world.routes.some((r) => r.kind === "robberEscape")) {
    add("warning", "unreachableExit", "world has no robber escape route; matches can only end by timeout", ["$.routes"]);
  }
}

function placement(edge: RouteEdge, distanceM: number, laneIndex: number, label: string, id: string, error: (code: WorldIssueCode, message: string, ...refs: string[]) => void) {
  if (distanceM > edge.lengthM + EPSILON_M) error("invalidValue", `${label}: distance beyond ${edge.id}`, id);
  if (laneIndex >= edge.laneOffsetsM.length) error("invalidValue", `${label}: lane ${laneIndex} outside ${edge.id}`, id);
}

// --- Phase 3: layout (T005) ---------------------------------------------------------------------

/** Provisional blockout limits (assistant-selected in T005; revisit with real movement and maps). */
export const WORLD_LAYOUT_LIMITS = Object.freeze({
  /** Steepest centerline grade (rise / horizontal run) on edges open to bicycles, scooters or the lift. */
  maxWheeledGrade: 0.15,
  /** Steepest grade on foot-only edges (stairs). */
  maxFootGrade: 0.8,
  /** Turn-path ends must lie within this vertical distance (m) of the ground of the edges they join. */
  groundToleranceM: 0.3,
  /** Footprint reserved at a spawn (m) when checking colliders and other spawns. */
  spawnFootprint: Object.freeze({
    player: Object.freeze({ radiusM: 0.45, heightM: 1.8 }),
    robber: Object.freeze({ radiusM: 0.45, heightM: 1.8 }),
    police: Object.freeze({ radiusM: 0.45, heightM: 1.8 }),
    bicycle: Object.freeze({ radiusM: 0.9, heightM: 1.4 }),
    scooter: Object.freeze({ radiusM: 1.0, heightM: 1.4 }),
    lift: Object.freeze({ radiusM: 2.2, heightM: 2.5 }),
  }),
});

/**
 * Point on an edge centerline at `distanceM` (clamped to the polyline), offset horizontally to the right
 * of travel by `lateralOffsetM`; yaw follows the containing segment. Same convention as shared
 * geometry.ts and the simulation's poseOnRoute (cross-checked by tests/street-world.test.ts).
 */
export function pointOnEdge(edge: RouteEdge, distanceM: number, lateralOffsetM = 0): { position: Vec3; yaw: number } {
  const points = edge.centerline;
  const cumulative = [0];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    cumulative.push(cumulative[i - 1]! + Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z));
  }
  const distance = Math.min(Math.max(distanceM, 0), cumulative[cumulative.length - 1]!);
  let i = 1;
  while (i < points.length - 1 && (cumulative[i]! < distance || cumulative[i]! === cumulative[i - 1]!)) i++;
  const a = points[i - 1]!;
  const b = points[i]!;
  const length = cumulative[i]! - cumulative[i - 1]!;
  const t = length > 0 ? (distance - cumulative[i - 1]!) / length : 0;
  const yaw = Math.atan2(b.x - a.x, b.z - a.z);
  return {
    position: {
      x: a.x + (b.x - a.x) * t + Math.cos(yaw) * lateralOffsetM,
      y: a.y + (b.y - a.y) * t,
      z: a.z + (b.z - a.z) * t - Math.sin(yaw) * lateralOffsetM,
    },
    yaw,
  };
}

/** World position of a spawn placement, or undefined when its edge or lane does not exist. */
export function spawnPosition(world: WorldData, spawn: Spawn): Vec3 | undefined {
  const edge = world.edges.find((e) => e.id === spawn.placement.edgeId);
  const offset = edge?.laneOffsetsM[spawn.placement.laneIndex];
  return edge && offset !== undefined ? pointOnEdge(edge, spawn.placement.distanceM, offset).position : undefined;
}

/** Edges reachable in `mode` from the start edges by following junction branches open to that mode. */
export function reachableEdges(world: WorldData, startEdgeIds: Iterable<string>, mode: TravelMode): Set<string> {
  const edges = new Map(world.edges.map((e) => [e.id as string, e]));
  const junctions = new Map(world.junctions.map((j) => [j.fromEdgeId as string, j]));
  const reached = new Set<string>();
  const queue: string[] = [];
  for (const id of startEdgeIds) {
    if (edges.get(id)?.allowedModes.includes(mode) && !reached.has(id)) {
      reached.add(id);
      queue.push(id);
    }
  }
  for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
    for (const branch of junctions.get(next)?.branches ?? []) {
      const target = edges.get(branch.toEdgeId);
      if (branch.allowedModes.includes(mode) && target?.allowedModes.includes(mode) && !reached.has(target.id)) {
        reached.add(target.id);
        queue.push(target.id);
      }
    }
  }
  return reached;
}

/** Ground height of the edge centerline at the point nearest (horizontally) to x/z. */
function groundHeightNear(edge: RouteEdge, x: number, z: number): number {
  let best = { distance: Infinity, y: edge.centerline[0]!.y };
  for (let i = 1; i < edge.centerline.length; i++) {
    const a = edge.centerline[i - 1]!;
    const b = edge.centerline[i]!;
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const run = dx * dx + dz * dz;
    const t = run > 0 ? Math.min(Math.max(((x - a.x) * dx + (z - a.z) * dz) / run, 0), 1) : 0;
    const distance = Math.hypot(a.x + dx * t - x, a.z + dz * t - z);
    if (distance < best.distance) best = { distance, y: a.y + (b.y - a.y) * t };
  }
  return best.y;
}

type Footprint = { radiusM: number; heightM: number };
const footprintOf = (spawn: Spawn): Footprint =>
  spawn.kind === "vehicle" ? WORLD_LAYOUT_LIMITS.spawnFootprint[spawn.vehicleType] : WORLD_LAYOUT_LIMITS.spawnFootprint[spawn.kind];

function overlapsCollider(p: Vec3, footprint: Footprint, c: ColliderPrimitive): boolean {
  const halfHeight = c.shape === "box" ? c.halfExtents.y : c.heightM / 2;
  if (p.y + footprint.heightM <= c.center.y - halfHeight || p.y >= c.center.y + halfHeight) return false;
  const dx = p.x - c.center.x;
  const dz = p.z - c.center.z;
  if (c.shape === "cylinder") return Math.hypot(dx, dz) < c.radiusM + footprint.radiusM;
  // Box local axes: +X = right (cos yaw, 0, -sin yaw), +Z = forward (sin yaw, 0, cos yaw).
  const localX = dx * Math.cos(c.yaw) - dz * Math.sin(c.yaw);
  const localZ = dx * Math.sin(c.yaw) + dz * Math.cos(c.yaw);
  const outsideX = Math.max(Math.abs(localX) - c.halfExtents.x, 0);
  const outsideZ = Math.max(Math.abs(localZ) - c.halfExtents.z, 0);
  return Math.hypot(outsideX, outsideZ) < footprint.radiusM;
}

function checkLayout(world: WorldData, add: Add): void {
  const limits = WORLD_LAYOUT_LIMITS;
  const edges = new Map(world.edges.map((e) => [e.id as string, e]));
  const nodes = new Map(world.nodes.map((n) => [n.id as string, n]));
  const junctions = new Map(world.junctions.map((j) => [j.fromEdgeId as string, j]));

  // Reachability on foot (players start on foot) from every player spawn, and reachable exits.
  const footEdges = world.edges.filter((e) => e.allowedModes.includes("foot")).map((e) => e.id as string);
  const reachedByAny = new Set<string>();
  for (const spawn of world.spawns.filter((s) => s.kind === "player")) {
    const reached = reachableEdges(world, [spawn.placement.edgeId], "foot");
    reached.forEach((id) => reachedByAny.add(id));
    const missing = footEdges.filter((id) => !reached.has(id));
    if (missing.length > 0) {
      add("error", "disconnectedStart", `player spawn ${spawn.id} cannot reach on foot: ${missing.join(", ")}`, [spawn.id, ...missing]);
    }
  }
  for (const node of world.nodes.filter((n) => n.kind === "exit")) {
    if (!world.edges.some((e) => e.to === node.id && reachedByAny.has(e.id))) {
      add("error", "unreachableExit", `exit ${node.id} cannot be reached on foot from any player spawn`, [node.id]);
    }
  }

  // Every mode allowed on an edge must have a way on where the edge ends (branch or turnaround).
  for (const edge of world.edges) {
    if (nodes.get(edge.to)?.kind === "exit") continue;
    const junction = junctions.get(edge.id);
    for (const mode of edge.allowedModes) {
      if (!junction?.branches.some((b) => b.allowedModes.includes(mode))) {
        add("error", "missingTurnaround", `edge ${edge.id}: ${mode} has no branch or turnaround at ${edge.to}`, [edge.id, ...(junction ? [junction.id] : [])]);
      }
    }
  }

  // Ground: grade limits per edge and turn-path ends on the ground of the edges they join.
  for (const edge of world.edges) {
    let steepest = 0;
    for (let i = 1; i < edge.centerline.length; i++) {
      const a = edge.centerline[i - 1]!;
      const b = edge.centerline[i]!;
      const run = Math.hypot(b.x - a.x, b.z - a.z);
      const rise = Math.abs(b.y - a.y);
      if (rise > 0) steepest = Math.max(steepest, run > 0 ? rise / run : Infinity);
    }
    const percent = (n: number) => `${(n * 100).toFixed(1)}%`;
    if (edge.allowedModes.some((m) => m !== "foot") && steepest > limits.maxWheeledGrade) {
      add("error", "illegalVehicleRoute", `edge ${edge.id}: grade ${percent(steepest)} exceeds ${percent(limits.maxWheeledGrade)} for wheeled modes`, [edge.id]);
    } else if (steepest > limits.maxFootGrade) {
      add("error", "invalidValue", `edge ${edge.id}: grade ${percent(steepest)} exceeds ${percent(limits.maxFootGrade)} for foot routes`, [edge.id]);
    }
  }
  for (const junction of world.junctions) {
    for (const branch of junction.branches) {
      const ends: [Vec3 | undefined, RouteEdge | undefined, string][] = [
        [branch.turnPath[0], edges.get(junction.fromEdgeId), "start"],
        [branch.turnPath[branch.turnPath.length - 1], edges.get(branch.toEdgeId), "end"],
      ];
      for (const [point, edge, which] of ends) {
        if (!point || !edge) continue;
        const offset = point.y - groundHeightNear(edge, point.x, point.z);
        if (Math.abs(offset) > limits.groundToleranceM) {
          add("error", "invalidValue", `junction ${junction.id}: ${branch.side} turn path ${which} is ${offset.toFixed(2)} m off the ground of ${edge.id}`, [junction.id]);
        }
      }
    }
  }

  // Spawns: clear of colliders and of each other.
  const placed = world.spawns.map((spawn) => ({ spawn, position: spawnPosition(world, spawn)!, footprint: footprintOf(spawn) }));
  for (const { spawn, position, footprint } of placed) {
    for (const collider of world.colliders) {
      if (overlapsCollider(position, footprint, collider)) {
        add("error", "spawnInsideCollider", `spawn ${spawn.id} overlaps collider ${collider.id}`, [spawn.id, collider.id]);
      }
    }
  }
  for (let i = 0; i < placed.length; i++) {
    for (let j = i + 1; j < placed.length; j++) {
      const a = placed[i]!;
      const b = placed[j]!;
      const verticalOverlap = a.position.y < b.position.y + b.footprint.heightM && b.position.y < a.position.y + a.footprint.heightM;
      const horizontal = Math.hypot(a.position.x - b.position.x, a.position.z - b.position.z);
      if (verticalOverlap && horizontal < a.footprint.radiusM + b.footprint.radiusM) {
        add("error", "invalidValue", `spawns ${a.spawn.id} and ${b.spawn.id} overlap (${horizontal.toFixed(2)} m apart)`, [a.spawn.id, b.spawn.id]);
      }
    }
  }
}
