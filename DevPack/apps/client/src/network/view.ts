import { type AuthoritativeSnapshot, type ClientConnectionState, type GameTuning, type LegalActions, type PlayerId, type RoomErrorCode, type SettingsView, type UiMessage, type UiViewModel } from '@stopthatguy/shared';

/** Presentation derives only from accepted snapshots. Unknown legal actions/visibility stay absent. */
export function createView(snapshot: AuthoritativeSnapshot | null, id: string | null, state: ClientConnectionState, error: RoomErrorCode | null, settings: SettingsView, messages: readonly UiMessage[], tuning: GameTuning, cues: AcceptedChaseCues | null = null): UiViewModel {
  const player = snapshot?.players.find((p) => p.id === id);
  const match = snapshot?.match;
  const connected = snapshot?.players.filter((p) => p.connection === 'connected') ?? [];
  const minPlayers = match?.mode === 'practice' ? tuning.room.minPlayersPractice : tuning.room.minPlayersNormal;
  const localIsHost = id !== null && match?.hostId === id;
  const phase = match?.phase ?? null;
  const result = match?.result;
  const nickname = (playerId: PlayerId) => snapshot?.players.find((p) => p.id === playerId)?.nickname ?? 'Departed player';
  const deadline = phase === 'chase' ? match?.chaseEndTick : match?.phaseEndsAtTick;
  const view: UiViewModel = {
    dataSource: 'server', connection: { state, error }, phase,
    lobby: match ? { roomCode: match.roomCode, mode: match.mode,
      players: connected.map((p) => ({ id: p.id, nickname: p.nickname, ready: p.ready, isHost: p.id === match.hostId, isLocal: p.id === id, connection: p.connection })),
      localIsHost, canStart: state === 'connected' && phase === 'lobby' && localIsHost && connected.length >= minPlayers && connected.every((p) => p.ready), minPlayers, maxPlayers: tuning.room.maxPlayers } : null,
    localPlayer: player ? { id: player.id, participation: player.participation, locomotion: player.locomotion, speedMps: player.speedMps, staminaFraction: Number.isFinite(player.stamina / tuning.movement.staminaMax) ? Math.max(0, Math.min(1, player.stamina / tuning.movement.staminaMax)) : 0, wanted: player.status.wanted, stunned: player.status.stunnedUntilTick !== null && player.status.stunnedUntilTick > match!.tick } : null,
    robber: null, actions: null,
    timer: match && deadline != null ? { phase: match.phase, remainingMs: Math.max(0, (deadline - match.tick) * 1000 / tuning.timing.simulationHz) } : null,
    messages: messages.map((m) => ({ ...m })), settings: { ...settings },
    result: result ? { outcome: result.outcome, reason: result.reason, winner: result.winnerId ? { id: result.winnerId, nickname: nickname(result.winnerId) } : null,
      localPlayerWon: result.winnerId !== null && result.winnerId === id,
      awards: result.awards.map((a) => ({ kind: a.kind, nickname: nickname(a.playerId), value: a.value })),
      deductions: result.deductions.map((d) => ({ nickname: nickname(d.playerId), reason: d.reason, amount: d.amount })),
      canRequestRematch: state === 'connected' && localIsHost && phase === 'results' } : null,
  };
  return composeChaseView(view, snapshot, cues);
}


/** Integration-only input, not a wire schema. The producer must validate transport/version,
 * obtain LegalActions from the authoritative rule query and visibility from the agreed source.
 * Bind both to this exact accepted snapshot object, not a separately sampled camera pose.
 */
export interface AcceptedChaseCues {
  readonly snapshot: AuthoritativeSnapshot;
  readonly playerId: PlayerId;
  readonly legalActions: Readonly<LegalActions> | null;
  readonly robberVisible: boolean | null;
}

/** Internal only: createView supplies the view and snapshot atomically. Does not query rules or visibility. */
function composeChaseView(view: UiViewModel, snapshot: AuthoritativeSnapshot | null, cues: AcceptedChaseCues | null): UiViewModel {
  const empty = { ...view, actions: null, robber: null };
  if (!snapshot || !cues || cues.snapshot !== snapshot || view.connection.state !== 'connected'
    || snapshot.match.phase !== 'chase' || view.phase !== 'chase' || view.localPlayer?.id !== cues.playerId
    || view.lobby && view.lobby.roomCode !== snapshot.match.roomCode) return empty;
  const player = snapshot.players.find(p => p.id === cues.playerId);
  if (!player || player.connection !== 'connected') return empty;
  const legal = cues.legalActions;
  // ActionPromptView cannot represent earlyBuffer. Refuse such frames until a reviewed contract can.
  const early = legal && [legal.left, legal.right].some(option => option.kind === 'turn' && option.earlyBuffer);
  const actions = legal && !early && player.participation === 'active' ? {
    left: legal.left.kind, right: legal.right.kind,
    turnLabel: ([['Left', legal.left], ['Right', legal.right]] as const)
      .flatMap(([side, option]) => option.kind === 'turn' && option.label ? [`${side}: ${option.label}`] : []).join(' · ') || null,
    interact: legal.interact?.kind ?? null, canSprint: legal.canSprint, canCapture: legal.canCapture, canSabotage: legal.canSabotage,
  } : null;
  const robber = snapshot.robber;
  let cue: UiViewModel['robber'] = null;
  if (robber && typeof cues.robberVisible === 'boolean') {
    const dx = robber.pose.position.x - player.pose.position.x, dy = robber.pose.position.y - player.pose.position.y,
      dz = robber.pose.position.z - player.pose.position.z;
    const bearing = Math.atan2(dx, dz) - player.pose.yaw;
    const distanceM = Math.hypot(dx, dy, dz);
    if (Number.isFinite(bearing) && Number.isFinite(distanceM)) cue = {
      bearing: distanceM === 0 ? 0 : Math.atan2(Math.sin(bearing), Math.cos(bearing)), distanceM, visible: cues.robberVisible,
    };
  }
  return { ...view, actions, robber: cue };
}
