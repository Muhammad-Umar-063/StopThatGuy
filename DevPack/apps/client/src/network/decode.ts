import {
  AWARD_KINDS, CAPTURE_CANCEL_REASONS, CLIENT_COMMAND_TYPES, COMMAND_REJECTION_CODES, CONNECTION_STATUSES,
  DEDUCTION_REASONS, INTERACTABLE_STATES, INTERACTABLE_TYPES, LOCOMOTION_STATES, MATCH_MODES, MATCH_PHASES,
  NO_WINNER_REASONS, PARTICIPATION_STATES, POLICE_STATES, PROTOCOL_LIMITS, ROBBER_AI_STATES, ROBBER_LOCOMOTION,
  VEHICLE_ACCESS, VEHICLE_AVAILABILITY, VEHICLE_TYPES, versionMismatches,
  type AuthoritativeSnapshot, type GameEvent, type ServerMessage, type VersionInfo, type RoomErrorCode,
} from '@stopthatguy/shared';

export class NetworkFailure extends Error {
  constructor(readonly code: RoomErrorCode, message = code) { super(message); }
}
type Check = (value: unknown) => boolean;
export const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const finite: Check = (v) => typeof v === 'number' && Number.isFinite(v);
const positive: Check = (v) => finite(v) && (v as number) >= 0;
const integer: Check = (v) => Number.isSafeInteger(v) && (v as number) >= 0;
const uint: Check = (v) => integer(v) && (v as number) <= PROTOCOL_LIMITS.maxUint32;
const bool: Check = (v) => typeof v === 'boolean';
const text: Check = (v) => typeof v === 'string' && v.length > 0 && v.length <= 128;
const oneOf = (values: readonly string[]): Check => (v) => typeof v === 'string' && values.includes(v);
const nullable = (check: Check): Check => (v) => v === null || check(v);
const list = (check: Check, max = 256): Check => (v) => Array.isArray(v) && v.length <= max && v.every(check);
const shape = (fields: Record<string, Check>): Check => (v) => record(v) && Object.entries(fields).every(([key, check]) => check(v[key]));
const pose = shape({ position: shape({ x: finite, y: finite, z: finite }), yaw: finite });
const route = nullable(shape({ edgeId: text, distanceM: positive, laneIndex: integer, lateralOffsetM: finite }));
const versions = shape({ protocolVersion: uint, worldVersion: text, configVersion: text });
const result: Check = (v) => shape({
  resolvedAtTick: integer,
  awards: list(shape({ kind: oneOf(AWARD_KINDS), playerId: text, value: nullable(positive) }), 32),
  stats: list(shape({ playerId: text, footDistanceM: positive, transportChanges: integer, damageDeduction: positive }), 6),
  deductions: list(shape({ playerId: text, reason: oneOf(DEDUCTION_REASONS), amount: positive })),
})(v) && record(v) && (v.outcome === 'capture' ? v.reason === 'captured' && text(v.winnerId)
  : v.outcome === 'noWinner' && oneOf(NO_WINNER_REASONS)(v.reason) && v.winnerId === null);
const player = shape({
  id: text, nickname: text, joinOrder: integer, ready: bool, connection: oneOf(CONNECTION_STATUSES), participation: oneOf(PARTICIPATION_STATES),
  locomotion: oneOf(LOCOMOTION_STATES), pose, route, speedMps: positive, stamina: positive,
  status: shape({ stunnedUntilTick: nullable(integer), protectedUntilTick: nullable(integer), sabotageCooldownUntilTick: nullable(integer), wanted: bool }),
  vehicleId: nullable(text), seatIndex: nullable(integer), lastProcessedInputSequence: uint, lastProcessedActionId: uint,
});
const snapshot = shape({
  match: shape({ roomCode: (v) => typeof v === 'string' && /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{5}$/.test(v), mode: oneOf(MATCH_MODES), phase: oneOf(MATCH_PHASES), tick: integer, seed: uint,
    phaseEndsAtTick: nullable(integer), chaseStartTick: nullable(integer), chaseEndTick: nullable(integer), robberRouteId: nullable(text), versions, hostId: nullable(text), result: nullable(result) }),
  players: list(player, 6),
  robber: nullable(shape({ pose, route, speedMps: positive, locomotion: oneOf(ROBBER_LOCOMOTION), aiState: oneOf(ROBBER_AI_STATES), escapeTargetZoneId: nullable(text) })),
  vehicles: list(shape({ id: text, type: oneOf(VEHICLE_TYPES), access: oneOf(VEHICLE_ACCESS), availability: oneOf(VEHICLE_AVAILABILITY), pose, route, speedMps: positive, ownerId: nullable(text), passengerIds: list(nullable(text), 6), stolen: bool })),
  police: list(shape({ id: text, pose, route, targetId: nullable(text), speedMps: positive, state: oneOf(POLICE_STATES), arrestStartTick: nullable(integer) })),
  interactables: list(shape({ id: text, type: oneOf(INTERACTABLE_TYPES), zoneId: nullable(text), state: oneOf(INTERACTABLE_STATES), actorId: nullable(text), progress: (v) => positive(v) && (v as number) <= 1 })),
} satisfies Record<keyof AuthoritativeSnapshot, Check>);

