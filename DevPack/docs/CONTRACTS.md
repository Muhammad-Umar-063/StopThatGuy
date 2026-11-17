# Shared contracts — frozen in T002 (protocol v1)

This file describes responsibilities and required fields. The TypeScript definitions and runtime validation live in `packages/shared` (`@stopthatguy/shared`); see "Implemented interfaces (T002)" at the end for where each part lives and the names that were settled. Only the coordinator merges contract changes during parallel work.

## Identity and versioning

Use opaque room/player/entity IDs. A public room code is a lookup token, not a reconnect credential. Include protocolVersion, worldVersion and configVersion in join/session metadata. Reconnect tokens are private to the session, short-lived and never logged. Nicknames are plain text, length limited and rendered without HTML interpretation.

## Input frame

Fields: monotonically increasing sequence, forwardHeld, brakeHeld, sprintHeld; unique action IDs for edge-triggered left/right, interact, capture and sabotage. Include interactHeld for shop progress. Client timestamps may be diagnostic only. Server tick and validated intent determine outcomes. Acknowledgements include the last processed sequence.

Transport code must preserve an edge action across retries without applying it twice. Reset held controls on focus loss; server neutralizes held state after input timeout. No position, velocity, vehicle ownership, hit result, reward or winner can be declared by a client input message.

## Commands

Before match: create/join room, ready/unready, host start, leave. During match: input frames, reconnect handshake, safe leave. After match: host rematch and leave. Quality/audio settings and local menus never need an authoritative mutation. Validate commands against phase, session, payload bounds and rate limits.

## Authoritative state

| Record | Minimum information |
|---|---|
| Match | phase, server tick, seed, chase start/end tick, route/exit selection, versions, host ID, result |
| Player | ID, nickname, connection/participation state, world pose, route/lane/progress, speed, locomotion, stamina, status timers, vehicle/seat ID, last processed input sequence |
| Robber | pose, route/progress, movement mode, AI state, active escape target |
| Vehicle | ID/type, pose, route/progress, speed, owner ID, passenger slots, availability/borrow/theft flags |
| Police | ID, pose/path, target ID, pursuit/arrest state |
| Interactable | ID/type, state, interaction owner/progress if relevant |
| Result | outcome, winner ID or null, reason, immutable awards/statistics/deductions |

Do not replicate static geometry, full textures or private anti-abuse bookkeeping in each patch. Cosmetic animation phase can be inferred locally where it does not change gameplay.

## Events

Typed server events: matchStarted, mounted/dismounted, liftBoarded/exited, shoveResolved, theftDetected, wantedChanged, arrested, captureStarted/cancelled/resolved, robberEscaped, matchEnded. Each event carries an ID and server tick for deduplication. Reliable state must still allow late/reconnecting clients to reconstruct the current screen without replaying every event. Do not trigger sounds every frame from a persistent boolean.

## World data

Nodes: ID, world position, type. Directed edges: source/target, centerline, length, lane offsets, allowed modes, ground heights, speed limit, branch labels. Junctions: input edge, available branches, turn curves/windows. Content: static collider primitives, triggers, spawns, shop zones, police routes, lift stops, escape volumes, camera obstruction proxies, sector membership. Include schema/world version and a validation report.

## Simulation interface responsibilities

createInitialState(setup); step(state, validatedInputs, fixedDelta); queryLegalActions(state, player); collectEvents(); readSerializableState(). Names may be refined once in T002/T003. Shared movement exposes a pure function for prediction. The server adapter owns serialization and session mapping; simulation never accepts network connections.

## UI/presentation adapter

Required read-only view model: connection state, lobby/players, local player, robber direction/distance, stamina, available actions and turn cue, timer, wanted state, messages, result, quality/audio settings. UI sends named intents through one adapter. Fixture implementations must be visibly labeled in development and replaced by real wiring for integration acceptance.

## Ownership and evolution

T002 owns initial definitions. Later tasks request minimal compatible extensions through the coordinator; code against merged types. Breaking changes require a new protocol version and updates to fixtures, server, client and tests in a coordinated task. Never introduce a local copy of a shared enum/type to bypass a conflict.

## Implemented interfaces (T002)

All exports come from `@stopthatguy/shared` (`packages/shared/src`). Units are suffixed (`Ms`, `M`, `Mps`). Coordinates use the Babylon.js left-handed, Y-up convention, with yaw 0 = +Z and positive yaw toward +X (`geometry.ts`).

