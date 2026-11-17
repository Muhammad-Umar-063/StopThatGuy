import type { Vec3 } from "./geometry.js";
import type { ColliderId, EdgeId, JunctionId, NodeId, RouteId, SectorId, SpawnId, ZoneId } from "./ids.js";
import type { TravelMode, VehicleAccess, VehicleType } from "./states.js";

/**
 * Versioned static world data, loaded identically by client and server.
 * Gameplay movement and collision come only from this data, never from decorative meshes.
 * Distances in meters; positions follow the convention in geometry.ts.
 */
export interface WorldData {
  /** Must equal WORLD_SCHEMA_VERSION. */
  schemaVersion: number;
  /** Map content version label; part of VersionInfo. */
  worldVersion: string;
  sectors: Sector[];
  nodes: RouteNode[];
  edges: RouteEdge[];
  junctions: Junction[];
  colliders: ColliderPrimitive[];
  zones: Zone[];
  spawns: Spawn[];
  routes: AuthoredRoute[];
  /** Client-only camera obstruction proxies. Never used for gameplay collision. */
  cameraObstructions: ColliderPrimitive[];
}

/** Streaming/visibility grouping for static render assets. */
export interface Sector {
  id: SectorId;
  label: string;
}

export const ROUTE_NODE_KINDS = ["waypoint", "junction", "deadEnd", "exit"] as const;
export type RouteNodeKind = (typeof ROUTE_NODE_KINDS)[number];

export interface RouteNode {
  id: NodeId;
  position: Vec3;
  kind: RouteNodeKind;
  sectorId: SectorId;
}

/** Directed travel edge. Two-way streets use one edge per direction. */
export interface RouteEdge {
  id: EdgeId;
  from: NodeId;
  to: NodeId;
  /** Polyline from the `from` node to the `to` node inclusive; y is the ground height. */
  centerline: Vec3[];
  /** Length of the centerline polyline. */
  lengthM: number;
  /**
   * Lane-center offsets from the centerline, perpendicular to travel, positive = right of travel,
   * ordered left to right. Lane index = position in this array. One entry = single lane (turns only).
   */
  laneOffsetsM: number[];
  allowedModes: TravelMode[];
  /** Null = the travelling mode's default speed. */
  speedLimitMps: number | null;
  /** Street/branch name for cues; null when unnamed. */
  label: string | null;
  sectorId: SectorId;
}

/** Left/right are relative to the incoming edge tangent. "forward" = default continuation, incl. dead-end turnarounds. */
export const BRANCH_SIDES = ["left", "right", "forward"] as const;
export type BranchSide = (typeof BRANCH_SIDES)[number];

export interface JunctionBranch {
  side: BranchSide;
  toEdgeId: EdgeId;
  /** Turn curve from the incoming edge onto `toEdgeId`; empty for a straight continuation. */
  turnPath: Vec3[];
  /** Modes allowed to take this branch (subset of the target edge's modes). */
  allowedModes: TravelMode[];
}

/** Decision point for one incoming edge at `nodeId`. A crossroads has one Junction per incoming edge. */
export interface Junction {
  id: JunctionId;
  nodeId: NodeId;
  fromEdgeId: EdgeId;
  /** Turn/trigger window as distances along the incoming edge, 0 ≤ startM < endM ≤ lengthM. */
  window: { startM: number; endM: number };
  branches: JunctionBranch[];
}

export type Volume =
  | { shape: "box"; center: Vec3; halfExtents: Vec3; yaw: number }
  | { shape: "cylinder"; center: Vec3; radiusM: number; heightM: number };

/** Static gameplay collision primitive. */
export type ColliderPrimitive = Volume & { id: ColliderId };

export const ZONE_KINDS = ["shop", "liftStop", "escape"] as const;
export type ZoneKind = (typeof ZONE_KINDS)[number];

/** Trigger volume: theft interaction area, lift boarding stop or robber escape exit. */
export interface Zone {
  id: ZoneId;
  kind: ZoneKind;
  volume: Volume;
  sectorId: SectorId;
}

/** Position on the graph: distance along an edge and a lane index into its laneOffsetsM. */
export interface RoutePlacement {
  edgeId: EdgeId;
  distanceM: number;
  laneIndex: number;
}

export type Spawn =
  | { id: SpawnId; kind: "player" | "robber" | "police"; placement: RoutePlacement }
  | { id: SpawnId; kind: "vehicle"; placement: RoutePlacement; vehicleType: VehicleType; access: VehicleAccess };

/** Authored edge sequence; consecutive edges must connect (edge[i].to === edge[i + 1].from). */
export type AuthoredRoute =
  | { id: RouteId; kind: "robberEscape"; edgeIds: EdgeId[]; exitZoneId: ZoneId }
  | { id: RouteId; kind: "police" | "lift"; edgeIds: EdgeId[] };

/** Checks named in CITY.md "Graph and collision"; produced by world validation tooling (T004/T005). */
export const WORLD_ISSUE_CODES = [
  "duplicateId",
  "danglingReference",
  "disconnectedStart",
  "unreachableExit",
  "illegalVehicleRoute",
  "missingTurnaround",
  "spawnInsideCollider",
  "invalidValue",
] as const;
export type WorldIssueCode = (typeof WORLD_ISSUE_CODES)[number];

export interface WorldValidationIssue {
  severity: "error" | "warning";
  code: WorldIssueCode;
  message: string;
  /** IDs of the offending records. */
  refs: string[];
}

export interface WorldValidationReport {
  schemaVersion: number;
  worldVersion: string;
  ok: boolean;
  issues: WorldValidationIssue[];
}
