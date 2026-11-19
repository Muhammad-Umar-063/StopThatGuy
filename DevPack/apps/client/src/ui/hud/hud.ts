import type { UiAdapter, UiViewModel } from '@stopthatguy/shared';
import { hudModel } from './model.js';
import './hud.css';

const mounts = new WeakMap<HTMLElement, () => void>();
/** Read-only HUD: no input handlers, focus calls, gameplay intents or local clock. */
export function mountChaseHud(root: HTMLElement, adapter: UiAdapter): () => void {
  mounts.get(root)?.();
  const doc = root.ownerDocument;
  const hud = doc.createElement('aside'); hud.className = 'stg-hud'; hud.setAttribute('aria-label', 'Chase HUD');
  // Static markup only. Every external string is written with textContent below.
  hud.innerHTML = `<p class="hud-fixture" data-fixture>Fixture HUD preview · not live gameplay</p>
    <div class="hud-top"><section class="hud-clock hud-plaque" aria-label="Match status"><span class="hud-eyebrow" data-phase></span><div><strong data-timer role="timer" aria-live="off"></strong><span data-time-hint></span></div><p data-statuses></p></section>
    <section class="hud-pursuit hud-plaque" aria-label="Robber direction relative to your facing"><span class="hud-compass" aria-hidden="true" data-arrow>↑</span><div><span class="hud-eyebrow">Robber</span><strong data-robber></strong><span data-visibility></span></div></section>
    <section class="hud-stamina hud-plaque" aria-label="Stamina"><span class="hud-eyebrow">Stamina</span><strong data-stamina-text></strong><progress data-stamina max="100" aria-label="Stamina"></progress><span data-stamina-hint>Hold Shift + ↑ to sprint when available</span></section></div>
    <div class="hud-feedback"><p data-error></p><p data-outcome></p><ul data-messages aria-label="Recent chase updates" aria-live="off"></ul></div>
    <div class="hud-bottom"><section class="hud-directions hud-plaque" aria-label="Road-relative movement cues"><div><kbd>←</kbd><strong data-left></strong></div><div><kbd>→</kbd><strong data-right></strong></div><p data-turn-label></p></section>
    <section class="hud-actions hud-plaque" aria-label="Contextual actions"><span class="hud-eyebrow" data-action-state></span><dl data-actions></dl></section><p class="hud-keys">↑ Move &nbsp; ↓ Brake &nbsp; Esc Menu · Tab / Shift+Tab Move focus</p></div>
    <p class="hud-sr" role="status" aria-live="polite" aria-atomic="true" data-announcement></p>`;
  root.append(hud);
  const get = (name: string) => hud.querySelector<HTMLElement>(`[data-${name}]`)!;
  const write = (name: string, value: string) => { const element = get(name); if (element.textContent !== value) element.textContent = value; };
  const promptNodes = ['sprint', 'interact', 'capture', 'sabotage'].map(name => {
    const row = doc.createElement('div'); row.dataset.prompt = name;
    const key = doc.createElement('dt'), label = doc.createElement('dd');
    const labelText = doc.createElement('span'), readiness = doc.createElement('span'); label.append(labelText, readiness);
    row.append(key, label); get('actions').append(row);
    return { row, key, labelText, readiness };
  });
  const media = doc.defaultView?.matchMedia('(prefers-reduced-motion: reduce)');
  let current = adapter.getView(), disposed = false, announcedKey = '', pending: ReturnType<typeof setTimeout> | undefined;
  const motion = () => { hud.dataset.reducedMotion = String(current.settings.reducedEffects || !!media?.matches); };
  function update(view: UiViewModel) {
    if (disposed) return;
    current = view; const model = hudModel(view); motion();
    hud.dataset.phase = view.phase ?? 'none'; get('fixture').hidden = !model.fixture;
    for (const [name, value] of Object.entries({ phase: model.phase, timer: model.timer, 'time-hint': model.timerHint, statuses: model.statuses,
      robber: model.robber, visibility: model.visibility, left: model.left, right: model.right, 'turn-label': model.turnLabel,
      'action-state': model.actionState, error: model.error, outcome: model.outcome })) write(name, value);
    hud.dataset.expired = String(model.expired);
    write('stamina-text', model.stamina === null ? 'Unavailable' : `${model.stamina}%`);
    const progress = get('stamina') as HTMLProgressElement; progress.value = model.stamina ?? 0;
    progress.hidden = model.stamina === null; progress.setAttribute('aria-valuetext', model.stamina === null ? 'Unavailable' : `${model.stamina} percent`);
    get('stamina-hint').hidden = model.stamina === null;
    get('arrow').hidden = model.bearing === null;
    get('arrow').style.transform = `rotate(${model.bearing ?? 0}rad)`;
    model.prompts.forEach((prompt, i) => { const node = promptNodes[i]!; node.key.textContent = prompt.key; node.labelText.textContent = prompt.label; node.readiness.textContent = prompt.available ? 'Ready' : 'Unavailable'; node.row.dataset.available = String(prompt.available); });
    // Compare before replacing; rapid snapshots never recreate the HUD or disturb focus.
    const messages = JSON.stringify(model.messages);
    if (get('messages').dataset.content !== messages) {
      get('messages').dataset.content = messages;
      get('messages').replaceChildren(...model.messages.map(m => { const li = doc.createElement('li'); li.textContent = m.text; li.dataset.kind = m.kind; return li; }));
    }
    // Essential changes only; no per-tick timer/stamina/bearing announcements.
    const lastMessage = model.messages.at(-1);
    const announcement = [model.phase, model.error, model.outcome, model.statuses, lastMessage?.text].filter(Boolean).join('. ');
    const key = JSON.stringify([view.connection.state, view.phase, model.error, model.outcome, model.statuses, lastMessage?.id]);
    if (key !== announcedKey) {
      announcedKey = key; clearTimeout(pending);
      // A new feedback ID must be announced even when its text repeats the last feedback.
      write('announcement', '');
      pending = setTimeout(() => { if (!disposed) write('announcement', announcement); }, 400);
    }
  }
  media?.addEventListener('change', motion);
  update(current); const unsubscribe = adapter.subscribe(update);
  const dispose = () => { if (disposed) return; disposed = true; clearTimeout(pending); unsubscribe(); media?.removeEventListener('change', motion); hud.remove(); if (mounts.get(root) === dispose) mounts.delete(root); };
  mounts.set(root, dispose); return dispose;
}
