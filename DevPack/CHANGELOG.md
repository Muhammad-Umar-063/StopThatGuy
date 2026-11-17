# Changelog

## 2026-11-16 — Development pack v1.0

- Recorded the 3D Lisbon chase-game direction, smooth graphics target, keyboard controls and Android baseline.
- Defined architecture, gameplay, camera/input rules, networking, city design, graphics/asset pipeline and acceptance criteria.
- Created 48 dependency-aware implementation tasks and an unstarted status board.
- Added AGENTS.md / CLAUDE.md entry points, parallel-chat ownership rules and change/handoff workflow.
- No game implementation, dependency installation, performance verification or deployment has occurred.

## 2026-11-16 — Optional physics clarification

- Recorded user permission to consider cannon-es for vehicle physics when needed.
- Added the evaluation to T021; Babylon.js remains the selected renderer and simple route-based movement remains the default.
- No engine switch, dependency installation or physics implementation performed.

## 2026-11-16 — Token-efficiency rules

- Added selective reading and context-reuse rules for both assistants.
- Added scoped reviews/testing, focused patches and concise handoffs.
- Clarified that parallel chats can increase total tokens and should be used only for independent ready tasks.
- Updated the pack and archive; no game code implemented or token-saving percentage claimed.

## 2026-11-16 — T001 repository and toolchain setup

- Added npm workspaces (`apps/client`, `apps/server`; `packages/*` reserved) with one root lockfile and exact version pins (see DECISIONS.md).
- Added TypeScript configuration, Vite client with a temporary Babylon.js renderer smoke scene, and a Colyseus server with a `/health` route and no rooms.
- Added root `dev:client`, `dev:server`, `build`, `typecheck`, `check`, `start:server` and `preview:client` commands, a server `.env.example`, and setup instructions in README.md.
- No gameplay, networking between client and server, or deployment.

## 2026-11-16 — T002 shared contracts and fixtures

- Added `@stopthatguy/shared`: IDs and versions, phase/participation/locomotion enumerations, input frames, room commands, authoritative records, results, events, world data, the simulation boundary, UI view models/intents, protocol limits and provisional tuning.
- Added stateless runtime validation for join options and client commands. It rejects malformed, oversized, non-finite and unknown data, and any client-declared outcomes.
- Added `@stopthatguy/test-support` with deterministic fixtures (world, lobby/chase/vehicle/wanted/arrest/result snapshots, event streams, UI views, command samples), consistency checks, and 97 focused tests (`npm test`).
- Wired shared into the client and server (source in dev, compiled output for the production server). `/health` now reports protocol and config versions. Recorded the main-branch-only workflow.

## 2026-11-17 — T003 fixed-step simulation foundation

- Added `@stopthatguy/simulation`, which implements the shared `Simulation` contract. It provides deterministic initialization from world, tuning, seed and participants; an exact one-tick `step` with delta and input validation; the countdown → intro → chase phase clock and the time-limit result; event IDs and draining; and copy-only snapshots.
- Added a seeded sfc32 RNG with explicit state and a caller-owned fixed-step accumulator with bounded catch-up.
- Added the pure movement interface (`@stopthatguy/simulation/movement`) and a hold-position placeholder kernel; movement rules arrive in T009.
- Extended the simulation contract with `SimulationSetup.roomCode` and `ValidatedPlayerInput.sequence`. Fixed the fixture checker for the results phase. The root build now compiles shared, then simulation, then the apps, and `check` runs typecheck, build, then tests.
