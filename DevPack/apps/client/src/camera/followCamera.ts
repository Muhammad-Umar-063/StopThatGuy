import type { PlayerRecord, RouteEdge, Vec3, WorldData } from "@stopthatguy/shared";
import { clearAnchor, clearBoomFraction } from "./obstruction.js";

export type CameraSubject = Pick<PlayerRecord, "pose" | "route">;
export interface CameraFrame {
  position: Vec3;
  target: Vec3;
  yaw: number;
  boomLengthM: number;
  obstructed: boolean;
  reducedMotion: boolean;
}

// Presentation defaults only; no simulation rules, movement tuning or FOV pulses.
export const CAMERA_RADIUS_M = 0.25;
const DISTANCE_M = 5;
const HEIGHT_M = 3;
const ANCHOR_HEIGHT_M = 1.2;
const TAU = 2 * Math.PI;
const angleDelta = (a: number, b: number) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
const mix = (a: Vec3, b: Vec3, t: number): Vec3 => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t });
const distance = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

// Exact exponential response to linearly sampled input. Constant-velocity follow does not
// acquire a different lag at 30/60/144 Hz, unlike lerp(current, latestTarget, k * dt).
function damp(value: number, start: number, end: number, rate: number, dt: number): number {
  const alpha = -Math.expm1(-rate * dt);
  const ramp = rate * dt < 1e-5 ? rate * dt / 2 : 1 - alpha / (rate * dt);
  return value + (start - value) * alpha + (end - start) * ramp;
}

/** Presentation only. Never retains or writes the supplied authoritative pose/route. */
export function createFollowCamera(world: WorldData, initialReducedMotion = false) {
  const edges = new Map(world.edges.map((edge) => [edge.id, edge]));
  // Gameplay solids also occlude the view; decoration can add camera-only proxies.
  const proxies = [...world.colliders, ...world.cameraObstructions];
  let reducedMotion = initialReducedMotion;
  let previous: Vec3 | undefined;
  let focus: Vec3 = { x: 0, y: 0, z: 0 };
  let yaw = 0, previousYaw = 0;
  let grade: Vec3 = { x: 0, y: 0, z: 0 };
  let previousGrade = grade;
  let boomFraction = 1;
  let lookAhead = reducedMotion ? 0.75 : 2;

  function update(subject: CameraSubject, deltaSeconds: number, reset = false): CameraFrame {
    const pose = subject.pose;
    if (![pose.position.x, pose.position.y, pose.position.z, pose.yaw, deltaSeconds].every(Number.isFinite) || deltaSeconds < 0) {
      throw new RangeError("Camera requires a finite pose and nonnegative delta in seconds");
    }
    const nextGrade = routeGrade(subject.route ? edges.get(subject.route.edgeId) : undefined, subject.route?.distanceM ?? 0);
    // Reset on target switches explicitly; long background stalls/teleports must not fly
    // across the map. Normal contextual turns always damp, including +/-pi wrapping.
    const snap = reset || !previous || deltaSeconds > 0.5 || distance(previous, pose.position) > 12;
    if (snap) {
      focus = { ...pose.position };
      yaw = pose.yaw % TAU;
      previousYaw = yaw;
      grade = nextGrade;
      boomFraction = 1;
      lookAhead = reducedMotion ? 0.75 : 2;
    } else if (deltaSeconds > 0) {
      const nextYaw = previousYaw + angleDelta(previousYaw, pose.yaw);
      const followRate = reducedMotion ? 16 : 10;
      for (const axis of ["x", "y", "z"] as const) {
        focus[axis] = damp(focus[axis], previous![axis], pose.position[axis], followRate, deltaSeconds);
        grade[axis] = damp(grade[axis], previousGrade[axis], nextGrade[axis], 5, deltaSeconds);
      }
      yaw = damp(yaw, previousYaw, nextYaw, reducedMotion ? 4 : 7, deltaSeconds);
      previousYaw = nextYaw;
      lookAhead += ((reducedMotion ? 0.75 : 2) - lookAhead) * -Math.expm1(-4 * deltaSeconds);
    }
    previous = { ...pose.position };
    previousGrade = { ...nextGrade };
    // Keep long-running yaw values small without changing their relative angle.
    const wraps = Math.trunc(previousYaw / TAU) * TAU;
    previousYaw -= wraps;
    yaw -= wraps;
    const forward = { x: Math.sin(yaw), z: Math.cos(yaw) };
    const slope = grade.x * forward.x + grade.z * forward.z;
    const anchor = clearAnchor({ ...pose.position, y: pose.position.y + ANCHOR_HEIGHT_M }, proxies, CAMERA_RADIUS_M);
    const desired = {
      x: focus.x - forward.x * DISTANCE_M,
      y: focus.y + HEIGHT_M - slope * DISTANCE_M,
      z: focus.z - forward.z * DISTANCE_M,
    };
    // Sight-line test uses the current subject, not the lagged focus. Recheck the final
    // boom every update: damping a collision correction could interpolate through walls.
    const fullLength = distance(anchor, desired);
    const safeFraction = clearBoomFraction(anchor, desired, proxies, CAMERA_RADIUS_M);
    boomFraction = safeFraction < boomFraction ? safeFraction
      : boomFraction + (safeFraction - boomFraction) * -Math.expm1(-(reducedMotion ? 2 : 4) * deltaSeconds);
    const position = mix(anchor, desired, boomFraction);
    const visibleLookAhead = lookAhead * Math.min(1, fullLength * boomFraction / 3);
    return {
      position,
      target: { x: pose.position.x + forward.x * visibleLookAhead, y: pose.position.y + ANCHOR_HEIGHT_M + slope * visibleLookAhead, z: pose.position.z + forward.z * visibleLookAhead },
      yaw: Math.atan2(Math.sin(yaw), Math.cos(yaw)),
      boomLengthM: distance(anchor, position),
      obstructed: safeFraction < 1 || distance(anchor, { ...pose.position, y: pose.position.y + ANCHOR_HEIGHT_M }) > 0.001,
      reducedMotion,
    };
  }
  return {
    update,
    reset: (subject: CameraSubject) => update(subject, 0, true),
    setReducedMotion: (value: boolean) => { reducedMotion = value; },
  };
}

function routeGrade(edge: RouteEdge | undefined, distanceM: number): Vec3 {
  if (edge) {
    let remaining = Math.max(0, distanceM);
    for (let i = 1; i < edge.centerline.length; i++) {
      const a = edge.centerline[i - 1]!;
      const b = edge.centerline[i]!;
      const length = distance(a, b);
      if (remaining > length && i < edge.centerline.length - 1) { remaining -= length; continue; }
      const dx = b.x - a.x, dz = b.z - a.z;
      const horizontal = Math.hypot(dx, dz);
      const rise = horizontal ? Math.max(-0.8, Math.min(0.8, (b.y - a.y) / horizontal)) : 0;
      return { x: horizontal ? rise * dx / horizontal : 0, y: 0, z: horizontal ? rise * dz / horizontal : 0 };
    }
  }
  return { x: 0, y: 0, z: 0 };
}
