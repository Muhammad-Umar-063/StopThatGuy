import type { EventId, InteractableId, PlayerId, PoliceId, Tick, VehicleId, ZoneId } from "./ids.js";
import type { MatchResult } from "./results.js";

export const CAPTURE_CANCEL_REASONS = ["outOfRange", "lostSight", "tooFast", "stunned", "arrested", "phaseEnded", "notFacing", "ineligible"] as const;
export type CaptureCancelReason = (typeof CAPTURE_CANCEL_REASONS)[number];

/**
 * Discrete server events for presentation (sounds, effects, messages). Clients deduplicate by `id`.
 * Replicated state, not events, is the source of truth for the current screen.
 */
export type GameEventPayload =
  | { type: "matchStarted"; chaseStartTick: Tick }
  | { type: "mounted"; playerId: PlayerId; vehicleId: VehicleId }
  | { type: "dismounted"; playerId: PlayerId; vehicleId: VehicleId }
  | { type: "liftBoarded"; playerId: PlayerId; vehicleId: VehicleId; seatIndex: number }
  | { type: "liftExited"; playerId: PlayerId; vehicleId: VehicleId }
  /** `targetId` is null and `hit` false for a missed attempt. */
  | { type: "shoveResolved"; attackerId: PlayerId; targetId: PlayerId | null; hit: boolean }
  | { type: "theftDetected"; playerId: PlayerId; interactableId: InteractableId; vehicleId: VehicleId }
  | { type: "wantedChanged"; playerId: PlayerId; wanted: boolean }
  | { type: "arrested"; playerId: PlayerId; policeId: PoliceId }
  | { type: "captureStarted"; playerId: PlayerId }
  | { type: "captureCancelled"; playerId: PlayerId; reason: CaptureCancelReason }
  | { type: "captureResolved"; playerId: PlayerId }
  | { type: "robberEscaped"; exitZoneId: ZoneId }
  | { type: "matchEnded"; result: MatchResult };

export type GameEventType = GameEventPayload["type"];

export type GameEvent = GameEventPayload & {
  id: EventId;
  tick: Tick;
};

export const GAME_EVENT_TYPES = [
  "matchStarted",
  "mounted",
  "dismounted",
  "liftBoarded",
  "liftExited",
  "shoveResolved",
  "theftDetected",
  "wantedChanged",
  "arrested",
  "captureStarted",
  "captureCancelled",
  "captureResolved",
  "robberEscaped",
  "matchEnded",
] as const satisfies readonly GameEventType[];

// Compile-time check that GAME_EVENT_TYPES lists every event type.
type AssertNever<T extends never> = T;
export type _AllGameEventTypesListed = AssertNever<Exclude<GameEventType, (typeof GAME_EVENT_TYPES)[number]>>;
