import type { PlayerId } from "@stopthatguy/shared";
import { cancelCapture } from "../capture/capture.js";
import { toInternal, type SimulationState } from "../state.js";

/** Trusted host departure only, never a client command. T028 owns reconnect/grace semantics. */
export function forfeitPlayer(state: SimulationState, playerId: PlayerId): void {
  const s = toInternal(state), player = s.playersById.get(playerId);
  if (!player) throw new RangeError(`unknown player ${playerId}`);
  player.connection = "left";
  player.participation = "forfeit";
  player.ready = false;
  player.speedMps = 0;
  s.captureMotion.players.delete(playerId);
  cancelCapture(s, playerId, "ineligible");
}
