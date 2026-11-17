import { ServerError } from "@colyseus/core";
import {
  parseCreateRoomOptions, parseJoinRoomOptions, versionMismatches,
  type RoomErrorCode, type ValidationResult, type VersionInfo,
} from "@stopthatguy/shared";

const messages: Record<RoomErrorCode, string> = {
  invalidRequest: "Invalid room request.",
  invalidNickname: "Enter a nickname of 1–16 characters without control characters.",
  invalidRoomCode: "Enter a five-character room code using letters and numbers without I, O, 0 or 1.",
  roomNotFound: "That room does not exist.",
  roomFull: "That room is full.",
  roomExpired: "That room has closed. Create a new room.",
  matchInProgress: "That match has already started.",
  versionMismatch: "Client and server versions differ. Reload the game.",
};

/** The shared error code also prefixes Colyseus's numeric-code WebSocket errors. */
export class RoomFailure extends ServerError {
  constructor(readonly roomCode: RoomErrorCode, readonly status = 400) {
    super(status, `${roomCode}: ${messages[roomCode]}`);
  }
}

function unwrap<T>(result: ValidationResult<T>): T {
  if (result.ok) return result.value;
  const path = result.error.path;
  throw new RoomFailure(path.startsWith("$.nickname") ? "invalidNickname"
    : path.startsWith("$.roomCode") ? "invalidRoomCode" : "invalidRequest");
}

export function checkVersions(actual: VersionInfo, expected: VersionInfo): void {
  if (versionMismatches(actual, expected).length) throw new RoomFailure("versionMismatch", 409);
}

export function readCreateOptions(raw: unknown, expected: VersionInfo) {
  const options = unwrap(parseCreateRoomOptions(raw));
  checkVersions(options.versions, expected);
  return options;
}

export function readJoinOptions(raw: unknown, expected: VersionInfo) {
  const options = unwrap(parseJoinRoomOptions(raw));
  checkVersions(options.versions, expected);
  return options;
}
