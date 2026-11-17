import assert from "node:assert/strict";
import { test } from "node:test";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { Scene } from "@babylonjs/core/scene";
import { TargetCamera } from "@babylonjs/core/Cameras/targetCamera";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { brandId, type ColliderId, type ColliderPrimitive, type Pose, type WorldData } from "@stopthatguy/shared";
import { FIXTURE_IDS, FIXTURE_SNAPSHOTS, FIXTURE_WORLD } from "@stopthatguy/test-support";
import { indexWorld, poseOnRoute } from "@stopthatguy/simulation/movement";
import { FIRST_STREET_WORLD } from "@stopthatguy/world";
import { createAutomaticCamera } from "./automaticCamera.js";
import { CAMERA_RADIUS_M, createFollowCamera, type CameraFrame, type CameraSubject } from "./followCamera.js";
import { clearAnchor, clearBoomFraction } from "./obstruction.js";
import { sampleScenario, scenarioWorld, scenarios } from "./browser/scenarios.js";

const emptyWorld: WorldData = { ...FIXTURE_WORLD, colliders: [], cameraObstructions: [] };
const subject = (x = 0, y = 0, z = 0, yaw = 0): CameraSubject => ({ pose: { position: { x, y, z }, yaw }, route: null });
const close = (a: number, b: number, tolerance = 1e-8) => assert.ok(Math.abs(a - b) <= tolerance, `${a} differs from ${b} by more than ${tolerance}`);
const wall: ColliderPrimitive = { id: brandId<ColliderId>("test-wall"), shape: "box", center: { x: 0, y: 2, z: -3 }, halfExtents: { x: 4, y: 2, z: 0.2 }, yaw: 0 };

test("starts five metres behind/three above, looking ahead in shared coordinate convention", () => {
  for (const yaw of [0, Math.PI / 2, -Math.PI / 2, Math.PI]) {
    const frame = createFollowCamera(emptyWorld).reset(subject(10, 2, 20, yaw));
    close(frame.position.x, 10 - 5 * Math.sin(yaw));
    close(frame.position.z, 20 - 5 * Math.cos(yaw));
    close(frame.position.y, 5);
    assert.ok((frame.target.x - 10) * Math.sin(yaw) + (frame.target.z - 20) * Math.cos(yaw) > 0);
  }
});

test("frozen authoritative snapshots and world are never mutated or returned by reference", () => {
  const original = JSON.stringify(FIXTURE_SNAPSHOTS);
  const camera = createFollowCamera(FIXTURE_WORLD);
  for (const snapshot of Object.values(FIXTURE_SNAPSHOTS)) {
    for (const player of snapshot.players) {
      const frame = camera.update(player, 1 / 60);
      frame.position.x = 1234;
      frame.target.z = 1234;
      assert.notEqual(player.pose.position.x, 1234);
    }
  }
  assert.equal(JSON.stringify(FIXTURE_SNAPSHOTS), original);
});

test("straight, rising, constant velocity follow is invariant at 30/60/144 FPS", () => {
  const ends = [30, 60, 144].map((fps) => {
    const camera = createFollowCamera(emptyWorld);
    let frame = camera.reset(subject());
    for (let i = 1; i <= 3 * fps; i++) frame = camera.update(subject(0, i / fps * 0.2, i / fps * 6), 1 / fps);
    return frame;
  });
  for (const frame of ends.slice(1)) {
    close(frame.position.z, ends[0]!.position.z);
    close(frame.position.y, ends[0]!.position.y);
  }
});

test("90 degree contextual turn is smooth, settles behind new travel and agrees across frame rates", () => {
  const ends = [30, 60, 144].map((fps) => {
    const camera = createFollowCamera(emptyWorld);
    let frame = camera.reset(subject());
    let priorYaw = 0;
    for (let i = 1; i <= 3 * fps; i++) {
      const t = i / fps;
      frame = camera.update(subject(t * 3, 0, 0, Math.min(1, t) * Math.PI / 2), 1 / fps);
      assert.ok(frame.yaw >= priorYaw && frame.yaw - priorYaw < 0.06);
      priorYaw = frame.yaw;
    }
    assert.ok(frame.position.x < 9 - 4.9);
    close(frame.yaw, Math.PI / 2, 0.00001);
    return frame;
  });
  for (const frame of ends.slice(1)) {
    close(frame.yaw, ends[0]!.yaw);
    close(frame.position.x, ends[0]!.position.x, 0.02);
    close(frame.position.z, ends[0]!.position.z, 0.02);
  }
});

