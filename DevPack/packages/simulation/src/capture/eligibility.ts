import type { CaptureCancelReason, PlayerRecord } from "@stopthatguy/shared";
import { entersVolume } from "../robber/volume.js";
import type { InternalState } from "../state.js";

/** Shared predicate for starting, maintaining and displaying authoritative capture eligibility. */
export function captureFailure(s: InternalState, player: PlayerRecord): CaptureCancelReason | null {
  if (s.match.phase !== "chase" || s.match.result !== null
    || s.robber.aiState === "captured" || s.robber.aiState === "escaped") return "phaseEnded";
  if (player.participation === "arrested") return "arrested";
  if (player.participation !== "active" || player.connection !== "connected"
    || player.locomotion === "passenger" || player.route === null) return "ineligible";
  if (player.status.stunnedUntilTick !== null && player.status.stunnedUntilTick > s.match.tick) return "stunned";
  const { capture, movement } = s.tuning;
  const from = player.pose.position, to = s.robber.pose.position;
  const dx = to.x - from.x, dy = to.y - from.y, dz = to.z - from.z;
  if (Math.hypot(dx, dy, dz) > capture.rangeM) return "outOfRange";
  const horizontalDistance = Math.hypot(dx, dz);
  // Coincident horizontal positions have no direction to face. Range/LOS still apply.
  if (horizontalDistance > 0 && (dx * Math.sin(player.pose.yaw) + dz * Math.cos(player.pose.yaw))
    / horizontalDistance + 1e-12 < Math.cos(capture.facingHalfAngleDeg * Math.PI / 180)) return "notFacing";
  const velocity = s.captureMotion.players.get(player.id) ?? { x: 0, y: 0, z: 0 };
  const robberVelocity = s.captureMotion.robber;
  const relativeSpeed = Math.hypot(velocity.x - robberVelocity.x, velocity.z - robberVelocity.z);
  // Subtracting world positions can put an exact speed boundary a few ulps above its limit.
  const speedToleranceMps = 1e-9;
  if (relativeSpeed > capture.maxRelativeSpeedMps + speedToleranceMps
    || (player.locomotion !== "onFoot" && Math.hypot(velocity.x, velocity.z) > capture.maxMountedSpeedMps + speedToleranceMps)) return "tooFast";
  // Torso-to-torso sight line, derived from the same configured body used by movement.
  // Reuse exact yawed box/cylinder intersections; decorative camera proxies never obstruct a grab.
  const start = { ...from, y: from.y + movement.bodyHeightM / 2 };
  const end = { ...to, y: to.y + movement.bodyHeightM / 2 };
  if (s.world.world.colliders.some(c => entersVolume(start, end, c) !== null)) return "lostSight";
  return null;
}
