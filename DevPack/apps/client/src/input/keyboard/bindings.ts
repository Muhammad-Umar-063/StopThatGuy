import type { EdgeActionKind, HeldControls } from "@stopthatguy/shared";

/**
 * Desktop keyboard bindings (docs/CONTROLS.md "Desktop bindings", DECISIONS D012/D013).
 *
 * Keys are matched by `KeyboardEvent.code`, the physical key, so bindings keep working while Shift is
 * held and with non-Latin layouts. Letter positions follow US QWERTY labels (E, F, X). `key` is used
 * only when a browser reports no usable `code`.
 */

export type HeldField = keyof HeldControls;

/** What a bound key does. Edge kinds are the shared `EdgeActionKind` names; Escape is local only. */
export type KeyboardControl =
  | { readonly type: "held"; readonly field: Exclude<HeldField, "interactHeld"> }
  /** E: a press queues an "interact" edge action and the key also drives `interactHeld`. */
  | { readonly type: "heldEdge"; readonly field: "interactHeld"; readonly action: "interact" }
  | { readonly type: "edge"; readonly action: Exclude<EdgeActionKind, "interact"> }
  /** Escape: local menu intent; never sent to the server. */
  | { readonly type: "localMenu" };

const held = (field: Exclude<HeldField, "interactHeld">): KeyboardControl => Object.freeze({ type: "held", field });
const edge = (action: Exclude<EdgeActionKind, "interact">): KeyboardControl => Object.freeze({ type: "edge", action });
const INTERACT: KeyboardControl = Object.freeze({ type: "heldEdge", field: "interactHeld", action: "interact" });
const MENU: KeyboardControl = Object.freeze({ type: "localMenu" });

/** `KeyboardEvent.code` → control. */
export const KEY_CODE_BINDINGS: Readonly<Record<string, KeyboardControl>> = Object.freeze({
  ArrowUp: held("forwardHeld"),
  ArrowDown: held("brakeHeld"),
  ShiftLeft: held("sprintHeld"),
  ShiftRight: held("sprintHeld"),
  ArrowLeft: edge("left"),
  ArrowRight: edge("right"),
  KeyE: INTERACT,
  KeyF: edge("capture"),
  KeyX: edge("sabotage"),
  Escape: MENU,
});

/** Fallback by `KeyboardEvent.key` (lower-cased) for events whose `code` is empty or "Unidentified". */
const KEY_VALUE_BINDINGS: Readonly<Record<string, KeyboardControl>> = Object.freeze({
  arrowup: held("forwardHeld"),
  arrowdown: held("brakeHeld"),
  shift: held("sprintHeld"),
  arrowleft: edge("left"),
  arrowright: edge("right"),
  e: INTERACT,
  f: edge("capture"),
  x: edge("sabotage"),
  escape: MENU,
  esc: MENU,
});

export interface ResolvedKey {
  /** Stable identity of the physical key, used to pair keydown with keyup. */
  readonly keyId: string;
  readonly control: KeyboardControl;
}

export function resolveKey(code: string | undefined, key: string | undefined): ResolvedKey | null {
  if (code && code !== "Unidentified") {
    const control = Object.hasOwn(KEY_CODE_BINDINGS, code) ? KEY_CODE_BINDINGS[code] : undefined;
    return control ? { keyId: code, control } : null;
  }
  const value = key?.toLowerCase();
  if (!value) return null;
  const control = Object.hasOwn(KEY_VALUE_BINDINGS, value) ? KEY_VALUE_BINDINGS[value] : undefined;
  return control ? { keyId: `key:${value}`, control } : null;
}
