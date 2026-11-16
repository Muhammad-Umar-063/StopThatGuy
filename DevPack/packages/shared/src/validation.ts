import {
  CLIENT_COMMAND_TYPES,
  type ClientCommand,
  type ClientCommandType,
  type CreateRoomOptions,
  type JoinRoomOptions,
} from "./commands.js";
import { PROTOCOL_LIMITS } from "./config.js";
import { EDGE_ACTION_KINDS, type EdgeAction, type InputFrame } from "./input.js";
import { MATCH_MODES } from "./states.js";
import type { VersionInfo } from "./versions.js";

/**
 * Stateless runtime validation for untrusted client data (room join options and in-room commands).
 *
 * - Accepts only plain objects/arrays with exactly the allowed fields; unknown fields and unknown
 *   command types are rejected, so a client cannot attach positions, ownership, results or winners.
 * - Rejects wrong types, invalid enum values, NaN/Infinity, out-of-range integers, oversized strings
 *   and arrays.
 * - Returns freshly built values (never the input object) and never echoes input values in messages.
 *
 * Stateful and gameplay checks stay with the server/simulation: sequence/action monotonicity across
 * frames, rate limits, phase/host permissions (see COMMAND_PHASES), range, speed, cooldowns and
 * vehicle availability.
 */

export const VALIDATION_ERROR_CODES = [
  "notObject",
  "unknownField",
  "missingField",
  "wrongType",
  "invalidValue",
  "notFinite",
  "outOfRange",
  "tooLong",
  "tooMany",
  "unknownCommand",
] as const;
export type ValidationErrorCode = (typeof VALIDATION_ERROR_CODES)[number];

export interface ValidationError {
  code: ValidationErrorCode;
  /** Location such as "$.frame.actions[1].kind". Unknown keys are sanitized and truncated. */
  path: string;
  message: string;
}

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; error: ValidationError };

export function parseClientCommand(raw: unknown): ValidationResult<ClientCommand> {
  return run(() => clientCommand(raw, "$"));
}

export function parseCreateRoomOptions(raw: unknown): ValidationResult<CreateRoomOptions> {
  return run(() => {
    const o = record(raw, "$", ["nickname", "mode", "versions"]);
    return {
      nickname: nickname(field(o, "nickname", "$"), "$.nickname"),
      mode: oneOf(field(o, "mode", "$"), "$.mode", MATCH_MODES),
      versions: versionInfo(field(o, "versions", "$"), "$.versions"),
    };
  });
}

export function parseJoinRoomOptions(raw: unknown): ValidationResult<JoinRoomOptions> {
  return run(() => {
    const o = record(raw, "$", ["roomCode", "nickname", "versions"]);
    return {
      roomCode: roomCode(field(o, "roomCode", "$"), "$.roomCode"),
      nickname: nickname(field(o, "nickname", "$"), "$.nickname"),
      versions: versionInfo(field(o, "versions", "$"), "$.versions"),
    };
  });
}

/** Trims, NFC-normalizes and collapses spaces. Shared by the lobby form and the server. */
export function parseNickname(raw: unknown): ValidationResult<string> {
  return run(() => nickname(raw, "$"));
}

/** Trims and upper-cases; accepts only PROTOCOL_LIMITS.roomCodeAlphabet. */
export function parseRoomCode(raw: unknown): ValidationResult<string> {
  return run(() => roomCode(raw, "$"));
}

export function parseInputFrame(raw: unknown): ValidationResult<InputFrame> {
  return run(() => inputFrame(raw, "$"));
}

// ---------------------------------------------------------------------------------------------

const COMMAND_FIELDS: Readonly<Record<ClientCommandType, readonly string[]>> = {
  setReady: ["type", "ready"],
  startMatch: ["type"],
  input: ["type", "frame"],
  resume: ["type", "versions"],
  leave: ["type"],
  requestRematch: ["type"],
};

