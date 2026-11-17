# T006 room transport

`createRoomLifecycle({ world, tuning? })` composes the `chase` room definition and
HTTP endpoints for one Colyseus server process. The caller supplies trusted,
versioned `WorldData`; default tuning comes from the shared package. The factory
copies these inputs so later caller mutations cannot change a running room.

## Application integration

The normal bootstrap registers this lifecycle with `FIRST_STREET_WORLD` from
`@stopthatguy/world`. `/health` includes the world version. The server declares
world and simulation runtime dependencies; SDK/test-support remain development
only. The workspace lockfile is synchronized and a clean install is verified.
Production code never imports test-support. `test/bootstrap.test.mjs` launches
the compiled application and verifies real client create/join/ready/start against
the authored world; run `npm run build` before the server test suite.

## Client protocol

1. POST `/rooms/create` with shared `CreateRoomOptions`, or `/rooms/join` with shared
   `JoinRoomOptions`. Versions must match the configured world/tuning/protocol.
2. A successful response is `{ reservation, roomCode }`. Immediately pass the
   opaque reservation to `new Client(endpoint).consumeSeatReservation(reservation)`
   using the installed `@colyseus/sdk`. Do not log or share the reservation.
3. A failed request returns HTTP 4xx and `{ code, message }`, where `code` is a
   shared `RoomErrorCode`. A socket consuming a reservation after start receives
   Colyseus error 409 with `matchInProgress` prefixed in its readable message.
4. Send shared `ClientCommand` values on `room.send("command", command)`.
   Listen for shared `ServerMessage` values on `room.onMessage("message", ...)`.
5. On initial state and state changes, decode `room.state.snapshotJson` as the
   shared `AuthoritativeSnapshot`. The local player's ID equals `room.sessionId`;
   only Colyseus assigns that identity. The public code never authenticates a seat.
   No reconnection token or reservation is replicated in state.

Default SDK matchmaking routes are intentionally rejected so every admission
passes the validated code lookup. The lifecycle validates again when the reserved
WebSocket arrives. Pending seats count against the six-player capacity. The
earliest connected player is host; names need not be unique. All connected players,
including the host, must be ready. Normal needs two; practice permits one and uses
the identical simulation. A start rejected for minimum/readiness conditions uses
the existing `wrongPhase` command rejection (no shared error-code extension).

The room owns lobby, readiness and host metadata. Simulation owns countdown,
intro, chase, timeout result and events. A countdown cancels only when the remaining
connected roster falls below the mode's minimum. Host rematch after results clears
readiness and creates a fresh simulation on the next start.

## Boundaries and cleanup

Input transport, gameplay movement and reconnect are not implemented here;
`input`/`resume` receive a rejection. Departures remove lobby membership and command
budgets immediately. During a match, snapshots project departed players as
`left`/`forfeit`, and host metadata comes from the connected roster. The existing
simulation interface has no departure mutation: T028 must add simulation-level
forfeit/removal before gameplay interactions can rely on that projection.

Empty rooms use installed Colyseus auto-disposal, which clears patch/simulation
timers and reservations. An unconsumed initial reservation expires after the
installed default 15 seconds. Directory entries are removed on disposal; a bounded
set of the 1,024 most recently closed codes returns `roomExpired` and prevents
immediate reuse. Older/unknown codes return `roomNotFound`. No reconnect grace or
new shared expiry configuration is introduced by T006.

Room requests are streamed with a 4 KiB budget before JSON parsing, including
chunked requests. Shared runtime parsers enforce shape and versions. Command rates
are bounded per connection using the existing `maxInputSendHz` budget; Colyseus
also disconnects excessive message floods. HTTP connection-attempt rate limiting,
deployment origin restrictions and wider abuse controls remain integration/T041 work.

This initial schema envelope sends full shared snapshots at the configured patch
rate (15 Hz by default), with 30 Hz fixed simulation steps and bounded catch-up.
It is intentionally basic phase transport. Bandwidth optimization and gameplay
input sequencing belong to later networking work; no performance claim is made.

## Verification

From DevPack:

```bash
node --import tsx --conditions=stopthatguy-source --test apps/server/src/rooms/test/*.test.mjs
npm test --workspace @stopthatguy/server
npm run check
git diff --check
```

After building, check the compiled room and simulation with the same real clients:

```bash
T006_BUILT=1 node --import tsx --test --test-name-pattern='six independent|practice and multiplayer' apps/server/src/rooms/test/*.test.mjs
```

Tests bind an OS-assigned loopback port and use actual independent SDK/WebSocket
connections with the committed `FIXTURE_WORLD`. Test-only phase durations are
shortened under a separate config version; simulation tick and patch rates remain
the defaults. The suite includes a real 15-second reservation-expiry check and
stops only its own server. The leased server test script includes this suite in
`npm run check`.
