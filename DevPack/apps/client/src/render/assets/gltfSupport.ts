// Demand-loaded adapter. Do not import this module statically from bootstrap or
// re-export it through an eager barrel; use loadVisualAsset instead.
import "@babylonjs/loaders/glTF/2.0/index.js";
import { GLTFLoaderAnimationStartMode, GLTFLoaderCoordinateSystemMode } from "@babylonjs/loaders/glTF/glTFFileLoader.js";
import { LoadAssetContainerAsync } from "@babylonjs/core/Loading/sceneLoader.js";
import type { Scene } from "@babylonjs/core/scene.js";

export function loadGlbContainer(bytes: Uint8Array, scene: Scene, name: string) {
  return LoadAssetContainerAsync(bytes, scene, {
    pluginExtension: ".glb", name,
    pluginOptions: { gltf: {
      coordinateSystemMode: GLTFLoaderCoordinateSystemMode.AUTO,
      animationStartMode: GLTFLoaderAnimationStartMode.NONE,
    } },
  });
}
