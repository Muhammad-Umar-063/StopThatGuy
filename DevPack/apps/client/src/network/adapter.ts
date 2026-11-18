import { DEFAULT_TUNING, QUALITY_PRESETS, parseCreateRoomOptions, parseJoinRoomOptions, parseNickname,
  type AuthoritativeSnapshot, type ClientConnectionState, type EdgeAction, type GameEvent, type GameTuning, type HeldControls,
  type RoomErrorCode, type SettingsView, type UiAdapter, type UiIntent, type UiMessage, type UiViewModel, type VersionInfo,
} from '@stopthatguy/shared';
import { decodeMessage, decodeSnapshot, NetworkFailure } from './decode.js';
import { ClientInputQueue } from './input.js';
import { createColyseusTransport, type NetworkSession, type NetworkTransport } from './transport.js';
import { createView } from './view.js';

export interface NetworkAdapterOptions {
  endpoint: string;
  versions: VersionInfo;
  tuning?: GameTuning;
  /** Transport injection for deterministic race tests; production defaults to the real SDK. */
  transport?: NetworkTransport;
}
export function createNetworkAdapter(options: NetworkAdapterOptions) {
  const transport = options.transport ?? createColyseusTransport(options.endpoint);
  const tuning = structuredClone(options.tuning ?? DEFAULT_TUNING);
  const versions = { ...options.versions };
  if (versions.configVersion !== tuning.configVersion) throw new Error('UI tuning must match the expected config version');
  let state: ClientConnectionState = 'idle';
  let error: RoomErrorCode | null = null;
  let snapshot: AuthoritativeSnapshot | null = null;
  let session: NetworkSession | undefined;
  let input = new ClientInputQueue();
  let settings: SettingsView = { quality: 'auto', muted: false, volume: 1, reducedEffects: false };
  let messages: UiMessage[] = [];
  let messageId = 0, eventWatermark = 0, generation = 0, admissions = 0;
  let disposed = false;
  let unbind: (() => void)[] = [];
  let pump: ReturnType<typeof setInterval> | undefined;
  let initialStateTimer: ReturnType<typeof setTimeout> | undefined;
  const subscribers = new Set<(view: UiViewModel) => void>();
  const eventSubscribers = new Set<(event: GameEvent) => void>();
  const view = () => createView(snapshot, session?.id ?? null, state, error, settings, messages, tuning);
  const publish = () => { if (!disposed) for (const listener of [...subscribers]) listener(view()); };
  const notice = (text: string) => { messages = [...messages.slice(-15), { id: `network-${++messageId}`, kind: 'warning', text }]; };
  const detach = () => { clearTimeout(initialStateTimer); clearInterval(pump); pump = undefined; for (const stop of unbind.splice(0)) stop(); input.clear(); };
  const clearRoom = () => { snapshot = null; eventWatermark = 0; input = new ClientInputQueue(); };
  function fail(code: RoomErrorCode, text: string) {
    generation++;
    detach();
    const old = session; session = undefined; clearRoom();
    state = 'failed'; error = code; notice(text); publish();
    void old?.close().catch(() => {});
  }
  function onSnapshot(raw: unknown, expectedSession: NetworkSession) {
    try {
      const next = decodeSnapshot(raw, versions, expectedSession.id);
      if (next.match.roomCode !== expectedSession.roomCode) throw new NetworkFailure('invalidRequest');
      if (snapshot && next.match.tick < snapshot.match.tick && next.match.phase !== 'lobby') throw new NetworkFailure('invalidRequest');
      if (!snapshot || next.match.phase === 'lobby' && snapshot.match.phase !== 'lobby') { eventWatermark = 0; input.clear(); }
      clearTimeout(initialStateTimer);
      snapshot = next;
      const player = next.players.find((p) => p.id === expectedSession.id)!;
      input.acknowledge(player.lastProcessedInputSequence, player.lastProcessedActionId);
      if (next.match.phase === 'results' || next.match.phase === 'lobby') input.clear();
      state = 'connected';
      publish();
    } catch (cause) { fail(cause instanceof NetworkFailure ? cause.code : 'invalidRequest', 'The server sent an incompatible or invalid snapshot.'); }
  }
  function onMessage(raw: unknown) {
    try {
      const message = decodeMessage(raw);
      if (message.type === 'commandRejected') {
        error = message.code === 'versionMismatch' ? 'versionMismatch' : 'invalidRequest';
        notice(`Server rejected ${message.commandType ?? 'the command'}: ${message.code}. No operation was acknowledged.`);
        if (message.commandType === 'input' || message.commandType === null) input.clear();
        publish();
      } else if (message.event.id > eventWatermark) {
        eventWatermark = message.event.id;
        for (const listener of [...eventSubscribers]) listener(structuredClone(message.event));
      }
    } catch (cause) { fail(cause instanceof NetworkFailure ? cause.code : 'invalidRequest', 'The server sent an invalid message.'); }
  }
  async function admit(intent: Extract<UiIntent, { type: 'createRoom' | 'joinRoom' }>) {
    if (session || admissions >= 2) { error = 'invalidRequest'; notice('Leave the current room or wait for admission cleanup before retrying.'); publish(); return; }
    const attempt = ++generation;
    const result = intent.type === 'createRoom'
      ? parseCreateRoomOptions({ nickname: intent.nickname, mode: intent.mode, versions })
      : parseJoinRoomOptions({ nickname: intent.nickname, roomCode: intent.roomCode, versions });
    if (!result.ok) { clearRoom(); state = 'failed'; error = !parseNickname(intent.nickname).ok ? 'invalidNickname' : intent.type === 'joinRoom' ? 'invalidRoomCode' : 'invalidRequest'; publish(); return; }
    admissions++;
    state = 'connecting'; error = null; messages = []; clearRoom(); publish();
    try {
      const joined = await transport.admit(intent.type === 'createRoom' ? 'create' : 'join', result.value);
      if (disposed || attempt !== generation) { await joined.close(); return; }
      session = joined;
      const current = () => !disposed && attempt === generation && session === joined;
      unbind.push(joined.onMessage((raw) => { if (current()) onMessage(raw); }));
      unbind.push(joined.onClose(() => {
        if (!current()) return;
        generation++; detach(); session = undefined; clearRoom(); state = 'disconnected'; error = null;
        notice('Connection lost. Rejoin a room to continue.'); publish(); void joined.close().catch(() => {});
      }));
      initialStateTimer = setTimeout(() => { if (current()) fail('invalidRequest', 'The server did not provide an initial snapshot.'); }, 10000);
      const stopSnapshots = joined.onSnapshot((raw) => { if (current()) onSnapshot(raw, joined); });
      if (!current()) { stopSnapshots(); return; }
      unbind.push(stopSnapshots);
      pump = setInterval(() => {
        if (!current() || !snapshot || !['countdown', 'intro', 'chase'].includes(snapshot.match.phase)) return;
        try { const frame = input.next(performance.now(), tuning.timing.maxInputSendHz, tuning.network.heldInputTimeoutMs); if (frame) joined.send({ type: 'input', frame }); }
        catch { fail('invalidRequest', 'Input delivery stopped. Rejoin before continuing.'); }
      }, Math.ceil(1000 / tuning.timing.maxInputSendHz));
    } catch (cause) {
      if (!disposed && attempt === generation) { fail(cause instanceof NetworkFailure ? cause.code : 'invalidRequest', 'Could not join the server. Check the room details or retry.'); }
    } finally { admissions--; }
  }
  async function leave() {
    const attempt = ++generation;
    detach();
    const old = session; session = undefined;
    if (old) await old.close().catch(() => {});
    if (!disposed && attempt === generation) { clearRoom(); state = 'idle'; error = null; messages = []; publish(); }
  }
  const onBlur = () => input.clear();
  const onVisibility = () => { if (document.hidden) input.clear(); };
  if (typeof window !== 'undefined') window.addEventListener('blur', onBlur);
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisibility);
  const adapter: UiAdapter = {
    getView: view,
    subscribe(listener) { if (disposed) return () => {}; subscribers.add(listener); return () => subscribers.delete(listener); },
    dispatch(intent) {
      if (disposed) return;
      if (intent.type === 'createRoom' || intent.type === 'joinRoom') { void admit(intent); return; }
      if (intent.type === 'leaveRoom') { void leave(); return; }
      if (intent.type === 'changeSettings') {
        const s = intent.settings;
        settings = { quality: s.quality && QUALITY_PRESETS.includes(s.quality) ? s.quality : settings.quality,
          muted: typeof s.muted === 'boolean' ? s.muted : settings.muted, reducedEffects: typeof s.reducedEffects === 'boolean' ? s.reducedEffects : settings.reducedEffects,
          volume: typeof s.volume === 'number' && Number.isFinite(s.volume) ? Math.min(1, Math.max(0, s.volume)) : settings.volume };
        publish(); return;
      }
      if (!session || state !== 'connected') { error = 'invalidRequest'; notice('Connect before sending room commands.'); publish(); return; }
      error = null; publish();
      try { session.send(intent); } catch { fail('invalidRequest', 'The room command could not be sent.'); }
    },
  };
  return {
    ...adapter,
    /** Fresh read-only-by-isolation authoritative snapshot. No extrapolation/prediction (T022). */
    getSnapshot: () => snapshot ? structuredClone(snapshot) : null,
    subscribeEvents(listener: (event: GameEvent) => void) { if (disposed) return () => {}; eventSubscribers.add(listener); return () => eventSubscribers.delete(listener); },
    sampleInput(held: HeldControls, actions: readonly EdgeAction[] = []) {
      if (disposed || state !== 'connected' || !snapshot || !['countdown', 'intro', 'chase'].includes(snapshot.match.phase)) return false;
      const accepted = input.sample(held, actions, performance.now());
      if (!accepted) { notice('Input queue is full; wait for server acknowledgement.'); publish(); }
      return accepted;
    },
    clearInput: () => input.clear(),
    diagnostics: () => ({ ...input.diagnostics(), pendingAdmissions: admissions, listeners: subscribers.size + eventSubscribers.size, disposed }),
    async dispose() {
      if (disposed) return;
      disposed = true; generation++; detach(); subscribers.clear(); eventSubscribers.clear();
      if (typeof window !== 'undefined') window.removeEventListener('blur', onBlur);
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisibility);
      const old = session; session = undefined; clearRoom(); state = 'idle';
      await old?.close().catch(() => {});
    },
  };
}
export type NetworkAdapter = ReturnType<typeof createNetworkAdapter>;
