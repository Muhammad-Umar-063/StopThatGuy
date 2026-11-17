import {
  NEUTRAL_HELD_CONTROLS,
  PROTOCOL_LIMITS,
  type ActionId,
  type EdgeAction,
  type EdgeActionKind,
  type HeldControls,
} from "@stopthatguy/shared";
import type { KeyboardControl } from "./bindings";

/**
 * DOM-free keyboard intent state. It turns physical key presses and releases into the shared input
 * intent format: current `HeldControls` plus newly pressed `EdgeAction`s.
 *
 * Rules (docs/CONTROLS.md):
 * - A held control is true only between a fresh (non-repeat) keydown and its keyup or a release.
 *   Key-repeat never sets a control, so returning to the page does not restore a held action.
 * - An edge action is queued once per fresh press; key-repeat and a second keydown without a keyup
 *   are ignored. Another left/right request needs release and a new press.
 * - ArrowUp and ArrowDown are reported as held exactly as pressed. `brakeHeld` wins when both are
 *   held; the simulation applies that precedence (shared `InputFrame.brakeHeld`).
 * - Left and right pressed within the same input sample are simultaneous and cancel each other:
 *   neither is sent. A press of one side while the other key is still held from an earlier sample is
 *   a new request (key rollover), not a cancel.
 * - Turn/lane eligibility, buffering and "ignore during an active turn" belong to movement rules.
 *
 * Action IDs are assigned when a sample is taken, in press order, from a session-scoped source, so
 * cancelled presses consume no IDs and keyboard and touch can share one strictly increasing sequence.
 */

export type PressResult =
  /** Key-repeat, a duplicate keydown, or a second key for an already held control: nothing changed. */
  | "unchanged"
  /** A held control changed. */
  | "held"
  /** An edge action was queued (for E, `interactHeld` also became true). */
  | "action"
  /** More than PROTOCOL_LIMITS.maxActionsPerInputFrame presses are waiting; this one was dropped. */
  | "dropped"
  /** Escape: emit the local menu intent. */
  | "menu";

export interface KeyboardIntentSample {
  readonly held: HeldControls;
  /** New edge actions since the previous sample, ascending unique IDs. */
  readonly actions: readonly EdgeAction[];
}

export interface KeyboardIntentState {
  press(keyId: string, control: KeyboardControl, repeat: boolean): PressResult;
  /** Returns true when a held control changed. Unknown keys are ignored. */
  release(keyId: string): boolean;
  /** Clears every held key and discards presses not yet sampled. Returns true when anything was cleared. */
  releaseAll(): boolean;
  held(): HeldControls;
  /** Returns held controls and the queued actions with IDs, then clears the queue. */
  takeSample(): KeyboardIntentSample;
}

export type ActionIdSource = () => ActionId;

export function createKeyboardIntentState(nextActionId: ActionIdSource): KeyboardIntentState {
  /** Physical keys currently down → their control. */
  const down = new Map<string, KeyboardControl>();
  const pending: EdgeActionKind[] = [];
  let lastActionId = 0;

  const heldNow = (): HeldControls => {
    const result: HeldControls = { ...NEUTRAL_HELD_CONTROLS };
    for (const control of down.values()) {
      if (control.type === "held" || control.type === "heldEdge") result[control.field] = true;
    }
    return result;
  };

  const sameHeld = (a: HeldControls, b: HeldControls) =>
    a.forwardHeld === b.forwardHeld && a.brakeHeld === b.brakeHeld && a.sprintHeld === b.sprintHeld && a.interactHeld === b.interactHeld;

  const allocate = (): ActionId => {
    const id = nextActionId();
    if (!Number.isInteger(id) || id < 1 || id > PROTOCOL_LIMITS.maxUint32 || id <= lastActionId) {
      throw new RangeError(`action ID source returned ${String(id)} after ${lastActionId}; IDs must be uint32, ≥ 1 and strictly increasing`);
    }
    lastActionId = id;
    return id;
  };

  return {
    press(keyId, control, repeat) {
      if (repeat || down.has(keyId)) return "unchanged";
      const before = heldNow();
      down.set(keyId, control);
      switch (control.type) {
        case "localMenu":
          return "menu";
        case "held":
          return sameHeld(before, heldNow()) ? "unchanged" : "held";
        case "edge":
        case "heldEdge":
          if (pending.length >= PROTOCOL_LIMITS.maxActionsPerInputFrame) {
            return sameHeld(before, heldNow()) ? "dropped" : "held";
          }
          pending.push(control.action);
          return "action";
      }
    },

    release(keyId) {
      const control = down.get(keyId);
      if (!control) return false;
      const before = heldNow();
      down.delete(keyId);
      return !sameHeld(before, heldNow());
    },

    releaseAll() {
      const changed = !sameHeld(heldNow(), NEUTRAL_HELD_CONTROLS) || pending.length > 0;
      down.clear();
      pending.length = 0;
      return changed;
    },

    held: heldNow,

    takeSample() {
      const simultaneousTurn = pending.includes("left") && pending.includes("right");
      const kinds = simultaneousTurn ? pending.filter((kind) => kind !== "left" && kind !== "right") : [...pending];
      pending.length = 0;
      return { held: heldNow(), actions: kinds.map((kind) => ({ id: allocate(), kind })) };
    },
  };
}

/**
 * A strictly increasing uint32 action ID sequence starting after `lastUsed`. Create one per player
 * session and share it between input sources; recreating keyboard input must not restart it, because
 * the server ignores IDs at or below the last one it processed.
 */
export function createActionIdSequence(lastUsed = 0): ActionIdSource {
  if (!Number.isInteger(lastUsed) || lastUsed < 0 || lastUsed > PROTOCOL_LIMITS.maxUint32) {
    throw new RangeError("lastUsed must be a uint32");
  }
  let last = lastUsed;
  return () => {
    if (last >= PROTOCOL_LIMITS.maxUint32) throw new RangeError("action ID sequence exhausted");
    last += 1;
    return last;
  };
}
