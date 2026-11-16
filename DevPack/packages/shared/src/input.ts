import type { ActionId } from "./ids.js";

/** Edge-triggered actions. Targets are chosen by the server from context; clients never name a target. */
export const EDGE_ACTION_KINDS = ["left", "right", "interact", "capture", "sabotage"] as const;
export type EdgeActionKind = (typeof EDGE_ACTION_KINDS)[number];

export interface EdgeAction {
  /** Strictly increasing per player session. Resend with the same ID until acknowledged; the server applies it once. */
  id: ActionId;
  kind: EdgeActionKind;
}

/**
 * One client input sample, sent up to `timing.maxInputSendHz` on change or heartbeat.
 * It carries intent only: no position, velocity, vehicle ownership, hit, reward or winner.
 * Acknowledgement: PlayerRecord.lastProcessedInputSequence / lastProcessedActionId.
 */
export interface InputFrame {
  /** Strictly increasing per session (uint32). Restarts after a successful resume handshake. */
  sequence: number;
  forwardHeld: boolean;
  /** Wins over forwardHeld when both are held. */
  brakeHeld: boolean;
  sprintHeld: boolean;
  /** Held interact, e.g. shop theft progress. A press is also sent as an "interact" edge action. */
  interactHeld: boolean;
  /** Unacknowledged edge actions in ascending ID order, at most PROTOCOL_LIMITS.maxActionsPerInputFrame. */
  actions: EdgeAction[];
  /** Diagnostic only; never used to decide outcomes. Null when not sent. */
  clientTimeMs: number | null;
}

export interface HeldControls {
  forwardHeld: boolean;
  brakeHeld: boolean;
  sprintHeld: boolean;
  interactHeld: boolean;
}

/** Applied on focus loss, touch cancel, disconnect and input timeout. */
export const NEUTRAL_HELD_CONTROLS: Readonly<HeldControls> = Object.freeze({
  forwardHeld: false,
  brakeHeld: false,
  sprintHeld: false,
  interactHeld: false,
});
