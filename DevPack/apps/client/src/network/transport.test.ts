import assert from 'node:assert/strict';
import { before, after, afterEach, test } from 'node:test';
import { createServer } from 'node:http';
import { setTimeout as delay } from 'node:timers/promises';
import { defineServer, createRouter, matchMaker } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { DEFAULT_TUNING, NEUTRAL_HELD_CONTROLS, PROTOCOL_VERSION, type AuthoritativeSnapshot } from '@stopthatguy/shared';
import { FIRST_STREET_WORLD } from '@stopthatguy/world';
import { createRoomLifecycle } from '../../../server/src/rooms/index.js';
import { createNetworkAdapter, type NetworkAdapter } from './adapter.js';
import { createColyseusTransport } from './transport.js';
const tuning = { ...DEFAULT_TUNING, configVersion: 't014-client-test', timing: { ...DEFAULT_TUNING.timing, countdownMs: 200, introMs: 100, chaseTimeLimitMs: 6000 } };
const versions = { protocolVersion: PROTOCOL_VERSION, configVersion: tuning.configVersion, worldVersion: FIRST_STREET_WORLD.worldVersion };
let server: ReturnType<typeof defineServer>, endpoint: string;
const adapters: NetworkAdapter[] = [];
async function until<T>(probe: () => T, name: string, ms = 4000): Promise<NonNullable<T>> {
  const end = performance.now() + ms;
  while (performance.now() < end) { const value = probe(); if (value) return value as NonNullable<T>; await delay(10); }
  throw new Error(`Timed out: ${name}`);
}
function make(options: Partial<Parameters<typeof createNetworkAdapter>[0]> = {}) { const a = createNetworkAdapter({ endpoint, versions, tuning, ...options }); adapters.push(a); return a; }
before(async () => {
  const http = createServer(); const lifecycle = createRoomLifecycle({ world: FIRST_STREET_WORLD, tuning });
  server = defineServer({ greet: false, gracefullyShutdown: false, transport: new WebSocketTransport({ server: http }), rooms: lifecycle.rooms, routes: createRouter(lifecycle.endpoints) });
  await server.listen(0, '127.0.0.1'); const address = http.address(); assert.ok(address && typeof address === 'object'); endpoint = `http://127.0.0.1:${address.port}`;
});
afterEach(async () => {
  await Promise.all(adapters.splice(0).map((a) => a.dispose()));
  for (const listing of await matchMaker.query({ name: 'chase' })) await matchMaker.getLocalRoomById(listing.roomId)?.disconnect();
});
after(async () => server?.gracefullyShutdown(false));

