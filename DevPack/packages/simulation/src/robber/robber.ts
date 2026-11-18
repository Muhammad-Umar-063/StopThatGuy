import type { EdgeId, RobberRecord, RouteId, ZoneId } from "@stopthatguy/shared";
import { msToTicks } from "../clock.js";
import { sweepBody } from "../collision/index.js";
import { clonePlain } from "../copy.js";
import { integrateSpeed } from "../movement/kinematics.js";
import { movementBody } from "../movement/road.js";
import { nextInt, type RngState } from "../rng.js";
import { toInternal, type InternalState, type SimulationState } from "../state.js";
import { escapePlans, fallbackPlan, initialRobberMode, type RobberPlan, type RobberSegment, type RouteContext } from "./routes.js";

export interface RobberDiagnostic {
  tick: number;
  reason: "missingEscapeRoutes" | "unreachableEscapeRoutes" | "routeBlocked" | "noSafeContinuation";
  edgeId: EdgeId;
  routeId: RouteId | null;
}
export interface RobberMemory {
  plan: RobberPlan;
  segment: number;
  distanceM: number;
  transitionEndsAtTick: number | null;
  pendingEscape: ZoneId | null;
  halted: boolean;
  diagnostics: RobberDiagnostic[];
  reported: Set<string>;
}

function diagnostic(memory: RobberMemory, robber: RobberRecord, tick: number, reason: RobberDiagnostic["reason"]): void {
  const item = { tick, reason, edgeId: robber.route!.edgeId, routeId: memory.plan.routeId };
  const key = `${reason}:${item.edgeId}:${item.routeId}`;
  if (memory.reported.has(key)) return;
  memory.reported.add(key);
  memory.diagnostics.push(item);
}

export function initializeRobber(robber: RobberRecord, context: RouteContext, rng: RngState): RobberMemory {
  robber.locomotion = initialRobberMode(context.world, robber.route!);
  const plans = escapePlans(robber.route!, robber.locomotion, context);
  const plan = plans.length ? plans[nextInt(rng, plans.length)]! : fallbackPlan(robber.route!, robber.locomotion, context);
  robber.escapeTargetZoneId = plan.exit?.id ?? null;
  const memory: RobberMemory = { plan, segment: 0, distanceM: 0, transitionEndsAtTick: null,
    pendingEscape: null, halted: false, diagnostics: [], reported: new Set() };
  if (!plan.exit) diagnostic(memory, robber, 0, context.world.world.routes.some(r => r.kind === "robberEscape")
    ? "unreachableEscapeRoutes" : "missingEscapeRoutes");
  return memory;
}

/** Deterministic diagnostics are drained by a host; simulation performs no console or network I/O. */
export function collectRobberDiagnostics(state: SimulationState): RobberDiagnostic[] {
  const memory = toInternal(state).robberMemory;
  const result = clonePlain(memory.diagnostics);
  memory.diagnostics.length = 0;
  return result;
}

function setPosition(robber: RobberRecord, segment: RobberSegment, distance: number): void {
  const t = segment.lengthM > 0 ? Math.min(1, distance / segment.lengthM) : 1;
  const a = segment.from, b = segment.to;
  robber.pose = { position: { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t },
    yaw: segment.lengthM > 1e-9 ? Math.atan2(b.x - a.x, b.z - a.z) : robber.pose.yaw };
  robber.route = t >= 1 ? { ...segment.toRoute } : segment.road
    ? { ...segment.fromRoute, distanceM: segment.fromRoute.distanceM + (segment.toRoute.distanceM - segment.fromRoute.distanceM) * t }
    : { ...segment.fromRoute };
}

/** Split the tick at a geometry boundary without losing the unused elapsed time. */
function timeForDistance(speed: number, target: number, acceleration: number, seconds: number, distance: number): number {
  let low = 0, high = seconds;
  for (let i = 0; i < 40; i++) {
    const mid = (low + high) / 2;
    if (integrateSpeed(speed, target, acceleration, mid).distanceM < distance) low = mid;
    else high = mid;
  }
  return high;
}

