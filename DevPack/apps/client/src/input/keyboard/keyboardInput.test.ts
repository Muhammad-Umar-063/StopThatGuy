/// <reference types="node" />
// Run: npx tsx --conditions=stopthatguy-source --test apps/client/src/input/keyboard/*.test.ts
// DOM-free doubles exercise the binding's rules; keyboard/browser/ verifies the same behavior in Chrome.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { attachKeyboardInput, type KeyboardInputOptions, type KeyboardLocalIntent } from "./keyboardInput";
import { createActionIdSequence } from "./keyboardIntentState";

type Listener = (event: Event) => void;

interface FakeEvent {
  readonly type: string;
  readonly target: unknown;
  defaultPrevented: boolean;
  preventDefault(): void;
  [key: string]: unknown;
}

class FakeTarget {
  readonly registered: { type: string; listener: Listener; capture: boolean }[] = [];

  addEventListener(type: string, listener: Listener, options?: boolean | AddEventListenerOptions): void {
    const capture = typeof options === "boolean" ? options : options?.capture === true;
    // Same rule as the DOM: an identical (type, listener, capture) registration is ignored.
    if (!this.registered.some((r) => r.type === type && r.listener === listener && r.capture === capture)) {
      this.registered.push({ type, listener, capture });
    }
  }

  removeEventListener(type: string, listener: Listener, options?: boolean | EventListenerOptions): void {
    const capture = typeof options === "boolean" ? options : options?.capture === true;
    const index = this.registered.findIndex((r) => r.type === type && r.listener === listener && r.capture === capture);
    if (index >= 0) this.registered.splice(index, 1);
  }

  /** Dispatches to this target's listeners, capture listeners first. `target` defaults to this object. */
  fire(type: string, init: Record<string, unknown> = {}): FakeEvent {
    const event: FakeEvent = {
      target: this,
      ...init,
      type,
      defaultPrevented: false,
      preventDefault() {
        event.defaultPrevented = true;
      },
    };
    const matching = this.registered.filter((r) => r.type === type);
    for (const r of [...matching.filter((m) => m.capture), ...matching.filter((m) => !m.capture)]) r.listener(event as unknown as Event);
    return event;
  }
}

class FakeDocument extends FakeTarget {
  visibilityState = "visible";
  readonly body = { tagName: "BODY" };
  readonly documentElement = { tagName: "HTML" };
}

class FakeWindow extends FakeTarget {
  readonly document = new FakeDocument();
}

const element = (tagName: string, extra: Record<string, unknown> = {}) => ({ tagName, ...extra });
const withRole = (role: string) => element("DIV", { getAttribute: (name: string) => (name === "role" ? role : null) });

function setup(options: Partial<Omit<KeyboardInputOptions, "window">> & { window?: FakeWindow } = {}) {
  const win = options.window ?? new FakeWindow();
  const changes: number[] = [];
  const intents: KeyboardLocalIntent[] = [];
  const controller = attachKeyboardInput({
    nextActionId: createActionIdSequence(),
    active: true,
    onChange: () => changes.push(1),
    onLocalIntent: (intent) => intents.push(intent),
    ...options,
    window: win,
  });
  const keydown = (code: string, init: Record<string, unknown> = {}) => win.fire("keydown", { code, key: "", repeat: false, target: win.document.body, ...init });
  const keyup = (code: string, init: Record<string, unknown> = {}) => win.fire("keyup", { code, key: "", target: win.document.body, ...init });
  const kinds = () => controller.sample().actions.map((action) => action.kind);
  return { win, doc: win.document, controller, changes, intents, keydown, keyup, kinds };
}

const NEUTRAL = { forwardHeld: false, brakeHeld: false, sprintHeld: false, interactHeld: false };

