/// <reference types="node" />
// Run: npx tsx --conditions=stopthatguy-source --test apps/client/src/input/keyboard/*.test.ts
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { PROTOCOL_LIMITS, parseClientCommand, type InputFrame } from "@stopthatguy/shared";
import { resolveKey } from "./bindings";
import { createActionIdSequence, createKeyboardIntentState, type KeyboardIntentState } from "./keyboardIntentState";

function setup(nextActionId = createActionIdSequence()) {
  const state = createKeyboardIntentState(nextActionId);
  const control = (code: string) => {
    const resolved = resolveKey(code, "");
    assert.ok(resolved, `no binding for ${code}`);
    return resolved.control;
  };
  return {
    state,
    down: (code: string, repeat = false) => state.press(code, control(code), repeat),
    up: (code: string) => state.release(code),
  };
}

const kinds = (state: KeyboardIntentState) => state.takeSample().actions.map((action) => action.kind);

describe("bindings", () => {
  test("map CONTROLS.md defaults onto shared held fields and edge action kinds", () => {
    const expected: Record<string, unknown> = {
      ArrowUp: { type: "held", field: "forwardHeld" },
      ArrowDown: { type: "held", field: "brakeHeld" },
      ShiftLeft: { type: "held", field: "sprintHeld" },
      ShiftRight: { type: "held", field: "sprintHeld" },
      ArrowLeft: { type: "edge", action: "left" },
      ArrowRight: { type: "edge", action: "right" },
      KeyE: { type: "heldEdge", field: "interactHeld", action: "interact" },
      KeyF: { type: "edge", action: "capture" },
      KeyX: { type: "edge", action: "sabotage" },
      Escape: { type: "localMenu" },
    };
    for (const [code, control] of Object.entries(expected)) assert.deepEqual(resolveKey(code, "")?.control, control, code);
  });

  test("match the physical key, fall back to key only without a usable code, and ignore unbound keys", () => {
    assert.equal(resolveKey("KeyE", "E")?.keyId, "KeyE", "Shift+E still interacts");
    assert.equal(resolveKey("KeyE", "у")?.control.type, "heldEdge", "non-Latin layout");
    assert.equal(resolveKey("", "E")?.keyId, "key:e");
    assert.equal(resolveKey("Unidentified", "ArrowUp")?.keyId, "key:arrowup");
    for (const code of ["KeyW", "KeyA", "Space", "Enter", "Tab", "toString", "__proto__"]) assert.equal(resolveKey(code, ""), null, code);
    assert.equal(resolveKey("", "constructor"), null);
  });
});

describe("held controls", () => {
  test("ArrowUp/ArrowDown/Shift hold while down and report both Up and Down when both are held", () => {
    const { state, down, up } = setup();
    assert.equal(down("ArrowUp"), "held");
    assert.equal(down("ArrowDown"), "held");
    assert.equal(down("ShiftLeft"), "held");
    assert.deepEqual(state.held(), { forwardHeld: true, brakeHeld: true, sprintHeld: true, interactHeld: false });
    assert.equal(up("ArrowDown"), true);
    assert.deepEqual(state.held(), { forwardHeld: true, brakeHeld: false, sprintHeld: true, interactHeld: false }, "releasing brake resumes forward");
    assert.deepEqual(state.takeSample().actions, [], "held keys queue no actions");
  });

  test("sprint stays held until both Shift keys are released", () => {
    const { state, down, up } = setup();
    down("ShiftLeft");
    assert.equal(down("ShiftRight"), "unchanged");
    assert.equal(up("ShiftLeft"), false);
    assert.equal(state.held().sprintHeld, true);
    assert.equal(up("ShiftRight"), true);
    assert.equal(state.held().sprintHeld, false);
  });

  test("key-repeat never sets a held control, so focus return cannot restore one", () => {
    const { state, down } = setup();
    assert.equal(down("ArrowUp", true), "unchanged");
    assert.equal(state.held().forwardHeld, false);
    assert.equal(down("ArrowUp"), "held", "a fresh press holds again");
  });

  test("unknown and repeated releases are harmless", () => {
    const { state, up } = setup();
    assert.equal(up("ArrowUp"), false);
    assert.equal(up("KeyQ"), false);
    assert.equal(state.held().forwardHeld, false);
  });
});

