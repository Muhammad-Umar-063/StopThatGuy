import { type AuthoritativeSnapshot, type ClientConnectionState, type GameTuning, type PlayerId, type RoomErrorCode, type SettingsView, type UiMessage, type UiViewModel } from '@stopthatguy/shared';

/** Presentation derives only from accepted snapshots. Unknown legal actions/visibility stay absent. */
export function createView(snapshot: AuthoritativeSnapshot | null, id: string | null, state: ClientConnectionState, error: RoomErrorCode | null, settings: SettingsView, messages: readonly UiMessage[], tuning: GameTuning): UiViewModel {
  const player = snapshot?.players.find((p) => p.id === id);
  const match = snapshot?.match;
  const connected = snapshot?.players.filter((p) => p.connection === 'connected') ?? [];
  const minPlayers = match?.mode === 'practice' ? tuning.room.minPlayersPractice : tuning.room.minPlayersNormal;
  const localIsHost = id !== null && match?.hostId === id;
  const phase = match?.phase ?? null;
  const result = match?.result;
  const nickname = (playerId: PlayerId) => snapshot?.players.find((p) => p.id === playerId)?.nickname ?? 'Departed player';
  const deadline = phase === 'chase' ? match?.chaseEndTick : match?.phaseEndsAtTick;
  return {
    dataSource: 'server', connection: { state, error }, phase,
    lobby: match ? { roomCode: match.roomCode, mode: match.mode,
      players: connected.map((p) => ({ id: p.id, nickname: p.nickname, ready: p.ready, isHost: p.id === match.hostId, isLocal: p.id === id, connection: p.connection })),
      localIsHost, canStart: state === 'connected' && phase === 'lobby' && localIsHost && connected.length >= minPlayers && connected.every((p) => p.ready), minPlayers, maxPlayers: tuning.room.maxPlayers } : null,
    localPlayer: player ? { id: player.id, participation: player.participation, locomotion: player.locomotion, speedMps: player.speedMps, staminaFraction: Math.min(1, player.stamina / tuning.movement.staminaMax), wanted: player.status.wanted, stunned: player.status.stunnedUntilTick !== null && player.status.stunnedUntilTick > match!.tick } : null,
    robber: null, actions: null,
    timer: match && deadline != null ? { phase: match.phase, remainingMs: Math.max(0, (deadline - match.tick) * 1000 / tuning.timing.simulationHz) } : null,
    messages: messages.map((m) => ({ ...m })), settings: { ...settings },
    result: result ? { outcome: result.outcome, reason: result.reason, winner: result.winnerId ? { id: result.winnerId, nickname: nickname(result.winnerId) } : null,
      localPlayerWon: result.winnerId !== null && result.winnerId === id,
      awards: result.awards.map((a) => ({ kind: a.kind, nickname: nickname(a.playerId), value: a.value })),
      deductions: result.deductions.map((d) => ({ nickname: nickname(d.playerId), reason: d.reason, amount: d.amount })),
      canRequestRematch: state === 'connected' && localIsHost && phase === 'results' } : null,
  };
}