test('real adapters create/join/ready/start, share matching tick state and track moving-player input acknowledgements', async () => {
  const host = make(), guest = make();
  host.dispatch({ type: 'createRoom', nickname: 'Ana', mode: 'normal' });
  await until(() => host.getView().lobby, 'host lobby');
  guest.dispatch({ type: 'joinRoom', nickname: 'Bruno', roomCode: host.getView().lobby!.roomCode });
  await until(() => host.getView().lobby?.players.length === 2 && guest.getView().lobby, 'joined lobby');
  const histories: AuthoritativeSnapshot[][] = [[], []];
  [host, guest].forEach((a, i) => a.subscribe(() => { const snapshot = a.getSnapshot(); if (snapshot) histories[i]!.push(snapshot); }));
  const events: number[] = []; host.subscribeEvents((event) => events.push(event.id));
  guest.dispatch({ type: 'startMatch' });
  await until(() => guest.getView().connection.error, 'host-only rejection');
  assert.equal(guest.getView().phase, 'lobby');
  for (const a of [host, guest]) a.dispatch({ type: 'setReady', ready: true });
  await until(() => host.getView().lobby?.canStart, 'server readiness');
  host.dispatch({ type: 'startMatch' });
  await until(() => host.getView().phase === 'chase' && guest.getView().phase === 'chase', 'chase');
  const playerId = host.getView().localPlayer!.id;
  const startZ = host.getSnapshot()!.players.find((p) => p.id === playerId)!.pose.position.z;
  for (let i = 0; i < 20; i++) { host.sampleInput({ ...NEUTRAL_HELD_CONTROLS, forwardHeld: true }, i === 0 ? [{ id: 1, kind: 'right' }] : []); await delay(50); }
  await until(() => host.diagnostics().acknowledgedActionId === 1, 'server processed edge');
  host.clearInput();
  assert.ok(host.getSnapshot()!.players.find((p) => p.id === playerId)!.pose.position.z > startZ + 1);
  assert.ok(host.diagnostics().acknowledgedSequence > 0);
  const common = await until(() => histories[0]!.filter((s) => s.players.some((p) => p.id === playerId && p.pose.position.z > startZ + 1 && p.lastProcessedActionId === 1)).map((s) => [s, histories[1]!.find((g) => g.match.tick === s.match.tick)]).find((pair) => pair[1]), 'matching ticks');
  assert.deepEqual(common[0], common[1]);
  assert.deepEqual(events, [1]);
  const listing = (await matchMaker.query({ name: 'chase' }))[0]!;
  matchMaker.getLocalRoomById(listing.roomId)!.broadcast('message', { type: 'event', event: { type: 'matchStarted', id: 1, tick: 9, chaseStartTick: 9 } });
  await delay(80); assert.deepEqual(events, [1], 'real transport event replay deduplicated');
  const own = host.getSnapshot()!; own.players[0]!.pose.position.x = 999;
  assert.notEqual(host.getSnapshot()!.players[0]!.pose.position.x, 999);
  guest.dispatch({ type: 'leaveRoom' });
  await until(() => guest.getView().phase === null && guest.getView().connection.state === 'idle', 'leave');
});

test('real HTTP version/room failures expose errors, retry succeeds and server closure is recoverable', async () => {
  const bad = make({ versions: { ...versions, worldVersion: 'different' } });
  bad.dispatch({ type: 'createRoom', nickname: 'Ana', mode: 'practice' });
  await until(() => bad.getView().connection.state === 'failed', 'version failure'); assert.equal(bad.getView().connection.error, 'versionMismatch');
  const a = make(); a.dispatch({ type: 'joinRoom', nickname: 'Ana', roomCode: 'AAAAA' });
  await until(() => a.getView().connection.state === 'failed', 'room failure'); assert.equal(a.getView().connection.error, 'roomNotFound');
  a.dispatch({ type: 'createRoom', nickname: 'Ana', mode: 'practice' }); await until(() => a.getView().lobby, 'retry');
  const listing = (await matchMaker.query({ name: 'chase' }))[0]!;
  await matchMaker.getLocalRoomById(listing.roomId)!.disconnect();
  await until(() => a.getView().connection.state === 'disconnected', 'server disconnect'); assert.equal(a.getSnapshot(), null);
});

test('cancelled delayed HTTP admission consumes and leaves its late reservation without overwriting retry', async () => {
  let release: (() => void) | undefined;
  let first = true;
  const transport = createColyseusTransport(endpoint, async (...args) => {
    const response = await fetch(...args);
    if (first) { first = false; await new Promise<void>((resolve) => { release = resolve; }); }
    return response;
  });
  const a = make({ transport });
  a.dispatch({ type: 'createRoom', nickname: 'Late', mode: 'practice' });
  await until(() => release, 'delayed HTTP response');
  a.dispatch({ type: 'leaveRoom' }); await until(() => a.getView().connection.state === 'idle', 'cancel');
  a.dispatch({ type: 'createRoom', nickname: 'Current', mode: 'practice' });
  await until(() => a.getView().lobby, 'retry lobby'); const code = a.getView().lobby!.roomCode;
  release!();
  await until(() => a.diagnostics().pendingAdmissions === 0, 'late reservation cleanup');
  await delay(60);
  assert.equal(a.getView().lobby!.roomCode, code); assert.equal((await matchMaker.query({ name: 'chase' })).length, 1);
});
