// TEST DATA ADAPTERS — conveniences for isolated work against fixtures. They never simulate a server:
// the UI adapter only records intents, and the simulation setup is plain data for a real simulation.
import {
  DEFAULT_TUNING,
  type SimulationParticipant,
  type SimulationSetup,
  type UiAdapter,
  type UiIntent,
  type UiViewModel,
} from "@stopthatguy/shared";
import { deepFreeze } from "./freeze.js";
import { FIXTURE_PLAYER_IDS, FIXTURE_ROOM_CODE } from "./snapshots.js";
import { FIXTURE_LOBBY_VIEW } from "./views.js";
import { FIXTURE_WORLD } from "./world.js";

export const FIXTURE_PARTICIPANTS: readonly SimulationParticipant[] = deepFreeze([
  { playerId: FIXTURE_PLAYER_IDS.ana, nickname: "Fixture Ana", joinOrder: 0 },
  { playerId: FIXTURE_PLAYER_IDS.bruno, nickname: "Fixture Bruno", joinOrder: 1 },
  { playerId: FIXTURE_PLAYER_IDS.carla, nickname: "Fixture Carla", joinOrder: 2 },
]);

/** A valid SimulationSetup on FIXTURE_WORLD for server/simulation tests (T006+). */
export function createFixtureSimulationSetup(overrides: Partial<SimulationSetup> = {}): SimulationSetup {
  return {
    tuning: DEFAULT_TUNING,
    world: FIXTURE_WORLD,
    seed: 20261116,
    mode: "normal",
    roomCode: FIXTURE_ROOM_CODE,
    participants: FIXTURE_PARTICIPANTS,
    ...overrides,
  };
}

export interface FixtureUiAdapter extends UiAdapter {
  /** Replaces the current view (must be a fixture view) and notifies subscribers synchronously. */
  setView(view: UiViewModel): void;
  /** Intents dispatched so far, oldest first. Dispatching never changes the view. */
  readonly dispatched: readonly UiIntent[];
}

/**
 * UiAdapter over fixture views for building UI before the server exists (T012, T018, T038).
 * Only accepts views whose dataSource is "fixture", so the UI can label them; it never fakes a
 * multiplayer response to an intent.
 */
export function createFixtureUiAdapter(initial: UiViewModel = FIXTURE_LOBBY_VIEW): FixtureUiAdapter {
  assertFixtureView(initial);
  let view = initial;
  const listeners = new Set<(view: UiViewModel) => void>();
  const dispatched: UiIntent[] = [];
  return {
    getView: () => view,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    dispatch(intent) {
      dispatched.push(intent);
    },
    setView(next) {
      assertFixtureView(next);
      view = next;
      for (const listener of [...listeners]) listener(view);
    },
    dispatched,
  };
}

function assertFixtureView(view: UiViewModel): void {
  if (view.dataSource !== "fixture") throw new Error('createFixtureUiAdapter only serves views with dataSource "fixture"');
}
