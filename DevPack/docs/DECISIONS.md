# Decisions and defaults

Updated: 16 November 2026. These distinguish user direction from implementation assumptions.

## Established direction

| ID | Decision | Basis |
|---|---|---|
| D001 | Full 3D, automatic third-person chase view | User explicitly replaced the 2D proposal |
| D002 | Smooth graphics and natural proportions; no Roblox-like blocky look | Explicit visual constraint |
| D003 | Low-end device support matters | Explicit performance constraint |
| D004 | Desktop movement uses arrows; side keys turn at junctions and change lanes otherwise | Explicit control description |
| D005 | No desktop mouse required | Explicit control constraint |
| D006 | Lisbon, adapted Baixa/Alfama neighborhood | Assistant selected it; user accepted the direction |
| D007 | AI robber and actual competing players; transport, risky shop theft, sabotage, mayor's reward | Original concept and accepted MVP scope |
| D008 | Claude and ChatGPT share development; 3–4 concurrent chats | Explicit collaboration requirement |
| D009 | New user changes become tasks and are executed; prompts only on request | Explicit workflow requirement |

## Working defaults, changeable without redesigning the whole game

| ID | Default | Status / revisit point |
|---|---|---|
| D010 | Babylon.js + TypeScript + Vite; Node.js + Colyseus | Proposed stack accepted in overall direction; pin versions in T001 |
| D011 | Desktop plus Android landscape | Broad “ye” was interpreted as both; no exact hardware confirmed |
| D012 | Hold Up to advance; release decelerates; Down brakes; no auto-run | Earlier question remained unanswered. Use this provisional default for T007/T009 |
| D013 | Shift sprint, E interact/mount/dismount, F capture, X shove/kick, Esc menu | Proposed secondary bindings; movement remains arrow-only |
| D014 | 2–6 human players, 1-player practice, one AI thief | MVP sizing default |
| D015 | 6-minute chase limit plus short intro; tune within 5–8 minutes | Initial tuning, not approved exact balance |
| D016 | Stylized realism, daylight, compact 6–8 block map | Practical art/map starting point |
| D017 | No persistent accounts/database; one server instance initially | MVP infrastructure choice |
| D018 | Server simulation 30 Hz; patches initially 15 Hz | Profiling defaults, not proven optimal values |
| D019 | Lane/path-constrained movement, authored foot shortcuts and turn windows | Implementation of user's road controls; no general free steering |
| D020 | Simple kinematic collision and graph-based movement; no heavy rigid-body simulation | Reduces cross-client physics differences and scope |

## Authorized optional physics library

D021 — The user permits cannon-es if vehicle physics needs it. This is permission to evaluate/use it where justified, not an instruction to replace Babylon.js with Three.js or to add full rigid-body vehicle simulation now. T021 evaluates the need. The simple lane/path controller remains the default. Any adoption must preserve server authority, keyboard/touch controls and the low-end device target; record the integration scope as a new task before broad changes.

## Still to establish by evidence

- Exact low-end Windows/laptop and Android test devices, RAM, GPU, browser and resolution. Select from available real hardware by T031; do not invent benchmark results.
- Actual art sources, licenses, character rig and animation compatibility by T008/T015.
- Hosting provider, domain, region, budget and access by T045. No paid provisioning is implied by writing this pack.
- Whether the control default needs auto-run; user can change it through a new task.
- Visual quality acceptance after the finished-street slice, not merely a text specification.

## Decision updates

Append dated entries with the reason, source (user or implementation evidence), affected tasks and migration impact. Mark superseded choices explicitly. Do not edit away the reason an earlier implementation exists. Do not treat estimates or target numbers as measurements.

### 16 November 2026 — Physics option clarified

User asked whether the project uses Three.js and offered cannon-es if needed. Current rendering choice remains Babylon.js; cannon-es is an allowed option for a demonstrated physics need. No game dependencies have been installed.

### 16 November 2026 — T001 toolchain versions pinned

