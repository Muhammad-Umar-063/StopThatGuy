import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { parseNickname, parseRoomCode, type UiViewModel } from "@stopthatguy/shared";
import { FIXTURE_CHASE_VIEW, FIXTURE_LOBBY_VIEW, FIXTURE_PARTICIPANTS, createFixtureSimulationSetup, createFixtureUiAdapter } from "../src/index.js";

describe("fixture UI adapter", () => {
  test("serves fixture views, notifies subscribers and only records intents", () => {
    const adapter = createFixtureUiAdapter();
    const seen: UiViewModel[] = [];
    const unsubscribe = adapter.subscribe((view) => seen.push(view));
    assert.equal(adapter.getView(), FIXTURE_LOBBY_VIEW);

    adapter.dispatch({ type: "setReady", ready: true });
    assert.equal(adapter.getView(), FIXTURE_LOBBY_VIEW, "dispatching never fakes a server response");
    assert.deepEqual(adapter.dispatched, [{ type: "setReady", ready: true }]);

    adapter.setView(FIXTURE_CHASE_VIEW);
    unsubscribe();
    adapter.setView(FIXTURE_LOBBY_VIEW);
    assert.deepEqual(seen, [FIXTURE_CHASE_VIEW]);
  });

  test("refuses views that are not labelled as fixture data", () => {
    const live = { ...FIXTURE_LOBBY_VIEW, dataSource: "server" } as const;
    assert.throws(() => createFixtureUiAdapter(live), /dataSource "fixture"/);
    assert.throws(() => createFixtureUiAdapter().setView(live), /dataSource "fixture"/);
  });
});

describe("fixture simulation setup", () => {
  test("uses valid, normalized participant data and accepts overrides", () => {
    const setup = createFixtureSimulationSetup({ mode: "practice", participants: FIXTURE_PARTICIPANTS.slice(0, 1) });
    assert.equal(setup.mode, "practice");
    assert.equal(setup.participants.length, 1);
    const room = parseRoomCode(setup.roomCode);
    assert.ok(room.ok && room.value === setup.roomCode);
    for (const p of FIXTURE_PARTICIPANTS) {
      const nick = parseNickname(p.nickname);
      assert.ok(nick.ok && nick.value === p.nickname, p.nickname);
    }
  });
});
