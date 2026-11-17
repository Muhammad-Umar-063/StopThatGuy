# Verification and release acceptance

No test has been executed for this documentation pack. This file defines implementation requirements.

## Test layers

1. Shared simulation tests: seeded, fixed-step, independent of browser rendering. Test invariants and outcomes, not copies of implementation details.
2. Server integration: independent clients, real room lifecycle, input validation, concurrency and reconnect.
3. Browser integration: menus, loading, inputs, focus, actual rendered chase, results and rematch.
4. Human playtests and real devices: control feel, animation, readability, frame pacing, touch/thermal behavior.

A six-client headless test verifies networking, not six-device rendering performance. CPU throttling is useful but not a substitute for a low-end GPU/phone.

## Required scenarios

| Area | Cases |
|---|---|
| Controls | One press/one lane; held key does not repeat; branch priority; buffer does not double-act; no-branch behavior; simultaneous directions; blur releases controls |
| Camera | 90-degree turn, slope, narrow passage, obstruction, no wall penetration, reduced motion |
| Movement | Same speed at 30/60 FPS; stamina bounds; swept collision; stairs permission; dead-end escape |
| Rooms | Create/join; invalid/full/in-progress room; 1-player practice; 2–6 players; host transfer; countdown cancellation |
| Thief | All escape routes reachable; no stuck route; visible transport transitions; capture feasible through shortcuts |
| Vehicles | Two claims same tick; dismount obstruction; lift seats; disconnect ownership; rematch cleanup |
| Sabotage | Range/LOS; cooldown; miss; mounted wobble; recovery protection; no spectator effects |
| Crime | Cancel theft; visible detection; wanted trigger; police path; arrest invalidates same-tick capture |
| Ending | Capture vs escape tie; multiple capture ties; timeout; all arrested; immutable results; exactly one winner at most |
| Networking | 100–200 ms RTT, jitter/stalls, stale/duplicate input, reconnect token/session separation, no unlimited extrapolation |
| Input validation | Oversize/unknown messages; NaN/Infinity; impossible movement/actions; privilege checks; rate bounds |
| Mobile | Multitouch forward/action; pointer cancel; rotation; safe areas; background/resume; browser UI changes |
| UI | No mouse needed; room-code typing; focus visibility; all error paths; loading/retry; readable text; mute |
| Lifecycle | Repeat matches, exit/rejoin, scene cleanup, listener/timer disposal, no progressive memory growth |
| Visual | Low vs medium style consistency, no placeholders called final, animations and vehicle contact readable |

## Release environment matrix

Record actual device/browser versions and evidence in an implementation-created docs/TEST_RESULTS.md. At minimum: low-end laptop baseline; Android low-end baseline; capable desktop; Chrome/Edge desktop smoke; Firefox desktop compatibility check. If hardware is unavailable, mark performance verification blocked/unverified instead of passing it. Do not block unrelated rule testing on missing devices.

## Evidence per task

Commands/tests run and results; screenshots/video when behavior is visual; fixture/seed or room scenario; actual hardware for FPS claims; known limitations. Tests run from clean installs where appropriate. Build/typecheck alone cannot prove the game works.

## Final gate

- Required tasks integrated and dependency/version mismatches resolved.
- Build, typecheck, meaningful tests and asset/world validation pass.
- Six independent players/sessions complete a full game; capture and escape both exercised.
- Android full loop and desktop keyboard-only full loop exercised.
- Theft, arrest, spectating, simultaneous claims and reconnect tested.
- Performance results recorded against named devices; missing evidence disclosed.
- No release-blocking errors, broken references, unlicensed assets or committed secrets.
- Public client/server version pair tested after deployment, including WSS and direct refresh.
- User playtest feedback recorded; new requests become tasks instead of silently changing the release baseline.

## Local verification workflow

Established in T004. Run from `DevPack/`; the Git root is its parent folder.

**Prerequisites:** Node.js ≥ 22.12 (verified with 24.22.0), npm ≥ 10 (verified with 11.19.1), and Google Chrome, Chromium or Microsoft Edge for the smoke step. Set `CHROME_PATH` if the browser is not found automatically. No secrets or network services are needed after `npm ci`.

**Clean-checkout sequence:**

```bash
npm ci            # locked install from package-lock.json
npm run check     # the one required command
```

`npm run check` runs these steps in order and stops at the first failure:

| Step | Command | Proves | Does not prove |
|---|---|---|---|
| 1 | `npm run typecheck` | Every workspace, plus `scripts/` and `tests/`, typechecks; shared and simulation sources cannot use DOM or Node APIs | Runtime behaviour |
| 2 | `npm run build` | shared → simulation → client bundle and server JavaScript compile | That they start |
| 3 | `npm test` | Contract validation, fixture consistency, world/asset validators, simulation rules and determinism, compiled-package resolution, cross-package boundaries (`tests/`) | Browser or network behaviour |
| 4 | `npm run validate` | Registered world data (currently `FIXTURE_WORLD`) and `assets/manifest.json` pass structural, reference and provenance-field checks | Reachability, collider placement, license truth (listed by the command) |
| 5 | `npm run smoke` | The built server answers `/health` with the expected protocol/config versions; the built client renders the smoke scene in headless Chrome, its render loop advances, and the console has no errors, exceptions or failed resources | Gameplay, input, multiplayer, real-GPU or device performance |

Expected outcome: every step reports success and the command exits 0. Smoke artifacts (`result.json`, `screenshot.png`) are written to `test-results/smoke/`, which is Git-ignored. Missing build output or a missing browser **fails** the smoke step; it is never reported as skipped or passed.

**CI:** `.github/workflows/ci.yml` at the repository root runs `npm ci` and `npm run check` in `DevPack/` on every push and pull request (Ubuntu 24.04, Node 24, the runner's preinstalled Chrome) and uploads the smoke artifacts. A workflow file existing does not mean CI has run; check the repository's Actions tab for real results.

**Fixtures for isolated work** (`@stopthatguy/test-support`, development and tests only):
- `FIXTURE_WORLD`: route-graph and renderer work.
- `FIXTURE_SNAPSHOTS` and event streams: renderer and HUD state.
- `FIXTURE_VIEWS` with `createFixtureUiAdapter()`: UI built against fixture view models. Views are labelled `dataSource: "fixture"`, and the adapter only records intents.
- `createFixtureSimulationSetup()`: server and simulation tests.
- Command samples: server-boundary tests.
- `INVALID_WORLD_SAMPLES`: validator tests.

The package root is browser-safe; Node-only validators are under `@stopthatguy/test-support/node`.

**Adding data:** T005 registers its authored world in `scripts/validate-data.ts` (`REGISTERED_WORLDS`). T008 adds manifest entries and switches `assets/manifest.json` to `"status": "active"`. An empty manifest must keep `"empty-development"`.

**Troubleshooting:**
- *Smoke: "no Chrome, Chromium or Edge found".* Install a Chromium-family browser or set `CHROME_PATH=/path/to/chrome`.
- *Smoke: "missing … run `npm run build`".* Run the build first; `npm run check` does this automatically.
- *Smoke: a browser sandbox error in a container.* CI adds `--no-sandbox` automatically when `CI` is set; locally, run with `CI=1` only inside a disposable container.
- *Smoke: "not ready within 20000 ms".* The failing process's last output lines are printed. A port is never the cause, because the check picks free ports and does not touch running dev servers.
- *Compiled-package test reported as skipped.* `npm test` run on its own before any build skips that one test and names the reason; `npm run check` always builds first.
- *npm warns about install scripts for esbuild/msgpackr-extract.* This is expected and harmless (see README).
