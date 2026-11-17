import type { ColliderPrimitive, Vec3 } from "@stopthatguy/shared";

/** Conservative swept camera sphere against the authored proxies, independent of visual meshes. */
export function clearBoomFraction(from: Vec3, to: Vec3, proxies: readonly ColliderPrimitive[], radiusM: number): number {
  let fraction = 1;
  for (const proxy of proxies) {
    const a = localPoint(from, proxy);
    const b = localPoint(to, proxy);
    let near = 0;
    let far = fraction;
    const slab = (start: number, end: number, half: number): boolean => {
      const delta = end - start;
      if (Math.abs(delta) < 1e-12) return Math.abs(start) <= half;
      const t1 = (-half - start) / delta;
      const t2 = (half - start) / delta;
      near = Math.max(near, Math.min(t1, t2));
      far = Math.min(far, Math.max(t1, t2));
      return near <= far;
    };
    if (proxy.shape === "box") {
      if (!slab(a.x, b.x, proxy.halfExtents.x + radiusM)
        || !slab(a.y, b.y, proxy.halfExtents.y + radiusM)
        || !slab(a.z, b.z, proxy.halfExtents.z + radiusM)) continue;
    } else {
      if (!slab(a.y, b.y, proxy.heightM / 2 + radiusM)) continue;
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const aa = dx * dx + dz * dz;
      const bb = a.x * dx + a.z * dz;
      const cc = a.x * a.x + a.z * a.z - (proxy.radiusM + radiusM) ** 2;
      if (aa < 1e-12) { if (cc > 0) continue; }
      else {
        const discriminant = bb * bb - aa * cc;
        if (discriminant < 0) continue;
        near = Math.max(near, (-bb - Math.sqrt(discriminant)) / aa);
        far = Math.min(far, (-bb + Math.sqrt(discriminant)) / aa);
        if (near > far) continue;
      }
    }
    // Keep a small gap at contact, including tangencies and endpoints.
    fraction = Math.max(0, near - 1e-5);
  }
  return fraction;
}

function localPoint(point: Vec3, proxy: ColliderPrimitive): Vec3 {
  const x = point.x - proxy.center.x;
  const z = point.z - proxy.center.z;
  const yaw = proxy.shape === "box" ? proxy.yaw : 0;
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  return { x: c * x - s * z, y: point.y - proxy.center.y, z: s * x + c * z };
}

/** A bad/overlapping camera-only proxy must not leave the camera inside a solid. */
export function clearAnchor(point: Vec3, proxies: readonly ColliderPrimitive[], radiusM: number): Vec3 {
  const result = { ...point };
  for (let pass = 0; pass < 8; pass++) {
    let moved = false;
    for (const proxy of proxies) {
      const p = localPoint(result, proxy);
      const h = proxy.shape === "box" ? proxy.halfExtents.y : proxy.heightM / 2;
      if (Math.abs(p.y) > h + radiusM) continue;
      let dx = 0, dy = 0, dz = 0;
      const vertical = h + radiusM - Math.abs(p.y);
      if (proxy.shape === "box") {
        const x = proxy.halfExtents.x + radiusM - Math.abs(p.x);
        const z = proxy.halfExtents.z + radiusM - Math.abs(p.z);
        if (x < 0 || z < 0) continue;
        if (vertical <= Math.min(x, z)) dy = Math.sign(p.y || 1) * (vertical + 0.001);
        else if (x <= z) dx = Math.sign(p.x || 1) * (x + 0.001);
        else dz = Math.sign(p.z || 1) * (z + 0.001);
      } else {
        const distance = Math.hypot(p.x, p.z);
        const radial = proxy.radiusM + radiusM - distance;
        if (radial < 0) continue;
        if (vertical <= radial) dy = Math.sign(p.y || 1) * (vertical + 0.001);
        else { dx = (distance ? p.x / distance : 1) * (radial + 0.001); dz = (distance ? p.z / distance : 0) * (radial + 0.001); }
      }
      const yaw = proxy.shape === "box" ? proxy.yaw : 0;
      result.x += Math.cos(yaw) * dx + Math.sin(yaw) * dz;
      result.y += dy;
      result.z += -Math.sin(yaw) * dx + Math.cos(yaw) * dz;
      moved = true;
    }
    if (!moved) break;
  }
  return result;
}
