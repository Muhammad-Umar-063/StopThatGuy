// @stopthatguy/simulation/movement: the narrow, client-safe subset for prediction (ARCHITECTURE.md).
export { poseOnRoute } from "./geometry.js";
export { holdPositionKernel, copyMovementMemory } from "./kernel.js";
export type { MovementContext, MovementInput, MovementKernel, MovementMemory, MovementResult, MovementState } from "./kernel.js";
export { indexWorld } from "./world-index.js";
export type { IndexedEdge, WorldIndex } from "./world-index.js";
export { roadMovementKernel, queryRoadActions } from "./road.js";