describe("edge actions", () => {
  test("left/right: one request per press; key-repeat and duplicate keydowns add none; release and repress adds one", () => {
    const { state, down, up } = setup();
    assert.equal(down("ArrowLeft"), "action");
    for (let i = 0; i < 20; i++) assert.equal(down("ArrowLeft", true), "unchanged");
    assert.equal(down("ArrowLeft"), "unchanged", "keydown without keyup (missing repeat flag) is not a new press");
    assert.deepEqual(state.takeSample().actions, [{ id: 1, kind: "left" }]);
    assert.deepEqual(state.takeSample().actions, [], "holding does not cascade");
    up("ArrowLeft");
    down("ArrowLeft");
    assert.deepEqual(state.takeSample().actions, [{ id: 2, kind: "left" }]);
  });

  test("E queues one interact edge per press and drives interactHeld while held", () => {
    const { state, down, up } = setup();
    assert.equal(down("KeyE"), "action");
    down("KeyE", true);
    down("KeyE", true);
    assert.deepEqual(state.takeSample(), {
      held: { forwardHeld: false, brakeHeld: false, sprintHeld: false, interactHeld: true },
      actions: [{ id: 1, kind: "interact" }],
    });
    assert.deepEqual(state.takeSample().actions, [], "holding E (shop theft) does not repeat the press");
    assert.equal(state.held().interactHeld, true);
    assert.equal(up("KeyE"), true);
    assert.equal(state.held().interactHeld, false);
    down("KeyE");
    assert.deepEqual(state.takeSample().actions, [{ id: 2, kind: "interact" }]);
  });

  test("F captures, X sabotages (shove/kick), Escape is local only", () => {
    const { state, down } = setup();
    down("KeyF");
    down("KeyX");
    assert.equal(down("Escape"), "menu");
    assert.equal(down("Escape", true), "unchanged");
    assert.deepEqual(state.takeSample().actions, [
      { id: 1, kind: "capture" },
      { id: 2, kind: "sabotage" },
    ]);
  });

  test("left and right in the same sample cancel without consuming IDs; other actions remain", () => {
    const { state, down } = setup();
    down("ArrowLeft");
    down("KeyF");
    down("ArrowRight");
    assert.deepEqual(state.takeSample().actions, [{ id: 1, kind: "capture" }]);
  });

  test("a side pressed while the other is held from an earlier sample is a new request (key rollover)", () => {
    const { state, down, up } = setup();
    down("ArrowRight");
    assert.deepEqual(kinds(state), ["right"]);
    down("ArrowLeft");
    up("ArrowRight");
    assert.deepEqual(kinds(state), ["left"]);
  });

  test("IDs follow press order across kinds and stay ascending across samples", () => {
    const { state, down, up } = setup(createActionIdSequence(41));
    down("KeyX");
    down("ArrowRight");
    down("KeyE");
    assert.deepEqual(state.takeSample().actions, [
      { id: 42, kind: "sabotage" },
      { id: 43, kind: "right" },
      { id: 44, kind: "interact" },
    ]);
    up("ArrowRight");
    down("ArrowRight");
    assert.deepEqual(state.takeSample().actions, [{ id: 45, kind: "right" }]);
  });

  test("two input sources sharing one session sequence produce strictly increasing IDs", () => {
    const sequence = createActionIdSequence();
    const a = setup(sequence);
    const b = setup(sequence);
    a.down("KeyF");
    b.down("KeyX");
    const first = a.state.takeSample().actions;
    const second = b.state.takeSample().actions;
    assert.deepEqual([...first, ...second].map((action) => action.id), [1, 2]);
  });

  test("more presses than one frame may carry are dropped, not queued without bound", () => {
    const { state, down, up } = setup();
    const max = PROTOCOL_LIMITS.maxActionsPerInputFrame;
    for (let i = 0; i < max; i++) {
      assert.equal(down("KeyF"), "action");
      up("KeyF");
    }
    assert.equal(down("KeyF"), "dropped");
    up("KeyF");
    assert.equal(down("KeyE"), "held", "E still holds interact when its press is dropped");
    const sample = state.takeSample();
    assert.equal(sample.actions.length, max);
    assert.equal(sample.held.interactHeld, true);
  });

  test("an ID source that breaks the contract is rejected", () => {
    for (const ids of [[0], [1.5], [PROTOCOL_LIMITS.maxUint32 + 1], [3, 3], [5, 4], [Number.NaN]]) {
      const queue = [...ids];
      const { state, down, up } = setup(() => queue.shift() ?? 99);
      assert.throws(() => {
        for (let i = 0; i < ids.length; i++) {
          down("KeyF");
          up("KeyF");
          state.takeSample();
        }
      }, RangeError, JSON.stringify(ids));
    }
  });
});

