# Networking and authority

Colyseus synchronizes server-owned state; implement gameplay authority in our simulation. [Official state synchronization documentation](https://docs.colyseus.io/state).

## Connection and room flow

Nickname → create/join room code → validate versions/capacity → assign stable player session → lobby/ready → server start → shared chase → immutable results → rematch. Limit room capacity to six. Room codes use unambiguous characters and retry on collisions. Invalid, full, expired, in-progress and version-mismatched rooms return distinct readable errors.

One-player practice connects to a server room too. Do not implement local browser practice that silently differs from online behavior.

## Updates and responsiveness

Initial settings: 30 Hz server step, 15 Hz patches, input updates at up to 30 Hz with change/heartbeat sending and bounded message sizes. Profile bandwidth per player and room, tick overruns, processing time and client frame time.

Predict only the local player's grounded movement/lane transition with the shared movement kernel. On authoritative snapshots, apply confirmed position, discard acknowledged inputs, replay remaining valid inputs and smooth small render corrections. Large corrections snap with bounded visual handling; never smooth through walls or keep an invalid route. Mount/arrest/capture are server-confirmed transitions. Clear pending predictions on these changes and on reconnect.

Interpolate remote entities using a short buffer (~100 ms initial target). Bound extrapolation; after the limit, hold last state and indicate connection trouble rather than allowing unlimited drift. Camera follows the rendered local pose. Gameplay range checks use authoritative positions, not camera/render positions.

## Disconnect and reconnect

Neutralize missing held inputs after ~250 ms without a valid frame (tune to measured network conditions). A network-disconnected player has a 15-second reconnect window. They remain visible/vulnerable, decelerate and cannot initiate new actions. Reconnect binds the original authenticated session to its player and sends a full state snapshot. Clear stale buffers and resume only from new inputs.

When grace expires, mark forfeit, release transport safely and remove collision participation. Explicit leave can forfeit immediately. Host role transfers deterministically. If all competitors forfeit/arrest, resolve no-winner. Empty rooms expire after a short configured period. Server restart cannot restore in-memory matches; show a clear ending and return to room selection.

## Race conditions

One authoritative simulation transaction per tick. Atomic vehicle/seat claims. Debounce unique action IDs; reject repeated capture completions or duplicate rewards. Use GAMEPLAY.md's event order for simultaneous capture/arrest/escape. State changes remain reconstructable even when transient sound/effect events are missed.

## Input validation and abuse

Allowlist message types, schema-check values, cap lengths/arrays, reject NaN/Infinity and unknown entity IDs. Bound rates by session and connection attempts by available server controls. Inputs cannot exceed stamina, speed, action cooldown, range or path permissions. Verify readiness/start/rematch privileges. Room codes alone cannot impersonate a player or reclaim a disconnected seat.

Use HTTPS/WSS in production, validate allowed web origins, and treat origin checks as a layer rather than authentication. Keep reconnect credentials out of logs. Render names as text. Basic protection is an MVP requirement, not a claim of complete anti-cheat or DDoS defense.

## Test profiles

Use clean local connections plus 100–200 ms simulated RTT, jitter, bandwidth restriction and forced disconnects. WebSockets are ordered/reliable: induced packet loss normally appears as delay/stall, so do not test application-level unordered snapshots as if transport were UDP. Test six independent sessions, not one session cloned with shared storage tokens.
