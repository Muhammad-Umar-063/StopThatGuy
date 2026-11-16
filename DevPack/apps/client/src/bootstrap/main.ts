import { Engine } from "@babylonjs/core/Engines/engine";
import { createSmokeScene } from "./smokeScene";

const canvas = document.getElementById("renderCanvas");
const status = document.getElementById("status");

function setStatus(text: string): void {
  if (status) status.textContent = text;
}

function start(): void {
  if (!(canvas instanceof HTMLCanvasElement)) throw new Error("Missing #renderCanvas element.");

  const engine = new Engine(canvas, true);
  const scene = createSmokeScene(engine);

  scene.onAfterRenderObservable.addOnce(() => {
    const message = `Babylon.js ${Engine.Version} running (WebGL${engine.webGLVersion}) — temporary T001 smoke scene`;
    document.documentElement.dataset.renderer = "running";
    setStatus(message);
    console.info(`[client] ${message}`);
  });

  engine.runRenderLoop(() => scene.render());
  window.addEventListener("resize", () => engine.resize());
}

try {
  start();
} catch (error) {
  document.documentElement.dataset.renderer = "failed";
  setStatus("The 3D renderer could not start. Check that WebGL is enabled in this browser.");
  console.error("[client] Renderer failed to start", error);
}