describe("gameplay ownership and scrolling", () => {
  test("inactive by default: arrows keep their browser default and nothing is held", () => {
    const win = new FakeWindow();
    const controller = attachKeyboardInput({ window: win, nextActionId: createActionIdSequence() });
    const event = win.fire("keydown", { code: "ArrowDown", key: "ArrowDown", target: win.document.body });
    assert.equal(event.defaultPrevented, false);
    assert.equal(controller.active, false);
    assert.deepEqual(controller.held(), NEUTRAL);
    controller.setGameplayActive(true);
    assert.equal(win.fire("keydown", { code: "ArrowDown", target: win.document.body }).defaultPrevented, true);
    assert.equal(controller.held().brakeHeld, true);
    controller.dispose();
  });

  test("bound keys are prevented, including key-repeat, while gameplay owns them; unbound keys never are", () => {
    const { keydown, controller } = setup();
    for (const code of ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "ShiftLeft", "KeyE", "KeyF", "KeyX", "Escape"]) {
      assert.equal(keydown(code).defaultPrevented, true, code);
      assert.equal(keydown(code, { repeat: true }).defaultPrevented, true, `${code} repeat`);
    }
    for (const code of ["Tab", "Enter", "Space", "KeyA", "PageDown", "F5"]) assert.equal(keydown(code).defaultPrevented, false, code);
    controller.dispose();
  });

  test("text fields, editable content and key-handling widgets keep their keys", () => {
    const { keydown, controller, intents } = setup();
    const targets = [
      element("INPUT"),
      element("input"),
      element("TEXTAREA"),
      element("SELECT"),
      element("DIV", { isContentEditable: true }),
      withRole("listbox"),
      withRole("menuitem"),
      withRole("slider"),
      withRole("dialog"),
    ];
    for (const target of targets) {
      for (const code of ["ArrowUp", "ArrowLeft", "KeyE", "KeyF", "KeyX", "ShiftLeft", "Escape"]) {
        assert.equal(keydown(code, { target }).defaultPrevented, false, `${JSON.stringify(target)} ${code}`);
      }
    }
    assert.deepEqual(controller.sample(), { held: NEUTRAL, actions: [] });
    assert.deepEqual(intents, []);
    controller.dispose();
  });

  test("the innermost composed-path target decides (shadow DOM text field)", () => {
    const { keydown, controller } = setup();
    const host = element("GAME-HUD");
    const inner = element("INPUT");
    assert.equal(keydown("ArrowUp", { target: host, composedPath: () => [inner, host] }).defaultPrevented, false);
    assert.equal(controller.held().forwardHeld, false);
    controller.dispose();
  });

  test("with a surface, gameplay owns the surface, its children and the page, not other controls", () => {
    const child = element("SPAN");
    const surface = { tagName: "CANVAS", contains: (other: unknown) => other === child };
    const { keydown, win, doc, controller } = setup({ surface });
    for (const target of [surface, child, doc.body, doc.documentElement, doc, win]) {
      assert.equal(keydown("ArrowDown", { target }).defaultPrevented, true);
    }
    assert.equal(keydown("ArrowDown", { target: element("BUTTON") }).defaultPrevented, false, "menu button outside the surface");
    controller.dispose();
  });

  test("Ctrl/Alt/Meta combinations stay with the browser", () => {
    const { keydown, controller } = setup();
    for (const modifier of ["ctrlKey", "altKey", "metaKey"]) {
      assert.equal(keydown("ArrowLeft", { [modifier]: true }).defaultPrevented, false, modifier);
      assert.equal(keydown("KeyF", { [modifier]: true }).defaultPrevented, false, modifier);
    }
    assert.deepEqual(controller.sample().actions, []);
    controller.dispose();
  });

  test("Shift is sprint, not a blocked modifier", () => {
    const { keydown, controller } = setup();
    keydown("ShiftLeft", { shiftKey: true });
    assert.equal(keydown("ArrowUp", { shiftKey: true }).defaultPrevented, true);
    assert.equal(keydown("KeyE", { shiftKey: true, key: "E" }).defaultPrevented, true);
    assert.deepEqual(controller.sample(), {
      held: { forwardHeld: true, brakeHeld: false, sprintHeld: true, interactHeld: true },
      actions: [{ id: 1, kind: "interact" }],
    });
    controller.dispose();
  });

  test("IME composition events are ignored", () => {
    const { keydown, controller } = setup();
    assert.equal(keydown("KeyE", { isComposing: true }).defaultPrevented, false);
    assert.equal(keydown("ArrowLeft", { keyCode: 229 }).defaultPrevented, false);
    assert.deepEqual(controller.sample().actions, []);
    controller.dispose();
  });
});

