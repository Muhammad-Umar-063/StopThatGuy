import {
  HOST_ONLY_COMMANDS, isCommandAllowedInPhase, parseClientCommand,
  type ClientCommand, type MatchPhase, type ServerMessage,
} from "@stopthatguy/shared";

type Rejection = Extract<ServerMessage, { type: "commandRejected" }>;

/** Per-connection budget. Its owner deletes it on leave; it never stores credentials. */
export class CommandGate {
  private windowStart = 0;
  private count = 0;

  constructor(private readonly perSecond: number) {}

  read(raw: unknown, phase: MatchPhase, isHost: boolean, now: number): ClientCommand | Rejection {
    if (now - this.windowStart >= 1000) {
      this.windowStart = now;
      this.count = 0;
    }
    if (++this.count > this.perSecond) return reject(null, "rateLimited");
    const result = parseClientCommand(raw);
    if (!result.ok) return reject(null, "malformed");
    const command = result.value;
    if (HOST_ONLY_COMMANDS.includes(command.type) && !isHost) return reject(command.type, "notHost");
    if (!isCommandAllowedInPhase(command.type, phase)) return reject(command.type, "wrongPhase");
    return command;
  }
}

export function reject(commandType: Rejection["commandType"], code: Rejection["code"]): Rejection {
  return { type: "commandRejected", commandType, code };
}
