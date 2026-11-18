# Active work and integration state

Updated 17 November 2026: **T001–T012 are done and integrated.**
Accepted batch-2 integration: `c8526de`. See integration/BATCH_2.md for commits,
334 passing tests, complete browser acceptance and remaining planned scope.

No batch-2 implementation chat holds an active lease. All T009–T012 original
scopes, extra exact-file leases and coordinator reservations below are released.
No next task has been started or assigned. T013–T016 dependencies are satisfied;
new task assignment/ownership must be recorded before those chats edit files.
Do not resume old tasks based on the historical blocked statuses below.

The user authorized this local completion/commit/merge operation and will push
to GitHub personally. Future task chats retain manual Git unless newly authorized.
The task branches and all old worktrees are preserved and clean. Root closeout is
serial; no background monitor or automatic cross-chat delivery is claimed.

## Historical coordination and leases (superseded)

# Active work and integration state

Updated: 17 November 2026.

Coordinator for current integration: root Codex chat, under the user request to finish, verify, commit and merge T009–T012 locally. Prior task chats are not loaded. Chat D history below is preserved; its active ownership transfers for this integration only.
The user reports all previous chats finished and is closing Claude. Do not resume
T005–T008 implementation or create a competing coordinator.

Verified implementation baseline: `ff78e06` on main. T001–T008 are integrated;
batch 1 acceptance and resolved blockers: coordination/integration/BATCH_1.md.
The user authorized local commits/integration/setup for this operation, then chose
to push to GitHub personally. Future feature chats leave edits uncommitted.

## Batch 2 reservations

All five HEADs inspected read-only at launch: main and T009–T012 are
`251e5f3807319513e683721c83f3f57648c2ce95`, clean. This is the recorded actual
base_commit for each task; integrated dependencies T005–T008 are present.
T012 has started. A later read-only inspection confirmed implementation changes
in the reserved T009–T011 paths, on the same verified task branches/base. Those
tasks started in_progress. T009 is registered by user-relayed self-verification
and now has a blocked partial handoff; all requested leases are recorded below;
T010 is registered/in_review from its completed handoff. T011 is registered
from a matching user relay and worker handoff and is blocked pending resumption
and its unimplemented registration/aggregation; approved leases are below.

| Task | Owner | Branch / worktree | Exclusive paths relative to DevPack | Status |
|---|---|---|---|---|
| T009 | Chat A (Codex) | `task/T009-road-movement` / `.worktrees/T009` | `packages/simulation/src/movement/`; `packages/simulation/src/collision/`; `packages/simulation/test/movement.test.ts`; `packages/simulation/test/collision.test.ts`; `coordination/handoffs/T009.md` | blocked; partial handoff; nine leases approved; resumption unconfirmed |
| T010 | Chat B (Codex) | `task/T010-follow-camera` / `.worktrees/T010` | `apps/client/src/camera/`; `coordination/handoffs/T010.md` | in_review; Chat B registered; worker evidence collected |
| T011 | Chat C (Codex) | `task/T011-street-visuals` / `.worktrees/T011` | `apps/client/src/render/environment/`; `apps/client/public/assets/environment/`; `assets-source/environment/`; `assets/manifest-environment.json`; `coordination/handoffs/T011.md` | blocked; partial handoff; three leases approved; resumption unconfirmed |
| T012 | Chat D (Codex) | `task/T012-lobby-ui` / `.worktrees/T012` | `apps/client/src/ui/lobby/`; `apps/client/src/ui/menu/`; `coordination/handoffs/T012.md` | in_review; acceptance passed; uncommitted |

## Coordination authority

Only `/home/umar/Downloads/StopThatGuy/DevPack/coordination/ACTIVE_WORK.md` and
`tasks/board.json` in main are live. Task-worktree copies are snapshots. Main's
CHAT_REGISTRY.md records verified chat IDs; placeholders are not destinations.
Workers message Chat D directly when tools are available and authorized by their
launch prompts. Chat D records decisions before replying. No worker edits main.

All T005–T008 leases are released following verified integration. Shared contracts,
tuning, simulation wiring outside T009's listed paths, package manifests/lockfile,
compiler/build/CI settings, client bootstrap and shared asset catalog/manifest are
reserved for the coordinator. Grant one exact-file lease in one checkout at a time.
Never add independent copies of shared types or overwrite another task's data.
T011 owns a separate environment manifest; aggregation into the central catalog
and validator is coordinated. Additional preview/test paths must also be leased.
The T012 chat performs its UI implementation only in T012; its coordination edits
in main are a separate, explicit role. No other chat may edit T012 UI concurrently.

