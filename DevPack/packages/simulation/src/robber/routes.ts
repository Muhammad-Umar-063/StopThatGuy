import type { EdgeId, GameTuning, JunctionBranch, RobberLocomotion, RouteId, RouteProgress, Vec3, Zone } from "@stopthatguy/shared";
import { isPathClear, type CollisionBody } from "../collision/index.js";
import { poseOnRoute } from "../movement/geometry.js";
import { projectDistance } from "../movement/path.js";
import { planBranch } from "../movement/traversal.js";
import type { WorldIndex } from "../movement/world-index.js";
import { entersVolume } from "./volume.js";

/** Linear pieces retain every authored road/turn vertex; distance is actual world-space arc length. */
export interface RobberSegment {
  from: Vec3;
  to: Vec3;
  lengthM: number;
  fromRoute: RouteProgress;
  toRoute: RouteProgress;
  road: boolean;
  mode: RobberLocomotion;
  speedMps: number;
}
export interface RobberPlan {
  segments: RobberSegment[];
  route: RouteProgress;
  mode: RobberLocomotion;
  routeId: RouteId | null;
  exit: Zone | null;
  reachedExit?: boolean;
}
export interface RouteContext { world: WorldIndex; tuning: GameTuning; body: CollisionBody }
const modeName = (mode: RobberLocomotion) => mode === "onFoot" ? "foot" : mode;
const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;

export function initialRobberMode(world: WorldIndex, route: RouteProgress): RobberLocomotion {
  const modes = world.edges.get(route.edgeId)!.edge.allowedModes;
  return modes.includes("scooter") ? "scooter" : modes.includes("foot") ? "onFoot" : "bicycle";
}

function speed(context: RouteContext, edgeId: EdgeId, mode: RobberLocomotion): number {
  const { tuning, world } = context;
  const nominal = mode === "onFoot" ? tuning.movement.runSpeedMps
    : mode === "scooter" ? tuning.vehicles.scooterSpeedMps : tuning.vehicles.bicycleSpeedMps;
  return Math.min(nominal, world.edges.get(edgeId)!.edge.speedLimitMps ?? nominal);
}

function piece(from: Vec3, to: Vec3, fromRoute: RouteProgress, toRoute: RouteProgress,
  mode: RobberLocomotion, speedMps: number, road: boolean): RobberSegment {
  return { from, to, fromRoute, toRoute, mode, speedMps, road,
    lengthM: Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z) };
}

function roadTo(plan: RobberPlan, distanceM: number, context: RouteContext, stopAtExit = false): RobberPlan | null {
  const { world, body } = context;
  const indexed = world.edges.get(plan.route.edgeId)!;
  if (!indexed.edge.allowedModes.includes(modeName(plan.mode))) return null;
  const checkpoints = [...indexed.cumulativeM.filter(d => d > plan.route.distanceM && d < distanceM), distanceM];
  let route = plan.route;
  const segments = [...plan.segments];
  for (const checkpoint of checkpoints) {
    let target = { ...route, distanceM: checkpoint };
    const from = poseOnRoute(world, route).position;
    let to = poseOnRoute(world, target).position;
    const entry = stopAtExit && plan.exit ? entersVolume(from, to, plan.exit.volume) : null;
    if (entry !== null) {
      target = { ...route, distanceM: route.distanceM + (checkpoint - route.distanceM) * entry };
      to = poseOnRoute(world, target).position;
    }
    if (!isPathClear([from, to], world.world.colliders, body)) return null;
    segments.push(piece(from, to, route, target, plan.mode, speed(context, route.edgeId, plan.mode), true));
    route = target;
    if (entry !== null) return { ...plan, segments, route, reachedExit: true };
  }
  return { ...plan, segments, route };
}

