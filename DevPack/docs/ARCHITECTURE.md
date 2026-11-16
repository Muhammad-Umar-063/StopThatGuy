# Architecture

## Stack and boundaries

Use TypeScript throughout. Babylon.js renders the client; Vite builds it. Node.js runs a Colyseus room per match. Babylon documents this integration, but its tutorial is illustrative, not a dependency-version lock: [official integration guide](https://doc.babylonjs.com/guidedLearning/networking/Colyseus). T001 verifies current compatible package versions, records them and commits a lockfile.

Use npm workspaces initially, one package manager and one root lockfile. Do not introduce framework layers solely for menus; DOM/CSS and small typed view controllers suffice. Use Vitest for shared rule tests and Playwright for desktop browser integration if compatible versions are available; real device checks remain manual where automation cannot represent hardware.

## Intended repository structure (created by implementation tasks)

```
apps/
  client/
    src/
      bootstrap/       # scene composition and dependency wiring; integrator owns
      input/           # keyboard and touch -> shared intent format
      camera/          # follow, turn and obstruction behavior
      network/         # Colyseus adapter, snapshots, reconnect
      presentation/    # local prediction / remote interpolation
      render/          # Babylon scene/entity views, lighting, animation, effects
      ui/              # menus, lobby, HUD, results, accessibility
      audio/           # event-driven sounds and mixing
    public/assets/     # optimized shipped assets, not source Blender files
  server/
    src/
      rooms/           # join/leave, room lifecycle, reconnection, transport
      adapters/        # simulation state -> Colyseus schema
      validation/      # untrusted message boundary and rate limits
      bootstrap/       # server config, startup, health endpoints
packages/
  shared/src/          # plain types, intent schema, IDs, config, protocol version
  simulation/src/      # fixed-step authoritative rules, pure TS, no engine imports
  world/src/           # versioned path graph, colliders, spawns, trigger definitions
  test-support/src/    # fixtures, deterministic input streams, headless clients
assets-source/         # original models/textures; Git LFS if warranted
assets/manifest.json   # provenance and technical metadata
scripts/               # validation, budgets and tooling
tests/                 # integration, browser and release scenarios
docs/, tasks/, coordination/
```

## Dependency direction

shared ← world ← simulation ← server. Simulation may also import shared directly. Client imports shared and world plus a narrowly exposed prediction/movement subset of simulation. Server must not import client. Shared/world cannot import server, client or simulation. Shared contracts remain plain data; Colyseus schema classes live in server adapters.

## Simulation

Use fixed-step kinematic simulation, initially 30 ticks/second. Model grounded movement on an authored 3D route graph with lane offsets and terrain height. Coordinate convention: Babylon left-handed world, Y up, X/Z ground plane, meters, yaw in radians; route-relative branches are defined from the incoming tangent. Document glTF conversion at import; keep gameplay coordinates consistent after conversion.

Static boxes/capsules/segment boundaries approximate building and obstacle collision. Vehicles and players use swept simple volumes to avoid tunneling. The server owns all meaningful colliders. Rendered wheel motion, leaning, cloth and facial changes are cosmetic. Stairs use authored ground-height/foot paths; vehicles are blocked by path permissions. No rigid-body parity problem or Havok dependency is needed for this constrained MVP.

Simulation functions accept explicit state, validated inputs, tick duration/config and seeded randomness. They return state updates and typed events. No wall-clock reads or random calls hidden inside rules. Store authoritative event ordering in one place.

## Client

Bootstrap composes input, connection, world view, entity views, camera and UI. Rendering reads a presentation state, not mutable Colyseus objects scattered through meshes. Local prediction uses the same movement kernel; critical interactions wait for server results. Animation derives from authoritative/predicted movement and discrete events. UI consumes a view model and emits typed intents, allowing UI work against fixtures before the server is complete.

Quality settings only change presentation. Never remove an authoritative obstacle or opponent to improve FPS. Local menus do not pause online simulation. Clean up scenes, listeners, timers, animation groups and connections on rematch or exit.

## Content and map

Versioned world data supplies the route graph, lanes, transforms, collision primitives, triggers and spawns to both sides. Visual meshes and textures are client-only. Stable entity IDs link meshes to map data. Static render assets can load by visible city sector; collision/route definitions needed for the match must be available before the chase starts.

## Infrastructure

One always-running server instance, memory-resident rooms, no database. Restart ends active rooms; clients receive a restart/disconnect explanation. Serve static client assets separately, connect using secure WebSockets in production. Hosting is selected in T045. Persistent sockets must not be placed in an unsuitable short-lived request function. Multi-instance routing, Redis and horizontal scaling are deferred.

## Initial runtime budgets

30 Hz simulation, 15 Hz state patch target, render at device-supported FPS. Treat these as measured tuning variables. Bound catch-up work after pauses, do not advance with arbitrary giant delta times, and log tick overrun/room load. Protocol, world and tuning versions must match at join; fail clearly on mismatch.

## Optional physics evaluation

The user permits cannon-es when justified (D021). T021 first evaluates whether authored acceleration, braking, turning and collision meet the vehicle feel. If physical suspension/contact or dynamic bodies are needed, prototype a narrowly scoped adapter and measure server/client cost before adoption. Keep gameplay rules outside the physics engine. Preserve authoritative server simulation; do not assume cross-device floating-point physics is deterministic. Record required prediction/replication changes in a dedicated integration task. Babylon.js remains the renderer; no Three.js dependency is currently planned.
