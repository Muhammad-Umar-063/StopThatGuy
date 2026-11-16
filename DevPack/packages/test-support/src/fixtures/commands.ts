// TEST DATA — untrusted client payload samples for validation tests (T002) and later
// malformed-input/abuse checks (T036/T041). Payloads are raw `unknown` data as a socket would deliver it.
import { CONFIG_VERSION, PROTOCOL_LIMITS, PROTOCOL_VERSION, type ValidationErrorCode } from "@stopthatguy/shared";
import { deepFreeze } from "./freeze.js";
import { FIXTURE_WORLD } from "./world.js";

export interface PayloadSample {
  label: string;
  payload: unknown;
  /** Expected parsed value when it differs from the payload (normalization). */
  expected?: unknown;
}

export interface InvalidPayloadSample extends PayloadSample {
  expectedCode: ValidationErrorCode;
}

const versions = { protocolVersion: PROTOCOL_VERSION, worldVersion: FIXTURE_WORLD.worldVersion, configVersion: CONFIG_VERSION };

const frame = (overrides: Record<string, unknown> = {}) => ({
  sequence: 42,
  forwardHeld: true,
  brakeHeld: false,
  sprintHeld: true,
  interactHeld: false,
  actions: [
    { id: 7, kind: "left" },
    { id: 8, kind: "capture" },
  ],
  clientTimeMs: 123456.5,
  ...overrides,
});

const input = (overrides: Record<string, unknown>) => ({ type: "input", frame: frame(overrides) });

function withoutKey(o: Record<string, unknown>, key: string): Record<string, unknown> {
  const copy = { ...o };
  delete copy[key];
  return copy;
}

export const VALID_COMMAND_SAMPLES: readonly PayloadSample[] = deepFreeze([
  { label: "ready", payload: { type: "setReady", ready: true } },
  { label: "unready", payload: { type: "setReady", ready: false } },
  { label: "host start", payload: { type: "startMatch" } },
  { label: "input frame with edge actions", payload: { type: "input", frame: frame() } },
  { label: "neutral heartbeat frame", payload: input({ forwardHeld: false, sprintHeld: false, actions: [], clientTimeMs: null }) },
  {
    label: "maximum actions per frame",
    payload: input({
      actions: Array.from({ length: PROTOCOL_LIMITS.maxActionsPerInputFrame }, (_, i) => ({ id: i + 1, kind: "interact" })),
    }),
  },
  { label: "resume handshake", payload: { type: "resume", versions } },
  { label: "leave", payload: { type: "leave" } },
  { label: "rematch", payload: { type: "requestRematch" } },
]);

const tooManyActions = Array.from({ length: PROTOCOL_LIMITS.maxActionsPerInputFrame + 1 }, (_, i) => ({ id: i + 1, kind: "left" }));

export const INVALID_COMMAND_SAMPLES: readonly InvalidPayloadSample[] = deepFreeze([
  { label: "null", payload: null, expectedCode: "notObject" },
  { label: "array", payload: [{ type: "leave" }], expectedCode: "notObject" },
  { label: "string", payload: "leave", expectedCode: "notObject" },
  { label: "class instance", payload: new Date(0), expectedCode: "notObject" },
  { label: "missing type", payload: { ready: true }, expectedCode: "missingField" },
  { label: "numeric type", payload: { type: 3 }, expectedCode: "wrongType" },
  { label: "unknown command", payload: { type: "teleport" }, expectedCode: "unknownCommand" },
  { label: "ready as string", payload: { type: "setReady", ready: "true" }, expectedCode: "wrongType" },
  { label: "extra field on leave", payload: { type: "leave", reason: "x" }, expectedCode: "unknownField" },
  {
    label: "__proto__ injection",
    payload: JSON.parse('{"type":"leave","__proto__":{"isHost":true}}'),
    expectedCode: "unknownField",
  },
  { label: "frame missing brakeHeld", payload: { type: "input", frame: withoutKey(frame(), "brakeHeld") }, expectedCode: "missingField" },
  { label: "frame brakeHeld undefined", payload: input({ brakeHeld: undefined }), expectedCode: "wrongType" },
  { label: "frame not an object", payload: { type: "input", frame: [] }, expectedCode: "notObject" },
  { label: "negative sequence", payload: input({ sequence: -1 }), expectedCode: "outOfRange" },
  { label: "fractional sequence", payload: input({ sequence: 1.5 }), expectedCode: "outOfRange" },
  { label: "sequence above uint32", payload: input({ sequence: 2 ** 32 }), expectedCode: "outOfRange" },
  { label: "sequence as string", payload: input({ sequence: "42" }), expectedCode: "wrongType" },
  { label: "NaN sequence", payload: input({ sequence: Number.NaN }), expectedCode: "notFinite" },
  { label: "Infinity clientTimeMs", payload: input({ clientTimeMs: Number.POSITIVE_INFINITY }), expectedCode: "notFinite" },
  { label: "negative clientTimeMs", payload: input({ clientTimeMs: -5 }), expectedCode: "outOfRange" },
  { label: "held flag as number", payload: input({ forwardHeld: 1 }), expectedCode: "wrongType" },
  { label: "actions not an array", payload: input({ actions: { id: 1, kind: "left" } }), expectedCode: "wrongType" },
  { label: "oversized actions array", payload: input({ actions: tooManyActions }), expectedCode: "tooMany" },
  { label: "invalid action kind", payload: input({ actions: [{ id: 1, kind: "jump" }] }), expectedCode: "invalidValue" },
  { label: "action ID zero", payload: input({ actions: [{ id: 0, kind: "left" }] }), expectedCode: "outOfRange" },
  {
    label: "duplicate action IDs",
    payload: input({ actions: [{ id: 5, kind: "left" }, { id: 5, kind: "right" }] }),
    expectedCode: "invalidValue",
  },
  {
    label: "descending action IDs",
    payload: input({ actions: [{ id: 6, kind: "left" }, { id: 5, kind: "right" }] }),
    expectedCode: "invalidValue",
  },
  { label: "resume with oversized version label", payload: { type: "resume", versions: { ...versions, worldVersion: "w".repeat(33) } }, expectedCode: "tooLong" },
  { label: "resume with path-like version label", payload: { type: "resume", versions: { ...versions, configVersion: "../etc" } }, expectedCode: "invalidValue" },
  { label: "resume with protocol 0", payload: { type: "resume", versions: { ...versions, protocolVersion: 0 } }, expectedCode: "outOfRange" },
  { label: "huge unknown key", payload: { type: "leave", ["k".repeat(100_000)]: 1 }, expectedCode: "unknownField" },
]);

