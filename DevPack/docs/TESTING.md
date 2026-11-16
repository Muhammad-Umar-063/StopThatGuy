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
