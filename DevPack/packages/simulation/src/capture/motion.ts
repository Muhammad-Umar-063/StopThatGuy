import type { PlayerId, Vec3 } from "@stopthatguy/shared";
import type { InternalState } from "../state.js";

/** Private measured motion from the last authoritative fixed step, including lane/turn displacement. */
export interface CaptureMotion {
  players: Map<PlayerId, Vec3>;
  robber: Vec3;
}
const zero = (): Vec3 => ({ x: 0, y: 0, z: 0 });
export function capturePositions(s: InternalState): CaptureMotion {
  return { players: new Map(s.players.map(p => [p.id, { ...p.pose.position }])), robber: { ...s.robber.pose.position } };
}
export function recordCaptureMotion(s: InternalState, before: CaptureMotion): void {
  const velocity = (a: Vec3, b: Vec3): Vec3 => ({
    x: (b.x - a.x) * 1000 / s.fixedDeltaMs,
    y: (b.y - a.y) * 1000 / s.fixedDeltaMs,
    z: (b.z - a.z) * 1000 / s.fixedDeltaMs,
  });
  for (const p of s.players) s.captureMotion.players.set(p.id, velocity(before.players.get(p.id)!, p.pose.position));
  s.captureMotion.robber = velocity(before.robber, s.robber.pose.position);
}
export function clearCaptureMotion(s: InternalState): void {
  s.captureMotion.players.clear();
  s.captureMotion.robber = zero();
}
