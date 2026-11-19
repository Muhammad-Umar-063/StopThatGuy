import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FIXTURE_CHASE_VIEW, FIXTURE_CAPTURE_RESULTS_VIEW } from '@stopthatguy/test-support';
import { bearingLabel, clampFraction, formatTimer, hudModel } from './model.js';

test('timer and stamina show zero honestly, clamp fractions and reject nonfinite values', () => {
  assert.deepEqual([-1, 0, 0.5, 3, NaN, Infinity].map(clampFraction), [0, 0, 0.5, 1, 0, 0]);
  assert.deepEqual([-100, 0, 1, 59999, 60000, 360000, NaN].map(formatTimer), ['0:00', '0:00', '0:01', '1:00', '1:00', '6:00', '—:—']);
  assert.equal(hudModel({ ...FIXTURE_CHASE_VIEW, timer: { phase: 'chase', remainingMs: NaN } }).timerHint, 'Timer unavailable');
  for (const phase of ['countdown', 'intro', 'chase'] as const) {
    const model = hudModel({ ...FIXTURE_CHASE_VIEW, phase, timer: { phase, remainingMs: -5 }, localPlayer: { ...FIXTURE_CHASE_VIEW.localPlayer!, staminaFraction: -1 } });
    assert.equal(model.timer, '0:00'); assert.equal(model.expired, true); assert.match(model.timerHint, /server/); assert.equal(model.stamina, 0);
  }
});
test('bearing uses the player-facing right-positive convention including wrap and behind', () => {
  assert.deepEqual([0, Math.PI / 2, -Math.PI / 2, Math.PI, 2 * Math.PI, -Math.PI / 4].map(bearingLabel), ['Ahead', 'Right', 'Left', 'Behind', 'Ahead', 'Ahead left']);
  assert.equal(bearingLabel(NaN), 'Direction unavailable');
});
test('unavailable and inactive data never leaves enabled or misleading action cues', () => {
  const empty = hudModel({ ...FIXTURE_CHASE_VIEW, robber: null, actions: null });
  assert.match(empty.robber, /unavailable/); assert.match(empty.left, /unavailable/); assert.ok(empty.prompts.every(p => !p.available));
  for (const state of ['connecting', 'reconnecting', 'disconnected', 'failed', 'idle'] as const) {
    const model = hudModel({ ...FIXTURE_CHASE_VIEW, connection: { state, error: null } });
    assert.equal(model.timer, '—:—'); assert.equal(model.bearing, null); assert.equal(model.stamina, null); assert.ok(model.prompts.every(p => !p.available));
  }
  const result = hudModel(FIXTURE_CAPTURE_RESULTS_VIEW); assert.match(result.outcome, /caught/); assert.ok(result.prompts.every(p => !p.available));
});
test('turn/lane/blocked labels and every contextual action preserve the accepted meaning', () => {
  const view = { ...FIXTURE_CHASE_VIEW, actions: { ...FIXTURE_CHASE_VIEW.actions!, left: 'turn' as const, right: 'laneChange' as const, turnLabel: 'Left: Rua do Banco', canCapture: false } };
  assert.equal(hudModel(view).left, 'Turn left'); assert.equal(hudModel(view).right, 'Change lane right');
  for (const interact of ['mount', 'dismount', 'borrow', 'boardLift', 'exitLift', 'theft'] as const) {
    const model = hudModel({ ...view, actions: { ...view.actions, interact } });
    assert.ok(model.prompts[1]!.available); assert.equal(model.prompts[2]!.available, false);
    assert.ok(model.prompts[1]!.label.length > 0);
  }
});
test('wanted/stunned/arrest and out-of-sight cues stay textual; malformed cues fail closed', () => {
  const model = hudModel({ ...FIXTURE_CHASE_VIEW, localPlayer: { ...FIXTURE_CHASE_VIEW.localPlayer!, wanted: true, stunned: true, participation: 'arrested' }, robber: { bearing: -1, distanceM: 12, visible: false } });
  assert.match(model.statuses, /Wanted.*Stunned.*Arrested/); assert.equal(model.visibility, 'Out of sight'); assert.equal(model.active, false);
  assert.equal(hudModel({ ...FIXTURE_CHASE_VIEW, robber: { bearing: Infinity, distanceM: 12, visible: true } }).bearing, null);
});
