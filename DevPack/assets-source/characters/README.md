# Original player and satchel robber

T015 authors two smooth stylized adult characters for the existing Lisbon street.
This is actual skinned art, not a primitive calibration capsule. User visual review
is still required. The same 17-joint skeleton drives both clothing variants.
Height at rest is approximately 1.82 m including hair/headwear; the origin is at
the ground between the feet, project +Y up and +Z forward. Bone suffixes L/R
are anatomical: at yaw zero, left is project -X and right is +X.

## Source and permission

`model.mjs` specifies original anatomical/garment ring profiles, facial features,
hands, shoes, hair/headwear, clothing colors and the robber's canvas bag/strap.
`mesh.mjs` creates smooth shared normals and weighted ring surfaces. `rig.mjs`
defines joint rest positions and authored idle, run, sprint and left/right balance
curves. These are AI-assisted procedural authoring, not mocap or third-party art.
See `assets/licenses/characters/ORIGINAL.txt` for the scoped project permission.
No external textures, fonts, paid API, downloads or modeling package are needed.

The Quaternius candidate was checked on 18 November 2026 at
https://quaternius.com/packs/universalbasecharacters.html and
https://quaternius.itch.io/universal-base-characters . Its publisher advertises a
free Standard base-body kit and CC0. The paid Source tier is separate. No archive
was acquired, so archive-specific rights, clothing, clip inventory and source
hashes remain **unverified**; none of that candidate is shipped. The original
characters avoid depending on an unverified acquisition. `assets/CANDIDATES.md`
is a historical lead list and is not changed by this task.

## Reproduction

From DevPack, run `node assets-source/characters/export.mjs`; `--check` compares
all outputs byte-for-byte. The exporter writes only the two runtime GLBs, the
owned character manifest and `export-report.json`. That report records SHA-256
of each authoring file/runtime artifact, exact vertices/triangles per LOD,
material/image counts, joint count and clip stride/duration metadata.

The export is glTF 2.0, with real skins, normalized four-slot joint weights,
inverse bind matrices and quaternion/translation keyframes at 60 Hz. Authoring
uses project coordinates. Export reflects X and reverses triangle winding;
Babylon's official automatic glTF conversion root must remain intact. All three
LOD meshes share one rig/material in each file. They are generated at lower ring
resolution, not coincident duplicate high-detail meshes. No decoder/compression
extension is required. Runtime decoding uses the integrated lazy asset API.

The two runtime files total approximately 2 MiB. Source consists of small text
files. Git LFS is not justified at this size; no Git configuration is changed.
Characters are visual only; their meshes never supply authoritative collision.
