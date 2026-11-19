// Explicit fixture entry. No HTTP/Colyseus, local simulation, camera mutation or fake online state.
import { FIXTURE_CHASE_VIEW, FIXTURE_CAPTURE_RESULTS_VIEW, FIXTURE_ARREST_VIEW } from '@stopthatguy/test-support';
import type { UiAdapter, UiViewModel } from '@stopthatguy/shared';
import { attachKeyboardInput, createActionIdSequence, type KeyboardInputController } from '../../../input/keyboard/index.js';
import { mountChaseHud } from '../hud.js';
const surface = document.querySelector<HTMLElement>('#play-surface')!, root = document.querySelector<HTMLElement>('#hud')!;
const listeners = new Set<(view: UiViewModel) => void>();
let view: UiViewModel = structuredClone(FIXTURE_CHASE_VIEW), disposed = false, menuCount = 0;
const actions: { id: number; kind: string }[] = [];
let keyboard: KeyboardInputController;
function publish(next: UiViewModel) {
  if (disposed) return;
  view = structuredClone(next);
  keyboard?.setGameplayActive(view.connection.state === 'connected' && view.phase === 'chase' && view.localPlayer?.participation === 'active');
  for (const listener of listeners) listener(view);
}
const adapter: UiAdapter = { getView: () => view, subscribe: listener => { listeners.add(listener); return () => { listeners.delete(listener); }; }, dispatch: intent => { if (intent.type === 'changeSettings') publish({ ...view, settings: { ...view.settings, ...intent.settings } }); } };
let unmount = mountChaseHud(root, adapter);
keyboard = attachKeyboardInput({ window, surface, active: true, nextActionId: createActionIdSequence(), onChange: () => {
  if (!keyboard) return;
  const sample = keyboard.sample(); actions.push(...sample.actions); if (actions.length > 64) actions.splice(0, actions.length - 64);
  document.querySelector('#intent-readout')!.textContent = `Keyboard intents: ${actions.length}`;
}, onLocalIntent: () => menuCount++ });
function scenario(name: string) {
  let next: UiViewModel = { ...structuredClone(FIXTURE_CHASE_VIEW), localPlayer: { ...FIXTURE_CHASE_VIEW.localPlayer!, locomotion: 'onFoot', staminaFraction: .72 }, timer: { phase: 'chase', remainingMs: 218000 }, robber: { bearing: .65, distanceM: 22, visible: true } };
  if (name === 'turn') next = { ...next, actions: { ...next.actions!, left: 'turn', right: 'laneChange', turnLabel: 'Left: Rua do Banco', canSprint: true }, robber: { bearing: -.9, distanceM: 31, visible: false } };
  if (name === 'countdown' || name === 'intro') next = { ...next, phase: name, timer: { phase: name, remainingMs: name === 'countdown' ? 3000 : 8000 } };
  if (name === 'expired') next = { ...next, timer: { phase: 'chase', remainingMs: 0 }, localPlayer: { ...next.localPlayer!, staminaFraction: 0 } };
  if (name === 'unavailable') next = { ...next, actions: null, robber: null };
  if (name === 'wanted') next = { ...next, localPlayer: { ...next.localPlayer!, wanted: true, stunned: true }, messages: [{ id: 'warning-1', kind: 'warning', text: 'Police alerted. Keep moving when the stun ends.' }] };
  if (name === 'arrested') next = structuredClone(FIXTURE_ARREST_VIEW);
  if (name === 'results') next = structuredClone(FIXTURE_CAPTURE_RESULTS_VIEW);
  if (name === 'disconnected') next = { ...next, connection: { state: 'disconnected', error: null } };
  publish({ ...next, settings: view.settings });
}
const controller = new AbortController();
document.querySelector('#scenario')!.addEventListener('change', event => scenario((event.target as HTMLSelectElement).value), { signal: controller.signal });
document.querySelector('#reduced')!.addEventListener('click', event => { const reducedEffects = !view.settings.reducedEffects; (event.target as HTMLButtonElement).setAttribute('aria-pressed', String(reducedEffects)); adapter.dispatch({ type: 'changeSettings', settings: { reducedEffects } }); }, { signal: controller.signal });
function shutdown() { if (disposed) return; disposed = true; controller.abort(); unmount(); keyboard.dispose(); }
window.addEventListener('pagehide', shutdown, { signal: controller.signal });
Object.assign(window, { hudFixture: {
  scenario, setView: publish, getView: () => structuredClone(view),
  rapid: (count = 300) => { for (let i = 0; i < count; i++) publish({ ...view, timer: { phase: 'chase', remainingMs: 200000 - i * 33 }, localPlayer: { ...view.localPlayer!, staminaFraction: i / count } }); },
  remount: () => { unmount = mountChaseHud(root, adapter); }, unmount: () => unmount(), shutdown,
  diagnostics: () => ({ listeners: listeners.size, actions, menuCount, held: keyboard.held(), keyboardActive: keyboard.active, disposed }),
} });
scenario('chase'); document.documentElement.dataset.hudFixture = 'ready';