## Dependency and completion gates

T009/T010 depend on integrated T005/T007; T011 on T005/T008; T012 on T006/T007.
All four are ready. Camera, visual street and lobby work use committed contracts
and labeled fixtures where later movement/network integration is still pending.
No task may rely on another task's uncommitted implementation. Record shared-change
prerequisites and request manual commits/branch updates when needed; do not copy
uncommitted code across worktrees. Parallel folders cannot guarantee conflict-free
merges, so integrate sequentially and run combined checks.

After acceptance passes, workers write their own handoff and Chat D records
in_review. The user handles commits and merges unless explicitly authorizing the
coordinator. Done requires actual integration into main plus combined verification.
T013 onward remains planned until its dependencies and ownership are recorded.

## Local run isolation

See docs/PARALLEL_WORK.md for per-task server, client and browser-test ports.
Use each worktree's independent node_modules and local .env. Stop only processes
you start. Prior task worktrees are preserved for reference, outside active VS Code
folders; do not edit them.

## Remaining product evidence

Baseline laptop/Android hardware, final art acceptance, hosting and final asset
sources are still unconfirmed. Hold-Up remains provisional. The client is still a
smoke scene; batch 2 creates the next pieces, not a finished online chase.

## Chat capability at T012 launch

Current tool discovery exposes no cross-chat listing/send/read tools (only unrelated
service messages and within-thread subagent tools). No worker delivery is claimed.
The coordinator thread ID is verified from CODEX_THREAD_ID/CODEX_SESSION_ID and
the current explicit T012 assignment; host is local Codex VS Code. Register worker
IDs only when verified task/ID evidence arrives. Continue independent work.

## Exclusive shared-file leases — T012

Recorded by Chat D before implementation. Sole owner Chat D/T012, checkout
`/home/umar/Downloads/StopThatGuy/.worktrees/T012/DevPack`:

- `apps/client/package.json`: append lobby unit/browser tests to existing scripts only; no dependency edits.
- `apps/client/vite.config.ts`: add the isolated lobby demo HTML as a production build entry; preserve dev dependency scanning of all source HTML fixtures. The first full browser run proved that restricting inferred build entries caused asset-demo 504/late-optimizer reloads. Same sole owner/checkout; restore scanning through optimizeDeps.entries.
- Demo approval: `apps/client/src/ui/lobby/demo.html` and `demo.ts` are owned by T012; standalone fixture route only, no bootstrap edits.

T012 design notes stay within `apps/client/src/ui/menu/DESIGN.md`; no project-wide
rebrand or root design/config expansion. No shared types, T007 internals, lockfile,
bootstrap, or networking edits authorized by these leases. Other workers must not
edit the two leased files in any checkout. Runtime consumers require reviewed
manual integration; this lease does not make the changes available elsewhere.

Worker contact limitation: one request for exact T009–T011 chat IDs was made to
the user because no cross-chat discovery/send tool is available. Work continues;
no delivery, file lease reply, runtime integration, or acceptance is inferred.

## T012 handoff / review gate

T012 acceptance passed in its assigned worktree: final `npm run check` exit 0
(281 tests plus build/validation/smoke), assigned `npm run test:browser` exit 0
(10 keyboard, 14 lobby, asset dev+built), clean diff check. Its handoff and
fixture-only limitations are in `.worktrees/T012/DevPack/coordination/handoffs/T012.md`.
Status is in_review, awaiting user review, manual commit and integration. Shared
leases remain held for that changeset; no runtime dependency is integrated by
this status update. At T012 handoff time, worker worktrees showed implementation without handoffs;
subsequent T010/T011 handoff collection and decisions are recorded below.
No worker delivery is claimed; supplied share links remain unverified references.

## T009 exclusive lease decision — 17 November 2026

Request received through the user from verified Chat A/T009 thread
`01a1e9fa-a445-7d90-8f1d-1c33e5e389e5`. Branch/base reverified as
`task/T009-road-movement` / `251e5f3807319513e683721c83f3f57648c2ce95`.
The reported clean state was at launch; current owned implementation edits are
preserved. Requested files are unchanged and have no competing lease.

