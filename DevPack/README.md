# Stop That Guy! — development pack

Working title. Version 1.0 · 16 November 2026.

This pack is the source of truth for developing a 3D multiplayer browser chase game with Claude and ChatGPT. It contains specifications, decisions, task definitions, and collaboration records. It contains **no implementation prompts and no game implementation**. Nothing is deployed or tested yet.

## Start here

1. Extract this folder and use its contents as the root of the game repository. Keep `AGENTS.md`, `CLAUDE.md`, and `README.md` at that root.
2. Read [AGENTS.md](AGENTS.md), [the product brief](docs/PRODUCT.md), and [decisions](docs/DECISIONS.md).
3. Read [parallel working rules](docs/PARALLEL_WORK.md) before opening concurrent coding chats.
4. Use [the task backlog](tasks/BACKLOG.md) to select work. T001 is the first implementation task. T001–T004 establish the interfaces; the first four-task parallel batch is T005–T008.
5. Track actual task state in [board.json](tasks/board.json). The backlog contains definitions; the board contains status. A coordinator owns board edits.
6. Follow [token-efficiency rules](docs/TOKEN_EFFICIENCY.md): the pack is reference material, not a mandatory full read on every task. Give each chat access to the same committed specification and its task's relevant files. Ordinary browser chats do not automatically share repository state, files, or changes.

## Current scope

Full 3D, third-person browser game; fictional robbery in a condensed Lisbon neighborhood based on Baixa and Alfama; 2–6 human players and one AI robber; one-player practice through the same simulation. Smooth natural proportions, not blocky characters. Arrow-key road movement with contextual lane changes/turns; automatic chase camera. Desktop keyboard-only gameplay and menus; Android landscape touch equivalent. Low-end performance is a measured target, not a verified claim.

## File index

| File | Purpose |
|---|---|
| [AGENTS.md](AGENTS.md) | Instructions for coding agents |
| [CLAUDE.md](CLAUDE.md) | Claude entry point; imports the same rules |
| [PRODUCT.md](docs/PRODUCT.md) | Scope, user experience, and completion criteria |
| [DECISIONS.md](docs/DECISIONS.md) | Confirmed direction, defaults, unresolved details |
| [CONTROLS.md](docs/CONTROLS.md) | Arrow keys, junctions, camera, touch and focus rules |
| [GAMEPLAY.md](docs/GAMEPLAY.md) | Match states, thief, vehicles, sabotage, crime, results |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | Repository structure and system responsibilities |
| [CONTRACTS.md](docs/CONTRACTS.md) | Shared data, commands, simulation and UI interfaces |
| [NETWORKING.md](docs/NETWORKING.md) | Authority, prediction, reconnect and abuse handling |
| [CITY.md](docs/CITY.md) | Lisbon map design and route rules |
| [GRAPHICS.md](docs/GRAPHICS.md) | Art direction, camera presentation, quality budgets |
| [ASSETS.md](docs/ASSETS.md) | Models, animation, licenses, import and optimization |
| [TESTING.md](docs/TESTING.md) | Functional, multiplayer, device and release checks |
| [DEPLOYMENT.md](docs/DEPLOYMENT.md) | Environments, configuration and deployment requirements |
| [TOKEN_EFFICIENCY.md](docs/TOKEN_EFFICIENCY.md) | Selective reading, focused edits and concise handoffs |
| [PARALLEL_WORK.md](docs/PARALLEL_WORK.md) | 3–4 chats, ownership, dependencies and merging |
| [CHANGE_PROCESS.md](docs/CHANGE_PROCESS.md) | Turn new requests into tasks and execute them |
| [BACKLOG.md](tasks/BACKLOG.md) | 48 implementation tasks with dependencies and acceptance |
| [board.json](tasks/board.json) | Machine-readable task status and dependencies |
| [ACTIVE_WORK.md](coordination/ACTIVE_WORK.md) | Active claims, branches and integration gate |
| [HANDOFF_TEMPLATE.md](coordination/HANDOFF_TEMPLATE.md) | Short completion record; not an implementation prompt |
| [CHANGELOG.md](CHANGELOG.md) | Actual completed changes |
| [REFERENCES.md](docs/REFERENCES.md) | Official technical and city references |

## Implementation milestones

- T001–T004: foundations and shared interfaces.
- T005–T020: controls, one finished street, city blockout and first online chase.
- T021–T028: transport, rivalry, touch controls and resilience.
- T029–T040: crime, police, results, polish and multiplayer testing.
- T041–T048: hardening, device acceptance and release.

Forty-eight tasks are reviewable work packages, not forty-eight prompts or equal-duration units. Revisions create new tasks; they do not silently expand completed tasks. The earlier 6–10 week estimate is provisional; Android support and actual asset availability must be reassessed after the first visual/device test.

## First action

Execute T001 when instructed to begin implementation. Do not create the whole game from this documentation request. T001 must add accurate installation and development commands here after they actually exist and work.
