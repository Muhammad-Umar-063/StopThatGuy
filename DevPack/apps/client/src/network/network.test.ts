import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_TUNING, NEUTRAL_HELD_CONTROLS, type ClientCommand, type UiViewModel } from '@stopthatguy/shared';
import { FIXTURE_SNAPSHOTS } from '@stopthatguy/test-support';
import { createNetworkAdapter } from './adapter.js';
import { ClientInputQueue } from './input.js';
import { decodeMessage, decodeSnapshot, NetworkFailure } from './decode.js';
import { createColyseusTransport, type NetworkSession, type NetworkTransport } from './transport.js';

const baseline = FIXTURE_SNAPSHOTS.lobby;
const versions = baseline.match.versions;
const id = baseline.players[0]!.id;
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
function fakeSession() {
  const snapshots = new Set<(raw: unknown) => void>(), messages = new Set<(raw: unknown) => void>(), closes = new Set<() => void>();
  const commands: ClientCommand[] = [];
  let closed = 0;
  const session: NetworkSession = {
    id, roomCode: baseline.match.roomCode,
    onSnapshot(fn) { snapshots.add(fn); return () => { snapshots.delete(fn); }; },
    onMessage(fn) { messages.add(fn); return () => { messages.delete(fn); }; },
    onClose(fn) { closes.add(fn); return () => { closes.delete(fn); }; },
    send(command) { commands.push(command); }, async close() { closed++; },
  };
  return { session, commands, snapshot: (data = baseline) => { for (const fn of snapshots) fn(JSON.stringify(data)); },
    message: (raw: unknown) => { for (const fn of messages) fn(raw); }, staleCallbacks: () => [...snapshots],
    closed: () => closed, listenerCount: () => snapshots.size + messages.size + closes.size };
}
const make = (transport: NetworkTransport) => createNetworkAdapter({ endpoint: 'http://127.0.0.1:2614', versions, transport });

test('decoder rejects malformed, oversized, nonfinite, duplicate identity and wrong-version snapshots and invalid events', () => {
  const raw = JSON.stringify(baseline);
  assert.deepEqual(decodeSnapshot(raw, versions, id), baseline);
  for (const bad of ['', '{', '{}', 'x'.repeat(262145), raw.replace('"players":[', '"players":null,"oldPlayers":['), raw.replace('"speedMps":0', '"speedMps":1e999')]) assert.throws(() => decodeSnapshot(bad, versions, id));
  const duplicate = structuredClone(baseline); duplicate.players.push(duplicate.players[0]!);
  assert.throws(() => decodeSnapshot(JSON.stringify(duplicate), versions, id));
  assert.throws(() => decodeSnapshot(raw, { ...versions, configVersion: 'other' }, id), (error) => error instanceof NetworkFailure && error.code === 'versionMismatch');
  assert.throws(() => decodeSnapshot(raw, versions, 'missing-player'));
  for (const bad of [null, {}, { type: 'event', event: { type: '__proto__', id: 1, tick: 1 } }, { type: 'event', event: { type: 'mounted', id: 1, tick: 1 } }, { type: 'commandRejected', commandType: 'startMatch', code: 'invented' }]) assert.throws(() => decodeMessage(bad));
});

test('input queue bounds work, resends edge IDs until actual ack, and neutralizes missing samples', () => {
  const queue = new ClientInputQueue();
  queue.sample({ ...NEUTRAL_HELD_CONTROLS, forwardHeld: true }, [{ id: 1, kind: 'right' }], 0);
  const first = queue.next(0, 30, 250)!;
  assert.equal(first.sequence, 1); assert.equal(first.forwardHeld, true);
  assert.equal(queue.next(10, 30, 250), null);
  assert.deepEqual(queue.next(40, 30, 250)!.actions, first.actions);
  queue.acknowledge(1, 1);
  assert.equal(queue.diagnostics().pendingActions, 0);
  assert.equal(queue.next(300, 30, 250)!.forwardHeld, false);
  for (let i = 0; i < 8; i++) assert.equal(queue.sample(NEUTRAL_HELD_CONTROLS, Array.from({ length: 8 }, (_, n) => ({ id: 2 + i * 8 + n, kind: 'left' })), 310), true);
  assert.equal(queue.sample(NEUTRAL_HELD_CONTROLS, [{ id: 100, kind: 'right' }], 310), false);
  assert.equal(queue.diagnostics().pendingActions, 64);
  assert.throws(() => queue.next(2500, 30, 250), /stalled/);
  queue.clear(); assert.equal(queue.diagnostics().pendingActions, 0);
});

test('readiness/start are server-owned; rejection clears UI busy through error without false acknowledgement', async () => {
  const peer = fakeSession(); const adapter = make({ admit: async () => peer.session });
  const views: UiViewModel[] = []; adapter.subscribe((view) => views.push(view));
  adapter.dispatch({ type: 'createRoom', nickname: 'Ana', mode: 'normal' });
  assert.equal(adapter.getView().connection.state, 'connecting');
  await tick(); peer.snapshot();
  const ready = adapter.getView().lobby!.players[0]!.ready;
  adapter.dispatch({ type: 'setReady', ready: !ready });
  assert.equal(adapter.getView().lobby!.players[0]!.ready, ready);
  peer.message({ type: 'commandRejected', commandType: 'setReady', code: 'rateLimited' });
  assert.equal(adapter.getView().connection.error, 'invalidRequest');
  assert.equal(adapter.getView().connection.state, 'connected');
  assert.equal(adapter.getView().lobby!.players[0]!.ready, ready);
  adapter.dispatch({ type: 'startMatch' });
  assert.equal(adapter.getView().phase, 'lobby');
  assert.equal(adapter.getView().connection.error, null);
  assert.equal(adapter.getView().actions, null, 'no fabricated legal actions');
  await adapter.dispose(); assert.equal(peer.listenerCount(), 0);
});

