/** Enumerations shared by records, events and views. Arrays exist for runtime validation and fixture checks. */

/** LOBBY → COUNTDOWN → INTRO → CHASE → RESULTS → LOBBY (rematch), or CLOSED when the room expires. */
export const MATCH_PHASES = ["lobby", "countdown", "intro", "chase", "results", "closed"] as const;
export type MatchPhase = (typeof MATCH_PHASES)[number];

/** Practice allows one player; normal requires at least two. Both run on the server. */
export const MATCH_MODES = ["practice", "normal"] as const;
export type MatchMode = (typeof MATCH_MODES)[number];

/** Network presence. "disconnected" = inside the reconnect grace period; "left" = gone for good. */
export const CONNECTION_STATUSES = ["connected", "disconnected", "left"] as const;
export type ConnectionStatus = (typeof CONNECTION_STATUSES)[number];

/** Competitive participation, independent of connection and locomotion. */
export const PARTICIPATION_STATES = ["active", "arrested", "forfeit", "spectator"] as const;
export type ParticipationState = (typeof PARTICIPATION_STATES)[number];

/** How a player is currently moving. "passenger" = seated on a vehicle they do not control (the lift). */
export const LOCOMOTION_STATES = ["onFoot", "bicycle", "scooter", "passenger"] as const;
export type LocomotionState = (typeof LOCOMOTION_STATES)[number];

export const VEHICLE_TYPES = ["bicycle", "scooter", "lift"] as const;
export type VehicleType = (typeof VEHICLE_TYPES)[number];

/** How a parked vehicle may be obtained: free to take, borrowed from an NPC, or stolen from the shop. */
export const VEHICLE_ACCESS = ["public", "borrowable", "shop"] as const;
export type VehicleAccess = (typeof VEHICLE_ACCESS)[number];

export const VEHICLE_AVAILABILITY = ["available", "inUse", "unavailable"] as const;
export type VehicleAvailability = (typeof VEHICLE_AVAILABILITY)[number];

/** Modes permitted on a route edge. Police follow authored police routes instead of a mode. */
export const TRAVEL_MODES = ["foot", "bicycle", "scooter", "lift"] as const;
export type TravelMode = (typeof TRAVEL_MODES)[number];

/** Robber locomotion; the robber is never a passenger. */
export const ROBBER_LOCOMOTION = ["onFoot", "bicycle", "scooter"] as const;
export type RobberLocomotion = (typeof ROBBER_LOCOMOTION)[number];

/** depart bank → travel chosen route → transport transition → escape branch → escaped/captured. */
export const ROBBER_AI_STATES = ["departing", "fleeing", "transition", "escaping", "escaped", "captured"] as const;
export type RobberAiState = (typeof ROBBER_AI_STATES)[number];

export const POLICE_STATES = ["patrolling", "pursuing", "arresting"] as const;
export type PoliceState = (typeof POLICE_STATES)[number];

export const INTERACTABLE_TYPES = ["shopTheft", "borrowPoint"] as const;
export type InteractableType = (typeof INTERACTABLE_TYPES)[number];

export const INTERACTABLE_STATES = ["idle", "inProgress", "used"] as const;
export type InteractableState = (typeof INTERACTABLE_STATES)[number];