**Approved, recorded before reply. Sole owner: Chat A/T009. Sole write checkout:**
`/home/umar/Downloads/StopThatGuy/.worktrees/T009/DevPack`. Paths below are relative
to that DevPack. No other checkout/worker may edit these files until lease release.

| Exact file | Authorized change |
|---|---|
| `packages/shared/src/config.ts` | Add the requested provisional movement/collision/lookahead tuning and bump CONFIG_VERSION to provisional-2; preserve PROTOCOL_LIMITS and unrelated tuning. |
| `packages/shared/src/simulation.ts` | Add one optional early-buffer cue flag to the existing DirectionalOption turn variant; omission means false. No other shared API or wire changes. |
| `packages/simulation/src/state.ts` | Own, initialize and validate explicit per-player movement memory; reset on new match/rematch; no public snapshot changes. |
| `packages/simulation/src/step.ts` | Pass and atomically commit movement memory with validated player updates; wire movement legal actions while preserving phase/input validation and action deduplication. |
| `packages/simulation/src/simulation.ts` | Make the road movement kernel the default; preserve explicit kernel injection and the Simulation interface. |
| `packages/simulation/package.json` | Add existing @stopthatguy/world 0.0.0 as a devDependency only; no scripts, exports, runtime dependencies or package-version changes. |
| `package-lock.json` | Update only the packages/simulation importer devDependencies for existing @stopthatguy/world 0.0.0; no resolved-package/version/integrity churn. |
| `packages/simulation/test/simulation.test.ts` | Update placeholder hold-position/legal-action expectations as needed and verify the default simulation with real inputs on FIRST_STREET_WORLD; preserve regression assertions. |

Approved provisional values: acceleration 8 m/s², coast 6 m/s², brake 12 m/s²,
lane shift 300 ms, stamina recovery 15/s after 1,000 ms, body radius 0.35 m,
height 1.8 m, collision skin 0.01 m, approach lookahead 1,000 ms bounded by
existing 5–8 m limits. Bump CONFIG_VERSION to `provisional-2`; these are
provisional implementation defaults, not measured balance or visual acceptance.

Review conditions:
- Preserve PROTOCOL_VERSION, wire inputs/snapshots and unrelated tuning.
- Keep the approach lookahead separate from the existing ≤250 ms press buffer;
  intersect eligibility with authored junction windows rather than widening them.
- The optional turn flag is non-wire and absent means false. UI actions currently
  expose direction kinds only: T014/T018 must wire a visible early-buffer cue
  before integrated gameplay uses buffering. `shared/src/ui.ts` is not leased.
- Keep movement memory per player and per match, deterministic and immutable at
  the kernel boundary; validate and commit it atomically with player updates.
  No private memory is added to snapshots under this lease. T022 reconstruction
  needs a later reviewed contract decision if memory must cross the wire.
- Preserve injected kernels and meaningful phase/input/deduplication regressions.
  Keep legal-action queries consistent with default road-kernel eligibility;
  document and test their behavior when a custom movement override is supplied.
  Exercise default `createSimulation()` with real inputs on FIRST_STREET_WORLD;
  injected-kernel tests alone do not prove the default wiring.
- No bootstrap/server wiring, package versions, registry additions, root package
  scripts or additional files are granted. Request another exact-file lease if
  a genuine migration failure needs one; do not weaken unrelated tests.
- Run task acceptance, `npm run check`, assigned browser suite and diff checks.
  Leave changes uncommitted. Approval is not integration: other tasks keep their
  committed baseline until reviewed manual commits/merges and branch updates.

Chat D reviewed the proposal with a read-only contract reviewer. No game code was
written in main or T009 by the coordinator. Cross-chat delivery is unavailable;
this live record and the response in Chat D are the approval evidence, not a
claim that a direct message reached Chat A.

## T010 collected handoff

Chat B ID is recorded in CHAT_REGISTRY. Coordinator inspected its handoff and
verification.json: 14 explicit camera tests, source/built camera browser checks,
full baseline check and assigned browser gates passed according to worker
evidence. Status in_review; no independent rerun or main integration is claimed.
Its standard test-script registration is queued for manual integration, when
Chat D can serially update `apps/client/package.json` after T012's exclusive
changeset. No overlapping package-file lease is granted to T010.

