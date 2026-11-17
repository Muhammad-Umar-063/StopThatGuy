// Test-only page script for keyboard.browser.test.ts. Loaded from keyboard-fixture.html by the Vite dev
// server; nothing in the game imports it, so it is not part of the production bundle.
import { attachKeyboardInput, createActionIdSequence, type KeyboardInputController } from "../index";

const surface = document.getElementById("surface");
const nextActionId = createActionIdSequence();
const log = { changes: 0, menuIntents: 0, keydowns: [] as { code: string; repeat: boolean }[] };
let controller: KeyboardInputController | null = null;

function attach(): void {
  controller = attachKeyboardInput({
    window,
    surface,
    nextActionId,
    active: true,
    onChange: () => log.changes++,
    onLocalIntent: () => log.menuIntents++,
  });
}

// Diagnostic listener on the document, so window listener counts reflect only the controller.
document.addEventListener("keydown", (event) => log.keydowns.push({ code: event.code, repeat: event.repeat }));

(window as unknown as { keyboardFixture: unknown }).keyboardFixture = {
  attach,
  dispose: () => controller?.dispose(),
  setActive: (active: boolean) => controller?.setGameplayActive(active),
  releaseAll: () => controller?.releaseAll(),
  held: () => controller?.held(),
  sample: () => controller?.sample(),
  log,
  resetLog: () => {
    log.changes = 0;
    log.menuIntents = 0;
    log.keydowns.length = 0;
  },
};

attach();
document.documentElement.dataset.keyboardFixture = "ready";