| Area | Module | Main exports |
|---|---|---|
| IDs, versions | `ids.ts`, `versions.ts` | Branded `PlayerId`, `VehicleId`, `EdgeId`, …; `Tick`, `ActionId`, `EventId`; `PROTOCOL_VERSION`, `WORLD_SCHEMA_VERSION`, `VersionInfo`, `versionMismatches` |
| Enumerations | `states.ts` | `MatchPhase`, `MatchMode`, `ConnectionStatus`, `ParticipationState`, `LocomotionState`, vehicle/robber/police/interactable states (each with a runtime array) |
| Configuration | `config.ts` | `PROTOCOL_LIMITS` (wire bounds; change ⇒ protocol bump), `DEFAULT_TUNING` + `CONFIG_VERSION` (provisional documented values only) |
| Input | `input.ts` | `InputFrame`, `EdgeAction`, `EDGE_ACTION_KINDS`, `NEUTRAL_HELD_CONTROLS` |
| Commands | `commands.ts` | `CreateRoomOptions`, `JoinRoomOptions`, `ClientCommand`, `COMMAND_PHASES`, `HOST_ONLY_COMMANDS`, `RoomErrorCode`, `ServerMessage` |
| State | `entities.ts`, `results.ts` | `MatchRecord`, `PlayerRecord`, `RobberRecord`, `VehicleRecord`, `PoliceRecord`, `InteractableRecord`, `AuthoritativeSnapshot`, `MatchResult` |
| Events | `events.ts` | `GameEvent` (payload + `id` + `tick`), `GAME_EVENT_TYPES` |
| World | `world.ts` | `WorldData`, `RouteNode`, `RouteEdge`, `Junction`, `ColliderPrimitive`, `Zone`, `Spawn`, `AuthoredRoute`, `WorldValidationReport` |
| Simulation boundary | `simulation.ts` | `Simulation<TState>`, `SimulationSetup` (incl. `roomCode`), `ValidatedPlayerInput` (incl. `sequence`), `LegalActions` |
| UI | `ui.ts` | `UiViewModel` (with `dataSource: "server" \| "fixture"`), `UiIntent`, `UiAdapter` |
| Validation | `validation.ts` | `parseClientCommand`, `parseCreateRoomOptions`, `parseJoinRoomOptions`, `parseInputFrame`, `parseNickname`, `parseRoomCode` → `ValidationResult<T>` |

Settled names and rules:

- Input frames use `sequence`, a uint32 that increases strictly per session and restarts after the `resume` handshake. Edge actions carry an `id` (uint32 ≥ 1) that increases strictly per session. Each frame lists its actions in ascending, unique `id` order, at most 8 per frame. Acknowledgement comes through `PlayerRecord.lastProcessedInputSequence` and `lastProcessedActionId`.
- Clients never send entity IDs. The server chooses capture, sabotage and interaction targets from context. Validation rejects unknown fields and unknown command types, so a client cannot submit positions, ownership, hits, rewards or winners.
- The "reconnect handshake" is the `resume` command, which re-checks `VersionInfo`. Reconnect credentials stay inside the transport and never appear in contract messages.
- `createInitialState` takes a single `SimulationSetup` (tuning, world, seed, mode, room code, participants) and starts the match in `countdown` at tick 0. Lobby and room closing stay with the room (T006). `step` advances exactly one tick. A `fixedDeltaMs` other than 1000 / `simulationHz` throws `RangeError`, as does malformed adapter input; in both cases the state is left unchanged. `collectEvents` drains the events emitted since the last call, as copies. `readSerializableState` returns a fresh deep copy. Event IDs restart at 1 for each match.
- Each step accepts at most one `ValidatedPlayerInput` per player, carrying the current held controls and its frame `sequence`. An omitted player is treated as neutral. Action IDs at or below `lastProcessedActionId` are ignored, so a resent action applies once. Inputs from non-active players are acknowledged but neutralized.
- A junction belongs to one incoming edge, and its branch sides are `left`, `right` or `forward`. A dead-end turnaround is a `forward` branch. Lane offsets are listed left to right, with positive values to the right of travel.
- Validation is stateless. Cross-frame monotonicity, rate limits, phase and host permissions, ranges, speeds, cooldowns and vehicle availability belong to the server and simulation tasks.
- `@stopthatguy/simulation` (T003) implements the contract through `createSimulation({ movement? })`. It also exports the fixed-step clock helpers and the seeded RNG. Its `@stopthatguy/simulation/movement` subpath is the client-safe prediction subset: `MovementKernel`, `MovementState`, `MovementInput`, `poseOnRoute` and `indexWorld`.
- Deterministic test data lives in `@stopthatguy/test-support` (`packages/test-support/src/fixtures`), which provides `FIXTURE_WORLD`, `FIXTURE_SNAPSHOTS`, `FIXTURE_VIEWS`, event sequences, command samples and consistency checks. It is for development and tests only.

## Batch 1 implemented consumers

`@stopthatguy/world` exports frozen `FIRST_STREET_WORLD`, `FIRST_STREET_IDS`
and `AUTHORED_WORLDS`. World layout validation stays in test-support; production
uses trusted authored data. Server bootstrap injects FIRST_STREET_WORLD into
`createRoomLifecycle`; HTTP/SDK admission and snapshot transport are documented
in apps/server/src/rooms/README.md. Keyboard intent APIs are exported from
apps/client/src/input/keyboard/index.ts. These additions do not change protocol v1.