## T011 exclusive lease decision — 17 November 2026

Request received through the user from Chat C/T011 thread
`01a1e9fc-6fb5-7000-9099-74cf86ed3055`, local Codex VS Code; matching identity is
also in its worktree handoff. Branch/base independently reverified:
`task/T011-street-visuals` / `251e5f3807319513e683721c83f3f57648c2ce95`.
Launch was clean; current original-scope implementation and handoff are preserved.
All three requested shared files are unchanged and have no competing lease.

**Approved, recorded before reply. Sole owner: Chat C/T011. Sole write checkout:**
`/home/umar/Downloads/StopThatGuy/.worktrees/T011/DevPack`. Paths below are relative
to that DevPack. No other worker/checkout may edit these files until release.

| Exact file | Authorized change |
|---|---|
| `assets/catalog.json` | Register only environment.lisbon-kit at assets/environment/lisbon-kit.glb, with an honest acceptance-pending label; preserve dev.axis-marker and all existing metadata. |
| `scripts/assets/workflow.test.ts` | Aggregate core and owned environment manifests; preserve reproducibility/provenance/catalog/public-file coverage and add meaningful cross-manifest duplicate-ID/path rejection coverage. No skipping missing manifests/assets or weakening calibration assertions. |
| `scripts/validate-data.ts` | Validate assets/manifest.json and assets/manifest-environment.json individually and as a combined set for cross-manifest conflicts; preserve world validation and nonzero exit on invalid/missing data. |

The environment asset remains in `assets/manifest-environment.json`; do not copy
its provenance into or replace `assets/manifest.json`. Use the existing schema
and validator. Preserve core exporter, original catalog metadata and full public
asset coverage. Both category-level errors and combined duplicate IDs/runtime
paths must fail; tests must exercise conflicts rather than just concatenate
manifest entries. Missing manifests/assets are failures, not optional skips.
No shared schema, runtime loader, source exporter outside T011, package version
or dependency change is approved. Request any genuinely required extra exact
file instead of bypassing the existing loader/catalog boundary.

Isolated preview/test approval within existing T011 ownership:
- `apps/client/src/render/environment/preview.html`
- `apps/client/src/render/environment/preview.ts`
- `apps/client/src/render/environment/environment.test.mjs`
- `apps/client/src/render/environment/browser.mjs`
- `apps/client/src/render/environment/evidence/` for task evidence.

Use strict port 5211, existing installed dependencies, labeled provisional camera
and player placeholders, and stop only owned processes. No bootstrap edit.
The lease grants local write authorization; it does not implement registration
or establish worker resumption. Latest status is blocked (update below). Its five
geometry tests and existing regression browser gates do not establish visual acceptance. After implementation, run the real
street browser gate, inspect/fix low/medium views, record actual scene/draw/texture
costs, and rerun full/assigned checks before reporting in_review. Do not call it
final art or a live T010/networked chase without the corresponding evidence.

Integration queue (no immediate shared client edits):
- Add the explicit environment unit command:
  `node_modules/.bin/tsx --conditions=stopthatguy-source --test apps/client/src/render/environment/environment.test.mjs`.
- Add the explicit environment browser command:
  `node apps/client/src/render/environment/browser.mjs`.
- `apps/client/package.json` and `apps/client/vite.config.ts` remain exclusively
  leased to T012; Chat D registers tests and reviews any needed Vite entry there
  serially during reviewed manual integration. No overlapping lease to T011.

This approval changes no runtime file in main or another task worktree. T011 may
implement its own leased files locally; other tasks must wait for reviewed manual
integration and user branch updates, never copy uncommitted code. No staging,
commits, merges or branch updates are authorized. Cross-chat tools are unavailable;
this live record and Chat D's response are approval evidence, not direct delivery.

## T009 partial handoff and boundary-test lease — 17 November 2026

The user relayed Chat A's partial handoff. Coordinator read
`.worktrees/T009/DevPack/coordination/handoffs/T009.md` and its diagnostic log.
T009 is **blocked, not in_review**: the road kernel, steering/stamina and default
simulation wiring are unfinished. Authored-world acceptance has not run. The
reported 15 focused tests, simulation typecheck, existing keyboard/asset browser
gates and diff check are partial evidence only; full `npm run check` failed.

The handoff statement that main contains no T009 leases is stale: the earlier
eight exact-file approvals remain in the T009 decision above. They are not
revoked or made available to another owner by the blocked status.

