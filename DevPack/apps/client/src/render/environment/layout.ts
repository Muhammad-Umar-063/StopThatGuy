import type { WorldData, Vec3, ColliderPrimitive } from "@stopthatguy/shared";

export type StreetQuality = "low" | "medium";
export const STREET_WORLD_VERSION = "first-street-1";
export const QUALITY = {
  low: { resolutionScale: 0.75, shadows: false, balconyOrnaments: false, flowers: false },
  medium: { resolutionScale: 1, shadows: true, balconyOrnaments: true, flowers: true },
} as const;
export const ENVIRONMENT_ASSET_ID = "environment.lisbon-kit";
export const BUILDING_IDS = ["c-bank", "c-block-west-mid", "c-block-east-south", "c-block-east-north", "c-alley-house"] as const;
export const SURFACE_EDGES = ["e-main-n1", "e-main-n2", "e-alley-w", "e-steps-up"] as const;
export type BoxCollider = Extract<ColliderPrimitive, { shape: "box" }>;
export interface SurfaceSegment { edgeId: string; a: Vec3; b: Vec3; widthM: number; kind: "road" | "alley" | "foot" }

/** Reads the committed world, never writes authoritative geometry or movement data. */
export function streetPlan(world: WorldData) {
  if (world.worldVersion !== STREET_WORLD_VERSION) throw new Error(`Street visuals require ${STREET_WORLD_VERSION}, got ${world.worldVersion}`);
  const buildings = BUILDING_IDS.map((id) => {
    const collider = world.colliders.find((c) => c.id === id);
    if (!collider || collider.shape !== "box" || collider.yaw !== 0) throw new Error(`Missing/unexpected visual anchor ${id}`);
    return collider;
  });
  const surfaces: SurfaceSegment[] = [];
  for (const id of SURFACE_EDGES) {
    const edge = world.edges.find((e) => e.id === id);
    if (!edge) throw new Error(`Missing route anchor ${id}`);
    const kind = id === "e-steps-up" ? "foot" : id === "e-alley-w" ? "alley" : "road";
    for (let i = 1; i < edge.centerline.length; i++) surfaces.push({ edgeId: id, a: edge.centerline[i - 1]!, b: edge.centerline[i]!, widthM: kind === "road" ? 9 : kind === "alley" ? 3 : 1.8, kind });
  }
  const rack = world.colliders.find((c) => c.id === "c-bike-stand");
  const lamp = world.colliders.find((c) => c.id === "c-lamp-1");
  if (!rack || rack.shape !== "box" || !lamp || lamp.shape !== "cylinder") throw new Error("Missing street furniture anchors");
  return { worldVersion: world.worldVersion, buildings, surfaces, rack, lamp };
}

/** Only for aligning decoration to the authored centreline's ground, not simulation. */
export function streetGround(z: number, world: WorldData): number {
  const edge = world.edges.find((e) => e.id === (z <= 60 ? "e-main-n1" : "e-main-n2"));
  if (!edge) throw new Error("Missing street grade anchor");
  const a = edge.centerline[0]!; const b = edge.centerline.at(-1)!;
  const t = Math.max(0, Math.min(1, (z - a.z) / (b.z - a.z)));
  return a.y + (b.y - a.y) * t;
}
