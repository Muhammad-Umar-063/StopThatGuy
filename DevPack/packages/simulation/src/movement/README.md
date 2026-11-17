# Road movement

`roadMovementKernel` is the default authoritative kernel and the exported pure
implementation for future prediction. Inputs are sampled once per fixed tick;
the simulation deduplicates edge-action IDs before steering. Missing input coasts,
Down overrides Up, and simultaneous left/right cancels the directional action.

`motion` is explicit deterministic memory: callers retaining kernel state must
retain it as well as route/speed/stamina. The simulation clones, validates and
commits it together with all grounded player updates. It is private per match and
is not in public snapshots. T022 must resolve reconstruction before prediction;
no prediction or wire-memory synchronization is claimed here. Custom injected
kernels are supported but get conservative unavailable legal actions because
the simulation cannot infer their rules.

`queryRoadActions` and steering share branch, mode and collision eligibility.
Speed-sized lookahead is clamped to 5–8 metres and intersected with authored
windows. Early buffering requires `allowEarlyTurnBuffer: true` plus the displayed
`earlyBuffer` cue. The normal simulation leaves this off until T014/T018 supplies
visible cues. A buffered press never also shifts a lane and expires within 250 ms.
Active turns ignore new steering; lane shifts do not stack. Exhausted held sprint
cannot oscillate between regeneration and sprint: release Shift to reset it.

Collision uses upright swept bodies over authoritative box/cylinder proxies.
Traversal splits at corners, follows authored connectors, and uses forward
branches for marked turnarounds. Continuous bounded miter offsets avoid lane
teleports at bent centerlines. Combined forward/lateral sweeps conservatively
cover quadratic offset motion. Speed/distance on road edges is centerline
progress, so physical distance around a bend can differ between offset lanes.
Character-to-character collision, vehicles mounting and sabotage belong to later
tasks. All current authored edge speed limits are null; mode speed applies.

Tuning is versioned as provisional-2 in shared config. Tests cover real
FIRST_STREET_WORLD inputs through default createSimulation, single-player and
normal modes, fixed-step equivalence, cue arbitration, buffers, stamina,
collision, slopes, turnarounds and private-memory isolation.
