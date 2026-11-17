import { randomInt } from "node:crypto";
import { PROTOCOL_LIMITS } from "@stopthatguy/shared";
import { RoomFailure } from "../validation/room-options.js";

export interface DirectoryRoom {
  readonly roomId: string;
  assertJoinable(): void;
}

function randomCode(): string {
  const { roomCodeLength, roomCodeAlphabet } = PROTOCOL_LIMITS;
  return Array.from({ length: roomCodeLength }, () => roomCodeAlphabet[randomInt(roomCodeAlphabet.length)]).join("");
}

/** Single-process lookup. Bounded tombstones distinguish recently closed from unknown codes. */
export class RoomDirectory {
  private readonly rooms = new Map<string, DirectoryRoom>();
  private readonly expired = new Set<string>();

  constructor(private readonly nextCode = randomCode) {}

  register(room: DirectoryRoom): string {
    for (let attempt = 0; attempt < 128; attempt++) {
      const code = this.nextCode();
      if (this.rooms.has(code) || this.expired.has(code)) continue;
      this.rooms.set(code, room);
      return code;
    }
    throw new Error("Unable to allocate an unused room code.");
  }

  get(code: string): DirectoryRoom {
    const room = this.rooms.get(code);
    if (!room) throw new RoomFailure(this.expired.has(code) ? "roomExpired" : "roomNotFound", 404);
    return room;
  }

  remove(code: string): void {
    if (!this.rooms.delete(code)) return;
    this.expired.add(code);
    if (this.expired.size > 1024) this.expired.delete(this.expired.values().next().value!);
  }
}