test('cancel/retry/dispose closes late sessions and ignores obsolete callbacks; event IDs reset only for a new match', async () => {
  const pending: ((s: NetworkSession) => void)[] = [];
  const adapter = make({ admit: () => new Promise((resolve) => pending.push(resolve)) });
  adapter.dispatch({ type: 'createRoom', nickname: 'Ana', mode: 'normal' });
  adapter.dispatch({ type: 'leaveRoom' }); await tick();
  assert.equal(adapter.getView().connection.state, 'idle');
  adapter.dispatch({ type: 'createRoom', nickname: 'Ana', mode: 'normal' });
  const late = fakeSession(), current = fakeSession();
  pending[1]!(current.session); await tick(); current.snapshot();
  pending[0]!(late.session); await tick();
  assert.equal(late.closed(), 1); assert.equal(adapter.getView().connection.state, 'connected');
  const seen: number[] = []; adapter.subscribeEvents((event) => seen.push(event.id));
  current.message({ type: 'event', event: { type: 'matchStarted', id: 1, tick: 10, chaseStartTick: 10 } });
  current.message({ type: 'event', event: { type: 'matchStarted', id: 1, tick: 10, chaseStartTick: 10 } });
  assert.deepEqual(seen, [1]);
  current.snapshot(FIXTURE_SNAPSHOTS.chase);
  current.snapshot(baseline);
  current.message({ type: 'event', event: { type: 'matchStarted', id: 1, tick: 10, chaseStartTick: 10 } });
  assert.deepEqual(seen, [1, 1]);
  const stale = current.staleCallbacks();
  await adapter.dispose();
  for (const fn of stale) fn('{');
  assert.equal(adapter.diagnostics().disposed, true); assert.equal(adapter.diagnostics().listeners, 0); assert.equal(current.listenerCount(), 0);
  assert.equal(current.closed(), 1);
});

test('pending admission count is bounded and dispose cleans an admission completed afterwards', async () => {
  const pending: ((s: NetworkSession) => void)[] = [];
  const adapter = make({ admit: () => new Promise((resolve) => pending.push(resolve)) });
  for (let i = 0; i < 6; i++) { adapter.dispatch({ type: 'createRoom', nickname: 'Ana', mode: 'normal' }); adapter.dispatch({ type: 'leaveRoom' }); }
  assert.equal(pending.length, 2);
  await adapter.dispose();
  for (const resolve of pending) { const late = fakeSession(); resolve(late.session); await tick(); assert.equal(late.closed(), 1); }
  assert.equal(adapter.diagnostics().pendingAdmissions, 0);
});

test('deep unknown snapshot fields, oversized streamed admission and invalid join nickname fail safely', async () => {
  let deep: unknown = {};
  for (let i = 0; i < 1000; i++) deep = { nested: deep };
  assert.throws(() => decodeSnapshot(JSON.stringify({ ...baseline, extra: deep }), versions, id));
  let cancelled = false;
  const transport = createColyseusTransport('http://127.0.0.1:2614', async () => new Response(new ReadableStream({
    pull(controller) { controller.enqueue(new Uint8Array(10000)); }, cancel() { cancelled = true; },
  })));
  await assert.rejects(transport.admit('create', { nickname: 'Ana', mode: 'practice', versions }));
  assert.equal(cancelled, true);
  const adapter = make({ admit: async () => { throw new Error('should not request'); } });
  adapter.dispatch({ type: 'joinRoom', nickname: '\u0000', roomCode: 'AAAAA' });
  assert.equal(adapter.getView().connection.error, 'invalidNickname');
  await adapter.dispose();
});

test('action acknowledgement stalls are bounded even when sequence acknowledgements keep arriving', () => {
  const queue = new ClientInputQueue();
  queue.sample(NEUTRAL_HELD_CONTROLS, [{ id: 1, kind: 'right' }], 0);
  const first = queue.next(0, 30, 250)!;
  queue.acknowledge(first.sequence, 0);
  assert.throws(() => queue.next(2100, 30, 250), /stalled/);
});

test('initial snapshot timeout closes a joined-but-silent session', async (context) => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const peer = fakeSession(); const adapter = make({ admit: async () => peer.session });
  adapter.dispatch({ type: 'createRoom', nickname: 'Ana', mode: 'practice' });
  await Promise.resolve();
  context.mock.timers.tick(10000);
  assert.equal(adapter.getView().connection.state, 'failed');
  assert.equal(peer.closed(), 1); assert.equal(peer.listenerCount(), 0);
  await adapter.dispose(); context.mock.timers.reset();
});

test('invalid retry invalidates an earlier pending admission and cannot be overwritten by its success', async () => {
  let resolve!: (session: NetworkSession) => void;
  const adapter = make({ admit: () => new Promise((complete) => { resolve = complete; }) });
  adapter.dispatch({ type: 'createRoom', nickname: 'Ana', mode: 'practice' });
  adapter.dispatch({ type: 'joinRoom', nickname: '\u0000', roomCode: 'AAAAA' });
  const late = fakeSession(); resolve(late.session); await tick();
  assert.equal(late.closed(), 1); assert.equal(adapter.getView().connection.state, 'failed');
  assert.equal(adapter.getView().connection.error, 'invalidNickname');
  await adapter.dispose();
});
