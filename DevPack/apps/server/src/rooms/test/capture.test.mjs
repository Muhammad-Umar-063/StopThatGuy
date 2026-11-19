import assert from "node:assert/strict";
import { after, afterEach, before, test } from "node:test";
import { createServer } from "node:http";
import { setTimeout as delay } from "node:timers/promises";
import { createRouter, defineServer, matchMaker } from "@colyseus/core";
import { Client } from "@colyseus/sdk";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { DEFAULT_TUNING, PROTOCOL_VERSION } from "@stopthatguy/shared";
import { FIXTURE_WORLD } from "@stopthatguy/test-support";
const { createRoomLifecycle } = await import(process.env.T017_BUILT === "1"
  ? "../../../dist/rooms/index.js" : "../index.ts");

// Deliberately isolated rule arena, not a claim of normal authored-city playability.
// Real default movement/simulation/transport, with robber stopped at a foot-only dead end.
const world = structuredClone(FIXTURE_WORLD);
world.worldVersion = "capture-fixture-1";
world.edges[0].allowedModes = ["foot"]; world.edges[0].laneOffsetsM = [0];
world.routes = []; world.junctions = []; world.zones = []; world.colliders = [];
for (const spawn of world.spawns) spawn.placement = { edgeId: world.edges[0].id,
  distanceM: world.edges[0].lengthM - (spawn.kind === "robber" ? 0 : 1), laneIndex: 0 };
const tuning = { ...DEFAULT_TUNING, timing: { ...DEFAULT_TUNING.timing,
  countdownMs: 0, introMs: 0, chaseTimeLimitMs: 1800 } };
const versions = { protocolVersion: PROTOCOL_VERSION, worldVersion: world.worldVersion, configVersion: tuning.configVersion };
const peers = [];
let server, endpoint;
before(async () => {
  const lifecycle = createRoomLifecycle({ world, tuning });
  const httpServer = createServer();
  server = defineServer({ greet: false, gracefullyShutdown: false,
    transport: new WebSocketTransport({ server: httpServer, maxPayload: 4096 }),
    rooms: lifecycle.rooms, routes: createRouter(lifecycle.endpoints) });
  await server.listen(0, "127.0.0.1");
  endpoint = `http://127.0.0.1:${httpServer.address().port}`;
});
afterEach(async () => {
  await Promise.all(peers.splice(0).filter(p => !p.closed).map(p => p.room.leave()));
  for (const listing of await matchMaker.query({ name: "chase" })) await matchMaker.getLocalRoomById(listing.roomId)?.disconnect();
});
after(async () => { await server?.gracefullyShutdown(false); });
async function until(predicate, label, timeoutMs = 5000) {
  const deadline = performance.now() + timeoutMs;
  while (performance.now() < deadline) { const value = predicate(); if (value) return value; await delay(10); }
  assert.fail(`Timed out: ${label}`);
}
async function connect(path, options) {
  const response = await fetch(`${endpoint}/rooms/${path}`, { method: "POST",
    headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...options, versions }) });
  assert.equal(response.status, 200);
  const sdk = new Client(endpoint), room = await sdk.consumeSeatReservation((await response.json()).reservation);
  room.reconnection.enabled = false;
  const peer = { sdk, room, messages: [], closed: false };
  room.onMessage("message", m => peer.messages.push(m)); room.onLeave(() => { peer.closed = true; });
  peers.push(peer); await until(() => room.state?.snapshotJson, "initial snapshot"); return peer;
}
const snapshot = p => JSON.parse(p.room.state.snapshotJson);
const events = (p, type) => p.messages.filter(m => m.type === "event" && m.event.type === type).map(m => m.event);
const send = (p, command) => p.room.send("command", command);
function capture(p, id = 1, sequence = id, clientTimeMs = null) {
  send(p, { type: "input", frame: { sequence, forwardHeld: false, brakeHeld: false, sprintHeld: false,
    interactHeld: false, actions: [{ id, kind: "capture" }], clientTimeMs } });
}
async function started(mode = "normal") {
  const host = await connect("create", { nickname: "Host", mode });
  const guest = mode === "normal" ? await connect("join", { nickname: "Guest", roomCode: snapshot(host).match.roomCode }) : null;
  const clients = guest ? [host, guest] : [host];
  for (const p of clients) send(p, { type: "setReady", ready: true });
  await until(() => snapshot(host).players.length === clients.length && snapshot(host).players.every(p => p.ready), "ready");
  send(host, { type: "startMatch" });
  await until(() => clients.every(p => snapshot(p).match.phase === "chase"), "chase");
  if (guest) assert.notEqual(host.room.sessionId, guest.room.sessionId);
  return { host, guest, clients };
}

