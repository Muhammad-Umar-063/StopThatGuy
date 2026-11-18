# Lisbon city gameplay graph — T016

`LISBON_CITY_WORLD` / `LISBON_CITY_IDS` export **lisbon-city-1**, schema 1. The map
is an adapted, fictional Baixa/Alfama district: six blocks, 300 m east–west by
200 m north–south, ground heights 0–18 m. It is gameplay data with authoritative
collision proxies, not finished city art. `FIRST_STREET_WORLD` and
`first-street-1` are unchanged; existing server/bootstrap/environment consumers
still use that street. Both maps are registered in `AUTHORED_WORLDS`.

```text
                  west                 centre                  east
z=200 y=18    o----------------o----------------o----------------X hill exit
             |  ELEVADOR      |   BANCO HILL    |   ALFAMA       |
             |  lift circuit  |                |        stairs /o z=150 y=12
z=100 y=6    o-------o--------o----shop---------o-------o--------o
             |      / arcade  |                |                |
z=50 y=3     o     /          |                |                |
             |  ARCO          |   BANK         |   RIBEIRA      |
z=0 y=0      X----------------o----------------o----------------X river east
          river west       bank square
                            players / robber start northbound
             x=0            x=100            x=200            x=300
```

Road pairs use shared centre lines with `[-3, 0, 3]` travel bands, open to foot,
bicycle and scooter. Foot passages have one centre lane. Heights interpolate
continuously; five-metre flat landings at road junctions prevent steep lateral
connections during late turns. Maximum wheeled grade is 15%; the stairs include
a roughly 28% climb. All incoming edges, including escape approaches, have a
default continuation. At a corner/T this default may bend; other branches retain
geometrically correct left/right labels. No reversing action or mandatory lift
ride is needed to leave any edge.

The six building groups leave 15 m road setbacks and two open corner courtyards.
Collider geometry, all lane travel bands, lane changes and actual movement
connectors are checked with continuous body sweeps. Camera obstructions have
distinct IDs and do not add gameplay collision.

## IDs and routes for T013

Use `LISBON_CITY_IDS.edges.<name>.out/back`; persisted edge IDs have the form
`city-e-<kebab-name>-out/back`. Out travels east on horizontal roads, north on
vertical roads, and uphill through each foot passage. Full edge sequences are
in `lisbon-city.ts`; route IDs below are stable within this map version.

| Route ID | Purpose and path | Centreline length |
|---|---|---:|
| `city-r-escape-arcade` | Bank → west market → arcade downhill → west river exit | 271 m |
| `city-r-escape-hill` | Bank → east market → stairs uphill → hill exit | 372 m |
| `city-r-escape-east` | Bank → east market → stairs → east hill downhill → east river exit | 472 m |
| `city-r-escape-west` | Bank → stairs → ridge west → west hill → west river exit | 873 m |
| `city-r-police-baixa` | Closed perimeter of the three lower blocks | 800 m |
| `city-r-police-hill` | Closed perimeter of the three upper blocks | 802 m |
| `city-r-lift-circuit` | West market → Banco hill → ridge west → Elevador hill | 402 m |

All escape sequences begin on `city-e-bank-out`, where the robber starts at 22 m
in the centre lane. Six player starts occupy two rows at 6/10 m. Each escape
requires exactly one scooter-to-foot boundary. The arcade is capped at 3.5 m/s;
stairs at 3 m/s. These single-lane passages supply geographic bottlenecks; no
player-rank slowdown is encoded. Their approximately 71–72 m paths save more than
20% in distance over the corresponding 100 m road corners, with higher grades
and lower speed limits as tradeoffs. Measured kernel traversal from rest without
sprinting is quicker through both passages; this does not imply a time advantage
against every sprint/vehicle strategy. These are provisional layout values, not
accepted chase balance or a guarantee of six-minute rounds.

The branches after the shared bank edge split west/east. Every route-specific
edge has an alternative escape sequence that avoids it. All allowed edges are
strongly connected per travel mode; route selection can recover onto another
path. Blocking the shared bank spawn corridor itself is not a promise of an
available escape: T013 must stop safely or time out when no clear continuation
exists. Test missing/blocked paths with task-local fixtures until manual
integration; do not copy this uncommitted map to another worktree.

## Shop, lift and patrol access

The fictional shop zone `city-z-shop` centres on (130, 6, 100), contains the shop
bicycle and is reached on foot/bicycle/scooter from either direction. Public
bicycles flank the bank route at equal distance; a borrowable scooter is farther
along the shop street. The second player row still has a 4 m head start;
competitive spawn rotation/balance remains unverified.

Lift stops `city-z-lift-low/high` sit at (10, 6, 100) and (50, 18, 200).
Only the five directed edges of the lift circuit allow `lift`. Players retain
both road directions and alternate routes. The static waiting/boarding volumes
and a conservative 2.2 m lift radius have clear envelopes. This proves authored
access and clearance, not boarding, seats, schedules or actual lift dynamics
(T021/T030). The two patrol loops collectively cover every sector and have
matched police starts. Police pursuit remains T027.

## Verification and integration boundary

Normal test globs execute `packages/world/test/city.test.ts` and the explicitly
leased root `tests/city-world.test.ts`. They cover all-mode reachability,
route/zone semantics, loop closure, grades, every incoming lane/turn/grounded mode,
late-turn connectors, conservative vehicle/lift envelopes, all four escape paths
driven by the merged foot kernel, and practice/six-player public simulation
loading and movement. Negative mutations block a thin road segment or a corner,
break routes/modes/loop closure, and move an exit volume away. Source/compiled
exports and the original first-street data fingerprint are also checked.

After reviewed manual integration:

1. T013: replay all routes with real robber AI, verify the one-second safe mode
   transition, blocked-route fallback and each terminal exit. Prove catchability
   with legal player actions and playtests; foot-kernel path acceptance alone
   does not establish AI escape balance, capture rules or complete matches.
   The long west route passes the hill exit before reaching its selected west
   exit: only `escapeTargetZoneId` may finish that match. Add that regression.
2. T014: explicitly select the same map/version on client and server, verify
   mismatches, authoritative snapshots/input acknowledgements and the merged
   config version. This task does not switch the live room from first-street-1.
3. T015/T039: use character metre scale and authoritative route heights. Aggregate
   character assets with existing manifests. The T011 street renderer is aligned
   only to first-street-1; it must not be stretched and presented as full-city art.
4. T020: assemble the online chase after its remaining dependencies. Existing
   lobby/camera/street browser previews remain separate acceptance surfaces.

No shared schema, protocol, dependency, lockfile, engine, bootstrap or simulation
implementation changes are included in T016.