**Additional lease approved and recorded before reply:**

| Exact file | Sole owner / checkout | Authorized change |
|---|---|---|
| `packages/simulation/test/boundaries.test.ts` | Chat A/T009, `/home/umar/Downloads/StopThatGuy/.worktrees/T009/DevPack` only | Fix the reproduced `Junction.window` property false positive; add guard regression cases. Preserve host-global/clock/randomness/timer/import and compiled-package checks. |

The current lexical guard rejects `junction.window.startM` in the owned traversal
module. This is shared world-data property access, not a DOM dependency. The fix
must accept ordinary and optional-chained access to that data property while
still rejecting actual `window`/`document`/`navigator` globals, `globalThis`, clocks,
randomness, timers, forbidden imports and dynamic imports. Include positive and
negative samples; do not remove the boundary test, broadly suppress source files
or weaken compiled-package resolution/equivalence coverage. No new parser or
package dependency is approved. No other extra implementation file is leased.

All nine requested leases are now recorded. Chat A may resume within those scopes
after reading the live main records, update its partial handoff, and run meaningful
full/default-kernel authored-world acceptance. Keep T009 blocked until resumption
is confirmed; it cannot move to in_review until the implementation and required
checks pass. Direct delivery/resumption is not inferred from granting permission.
No game code or test implementation was changed by Chat D in any checkout; only
main coordination records changed. No commit, merge or copying across worktrees
is authorized. Cross-chat messaging remains unavailable and no delivery is claimed.

## T011 partial status confirmation — 17 November 2026

Latest user relay and worktree handoff confirm **blocked, not in_review**.
Original GLB/manifest/renderer, quality settings, provisional preview and tests
remain uncommitted within owned paths. Reported passes: five focused tests,
reproducible export, typecheck/build, existing browser regressions and diff check.
Full `npm run check` still fails asset coverage; the street preview stops at
missing `environment.lisbon-kit`. No street screenshots, actual scene/draw/texture
costs, complete rendered street or final visual acceptance are verified.

The three leases recorded above remain exclusively approved for Chat C/T011 in
its own checkout: `assets/catalog.json`, `scripts/assets/workflow.test.ts`, and
`scripts/validate-data.ts`. No new permission request is needed for that scope.
The shared files are still unchanged: the work now required is implementation
and acceptance, not another lease grant. Chat C may reread live main records and
resume under those approvals. Keep blocked until resumption is confirmed; move
to in_review only after the remaining implementation and required checks pass.
Package/Vite ownership and queued test registration remain with T012.

Chat D changed only main coordination records, preserved worker work and did
not rerun tests or claim direct delivery. No Git writes or integration occurred.

## Current integration ownership — 17 November 2026

The user explicitly authorizes finishing incomplete batch-2 tasks, local commits
and merges. No push: the user will push personally. Root owns T009 completion
in its existing worktree and serial main integration/test registration/tracking.
A focused second assistant may complete T011 registration and acceptance in
its existing worktree under TOKEN_EFFICIENCY.md unresolved-defect review rules.
T011 exact scope remains its original paths and three recorded leases above.
Root alone commits/merges; no simultaneous edits of a checkout. T010/T012 changes
are preserved for acceptance review. Backups: /tmp/stg-batch2-backup.
All historical no-Git-write statements above are superseded for this operation
only by the current user authorization. Future task chats retain manual Git.

T011 integration migration lease: `apps/client/src/render/assets/catalog.ts` in
T011 only, assigned to finish_t011 assistant. Preserve the literal dev.axis-marker
ID using `satisfies AssetId` so adding a second catalog asset does not widen the
calibration-only metadata lookup. No runtime loader behavior change authorized.

Root now owns T010 camera files for acceptance maintenance: browser output goes
to ignored test-results/camera by default, with explicit CAMERA_EVIDENCE_DIR
for curated evidence. No camera behavior change; prevents test runs dirtying
tracked screenshots. Root serially registers all new tests after merging T012.

Root integration test-race fixes in main: keyboard/browser/keyboard.browser.test.ts
waits for both real blur and hidden events without requiring their browser-defined
order; scripts/assets/browser.mjs tolerates a missing documentElement during
navigation while waiting for the explicit ready state. Both existing failure,
neutral-input and resource assertions remain.
