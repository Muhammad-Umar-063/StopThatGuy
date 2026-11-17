import assert from "node:assert/strict";
import { test } from "node:test";
import { brandId, type ColliderId, type ColliderPrimitive, type Vec3 } from "@stopthatguy/shared";
import { isPathClear, sweepBody } from "../src/collision/index.js";

const v = (x: number, y: number, z: number): Vec3 => ({ x, y, z });
const body = { radiusM: 0.5, heightM: 2, skinM: 0 };
const box: ColliderPrimitive = {
  id: brandId<ColliderId>("box"), shape: "box", center: v(0, 1, 5), halfExtents: v(1, 1, 0.1), yaw: 0,
};
const cylinder: ColliderPrimitive = {
  id: brandId<ColliderId>("post"), shape: "cylinder", center: v(0, 1, 5), radiusM: 0.25, heightM: 2,
};
function near(actual: number, expected: number) { assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`); }

test("continuous sweep stops before thin boxes and cylinders even if both endpoints are clear", () => {
  near(sweepBody(v(0, 0, 0), v(0, 0, 20), [box], body).fraction, 4.4 / 20);
  near(sweepBody(v(0, 0, 0), v(0, 0, 20), [cylinder], body).fraction, 4.25 / 20);
  near(sweepBody(v(0, 0, 0), v(0, 0, 20), [box], { ...body, skinM: 0.1 }).fraction, 4.3 / 20);
});

test("rotated boxes use their local axes, and rounded corners do not produce square false positives", () => {
  const rotated = { ...box, center: v(5, 1, 0), yaw: Math.PI / 2 };
  near(sweepBody(v(0, 0, 0), v(20, 0, 0), [rotated], body).fraction, 4.4 / 20);
  const square = { ...box, center: v(0, 1, 0), halfExtents: v(1, 1, 1) };
  assert.equal(sweepBody(v(1.4, 0, 1.4), v(2, 0, 2), [square], body).fraction, 1);
  assert.equal(sweepBody(v(1.2, 0, 1.2), v(2, 0, 2), [square], body).fraction, 0);
});

test("height sweeps distinguish clear overpasses, head contact, and ground contact", () => {
  assert.equal(sweepBody(v(0, 3, 0), v(0, 3, 20), [box], body).fraction, 1);
  const overhead = { ...box, center: v(0, 3, 5), halfExtents: v(1, 0.5, 1) };
  assert.equal(sweepBody(v(0, 0, 0), v(0, 0, 20), [overhead], body).fraction, 1);
  assert.ok(sweepBody(v(0, 1, 0), v(0, 1, 20), [overhead], body).fraction < 1);
  assert.equal(sweepBody(v(0, 2, 0), v(0, 2, 20), [box], body).fraction, 1);
  assert.ok(sweepBody(v(0, 3, 5), v(0, -1, 5), [box], body).fraction < 1);
});

test("contact allows movement away or tangentially but blocks inward penetration", () => {
  const wall = { ...box, center: v(0, 1, 0), halfExtents: v(1, 1, 10) };
  assert.equal(sweepBody(v(1.5, 0, 0), v(2, 0, 0), [wall], body).fraction, 1);
  assert.equal(sweepBody(v(1.5, 0, 0), v(1.5, 0, 1), [wall], body).fraction, 1);
  assert.equal(sweepBody(v(1.5, 0, 0), v(1, 0, 0), [wall], body).fraction, 0);
});

test("rotated contact tolerates roundoff without sticking on tangential or outward movement", () => {
  const angle = 4 * Math.PI / 180;
  const cos = Math.cos(angle), sin = Math.sin(angle);
  const rotate = (x: number, z: number) => v(x * cos + z * sin, 0, -x * sin + z * cos);
  const wall = { ...box, center: v(0, 1, 0), halfExtents: v(1, 1, 10), yaw: angle };
  assert.equal(sweepBody(rotate(1.5, 0), rotate(1.5, 1), [wall], body).fraction, 1);
  assert.equal(sweepBody(rotate(1.5, 0), rotate(1.6, 1), [wall], body).fraction, 1);
  assert.equal(sweepBody(rotate(1.5, 0), rotate(1.4, 1), [wall], body).fraction, 0);
  const post = { ...cylinder, center: v(0, 1, 0) };
  const from = v(0.75 * cos, 0, 0.75 * sin);
  assert.equal(sweepBody(from, v(from.x - sin, 0, from.z + cos), [post], body).fraction, 1);
  assert.equal(sweepBody(from, v(from.x * 0.9, 0, from.z * 0.9), [post], body).fraction, 0);
});

test("earliest hit is deterministic regardless of proxy order; a path checks each leg", () => {
  const nearer = { ...cylinder, center: v(0, 1, 2) };
  assert.deepEqual(sweepBody(v(0, 0, 0), v(0, 0, 20), [box, nearer], body), sweepBody(v(0, 0, 0), v(0, 0, 20), [nearer, box], body));
  assert.equal(isPathClear([v(-4, 0, 0), v(0, 0, 5), v(4, 0, 0)], [box], body), false);
  assert.equal(isPathClear([v(-4, 0, 0), v(4, 0, 0)], [box], body), true);
});

test("sweeps do not mutate inputs and reject invalid body/segment values", () => {
  const frozen = Object.freeze(v(0, 0, 0));
  assert.equal(sweepBody(frozen, Object.freeze(v(0, 0, 1)), Object.freeze([box]), Object.freeze(body)).fraction, 1);
  assert.throws(() => sweepBody(v(NaN, 0, 0), v(0, 0, 1), [box], body), RangeError);
  assert.throws(() => sweepBody(v(0, 0, 0), v(0, 0, 1), [box], { ...body, radiusM: -1 }), RangeError);
});