Implementation evidence (T001). D010 is now pinned with exact versions in the workspace manifests and the root `package-lock.json`. Versions were selected from npm registry metadata on 16 November 2026 (latest releases with satisfied peer/engine ranges) and verified by clean install, typecheck, build, and client/server startup.

| Package | Version | Where | Note |
|---|---|---|---|
| typescript | 7.0.2 | root dev | Native TS 7 compiler; typechecks Babylon and Colyseus declarations |
| @types/node | 22.20.5 | root dev | Matches the minimum supported Node major; also satisfies Vite's peer |
| @babylonjs/core | 9.37.0 | client | ES module deep imports |
| vite | 8.3.8 | client dev | Requires Node ≥ 20.19 / ≥ 22.12 |
| @colyseus/sdk | 0.18.10 | client | Pinned for server compatibility; first used by T014 |
| @colyseus/core | 0.18.28 | server | Used directly instead of the `colyseus` meta-package, which pulls in auth/monitor/playground/Redis |
| @colyseus/ws-transport | 0.18.5 | server | Pulls in express 5.3.0 as a required peer (lockfile) |
| @colyseus/schema | 5.0.48 | server | Pinned for T006 adapters |
| tsx | 4.23.15 | server dev | Watch-mode TS runner; production uses `tsc` output |

Node engine: ≥ 22.12 (Colyseus 0.18 requires ≥ 22). Tested only on Node 24.22.0 / npm 11.19.1. `.npmrc` sets `save-exact=true`. Affected tasks: all; version changes go through the coordinator. Migration impact: none (first install).

### 16 November 2026 — Workflow: single `main` branch

Source: the user. All work is committed directly on `main`. Task branches and worktrees are not used, which overrides the branch-per-task suggestion in PARALLEL_WORK.md. The user pushes to the GitHub remote manually; agents commit locally and never push. Affected tasks: all. With a single checkout, exclusive write paths in ACTIVE_WORK.md remain the conflict guard.

### 16 November 2026 — T002 shared contract choices

Source: implementation (T002). Affected tasks: T003 onward. Migration impact: none (first version, `PROTOCOL_VERSION` 1, `CONFIG_VERSION` "provisional-1").

- **Validation without a schema library.** Runtime checks for client commands are hand-written, stateless functions in `packages/shared/src/validation.ts`. Each one builds a fresh, typed result, so a type change fails to compile until its validator is updated. Unknown fields and unknown commands are rejected. No dependency was added, and the validators are tree-shaken out of the client bundle. Colyseus 0.18 also accepts Standard Schema validators; T006 may wrap these functions if useful.
- **Protocol limits** (assistant-selected, since the specs left them open): nicknames are 1–16 Unicode code points after trimming and NFC normalization, and may not contain control, format/bidi or line-separator characters. Room codes are 5 characters from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`, case-insensitive on input. An input frame carries at most 8 unacknowledged edge actions. Sequence and action IDs are uint32. Version labels are 1–32 characters of `[A-Za-z0-9._-]`.
- **Input semantics.** Action IDs increase strictly per session, and the server acknowledges `lastProcessedActionId`. Clients never send entity IDs; the server picks targets from context. The `resume` command is the reconnect handshake, and the input sequence restarts after it.
- **Tuning.** `DEFAULT_TUNING` contains only values the specs state. Values they leave open (stamina recovery, capture speed threshold, arrest range, room expiry, abandoned-vehicle return) are omitted until a task needs them.
- **Package wiring.** Workspace packages expose a `stopthatguy-source` export condition. Vite, tsx and the TypeScript typecheck use the source directly. The server's production build and runtime use the compiled `packages/shared/dist`, built first by `npm run build`. `@stopthatguy/test-support` is source-only and must never be a production dependency.
- **Tests.** The focused checks use Node's built-in test runner through tsx, which is already pinned and is now a root dev dependency. Adopting Vitest/Playwright (ARCHITECTURE.md) remains a T004 decision.
- **Open rule.** The contract includes the `spectator` participation state from GAMEPLAY.md, but how a player enters it is not specified. Fixtures exercise the value only; T028/T034 decide the rule.
