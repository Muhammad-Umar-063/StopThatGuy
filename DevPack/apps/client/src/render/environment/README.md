# T011 — Lisbon street visual slice

This is one adapted Baixa/Alfama street built from read-only `FIRST_STREET_WORLD`
(`first-street-1`). The isolated preview shows actual Babylon renders at low and
medium settings; its fixed camera and amber 1.7 m capsule are explicitly
provisional. It does not implement T010's camera, final characters, a networked
match or the full city. Final user art approval and real-device performance remain
pending. See `evidence/README.md` for executed checks and measured scene costs.

## Construction and ownership

`createStreetEnvironment(scene, world, loadedAsset.container, quality)` consumes
the registered `environment.lisbon-kit` through the existing lazy asset API.
Dispose the environment before its caller-owned asset handle. World IDs anchor
routes, shells, lamp and bike rack. Road widths, slopes and authoritative collision
are unchanged. Pavements, roof closures and the ground skirt are visual geometry;
they never declare additional walkable space or collision.

The original source kit in `assets-source/environment/` contains stone reveals,
shutters, opaque glazing, arched portals, balconies, cornices, curved furniture
and flower boxes. The 1,211,428-byte GLB contains 6,440 template triangles and 14
materials. Five 256² maps and one 512² paving map are embedded. Three 512×128 signs
are drawn locally with a system font. No third-party models, textures, fonts,
paid tools or new dependencies were used; provenance and the scoped project-use
license are in the environment manifest and source directory.

Static meshes are batched by material/shadow role; architectural details use thin
instances. Paint variants share the kit's plaster texture, and reload tests check
meshes, materials and texture counts. The glTF conversion root is preserved;
placement transforms are conjugated through source world matrices.

Low uses 75% internal resolution, no dynamic shadow map and fewer ornaments.
Medium uses capped full resolution, 1024² PCF sun shadows and balcony ornaments.
Both preserve road geometry, collision anchors and basic facade rhythm. Warm sun
and sky fill are used without SSR, expensive postprocessing or baked-light claims.

## Verification and integration

Run from `DevPack/`:

```sh
node assets-source/environment/export.mjs --check
node_modules/.bin/tsx --conditions=stopthatguy-source --test apps/client/src/render/environment/environment.test.mjs
node apps/client/src/render/environment/browser.mjs
npm run check
KEYBOARD_BROWSER_PORT=5411 ASSET_BROWSER_PORT=5511 npm run test:browser
```

The browser runner builds an isolated production preview into ignored
`dist/preview`, uses strict port 5211, and stops only its own processes. Its normal
output is ignored `test-results/environment`; set
`ENVIRONMENT_EVIDENCE_DIR=apps/client/src/render/environment/evidence` only when
intentionally refreshing curated evidence. It records six actual views, draw
calls, total scene triangles before culling, texture sizes and resource disposal.
The software renderer is not evidence of low-end or Android frame rates.

Manual preview: `npm run dev:client -- --host 127.0.0.1 --port 5211 --strictPort`,
then open `/src/render/environment/preview.html`. Native buttons plus L/M quality
and C viewpoint keys work without a mouse. The main application still boots its
smoke scene until later gameplay assembly.

At serial integration, append the explicit environment unit command and browser
command above to standard test scripts alongside the camera/lobby commands.
The standalone preview requires no root bootstrap or Vite entry change. Catalog
registration and individual/combined category validation are included in T011;
core asset provenance and calibration coverage are preserved.
