import { CONFIG_VERSION, PROTOCOL_VERSION, type AuthoritativeSnapshot } from '@stopthatguy/shared';
import { FIRST_STREET_WORLD } from '@stopthatguy/world';
import { mountLobby } from '../../ui/lobby/index.js';
import { attachKeyboardInput, createActionIdSequence } from '../../input/keyboard/index.js';
import { createNetworkAdapter } from '../adapter.js';
const adapter = createNetworkAdapter({ endpoint: 'http://127.0.0.1:2614', versions: { protocolVersion: PROTOCOL_VERSION, configVersion: CONFIG_VERSION, worldVersion: FIRST_STREET_WORLD.worldVersion } });
const root = document.querySelector<HTMLElement>('#lobby')!;
const surface = document.querySelector<HTMLElement>('#game-input')!;
const info = document.querySelector<HTMLElement>('#network-state')!;
const unmount = mountLobby(root, adapter);
const keyboard = attachKeyboardInput({ window, surface, nextActionId: createActionIdSequence(), active: false });
let disposed = false, animation = 0;
const history: AuthoritativeSnapshot[] = [];
let eventCount = 0;
const stopEvents = adapter.subscribeEvents(() => eventCount++);
const unsubscribe = adapter.subscribe((view) => {
  const chase = view.connection.state === 'connected' && view.phase === 'chase';
  const wasActive = keyboard.active;
  keyboard.setGameplayActive(chase);
  surface.hidden = !chase;
  if (chase && !wasActive) surface.focus();
  const snapshot = adapter.getSnapshot();
  if (snapshot) { history.push(snapshot); if (history.length > 120) history.shift(); }
  info.textContent = snapshot ? JSON.stringify({ tick: snapshot.match.tick, players: snapshot.players.map((p) => ({ nickname: p.nickname, position: p.pose.position, acknowledgedSequence: p.lastProcessedInputSequence, acknowledgedActionId: p.lastProcessedActionId })) }, null, 2) : '';
});
function sample() {
  if (disposed) return;
  if (keyboard.active) { const input = keyboard.sample(); adapter.sampleInput(input.held, input.actions); }
  animation = requestAnimationFrame(sample);
}
sample();
const lifecycle = new AbortController();
async function shutdown() {
  if (disposed) return;
  disposed = true; lifecycle.abort(); cancelAnimationFrame(animation); keyboard.dispose(); unsubscribe(); stopEvents(); unmount();
  await adapter.dispose();
}
window.addEventListener('pagehide', () => { void shutdown(); }, { signal: lifecycle.signal });
Object.assign(window, { networkDemo: {
  snapshot: () => ({ view: adapter.getView(), snapshot: adapter.getSnapshot(), history, eventCount, diagnostics: adapter.diagnostics(), disposed, keyboardActive: keyboard.active }),
  shutdown,
} });
