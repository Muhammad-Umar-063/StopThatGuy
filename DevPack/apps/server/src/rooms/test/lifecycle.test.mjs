import assert from "node:assert/strict";
import { after, afterEach, before, test } from "node:test";
import { createServer } from "node:http";
import { Readable } from "node:stream";
import { setTimeout as delay } from "node:timers/promises";
import { createRouter, defineServer, matchMaker } from "@colyseus/core";
import { Client } from "@colyseus/sdk";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { DEFAULT_TUNING, PROTOCOL_VERSION } from "@stopthatguy/shared";
import { FIXTURE_WORLD, checkSnapshotConsistency } from "@stopthatguy/test-support";
const { createRoomLifecycle } = await import(process.env.T006_BUILT === "1"
  ? "../../../dist/rooms/index.js" : "../index.ts");
const { RoomDirectory } = await import(process.env.T006_BUILT === "1"
  ? "../../../dist/rooms/room-directory.js" : "../room-directory.ts");

// Same rules and tick frequency as production; only test phase durations are shortened.
const tuning = {
  ...DEFAULT_TUNING,
  configVersion: "t006-test-1",
  timing: { ...DEFAULT_TUNING.timing, countdownMs: 500, introMs: 300, chaseTimeLimitMs: 400 },
};
const versions = { protocolVersion: PROTOCOL_VERSION, worldVersion: FIXTURE_WORLD.worldVersion, configVersion: tuning.configVersion };
const peers = [];
let server;
let endpoint;

before(async () => {
  const lifecycle = createRoomLifecycle({ world: FIXTURE_WORLD, tuning });
  const httpServer = createServer();
  server = defineServer({
    greet: false, gracefullyShutdown: false,
    transport: new WebSocketTransport({ server: httpServer, maxPayload: 4096 }),
    rooms: lifecycle.rooms,
    routes: createRouter(lifecycle.endpoints),
  });
  await server.listen(0, "127.0.0.1");
  endpoint = `http://127.0.0.1:${httpServer.address().port}`;
});

afterEach(async () => {
  await Promise.all(peers.splice(0).map((peer) => peer.room.leave()));
  for (const listing of await matchMaker.query({ name: "chase" })) {
    await matchMaker.getLocalRoomById(listing.roomId)?.disconnect();
  }
});
after(async () => { await server?.gracefullyShutdown(false); });

async function until(predicate, label = "condition", timeoutMs = 4000) {
  const deadline = performance.now() + timeoutMs;
  while (performance.now() < deadline) {
    const value = predicate();
    if (value) return value;
    await delay(10);
  }
  assert.fail(`Timed out waiting for ${label}`);
}