function clientCommand(raw: unknown, path: string): ClientCommand {
  plainObject(raw, path);
  const typeValue = field(raw, "type", path);
  if (typeof typeValue !== "string") fail("wrongType", `${path}.type`, "expected a string");
  if (!isOneOf(typeValue, CLIENT_COMMAND_TYPES)) fail("unknownCommand", `${path}.type`, "unknown command type");
  const o = record(raw, path, COMMAND_FIELDS[typeValue]);
  switch (typeValue) {
    case "setReady":
      return { type: typeValue, ready: bool(field(o, "ready", path), `${path}.ready`) };
    case "input":
      return { type: typeValue, frame: inputFrame(field(o, "frame", path), `${path}.frame`) };
    case "resume":
      return { type: typeValue, versions: versionInfo(field(o, "versions", path), `${path}.versions`) };
    case "startMatch":
    case "leave":
    case "requestRematch":
      return { type: typeValue };
  }
}

const FRAME_FIELDS = ["sequence", "forwardHeld", "brakeHeld", "sprintHeld", "interactHeld", "actions", "clientTimeMs"];

function inputFrame(raw: unknown, path: string): InputFrame {
  const o = record(raw, path, FRAME_FIELDS);
  const at = (key: string) => field(o, key, path);
  const clientTime = at("clientTimeMs");
  return {
    sequence: uint32(at("sequence"), `${path}.sequence`, 0),
    forwardHeld: bool(at("forwardHeld"), `${path}.forwardHeld`),
    brakeHeld: bool(at("brakeHeld"), `${path}.brakeHeld`),
    sprintHeld: bool(at("sprintHeld"), `${path}.sprintHeld`),
    interactHeld: bool(at("interactHeld"), `${path}.interactHeld`),
    actions: edgeActions(at("actions"), `${path}.actions`),
    clientTimeMs: clientTime === null ? null : finiteInRange(clientTime, `${path}.clientTimeMs`, 0, Number.MAX_SAFE_INTEGER),
  };
}

function edgeActions(raw: unknown, path: string): EdgeAction[] {
  if (!Array.isArray(raw)) fail("wrongType", path, "expected an array");
  if (raw.length > PROTOCOL_LIMITS.maxActionsPerInputFrame) {
    fail("tooMany", path, `at most ${PROTOCOL_LIMITS.maxActionsPerInputFrame} actions per frame`);
  }
  const actions: EdgeAction[] = [];
  let previousId = 0;
  raw.forEach((item: unknown, index) => {
    const itemPath = `${path}[${index}]`;
    const o = record(item, itemPath, ["id", "kind"]);
    const id = uint32(field(o, "id", itemPath), `${itemPath}.id`, 1);
    if (id <= previousId) fail("invalidValue", `${itemPath}.id`, "action IDs must be unique and ascending");
    previousId = id;
    actions.push({ id, kind: oneOf(field(o, "kind", itemPath), `${itemPath}.kind`, EDGE_ACTION_KINDS) });
  });
  return actions;
}

const VERSION_LABEL = /^[A-Za-z0-9._-]+$/;

function versionInfo(raw: unknown, path: string): VersionInfo {
  const o = record(raw, path, ["protocolVersion", "worldVersion", "configVersion"]);
  return {
    protocolVersion: uint32(field(o, "protocolVersion", path), `${path}.protocolVersion`, 1),
    worldVersion: versionLabel(field(o, "worldVersion", path), `${path}.worldVersion`),
    configVersion: versionLabel(field(o, "configVersion", path), `${path}.configVersion`),
  };
}

function versionLabel(raw: unknown, path: string): string {
  const value = str(raw, path, PROTOCOL_LIMITS.maxVersionLabelLength);
  if (!VERSION_LABEL.test(value)) fail("invalidValue", path, "expected 1+ characters of [A-Za-z0-9._-]");
  return value;
}

function nickname(raw: unknown, path: string): string {
  const trimmed = str(raw, path, PROTOCOL_LIMITS.nicknameMaxRawLength).trim().normalize("NFC");
  // Control, format (incl. bidi overrides), private-use, unassigned and line/paragraph separators.
  if (/[\p{C}\p{Zl}\p{Zp}]/u.test(trimmed)) fail("invalidValue", path, "control or formatting characters are not allowed");
  const value = trimmed.replace(/\s+/gu, " ");
  const length = [...value].length;
  if (length < PROTOCOL_LIMITS.nicknameMinLength) fail("invalidValue", path, "nickname is empty");
  if (length > PROTOCOL_LIMITS.nicknameMaxLength) {
    fail("tooLong", path, `at most ${PROTOCOL_LIMITS.nicknameMaxLength} characters`);
  }
  return value;
}

