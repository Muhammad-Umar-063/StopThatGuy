# Graphics and performance direction

## Visual target

Smooth stylized realism: natural human proportions, rounded silhouettes, believable street scale, coherent materials and expressive animation. No blocky final characters, voxel city, toy-brick proportions or flat unlit placeholder scene as final art. No photorealistic promise.

Warm Lisbon afternoon: pale plaster, muted pastel façades, tile accents, terracotta roofs, stone paving, dark asphalt and restrained colorful signs. Player clothing provides distinct readable colors. Robber silhouette and bag remain identifiable without relying only on red/green color. Keep the route readable above decorative detail.

## Model and animation quality

Spend geometry on faces/silhouettes, shoulders/elbows, hands at handlebars and nearby wheels. Use smooth normals and controlled edge bevels. A low-polygon model can look smooth, but shading cannot hide an angular silhouette viewed close up. Avoid mixing realistic people with cartoon buildings or inconsistent asset scales.

Minimum character clips: idle, run, sprint, turn/lean, interact, riding pose, stumble, arrested/standing, victory. Blend animations; match movement speed to strides/pedaling to reduce sliding. Foot placement on slopes can be approximated initially; full procedural IK is optional after a measured need.

## Lighting and quality

Static environment lighting largely baked/precomputed where the pipeline supports it. One principal sun direction, restrained environment light. Low mode can use cheap contact/blob shadows; medium adds limited dynamic shadows near the player. No mandatory SSR, motion blur, volumetric fog, expensive transparent layers or real-time global illumination. Keep antialiasing appropriate to the device; verify that resolution scaling remains readable.

| Setting | Low | Medium | High (optional) |
|---|---|---|---|
| Internal resolution | Adaptive ~60–85% | ~85–100% | 100% with capped pixel ratio |
| Shadows | Baked/contact | Limited nearby dynamic | Higher resolution nearby |
| Model detail | Earlier LOD changes | Standard LOD | Longer detail distance |
| Decoration | Sparse | Moderate | Additional cosmetic density |
| Effects | Essential feedback only | Modest | Extra cosmetic effects |

All settings preserve authoritative entities/collision and information needed to compete. Offer manual quality override. Automatic downshift uses sustained frame time and hysteresis to avoid oscillation.

## Provisional engineering budgets

These are initial limits to instrument, not evidence of performance:

- Low-mode visible triangles: aim below ~250,000; draw calls below ~120 in a representative chase view.
- Main character LOD0 approximately 8k–15k triangles; LOD1 ~3k–5k; far LOD ~1k–2k. Tune combined visible-character cost.
- Vehicles ~3k–8k triangles nearby, simpler farther away.
- Mostly 512–1024 px textures/atlases; 2048 only where measured benefit justifies memory. Avoid shipping unused variants.
- Initial interactive download target <=20 MB compressed; full initial-map assets <=40 MB compressed, loaded in stages when feasible.
- Reuse materials and instance repeated props. Cap device pixel ratio, visible decorative NPCs and shadow casters.
- GPU memory/thermal behavior must be checked on real Android hardware; do not infer safety from compressed download size.

## Performance acceptance

Select actual baseline devices and record model, CPU/GPU, RAM, OS, browser and resolution. Target a stable 30 FPS on low-end baseline and 60 FPS on capable hardware. Use a five-minute representative chase after warm-up, six players/equivalent representative load, and record frame-time percentiles, stalls and thermal degradation. Low target: median frame time <=33.3 ms, p95 <=45 ms, no repeated long stalls; tighten after initial profiling. Report results rather than declaring all low-end devices supported.

FPS alone is insufficient: verify input response, loading, text readability, camera occlusion, animation blending, and no crash/memory growth across rematches.

## Visual gate

T011 produces one finished street; T015 adds the final-style character. Present actual gameplay views from the target camera and low/medium settings, not a concept render pretending to be gameplay. Record user feedback if available. Proceed with the documented style for reversible work while feedback is pending; major art replacement gets a new task.
