import { NEUTRAL_HELD_CONTROLS, PROTOCOL_LIMITS, type EdgeAction, type HeldControls, type InputFrame, type PlayerId, type ValidatedPlayerInput } from "@stopthatguy/shared";

/** One authenticated connection. No client-supplied identity or clock enters simulation. */
export class PlayerInputBuffer {
  private sequence = -1;
  private highestAction = 0;
  private receivedAt = -Infinity;
  private held: HeldControls = { ...NEUTRAL_HELD_CONTROLS };
  private pending: EdgeAction[] = [];

  constructor(private readonly playerId: PlayerId, private readonly timeoutMs: number) {}

  /** Called only after the shared command parser. Reject atomically on stale sequence/overflow. */
  accept(frame: InputFrame, nowMs: number): "accepted" | "stale" | "overflow" {
    if (frame.sequence <= this.sequence) return "stale";
    const fresh = frame.actions.filter((action) => action.id > this.highestAction);
    if (this.pending.length + fresh.length > PROTOCOL_LIMITS.maxActionsPerInputFrame) return "overflow";
    this.sequence = frame.sequence;
    this.receivedAt = nowMs;
    this.held = { forwardHeld: frame.forwardHeld, brakeHeld: frame.brakeHeld, sprintHeld: frame.sprintHeld, interactHeld: frame.interactHeld };
    this.pending.push(...fresh.map((action) => ({ ...action })));
    if (fresh.length) this.highestAction = fresh[fresh.length - 1]!.id;
    return "accepted";
  }

  /** Drain edges once per fixed step; held controls persist only within the timeout. */
  sample(nowMs: number): ValidatedPlayerInput | undefined {
    if (this.sequence < 0) return undefined;
    if (nowMs - this.receivedAt >= this.timeoutMs) this.held = { ...NEUTRAL_HELD_CONTROLS };
    const actions = this.pending;
    this.pending = [];
    return { playerId: this.playerId, sequence: this.sequence, ...this.held, actions };
  }

  /** Preserve per-session sequence/action watermarks across rematches; never replay old edges. */
  clear(): void {
    this.pending = [];
    this.held = { ...NEUTRAL_HELD_CONTROLS };
    this.receivedAt = -Infinity;
  }
}