describe("held and edge actions through events", () => {
  test("key-repeat produces one lane request; release and repress produces another", () => {
    const { keydown, keyup, kinds, controller } = setup();
    keydown("ArrowRight");
    for (let i = 0; i < 15; i++) keydown("ArrowRight", { repeat: true });
    assert.deepEqual(kinds(), ["right"]);
    keydown("ArrowRight", { repeat: true });
    assert.deepEqual(kinds(), []);
    keyup("ArrowRight");
    keydown("ArrowRight");
    assert.deepEqual(kinds(), ["right"]);
    controller.dispose();
  });

  test("onChange fires for held changes and new actions, not for repeats or no-op releases", () => {
    const { keydown, keyup, changes, controller } = setup();
    keydown("ArrowUp");
    keydown("ArrowUp", { repeat: true });
    keydown("ArrowLeft");
    keydown("ArrowLeft", { repeat: true });
    keyup("ArrowLeft");
    keyup("ArrowUp");
    keyup("ArrowUp");
    assert.equal(changes.length, 3);
    controller.dispose();
  });

  test("Escape emits one local menu intent per press and is never an edge action", () => {
    const { keydown, keyup, intents, controller } = setup();
    keydown("Escape");
    keydown("Escape", { repeat: true });
    keyup("Escape");
    keydown("", { key: "Escape" });
    assert.deepEqual(intents, [{ type: "toggleMenu" }, { type: "toggleMenu" }]);
    assert.deepEqual(controller.sample().actions, []);
    controller.setGameplayActive(false);
    keydown("Escape");
    assert.equal(intents.length, 2, "while inactive the menu owns Escape");
    controller.dispose();
  });

  test("releases are processed whatever the focus target", () => {
    const { keydown, keyup, controller } = setup();
    keydown("ArrowUp");
    keyup("ArrowUp", { target: element("INPUT") });
    assert.equal(controller.held().forwardHeld, false);
    controller.dispose();
  });
});

describe("release on focus loss, suspension and disconnect", () => {
  const holdEverything = (keydown: (code: string, init?: Record<string, unknown>) => unknown) => {
    for (const code of ["ArrowUp", "ArrowDown", "ShiftLeft", "KeyE", "ArrowLeft"]) keydown(code);
  };

  const cases: [string, (ctx: ReturnType<typeof setup>) => void][] = [
    ["window blur", ({ win }) => win.fire("blur")],
    ["hidden visibility", ({ doc }) => {
      doc.visibilityState = "hidden";
      doc.fire("visibilitychange");
    }],
    ["page hide", ({ win }) => win.fire("pagehide")],
    ["focus moving to a text field", ({ win }) => win.fire("focusin", { target: element("INPUT") })],
    ["explicit releaseAll (disconnect)", ({ controller }) => controller.releaseAll()],
    ["deactivation (input suspension / menu)", ({ controller }) => controller.setGameplayActive(false)],
    ["Meta keyup (macOS drops other keyups while Meta is down)", ({ keyup }) => keyup("MetaLeft")],
  ];

  for (const [name, trigger] of cases) {
    test(`${name} releases held controls, discards unsent presses and is not undone by focus return`, () => {
      const ctx = setup();
      holdEverything(ctx.keydown);
      ctx.changes.length = 0;
      trigger(ctx);
      assert.deepEqual(ctx.controller.sample(), { held: NEUTRAL, actions: [] });
      assert.equal(ctx.changes.length, 1, "consumers are told to send the neutral state");
      // Focus returns while keys are still physically down: the browser sends key-repeat only.
      ctx.doc.visibilityState = "visible";
      ctx.doc.fire("visibilitychange");
      ctx.win.fire("focus");
      ctx.controller.setGameplayActive(true);
      for (const code of ["ArrowUp", "ArrowDown", "ShiftLeft", "KeyE", "ArrowLeft"]) ctx.keydown(code, { repeat: true });
      assert.deepEqual(ctx.controller.sample(), { held: NEUTRAL, actions: [] });
      // A fresh press works again.
      ctx.keydown("ArrowUp");
      assert.equal(ctx.controller.held().forwardHeld, true);
      ctx.controller.dispose();
    });
  }

  test("visible visibility changes and focus moving inside gameplay do not release", () => {
    const child = element("SPAN");
    const surface = { tagName: "CANVAS", contains: (other: unknown) => other === child };
    const { keydown, win, doc, controller } = setup({ surface });
    keydown("ArrowUp");
    doc.fire("visibilitychange");
    win.fire("focusin", { target: child });
    win.fire("focusin", { target: surface });
    assert.equal(controller.held().forwardHeld, true);
    win.fire("focusin", { target: element("BUTTON") });
    assert.equal(controller.held().forwardHeld, false, "focus moved to a control outside the surface");
    controller.dispose();
  });
});

