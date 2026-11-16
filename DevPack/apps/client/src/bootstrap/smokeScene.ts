// TEMPORARY (T001): renderer smoke scene proving Babylon.js starts in the browser.
// Replace with real scene composition in later tasks; nothing here is game content.
import type { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { CreateGround } from "@babylonjs/core/Meshes/Builders/groundBuilder";
import { CreateSphere } from "@babylonjs/core/Meshes/Builders/sphereBuilder";

export function createSmokeScene(engine: Engine): Scene {
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0.55, 0.75, 0.95, 1);

  // Fixed camera; no input attached (desktop must not require a mouse).
  new ArcRotateCamera("smokeCamera", -Math.PI / 2, Math.PI / 3, 8, Vector3.Zero(), scene);
  new HemisphericLight("smokeLight", new Vector3(0.3, 1, 0.2), scene);

  const ground = CreateGround("smokeGround", { width: 8, height: 8 }, scene);
  const groundMaterial = new StandardMaterial("smokeGroundMaterial", scene);
  groundMaterial.diffuseColor = new Color3(0.78, 0.74, 0.66);
  ground.material = groundMaterial;

  const marker = CreateSphere("smokeMarker", { diameter: 1.5, segments: 24 }, scene);
  marker.position.y = 1;
  const markerMaterial = new StandardMaterial("smokeMarkerMaterial", scene);
  markerMaterial.diffuseColor = new Color3(0.9, 0.35, 0.2);
  marker.material = markerMaterial;

  // Visible motion confirms the render loop is running.
  scene.onBeforeRenderObservable.add(() => {
    const t = performance.now() / 1000;
    marker.position.x = Math.sin(t) * 2;
  });

  return scene;
}
