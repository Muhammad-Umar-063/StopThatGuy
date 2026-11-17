import { Engine } from "@babylonjs/core/Engines/engine.js";
import { Scene } from "@babylonjs/core/scene.js";
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera.js";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight.js";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color.js";
import { Vector3, Matrix } from "@babylonjs/core/Maths/math.vector.js";
import { CreateLines, CreateLineSystem } from "@babylonjs/core/Meshes/Builders/linesBuilder.js";
import { DEVELOPMENT_SAMPLE_ID } from "./catalog.js";
import { loadVisualAsset, type VisualAsset } from "./loadVisualAsset.js";
import { inspectSample } from "./inspectSample.js";

const canvas = document.querySelector<HTMLCanvasElement>("#canvas")!;
const status = document.querySelector<HTMLElement>("#status")!;
const measurements = document.querySelector<HTMLElement>("#measurements")!;
const engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true });
const scene = new Scene(engine);
scene.useRightHandedSystem = false;
scene.clearColor = new Color4(0.1, 0.15, 0.18, 1);
const camera = new ArcRotateCamera("calibration-camera", -Math.PI / 3, Math.PI / 3.1, 3.8, new Vector3(0, 0.35, 0.35), scene);
new HemisphericLight("calibration-light", new Vector3(0.3, 1, -0.4), scene).intensity = 1.5;
const grid: Vector3[][] = [];
for (let n = -1; n <= 1.5; n += 0.25) {
  grid.push([new Vector3(-1, 0, n), new Vector3(1.5, 0, n)], [new Vector3(n, 0, -1), new Vector3(n, 0, 1.5)]);
}
CreateLineSystem("quarter-metre-grid", { lines: grid }, scene).color = new Color3(0.34, 0.42, 0.46);
const labels: { element: HTMLElement; position: Vector3 }[] = [];
for (const [label, position, color] of [
  ["+X · 1 m", new Vector3(1, 0, 0), new Color3(1, 0.35, 0.45)],
  ["+Y · 1 m", new Vector3(0, 1, 0), new Color3(0.35, 0.85, 1)],
  ["+Z · 1 m", new Vector3(0, 0, 1), new Color3(1, 0.65, 0.24)],
] as const) {
  CreateLines(label, { points: [Vector3.Zero(), position] }, scene).color = color;
  const element = document.createElement("span");
  element.className = "axis-label";
  element.textContent = label;
  document.querySelector("#viewport")!.append(element);
  labels.push({ element, position });
}
let current: VisualAsset | undefined;
let pending: AbortController | undefined;
let frames = 0;
let failure: string | null = null;
let lastInspection: ReturnType<typeof inspectSample> | null = null;
// Babylon caches its own PBR lookup texture per scene, outside AssetContainer.
// Account for it separately: asset disposal must leave it available to other PBR users.
const sharedTextures = () => scene.textures.filter((t) => t === scene.environmentBRDFTexture).length;
const counts = () => ({ meshes: scene.meshes.length, materials: scene.materials.length, textures: scene.textures.length - sharedTextures(),
  geometries: scene.geometries.length, transformNodes: scene.transformNodes.length, animations: scene.animationGroups.length });
const baseline = counts();
function showInspection() {
  if (!current) return;
  lastInspection = inspectSample(current);
  const forward = lastInspection.landmarksM.forward!;
  const expected = current.root.rotation.y === 0 ? [0, 0, 1] : [1, 0, 0];
  if (forward.some((v, i) => Math.abs(v - expected[i]!) > 1e-5)) lastInspection.errors.push("Project yaw convention failed");
  lastInspection.ok = lastInspection.errors.length === 0;
  document.documentElement.dataset.assetState = lastInspection.ok ? "ready" : "failed";
  status.textContent = lastInspection.ok ? "PASS — one metre high, ground origin and project axes verified." : `FAILED — ${lastInspection.errors.join("; ")}`;
  measurements.textContent = `dev.axis-marker · 128 triangles · 3 materials · no textures\nHeight: 1.000 m · Origin: [0, 0, 0] · Forward: [${forward.map((v) => v.toFixed(3)).join(", ")}]\nCyan post: +Y / 1 m. Orange arrow: forward / 1 m. Pink side marker: right / 0.5 m.`;
}
function unload() {
  pending?.abort(); pending = undefined;
  current?.dispose(); current = undefined;
  lastInspection = null;
  document.documentElement.dataset.assetState = "unloaded";
  status.textContent = "Sample unloaded; its resources have been disposed. Load / retry to display it again.";
  measurements.textContent = "";
}
async function reload() {
  unload();
  failure = null;
  const request = new AbortController();
  pending = request;
  document.documentElement.dataset.assetState = "loading";
  status.textContent = "Loading calibration GLB…";
  try {
    const loaded = await loadVisualAsset(scene, DEVELOPMENT_SAMPLE_ID, { signal: request.signal });
    if (request.signal.aborted) { loaded.dispose(); return; }
    current = loaded;
    document.querySelector("#yaw")!.textContent = "Yaw +90°";
    showInspection();
  } catch (error) {
    if (request.signal.aborted) return;
    failure = error instanceof Error ? error.message : String(error);
    document.documentElement.dataset.assetState = "failed";
    status.textContent = `${failure}. Use Load / retry sample.`;
  } finally {
    if (pending === request) pending = undefined;
  }
}
const listeners = new AbortController();
document.querySelector("#reload")!.addEventListener("click", () => { void reload(); }, { signal: listeners.signal });
document.querySelector("#dispose")!.addEventListener("click", unload, { signal: listeners.signal });
document.querySelector("#yaw")!.addEventListener("click", () => {
  if (!current) return;
  current.root.rotation.y = current.root.rotation.y === 0 ? Math.PI / 2 : 0;
  document.querySelector("#yaw")!.textContent = current.root.rotation.y === 0 ? "Yaw +90°" : "Yaw 0°";
  showInspection();
}, { signal: listeners.signal });
let topView = false;
document.querySelector("#camera")!.addEventListener("click", () => {
  topView = !topView;
  camera.alpha = topView ? -Math.PI / 2 : -Math.PI / 3;
  camera.beta = topView ? 0.01 : Math.PI / 3.1;
  document.querySelector("#camera")!.textContent = topView ? "Perspective view" : "Top view";
}, { signal: listeners.signal });
window.addEventListener("resize", () => engine.resize(), { signal: listeners.signal });
const render = () => {
  scene.render(); frames++;
  for (const { element, position } of labels) {
    const screen = Vector3.Project(position, Matrix.Identity(), scene.getTransformMatrix(), camera.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight()));
    element.style.left = `${screen.x / engine.getRenderWidth() * canvas.clientWidth}px`;
    element.style.top = `${screen.y / engine.getRenderHeight() * canvas.clientHeight}px`;
  }
};
engine.runRenderLoop(render);
function shutdown() { unload(); listeners.abort(); engine.stopRenderLoop(render); scene.dispose(); engine.dispose(); }
window.addEventListener("pagehide", shutdown, { once: true, signal: listeners.signal });
// Only this standalone developer page exposes inspection, never the game bootstrap.
Object.assign(window, { __assetDemo: { snapshot: () => ({ frames, failure, inspection: lastInspection, counts: counts(), baseline,
  sharedSceneTextures: sharedTextures(), totalTextures: scene.textures.length,
  yaw: current?.root.rotation.y ?? null, renderer: engine.getGlInfo().renderer }), reload, unload, shutdown } });
if (new URLSearchParams(location.search).get("autoload") === "0") unload();
else void reload();
