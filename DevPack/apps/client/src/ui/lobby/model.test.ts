import assert from "node:assert/strict";
import { test } from "node:test";
import { ROOM_ERROR_CODES, type UiViewModel } from "@stopthatguy/shared";
import { FIXTURE_LOBBY_VIEW } from "../../../../../packages/test-support/src/fixtures/views";
import { createLobbyFixtureTransport } from "./fixtureTransport";
import { lobbyPermissions, ROOM_ERRORS } from "./model";

const wait = () => new Promise((r) => setTimeout(r, 25));

test("permissions require a connected local member, host role, lobby phase and adapter approval", () => {
  const base: UiViewModel = { ...FIXTURE_LOBBY_VIEW, lobby: { ...FIXTURE_LOBBY_VIEW.lobby!, canStart: true } };
  assert.equal(lobbyPermissions(base).start, true);
  for (const view of [
    { ...base, phase: "countdown" as const },
    { ...base, connection: { state: "reconnecting" as const, error: null } },
    { ...base, lobby: { ...base.lobby!, localIsHost: false } },
    { ...base, lobby: { ...base.lobby!, canStart: false } },
    { ...base, lobby: { ...base.lobby!, players: [] } },
  ]) assert.equal(lobbyPermissions(view).start, false);
  assert.equal(lobbyPermissions({ ...base, phase: "chase" }).ready, false);
});

test("every protocol room error has distinct actionable copy", () => {
  assert.equal(new Set(Object.values(ROOM_ERRORS)).size, ROOM_ERROR_CODES.length);
  for (const code of ROOM_ERROR_CODES) assert.ok(ROOM_ERRORS[code].length > 40);
});

test("fixture cancellation suppresses a stale admission and allows a subsequent request", async () => {
  const fixture = createLobbyFixtureTransport(5);
  fixture.adapter.dispatch({ type: "createRoom", nickname: "Ana", mode: "normal" });
  fixture.adapter.dispatch({ type: "leaveRoom" });
  await wait();
  assert.equal(fixture.adapter.getView().lobby, null);
  fixture.adapter.dispatch({ type: "joinRoom", nickname: "Bia", roomCode: "ABCDE" });
  await wait();
  assert.equal(fixture.adapter.getView().lobby?.localIsHost, false);
  assert.equal(fixture.adapter.getView().dataSource, "fixture");
  fixture.dispose();
});

test("fixture errors are one-shot, no ready optimism, start waits for a host-ready view", async () => {
  const fixture = createLobbyFixtureTransport(5);
  fixture.failNext("roomFull");
  fixture.adapter.dispatch({ type: "createRoom", nickname: "Ana", mode: "practice" });
  await wait();
  assert.equal(fixture.adapter.getView().connection.error, "roomFull");
  fixture.adapter.dispatch({ type: "createRoom", nickname: "Ana", mode: "practice" });
  await wait();
  fixture.adapter.dispatch({ type: "setReady", ready: true });
  assert.equal(fixture.adapter.getView().lobby?.players[0]?.ready, false);
  await wait();
  assert.equal(fixture.adapter.getView().lobby?.canStart, true);
  fixture.adapter.dispatch({ type: "startMatch" });
  await wait();
  assert.equal(fixture.adapter.getView().phase, "countdown");
  fixture.dispose();
});
