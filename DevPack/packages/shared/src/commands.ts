import type { GameEvent } from "./events.js";
import type { InputFrame } from "./input.js";
import type { MatchMode, MatchPhase } from "./states.js";
import type { VersionInfo } from "./versions.js";

/** Join-time options for creating a room (validated by parseCreateRoomOptions). */
export interface CreateRoomOptions {
  nickname: string;
  mode: MatchMode;
  versions: VersionInfo;
}

/** Join-time options for joining by public room code (validated by parseJoinRoomOptions). */
export interface JoinRoomOptions {
  roomCode: string;
  nickname: string;
  versions: VersionInfo;
}

/**
 * Messages a client may send inside a room. Validate with parseClientCommand.
 * Reconnect credentials are handled by the transport and never appear here.
 */
export type ClientCommand =
  | { type: "setReady"; ready: boolean }
  | { type: "startMatch" }
  | { type: "input"; frame: InputFrame }
  /** Reconnect handshake after the transport reconnects: re-checks versions; input sequence restarts. */
  | { type: "resume"; versions: VersionInfo }
  /** Safe leave; during a match this forfeits immediately. */
  | { type: "leave" }
  /** Host returns everyone to the lobby after results. */
  | { type: "requestRematch" };

export type ClientCommandType = ClientCommand["type"];

export const CLIENT_COMMAND_TYPES = [
  "setReady",
  "startMatch",
  "input",
  "resume",
  "leave",
  "requestRematch",
] as const satisfies readonly ClientCommandType[];

// Compile-time check that CLIENT_COMMAND_TYPES lists every command type.
type AssertNever<T extends never> = T;
export type _AllClientCommandTypesListed = AssertNever<Exclude<ClientCommandType, (typeof CLIENT_COMMAND_TYPES)[number]>>;

/** Phases in which each command is accepted. The server additionally checks session, host role and rate. */
export const COMMAND_PHASES: Readonly<Record<ClientCommandType, readonly MatchPhase[]>> = Object.freeze({
  setReady: ["lobby"],
  startMatch: ["lobby"],
  input: ["countdown", "intro", "chase"],
  resume: ["lobby", "countdown", "intro", "chase", "results"],
  leave: ["lobby", "countdown", "intro", "chase", "results"],
  requestRematch: ["results"],
});

export const HOST_ONLY_COMMANDS: readonly ClientCommandType[] = Object.freeze(["startMatch", "requestRematch"]);

export function isCommandAllowedInPhase(type: ClientCommandType, phase: MatchPhase): boolean {
  return COMMAND_PHASES[type].includes(phase);
}

/** Distinct, readable join failures (NETWORKING.md). */
export const ROOM_ERROR_CODES = [
  "invalidRequest",
  "invalidNickname",
  "invalidRoomCode",
  "roomNotFound",
  "roomFull",
  "roomExpired",
  "matchInProgress",
  "versionMismatch",
] as const;
export type RoomErrorCode = (typeof ROOM_ERROR_CODES)[number];

export const COMMAND_REJECTION_CODES = ["malformed", "wrongPhase", "notHost", "rateLimited", "versionMismatch"] as const;
export type CommandRejectionCode = (typeof COMMAND_REJECTION_CODES)[number];

/** Server → client messages outside replicated state. */
export type ServerMessage =
  | { type: "event"; event: GameEvent }
  /** `commandType` is null when the payload had no recognizable type. */
  | { type: "commandRejected"; commandType: ClientCommandType | null; code: CommandRejectionCode };
