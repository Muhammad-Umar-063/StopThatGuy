import type { Vec3, Volume } from "@stopthatguy/shared";

/** Earliest inclusive feet-point entry into a trigger. No endpoint-only test, height omission or body inflation. */
export function entersVolume(from: Vec3, to: Vec3, volume: Volume): number | null {
  let enter = 0, leave = 1;
  const slab = (a: number, d: number, half: number) => {
    if (Math.abs(d) < 1e-12) return Math.abs(a) <= half;
    const t1 = (-half - a) / d, t2 = (half - a) / d;
    enter = Math.max(enter, Math.min(t1, t2));
    leave = Math.min(leave, Math.max(t1, t2));
    return enter <= leave;
  };
  const x = from.x - volume.center.x, y = from.y - volume.center.y, z = from.z - volume.center.z;
  const dx = to.x - from.x, dy = to.y - from.y, dz = to.z - from.z;
  if (volume.shape === "box") {
    const c = Math.cos(volume.yaw), s = Math.sin(volume.yaw);
    return slab(x * c - z * s, dx * c - dz * s, volume.halfExtents.x)
      && slab(y, dy, volume.halfExtents.y) && slab(x * s + z * c, dx * s + dz * c, volume.halfExtents.z) ? enter : null;
  }
  if (!slab(y, dy, volume.heightM / 2)) return null;
  const a = dx * dx + dz * dz, b = x * dx + z * dz, c = x * x + z * z - volume.radiusM ** 2;
  if (a < 1e-24) return c <= 0 ? enter : null;
  const discriminant = b * b - a * c;
  if (discriminant < 0) return null;
  const root = Math.sqrt(discriminant);
  enter = Math.max(enter, (-b - root) / a);
  leave = Math.min(leave, (-b + root) / a);
  return enter <= leave ? enter : null;
}
