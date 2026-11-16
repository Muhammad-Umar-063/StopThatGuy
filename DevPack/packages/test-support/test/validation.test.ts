import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  CONFIG_VERSION,
  PROTOCOL_VERSION,
  isCommandAllowedInPhase,
  parseClientCommand,
  parseCreateRoomOptions,
  parseJoinRoomOptions,
  parseNickname,
  parseRoomCode,
  versionMismatches,
  type ValidationResult,
} from "@stopthatguy/shared";
import {
  AUTHORITY_CLAIM_SAMPLES,
  INVALID_COMMAND_SAMPLES,
  INVALID_JOIN_SAMPLES,
  VALID_COMMAND_SAMPLES,
  VALID_JOIN_SAMPLES,
  type InvalidPayloadSample,
  type PayloadSample,
} from "../src/index.js";

type Parser = (raw: unknown) => ValidationResult<unknown>;

function expectValid(parse: Parser, sample: PayloadSample) {
  const result = parse(sample.payload);
  assert.ok(result.ok, `${sample.label}: ${result.ok ? "" : JSON.stringify(result.error)}`);
  assert.deepEqual(result.value, sample.expected ?? sample.payload);
  assert.notEqual(result.value, sample.payload, "parser must return a fresh object");
}

function expectInvalid(parse: Parser, sample: InvalidPayloadSample) {
  const result = parse(sample.payload);
  assert.equal(result.ok, false, `${sample.label} should be rejected`);
  if (!result.ok) assert.equal(result.error.code, sample.expectedCode, `${sample.label}: got ${result.error.code} at ${result.error.path}`);
}

describe("client commands", () => {
  for (const sample of VALID_COMMAND_SAMPLES) test(`accepts ${sample.label}`, () => expectValid(parseClientCommand, sample));
  for (const sample of INVALID_COMMAND_SAMPLES) test(`rejects ${sample.label}`, () => expectInvalid(parseClientCommand, sample));
});

describe("client-declared authoritative outcomes", () => {
  for (const sample of AUTHORITY_CLAIM_SAMPLES) test(`rejects ${sample.label}`, () => expectInvalid(parseClientCommand, sample));
});

describe("join options", () => {
  for (const sample of VALID_JOIN_SAMPLES.create) test(`create accepts ${sample.label}`, () => expectValid(parseCreateRoomOptions, sample));
  for (const sample of VALID_JOIN_SAMPLES.join) test(`join accepts ${sample.label}`, () => expectValid(parseJoinRoomOptions, sample));
  for (const sample of INVALID_JOIN_SAMPLES.create) test(`create rejects ${sample.label}`, () => expectInvalid(parseCreateRoomOptions, sample));
  for (const sample of INVALID_JOIN_SAMPLES.join) test(`join rejects ${sample.label}`, () => expectInvalid(parseJoinRoomOptions, sample));
});

describe("validation output safety", () => {
  test("error messages and paths do not echo input values", () => {
    const secret = "SECRET-TOKEN-123";
    const wrongType = parseClientCommand({ type: "setReady", ready: secret });
    const unknownKey = parseClientCommand({ type: "leave", [`<script>${secret}`]: 1 });
    for (const result of [wrongType, unknownKey]) {
      assert.equal(result.ok, false);
      if (!result.ok) {
        assert.ok(!result.error.message.includes(secret) && !result.error.path.includes("<"), JSON.stringify(result.error));
      }
    }
  });

  test("normalizes nicknames to NFC and collapses spaces", () => {
    assert.deepEqual(parseNickname("  José   Silva "), { ok: true, value: "José Silva" });
    assert.deepEqual(parseRoomCode("fx7kq"), { ok: true, value: "FX7KQ" });
  });

  test("version mismatch names the differing fields", () => {
    const local = { protocolVersion: PROTOCOL_VERSION, worldVersion: "w1", configVersion: CONFIG_VERSION };
    assert.deepEqual(versionMismatches(local, { ...local }), []);
    assert.deepEqual(versionMismatches(local, { ...local, protocolVersion: PROTOCOL_VERSION + 1, worldVersion: "w2" }), [
      "protocolVersion",
      "worldVersion",
    ]);
  });

  test("phase table matches the documented command lifecycle", () => {
    assert.equal(isCommandAllowedInPhase("setReady", "lobby"), true);
    assert.equal(isCommandAllowedInPhase("input", "lobby"), false);
    assert.equal(isCommandAllowedInPhase("input", "chase"), true);
    assert.equal(isCommandAllowedInPhase("requestRematch", "chase"), false);
    assert.equal(isCommandAllowedInPhase("leave", "closed"), false);
  });
});
