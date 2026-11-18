# T014 real client connection

`createNetworkAdapter({ endpoint, versions, tuning? })` implements the existing
`UiAdapter`. Pass trusted expected versions and matching tuning; the default is
`DEFAULT_TUNING`. The HTTP(S) endpoint belongs to the same game server that owns
the Colyseus session. Admission uses validated `/rooms/create` or `/rooms/join`
reservations, then the installed SDK's `consumeSeatReservation`. Never expose the
reservation, reconnection token or SDK room to presentation code.

`mountLobby(element, adapter)` works unchanged. Readiness, host/start permissions,
phase, local player and results derive from validated server snapshots. Commands
only send intents: there is no optimistic readiness/start acknowledgement.
`commandRejected` maps to the frozen adapter's `connection.error` plus a readable
message; connected room state remains intact so the UI can recover or leave.
Admission errors retain their shared error code. A version/structural mismatch
closes the session. Lost sockets become disconnected; automatic reconnect is
disabled because grace/resume belongs to T028.

Cancellation/retry increments an attempt generation. Obsolete callbacks cannot
publish. Late HTTP reservations are consumed and immediately left, including
after disposal; at most two admissions can be outstanding. HTTP bodies are capped
before JSON decoding, requests/handshakes/initial state are time-bounded, and socket
cleanup removes listeners. If HTTP never returns an already-created reservation,
its ID is unavailable to the client and the server's existing 15-second seat
expiry remains the fallback. No retry replays an uncertain operation automatically.

`getSnapshot()` returns a fresh authoritative copy for entity/camera presentation.
There is no local extrapolation or prediction (T022). Snapshot decoding checks
shapes, identity uniqueness, finite values, versions and bounded depth/size.
`subscribeEvents(listener)` deduplicates increasing event IDs per match using a
constant-space watermark; entering a fresh lobby resets it. Events never replace
snapshot state. `actions`/`robber` UI cues stay null until authoritative legal
information and visibility are supplied by a later integration task.

Feed each keyboard/touch sample to `sampleInput(sample.held, sample.actions)`.
Action IDs come from the session-scoped T007 source and must increase. The
adapter sends changed input/heartbeats at up to the configured send rate, resends
up to eight unacknowledged edges per frame, and discards work only on real server
ACKs or explicit input cancellation. It caps pending frames/actions at 64 and
fails closed after a two-second acknowledgement stall. `sampleInput` returns
false when inactive/full. Missing samples, blur and backgrounding neutralize held
controls. `clearInput()` also discards queued local actions; no old intent is
restored on return. Call `dispose()` to release session, timers and listeners.
The caller controls gameplay focus and must deactivate T007 while menus own it.

## Verification and preview

Tests are registered in client `test` / `test:browser` and server's existing room
test glob. From the assigned DevPack directory:

```sh
node_modules/.bin/tsx --conditions=stopthatguy-source --test apps/client/src/network/*.test.ts
node --import tsx --conditions=stopthatguy-source --test apps/server/src/rooms/test/input.test.mjs
bash /home/umar/Downloads/StopThatGuy/.worktrees/coordination/batch3/run-browser.sh npm run check
bash /home/umar/Downloads/StopThatGuy/.worktrees/coordination/batch3/run-browser.sh env KEYBOARD_BROWSER_PORT=5414 ASSET_BROWSER_PORT=5514 npm run test:browser
```

The standalone network browser runner is `node
apps/client/src/network/browser/acceptance.mjs --dev` (omit `--dev` for built
client/server after `npm run build`); run it through the same browser lock.
It uses real server port 2614 and strict Vite port 5214, opens two independent
Chromium tabs, navigates T012's lobby by keyboard, joins by real room code, starts
an authoritative match and sends T007 arrow input. Screenshots, JSON and logs live
in ignored `test-results/network`. A busy lock exits 75; it is not a failed test.

For manual review, start the existing server with `PORT=2614 npm run dev:server`
and `npm run dev:client -- --host 127.0.0.1 --port 5214 --strictPort`, then open
`http://127.0.0.1:5214/src/network/browser/demo.html` in two tabs. The page is a live
transport acceptance entry with text movement evidence; it does not assemble the
3D game, which remains T020. Browser acceptance stops only its own processes.