/** Clients may not declare authoritative facts: positions, ownership, hits, rewards, results or winners. */
export const AUTHORITY_CLAIM_SAMPLES: readonly InvalidPayloadSample[] = deepFreeze([
  { label: "declare winner command", payload: { type: "declareWinner", winnerId: "fixture-player-ana" }, expectedCode: "unknownCommand" },
  { label: "capture result command", payload: { type: "captureResolved", playerId: "fixture-player-ana" }, expectedCode: "unknownCommand" },
  { label: "match result command", payload: { type: "matchEnded", result: { outcome: "capture" } }, expectedCode: "unknownCommand" },
  { label: "position in input frame", payload: input({ position: { x: 1, y: 0, z: 2 } }), expectedCode: "unknownField" },
  { label: "velocity in input frame", payload: input({ speedMps: 99 }), expectedCode: "unknownField" },
  { label: "vehicle ownership in input frame", payload: input({ vehicleId: "v-shop-scooter" }), expectedCode: "unknownField" },
  {
    label: "hit result on sabotage action",
    payload: input({ actions: [{ id: 1, kind: "sabotage", targetId: "fixture-player-bruno", hit: true }] }),
    expectedCode: "unknownField",
  },
  { label: "capture target on action", payload: input({ actions: [{ id: 1, kind: "capture", targetId: "robber" }] }), expectedCode: "unknownField" },
  { label: "reward claim on ready", payload: { type: "setReady", ready: true, reward: 1000 }, expectedCode: "unknownField" },
  { label: "host claim on start", payload: { type: "startMatch", hostId: "fixture-player-carla" }, expectedCode: "unknownField" },
  { label: "client-assigned winner on rematch", payload: { type: "requestRematch", winnerId: "fixture-player-ana" }, expectedCode: "unknownField" },
]);

export const VALID_JOIN_SAMPLES = deepFreeze({
  create: [
    { label: "create normal room", payload: { nickname: "Ana", mode: "normal", versions } },
    { label: "create practice room, nickname normalized", payload: { nickname: "  Ana   Lisboa ", mode: "practice", versions }, expected: { nickname: "Ana Lisboa", mode: "practice", versions } },
    { label: "16-code-point nickname with accents", payload: { nickname: "João Conceição12", mode: "normal", versions } },
  ] as PayloadSample[],
  join: [
    { label: "join by code", payload: { roomCode: "FX7KQ", nickname: "Bruno", versions } },
    { label: "lowercase code is normalized", payload: { roomCode: " fx7kq ", nickname: "Bruno", versions }, expected: { roomCode: "FX7KQ", nickname: "Bruno", versions } },
  ] as PayloadSample[],
});

export const INVALID_JOIN_SAMPLES = deepFreeze({
  create: [
    { label: "empty nickname", payload: { nickname: "   ", mode: "normal", versions }, expectedCode: "invalidValue" },
    { label: "17-character nickname", payload: { nickname: "A".repeat(17), mode: "normal", versions }, expectedCode: "tooLong" },
    { label: "10k-character nickname", payload: { nickname: "A".repeat(10_000), mode: "normal", versions }, expectedCode: "tooLong" },
    { label: "bidi override in nickname", payload: { nickname: "‮evil", mode: "normal", versions }, expectedCode: "invalidValue" },
    { label: "newline in nickname", payload: { nickname: "Ana\nBruno", mode: "normal", versions }, expectedCode: "invalidValue" },
    { label: "unknown mode", payload: { nickname: "Ana", mode: "ranked", versions }, expectedCode: "invalidValue" },
    { label: "missing versions", payload: { nickname: "Ana", mode: "normal" }, expectedCode: "missingField" },
    { label: "host claim", payload: { nickname: "Ana", mode: "normal", versions, isHost: true }, expectedCode: "unknownField" },
  ] as InvalidPayloadSample[],
  join: [
    { label: "ambiguous characters in code", payload: { roomCode: "IO01O", nickname: "Bruno", versions }, expectedCode: "invalidValue" },
    { label: "short code", payload: { roomCode: "FX7", nickname: "Bruno", versions }, expectedCode: "invalidValue" },
    { label: "oversized code", payload: { roomCode: "F".repeat(1000), nickname: "Bruno", versions }, expectedCode: "tooLong" },
    { label: "numeric code", payload: { roomCode: 12345, nickname: "Bruno", versions }, expectedCode: "wrongType" },
    { label: "reconnect token smuggled in join", payload: { roomCode: "FX7KQ", nickname: "Bruno", versions, reconnectToken: "abc" }, expectedCode: "unknownField" },
  ] as InvalidPayloadSample[],
});
