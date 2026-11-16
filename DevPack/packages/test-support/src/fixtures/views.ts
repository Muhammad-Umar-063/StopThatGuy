// TEST DATA — read-only UI view models for fixture-driven UI work. Every view has
// dataSource "fixture"; UI must label such screens visibly and never present them as live multiplayer.
import {
  DEFAULT_TUNING,
  type AuthoritativeSnapshot,
  type MatchResult,
  type PlayerId,
  type PlayerRecord,
  type ResultView,
  type SettingsView,
  type UiViewModel,
} from "@stopthatguy/shared";
import { deepFreeze } from "./freeze.js";
import {
  FIXTURE_ARRESTED_SNAPSHOT,
  FIXTURE_CAPTURE_RESULT_SNAPSHOT,
  FIXTURE_CHASE_END_TICK,
  FIXTURE_CHASE_SNAPSHOT,
  FIXTURE_ESCAPE_RESULT_SNAPSHOT,
  FIXTURE_LOBBY_SNAPSHOT,
  FIXTURE_PLAYER_IDS,
} from "./snapshots.js";

const SETTINGS: SettingsView = { quality: "auto", muted: false, volume: 0.8, reducedEffects: false };
const CONNECTED = { state: "connected", error: null } as const;
const msPerTick = 1000 / DEFAULT_TUNING.timing.simulationHz;

function playerOf(snapshot: AuthoritativeSnapshot, id: PlayerId): PlayerRecord {
  const found = snapshot.players.find((p) => p.id === id);
  if (!found) throw new Error(`fixture player ${id} missing`);
  return found;
}

function remainingMs(snapshot: AuthoritativeSnapshot) {
  return { phase: snapshot.match.phase, remainingMs: Math.round((FIXTURE_CHASE_END_TICK - snapshot.match.tick) * msPerTick) };
}

function localPlayerView(snapshot: AuthoritativeSnapshot, id: PlayerId) {
  const p = playerOf(snapshot, id);
  return {
    id: p.id,
    participation: p.participation,
    locomotion: p.locomotion,
    speedMps: p.speedMps,
    staminaFraction: p.stamina / DEFAULT_TUNING.movement.staminaMax,
    wanted: p.status.wanted,
    stunned: p.status.stunnedUntilTick !== null,
  };
}

function resultView(snapshot: AuthoritativeSnapshot, result: MatchResult, localId: PlayerId): ResultView {
  const nick = (id: PlayerId) => playerOf(snapshot, id).nickname;
  return {
    outcome: result.outcome,
    reason: result.reason,
    winner: result.winnerId ? { id: result.winnerId, nickname: nick(result.winnerId) } : null,
    localPlayerWon: result.winnerId === localId,
    awards: result.awards.map((a) => ({ kind: a.kind, nickname: nick(a.playerId), value: a.value })),
    deductions: result.deductions.map((d) => ({ nickname: nick(d.playerId), reason: d.reason, amount: d.amount })),
    canRequestRematch: snapshot.match.hostId === localId,
  };
}

const lobby = FIXTURE_LOBBY_SNAPSHOT;

/** Lobby seen by host Ana; Carla is not ready, so Start is unavailable. */
export const FIXTURE_LOBBY_VIEW: UiViewModel = deepFreeze<UiViewModel>({
  dataSource: "fixture",
  connection: CONNECTED,
  phase: "lobby",
  lobby: {
    roomCode: lobby.match.roomCode,
    mode: lobby.match.mode,
    players: lobby.players.map((p) => ({
      id: p.id,
      nickname: p.nickname,
      ready: p.ready,
      isHost: p.id === lobby.match.hostId,
      isLocal: p.id === FIXTURE_PLAYER_IDS.ana,
      connection: p.connection,
    })),
    localIsHost: true,
    canStart: lobby.players.every((p) => p.ready),
    minPlayers: DEFAULT_TUNING.room.minPlayersNormal,
    maxPlayers: DEFAULT_TUNING.room.maxPlayers,
  },
  localPlayer: null,
  robber: null,
  actions: null,
  timer: null,
  messages: [{ id: "fixture-lobby-1", kind: "info", text: "Waiting for every player to be ready." }],
  result: null,
  settings: SETTINGS,
});