test("transient committed fixture turns and obstruction recovery stay within 12 cm across frame rates in both motion modes", () => {
  for (const scenario of scenarios) for (const reduced of [false, true]) {
    for (const seconds of [0.5, 1, 1.5, 2, 2.5, 3, 4, 6]) {
      const frames = [30, 60, 144].map((fps) => {
        const camera = createFollowCamera(scenarioWorld(scenario), reduced);
        let frame = camera.reset(sampleScenario(scenario, 0));
        for (let i = 1; i <= Math.round(seconds * fps); i++) frame = camera.update(sampleScenario(scenario, i / fps), 1 / fps);
        return frame;
      });
      for (const frame of frames.slice(1)) {
        const first = frames[0]!.position;
        const delta = Math.hypot(first.x - frame.position.x, first.y - frame.position.y, first.z - frame.position.z);
        assert.ok(delta < 0.12, `${scenario}, reduced=${reduced}, t=${seconds}: ${delta} m`);
      }
    }
  }
});

test("abrupt headings never snap and +/-pi uses the short path", () => {
  const camera = createFollowCamera(emptyWorld);
  camera.reset(subject());
  const first = camera.update(subject(0, 0, 0, Math.PI / 2), 1 / 60);
  assert.ok(first.yaw > 0 && first.yaw < 0.2);
  camera.reset(subject(0, 0, 0, Math.PI - 0.05));
  const wrapped = camera.update(subject(0, 0, 0, -Math.PI + 0.05), 1 / 30);
  assert.ok(Math.abs(wrapped.yaw) > 3);
});

test("uphill and downhill respect committed ground grade with level roll", () => {
  const indexed = indexWorld(FIXTURE_WORLD);
  for (const edgeId of [FIXTURE_IDS.edges.junctionEast, FIXTURE_IDS.edges.eastStairs]) {
    const edge = FIXTURE_WORLD.edges.find((candidate) => candidate.id === edgeId)!;
    const camera = createFollowCamera(emptyWorld);
    let frame: CameraFrame | undefined;
    let pose: Pose | undefined;
    for (let i = 0; i <= 120; i++) {
      const route = { edgeId, distanceM: 8 + i / 30 * 4, laneIndex: 0, lateralOffsetM: 0 };
      pose = poseOnRoute(indexed, route);
      frame = camera.update({ pose, route }, 1 / 30);
      assert.ok(frame.position.y > pose.position.y + 1.5);
    }
    const a = edge.centerline[0]!, b = edge.centerline[1]!;
    const rise = (b.y - a.y) / Math.hypot(b.x - a.x, b.z - a.z);
    const back = (frame!.position.x - pose!.position.x) * Math.sin(pose!.yaw) + (frame!.position.z - pose!.position.z) * Math.cos(pose!.yaw);
    close(frame!.position.y - (pose!.position.y + rise * back), 3, 0.03);
  }
});

test("retracts immediately before wall and eases outward after clearance", () => {
  const world = { ...emptyWorld, cameraObstructions: [wall] };
  const camera = createFollowCamera(world);
  camera.reset(subject(6));
  const blocked = camera.update(subject(), 1 / 30);
  assert.ok(blocked.obstructed);
  assert.ok(blocked.position.z > -2.55);
  const clear = camera.update(subject(6), 1 / 60);
  assert.ok(clear.boomLengthM < 5, "no instant outward zoom when obstruction clears");
  let settled = clear;
  for (let i = 0; i < 240; i++) settled = camera.update(subject(6), 1 / 60);
  assert.equal(settled.obstructed, false);
  close(settled.position.z, -5, 0.01);
});

test("collision constrains the whole boom, including a safe endpoint behind a thin wall", () => {
  const camera = createFollowCamera({ ...emptyWorld, colliders: [wall] });
  const blocked = camera.reset(subject());
  assert.ok(blocked.obstructed);
  assert.ok(blocked.position.z > -2.55);
  close(clearBoomFraction({ x: 0, y: 1.2, z: 0 }, blocked.position, [wall], CAMERA_RADIUS_M), 1);
});

test("rotated boxes, cylinder sides/caps, parallel misses, tangencies and zero-length rays", () => {
  const rotated: ColliderPrimitive = { ...wall, center: { x: 0, y: 2, z: 0 }, halfExtents: { x: 1, y: 2, z: 0.2 }, yaw: Math.PI / 4 };
  assert.ok(clearBoomFraction({ x: -3, y: 2, z: 0 }, { x: 3, y: 2, z: 0 }, [rotated], 0.25) < 0.4);
  const cylinder: ColliderPrimitive = { id: wall.id, shape: "cylinder", center: { x: 0, y: 1, z: 0 }, radiusM: 1, heightM: 2 };
  close(clearBoomFraction({ x: -3, y: 1, z: 0 }, { x: 3, y: 1, z: 0 }, [cylinder], 0.25), 1.75 / 6 - 1e-5);
  close(clearBoomFraction({ x: 0, y: 4, z: 0 }, { x: 0, y: 0, z: 0 }, [cylinder], 0.25), 1.75 / 4 - 1e-5);
  assert.equal(clearBoomFraction({ x: 0, y: 4, z: 0 }, { x: 0, y: 4, z: 0 }, [cylinder], 0.25), 1);
  assert.equal(clearBoomFraction({ x: 2, y: 1, z: -3 }, { x: 2, y: 1, z: 3 }, [cylinder], 0.25), 1);
  assert.ok(clearBoomFraction({ x: 1.25, y: 1, z: -3 }, { x: 1.25, y: 1, z: 3 }, [cylinder], 0.25) < 1);
  assert.equal(clearBoomFraction(cylinder.center, cylinder.center, [cylinder], 0.25), 0);
  for (const proxy of [rotated, cylinder]) {
    const point = clearAnchor(proxy.center, [proxy], 0.25);
    assert.equal(clearBoomFraction(point, point, [proxy], 0.25), 1);
  }
});

