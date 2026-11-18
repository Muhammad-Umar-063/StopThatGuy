import { NEUTRAL_HELD_CONTROLS, PROTOCOL_LIMITS, parseInputFrame, type EdgeAction, type HeldControls, type InputFrame } from '@stopthatguy/shared';

/** Intent queue only; no prediction or client-authoritative state. Call sample every input frame. */
export class ClientInputQueue {
  private held: HeldControls = { ...NEUTRAL_HELD_CONTROLS };
  private sampledAt = -Infinity;
  private sentAt = -Infinity;
  private lastHeld = '';
  private nextSequence = 0;
  private highestAction = 0;
  private actions: (EdgeAction & { queuedAt: number })[] = [];
  private sent: { sequence: number; at: number }[] = [];
  private ackSequence = 0;
  private ackAction = 0;

  sample(held: HeldControls, actions: readonly EdgeAction[], now: number): boolean {
    const parsed = parseInputFrame({ ...held, actions: [...actions], sequence: 0, clientTimeMs: null });
    if (!parsed.ok) throw new RangeError('Invalid input intents');
    const fresh = parsed.value.actions.filter((action) => action.id > this.highestAction);
    if (this.actions.length + fresh.length > 64) return false;
    this.held = { forwardHeld: held.forwardHeld, brakeHeld: held.brakeHeld, sprintHeld: held.sprintHeld, interactHeld: held.interactHeld };
    this.sampledAt = now;
    this.actions.push(...fresh.map((action) => ({ ...action, queuedAt: now })));
    if (fresh.length) this.highestAction = fresh[fresh.length - 1]!.id;
    return true;
  }
  next(now: number, sendHz: number, timeoutMs: number): InputFrame | null {
    if (now - this.sentAt < 1000 / sendHz) return null;
    const held = now - this.sampledAt < timeoutMs ? this.held : NEUTRAL_HELD_CONTROLS;
    const encoded = JSON.stringify(held);
    if (!this.actions.length && encoded === this.lastHeld && now - this.sentAt < 100) return null;
    if (this.sent.length >= 64 || this.sent[0] && now - this.sent[0].at > 2000 || this.actions[0] && now - this.actions[0].queuedAt > 2000) throw new Error('Input acknowledgements stalled');
    if (this.nextSequence >= PROTOCOL_LIMITS.maxUint32) throw new Error('Input sequence exhausted');
    const sequence = ++this.nextSequence;
    this.sent.push({ sequence, at: now });
    this.sentAt = now;
    this.lastHeld = encoded;
    return { sequence, ...held, actions: this.actions.slice(0, PROTOCOL_LIMITS.maxActionsPerInputFrame).map((a) => ({ id: a.id, kind: a.kind })), clientTimeMs: null };
  }
  acknowledge(sequence: number, action: number): void {
    this.ackSequence = Math.max(this.ackSequence, sequence);
    this.ackAction = Math.max(this.ackAction, action);
    this.sent = this.sent.filter((frame) => frame.sequence > this.ackSequence);
    this.actions = this.actions.filter((edge) => edge.id > this.ackAction);
  }
  clear(): void { this.held = { ...NEUTRAL_HELD_CONTROLS }; this.sampledAt = -Infinity; this.actions = []; this.sent = []; }
  diagnostics() { return { pendingFrames: this.sent.length, pendingActions: this.actions.length, acknowledgedSequence: this.ackSequence, acknowledgedActionId: this.ackAction }; }
}
