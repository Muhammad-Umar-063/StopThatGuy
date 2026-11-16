# Gameplay specification

All distances/durations below are initial tuning defaults. Store them in shared config and adjust through measured playtests.

## Match state machine

LOBBY → COUNTDOWN → INTRO → CHASE → RESULTS → LOBBY (rematch), or CLOSED if room expires.

- Lobby: nickname and room code, ready toggle, host starts. Practice permits one player; normal mode requires two. Maximum six. Late join during CHASE is rejected with a clear reason in the MVP.
- Countdown: 3 seconds; cancel if active players fall below the required count before start.
- Intro: approximately 8 seconds; short in-engine robbery sequence, camera/controls tutorial cue. No remote cinematic download. Server gives the chase start tick.
- Chase: initial 6-minute time limit. Robber reaches an active exit, time expires, all competitors are arrested/forfeit, or a valid capture resolves the round.
- Results: server freezes competitive actions and publishes one immutable result. Host can return everyone to lobby; reset all transient state for rematch.
- Host departure transfers host role deterministically to the earliest connected eligible player. No peer hosting; server owns the room.

## Player state

Separate connection status, participation state (active/arrested/forfeit/spectator), and locomotion state (on-foot/bicycle/scooter/passenger). Stunned and wanted are timed/status effects, not substitute match phases. Arrested players cannot interact or obstruct. A disconnected competitor receives neutral inputs and stays vulnerable during the reconnect grace period.

## Running and routes

Initial walk/run target: ~4 m/s; sprint ~6 m/s with a 100-point stamina pool, roughly 5 seconds of continuous sprint, delayed recovery while not sprinting. Final values come from playtests. Lane shifts interpolate over a short duration and obey swept collision; no teleporting sideways through traffic. Narrow foot routes and stairs make running useful.

## Robber

Server-controlled state machine: depart bank → travel chosen route → visible obstacle/transport transition → choose valid escape branch → escape/captured. Use authored graph routes and valid alternatives when blocked. Seed route selection per match for reproducible tests. The thief never teleports or silently slows based on player rank.

Start scooter speed above foot speed, but include visible bottlenecks and one transport transition. Escape destinations include a fictional riverfront getaway and alternative street exits. The complete route graph must be catchable by an informed player using shortcuts; prove this in simulation and playtests. If pathfinding fails, use a safe reachable fallback and log it; never teleport to the finish.

## Vehicles

Bicycle: nimble, roughly 7 m/s on level roads; reduced uphill speed. Scooter: roughly 10 m/s, more momentum and slower turns. Speeds and turning curves are starting values. Both use authored route constraints; no simulated full drivetrain or wheel physics.

Vehicle ownership is atomic on the server. A world vehicle has one owner or none; passengers use explicitly defined seats. Mounting requires range, visibility, eligibility and availability. A mounted vehicle cannot be stolen directly from a player. Dismounting places the player in a validated clear position; reject unsafe attempts. Abandoned vehicles return to valid parking positions after a configurable idle period if needed to prevent blocking.

Borrowing: hold/press the interact action at a consenting adult NPC for a brief exchange. Fixed-route lift: one clearly marked NPC vehicle, low-speed boarding zone, at most two passenger seats, board/disembark only in safe zones. Riders cannot steer it or capture while seated. Cosmetic trams are not rideable unless separately tasked; use a simple small delivery vehicle for the required lift.

## Sabotage

X selects one nearby opponent in a forward cone. Initial range 1.5 m, cooldown 3 seconds, disruption ~0.5 seconds and ~1.5 seconds of post-hit protection. Server checks range, facing, line of sight, phase and status. Missed attempts cost some momentum. Mounted hits produce a wobble/speed penalty, not lethal crashes. No attacks while a passenger or in spectator mode. No chain-stun stacking. Collision between players should not allow permanent road blocking.

## Theft and police

One fictional bicycle shop offers a valuable vehicle. A visible detection meter/witness cue communicates risk. Hold E for ~2 seconds at the theft interaction; release or leave range to cancel. Detection is based on visible shopkeeper/camera zones and a brief response delay, not an opaque random roll. Successful detected theft marks the player wanted and alerts police. Taking a borrowed/public vehicle is not theft.

Police follow reachable authored routes toward wanted players. Initial arrest requires proximity and line of sight for ~1 second; collision alone is not immediate elimination. Explain wanted/arrest state in HUD. Arrest dismounts the player, releases the vehicle safely, disables competition and enables spectating. The MVP wanted state lasts until round end. Police do not pursue players for harmless comic shoves in this version; this is an explicit game rule.

## Capture and simultaneous events

F begins a short capture attempt (~350 ms) only within ~1.5 m, with line of sight and relative speed low enough to grab. A vehicle rider must slow below the configured capture speed; passengers must dismount. Breaking range/visibility, being stunned/arrested or leaving CHASE cancels it. Do not capture just by colliding.

Server resolution order per tick: validate inputs → movement/collision → action effects → theft/police/arrest → eligible capture completion → escape/timeout → result. Arrest invalidates a capture completed on that same tick. Otherwise earliest server capture-completion tick wins; exact ties use start tick then stable join order. Never trust client-reported timestamps for victory. Capture wins over escape/timeout on the same tick only if it remains valid after movement and effects. Document this tie rule in tests.

## Results and humor

Main prize to capturing player; secondary comic titles for measurable events (longest foot distance, most transport changes, highest damage deduction). No dropped-money collection subsystem is required. Deductions are fictional currency and do not reverse the capture winner. On escape/timeout there is no capture winner. No real money, gambling, prizes or payment processing.

Short original lines such as “Hero of the city. Debtor of the bicycle shop.” Support local muting/reduced effects; keep key information visible rather than audio-only. Avoid repetitive joke spam; use cooldowns and event priority.