describe("teardown and re-initialization", () => {
  const listenerCount = (win: FakeWindow) => win.registered.length + win.document.registered.length;

  test("dispose removes every listener, is idempotent, and leaves a neutral inert controller", () => {
    const { win, keydown, controller, changes, intents } = setup();
    assert.ok(listenerCount(win) > 0);
    keydown("ArrowUp");
    keydown("KeyF");
    controller.dispose();
    controller.dispose();
    assert.equal(listenerCount(win), 0);
    assert.equal(controller.disposed, true);
    assert.equal(controller.active, false);
    changes.length = 0;
    assert.equal(keydown("ArrowDown").defaultPrevented, false);
    keydown("Escape");
    controller.setGameplayActive(true);
    controller.releaseAll();
    assert.equal(controller.active, false);
    assert.deepEqual(controller.sample(), { held: NEUTRAL, actions: [] });
    assert.deepEqual([changes.length, intents.length], [0, 0]);
  });

  test("attaching again to the same window replaces the old controller: no duplicate listeners or actions", () => {
    const win = new FakeWindow();
    const sequence = createActionIdSequence();
    const first = setup({ window: win, nextActionId: sequence });
    const single = listenerCount(win);
    first.keydown("ArrowUp");
    const second = setup({ window: win, nextActionId: sequence });
    assert.equal(listenerCount(win), single, "listener count unchanged after re-initialization");
    assert.equal(first.controller.disposed, true);
    assert.deepEqual(second.controller.held(), NEUTRAL, "held keys are not carried into the new controller");
    second.keydown("KeyF");
    assert.deepEqual(first.controller.sample().actions, []);
    assert.deepEqual(second.controller.sample().actions, [{ id: 1, kind: "capture" }]);
    first.controller.dispose();
    assert.equal(listenerCount(win), single, "disposing the replaced controller does not detach the live one");
    second.controller.dispose();
    assert.equal(listenerCount(win), 0);
  });

  test("a re-initialized controller continues the session's action IDs", () => {
    const win = new FakeWindow();
    const sequence = createActionIdSequence();
    const first = setup({ window: win, nextActionId: sequence });
    first.keydown("KeyF");
    assert.deepEqual(first.controller.sample().actions, [{ id: 1, kind: "capture" }]);
    first.controller.dispose();
    const second = setup({ window: win, nextActionId: sequence });
    second.keydown("KeyX");
    assert.deepEqual(second.controller.sample().actions, [{ id: 2, kind: "sabotage" }]);
    second.controller.dispose();
  });

  test("controllers on different windows are independent", () => {
    const a = setup();
    const b = setup();
    a.keydown("ArrowUp");
    assert.equal(a.controller.disposed, false);
    assert.equal(b.controller.held().forwardHeld, false);
    a.controller.dispose();
    b.controller.dispose();
  });
});
