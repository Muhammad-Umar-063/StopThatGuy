# Shared contracts — freeze in T002

This file describes responsibilities and required fields; T002 creates actual TypeScript definitions and runtime schemas. No dependency-specific API signatures are promised here. Only the coordinator merges contract changes during parallel work.

## Identity and versioning

Use opaque room/player/entity IDs. A public room code is a lookup token, not a reconnect credential. Include protocolVersion, worldVersion and configVersion in join/session metadata. Reconnect tokens are private to the session, short-lived and never logged. Nicknames are plain text, length limited and rendered without HTML interpretation.

## Input frame

Fields: monotonically increasing sequence, forwardHeld, brakeHeld, sprintHeld; unique action IDs for edge-triggered left/right, interact, capture and sabotage. Include interactHeld for shop progress. Client timestamps may be diagnostic only. Server tick and validated intent determine outcomes. Acknowledgements include the last processed sequence.

Transport code must preserve an edge action across retries without applying it twice. Reset held controls on focus loss; server neutralizes held state after input timeout. No position, velocity, vehicle ownership, hit result, reward or winner can be declared by a client input message.

## Commands

Before match: create/join room, ready/unready, host start, leave. During match: input frames, reconnect handshake, safe leave. After match: host rematch and leave. Quality/audio settings and local menus never need an authoritative mutation. Validate commands against phase, session, payload bounds and rate limits.

## Authoritative state

| Record | Minimum information |
|---|---|
| Match | phase, server tick, seed, chase start/end tick, route/exit selection, versions, host ID, result |
| Player | ID, nickname, connection/participation state, world pose, route/lane/progress, speed, locomotion, stamina, status timers, vehicle/seat ID, last processed input sequence |
| Robber | pose, route/progress, movement mode, AI state, active escape target |
| Vehicle | ID/type, pose, route/progress, speed, owner ID, passenger slots, availability/borrow/theft flags |
| Police | ID, pose/path, target ID, pursuit/arrest state |
| Interactable | ID/type, state, interaction owner/progress if relevant |
| Result | outcome, winner ID or null, reason, immutable awards/statistics/deductions |

Do not replicate static geometry, full textures or private anti-abuse bookkeeping in each patch. Cosmetic animation phase can be inferred locally where it does not change gameplay.

## Events

Typed server events: matchStarted, mounted/dismounted, liftBoarded/exited, shoveResolved, theftDetected, wantedChanged, arrested, captureStarted/cancelled/resolved, robberEscaped, matchEnded. Each event carries an ID and server tick for deduplication. Reliable state must still allow late/reconnecting clients to reconstruct the current screen without replaying every event. Do not trigger sounds every frame from a persistent boolean.

## World data

Nodes: ID, world position, type. Directed edges: source/target, centerline, length, lane offsets, allowed modes, ground heights, speed limit, branch labels. Junctions: input edge, available branches, turn curves/windows. Content: static collider primitives, triggers, spawns, shop zones, police routes, lift stops, escape volumes, camera obstruction proxies, sector membership. Include schema/world version and a validation report.

## Simulation interface responsibilities

createInitialState(config, world, seed); step(state, validatedInputs, fixedDelta); queryLegalActions(state, player); collectEvents(); readSerializableState(). Names may be refined once in T002/T003. Shared movement exposes a pure function for prediction. The server adapter owns serialization and session mapping; simulation never accepts network connections.

## UI/presentation adapter

Required read-only view model: connection state, lobby/players, local player, robber direction/distance, stamina, available actions and turn cue, timer, wanted state, messages, result, quality/audio settings. UI sends named intents through one adapter. Fixture implementations must be visibly labeled in development and replaced by real wiring for integration acceptance.

## Ownership and evolution

T002 owns initial definitions. Later tasks request minimal compatible extensions through the coordinator; code against merged types. Breaking changes require a new protocol version and updates to fixtures, server, client and tests in a coordinated task. Never introduce a local copy of a shared enum/type to bypass a conflict.
