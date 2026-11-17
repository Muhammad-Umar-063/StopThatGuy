// Keyboard → shared input intents (T007). See keyboardInput.ts for focus/release rules and
// keyboardIntentState.ts for held/edge semantics.
export { KEY_CODE_BINDINGS, resolveKey, type KeyboardControl, type ResolvedKey } from "./bindings";
export { gameplayOwnsTarget, isKeyConsumingTarget } from "./focusPolicy";
export {
  attachKeyboardInput,
  type KeyboardDocument,
  type KeyboardInputController,
  type KeyboardInputOptions,
  type KeyboardLocalIntent,
  type KeyboardWindow,
} from "./keyboardInput";
export {
  createActionIdSequence,
  createKeyboardIntentState,
  type ActionIdSource,
  type KeyboardIntentSample,
  type KeyboardIntentState,
  type PressResult,
} from "./keyboardIntentState";
