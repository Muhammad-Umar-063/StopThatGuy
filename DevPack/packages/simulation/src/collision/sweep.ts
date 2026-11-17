import type { ColliderId, ColliderPrimitive, Vec3 } from "@stopthatguy/shared";

/** Upright grounded body; the pose is at its feet. All dimensions come from the caller's tuning. */
export interface CollisionBody {
  radiusM: number;
  heightM: number;
  skinM: number;
}

export interface SweepHit {
  /** Maximum safe fraction of the segment, including the configured contact skin. */
  fraction: number;
  colliderId: ColliderId | null;
}

type Interval = readonly [number, number];
const EPSILON = 1e-10;

/** Times when a scalar moving on a line is strictly inside an interval. */
function slab(start: number, delta: number, min: number, max: number): Interval | null {
  const point = Math.abs(start - min) <= EPSILON ? min : Math.abs(start - max) <= EPSILON ? max : start;
  if (Math.abs(delta) < EPSILON) return point > min && point < max ? [-Infinity, Infinity] : null;
  const a = (min - point) / delta;
  const b = (max - point) / delta;
  return [Math.min(a, b), Math.max(a, b)];
}

function intersect(...intervals: (Interval | null)[]): Interval | null {
  let start = -Infinity;
  let end = Infinity;
  for (const interval of intervals) {
    if (!interval) return null;
    start = Math.max(start, interval[0]);
    end = Math.min(end, interval[1]);
  }
  return end - start > EPSILON ? [start, end] : null;
}

/** Continuous point/circle intersection. A tangency has no penetrating interval. */
function circle(x: number, z: number, dx: number, dz: number, radius: number): Interval | null {
  const a = dx * dx + dz * dz;
  const c = x * x + z * z - radius * radius;
  const contactTolerance = EPSILON * Math.max(1, radius * radius);
  if (a < EPSILON * EPSILON) return c < -contactTolerance ? [-Infinity, Infinity] : null;
  const b = x * dx + z * dz;
  // Rotation and a preceding sweep can place contact a few ulps inside. Do not
  // turn a tangent/outward segment into a zero-time obstruction.
  if (c >= -contactTolerance && b >= -EPSILON * Math.max(1, Math.sqrt(a) * radius)) return null;
  const discriminant = b * b - a * c;
  if (discriminant <= 0) return null;
  const root = Math.sqrt(discriminant);
  return [(-b - root) / a, (-b + root) / a];
}

function colliderIntervals(from: Vec3, to: Vec3, collider: ColliderPrimitive, body: CollisionBody): (Interval | null)[] {
  const radius = body.radiusM + body.skinM;
  const x = from.x - collider.center.x;
  const z = from.z - collider.center.z;
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const dy = to.y - from.y;
  if (collider.shape === "cylinder") {
    return [intersect(
      slab(from.y, dy, collider.center.y - collider.heightM / 2 - body.heightM, collider.center.y + collider.heightM / 2),
      circle(x, z, dx, dz, radius + collider.radiusM),
    )];
  }

  const vertical = slab(from.y, dy, collider.center.y - collider.halfExtents.y - body.heightM, collider.center.y + collider.halfExtents.y);
  const cos = Math.cos(collider.yaw);
  const sin = Math.sin(collider.yaw);
  const localX = x * cos - z * sin;
  const localZ = x * sin + z * cos;
  const localDx = dx * cos - dz * sin;
  const localDz = dx * sin + dz * cos;
  const hx = collider.halfExtents.x;
  const hz = collider.halfExtents.z;
  // Exact disk/rectangle Minkowski sum: two strips and four rounded corners.
  // Enlarging the whole rectangle would incorrectly block clear diagonal corners.
  const intervals: (Interval | null)[] = [
    intersect(vertical, slab(localX, localDx, -hx - radius, hx + radius), slab(localZ, localDz, -hz, hz)),
    intersect(vertical, slab(localX, localDx, -hx, hx), slab(localZ, localDz, -hz - radius, hz + radius)),
  ];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    intervals.push(intersect(vertical, circle(localX - sx * hx, localZ - sz * hz, localDx, localDz, radius)));
  }
  return intervals;
}

/** Sweeps continuously against gameplay proxies only; callers split curved paths at every vertex. */
export function sweepBody(from: Vec3, to: Vec3, colliders: readonly ColliderPrimitive[], body: CollisionBody): SweepHit {
  if (![body.radiusM, body.heightM, body.skinM, from.x, from.y, from.z, to.x, to.y, to.z].every(Number.isFinite)
    || body.radiusM <= 0 || body.heightM <= 0 || body.skinM < 0) throw new RangeError("Invalid sweep body or segment");
  let fraction = 1;
  let colliderId: ColliderId | null = null;
  for (const collider of colliders) {
    for (const interval of colliderIntervals(from, to, collider, body)) {
      if (!interval || interval[1] <= EPSILON || interval[0] >= 1) continue;
      const entry = Math.max(0, interval[0]);
      if (entry < fraction || (entry === fraction && (colliderId === null || collider.id < colliderId))) {
        fraction = entry;
        colliderId = collider.id;
      }
    }
  }
  return { fraction, colliderId };
}

export function isPathClear(points: readonly Vec3[], colliders: readonly ColliderPrimitive[], body: CollisionBody): boolean {
  for (let i = 1; i < points.length; i++) {
    if (sweepBody(points[i - 1]!, points[i]!, colliders, body).fraction < 1) return false;
  }
  return true;
}
