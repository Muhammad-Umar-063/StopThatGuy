import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_TUNING, NEUTRAL_HELD_CONTROLS, type LegalActions } from '@stopthatguy/shared';
import { FIXTURE_CHASE_SNAPSHOT, FIXTURE_PLAYER_IDS, FIXTURE_CHASE_VIEW } from '@stopthatguy/test-support';
import { FIRST_STREET_WORLD } from '@stopthatguy/world';
import { createSimulation } from '@stopthatguy/simulation';
import { createView, type AcceptedChaseCues } from './view.js';
const settings = FIXTURE_CHASE_VIEW.settings;
const unavailable: LegalActions = { left: { kind: 'none' }, right: { kind: 'none' }, canSprint: false, interact: null, canCapture: false, canSabotage: false };
const viewOf = (snapshot: typeof FIXTURE_CHASE_SNAPSHOT, cues: AcceptedChaseCues | null = null) => createView(snapshot, snapshot.players[0]!.id, 'connected', null, settings, [], DEFAULT_TUNING, cues);

test('live presentation stays unavailable without a same-snapshot rule and visibility source', () => {
  const snapshot = structuredClone(FIXTURE_CHASE_SNAPSHOT), id = snapshot.players[0]!.id;
  const base = viewOf(snapshot); assert.equal(base.actions, null); assert.equal(base.robber, null);
  const cues = { snapshot, playerId: id, legalActions: unavailable, robberVisible: null };
  assert.equal(viewOf(snapshot, cues).robber, null, 'visibility cannot be inferred from replicated poses');
  assert.equal(viewOf(snapshot, { ...cues, snapshot: structuredClone(snapshot) }).actions, null, 'cross-sample data is rejected even at the same tick');
  assert.equal(viewOf(snapshot, { ...cues, playerId: FIXTURE_PLAYER_IDS.dina }).actions, null);
  assert.equal(createView(snapshot, id, 'disconnected', null, settings, [], DEFAULT_TUNING, cues).actions, null);
  const newer = structuredClone(snapshot); newer.match.tick++; newer.players[0]!.status.stunnedUntilTick = newer.match.tick + 10;
  const newerView = viewOf(newer, cues);
  assert.equal(newerView.localPlayer!.stunned, true); assert.equal(newerView.actions, null); assert.equal(newerView.robber, null);
  snapshot.match.phase = 'results'; assert.equal(viewOf(snapshot, cues).robber, null);
  snapshot.players[0]!.stamina = -50; assert.equal(viewOf(snapshot).localPlayer!.staminaFraction, 0);
});
test('robber bearing is relative to the player, preserves explicit visibility, and never derives capture range', () => {
  for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    const snapshot = structuredClone(FIXTURE_CHASE_SNAPSHOT), player = snapshot.players[0]!;
    player.pose = { position: { x: 5, y: 0, z: 5 }, yaw };
    for (const side of [-1, 1]) {
      snapshot.robber!.pose.position = { x: 5 + Math.cos(yaw) * side, y: 0, z: 5 - Math.sin(yaw) * side };
      const view = viewOf(snapshot, { snapshot, playerId: player.id, legalActions: unavailable, robberVisible: false });
      assert.ok(Math.abs(view.robber!.bearing - side * Math.PI / 2) < 1e-8); assert.ok(Math.abs(view.robber!.distanceM - 1) < 1e-8);
      assert.equal(view.robber!.visible, false); assert.equal(view.actions!.canCapture, false, 'nearby is not eligible');
    }
  }
});
test('mapping handles both turn labels without inversion and refuses unrepresentable early buffers', () => {
  const snapshot = structuredClone(FIXTURE_CHASE_SNAPSHOT), playerId = snapshot.players[0]!.id;
  // Shape-only fixture: no claim that capture or interaction rules are integrated.
  const legal: LegalActions = { ...unavailable, left: { kind: 'turn', junctionId: 'left' as never, toEdgeId: 'west' as never, label: 'Rua da Esquerda' }, right: { kind: 'turn', junctionId: 'right' as never, toEdgeId: 'east' as never, label: 'Rua da Direita' }, canCapture: true };
  const view = viewOf(snapshot, { snapshot, playerId, legalActions: legal, robberVisible: true });
  assert.equal(view.actions!.turnLabel, 'Left: Rua da Esquerda · Right: Rua da Direita'); assert.equal(view.actions!.canCapture, true);
  assert.equal(viewOf(snapshot, { snapshot, playerId, legalActions: { ...legal, left: { ...legal.left as Extract<LegalActions['left'], { kind: 'turn' }>, earlyBuffer: true } }, robberVisible: true }).actions, null);
});
test('composition tracks the merged authoritative movement query through lane and turn windows', () => {
  const simulation = createSimulation(); const playerId = FIXTURE_PLAYER_IDS.ana;
  const state = simulation.createInitialState({ world: FIRST_STREET_WORLD, tuning: DEFAULT_TUNING, seed: 4, mode: 'practice', roomCode: 'HUD22', participants: [{ playerId, nickname: 'HUD Ana', joinOrder: 0 }] });
  const seen = new Set<string>();
  for (let tick = 0; tick < 950; tick++) {
    simulation.step(state, [{ playerId, sequence: tick + 1, ...NEUTRAL_HELD_CONTROLS, forwardHeld: true, actions: [] }], 1000 / DEFAULT_TUNING.timing.simulationHz);
    const snapshot = simulation.readSerializableState(state), legal = simulation.queryLegalActions(state, playerId);
    const view = viewOf(snapshot, { snapshot, playerId, legalActions: legal, robberVisible: null });
    if (snapshot.match.phase !== 'chase') { assert.equal(view.actions, null); continue; }
    assert.equal(view.actions!.left, legal.left.kind); assert.equal(view.actions!.right, legal.right.kind);
    assert.equal(view.actions!.canSprint, legal.canSprint); assert.equal(view.actions!.canCapture, legal.canCapture);
    assert.equal(view.robber, null); seen.add(legal.left.kind); seen.add(legal.right.kind);
    if (seen.has('turn') && seen.has('laneChange')) break;
  }
  assert.ok(seen.has('laneChange')); assert.ok(seen.has('turn'), 'test must actually reach an authored turn window');
});