/** Stage 2 only moves the robber and records a pending escape; stage 6 decides the result after capture. */
export function advanceRobber(s: InternalState, transitionMs: number): void {
  const robber = s.robber, memory = s.robberMemory;
  if (memory.halted || memory.pendingEscape || robber.aiState === "captured" || robber.aiState === "escaped") return;
  const context: RouteContext = { world: s.world, tuning: s.tuning,
    body: movementBody({ world: s.world, tuning: s.tuning, dtMs: s.fixedDeltaMs }) };
  if (memory.transitionEndsAtTick !== null) {
    if (s.match.tick < memory.transitionEndsAtTick) return;
    robber.locomotion = memory.plan.segments[memory.segment]!.mode;
    memory.transitionEndsAtTick = null;
  }
  robber.aiState = memory.plan.exit && robber.route!.edgeId === memory.plan.route.edgeId ? "escaping" : "fleeing";
  let seconds = s.fixedDeltaMs / 1000;
  // Zero-length connectors and cyclic fallback data cannot consume an unbounded tick.
  let replans = 0;
  for (;;) {
    const segment = memory.plan.segments[memory.segment];
    if (!segment) {
      if (memory.plan.exit) { memory.pendingEscape = memory.plan.exit.id; return; }
      if (seconds <= 1e-12) return;
      if (++replans > s.world.edges.size + 1) break;
      const plans = escapePlans(robber.route!, robber.locomotion, context);
      memory.plan = plans[0] ?? fallbackPlan(robber.route!, robber.locomotion, context);
      memory.segment = 0; memory.distanceM = 0;
      s.match.robberRouteId = memory.plan.routeId;
      robber.escapeTargetZoneId = memory.plan.exit?.id ?? null;
      if (!memory.plan.segments.some(p => p.lengthM > 1e-9)) break;
      continue;
    }
    if (robber.locomotion !== segment.mode) {
      robber.speedMps = 0;
      robber.aiState = "transition";
      memory.transitionEndsAtTick = s.match.tick + msToTicks(transitionMs, s.tuning);
      return;
    }
    if (segment.lengthM <= memory.distanceM + 1e-9) {
      setPosition(robber, segment, segment.lengthM);
      memory.segment++; memory.distanceM = 0;
      continue;
    }
    if (seconds <= 1e-12) return;
    // Authored road/turn caps are conservative at entry; the robber never gains a collision advantage from a fast tick.
    const speed = Math.min(robber.speedMps, segment.speedMps);
    const rate = s.tuning.movement.accelerationMps2;
    const full = integrateSpeed(speed, segment.speedMps, rate, seconds);
    const remaining = segment.lengthM - memory.distanceM;
    const elapsed = full.distanceM >= remaining ? timeForDistance(speed, segment.speedMps, rate, seconds, remaining) : seconds;
    const motion = integrateSpeed(speed, segment.speedMps, rate, elapsed);
    const distance = Math.min(remaining, motion.distanceM);
    const before = robber.pose.position;
    setPosition(robber, segment, memory.distanceM + distance);
    const hit = sweepBody(before, robber.pose.position, s.world.world.colliders, context.body);
    memory.distanceM += distance * hit.fraction;
    setPosition(robber, segment, memory.distanceM);
    robber.speedMps = motion.speedMps;
    seconds -= elapsed;
    if (hit.fraction < 1) {
      robber.speedMps = 0;
      diagnostic(memory, robber, s.match.tick, "routeBlocked");
      // A blocked turn is held on its actual curve. Reprojecting to a road would teleport.
      if (!segment.road) { memory.halted = true; return; }
      const alternatives = escapePlans(robber.route!, robber.locomotion, context);
      memory.plan = alternatives[0] ?? fallbackPlan(robber.route!, robber.locomotion, context);
      memory.segment = 0; memory.distanceM = 0;
      s.match.robberRouteId = memory.plan.routeId;
      robber.escapeTargetZoneId = memory.plan.exit?.id ?? null;
      // If no clear alternate exists, hold at contact until the authoritative timeout.
      memory.halted = !alternatives.length && !isClearFallback(memory.plan, context);
      return;
    }
  }
  memory.halted = true;
  robber.speedMps = 0;
  diagnostic(memory, robber, s.match.tick, "noSafeContinuation");
}

function isClearFallback(plan: RobberPlan, context: RouteContext): boolean {
  return plan.segments.some(p => p.lengthM > 1e-9) && plan.segments.every(p =>
    sweepBody(p.from, p.to, context.world.world.colliders, context.body).fraction === 1);
}
