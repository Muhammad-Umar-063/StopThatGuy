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

### 16 November 2026 — Workflow: single `main` branch (superseded)

Historical record: the manual-commit decision below superseded automatic commits; the later task-worktree decision supersedes single-main development.

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

### 17 November 2026 — T003 simulation foundation choices

Source: implementation (T003). Affected tasks: T006, T009, T013, T017, T021–T033, T022. Migration impact: none at runtime. Two additions to the server-internal simulation contract, which is not wire protocol: `SimulationSetup.roomCode` and `ValidatedPlayerInput.sequence`. Event IDs restart at 1 for each match. `PROTOCOL_VERSION` is unchanged.

- **Scope of the simulation.** `createInitialState` starts a match in `countdown` at tick 0. The simulation owns the timed phase clock (countdown → intro → chase) and the time-limit result (no winner, `timeout`, with empty awards and stats until T037). Lobby, ready/host state and room closing belong to the room (T006). Robber AI, escape and capture are left to T013 and T017.
- **Fixed step.** `step` advances exactly one tick. A delta other than 1000 / `simulationHz` (within 1e-6 ms) throws `RangeError` without changing state. Callers own time: `advanceFixedStepClock` keeps an explicit accumulator and runs at most 5 steps per sample by default, dropping excess whole steps and reporting them as `droppedMs`, so a stall slows simulated time instead of causing a catch-up spiral.
- **Randomness.** sfc32 with splitmix32-style seeding and 12 warm-up outputs. It is integer-only, so a seed gives the same sequence in any conforming engine, and it was cross-checked against an independent Python implementation. The seed currently chooses only the robber escape route.
- **Determinism claim.** Results are repeatable for the same setup and inputs in the same JavaScript runtime. The tests also show source and compiled builds give identical results. Bit-identical results across different engines are not claimed, because `Math.atan2`, `sin` and `cos` may differ in the last bits.
- **Spawns.** Players take the world's player spawns in join order; spawn fairness and rotation are left to T013. Vehicles and police take their spawn IDs as entity IDs, and shop zones become `shopTheft` interactables.
- **Movement interface.** `MovementKernel(current, input, context) → { state, pose }` is pure and uses meters, m/s, milliseconds and stamina points. Its input is the held controls plus `leftPressed`/`rightPressed` for the step. It is exported from `@stopthatguy/simulation/movement` for client prediction. The default `holdPositionKernel` keeps players in place until T009, and the simulation rejects any kernel result that is non-finite or outside the world.
- **Isolation.** The state handle is an opaque frozen object, with internals kept in a module-private WeakMap. Snapshots and drained events are fresh deep copies. Setup data is never mutated.

### 17 November 2026 — Workflow: manual commits by the user

Manual Git operations remain current. The single-main restriction and completion-after-commit wording below are historical and superseded by the later task-worktree decision.

Source: the user, while assigning T004. Agents no longer stage, commit, amend, push, merge, rebase or tag. Task changes stay uncommitted for the user to review and commit. A finished task is set to `in_review` with "awaiting user review and manual commit" and no `integration_commit`; the coordinator records the user's commit and marks the task done afterwards. This **supersedes** the 16 November "agents commit locally" part of the single-`main` workflow entry. Working only on `main`, with no task branches, still applies. The rule is written into AGENTS.md "Git workflow". The T001–T003 handoffs describe the earlier practice and were left unchanged. Affected tasks: T004 onward.

### 17 November 2026 — T004 verification tooling choices

Source: implementation (T004). Affected tasks: all; T005 and T008 in particular. Migration impact: none. `WORLD_ISSUE_CODES` gained `duplicateId`, an additive change to the validation-report contract; the wire protocol is unchanged.

