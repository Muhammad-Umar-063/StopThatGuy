import type { Pose } from "./geometry.js";
import type { ActionId, EdgeId, InteractableId, PlayerId, PoliceId, RouteId, Tick, VehicleId, ZoneId } from "./ids.js";
import type { MatchResult } from "./results.js";
import type {
  ConnectionStatus,
  InteractableState,
  InteractableType,
  LocomotionState,
  MatchMode,
  MatchPhase,
  ParticipationState,
  PoliceState,
  RobberAiState,
  RobberLocomotion,
  VehicleAccess,
  VehicleAvailability,
  VehicleType,
} from "./states.js";
import type { VersionInfo } from "./versions.js";

/**
 * Server-authoritative records: plain, JSON-serializable data produced by the simulation
 * (readSerializableState). The server adapter maps them to Colyseus schema and decides what
 * each client receives; nothing here is accepted from a client.
 */

/** Current position on the route graph. */
export interface RouteProgress {
  edgeId: EdgeId;
  /** Distance along the edge centerline, 0..lengthM. */
  distanceM: number;
  /** Target lane index into the edge's laneOffsetsM. */
  laneIndex: number;
  /** Current lateral offset (m, positive = right of travel); differs from the lane's offset during a lane shift. */
  lateralOffsetM: number;
}

export interface MatchRecord {
  /** Public lookup code; not a credential. */
  roomCode: string;
  mode: MatchMode;
  phase: MatchPhase;
  tick: Tick;
  /** uint32 seed for reproducible route selection. */
  seed: number;
  /** End of the current countdown/intro phase; null otherwise. */
  phaseEndsAtTick: Tick | null;
  chaseStartTick: Tick | null;
  /** Time-limit deadline of the chase. */
  chaseEndTick: Tick | null;
  /** Seeded robber route selection; may be withheld from clients by the adapter. */
  robberRouteId: RouteId | null;
  versions: VersionInfo;
  /** Earliest connected eligible player; null only when the room is empty. */
  hostId: PlayerId | null;
  /** Set once, immutably, when the chase resolves. */
  result: MatchResult | null;
}

/** Timed effects measured in server ticks; null = inactive. */
export interface PlayerStatus {
  stunnedUntilTick: Tick | null;
  protectedUntilTick: Tick | null;
  sabotageCooldownUntilTick: Tick | null;
  /** MVP: lasts until the round ends. */
  wanted: boolean;
}

export interface PlayerRecord {
  id: PlayerId;
  nickname: string;
  /** Stable join order; used for host transfer and exact tie-breaks. */
  joinOrder: number;
  ready: boolean;
  connection: ConnectionStatus;
  participation: ParticipationState;
  locomotion: LocomotionState;
  pose: Pose;
  /** Null in the lobby or while a passenger (the vehicle carries the route). */
  route: RouteProgress | null;
  speedMps: number;
  /** 0..tuning.movement.staminaMax. */
  stamina: number;
  status: PlayerStatus;
  /** Vehicle ridden or occupied; set together with VehicleRecord.ownerId or passengerIds. */
  vehicleId: VehicleId | null;
  /** Passenger seat index when locomotion is "passenger"; otherwise null. */
  seatIndex: number | null;
  lastProcessedInputSequence: number;
  lastProcessedActionId: ActionId;
}

export interface RobberRecord {
  pose: Pose;
  route: RouteProgress | null;
  speedMps: number;
  locomotion: RobberLocomotion;
  aiState: RobberAiState;
  /** Visible escape objective currently targeted. */
  escapeTargetZoneId: ZoneId | null;
}

export interface VehicleRecord {
  id: VehicleId;
  type: VehicleType;
  access: VehicleAccess;
  availability: VehicleAvailability;
  pose: Pose;
  route: RouteProgress | null;
  speedMps: number;
  /** Rider in control; always null for the NPC-driven lift. Claimed atomically by the server. */
  ownerId: PlayerId | null;
  /** One entry per passenger seat (length = seat count); null = free seat. */
  passengerIds: (PlayerId | null)[];
  /** Taken from the shop by theft. */
  stolen: boolean;
}

export interface PoliceRecord {
  id: PoliceId;
  pose: Pose;
  route: RouteProgress | null;
  speedMps: number;
  state: PoliceState;
  targetId: PlayerId | null;
  /** Tick when proximity and line of sight began; null when not arresting. */
  arrestStartTick: Tick | null;
}

export interface InteractableRecord {
  id: InteractableId;
  type: InteractableType;
  zoneId: ZoneId | null;
  state: InteractableState;
  /** Player currently interacting; null when idle. */
  actorId: PlayerId | null;
  /** 0..1 progress of the current interaction. */
  progress: number;
}

/** Full reconstructable state: enough for a late or reconnecting client without replaying events. */
export interface AuthoritativeSnapshot {
  match: MatchRecord;
  /** Ordered by joinOrder. */
  players: PlayerRecord[];
  /** Null before the intro begins. */
  robber: RobberRecord | null;
  vehicles: VehicleRecord[];
  police: PoliceRecord[];
  interactables: InteractableRecord[];
}
