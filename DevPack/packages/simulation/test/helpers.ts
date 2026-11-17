import {
  DEFAULT_TUNING,
  brandId,
  type AuthoritativeSnapshot,
  type GameEvent,
  type GameTuning,
  type PlayerId,
  type Simulation,
  type SimulationSetup,
  type ValidatedPlayerInput,
} from "@stopthatguy/shared";
import { FIXTURE_WORLD } from "@stopthatguy/test-support";
import { getFixedDeltaMs, poseOnRoute, type MovementInput, type MovementKernel, type SimulationState } from "../src/index.js";

export const PLAYERS = {
  ana: brandId<PlayerId>("p-ana"),
  bruno: brandId<PlayerId>("p-bruno"),
  carla: brandId<PlayerId>("p-carla"),
} as const;

/** 1 s countdown, 1 s intro, 2 s chase at 30 Hz: intro at tick 30, chase at 60, timeout at 120. */
export const SHORT_TUNING: GameTuning = {
  ...DEFAULT_TUNING,
  configVersion: "test-short",
  timing: { ...DEFAULT_TUNING.timing, countdownMs: 1_000, introMs: 1_000, chaseTimeLimitMs: 2_000 },
};

/** The chase starts on the first step. */
export const IMMEDIATE_TUNING: GameTuning = {
  ...DEFAULT_TUNING,
  configVersion: "test-immediate",
  timing: { ...DEFAULT_TUNING.timing, countdownMs: 0, introMs: 0 },
};

export function makeSetup(overrides: Partial<SimulationSetup> = {}): SimulationSetup {
  return {
    tuning: DEFAULT_TUNING,
    world: FIXTURE_WORLD,
    seed: 12_345,
    mode: "normal",
    roomCode: "FX7KQ",
    // Deliberately not in join order.
    participants: [
      { playerId: PLAYERS.carla, nickname: "Carla", joinOrder: 2 },
      { playerId: PLAYERS.ana, nickname: "Ana", joinOrder: 0 },
      { playerId: PLAYERS.bruno, nickname: "Bruno", joinOrder: 1 },
    ],
    ...overrides,
  };
}

const held = (forwardHeld: boolean) => ({ forwardHeld, brakeHeld: false, sprintHeld: false, interactHeld: false });

/**
 * Scripted, deterministic inputs for `tick` (the tick the step will produce). Ana holds forward,
 * presses right once (then resends it, as a retrying client would) and later left. Bruno is omitted on
 * every 7th tick. Carla never sends input.
 */
export function scriptedInputs(tick: number): ValidatedPlayerInput[] {
  const inputs: ValidatedPlayerInput[] = [];
  const anaActions =
    tick === 65 ? [{ id: 1, kind: "right" as const }] : tick === 66 ? [{ id: 1, kind: "right" as const }] : tick === 80 ? [{ id: 2, kind: "left" as const }] : [];
  inputs.push({ playerId: PLAYERS.ana, sequence: tick, ...held(tick >= 40 && tick < 100), actions: anaActions });
  if (tick % 7 !== 0) inputs.push({ playerId: PLAYERS.bruno, sequence: tick, ...held(Math.floor(tick / 10) % 2 === 0), actions: [] });
  return inputs;
}

/**
 * TEST DOUBLE, not a game rule: moves forward along the current edge at run speed while forward is held
 * (stopping at the edge end) and shifts one lane instantly per press. T009 implements real movement.
 */
export const testAdvanceKernel: MovementKernel = (current, input, context) => {
  const edge = context.world.edges.get(current.route.edgeId)!.edge;
  const speedMps = input.forwardHeld && !input.brakeHeld ? context.tuning.movement.runSpeedMps : 0;
  const distanceM = Math.min(edge.lengthM, current.route.distanceM + (speedMps * context.dtMs) / 1000);
  let laneIndex = current.route.laneIndex;
  if (input.leftPressed !== input.rightPressed) {
    laneIndex = Math.min(edge.laneOffsetsM.length - 1, Math.max(0, laneIndex + (input.rightPressed ? 1 : -1)));
  }
  const route = { edgeId: current.route.edgeId, distanceM, laneIndex, lateralOffsetM: edge.laneOffsetsM[laneIndex]! };
  return { state: { ...current, route, speedMps }, pose: poseOnRoute(context.world, route) };
};

/** TEST DOUBLE that records every movement input it receives and keeps players in place. */
export function recordingKernel(log: MovementInput[]): MovementKernel {
  return (current, input, context) => {
    log.push({ ...input });
    return { state: { ...current, route: { ...current.route } }, pose: poseOnRoute(context.world, current.route) };
  };
}

export interface Run {
  state: SimulationState;
  snapshots: AuthoritativeSnapshot[];
  events: GameEvent[];
}

/** Runs `ticks` steps from a fresh state, draining events after every step. */
export function runMatch(
  sim: Simulation<SimulationState>,
  setup: SimulationSetup,
  ticks: number,
  inputsFor: (tick: number) => ValidatedPlayerInput[] = scriptedInputs,
): Run {
  const state = sim.createInitialState(setup);
  const dt = getFixedDeltaMs(setup.tuning);
  const snapshots = [sim.readSerializableState(state)];
  const events: GameEvent[] = [];
  for (let tick = 1; tick <= ticks; tick++) {
    sim.step(state, inputsFor(tick), dt);
    snapshots.push(sim.readSerializableState(state));
    events.push(...sim.collectEvents(state));
  }
  return { state, snapshots, events };
}
