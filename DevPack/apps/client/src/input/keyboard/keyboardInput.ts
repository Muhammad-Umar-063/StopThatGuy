import { NEUTRAL_HELD_CONTROLS, type HeldControls } from "@stopthatguy/shared";
import { resolveKey } from "./bindings";
import { eventTargetOf, gameplayOwnsTarget, type OwnershipContext, type SurfaceLike } from "./focusPolicy";
import { createKeyboardIntentState, type ActionIdSource, type KeyboardIntentSample } from "./keyboardIntentState";

/**
 * Browser keyboard binding: listens on one window and feeds the keyboard intent state.
 *
 * Gameplay takes a bound key only while it is active, the key has no Ctrl/Alt/Meta modifier, no IME
 * composition is running, and focus is not in a text field or key-handling widget (and is inside the
 * optional gameplay surface). Only then is the browser default (e.g. arrow scrolling) prevented.
 * Releases are always processed, whatever the focus, so a key cannot stay held.
 *
 * All held controls and unsampled presses are released on window blur, hidden visibility, page hide,
 * focus moving to a non-gameplay target, deactivation, `releaseAll()` (disconnect, suspension) and
 * dispose. Only a fresh keydown holds a control again; key-repeat after focus returns does not.
 */

type Listener = (event: Event) => void;

interface ListenerTarget {
  addEventListener(type: string, listener: Listener, options?: boolean | AddEventListenerOptions): void;
  removeEventListener(type: string, listener: Listener, options?: boolean | EventListenerOptions): void;
}

export interface KeyboardDocument extends ListenerTarget {
  readonly visibilityState: string;
  readonly body: unknown;
  readonly documentElement: unknown;
}

export interface KeyboardWindow extends ListenerTarget {
  readonly document: KeyboardDocument;
}

interface KeyEventLike {
  readonly code?: string;
  readonly key?: string;
  readonly repeat?: boolean;
  readonly ctrlKey?: boolean;
  readonly altKey?: boolean;
  readonly metaKey?: boolean;
  readonly isComposing?: boolean;
  readonly keyCode?: number;
  readonly target?: unknown;
  composedPath?(): unknown[];
  preventDefault(): void;
}

/** Client-local intent; menus never need an authoritative mutation (docs/CONTRACTS.md "Commands"). */
export type KeyboardLocalIntent = { readonly type: "toggleMenu" };

export interface KeyboardInputOptions {
  /** Window that receives keyboard, focus and visibility events. */
  readonly window: KeyboardWindow;
  /** Session-scoped action ID source, shared with other input sources (see createActionIdSequence). */
  readonly nextActionId: ActionIdSource;
  /** Gameplay surface (e.g. the canvas or its container). When set, keys focused elsewhere are left to the page. */
  readonly surface?: SurfaceLike | null;
  /** Whether gameplay owns the keyboard initially. Default false: nothing is captured until activated. */
  readonly active?: boolean;
  /** Called after held controls change or a new edge action is queued; sample() to read it. */
  readonly onChange?: () => void;
  /** Escape pressed during gameplay. While a menu is open (gameplay inactive) the menu owns Escape. */
  readonly onLocalIntent?: (intent: KeyboardLocalIntent) => void;
}

export interface KeyboardInputController {
  readonly active: boolean;
  readonly disposed: boolean;
  /** Gameplay owns the keyboard while true. Setting false (menu open, match over) releases everything. */
  setGameplayActive(active: boolean): void;
  /** Explicit release for disconnect, input suspension or touch cancellation. */
  releaseAll(): void;
  /** Current held controls without consuming queued actions. */
  held(): HeldControls;
  /** Held controls plus the edge actions pressed since the previous sample (IDs assigned now). */
  sample(): KeyboardIntentSample;
  /** Removes every listener and releases everything. Safe to call more than once. */
  dispose(): void;
}

const META_CODES = new Set(["MetaLeft", "MetaRight", "OSLeft", "OSRight"]);

/** One live controller per window, so re-initialization cannot leave duplicate listeners behind. */
const liveControllers = new WeakMap<object, KeyboardInputController>();

export function attachKeyboardInput(options: KeyboardInputOptions): KeyboardInputController {
  const { window: win, onChange, onLocalIntent } = options;
  const doc = win.document;
  const state = createKeyboardIntentState(options.nextActionId);
  const surface = options.surface ?? null;
  let active = options.active ?? false;
  let disposed = false;

  const ownership = (): OwnershipContext => ({ surface, pageTargets: [win, doc, doc.body, doc.documentElement] });
  const notify = (changed: boolean) => {
    if (changed) onChange?.();
  };
  const release = () => notify(state.releaseAll());

  const onKeyDown: Listener = (event) => {
    const e = event as unknown as KeyEventLike;
    if (!active || e.isComposing === true || e.keyCode === 229) return;
    const resolved = resolveKey(e.code, e.key);
    if (!resolved || e.ctrlKey === true || e.altKey === true || e.metaKey === true) return;
    if (!gameplayOwnsTarget(eventTargetOf(e), ownership())) return;
    // Also for key-repeat: a held arrow must not scroll the page.
    e.preventDefault();
    const result = state.press(resolved.keyId, resolved.control, e.repeat === true);
    if (result === "menu") onLocalIntent?.({ type: "toggleMenu" });
    else notify(result === "held" || result === "action");
  };

  const onKeyUp: Listener = (event) => {
    const e = event as unknown as KeyEventLike;
    // macOS does not deliver keyup for keys released while Meta is down; release everything then.
    if (e.code !== undefined && META_CODES.has(e.code)) return release();
    const resolved = resolveKey(e.code, e.key);
    if (resolved) notify(state.release(resolved.keyId));
  };

  const onFocusIn: Listener = (event) => {
    if (!gameplayOwnsTarget(eventTargetOf(event as unknown as KeyEventLike), ownership())) release();
  };

  const onVisibilityChange: Listener = () => {
    if (doc.visibilityState !== "visible") release();
  };

  const listeners: [ListenerTarget, string, Listener, boolean][] = [
    // Bubble phase: a focused widget that stops propagation keeps its key.
    [win, "keydown", onKeyDown, false],
    // Capture phase: releases are seen even when a widget stops propagation.
    [win, "keyup", onKeyUp, true],
    [win, "focusin", onFocusIn, true],
    // Non-capture on window: only the window's own blur, not element blurs.
    [win, "blur", release, false],
    [win, "pagehide", release, false],
    [doc, "visibilitychange", onVisibilityChange, false],
  ];

  const controller: KeyboardInputController = {
    get active() {
      return active;
    },
    get disposed() {
      return disposed;
    },
    setGameplayActive(next) {
      if (disposed) return;
      if (!next) release();
      active = next;
    },
    releaseAll() {
      if (!disposed) release();
    },
    held() {
      return disposed ? { ...NEUTRAL_HELD_CONTROLS } : state.held();
    },
    sample() {
      return disposed ? { held: { ...NEUTRAL_HELD_CONTROLS }, actions: [] } : state.takeSample();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      active = false;
      for (const [target, type, listener, capture] of listeners) target.removeEventListener(type, listener, capture);
      state.releaseAll();
      if (liveControllers.get(win) === controller) liveControllers.delete(win);
    },
  };

  liveControllers.get(win)?.dispose();
  for (const [target, type, listener, capture] of listeners) target.addEventListener(type, listener, capture);
  liveControllers.set(win, controller);
  return controller;
}