test("independent clients receive the same one-shot authoritative capture/result; forged payloads and retries cannot win", async () => {
  const { host, guest, clients } = await started();
  send(guest, { type: "input", frame: { sequence: 1, forwardHeld: false, brakeHeld: false,
    sprintHeld: false, interactHeld: false, actions: [{ id: 1, kind: "capture", winnerId: guest.room.sessionId }], clientTimeMs: 0 } });
  await until(() => guest.messages.some(m => m.type === "commandRejected" && m.code === "malformed"), "forged capture rejected");
  capture(host, 1, 1, 999999999);
  await until(() => events(guest, "captureStarted").length, "capture start");
  await delay(40); capture(host, 1, 2, 0);
  await until(() => clients.every(p => snapshot(p).match.result), "matching result");
  const result = snapshot(host).match.result;
  assert.equal(result.winnerId, host.room.sessionId); assert.equal(result.reason, "captured");
  assert.deepEqual(snapshot(guest).match.result, result);
  for (const p of clients) {
    assert.equal(events(p, "captureStarted").length, 1);
    assert.equal(events(p, "captureResolved").length, 1);
    assert.equal(events(p, "matchEnded").length, 1);
    assert.equal(events(p, "captureResolved")[0].tick - events(p, "captureStarted")[0].tick, 11);
  }
  capture(guest, 2, 2, 0); await delay(150);
  assert.deepEqual(snapshot(host).match.result, result);
  assert.equal(events(host, "matchEnded").length, 1);
  send(host, { type: "requestRematch" }); await until(() => snapshot(guest).match.phase === "lobby", "rematch lobby");
  assert.equal(snapshot(host).match.result, null); assert.equal(snapshot(guest).players.every(p => !p.ready), true);
});

test("a real socket disconnect during wind-up forfeits authoritative state and cannot win", async () => {
  const { host, guest } = await started(); capture(host);
  await until(() => events(guest, "captureStarted").length, "wind-up observed by independent peer");
  // Transport disconnect, not the game's explicit leave command; reconnect is disabled.
  host.room.connection.close();
  await until(() => snapshot(guest).players.find(p => p.id === host.room.sessionId)?.participation === "forfeit", "authoritative forfeit");
  await until(() => events(guest, "captureCancelled").length, "departure cancellation");
  assert.equal(events(guest, "captureCancelled")[0].playerId, host.room.sessionId);
  assert.equal(events(guest, "captureCancelled")[0].reason, "ineligible");
  await until(() => snapshot(guest).match.result, "round result after departure");
  assert.equal(snapshot(guest).match.result.winnerId, null);
  assert.equal(snapshot(guest).match.result.reason, "timeout");
  assert.equal(events(guest, "captureResolved").length, 0);
  assert.equal(events(guest, "matchEnded").length, 1);
  assert.equal(snapshot(guest).match.hostId, guest.room.sessionId);
});

test("practice uses identical capture rules and repeated rooms discard capture memory", async () => {
  const { host } = await started("practice"); capture(host);
  await until(() => snapshot(host).match.result, "practice capture");
  assert.equal(snapshot(host).match.result.winnerId, host.room.sessionId);
  const roomId = host.room.roomId; await host.room.leave();
  await until(() => !matchMaker.getLocalRoomById(roomId), "room disposed");
  const next = await started("practice");
  assert.notEqual(next.host.room.sessionId, host.room.sessionId);
  assert.equal(events(next.host, "captureStarted").length, 0);
  capture(next.host); await until(() => snapshot(next.host).match.result, "fresh capture");
  assert.equal(snapshot(next.host).match.result.winnerId, next.host.room.sessionId);
});

test("old protocol/config peers are rejected and current client decoder accepts both new cancellation reasons", async () => {
  const { decodeMessage, decodeSnapshot } = await import("../../../../client/src/network/decode.ts");
  const host = await connect("create", { nickname: "VersionHost", mode: "normal" });
  for (const old of [{ ...versions, protocolVersion: 1 }, { ...versions, configVersion: "provisional-3" }]) {
    for (const path of ["create", "join"]) {
      const body = path === "create" ? { nickname: "Old", mode: "normal", versions: old }
        : { nickname: "Old", roomCode: snapshot(host).match.roomCode, versions: old };
      const response = await fetch(`${endpoint}/rooms/${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      assert.equal(response.status, 409); assert.equal((await response.json()).code, "versionMismatch");
    }
    assert.throws(() => decodeSnapshot(host.room.state.snapshotJson, old, host.room.sessionId), e => e.code === "versionMismatch");
  }
  for (const reason of ["notFacing", "ineligible"]) {
    const message = { type: "event", event: { type: "captureCancelled", playerId: host.room.sessionId, reason, tick: 2, id: 1 } };
    assert.deepEqual(decodeMessage(message), message);
  }
  assert.throws(() => decodeMessage({ type: "event", event: { type: "captureCancelled", playerId: host.room.sessionId,
    reason: "invented", tick: 2, id: 1 } }), e => e.code === "invalidRequest");
});