- **One required command.** `npm run check` runs typecheck → build → test → validate → smoke. Each step also runs on its own, and none runs twice. CI runs the same command.
- **Smoke check without new dependencies.** `scripts/smoke.ts` drives an installed Chromium-family browser over the DevTools protocol, using Node's built-in `fetch` and `WebSocket`. Playwright was not added because the current single-page smoke check doesn't need it; T012 and later browser-flow tests may adopt it with a recorded decision. The smoke check uses free ports and per-step timeouts plus a 120 s total limit, and stops only its own process groups. A missing browser or build fails the check; it is never skipped.
- **World validation.** `validateWorldData` (`@stopthatguy/test-support`) checks untrusted data's structure first, then identities, references and local topology, reporting shared `WorldIssueCode`s. Reachability, spawn/collider overlap, slopes and collider placement remain T005 work. It lives in test-support for now; T005 or T006 may move it into a runtime package if the server must validate maps at startup.
- **Asset manifest, schema 1.** `assets/manifest.json` is explicitly `"empty-development"` with no entries. Entries require the ASSETS.md provenance fields, runtime files must exist with matching sizes, and paths must be safe and relative. A license text file is required when a `textPath` is given; a missing source file is only a warning. The check prints what it cannot verify. T008 owns real entries and the import pipeline.
- **CI.** GitHub Actions at the repository root (`.github/workflows/ci.yml`): `ubuntu-24.04`, Node 24, `actions/checkout@v7`, `actions/setup-node@v7` (npm cache keyed on `DevPack/package-lock.json`) and `actions/upload-artifact@v7`. Action versions and runner Chrome availability were checked against GitHub's published metadata on 17 November 2026; the workflow has not run remotely yet.

### 17 November 2026 — Workflow: task worktrees with manual integration (current)

Source: the user requested worktrees for T005–T008, then requested correction of conflicting instructions after setup. This supersedes the earlier requirement to implement only on main. Four existing task worktrees/branches use baseline `46f57d4`; paths and exclusive scopes are listed in PARALLEL_WORK.md. Use one implementation chat per task worktree, even in a single VS Code window. Main is reserved for serial coordination and reviewed integration.

The prohibition on automatic staging, commits, pushes, merges, rebases and tags remains. Workers leave changes uncommitted and provide their own handoff. The user reviews and commits task work, then merges it into main. Only after combined checks pass does the coordinator record the main integration commit and mark the task done; committing on a task branch alone does not finish integration.

Main's board and ACTIVE_WORK are authoritative; workers do not edit their worktree copies or shared instructions. Shared files require one recorded exclusive owner and checkout. This repair synchronizes instructions across the five existing checkouts once, without committing or starting any gameplay task. Subsequent changes are integrated through the manual workflow. Affected tasks: T005 onward. Historical task handoffs remain unchanged.

### 17 November 2026 — Batch 1 integration authorization

The user explicitly requested committing and pushing existing work, then preparing the next four tasks. This authorizes the coordinator to commit the existing T005–T008 work, merge it, fix integration blockers, verify and push to origin, and create/install T009–T012 worktrees. It overrides the manual-only rule for this integration/setup operation. Subsequent feature chats still leave work uncommitted unless the user authorizes otherwise. All prior task chats have finished; coordination transfers from Claude to Codex for this operation.

### 17 November 2026 — Batch 1 integration choices

The normal server uses FIRST_STREET_WORLD (first-street-1), with world/simulation
runtime dependencies and no test-support runtime imports. Room transport uses
snapshotJson as documented in the room README. Keyboard uses physical key codes;
left/right edges cancel within one sample. glTF loading is lazy, with loaders and
its interface peer pinned to 9.37.0. The calibration sample is development art.
T005's provisional world limits (15% wheeled grade, 80% foot grade, 0.3 m ground
tolerance) remain tuning defaults, not measured realism. Missing escape routes
are a documented blockout warning until later map/robber work. Keyboard and asset
tests now run in standard verification; separate browser gates also run in CI.

### 17 November 2026 — Batch 2 Codex coordination and setup

The user is closing Claude and moving all four next tasks to Codex, with direct
inter-chat coordination for routine permissions. T012/Chat D owns coordination;
T009/A, T010/B, T011/C own separate worktrees. Launch prompts include explicit
permission to message and reply, and main CHAT_REGISTRY records actual IDs.
Tool delivery and OS permissions remain real constraints; no automatic message
access is assumed. Batch-1 local integration is complete; the user chose to push
personally after HTTPS authentication was unavailable in this session. Batch-2
implementation retains manual commits/merges. Old worktrees are preserved.

