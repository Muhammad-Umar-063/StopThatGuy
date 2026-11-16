/**
 * Coordinate convention (shared by world data, simulation and rendering):
 * - Babylon.js left-handed world, +Y up, X/Z is the ground plane, units are meters.
 * - Yaw is in radians about +Y. Yaw 0 faces +Z; positive yaw turns toward +X
 *   (clockwise seen from above). Forward = (sin yaw, 0, cos yaw).
 * - "Right of travel" for a heading is (cos yaw, 0, -sin yaw). Lane offsets use this sign.
 * - glTF assets are right-handed; convert at import (T008), never in gameplay data.
 */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Pose {
  position: Vec3;
  /** Radians, see convention above. */
  yaw: number;
}
