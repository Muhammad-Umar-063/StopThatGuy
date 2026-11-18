/**
 * Single source of truth for constants used by both client and server.
 *
 * PROTOCOL_LIMITS: wire-format bounds enforced by command validation. Changing one is a
 * protocol change and requires bumping PROTOCOL_VERSION.
 *
 * DEFAULT_TUNING: provisional gameplay/network starting values from the specs (GAMEPLAY,
 * CONTROLS, NETWORKING, DECISIONS D014/D015/D018). They are not measured or approved balance.
 * Changing one requires bumping CONFIG_VERSION. Values the specs leave open (stamina recovery,
 * capture speed threshold, arrest range, room expiry, …) are intentionally absent; the task
 * that needs one adds it through the coordinator.
 *
 * Units: suffix Ms = milliseconds, M = meters, Mps = meters/second, Hz = per second.
 */

export const PROTOCOL_LIMITS = Object.freeze({
  /** Nickname length in Unicode code points after trimming. */
  nicknameMinLength: 1,
  nicknameMaxLength: 16,
  /** Raw nickname input above this many UTF-16 units is rejected before normalization. */
  nicknameMaxRawLength: 64,
  /** Public room code: lookup token only, never a credential. No I, O, 0 or 1. */
  roomCodeLength: 5,
  roomCodeAlphabet: "ABCDEFGHJKLMNPQRSTUVWXYZ23456789",
  /** Raw room-code input above this length is rejected before normalization. */
  roomCodeMaxRawLength: 16,
  /** Unacknowledged edge actions carried by one input frame. */
  maxActionsPerInputFrame: 8,
  /** Upper bound for sequence and action IDs. */
  maxUint32: 0xffff_ffff,
  /** worldVersion / configVersion labels: 1–32 chars of [A-Za-z0-9._-]. */
  maxVersionLabelLength: 32,
});

export const CONFIG_VERSION = "provisional-3";

export interface GameTuning {
  readonly configVersion: string;
  readonly room: {
    readonly maxPlayers: number;
    readonly minPlayersNormal: number;
    readonly minPlayersPractice: number;
  };
  readonly timing: {
    readonly simulationHz: number;
    readonly patchHz: number;
    readonly maxInputSendHz: number;
    readonly countdownMs: number;
    readonly introMs: number;
    readonly chaseTimeLimitMs: number;
  };
  readonly movement: {
    readonly runSpeedMps: number;
    readonly sprintSpeedMps: number;
    readonly staminaMax: number;
    /** Stamina spent per second of sprinting (100 points ≈ 5 s of continuous sprint). */
    readonly sprintStaminaPerSecond: number;
    readonly accelerationMps2: number;
    readonly coastMps2: number;
    readonly brakeMps2: number;
    readonly laneShiftMs: number;
    readonly staminaRecoveryPerSecond: number;
    readonly staminaRecoveryDelayMs: number;
    readonly bodyRadiusM: number;
    readonly bodyHeightM: number;
    readonly collisionSkinM: number;
  };
  readonly junction: {
    /** Turn approach window along the incoming edge; sized to speed within this range. */
    readonly approachWindowMinM: number;
    readonly approachWindowMaxM: number;
    /** Early left/right press buffer, only where the cue indicates buffering. */
    readonly turnInputBufferMs: number;
    readonly approachTimeMs: number;
  };
  readonly vehicles: {
    readonly bicycleSpeedMps: number;
    readonly scooterSpeedMps: number;
    readonly liftPassengerSeats: number;
  };
  readonly robber: {
    /** Visible, stopped dismount at an authored foot boundary; fixed simulation time. */
    readonly transitionMs: number;
  };
  readonly sabotage: {
    readonly rangeM: number;
    readonly cooldownMs: number;
    readonly disruptionMs: number;
    readonly protectionMs: number;
  };
  readonly capture: {
    readonly rangeM: number;
    readonly attemptMs: number;
  };
  readonly theft: {
    readonly holdMs: number;
  };
  readonly police: {
    /** Proximity plus line of sight must hold this long to arrest. */
    readonly arrestHoldMs: number;
  };
  readonly network: {
    /** Held controls are neutralized after this long without a valid frame. */
    readonly heldInputTimeoutMs: number;
    readonly reconnectGraceMs: number;
    readonly interpolationDelayMs: number;
  };
}

export const DEFAULT_TUNING: GameTuning = deepFreeze({
  configVersion: CONFIG_VERSION,
  room: { maxPlayers: 6, minPlayersNormal: 2, minPlayersPractice: 1 },
  timing: {
    simulationHz: 30,
    patchHz: 15,
    maxInputSendHz: 30,
    countdownMs: 3_000,
    introMs: 8_000,
    chaseTimeLimitMs: 360_000,
  },
  movement: {
    runSpeedMps: 4, sprintSpeedMps: 6, staminaMax: 100, sprintStaminaPerSecond: 20,
    accelerationMps2: 8, coastMps2: 6, brakeMps2: 12, laneShiftMs: 300,
    staminaRecoveryPerSecond: 15, staminaRecoveryDelayMs: 1_000,
    bodyRadiusM: 0.35, bodyHeightM: 1.8, collisionSkinM: 0.01,
  },
  junction: { approachWindowMinM: 5, approachWindowMaxM: 8, turnInputBufferMs: 250, approachTimeMs: 1_000 },
  vehicles: { bicycleSpeedMps: 7, scooterSpeedMps: 10, liftPassengerSeats: 2 },
  robber: { transitionMs: 1_000 },
  sabotage: { rangeM: 1.5, cooldownMs: 3_000, disruptionMs: 500, protectionMs: 1_500 },
  capture: { rangeM: 1.5, attemptMs: 350 },
  theft: { holdMs: 2_000 },
  police: { arrestHoldMs: 1_000 },
  network: { heldInputTimeoutMs: 250, reconnectGraceMs: 15_000, interpolationDelayMs: 100 },
});

function deepFreeze<T extends object>(value: T): T {
  for (const child of Object.values(value)) {
    if (typeof child === "object" && child !== null) deepFreeze(child);
  }
  return Object.freeze(value);
}