async function post(path, body) {
  const response = await fetch(`${endpoint}/rooms/${path}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}

async function connect(result) {
  assert.equal(result.status, 200);
  // Every peer has a separate SDK Client AND WebSocket; no shared storage or session tokens.
  const sdk = new Client(endpoint);
  const room = await sdk.consumeSeatReservation(result.body.reservation);
  room.reconnection.enabled = false;
  const peer = { sdk, room, messages: [], history: [], closed: false };
  room.onMessage("message", (message) => peer.messages.push(message));
  room.onStateChange((state) => { if (state.snapshotJson) peer.history.push(JSON.parse(state.snapshotJson)); });
  room.onLeave(() => { peer.closed = true; });
  peers.push(peer);
  await until(() => room.state?.snapshotJson, "initial authoritative state");
  return peer;
}

async function create(mode = "normal", nickname = "Host") {
  return connect(await post("create", { nickname, mode, versions }));
}
function snapshot(peer) { return JSON.parse(peer.room.state.snapshotJson); }
function code(peer) { return snapshot(peer).match.roomCode; }
async function join(host, nickname = "Guest") { return connect(await post("join", { roomCode: code(host), nickname, versions })); }
function send(peer, command) { peer.room.send("command", command); }
async function rejection(peer, command, expected, channel = "command") {
  const offset = peer.messages.length;
  peer.room.send(channel, command);
  const message = await until(() => peer.messages.slice(offset).find((m) => m.type === "commandRejected"), "command rejection");
  assert.equal(message.code, expected);
  return message;
}
async function ready(...clients) {
  for (const peer of clients) send(peer, { type: "setReady", ready: true });
  await until(() => clients.every((peer) => clients.every((target) =>
    snapshot(peer).players.some((p) => p.id === target.room.sessionId && p.ready))), "requested clients ready");
}
async function roomError(path, options, expected) {
  const result = await post(path, options);
  assert.ok(result.status >= 400);
  assert.equal(result.body.code, expected);
  assert.ok(result.body.message.length > expected.length);
}

test("six independent clients join by normalized code, have distinct identities and synchronized lobby", async () => {
  const host = await create("normal", "  Ana  ");
  assert.match(code(host), /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{5}$/);
  const guests = await Promise.all(Array.from({ length: 5 }, (_, i) => connectPromise(i)));
  async function connectPromise(i) {
    return connect(await post("join", { roomCode: ` ${code(host).toLowerCase()} `, nickname: `Guest ${i}`, versions }));
  }
  const clients = [host, ...guests];
  await until(() => clients.every((c) => snapshot(c).players.length === 6), "six connected players");
  assert.equal(new Set(clients.map((c) => c.room.sessionId)).size, 6);
  assert.equal(new Set(clients.map((c) => c.room.reconnectionToken)).size, 6);
  assert.equal(new Set(clients.map((c) => c.room.roomId)).size, 1);
  assert.equal(snapshot(host).players[0].nickname, "Ana");
  for (const peer of clients) {
    assert.deepEqual(snapshot(peer), snapshot(host));
    assert.deepEqual(checkSnapshotConsistency(snapshot(peer), FIXTURE_WORLD, tuning), []);
    assert.ok(snapshot(peer).players.some((p) => p.id === peer.room.sessionId));
    assert.equal(snapshot(peer).match.hostId, host.room.sessionId);
  }
  await roomError("join", { roomCode: code(host), nickname: "Seventh", versions }, "roomFull");
  await guests[0].room.leave();
  await until(() => snapshot(host).players.length === 5, "full room frees seat");
  const replacement = await join(host, "Replacement");
  assert.notEqual(replacement.room.sessionId, guests[0].room.sessionId);
  await until(() => snapshot(host).players.length === 6, "replacement admitted");
});

test("invalid, unknown, expired, version-mismatched and malformed room requests are distinct", async () => {
  await roomError("join", { roomCode: "I0?", nickname: "Guest", versions }, "invalidRoomCode");
  const host = await create();
  let unknown = "AAAAA";
  if (unknown === code(host)) unknown = "BBBBB";
  await roomError("join", { roomCode: unknown, nickname: "Guest", versions }, "roomNotFound");
  await roomError("create", { nickname: "\u0000", mode: "normal", versions }, "invalidNickname");
  await roomError("create", { nickname: "Host", mode: "normal", versions, hostId: "forged" }, "invalidRequest");
  await roomError("join", { roomCode: code(host), nickname: "G", versions, sessionId: host.room.sessionId }, "invalidRequest");
  for (const field of Object.keys(versions)) {
    const bad = { ...versions, [field]: field === "protocolVersion" ? 99 : "other-1" };
    await roomError("create", { nickname: "Host", mode: "normal", versions: bad }, "versionMismatch");
    await roomError("join", { roomCode: code(host), nickname: "G", versions: bad }, "versionMismatch");
  }
  const expired = code(host);
  const id = host.room.roomId;
  await host.room.leave();
  await until(() => !matchMaker.getLocalRoomById(id), "empty room disposal");
  await roomError("join", { roomCode: expired, nickname: "G", versions }, "roomExpired");
});

test("concurrent reservations enforce six seats, including unconsumed reservations", async () => {
  const host = await create();
  const attempts = await Promise.all(Array.from({ length: 10 }, (_, i) => post("join", { roomCode: code(host), nickname: `Race ${i}`, versions })));
  const accepted = attempts.filter((r) => r.status === 200);
  assert.equal(accepted.length, 5);
  assert.equal(attempts.filter((r) => r.body.code === "roomFull").length, 5);
  await Promise.all(accepted.map(connect));
  await until(() => snapshot(host).players.length === 6, "six admitted sockets");
});

test("HTTP rejects malformed and oversized JSON before parsing, including chunked requests", async () => {
  for (const path of ["create", "join"]) {
    for (const [body, expectedStatus] of [["{", 400], [JSON.stringify({ nickname: "a".repeat(6000) }), 413]]) {
      const response = await fetch(`${endpoint}/rooms/${path}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body,
      });
      assert.equal(response.status, expectedStatus);
      assert.equal((await response.json()).code, "invalidRequest");
    }
    const response = await fetch(`${endpoint}/rooms/${path}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, duplex: "half",
      body: Readable.from((async function* () {
        yield '{"nickname":"';
        for (let i = 0; i < 6; i++) { yield "a".repeat(1000); await delay(1); }
        yield '"}';
      })()),
    });
    assert.equal(response.status, 413);
    assert.equal((await response.json()).code, "invalidRequest");
  }
  assert.equal((await matchMaker.query({ name: "chase" })).length, 0);
});

test("only host can start/rematch, readiness is per session, malformed commands cannot set state", async () => {
  const host = await create();
  await ready(host);
  await rejection(host, { type: "startMatch" }, "wrongPhase"); // normal requires two
  const guest = await join(host);
  await rejection(guest, { type: "startMatch" }, "notHost");
  await rejection(guest, { type: "requestRematch" }, "notHost");
  await rejection(host, { type: "startMatch" }, "wrongPhase"); // guest unready
  await rejection(guest, { type: "setReady", ready: true, playerId: host.room.sessionId }, "malformed");
  await rejection(guest, { type: "setReady", ready: "true" }, "malformed");
  await rejection(guest, { winner: guest.room.sessionId }, "malformed", "unknown-channel");
  await ready(host, guest);
  send(guest, { type: "setReady", ready: false });
  await until(() => snapshot(host).players[1].ready === false, "guest unready");
  assert.equal(snapshot(host).players[0].ready, true);
  await ready(host, guest);
  send(host, { type: "startMatch" });
  await until(() => snapshot(host).match.phase === "countdown", "countdown");
  await rejection(guest, { type: "setReady", ready: false }, "wrongPhase");
  await rejection(host, { type: "startMatch" }, "wrongPhase");
  await roomError("join", { roomCode: code(host), nickname: "Late", versions }, "matchInProgress");
});

test("practice and multiplayer use simulation phases, server events, immutable timeout and fresh rematch", async () => {
  for (const mode of ["practice", "normal"]) {
    const host = await create(mode);
    const clients = mode === "normal" ? [host, await join(host)] : [host];
    await ready(...clients);
    send(host, { type: "startMatch" });
    await until(() => clients.every((p) => snapshot(p).match.phase === "results"), "simulation timeout");
    for (const peer of clients) {
      const phases = new Set(peer.history.map((s) => s.match.phase));
      for (const phase of ["countdown", "intro", "chase", "results"]) assert.ok(phases.has(phase), phase);
      assert.equal(snapshot(peer).match.result.reason, "timeout");
      assert.equal(snapshot(peer).match.result.winnerId, null);
      assert.equal(peer.messages.filter((m) => m.type === "event" && m.event.type === "matchStarted").length, 1);
      assert.equal(peer.messages.filter((m) => m.type === "event" && m.event.type === "matchEnded").length, 1);
      assert.deepEqual(snapshot(peer), snapshot(host));
      for (const state of peer.history) assert.deepEqual(checkSnapshotConsistency(state, FIXTURE_WORLD, tuning), []);
    }
    const result = snapshot(host);
    await delay(120);
    assert.deepEqual(snapshot(host), result);
    if (clients[1]) await rejection(clients[1], { type: "requestRematch" }, "notHost");
    send(host, { type: "requestRematch" });
    await until(() => snapshot(host).match.phase === "lobby", "rematch lobby");
    assert.ok(snapshot(host).players.every((p) => !p.ready && p.route === null));
    assert.equal(snapshot(host).match.result, null);
    assert.equal(snapshot(host).match.tick, 0);
    await ready(...clients);
    send(host, { type: "startMatch" });
    await until(() => snapshot(host).match.phase === "countdown", "second countdown");
    await Promise.all(clients.map((peer) => peer.room.leave()));
  }
});

test("host transfer, countdown cancellation and fresh guest identity after leave", async () => {
  const host = await create();
  const guest = await join(host);
  await ready(host, guest);
  send(host, { type: "startMatch" });
  await until(() => snapshot(guest).match.phase === "countdown", "countdown");
  send(host, { type: "leave" });
  await until(() => host.closed && snapshot(guest).match.phase === "lobby", "cancelled countdown");
  assert.equal(snapshot(guest).match.hostId, guest.room.sessionId);
  assert.ok(snapshot(guest).players.every((p) => !p.ready));
  const replacement = await join(guest, "Host");
  const third = await join(guest, "Third");
  assert.notEqual(replacement.room.sessionId, host.room.sessionId);
  await ready(guest, third, replacement);
  send(guest, { type: "startMatch" });
  await until(() => snapshot(guest).match.phase === "countdown", "new host starts");
});

test("a reserved socket arriving after start is rejected without cancelling the match", async () => {
  const host = await create("practice");
  const reserved = await post("join", { roomCode: code(host), nickname: "Late", versions });
  assert.equal(reserved.status, 200);
  await ready(host);
  send(host, { type: "startMatch" });
  await until(() => snapshot(host).match.phase === "countdown", "countdown");
  await assert.rejects(new Client(endpoint).consumeSeatReservation(reserved.body.reservation), /matchInProgress/);
  assert.equal(snapshot(host).players.length, 1);
  await until(() => snapshot(host).match.phase === "results", "uncancelled simulation");
});

test("countdown continues with enough players and host transfer survives into chase/results", async () => {
  const host = await create();
  const guest = await join(host);
  const third = await join(host, "Third");
  await ready(host, guest, third);
  send(host, { type: "startMatch" });
  await until(() => snapshot(guest).match.phase === "countdown", "countdown");
  send(host, { type: "leave" });
  await until(() => snapshot(guest).match.hostId === guest.room.sessionId, "host transferred");
  assert.equal(snapshot(guest).match.phase, "countdown");
  const departed = snapshot(guest).players.find((p) => p.id === host.room.sessionId);
  assert.equal(departed.connection, "left");
  assert.equal(departed.participation, "forfeit");
  await until(() => snapshot(guest).match.phase === "chase", "chase after departure");
  assert.equal(snapshot(guest).match.hostId, guest.room.sessionId);
  await until(() => snapshot(guest).match.phase === "results", "results after departure");
  assert.equal(snapshot(guest).match.hostId, guest.room.sessionId);
});

test("built-in matchmaking cannot bypass validated public routes", async () => {
  const host = await create();
  const sdk = new Client(endpoint);
  await assert.rejects(sdk.create("chase", { nickname: "Bypass", mode: "normal", versions }), /Use POST/);
  await assert.rejects(sdk.joinById(host.room.roomId, { roomCode: code(host), nickname: "Bypass", versions }), /Use POST/);
  assert.equal(snapshot(host).players.length, 1);
});

test("per-session command rate is bounded without mutating another guest", async () => {
  const host = await create();
  const guest = await join(host);
  for (let i = 0; i < 40; i++) send(guest, { type: "setReady", ready: false });
  await until(() => guest.messages.some((m) => m.code === "rateLimited"), "rate rejection");
  await ready(host);
  assert.equal(snapshot(host).players[0].ready, true);
  assert.equal(snapshot(host).players[1].ready, false);
});

test("socket drops release lobby seats, empty rooms dispose and abandoned reservations expire", async () => {
  const host = await create();
  const guest = await join(host);
  guest.room.connection.close();
  await until(() => guest.closed && snapshot(host).players.length === 1, "dropped guest removed");
  const replacement = await join(host);
  assert.notEqual(replacement.room.sessionId, guest.room.sessionId);
  const unused = await post("create", { nickname: "Never connected", mode: "practice", versions });
  const unusedId = unused.body.reservation.roomId;
  // Exercise real Colyseus expiry with its installed default reservation timeout (15 s).
  await until(() => !matchMaker.getLocalRoomById(unusedId), "abandoned reservation expiry", 20000);
  await roomError("join", { roomCode: unused.body.roomCode, nickname: "G", versions }, "roomExpired");
});

test("last player leaving a running practice room stops simulation and removes the room", async () => {
  const host = await create("practice");
  await ready(host);
  send(host, { type: "startMatch" });
  await until(() => snapshot(host).match.phase === "chase", "running practice");
  const id = host.room.roomId;
  const retained = matchMaker.getLocalRoomById(id);
  await host.room.leave();
  await until(() => !matchMaker.getLocalRoomById(id), "running room disposed");
  const stateAtDisposal = retained.state.snapshotJson;
  await delay(150);
  assert.equal(retained.state.snapshotJson, stateAtDisposal);
  assert.equal(retained.clock.running, false);
});

test("room code collisions retry and recently expired codes are not immediately reused", () => {
  const sequence = ["AAAAA", "AAAAA", "BBBBB", "AAAAA", "BBBBB", "CCCCC"];
  const directory = new RoomDirectory(() => sequence.shift());
  const room = { roomId: "internal", assertJoinable() {} };
  assert.equal(directory.register(room), "AAAAA");
  assert.equal(directory.register(room), "BBBBB");
  directory.remove("AAAAA");
  assert.throws(() => directory.get("AAAAA"), /roomExpired/);
  assert.equal(directory.register(room), "CCCCC");
});
