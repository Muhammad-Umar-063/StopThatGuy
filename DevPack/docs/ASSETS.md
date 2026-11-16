# Asset pipeline

## Formats and organization

Use GLB/glTF for exported runtime 3D models/animations. Blender is the intended editing tool if available; no assumption that it is installed or that agents can automatically obtain finished rigged models. Store originals in assets-source and optimized runtime exports in client public/assets. Treat source and runtime files as separate artifacts.

Use meters, consistent upright orientation and deliberate origins. Verify glTF-to-Babylon coordinate conversion visually against an arrow/grid fixture. Apply intended transforms, inspect normals and material response, and retain only needed animation clips. Use a consistent character skeleton where practical.

## Provenance manifest

Each shipped asset entry records: stable ID, relative runtime path, source path/URL, creator, license identifier/text location, attribution requirement, modification notes, file size, triangles/LODs/material count where relevant, texture sizes and animation names. Record self-authored/generated assets honestly, including generator terms checked at acquisition. No fabricated license claims.

Use owned assets or licenses permitting the intended use and redistribution. Do not use scraped game models, watermarked previews or random search-result images as textures. Do not buy assets automatically. If an asset is unavailable, continue with labeled placeholders and record the missing dependency; do not call final art done.

## Import steps

Acquire/author → record provenance → normalize scale/origin → inspect rig/animations → remove unused geometry/materials → create LODs and simple collider proxies → compress textures/geometry only with supported runtime loaders → export → validate in browser → update manifest/budget report.

Compression needs an end-to-end test, including decoder availability and failed-load handling. Do not add all compression formats at once. Ship a sensible fallback or a readable error for unsupported/failed assets. Reference assets by a central catalog rather than scattered hard-coded paths.

## Reuse

Modular façades, shared tile/stone/plaster atlases, repeated windows/balconies, instanced street furniture. Vary color and arrangement without multiplying expensive materials. Author collision separately in world data; compare visual and gameplay envelopes during QA.

## Audio

Short licensed/original effects, city ambience, alarm, footsteps, wheels, impacts and results cue. Browser audio starts after a user gesture (keyboard/touch). Master and effects volume, mute and visible equivalents for important cues. Avoid repeated overlapping impact/alarm spam.

## Source control

Assess Git LFS for large binary source files in T008; record setup if adopted. Do not commit enormous redundant exports or build output. Reserve stable asset IDs so art replacements do not require gameplay changes.
