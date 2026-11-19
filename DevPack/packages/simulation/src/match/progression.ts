import type { GameEvent, GameEventPayload, MatchResult } from "@stopthatguy/shared";
import { clearCaptureMotion } from "../capture/motion.js";
import { clonePlain } from "../copy.js";
import type { InternalState } from "../state.js";

export function emit(s: InternalState, payload: GameEventPayload): void {
  const event: GameEvent = { ...payload, id: s.nextEventId++, tick: s.match.tick };
  s.pendingEvents.push(event);
}

/** The original fixed-tick phase clock; the room remains responsible for lobby/countdown cancellation. */
export function advancePhaseClock(s: InternalState): void {
  const m = s.match;
  if (m.phase === "countdown" && m.tick >= (m.phaseEndsAtTick ?? 0)) {
    m.phase = "intro";
    m.phaseEndsAtTick = m.chaseStartTick;
  }
  if (m.phase === "intro" && m.chaseStartTick !== null && m.tick >= m.chaseStartTick) {
    m.phase = "chase";
    m.phaseEndsAtTick = null;
    emit(s, { type: "matchStarted", chaseStartTick: m.chaseStartTick });
  }
}

/** Called after the reserved capture stage. A published capture/result always wins over pending escape/timeout. */
export function resolveEscapeAndTimeout(s: InternalState): void {
  const m = s.match;
  if (m.result !== null || m.phase !== "chase") return;
  const exit = s.robberMemory.pendingEscape;
  if (!s.players.some(p => p.participation === "active")) {
    finishMatch(s, { outcome: "noWinner", reason: "allCompetitorsOut", winnerId: null,
      resolvedAtTick: m.tick, awards: [], stats: [], deductions: [] });
  } else if (exit !== null && s.robber.aiState !== "captured") {
    s.robber.aiState = "escaped";
    emit(s, { type: "robberEscaped", exitZoneId: exit });
    finishMatch(s, { outcome: "noWinner", reason: "escaped", winnerId: null,
      resolvedAtTick: m.tick, awards: [], stats: [], deductions: [] });
  } else if (m.chaseEndTick !== null && m.tick >= m.chaseEndTick) {
    finishMatch(s, { outcome: "noWinner", reason: "timeout", winnerId: null,
      resolvedAtTick: m.tick, awards: [], stats: [], deductions: [] });
  }
}

/** Publish once, copy the caller's result, freeze competitive movement. Awards/stats remain T037. */
export function finishMatch(s: InternalState, result: MatchResult): void {
  if (s.match.result !== null) return;
  for (const player of s.players) {
    if (s.captureAttempts.delete(player.id)) emit(s, { type: "captureCancelled", playerId: player.id, reason: "phaseEnded" });
  }
  clearCaptureMotion(s);
  s.match.result = clonePlain(result);
  s.match.phase = "results";
  s.match.phaseEndsAtTick = null;
  s.robber.speedMps = 0;
  for (const player of s.players) player.speedMps = 0;
  emit(s, { type: "matchEnded", result: clonePlain(result) });
}
