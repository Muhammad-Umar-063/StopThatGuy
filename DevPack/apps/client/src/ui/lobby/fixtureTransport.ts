/** DEVELOPMENT STORYBOARD ONLY. No sockets, server, simulation, bots or persistence. */
import { DEFAULT_TUNING, type RoomErrorCode, type UiAdapter, type UiIntent, type UiViewModel } from "@stopthatguy/shared";
import { createFixtureUiAdapter } from "../../../../../packages/test-support/src/fixtures/adapters";
import { FIXTURE_LOBBY_VIEW } from "../../../../../packages/test-support/src/fixtures/views";

export function createLobbyFixtureTransport(delayMs = 450) {
  const idle: UiViewModel = { ...FIXTURE_LOBBY_VIEW, phase: null, lobby: null, messages: [], connection: { state: "idle", error: null } };
  const fixture = createFixtureUiAdapter(idle);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let failure: RoomErrorCode | "server" | null = null;
  let generation = 0;
  const publish = (view: UiViewModel) => fixture.setView(view);
  const adapter: UiAdapter = {
    getView: fixture.getView,
    subscribe: fixture.subscribe,
    dispatch(intent) {
      fixture.dispatch(intent);
      if (intent.type === "leaveRoom") { generation++; clearTimeout(timer); timer = undefined; publish(idle); return; }
      if (timer !== undefined) return;
      const current = fixture.getView();
      const ticket = ++generation;
      const rejected = failure;
      failure = null;
      if (intent.type === "createRoom" || intent.type === "joinRoom") publish({ ...current, connection: { state: "connecting", error: null } });
      timer = setTimeout(() => {
        timer = undefined;
        if (ticket !== generation) return;
        if (rejected) { publish({ ...current, connection: { state: "failed", error: rejected === "server" ? null : rejected } }); return; }
        if (intent.type === "createRoom" || intent.type === "joinRoom") {
          const practice = intent.type === "createRoom" && intent.mode === "practice";
          const host = intent.type === "createRoom";
          const players = FIXTURE_LOBBY_VIEW.lobby!.players.slice(0, practice ? 1 : 2).map((p, i) => ({ ...p, nickname: i === 0 ? intent.nickname : "Inês · fixture", isLocal: i === 0, isHost: host ? i === 0 : i === 1, ready: i !== 0 }));
          publish({ ...idle, phase: "lobby", connection: { state: "connected", error: null }, lobby: { roomCode: intent.type === "joinRoom" ? intent.roomCode : "LX234", mode: practice ? "practice" : "normal", localIsHost: host, canStart: false, players, minPlayers: practice ? DEFAULT_TUNING.room.minPlayersPractice : DEFAULT_TUNING.room.minPlayersNormal, maxPlayers: DEFAULT_TUNING.room.maxPlayers } });
        } else if (intent.type === "setReady" && current.lobby) {
          const players = current.lobby.players.map((p) => p.isLocal ? { ...p, ready: intent.ready } : p);
          publish({ ...current, connection: { state: "connected", error: null }, lobby: { ...current.lobby, players, canStart: players.length >= current.lobby.minPlayers && players.every((p) => p.ready) } });
        } else if (intent.type === "startMatch" && current.lobby?.localIsHost && current.lobby.canStart) {
          publish({ ...current, phase: "countdown", connection: { state: "connected", error: null } });
        }
      }, delayMs);
    },
  };
  return {
    adapter,
    get dispatched(): readonly UiIntent[] { return fixture.dispatched; },
    failNext(code: RoomErrorCode | "server" | null) { failure = code; },
    /** Browser acceptance may publish controlled snapshots; never used by production UI. */
    setView: publish,
    dispose() { generation++; clearTimeout(timer); timer = undefined; },
  };
}
