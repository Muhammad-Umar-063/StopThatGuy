import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import { CreateCylinder } from "@babylonjs/core/Meshes/Builders/cylinderBuilder";
import { CreateCapsule } from "@babylonjs/core/Meshes/Builders/capsuleBuilder";
import { CreateGround } from "@babylonjs/core/Meshes/Builders/groundBuilder";
import { createAutomaticCamera } from "../automaticCamera.js";
import { CAMERA_RADIUS_M, type CameraFrame } from "../followCamera.js";
import { clearBoomFraction } from "../obstruction.js";
import { sampleScenario, scenarioWorld, type Scenario } from "./scenarios.js";

const canvas = document.querySelector<HTMLCanvasElement>("#view")!;
const status = document.querySelector<HTMLOutputElement>("#status")!;
const select = document.querySelector<HTMLSelectElement>("#scenario")!;
const motion = document.querySelector<HTMLSelectElement>("#motion")!;
const play = document.querySelector<HTMLButtonElement>("#play")!;
const engine = new Engine(canvas, true);
let scenario: Scenario = "turn";
let scene: Scene;
let follow: ReturnType<typeof createAutomaticCamera>;
let actor: ReturnType<typeof CreateCapsule>;
let frame: CameraFrame;
let seconds = 0, frames = 0;
let playing = new URLSearchParams(location.search).get("autoplay") !== "0";
let disposed = false;
let collisions = 0;
const reducedOverride = () => motion.value === "system" ? undefined : motion.value === "reduced";

function mount(next: Scenario) {
  scene?.dispose();
  scenario = next;
  select.value = next;
  seconds = 0;
  collisions = 0;
  scene = new Scene(engine);
  scene.clearColor = new Color4(0.66, 0.79, 0.84, 1);
  new HemisphericLight("fixture-daylight", new Vector3(0.3, 1, -0.4), scene);
  const material = (name: string, color: string) => {
    const result = new StandardMaterial(name, scene);
    result.diffuseColor = Color3.FromHexString(color);
    result.specularColor = Color3.Black();
    return result;
  };
  const roadMaterial = material("temporary-road", "#77786D");
  const proxyMaterial = material("temporary-solid-proxy", "#D6BE9A");
  const cameraMaterial = material("temporary-camera-proxy", "#B78E71");
  const ground = CreateGround("temporary-ground", { width: 220, height: 220 }, scene);
  ground.position.set(0, -1.2, 40);
  ground.material = material("ground", "#B4B3A0");
  const world = scenarioWorld(scenario);
  for (const edge of world.edges) {
    for (let i = 1; i < edge.centerline.length; i++) {
      const a = edge.centerline[i - 1]!, b = edge.centerline[i]!;
      const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
      const length = Math.hypot(dx, dy, dz);
      const road = CreateBox(`fixture-road-${edge.id}-${i}`, { width: edge.laneOffsetsM.length === 1 ? 3 : 7, height: 0.1, depth: length }, scene);
      road.position.set((a.x + b.x) / 2, (a.y + b.y) / 2 - 0.06, (a.z + b.z) / 2);
      road.rotation.set(-Math.atan2(dy, Math.hypot(dx, dz)), Math.atan2(dx, dz), 0);
      road.material = roadMaterial;
    }
  }
  for (const proxy of [...world.colliders, ...world.cameraObstructions]) {
    const mesh = proxy.shape === "box"
      ? CreateBox(proxy.id, { width: proxy.halfExtents.x * 2, height: proxy.halfExtents.y * 2, depth: proxy.halfExtents.z * 2 }, scene)
      : CreateCylinder(proxy.id, { diameter: proxy.radiusM * 2, height: proxy.heightM }, scene);
    mesh.position.set(proxy.center.x, proxy.center.y, proxy.center.z);
    if (proxy.shape === "box") mesh.rotation.y = proxy.yaw;
    mesh.material = world.cameraObstructions.includes(proxy) ? cameraMaterial : proxyMaterial;
  }
  actor = CreateCapsule("temporary-player-marker", { height: 1.8, radius: 0.28, tessellation: 24 }, scene);
  actor.material = material("player", "#227791");
  const nose = CreateBox("heading-marker", { width: 0.18, height: 0.16, depth: 0.2 }, scene);
  nose.parent = actor;
  nose.position.set(0, 0.45, 0.27);
  nose.material = material("heading", "#F3BF52");
  follow = createAutomaticCamera(scene, world, { reducedMotion: reducedOverride() });
  frame = follow.reset(sampleScenario(scenario, 0));
  step(0);
}

function step(dt: number) {
  seconds += dt;
  const subject = sampleScenario(scenario, seconds);
  const before = JSON.stringify(subject);
  frame = follow.update(subject, dt);
  if (before !== JSON.stringify(subject)) throw new Error("Camera mutated fixture pose");
  actor.position.set(subject.pose.position.x, subject.pose.position.y + 0.9, subject.pose.position.z);
  actor.rotation.y = subject.pose.yaw;
  const world = scenarioWorld(scenario);
  const proxies = [...world.colliders, ...world.cameraObstructions];
  const anchor = { ...subject.pose.position, y: subject.pose.position.y + 1.2 };
  if (clearBoomFraction(anchor, frame.position, proxies, CAMERA_RADIUS_M) !== 1) collisions++;
  status.textContent = `${scenario} · ${seconds.toFixed(1)} s · boom ${frame.boomLengthM.toFixed(2)} m · ${frame.obstructed ? "obstructed" : "clear"} · ${frame.reducedMotion ? "reduced motion" : "standard motion"}`;
}

const events = new AbortController();
select.addEventListener("change", () => mount(select.value as Scenario), { signal: events.signal });
motion.addEventListener("change", () => follow.setReducedMotion(reducedOverride()), { signal: events.signal });
play.addEventListener("click", () => { playing = !playing; play.textContent = playing ? "Pause" : "Play"; }, { signal: events.signal });
document.querySelector("#restart")!.addEventListener("click", () => mount(scenario), { signal: events.signal });
window.addEventListener("resize", () => engine.resize(), { signal: events.signal });
window.addEventListener("pagehide", () => shutdown(), { signal: events.signal });
function shutdown() {
  if (disposed) return;
  disposed = true;
  events.abort();
  engine.stopRenderLoop();
  scene.dispose();
  engine.dispose();
}
mount(scenario);
play.textContent = playing ? "Pause" : "Play";
engine.runRenderLoop(() => {
  if (playing) { if (seconds >= 7) mount(scenario); step(Math.min(engine.getDeltaTime() / 1000, 0.1)); }
  else step(0);
  scene.render();
  frames++;
});

function snapshot() {
  const subject = sampleScenario(scenario, seconds);
  return { dataSource: "fixture", scenario, seconds, frames, playing, disposed, frame, pose: subject.pose, collisions,
    cameraCount: scene.cameras.length, cameraInputs: follow.camera.inputs != null, cameraRotation: follow.camera.rotation.asArray(),
    fov: follow.camera.fov, meshes: scene.meshes.length, materials: scene.materials.length, textures: scene.textures.length };
}
// Development-only hook: never exported by the runtime camera entry.
Object.assign(window, { cameraFixture: {
  snapshot,
  seek(next: Scenario, time: number, fps: number) {
    playing = false;
    play.textContent = "Play";
    mount(next);
    for (let i = 0; i < Math.round(time * fps); i++) step(1 / fps);
    scene.render();
    return snapshot();
  },
  remount: () => { mount(scenario); return snapshot(); },
  shutdown,
} });
