# Robber progression

The public simulation runs the robber during the movement stage of each chase
tick. Countdown/intro retain the existing phase clock and stationary `departing`
state. Escape is only queued by movement, then resolved after the reserved
capture stage. Escape beats timeout on the same tick; a previously published
result cannot be replaced.

Routes are selected with the match RNG from reachable, mode-permitted,
collision-clear authored `robberEscape` routes, in stable route-ID order.
Approaches retain mode and lane information. Each route contributes one choice,
even if several approaches reach it. Geometry uses the existing road poses,
branch connectors and collision sweeps. Actual segment lengths consume elapsed
time, including turns and offset lanes. Exit entry is swept on the terminal edge.

Scooter speed, foot speed, acceleration, collision dimensions and road speed
limits reuse shared tuning/data. An authored foot boundary causes a stopped
`transition` for `robber.transitionMs`, followed by one dismount. No remount,
vehicle ownership or player-rank adjustment is implemented. Normal player early
buffering remains disabled.

Missing/unreachable exits use clear default continuations, then stable branch
order. If no continuation exists, the robber stops at the last safe position
and the existing time limit ends the match. A newly blocked turn is held on its
curve instead of projecting back onto the road. Static worlds are expected to be
validated by their author/loader; this is not a replacement world validator.

`collectRobberDiagnostics(state)` drains deterministic `{ tick, reason, edgeId,
routeId }` records. Each reason/edge/route combination is recorded once per match
to avoid repeated fallback spam. These diagnostics stay outside wire snapshots
and game-event IDs. A host should drain them after initialization and stepping
for operational logging. That server consumer is not wired here (REQ-002).

Later integration must run every T016 exit through the public simulation,
verify visible foot transitions/bottlenecks and practical shortcut catchability,
and run T014's config mismatch checks with `provisional-3`. First-street remains
a no-exit timeout world. Presentation/intro animation and capture rules are
separate tasks; current evidence is simulation and existing component browsers.
