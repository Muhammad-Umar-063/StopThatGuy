// DEVELOPMENT ONLY. Scripted playback of committed T002/T003/T005 data, not T009 movement.
import type { Pose, RouteProgress, Vec3 } from "@stopthatguy/shared";
import { FIXTURE_IDS, FIXTURE_SNAPSHOTS, FIXTURE_WORLD } from "@stopthatguy/test-support";
import { FIRST_STREET_WORLD } from "@stopthatguy/world";
import { indexWorld, poseOnRoute } from "@stopthatguy/simulation/movement";
import type { CameraSubject } from "../followCamera.js";

const fixtureIndex = indexWorld(FIXTURE_WORLD);
const streetIndex = indexWorld(FIRST_STREET_WORLD);
const E = FIXTURE_IDS.edges;
export const scenarios = ["turn", "slope", "wall", "narrow"] as const;
export type Scenario = typeof scenarios[number];
export const scenarioWorld = (scenario: Scenario) => scenario === "narrow" ? FIRST_STREET_WORLD : FIXTURE_WORLD;
const onFixtureRoute = (edgeId: RouteProgress["edgeId"], distanceM: number): CameraSubject => {
  const route = { edgeId, distanceM, laneIndex: 0, lateralOffsetM: 0 };
  return { pose: poseOnRoute(fixtureIndex, route), route };
};

export function sampleScenario(scenario: Scenario, seconds: number): CameraSubject {
  if (scenario === "slope") return onFixtureRoute(E.junctionEast, 3 + Math.min(seconds, 6) * 4);
  if (scenario === "wall") {
    // Turn beside the committed camera-only arcade proxy, then move away to test recovery.
    const base = FIXTURE_SNAPSHOTS.chase.players[2]!.pose;
    return { pose: { position: { ...base.position, x: 1 + Math.max(0, seconds - 3) * 3 }, yaw: Math.min(seconds, 1) * Math.PI / 2 }, route: null };
  }
  if (scenario === "narrow") {
    const edge = FIRST_STREET_WORLD.edges.find((candidate) => candidate.label?.includes("Beco"))
      ?? FIRST_STREET_WORLD.edges.find((candidate) => candidate.laneOffsetsM.length === 1)!;
    const route = { edgeId: edge.id, distanceM: 8 + Math.min(seconds, 6) * 3, laneIndex: 0, lateralOffsetM: 0 };
    return { pose: poseOnRoute(streetIndex, route), route };
  }
  if (seconds <= 1) return onFixtureRoute(E.bankNorth, 33 + seconds * 4);
  const branch = FIXTURE_WORLD.junctions.find((junction) => junction.fromEdgeId === E.bankNorth)!.branches.find((b) => b.side === "right")!;
  if (seconds < 2.5) return { pose: samplePath(branch.turnPath, (seconds - 1) / 1.5), route: null };
  return onFixtureRoute(E.junctionEast, Math.hypot(3, 0.2) + Math.min(5, seconds - 2.5) * 4);
}

function samplePath(points: readonly Vec3[], fraction: number): Pose {
  const lengths = points.slice(1).map((p, i) => Math.hypot(p.x - points[i]!.x, p.y - points[i]!.y, p.z - points[i]!.z));
  let remaining = lengths.reduce((a, b) => a + b, 0) * fraction;
  for (let i = 0; i < lengths.length; i++) {
    if (remaining > lengths[i]! && i < lengths.length - 1) { remaining -= lengths[i]!; continue; }
    const a = points[i]!, b = points[i + 1]!;
    const t = remaining / lengths[i]!;
    return { position: { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t }, yaw: Math.atan2(b.x - a.x, b.z - a.z) };
  }
  throw new Error("Fixture turn path is empty");
}
