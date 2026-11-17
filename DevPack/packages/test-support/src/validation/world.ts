// World-data validation for authored maps and fixtures (pure; no Node or browser APIs).
//
// Phase 1 checks the structure of untrusted data: unknown fields, types, finite coordinates, positive
// dimensions, lane and mode definitions, enumerations. Phase 2 runs only on structurally valid data and
// checks identities, references and local topology. Not covered yet (T005): reachability from spawns
// (disconnectedStart / unreachableExit beyond authored routes), spawn/collider overlap
// (spawnInsideCollider), slope and ground-height rules, collider placement.
import {
  BRANCH_SIDES,
  ROUTE_NODE_KINDS,
  TRAVEL_MODES,
  VEHICLE_ACCESS,
  VEHICLE_TYPES,
  WORLD_SCHEMA_VERSION,
  ZONE_KINDS,
  type RouteEdge,
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
  if (checkStructure(input, add)) checkReferences(input as WorldData, add);
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
