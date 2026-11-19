import type { ActionPromptView, UiViewModel } from '@stopthatguy/shared';
import { ROOM_ERRORS } from '../lobby/model.js';

export const clampFraction = (value: number) => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
export function formatTimer(ms: number): string {
  if (!Number.isFinite(ms)) return '—:—';
  const seconds = Math.ceil(Math.max(0, ms) / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
export function bearingLabel(bearing: number): string {
  if (!Number.isFinite(bearing)) return 'Direction unavailable';
  const octant = (Math.round(Math.atan2(Math.sin(bearing), Math.cos(bearing)) / (Math.PI / 4)) + 8) % 8;
  return ['Ahead', 'Ahead right', 'Right', 'Behind right', 'Behind', 'Behind left', 'Left', 'Ahead left'][octant]!;
}
const interactLabels: Record<NonNullable<ActionPromptView['interact']>, string> = {
  borrow: 'Borrow', mount: 'Mount', dismount: 'Dismount', boardLift: 'Board lift', exitLift: 'Exit lift', theft: 'Hold E · Take vehicle',
};
const phaseLabels = { lobby: 'Waiting in lobby', countdown: 'Get ready', intro: 'Robbery in progress', chase: 'Catch the robber', results: 'Chase finished', closed: 'Room closed' };
export function hudModel(view: UiViewModel) {
  const connected = view.connection.state === 'connected';
  const active = connected && view.phase === 'chase' && view.localPlayer?.participation === 'active';
  const actions = active ? view.actions : null;
  const cue = connected && view.phase === 'chase' ? view.robber : null;
  const validCue = cue && Number.isFinite(cue.bearing) && Number.isFinite(cue.distanceM) && cue.distanceM >= 0 ? cue : null;
  const timer = connected && view.timer && Number.isFinite(view.timer.remainingMs) && view.timer.phase === view.phase && ['countdown', 'intro', 'chase'].includes(view.phase ?? '') ? view.timer : null;
  const phase = phaseLabels[view.phase ?? 'closed'];
  const connection = { idle: 'Not connected', connecting: 'Connecting…', connected: '', reconnecting: 'Reconnecting…', disconnected: 'Connection lost · use the menu to rejoin', failed: 'Connection failed · use the menu to retry' }[view.connection.state];
  const result = connected && view.phase === 'results' ? view.result : null;
  const outcome = result ? result.outcome === 'capture'
    ? result.localPlayerWon ? 'You caught the robber!' : `${result.winner?.nickname ?? 'Another player'} caught the robber.`
    : ({ escaped: 'The robber escaped.', timeout: 'Time ran out.', allCompetitorsOut: 'All competitors are out.' }[result.reason as 'escaped' | 'timeout' | 'allCompetitorsOut'] ?? 'Chase ended without a winner.') : '';
  const direction = (side: 'left' | 'right') => !actions ? 'Cue unavailable' : actions[side] === 'turn' ? `Turn ${side}` : actions[side] === 'laneChange' ? `Change lane ${side}` : `No ${side} move`;
  const statuses = connected && view.localPlayer ? [view.localPlayer.wanted && 'Wanted · police alerted', view.localPlayer.stunned && 'Stunned', view.localPlayer.participation !== 'active' && ({ arrested: 'Arrested · out of this chase', forfeit: 'Out of this chase', spectator: 'Spectating' }[view.localPlayer.participation])] .filter(Boolean).join(' · ') : '';
  return {
    fixture: view.dataSource === 'fixture', active, phase: connected ? phase : connection,
    timer: timer ? formatTimer(timer.remainingMs) : '—:—', expired: !!timer && timer.remainingMs <= 0,
    timerHint: timer?.remainingMs === 0 || timer && timer.remainingMs < 0 ? 'Waiting for server update' : timer ? 'Remaining' : 'Timer unavailable',
    stamina: connected && view.localPlayer ? Math.round(clampFraction(view.localPlayer.staminaFraction) * 100) : null,
    statuses, error: view.connection.error ? ROOM_ERRORS[view.connection.error] : '', outcome,
    robber: validCue ? `${bearingLabel(validCue.bearing)} · ${Math.round(validCue.distanceM)} m` : 'Robber cue unavailable',
    visibility: validCue ? validCue.visible ? 'In sight' : 'Out of sight' : 'Visibility unavailable',
    bearing: validCue ? Math.atan2(Math.sin(validCue.bearing), Math.cos(validCue.bearing)) : null,
    left: direction('left'), right: direction('right'), turnLabel: actions?.turnLabel ?? '',
    actionState: !active ? connected && view.phase === 'chase' ? 'Actions unavailable for this player' : 'Actions inactive' : !actions ? 'Action cues unavailable' : 'Available actions',
    prompts: [
      { key: 'Shift + ↑', label: 'Sprint', available: actions?.canSprint === true },
      { key: 'E', label: actions?.interact ? interactLabels[actions.interact] : 'Interact', available: !!actions?.interact },
      { key: 'F', label: 'Capture', available: actions?.canCapture === true },
      { key: 'X', label: 'Shove / kick', available: actions?.canSabotage === true },
    ],
    messages: view.messages.slice(-3).map(m => ({ ...m })),
  };
}
