import { PROTOCOL_LIMITS, type RoomErrorCode, type UiViewModel } from "@stopthatguy/shared";

export const NICKNAME_HELP = `Use 1–${PROTOCOL_LIMITS.nicknameMaxLength} characters. No control or invisible formatting characters.`;
export const CODE_HELP = `Enter ${PROTOCOL_LIMITS.roomCodeLength} letters or numbers. No I, O, 0 or 1.`;
export const ROOM_ERRORS: Readonly<Record<RoomErrorCode, string>> = {
  invalidRequest: "The request was not accepted. Check your details and try again.",
  invalidNickname: `That nickname is not valid. ${NICKNAME_HELP}`,
  invalidRoomCode: `That room code is not valid. ${CODE_HELP}`,
  roomNotFound: "Room not found. Check the code with your host, then try again.",
  roomFull: "This room is full. Ask your host for a free place or join another room.",
  roomExpired: "This room has expired. Ask your host to create a new room.",
  matchInProgress: "The chase has already started. Wait for the next lobby or join another room.",
  versionMismatch: "Your game version does not match this room. Reload after updating, or use a compatible room.",
};

export function lobbyPermissions(view: UiViewModel) {
  const lobby = view.lobby;
  const local = lobby?.players.find((player) => player.isLocal);
  const available = view.connection.state === "connected" && view.phase === "lobby" && local?.connection === "connected";
  let startReason = "Waiting for the room.";
  if (lobby) {
    if (!available) startReason = "Connect to the lobby before starting.";
    else if (!lobby.localIsHost) startReason = "Only the host can start. Get ready while you wait.";
    else if (lobby.players.length < lobby.minPlayers) startReason = `At least ${lobby.minPlayers} players are needed to start.`;
    else if (lobby.players.some((p) => !p.ready)) startReason = "Every player, including the host, must be ready.";
    else if (!lobby.canStart) startReason = "Waiting for the room to allow the start.";
    else startReason = "Everyone is ready. The host can start the chase.";
  }
  return {
    local,
    ready: Boolean(available),
    start: Boolean(available && lobby?.localIsHost && lobby.canStart),
    startReason,
  };
}