### 17 November 2026 — T009 movement tuning and internal memory lease (pending integration)

Source: Chat A/T009 proposal relayed by the user, approved by sole coordinator
Chat D after contract review. Exact-file ownership is in ACTIVE_WORK.md and
board.json; implementation occurs only in the T009 worktree. Approved defaults:
acceleration/coast/brake 8/6/12 m/s², lane shift 300 ms, stamina recovery 15/s
after 1,000 ms, body radius/height 0.35/1.8 m, collision skin 0.01 m, and
1,000 ms speed-based approach lookahead clamped to the existing 5–8 m range and
authored turn eligibility. The separate press buffer remains at most 250 ms.
T009 must change CONFIG_VERSION from provisional-1 to provisional-2; old-config
clients require the normal version mismatch handling after manual integration.

Per-player turn/lane/recovery memory stays private to the simulation; the optional
early-buffer flag extends only the existing turn legal-action variant, absent
meaning false. No protocol version or wire schema change is approved. T014/T018
must make the cue visible before integrated buffered-input use; T022 must review
private-memory reconstruction before prediction integration. The road kernel
becomes the default with default-kernel authored-world regression coverage;
explicit injected kernels remain supported. No main runtime change or merge has
happened merely because this proposal/lease is approved.

### 17 November 2026 — Batch 2 completion and local integration authorization

The user requests verifying and completing all four current tasks, then committing
and merging locally. This overrides manual-only Git for this operation; the user
will push. Root takes integration ownership from finished task chats, preserves
existing work, completes T009/T011 gaps, verifies T010/T012 and combined checks.
No task is marked done before accepted integration. Future feature work retains
manual commits unless separately authorized.

### 17 November 2026 — Batch 2 accepted integration

T009–T012 are done at c8526de after 334 tests and all browser gates passed.
The pending movement/config lease above is implemented: provisional-2 with no
wire change. Per-player memory remains private; custom injected kernels expose
conservative legal actions. Early buffering is off in normal gameplay pending
visible cues. Bent-road lane offsets are continuous, with conservative sweeps.
Environment registry/manifest aggregation and original street rendering passed.
All new tests run in standard commands/CI; browser artifacts default to ignored
paths. Full details and limits: coordination/integration/BATCH_2.md. All task
leases released. No push performed; user will push. No next batch started.

### 17 November 2026 — Batch 3 preparation

User requests VS Code preparation and prompts for the next four tasks. T013/A,
T014/B, T015/C and T016/D are reserved at edfdce7; D coordinates. Existing completed
worktrees are preserved. Setup creates branches, installs locked dependencies and
updates the local workspace; feature implementation is not started. Setup records
remain uncommitted in main, read directly by workers; no staging, commits or push.
Pregrant exact simulation/config, input transport and asset/test registration scopes
in ACTIVE_WORK to avoid repeating known integration-lease delays. New requests use
verified direct messages or single-writer file mailboxes; D records approval before
use. File changes do not wake idle chats. Shared flock serializes browser gates.
No new engine, protocol, paid asset, gameplay feature or dependency is selected by
preparation. Characters need actual licensed/source verification during T015.

### 18 November 2026 — T013 provisional robber transition

D approves REQ-001: `robber.transitionMs = 1000`, CONFIG_VERSION `provisional-3`,
implemented only by T013 in its leased config.ts. Existing phase clocks, movement
values, protocol and world schemas remain. The dwell uses simulation ticks at a
clear road-to-foot boundary; transport ownership/remount remains T021. Every T016
escape will include a foot section. Combined T013/T016 catchability and T014
version rejection remain manual-integration gates; approval does not merge code.

### 18 November 2026 — Batch 3 local integration authorized

The user authorizes root to review, commit and merge T013–T016 locally, then
prepare the next worktrees. The user will push main to GitHub. All four workers
have in_review handoffs and released their browser gates. Root takes serial
integration ownership; earlier worker scopes are now closed to new edits.
This authorization applies to this integration/setup operation, not automatic
commits for future T017–T020 feature work. Combined acceptance remains required.
