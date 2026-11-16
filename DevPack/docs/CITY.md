# City and level design

## Location

Lisbon, Portugal: a condensed interpretation of Baixa and the edge of Alfama, ending near the Tagus riverfront. Baixa's shop-lined grid and Alfama's winding streets provide reference for different route types. See [official Baixa guide](https://www.visitportugal.com/sites/www.visitportugal.com/files/N4.BRO1009_Lisboa_ExperienciaPessoal_EN_0.pdf) and [Alfama guide](https://www.visitlisboa.com/en/places/alfama).

The map is geographically adapted for gameplay. Do not label it a 1:1 reconstruction. Use fictional bank/shop names and fictional officials. Research references are not automatically reusable textures or models; follow ASSETS.md for rights.

## First slice

One straight road, three logical travel lanes where space permits, one right-angle intersection, one single-lane side street, one short foot shortcut, bank façade, bike stand and collision proxies. Include a modest incline to test ground alignment. Finish one block visually before extending the same style to the map.

## Complete MVP layout

Approximately 6–8 compact blocks, roughly 250–350 m across as an initial scale target. Adapt distances after timing the chase. Plan a loop/revisiting routes if necessary; map area alone does not guarantee a six-minute match.

- Bank square: close, equally viable player spawn positions and clear departure sightline.
- Two wider streets: lane changes, overtaking and vehicle value.
- Commercial block: borrowing NPC, bicycle shop, accessible interaction zone.
- Hill street: tradeoff between transport speed and uphill/downhill travel.
- Alfama-inspired foot lanes: stairs/shortcuts, single-lane turning, no vehicles.
- Lift circuit: two safe stops, a useful but imperfect route.
- Riverfront: visible escape objective and two interception approaches.
- Secondary exit: forces route variation across matches.

Provide at least two meaningful routes to each main pursuit sector. No spawn is systematically closer to the only useful bike. Avoid mandatory transport bottlenecks that strand all but one player.

## Graph and collision

World data defines route centerlines, lane offsets, branches, slopes, permissions, triggers and collision proxies. Decorative sidewalks are not automatically walkable routes; explicitly author usable paths and mark them clearly. Stairs are foot routes, not jumping puzzles. Shared data validation checks dangling nodes, disconnected starts, exits without reachability, illegal vehicle routes, missing turnaround paths and spawns inside colliders.

Visual lane markings need not exist in every historic street. A lane is a gameplay travel band; single-lane routes must not imply three-lane roads. At turn windows, show predictable cues from the legal-action query.

## City activity

Small number of gameplay-relevant moving blockers; separately budget cosmetic pedestrians. A reduced crowd setting never removes an authoritative blocker. Narrow streets/turns help limit visible scenery, but actual rendering performance must be profiled. Never depend on geometry hiding as the only optimization.

No dense traffic simulation. Obstacles follow authored schedules/paths with bypass opportunities. Do not randomly spawn blockers directly in front of a player. Fixed daylight and reusable façade modules keep the initial content tractable.
