import { TargetCamera } from "@babylonjs/core/Cameras/targetCamera";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Scene } from "@babylonjs/core/scene";
import type { WorldData } from "@stopthatguy/shared";
import { createFollowCamera, type CameraFrame, type CameraSubject } from "./followCamera.js";

/** Caller owns the render loop and supplies the displayed pose once per frame. No input controls. */
export function createAutomaticCamera(scene: Scene, world: WorldData, options: { reducedMotion?: boolean } = {}) {
  const preference = typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : undefined;
  let override = options.reducedMotion;
  const follow = createFollowCamera(world, override ?? preference?.matches ?? false);
  const priorCamera = scene.activeCamera;
  const camera = new TargetCamera("automatic-follow-camera", Vector3.Zero(), scene);
  camera.minZ = 0.05; // Well inside the conservative 0.25 m collision envelope.
  camera.fov = 0.9;
  scene.activeCamera = camera;
  let disposed = false;
  const onPreference = () => follow.setReducedMotion(override ?? preference?.matches ?? false);
  preference?.addEventListener("change", onPreference);
  const onDispose = scene.onDisposeObservable.add(() => dispose());

  function apply(frame: CameraFrame): CameraFrame {
    camera.position.set(frame.position.x, frame.position.y, frame.position.z);
    camera.setTarget(new Vector3(frame.target.x, frame.target.y, frame.target.z));
    return frame;
  }
  function ensureActive() { if (disposed) throw new Error("Automatic camera is disposed"); }
  function dispose() {
    if (disposed) return;
    disposed = true;
    preference?.removeEventListener("change", onPreference);
    scene.onDisposeObservable.remove(onDispose);
    if (scene.activeCamera === camera) scene.activeCamera = priorCamera && !priorCamera.isDisposed() ? priorCamera : null;
    camera.dispose();
  }
  return {
    camera,
    update(subject: CameraSubject, deltaSeconds: number) { ensureActive(); return apply(follow.update(subject, deltaSeconds)); },
    reset(subject: CameraSubject) { ensureActive(); return apply(follow.reset(subject)); },
    /** undefined returns to the OS preference; an explicit boolean is a user setting. */
    setReducedMotion(value: boolean | undefined) { ensureActive(); override = value; onPreference(); },
    dispose,
  };
}
