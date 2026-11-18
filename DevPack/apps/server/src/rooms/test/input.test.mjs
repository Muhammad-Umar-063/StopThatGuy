import assert from 'node:assert/strict';
import { after, afterEach, before, test } from 'node:test';
import { createServer } from 'node:http';
import { setTimeout as delay } from 'node:timers/promises';
import { createRouter, defineServer, matchMaker } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { Client } from '@colyseus/sdk';
import { DEFAULT_TUNING, NEUTRAL_HELD_CONTROLS, PROTOCOL_VERSION, parseInputFrame } from '@stopthatguy/shared';
import { FIRST_STREET_WORLD } from '@stopthatguy/world';
import { PlayerInputBuffer } from '../../validation/player-input.ts';
import { createRoomLifecycle } from '../index.ts';
import { MatchSimulation } from '../../adapters/match-simulation.ts';

const tuning = { ...DEFAULT_TUNING, configVersion: 't014-input-test', timing: { ...DEFAULT_TUNING.timing, countdownMs: 200, introMs: 100, chaseTimeLimitMs: 8000 } };
const versions = { protocolVersion: PROTOCOL_VERSION, configVersion: tuning.configVersion, worldVersion: FIRST_STREET_WORLD.worldVersion };
const frame = (sequence, values = {}) => ({ sequence, ...NEUTRAL_HELD_CONTROLS, actions: [], clientTimeMs: null, ...values });
const peers = [];
let server, endpoint;
async function until(probe, label, timeout = 4000) {
  const end = performance.now() + timeout;
  while (performance.now() < end) { const value = probe(); if (value) return value; await delay(10); }
  assert.fail(`Timed out: ${label}`);
}
const snapshot = (peer) => JSON.parse(peer.room.state.snapshotJson);
const local = (peer) => snapshot(peer).players.find((player) => player.id === peer.room.sessionId);
before(async () => {
  const http = createServer();
  const lifecycle = createRoomLifecycle({ world: FIRST_STREET_WORLD, tuning });
  server = defineServer({ greet: false, gracefullyShutdown: false, transport: new WebSocketTransport({ server: http, maxPayload: 4096 }), rooms: lifecycle.rooms, routes: createRouter(lifecycle.endpoints) });
  await server.listen(0, '127.0.0.1');
  endpoint = `http://127.0.0.1:${http.address().port}`;
});
afterEach(async () => {
  await Promise.all(peers.splice(0).map((peer) => peer.room.leave()));
  for (const listing of await matchMaker.query({ name: 'chase' })) await matchMaker.getLocalRoomById(listing.roomId)?.disconnect();
});
after(async () => server?.gracefullyShutdown(false));
async function connect(host) {
  const response = await fetch(`${endpoint}/rooms/${host ? 'join' : 'create'}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(host ? { nickname: 'Guest', roomCode: snapshot(host).match.roomCode, versions } : { nickname: 'Host', mode: 'normal', versions }) });
  assert.equal(response.status, 200);
  const room = await new Client(endpoint).consumeSeatReservation((await response.json()).reservation);
  room.reconnection.enabled = false;
  const peer = { room, messages: [], history: [] };
  room.onMessage('message', (message) => peer.messages.push(message));
  room.onStateChange((state) => { if (state.snapshotJson) peer.history.push(JSON.parse(state.snapshotJson)); });
  peers.push(peer);
  await until(() => room.state?.snapshotJson, 'initial state');
  return peer;
}
async function start() {
  const host = await connect(), guest = await connect(host);
  for (const peer of [host, guest]) peer.room.send('command', { type: 'setReady', ready: true });
  await until(() => snapshot(host).players.length === 2 && snapshot(host).players.every((p) => p.ready), 'readiness');
  host.room.send('command', { type: 'startMatch' });
  await until(() => snapshot(host).match.phase === 'chase' && snapshot(guest).match.phase === 'chase', 'real chase');
  return [host, guest];
}
const input = (peer, value) => peer.room.send('command', { type: 'input', frame: value });
async function rejected(peer, payload, expected) {
  const offset = peer.messages.length;
  peer.room.send('command', payload);
  const message = await until(() => peer.messages.slice(offset).find((m) => m.type === 'commandRejected'), 'rejection');
  assert.equal(message.code, expected);
}

test('input buffer bounds pending edges, drains once, neutralizes expired controls and preserves session watermarks', () => {
  const buffer = new PlayerInputBuffer('session-player', 250);
  assert.equal(buffer.accept(frame(1, { forwardHeld: true, actions: [{ id: 1, kind: 'right' }] }), 100), 'accepted');
  assert.equal(buffer.accept(frame(1), 200), 'stale');
  assert.equal(buffer.sample(200).actions.length, 1);
  assert.equal(buffer.sample(201).actions.length, 0);
  assert.equal(buffer.sample(350).forwardHeld, false);
  buffer.clear();
  assert.equal(buffer.accept(frame(2, { actions: [{ id: 1, kind: 'left' }] }), 400), 'accepted');
  assert.equal(buffer.sample(400).actions.length, 0, 'same ID never executes again even if its payload changes');
  assert.equal(buffer.accept(frame(3, { actions: Array.from({ length: 8 }, (_, i) => ({ id: i + 2, kind: 'right' })) }), 500), 'accepted');
  assert.equal(buffer.accept(frame(4, { actions: [{ id: 10, kind: 'left' }] }), 501), 'overflow');
  assert.equal(buffer.sample(502).sequence, 3, 'rejection is atomic');
  assert.equal(parseInputFrame(frame(5, { position: { x: 500, y: 0, z: 0 } })).ok, false);
});

test('two independent clients see matching tick snapshots, real movement, action deduplication and authoritative acknowledgements', async () => {
  const [host, guest] = await start();
  assert.notEqual(host.room.sessionId, guest.room.sessionId);
  const initial = structuredClone(local(host));
  let sequence = 1;
  const action = { id: 1, kind: 'right' };
  for (let i = 0; i < 10; i++) {
    input(host, frame(sequence++, { forwardHeld: true, actions: [action] }));
    await delay(65);
  }
  await until(() => local(host).lastProcessedInputSequence === sequence - 1, 'input acknowledgement');
  assert.equal(local(host).lastProcessedActionId, 1);
  assert.ok(local(host).pose.position.z > initial.pose.position.z + 0.5);
  assert.equal(local(host).route.laneIndex, initial.route.laneIndex + 1, 'resending action cannot cascade across lanes');
  assert.equal(local(guest).lastProcessedInputSequence, 0, 'host cannot acknowledge input for guest');
  const match = await until(() => host.history.filter((s) => s.players.some((p) => p.id === host.room.sessionId && p.pose.position.z > initial.pose.position.z + 0.5 && p.lastProcessedActionId === 1)).map((s) => [s, guest.history.find((g) => g.match.tick === s.match.tick)]).find((pair) => pair[1]), 'matching authoritative ticks');
  assert.deepEqual(match[0], match[1]);
  await rejected(host, { type: 'input', frame: frame(1, { forwardHeld: true }) }, 'malformed');
  assert.ok(local(host).lastProcessedInputSequence >= sequence - 1);
});

test('malformed and forged identity/pose/winner inputs cannot move another authenticated player', async () => {
  const [host, guest] = await start();
  for (const bad of [
    { type: 'input', frame: frame(1), playerId: guest.room.sessionId },
    { type: 'input', frame: frame(1, { playerId: guest.room.sessionId }) },
    { type: 'input', frame: frame(1, { pose: { position: { x: 999, y: 0, z: 999 }, yaw: 0 } }) },
    { type: 'input', frame: frame(1, { winnerId: host.room.sessionId }) },
    { type: 'input', frame: frame(1, { forwardHeld: 1 }) },
    { type: 'input', frame: frame(1, { clientTimeMs: Infinity }) },
    { type: 'input', frame: frame(1, { actions: Array.from({ length: 9 }, (_, i) => ({ id: i + 1, kind: 'right' })) }) },
  ]) await rejected(host, bad, 'malformed');
  assert.equal(local(host).lastProcessedInputSequence, 0);
  assert.equal(local(guest).speedMps, 0);
  assert.equal(snapshot(host).match.result, null);
});

test('lost input expires using receipt time and a departed session cannot keep moving', async () => {
  const [host, guest] = await start();
  for (let sequence = 1; sequence <= 8; sequence++) {
    input(host, frame(sequence, { forwardHeld: true, clientTimeMs: 1e15 }));
    await delay(60);
  }
  await until(() => local(host).speedMps > 2, 'accelerated');
  await delay(950);
  assert.equal(local(host).speedMps, 0, 'client timestamps do not extend held timeout');
  input(host, frame(9, { forwardHeld: true, actions: [{ id: 1, kind: 'right' }] }));
  const id = host.room.sessionId;
  await host.room.leave();
  await until(() => snapshot(guest).players.find((p) => p.id === id)?.connection === 'left', 'departure');
  await delay(800);
  const departed = snapshot(guest).players.find((p) => p.id === id);
  assert.equal(departed.participation, 'forfeit');
  assert.equal(departed.speedMps, 0);
  assert.equal(snapshot(guest).match.hostId, guest.room.sessionId);
});

test('flooded actions are bounded per connection without changing a peer', async () => {
  const [host, guest] = await start();
  for (let sequence = 1; sequence <= 40; sequence++) input(host, frame(sequence, { actions: [{ id: sequence, kind: 'right' }] }));
  await until(() => host.messages.some((message) => message.code === 'rateLimited'), 'rate-limited input flood');
  input(guest, frame(1, { forwardHeld: true }));
  await until(() => local(guest).lastProcessedInputSequence === 1, 'independent guest budget');
  assert.ok(local(host).lastProcessedActionId <= 30);
});

test('server stall expires held controls but processes each already-accepted edge once with a real action ACK', () => {
  const buffer = new PlayerInputBuffer('session-player', 250);
  buffer.accept(frame(1, { forwardHeld: true, actions: [{ id: 1, kind: 'right' }] }), 0);
  const resumed = buffer.sample(500);
  assert.equal(resumed.forwardHeld, false);
  assert.deepEqual(resumed.actions, [{ id: 1, kind: 'right' }]);
  const simulation = new MatchSimulation({ world: FIRST_STREET_WORLD, tuning, mode: 'practice', roomCode: 'ABCD2', seed: 1, participants: [{ playerId: 'session-player', nickname: 'Test', joinOrder: 0 }] });
  simulation.advance(1000 / tuning.timing.simulationHz, () => [resumed]);
  assert.equal(simulation.snapshot().players[0].lastProcessedActionId, 1);
  assert.equal(simulation.snapshot().players[0].lastProcessedInputSequence, 1);
  buffer.accept(frame(2, { actions: [{ id: 1, kind: 'right' }] }), 501);
  assert.deepEqual(buffer.sample(502).actions, []);
});
