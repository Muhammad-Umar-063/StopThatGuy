import type { RoomErrorCode } from "./commands.js";
import type { PlayerId } from "./ids.js";
import type { AwardKind, DeductionReason, MatchResult, NoWinnerReason } from "./results.js";
import type { DirectionalOption, InteractOption } from "./simulation.js";
import type { ConnectionStatus, LocomotionState, MatchMode, MatchPhase, ParticipationState } from "./states.js";

/**
 * Read-only presentation contract. UI code consumes UiViewModel and emits UiIntent through one
 * UiAdapter, so UI can be built against fixtures before the server is complete.
 */

/** "fixture" views must show a visible label in development and never pass as live multiplayer. */
export type DataSource = "server" | "fixture";

export const CLIENT_CONNECTION_STATES = ["idle", "connecting", "connected", "reconnecting", "disconnected", "failed"] as const;
export type ClientConnectionState = (typeof CLIENT_CONNECTION_STATES)[number];

export const QUALITY_PRESETS = ["auto", "low", "medium", "high"] as const;
export type QualityPreset = (typeof QUALITY_PRESETS)[number];

/** Local-only settings; never sent to the server. */
export interface SettingsView {
  readonly quality: QualityPreset;
  readonly muted: boolean;
  /** 0..1 */
  readonly volume: number;
  readonly reducedEffects: boolean;
}

export interface ConnectionView {
  readonly state: ClientConnectionState;
  readonly error: RoomErrorCode | null;
}

export interface LobbyPlayerView {
  readonly id: PlayerId;
  readonly nickname: string;
  readonly ready: boolean;
  readonly isHost: boolean;
  readonly isLocal: boolean;
  readonly connection: ConnectionStatus;
}

export interface LobbyView {
  readonly roomCode: string;
  readonly mode: MatchMode;
  readonly players: readonly LobbyPlayerView[];
  readonly localIsHost: boolean;
  readonly canStart: boolean;
  readonly minPlayers: number;
  readonly maxPlayers: number;
}

export interface LocalPlayerView {
  readonly id: PlayerId;
  readonly participation: ParticipationState;
  readonly locomotion: LocomotionState;
  readonly speedMps: number;
  /** 0..1 of staminaMax. */
  readonly staminaFraction: number;
  readonly wanted: boolean;
  readonly stunned: boolean;
}

export interface RobberCueView {
  /** Radians relative to the local player's facing; positive = to the right. */
  readonly bearing: number;
  readonly distanceM: number;
  readonly visible: boolean;
}

/** Available actions and the turn/lane cue for each direction (from LegalActions). */
export interface ActionPromptView {
  readonly left: DirectionalOption["kind"];
  readonly right: DirectionalOption["kind"];
  readonly turnLabel: string | null;
  readonly interact: InteractOption["kind"] | null;
  readonly canSprint: boolean;
  readonly canCapture: boolean;
  readonly canSabotage: boolean;
}

export interface TimerView {
  readonly phase: MatchPhase;
  readonly remainingMs: number;
}

export interface UiMessage {
  readonly id: string;
  readonly kind: "info" | "warning" | "event";
  /** Plain text; render without HTML interpretation. */
  readonly text: string;
}

export interface ResultView {
  readonly outcome: MatchResult["outcome"];
  readonly reason: "captured" | NoWinnerReason;
  readonly winner: { readonly id: PlayerId; readonly nickname: string } | null;
  readonly localPlayerWon: boolean;
  readonly awards: readonly { readonly kind: AwardKind; readonly nickname: string; readonly value: number | null }[];
  readonly deductions: readonly { readonly nickname: string; readonly reason: DeductionReason; readonly amount: number }[];
  readonly canRequestRematch: boolean;
}

export interface UiViewModel {
  readonly dataSource: DataSource;
  readonly connection: ConnectionView;
  /** Null before joining a room. */
  readonly phase: MatchPhase | null;
  readonly lobby: LobbyView | null;
  readonly localPlayer: LocalPlayerView | null;
  readonly robber: RobberCueView | null;
  readonly actions: ActionPromptView | null;
  readonly timer: TimerView | null;
  readonly messages: readonly UiMessage[];
  readonly result: ResultView | null;
  readonly settings: SettingsView;
}

export type UiIntent =
  | { type: "createRoom"; nickname: string; mode: MatchMode }
  | { type: "joinRoom"; roomCode: string; nickname: string }
  | { type: "setReady"; ready: boolean }
  | { type: "startMatch" }
  | { type: "leaveRoom" }
  | { type: "requestRematch" }
  | { type: "changeSettings"; settings: Partial<SettingsView> };

export interface UiAdapter {
  getView(): UiViewModel;
  /** Returns an unsubscribe function. */
  subscribe(listener: (view: UiViewModel) => void): () => void;
  dispatch(intent: UiIntent): void;
}
