/** Exact integration of constant acceleration up to a speed target (including a partial final step). */
export function integrateSpeed(speedMps: number, targetMps: number, rateMps2: number, seconds: number): { speedMps: number; distanceM: number } {
  if (![speedMps, targetMps, rateMps2, seconds].every(Number.isFinite)
    || speedMps < 0 || targetMps < 0 || rateMps2 <= 0 || seconds < 0) throw new RangeError("Invalid kinematic step");
  const duration = Math.min(seconds, Math.abs(targetMps - speedMps) / rateMps2);
  const next = speedMps + Math.sign(targetMps - speedMps) * rateMps2 * duration;
  return { speedMps: next, distanceM: (speedMps + next) * duration / 2 + next * (seconds - duration) };
}
