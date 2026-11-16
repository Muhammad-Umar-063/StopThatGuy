# Product brief

## Experience

A bank robber escapes on a scooter. Nearby citizens race to catch him for a fictional mayor's prize. They begin on foot, obtain transport, use shortcuts, inconvenience rivals, and risk arrest if they steal from a shop. The humor comes from ordinary city activity colliding with their ambitions.

Working title: Stop That Guy! Setting: a condensed, geographically adapted Lisbon neighborhood drawing from Baixa and Alfama. The bank, businesses involved in crimes, mayor and story are fictional. Time of day: sunny late afternoon, fixed throughout a match.

## Audience and platform

Desktop/laptop browser with keyboard only; Android browser in landscape with touch buttons. Proposed test browsers: current Chrome and Edge on desktop, Chrome on Android. Firefox desktop is a compatibility check. iOS/Safari and app-store builds are outside baseline until separately tasked.

One room supports 2–6 human competitors plus an AI thief; one player may start a practice match. No rival bots in the initial scope. Gameplay is server-authoritative in both modes.

## MVP loop

Enter a nickname → create/join a room → ready up → short robbery opening → chase → obtain transport or use foot shortcuts → sabotage/risk theft → capture thief or see him escape → results → rematch.

## Included

- One connected city map, roughly 6–8 gameplay blocks; readable routes and intersection cues.
- Road-relative lane movement, contextual turns, third-person follow camera, sprint/stamina.
- AI thief, multiple authored escape routes, visible transport transitions.
- Bicycles, scooters, one fixed-route NPC lift; borrowing and one stealable bike shop.
- One short shove/kick interaction, cooldown, recovery protection.
- Wanted status, simple police pursuit, arrest, spectator mode.
- Capture, escape, timeout, consistent results, fictional award ceremony and rematch.
- Guest rooms, reconnect handling, loading/failure states, sound settings and quality presets.
- Smooth 3D models and animation, day lighting, limited decorative city activity.

## Excluded

Full Lisbon recreation, photorealistic/AAA art, large open world, playable robber, motorcycles, skating, freeform building interiors, weapons, character injury simulation, ragdoll physics, advanced traffic, voice/text chat, accounts, paid rewards, monetization, database progression, rankings, matchmaking queues, large-scale production infrastructure, gamepad support, general jumping/climbing, free mouse look and offline play.

Children, if present decoratively, are non-targetable. Borrowing NPCs can be adults; child-specific borrowing is not a required feature.

## Completion criteria

Six real clients can create/join a match, chase and interact, handle vehicle contention, experience theft/police consequences, reach a consistent ending, spectate and rematch. One connected client can practice. Keyboard and touch flows are complete. Agreed device tests meet documented targets or the release explicitly records a user-accepted limitation. Shipped assets have provenance. Production configuration, deployment and restart limitations are documented.

“Playable”, “online”, “optimized”, and “released” must correspond to demonstrated behavior. A mock lobby, static screenshot or simulated local opponents do not satisfy multiplayer completion.