export function decodeSnapshot(raw: unknown, expected: VersionInfo, localId: string): AuthoritativeSnapshot {
  if (typeof raw !== 'string' || raw.length > 262144) throw new NetworkFailure('invalidRequest');
  let value: unknown;
  try { value = JSON.parse(raw); } catch { throw new NetworkFailure('invalidRequest'); }
  if (!boundedTree(value) || !snapshot(value)) throw new NetworkFailure('invalidRequest');
  const decoded = value as AuthoritativeSnapshot;
  if (versionMismatches(expected, decoded.match.versions).length) throw new NetworkFailure('versionMismatch');
  const ids = new Set(decoded.players.map((p) => p.id));
  if (ids.size !== decoded.players.length || !ids.has(localId as never) || (decoded.match.hostId !== null && !ids.has(decoded.match.hostId))) throw new NetworkFailure('invalidRequest');
  for (const collection of [decoded.vehicles, decoded.police, decoded.interactables]) {
    if (new Set(collection.map((entity) => entity.id)).size !== collection.length) throw new NetworkFailure('invalidRequest');
  }
  return decoded;
}

const eventPayload: Record<GameEvent['type'], Check> = {
  matchStarted: shape({ chaseStartTick: integer }),
  mounted: shape({ playerId: text, vehicleId: text }), dismounted: shape({ playerId: text, vehicleId: text }),
  liftBoarded: shape({ playerId: text, vehicleId: text, seatIndex: integer }), liftExited: shape({ playerId: text, vehicleId: text }),
  shoveResolved: shape({ attackerId: text, targetId: nullable(text), hit: bool }),
  theftDetected: shape({ playerId: text, interactableId: text, vehicleId: text }), wantedChanged: shape({ playerId: text, wanted: bool }),
  arrested: shape({ playerId: text, policeId: text }), captureStarted: shape({ playerId: text }),
  captureCancelled: shape({ playerId: text, reason: oneOf(CAPTURE_CANCEL_REASONS) }), captureResolved: shape({ playerId: text }),
  robberEscaped: shape({ exitZoneId: text }), matchEnded: shape({ result }),
};
export function decodeMessage(raw: unknown): ServerMessage {
  if (!boundedTree(raw) || !record(raw)) throw new NetworkFailure('invalidRequest');
  if (raw.type === 'commandRejected' && nullable(oneOf(CLIENT_COMMAND_TYPES))(raw.commandType) && oneOf(COMMAND_REJECTION_CODES)(raw.code)) return raw as ServerMessage;
  if (raw.type === 'event' && record(raw.event)) {
    const e = raw.event;
    if (typeof e.type === 'string' && Object.hasOwn(eventPayload, e.type) && integer(e.id) && (e.id as number) > 0 && integer(e.tick) && eventPayload[e.type as GameEvent['type']](e)) return raw as ServerMessage;
  }
  throw new NetworkFailure('invalidRequest');
}

// Include unknown fields in the bound: callers clone snapshots before exposing them.
function boundedTree(value: unknown): boolean {
  const stack: [unknown, number][] = [[value, 0]];
  let nodes = 0;
  while (stack.length) {
    const [node, depth] = stack.pop()!;
    if (++nodes > 10000 || depth > 16) return false;
    if (node !== null && typeof node === 'object') {
      const keys = Object.keys(node);
      if (keys.length > 512) return false;
      for (const key of keys) stack.push([(node as Record<string, unknown>)[key], depth + 1]);
    }
  }
  return true;
}
