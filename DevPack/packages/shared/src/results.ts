import type { PlayerId, Tick } from "./ids.js";

/** Fictional in-game currency only; no real money. */
export const DEDUCTION_REASONS = ["vehicleTheft", "damage"] as const;
export type DeductionReason = (typeof DEDUCTION_REASONS)[number];

export const AWARD_KINDS = ["mainPrize", "longestFootDistance", "mostTransportChanges", "highestDamageDeduction"] as const;
export type AwardKind = (typeof AWARD_KINDS)[number];

export interface Award {
  kind: AwardKind;
  playerId: PlayerId;
  /** Measured value behind the award (meters, count or currency); null for mainPrize. */
  value: number | null;
}

export interface PlayerMatchStats {
  playerId: PlayerId;
  footDistanceM: number;
  transportChanges: number;
  damageDeduction: number;
}

export interface Deduction {
  playerId: PlayerId;
  reason: DeductionReason;
  amount: number;
}

interface ResultCommon {
  resolvedAtTick: Tick;
  awards: readonly Award[];
  stats: readonly PlayerMatchStats[];
  /** Deductions never reverse the capture winner. */
  deductions: readonly Deduction[];
}

export const NO_WINNER_REASONS = ["escaped", "timeout", "allCompetitorsOut"] as const;
export type NoWinnerReason = (typeof NO_WINNER_REASONS)[number];

/** Published once by the server; immutable afterwards. */
export type MatchResult =
  | (ResultCommon & { outcome: "capture"; reason: "captured"; winnerId: PlayerId })
  | (ResultCommon & { outcome: "noWinner"; reason: NoWinnerReason; winnerId: null });