function roomCode(raw: unknown, path: string): string {
  const value = str(raw, path, PROTOCOL_LIMITS.roomCodeMaxRawLength).trim().toUpperCase();
  const valid =
    value.length === PROTOCOL_LIMITS.roomCodeLength &&
    [...value].every((char) => PROTOCOL_LIMITS.roomCodeAlphabet.includes(char));
  if (!valid) fail("invalidValue", path, `expected ${PROTOCOL_LIMITS.roomCodeLength} room-code characters`);
  return value;
}

// --- primitives ------------------------------------------------------------------------------

class InvalidInput extends Error {
  readonly detail: ValidationError;
  constructor(detail: ValidationError) {
    super(detail.message);
    this.detail = detail;
  }
}

function fail(code: ValidationErrorCode, path: string, message: string): never {
  throw new InvalidInput({ code, path, message });
}

function run<T>(parse: () => T): ValidationResult<T> {
  try {
    return { ok: true, value: parse() };
  } catch (error) {
    if (error instanceof InvalidInput) return { ok: false, error: error.detail };
    throw error;
  }
}

function plainObject(raw: unknown, path: string): asserts raw is Record<string, unknown> {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) fail("notObject", path, "expected an object");
  const proto: unknown = Object.getPrototypeOf(raw);
  if (proto !== Object.prototype && proto !== null) fail("notObject", path, "expected a plain object");
}

/** Plain object whose own keys are all in `allowed`. */
function record(raw: unknown, path: string, allowed: readonly string[]): Record<string, unknown> {
  plainObject(raw, path);
  for (const key of Reflect.ownKeys(raw)) {
    if (typeof key !== "string" || !allowed.includes(key)) {
      fail("unknownField", `${path}.${safeKey(key)}`, "unknown field");
    }
  }
  return raw;
}

function field(o: Record<string, unknown>, key: string, path: string): unknown {
  if (!Object.hasOwn(o, key)) fail("missingField", `${path}.${key}`, "required field is missing");
  return o[key];
}

function safeKey(key: string | symbol): string {
  if (typeof key === "symbol") return "[symbol]";
  const cleaned = key.replace(/[^A-Za-z0-9_$-]/g, "?");
  return cleaned.length > 32 ? `${cleaned.slice(0, 32)}…` : cleaned;
}

function bool(raw: unknown, path: string): boolean {
  if (typeof raw !== "boolean") fail("wrongType", path, "expected a boolean");
  return raw;
}

function str(raw: unknown, path: string, maxLength: number): string {
  if (typeof raw !== "string") fail("wrongType", path, "expected a string");
  if (raw.length > maxLength) fail("tooLong", path, `at most ${maxLength} characters`);
  return raw;
}

function finite(raw: unknown, path: string): number {
  if (typeof raw !== "number") fail("wrongType", path, "expected a number");
  if (!Number.isFinite(raw)) fail("notFinite", path, "expected a finite number");
  return raw;
}

function finiteInRange(raw: unknown, path: string, min: number, max: number): number {
  const value = finite(raw, path);
  if (value < min || value > max) fail("outOfRange", path, `expected ${min}..${max}`);
  return value === 0 ? 0 : value; // normalize -0
}

function uint32(raw: unknown, path: string, min: number): number {
  const value = finite(raw, path);
  if (!Number.isInteger(value) || value < min || value > PROTOCOL_LIMITS.maxUint32) {
    fail("outOfRange", path, `expected an integer ${min}..${PROTOCOL_LIMITS.maxUint32}`);
  }
  return value === 0 ? 0 : value; // normalize -0
}

function isOneOf<T extends string>(value: string, allowed: readonly T[]): value is T {
  return (allowed as readonly string[]).includes(value);
}

function oneOf<T extends string>(raw: unknown, path: string, allowed: readonly T[]): T {
  if (typeof raw !== "string") fail("wrongType", path, "expected a string");
  if (!isOneOf(raw, allowed)) fail("invalidValue", path, "not an allowed value");
  return raw;
}