test("committed street narrow passage and turns never put camera volume or sight line in a wall", () => {
  const camera = createFollowCamera(FIRST_STREET_WORLD);
  const indexed = indexWorld(FIRST_STREET_WORLD);
  const proxies = [...FIRST_STREET_WORLD.colliders, ...FIRST_STREET_WORLD.cameraObstructions];
  for (const edge of FIRST_STREET_WORLD.edges) {
    for (let i = 0; i <= 90; i++) {
      const route = { edgeId: edge.id, distanceM: edge.lengthM * i / 90, laneIndex: 0, lateralOffsetM: edge.laneOffsetsM[0]! };
      const pose = poseOnRoute(indexed, route);
      const frame = camera.update({ pose, route }, 1 / 30);
      const anchor = { ...pose.position, y: pose.position.y + 1.2 };
      assert.equal(clearBoomFraction(frame.position, frame.position, proxies, CAMERA_RADIUS_M), 1, `${edge.id} ${i}: volume`);
      assert.equal(clearBoomFraction(anchor, frame.position, proxies, CAMERA_RADIUS_M), 1, `${edge.id} ${i}: sight line`);
    }
  }
});

test("reduced motion restrains rotation, reduces trailing lag and has no idle drift", () => {
  const normal = createFollowCamera(emptyWorld), reduced = createFollowCamera(emptyWorld, true);
  normal.reset(subject()); reduced.reset(subject());
  const n = normal.update(subject(1, 0, 0, Math.PI / 2), 1 / 30);
  const r = reduced.update(subject(1, 0, 0, Math.PI / 2), 1 / 30);
  assert.ok(r.yaw < n.yaw);
  const idle = reduced.reset(subject());
  for (let i = 0; i < 120; i++) assert.deepEqual(reduced.update(subject(), 1 / 60), idle);
  reduced.setReducedMotion(false);
  assert.equal(reduced.update(subject(), 1 / 60).reducedMotion, false);
});

test("teleports, explicit target reset, long stalls, zero delta and invalid input", () => {
  const camera = createFollowCamera(emptyWorld);
  camera.reset(subject());
  close(camera.update(subject(100, 0, 0, Math.PI / 2), 1 / 60).position.x, 95);
  close(camera.update(subject(101, 0, 0, 0), 2).position.z, -5);
  close(camera.reset(subject()).position.z, -5);
  assert.deepEqual(camera.update(subject(), 0), camera.reset(subject()));
  for (const dt of [-1, NaN, Infinity]) assert.throws(() => camera.update(subject(), dt), RangeError);
  assert.throws(() => camera.update(subject(NaN), 0.1), RangeError);
});

test("Babylon adapter has no manual inputs, fixed FOV, restores prior camera and disposes idempotently", () => {
  const engine = new NullEngine();
  const scene = new Scene(engine);
  const prior = new TargetCamera("prior", Vector3.Zero(), scene);
  scene.activeCamera = prior;
  for (let i = 0; i < 4; i++) {
    const adapter = createAutomaticCamera(scene, FIXTURE_WORLD);
    const frame = adapter.update(FIXTURE_SNAPSHOTS.chase.players[0]!, 1 / 60);
    assert.equal(scene.cameras.length, 2);
    assert.equal(adapter.camera.inputs, undefined);
    close(adapter.camera.position.x, frame.position.x);
    close(adapter.camera.rotation.z, 0);
    adapter.setReducedMotion(true);
    close(adapter.camera.fov, 0.9);
    adapter.dispose(); adapter.dispose();
    assert.equal(scene.cameras.length, 1);
    assert.equal(scene.activeCamera, prior);
    assert.throws(() => adapter.update(subject(), 0.1), /disposed/);
  }
  const final = createAutomaticCamera(scene, emptyWorld);
  scene.dispose();
  assert.throws(() => final.reset(subject()), /disposed/);
  engine.dispose();
});
