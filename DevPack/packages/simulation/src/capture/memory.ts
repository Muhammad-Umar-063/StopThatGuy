import type { PlayerId, Tick } from "@stopthatguy/shared";

/** Server-only attempt timing. Action IDs and client clocks never enter winner ordering. */
export interface CaptureAttempt {
  playerId: PlayerId;
  startTick: Tick;
  completionTick: Tick;
}

export function compareAttempts(a: CaptureAttempt, b: CaptureAttempt,
  joinOrder: (id: PlayerId) => number): number {
  return a.completionTick - b.completionTick || a.startTick - b.startTick
    || joinOrder(a.playerId) - joinOrder(b.playerId);
}