/** Chase seen by Bruno on the bicycle: a lane change is possible to the left only. */
export const FIXTURE_CHASE_VIEW: UiViewModel = deepFreeze<UiViewModel>({
  dataSource: "fixture",
  connection: CONNECTED,
  phase: "chase",
  lobby: null,
  localPlayer: localPlayerView(FIXTURE_CHASE_SNAPSHOT, FIXTURE_PLAYER_IDS.bruno),
  robber: { bearing: 0, distanceM: 22, visible: true },
  actions: {
    left: "laneChange",
    right: "none",
    turnLabel: null,
    interact: null,
    canSprint: false,
    canCapture: false,
    canSabotage: false,
  },
  timer: remainingMs(FIXTURE_CHASE_SNAPSHOT),
  messages: [],
  result: null,
  settings: SETTINGS,
});

/** Ana after arrest: wanted, out of competition and spectating. */
export const FIXTURE_ARREST_VIEW: UiViewModel = deepFreeze<UiViewModel>({
  dataSource: "fixture",
  connection: CONNECTED,
  phase: "chase",
  lobby: null,
  localPlayer: localPlayerView(FIXTURE_ARRESTED_SNAPSHOT, FIXTURE_PLAYER_IDS.ana),
  robber: { bearing: -1.2, distanceM: 24, visible: false },
  actions: null,
  timer: remainingMs(FIXTURE_ARRESTED_SNAPSHOT),
  messages: [{ id: "fixture-arrest-1", kind: "warning", text: "Arrested for bicycle-shop theft. Spectating until the round ends." }],
  result: null,
  settings: SETTINGS,
});

/** Results seen by winner and host Ana. */
export const FIXTURE_CAPTURE_RESULTS_VIEW: UiViewModel = deepFreeze<UiViewModel>({
  dataSource: "fixture",
  connection: CONNECTED,
  phase: "results",
  lobby: null,
  localPlayer: localPlayerView(FIXTURE_CAPTURE_RESULT_SNAPSHOT, FIXTURE_PLAYER_IDS.ana),
  robber: null,
  actions: null,
  timer: null,
  messages: [{ id: "fixture-result-1", kind: "event", text: "Hero of the city. Debtor of the bicycle shop." }],
  result: resultView(FIXTURE_CAPTURE_RESULT_SNAPSHOT, FIXTURE_CAPTURE_RESULT_SNAPSHOT.match.result!, FIXTURE_PLAYER_IDS.ana),
  settings: SETTINGS,
});

/** Results seen by Bruno (not host) after the robber escaped. */
export const FIXTURE_NO_WINNER_RESULTS_VIEW: UiViewModel = deepFreeze<UiViewModel>({
  dataSource: "fixture",
  connection: CONNECTED,
  phase: "results",
  lobby: null,
  localPlayer: localPlayerView(FIXTURE_ESCAPE_RESULT_SNAPSHOT, FIXTURE_PLAYER_IDS.bruno),
  robber: null,
  actions: null,
  timer: null,
  messages: [{ id: "fixture-result-2", kind: "event", text: "The robber got away by the river." }],
  result: resultView(FIXTURE_ESCAPE_RESULT_SNAPSHOT, FIXTURE_ESCAPE_RESULT_SNAPSHOT.match.result!, FIXTURE_PLAYER_IDS.bruno),
  settings: SETTINGS,
});

export const FIXTURE_VIEWS = deepFreeze({
  lobby: FIXTURE_LOBBY_VIEW,
  chase: FIXTURE_CHASE_VIEW,
  arrest: FIXTURE_ARREST_VIEW,
  captureResults: FIXTURE_CAPTURE_RESULTS_VIEW,
  noWinnerResults: FIXTURE_NO_WINNER_RESULTS_VIEW,
});