/** A dismount is allowed only at a clear junction shared by both travel modes. Never remount implicitly. */
function throughBranch(plan: RobberPlan, branch: JunctionBranch, context: RouteContext): RobberPlan | null {
  const { world, body } = context;
  const source = world.edges.get(plan.route.edgeId)!.edge;
  const target = world.edges.get(branch.toEdgeId)?.edge;
  const junction = world.junctionsByFromEdge.get(source.id);
  if (!target || !junction || source.to !== target.from || junction.nodeId !== source.to
    || plan.route.distanceM > junction.window.endM + 1e-6) return null;
  let mode = plan.mode;
  if (!branch.allowedModes.includes(modeName(mode)) || !target.allowedModes.includes(modeName(mode))) {
    if (!source.allowedModes.includes("foot") || !branch.allowedModes.includes("foot") || !target.allowedModes.includes("foot")) return null;
    mode = "onFoot";
  }
  const anchor = branch.turnPath[0];
  const distance = Math.max(plan.route.distanceM, Math.max(junction.window.startM,
    Math.min(junction.window.endM, anchor ? projectDistance(world, source.id, anchor) : junction.window.endM)));
  const incoming = roadTo(plan, distance, context);
  if (!incoming) return null;
  const connector = planBranch(world, { route: incoming.route, locomotion: mode, speedMps: 0,
    stamina: context.tuning.movement.staminaMax }, branch, body);
  if (!connector) return null;
  const segments = [...incoming.segments];
  const points = connector.path.points;
  const cap = Math.min(speed(context, source.id, mode), speed(context, target.id, mode));
  for (let i = 1; i < points.length; i++) {
    segments.push(piece(points[i - 1]!, points[i]!, incoming.route,
      i === points.length - 1 ? connector.target : incoming.route, mode, cap, false));
  }
  return { ...incoming, segments, route: connector.target, mode };
}

function orderedBranches(plan: RobberPlan, context: RouteContext): JunctionBranch[] {
  return [...(context.world.junctionsByFromEdge.get(plan.route.edgeId)?.branches ?? [])]
    .sort((a, b) => Number(b.side === "forward") - Number(a.side === "forward") || compare(a.toEdgeId, b.toEdgeId));
}

/** Bounded deterministic graph search connects the current position to an authored route's start. */
function* approaches(plan: RobberPlan, edgeId: EdgeId, context: RouteContext): Generator<RobberPlan> {
  const queue = [plan];
  const seen = new Set<string>();
  for (let i = 0; i < queue.length; i++) {
    const at = queue[i]!;
    const key = `${at.route.edgeId}:${at.route.distanceM}:${at.route.laneIndex}:${at.mode}`;
    if (seen.has(key)) continue;
    seen.add(key);
    // A shorter approach may have dismounted or joined a blocked lane. Let the
    // caller validate the suffix for each distinct arrival, not just the first.
    if (at.route.edgeId === edgeId) { yield at; continue; }
    for (const branch of orderedBranches(at, context)) {
      const next = throughBranch(at, branch, context);
      if (next) queue.push(next);
    }
  }
}

export function escapePlans(route: RouteProgress, mode: RobberLocomotion, context: RouteContext): RobberPlan[] {
  const plans: RobberPlan[] = [];
  for (const authored of [...context.world.world.routes].sort((a, b) => compare(a.id, b.id))) {
    if (authored.kind !== "robberEscape" || authored.edgeIds.length === 0) continue;
    const exit = context.world.world.zones.find(z => z.id === authored.exitZoneId && z.kind === "escape");
    if (!exit || authored.edgeIds.some(id => !context.world.edges.has(id))) continue;
    for (const arrival of approaches({ segments: [], route, mode, routeId: authored.id, exit }, authored.edgeIds[0]!, context)) {
      let plan: RobberPlan | null = arrival;
      for (let i = 1; plan && i < authored.edgeIds.length; i++) {
        const branch: JunctionBranch | undefined = orderedBranches(plan, context).find(b => b.toEdgeId === authored.edgeIds[i]);
        plan = branch ? throughBranch(plan, branch, context) : null;
      }
      if (!plan) continue;
      // Only the final edge may fulfill this route's exit. Triggers are swept, including narrow volumes.
      plan = roadTo(plan, context.world.edges.get(plan.route.edgeId)!.edge.lengthM, context, true);
      if (!plan) continue;
      if (!plan.reachedExit) continue;
      plans.push(plan);
      break; // One seeded choice per authored route, irrespective of approach count.
    }
  }
  return plans;
}

/** Prefer a clear default continuation. With none, travel the current edge only as far as the sweep allows. */
export function fallbackPlan(route: RouteProgress, mode: RobberLocomotion, context: RouteContext): RobberPlan {
  const base: RobberPlan = { segments: [], route, mode, routeId: null, exit: null };
  for (const branch of orderedBranches(base, context)) {
    const plan = throughBranch(base, branch, context);
    if (plan && plan.segments.some(s => s.lengthM > 1e-9)) return plan;
  }
  // Keep collision clipping in the executor for an obstructed dead end; never snap to a distant fallback.
  const edge = context.world.edges.get(route.edgeId)!.edge;
  const withoutColliders = { ...context, world: { ...context.world, world: { ...context.world.world, colliders: [] } } };
  return roadTo(base, edge.lengthM, withoutColliders) ?? base;
}
