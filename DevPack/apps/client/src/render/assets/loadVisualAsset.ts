// The official glTF plugin is imported only when a visual asset needs decoding.
// Importing this public API alone must not add it to the startup dependency graph.
import { TransformNode } from "@babylonjs/core/Meshes/transformNode.js";
import type { Scene } from "@babylonjs/core/scene.js";
import type { AssetContainer } from "@babylonjs/core/assetContainer.js";
import { assetUrl, type AssetId } from "./catalog.js";

export class AssetLoadError extends Error {
  constructor(readonly assetId: AssetId, readonly code: "load" | "cancelled" | "timeout" | "scene", detail: string, cause?: unknown) {
    super(`Could not load visual asset ${assetId}: ${detail}`, { cause });
    this.name = "AssetLoadError";
  }
}

export interface VisualAsset {
  readonly id: AssetId;
  /** Apply project-space position/yaw here; retain Babylon's conversion root below it. */
  readonly root: TransformNode;
  readonly container: AssetContainer;
  /** Releases this load's meshes, materials, textures, animations and placement root. Idempotent. */
  dispose(): void;
}

/** One owned instance per call; visuals are never authoritative collision data. */
export async function loadVisualAsset(scene: Scene, id: AssetId, options: {
  signal?: AbortSignal;
  timeoutMs?: number;
  baseUrl?: string;
} = {}): Promise<VisualAsset> {
  if (scene.isDisposed || scene.useRightHandedSystem) {
    throw new AssetLoadError(id, "scene", "requires a live left-handed project scene");
  }
  const timeoutMs = options.timeoutMs ?? 15_000;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new RangeError("Asset timeout must be positive and finite");
  const controller = new AbortController();
  const cancel = () => controller.abort(new AssetLoadError(id, "cancelled", "loading cancelled"));
  const sceneObserver = scene.onDisposeObservable.addOnce(cancel);
  options.signal?.addEventListener("abort", cancel, { once: true });
  if (options.signal?.aborted) cancel();
  const timer = setTimeout(() => controller.abort(new AssetLoadError(id, "timeout", `timed out after ${timeoutMs} ms; retry the asset`)), timeoutMs);
  let container: AssetContainer | undefined;
  let root: TransformNode | undefined;
  let rejectAbort: (() => void) | undefined;
  const aborted = new Promise<never>((_, reject) => {
    rejectAbort = () => reject(controller.signal.reason);
    controller.signal.addEventListener("abort", rejectAbort, { once: true });
    if (controller.signal.aborted) rejectAbort();
  });
  // The decoder has no AbortSignal API. If it completes after cancellation, dispose
  // the late container without attaching it to the scene. Fetch itself is aborted.
  const decode = async () => {
    controller.signal.throwIfAborted();
    const response = await fetch(assetUrl(id, options.baseUrl), { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}; retry or check the asset deployment`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    controller.signal.throwIfAborted();
    const { loadGlbContainer } = await import("./gltfSupport.js");
    controller.signal.throwIfAborted();
    const loaded = await loadGlbContainer(bytes, scene, `${id}.glb`);
    if (controller.signal.aborted || scene.isDisposed) {
      loaded.dispose();
      throw controller.signal.reason ?? new AssetLoadError(id, "scene", "scene was disposed during loading");
    }
    return loaded;
  };
  try {
    container = await Promise.race([decode(), aborted]);
    controller.signal.throwIfAborted();
    container.populateRootNodes();
    const importedRoots = [...container.rootNodes];
    container.addAllToScene();
    root = new TransformNode(`${id}:placement`, scene);
    for (const node of importedRoots) node.parent = root;
    for (const mesh of container.meshes) {
      mesh.checkCollisions = false;
      mesh.isPickable = false;
    }
    const ownedContainer = container;
    const ownedRoot = root;
    let disposed = false;
    const dispose = () => {
      if (disposed) return;
      disposed = true;
      scene.onDisposeObservable.remove(disposeObserver);
      ownedContainer.dispose();
      ownedRoot.dispose();
    };
    const disposeObserver = scene.onDisposeObservable.addOnce(dispose);
    return { id, root, container, dispose };
  } catch (cause) {
    container?.dispose();
    root?.dispose();
    if (cause instanceof AssetLoadError) throw cause;
    throw new AssetLoadError(id, "load", cause instanceof Error ? cause.message : "invalid or unavailable GLB; retry the asset", cause);
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", cancel);
    scene.onDisposeObservable.remove(sceneObserver);
    if (rejectAbort) controller.signal.removeEventListener("abort", rejectAbort);
  }
}
