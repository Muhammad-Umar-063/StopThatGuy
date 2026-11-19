import type { CaptureCancelReason, PlayerId } from "@stopthatguy/shared";
import { emit, finishMatch } from "../match/progression.js";
import type { InternalState } from "../state.js";
import { captureFailure } from "./eligibility.js";
import { compareAttempts } from "./memory.js";

export function cancelCapture(s: InternalState, playerId: PlayerId, reason: CaptureCancelReason): void {
  if (s.captureAttempts.delete(playerId)) emit(s, { type: "captureCancelled", playerId, reason });
}

/** Stage 5, after movement/effects/arrest and before escape/timeout. Input order cannot choose a winner. */
export function advanceCaptures(s: InternalState, pressed: ReadonlySet<PlayerId>): void {
  for (const player of s.players) {
    const failure = captureFailure(s, player);
    if (failure !== null) {
      cancelCapture(s, player.id, failure);
    } else if (pressed.has(player.id) && !s.captureAttempts.has(player.id)) {
      s.captureAttempts.set(player.id, { playerId: player.id, startTick: s.match.tick,
        completionTick: s.match.tick + Math.ceil(s.tuning.capture.attemptMs / s.fixedDeltaMs) });
      emit(s, { type: "captureStarted", playerId: player.id });
    }
  }
  const completed = [...s.captureAttempts.values()].filter(a => a.completionTick <= s.match.tick);
  completed.sort((a, b) => compareAttempts(a, b, id => s.playersById.get(id)!.joinOrder));
  const winner = completed[0];
  if (!winner) return;
  s.captureAttempts.delete(winner.playerId);
  s.robber.aiState = "captured";
  emit(s, { type: "captureResolved", playerId: winner.playerId });
  finishMatch(s, { outcome: "capture", reason: "captured", winnerId: winner.playerId,
    resolvedAtTick: s.match.tick, awards: [], stats: [], deductions: [] });
}
