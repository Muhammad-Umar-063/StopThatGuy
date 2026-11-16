# Controls and camera

## Core interpretation

The player moves along a directed road/footpath graph. Lane changes move laterally relative to the current route. At an eligible junction, a left/right press selects a connected branch. The player's world heading changes and the camera follows; from behind, the player remains facing into the new road. Do not rotate the camera alone while leaving world travel unchanged.

The camera needs no manual control. This is a full 3D scene, not a rotating 2D map or forced infinite runner.

## Desktop bindings (initial defaults)

| Input | Action |
|---|---|
| Hold ArrowUp | Move/accelerate forward |
| Release ArrowUp | Decelerate toward a stop |
| Hold ArrowDown | Brake; wins if Up and Down are both held |
| Press ArrowLeft / ArrowRight | One contextual turn or lane change |
| Hold Shift with Up | Sprint on foot while stamina is available |
| Press E | Contextual borrow/mount/board; dismount if mounted and safe |
| Hold E at shop | Commit theft while the progress indicator is active |
| Press F | Attempt capture when eligible |
| Press X | Attempt shove/kick when eligible |
| Escape | Open/close local menu; online world continues |
| Arrows, Enter, Escape | Navigate menus, confirm, go back |
| Tab / Shift+Tab | Standard accessible focus navigation |

No action requires clicking. Prevent page scrolling for game arrows only when gameplay has focus. Text inputs keep editing/navigation behavior. Ignore key-repeat for lane/turn presses. Clear held inputs on blur, visibility change, disconnect and touch cancellation. Returning to the game must not restore a held action automatically.

## Junction arbitration

1. Author each junction with incoming/outgoing directed paths, branch side, allowed transport modes, turn path and trigger window.
2. Present a turn cue when the server-consistent eligibility conditions are met. Direction cues distinguish a turn from a lane shift.
3. On a new left/right press, select an eligible branch on that side. Otherwise attempt one adjacent lane shift if there is room. If neither is possible, show subtle feedback and do nothing.
4. Branches take priority inside their visible turn window, regardless of lane. This is an arcade simplification.
5. An early press may be buffered for up to 250 ms only when the upcoming cue explicitly indicates buffering. Never both change lane and turn from one press.
6. Simultaneous left and right cancels the directional action. During an active turn, ignore new turn requests; do not stack them for later intersections.
7. Releasing and pressing again is necessary for another lane shift/turn. Holding a direction never cascades across lanes.
8. Disabled/blocked branches are not eligible. The server validates the same turn rules; the client cannot invent branches.

Use a tuned approach window (~5–8 m initially), sized to speed so players have a readable opportunity. Store tuning in shared config, not independent client/server constants.

## Movement edge cases

Single-lane alleys offer turns, not lateral movement. Road crossings/foot shortcuts are graph branches with clear visual cues. There is no general jump button in the MVP. Stairs are accessible on foot through authored paths; mounted players must dismount. Dead ends have a marked turnaround path selected by forward movement at the end node, so a player cannot become permanently stuck. Temporary blockers always leave a return or bypass route.

## Camera

Follow behind and above the local player. Start around 5 m behind/3 m above, looking toward a point ahead; tune in the playable slice. Smooth follow and turn movement with frame-rate-independent damping. Camera rotation follows path curvature and world heading; do not apply an instantaneous 90-degree snap. Prevent wall penetration with collision/obstruction checks and shorten the camera boom when needed. Avoid decorative geometry obscuring the local character for long periods.

No motion blur, automatic zoom pulses or mandatory shake. Provide reduced-motion mode with no shake and restrained camera transitions. Gameplay position/collision is independent of camera smoothing. Spectators cycle targets with Left/Right and get an automatic camera.

## Android landscape

On-screen directional pad for movement, sprint button and contextual action buttons for interact, capture, shove. The underlying intents are identical to keyboard intents. Support holding forward plus sprint/action with multiple touches. Use large separated targets (at least 48 CSS px initial minimum), safe-area padding and labels/icons that remain readable.

Portrait shows a rotate-device suggestion with usable menu access; do not assume browsers allow forced orientation or fullscreen. Touch cancellation, app switching and focus loss release all controls. Prevent gesture scrolling within the play surface without disabling normal page/menu interaction elsewhere. Touch users do not receive easier capture ranges or different speed limits.
