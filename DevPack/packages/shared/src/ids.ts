/**
 * Opaque identifiers. Brands exist only at compile time to stop mixing ID kinds;
 * on the wire every ID is a plain string. Clients never send entity IDs in commands.
 */
declare const idBrand: unique symbol;
export type Brand<T, B extends string> = T & { readonly [idBrand]: B };

export type RoomId = Brand<string, "RoomId">;
export type PlayerId = Brand<string, "PlayerId">;
export type VehicleId = Brand<string, "VehicleId">;
export type PoliceId = Brand<string, "PoliceId">;
export type InteractableId = Brand<string, "InteractableId">;

export type SectorId = Brand<string, "SectorId">;
export type NodeId = Brand<string, "NodeId">;
export type EdgeId = Brand<string, "EdgeId">;
export type JunctionId = Brand<string, "JunctionId">;
export type ColliderId = Brand<string, "ColliderId">;
export type ZoneId = Brand<string, "ZoneId">;
export type SpawnId = Brand<string, "SpawnId">;
export type RouteId = Brand<string, "RouteId">;

/** Server simulation tick: non-negative integer, advanced at `DEFAULT_TUNING.timing.simulationHz`. */
export type Tick = number;
/** Client-assigned edge-action ID: positive integer, strictly increasing per player session. */
export type ActionId = number;
/** Server-assigned event ID: positive integer, strictly increasing within one match (restarts at 1 for a rematch). */
export type EventId = number;

/** Marks a trusted string (server-generated, world data or fixture) as a branded ID. Never use on client input. */
export function brandId<T extends Brand<string, string>>(value: string): T {
  return value as T;
}