describe("release", () => {
  test("releaseAll clears held controls and unsampled presses, and reports whether anything changed", () => {
    const { state, down } = setup();
    assert.equal(state.releaseAll(), false);
    down("ArrowUp");
    down("ShiftLeft");
    down("KeyE");
    down("ArrowLeft");
    assert.equal(state.releaseAll(), true);
    assert.deepEqual(state.takeSample(), {
      held: { forwardHeld: false, brakeHeld: false, sprintHeld: false, interactHeld: false },
      actions: [],
    });
  });

  test("after releaseAll, repeats of still-down keys do nothing and a fresh press works again", () => {
    const { state, down } = setup();
    down("ArrowUp");
    down("ArrowLeft");
    state.releaseAll();
    down("ArrowUp", true);
    down("ArrowLeft", true);
    assert.deepEqual(state.takeSample().actions, []);
    assert.equal(state.held().forwardHeld, false);
    down("ArrowLeft");
    assert.deepEqual(state.takeSample().actions, [{ id: 1, kind: "left" }]);
  });
});

describe("action ID sequence", () => {
  test("continues after the last used ID and stops at the uint32 limit", () => {
    const next = createActionIdSequence(7);
    assert.deepEqual([next(), next()], [8, 9]);
    const last = createActionIdSequence(PROTOCOL_LIMITS.maxUint32 - 1);
    assert.equal(last(), PROTOCOL_LIMITS.maxUint32);
    assert.throws(() => last(), RangeError);
    for (const bad of [-1, 1.5, PROTOCOL_LIMITS.maxUint32 + 1, Number.NaN]) assert.throws(() => createActionIdSequence(bad), RangeError);
  });
});

describe("shared contract", () => {
  test("samples form input frames that pass the server-boundary validator", () => {
    const { state, down, up } = setup();
    down("ArrowUp");
    down("ShiftRight");
    down("KeyE");
    for (const code of ["ArrowLeft", "KeyF", "KeyX", "ArrowRight"]) {
      down(code);
      up(code);
    }
    for (let i = 0; i < 6; i++) {
      down("KeyF");
      up("KeyF");
    }
    let sequence = 0;
    for (const sample of [state.takeSample(), state.takeSample()]) {
      const frame: InputFrame = { sequence: ++sequence, ...sample.held, actions: [...sample.actions], clientTimeMs: null };
      const parsed = parseClientCommand({ type: "input", frame });
      assert.ok(parsed.ok, JSON.stringify(parsed));
      assert.deepEqual(parsed.value, { type: "input", frame });
    }
  });
});
