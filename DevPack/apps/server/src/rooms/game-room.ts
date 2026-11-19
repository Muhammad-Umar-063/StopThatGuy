import { randomInt } from "node:crypto";
import { Room, ServerError, type Client } from "@colyseus/core";
import {
  PROTOCOL_VERSION, type AuthoritativeSnapshot, type GameTuning, type MatchMode,
  type PlayerId, type PlayerRecord, type ServerMessage, type WorldData,
} from "@stopthatguy/shared";
import { MatchSimulation } from "../adapters/match-simulation.js";
import { SnapshotState } from "../adapters/snapshot-state.js";
import { CommandGate, reject } from "../validation/command-gate.js";
import { RoomFailure, readCreateOptions, readJoinOptions } from "../validation/room-options.js";
import { PlayerInputBuffer } from "../validation/player-input.js";
import type { RoomDirectory } from "./room-directory.js";

export function createGameRoom(world: WorldData, tuning: GameTuning, directory: RoomDirectory) {
  const versions = { protocolVersion: PROTOCOL_VERSION, worldVersion: world.worldVersion, configVersion: tuning.configVersion };

  return class GameRoom extends Room<{ state: SnapshotState }> {
    override state = new SnapshotState();
    private code = "";
    private mode: MatchMode = "normal";
    private readonly players = new Map<string, PlayerRecord>();
    private readonly gates = new Map<string, CommandGate>();
    private readonly playerInputs = new Map<string, PlayerInputBuffer>();
    private nextJoinOrder = 0;
    private match: MatchSimulation | undefined;
    private snapshot!: AuthoritativeSnapshot;

    get roomCode(): string { return this.code; }

    /** Built-in matchmaking must not bypass validated code lookup or accept client auth data. */
    static override async onAuth(): Promise<never> {
      throw new ServerError(403, "Use POST /rooms/create or POST /rooms/join.");
    }

    override onCreate(raw: unknown): void {
      const options = readCreateOptions(raw, versions);
      this.mode = options.mode;
      this.maxClients = tuning.room.maxPlayers;
      this.patchRate = 1000 / tuning.timing.patchHz;
      this.maxMessagesPerSecond = tuning.timing.maxInputSendHz * 2;
      this.code = directory.register(this);
      this.resetLobby();
      this.onMessage("command", (client, raw: unknown) => this.command(client, raw));
      this.onMessage("*", (client) => this.command(client, null));
      this.setSimulationInterval((elapsedMs) => this.advance(elapsedMs), 1000 / tuning.timing.simulationHz);
    }

    assertJoinable(): void {
      if (this.snapshot.match.phase !== "lobby") throw new RoomFailure("matchInProgress", 409);
      // Includes pending reservations, so simultaneous HTTP requests cannot overbook.
      if (this.hasReachedMaxClients()) throw new RoomFailure("roomFull", 409);
    }

    override onJoin(client: Client, raw: unknown): void {
      // Recheck on socket admission: a reservation can outlive the lobby phase.
      const options = readJoinOptions(raw, versions);
      if (options.roomCode !== this.code) throw new RoomFailure("invalidRoomCode");
      if (this.snapshot.match.phase !== "lobby") throw new RoomFailure("matchInProgress", 409);
      if (this.players.size >= this.maxClients) throw new RoomFailure("roomFull", 409);
      const player: PlayerRecord = {
        id: client.sessionId as PlayerId, nickname: options.nickname, joinOrder: this.nextJoinOrder++,
        ready: false, connection: "connected", participation: "active", locomotion: "onFoot",
        pose: { position: { x: 0, y: 0, z: 0 }, yaw: 0 }, route: null, speedMps: 0,
        stamina: tuning.movement.staminaMax,
        status: { stunnedUntilTick: null, protectedUntilTick: null, sabotageCooldownUntilTick: null, wanted: false },
        vehicleId: null, seatIndex: null, lastProcessedInputSequence: 0, lastProcessedActionId: 0,
      };
      this.players.set(client.sessionId, player);
      this.gates.set(client.sessionId, new CommandGate(tuning.timing.maxInputSendHz));
      this.playerInputs.set(client.sessionId, new PlayerInputBuffer(player.id, tuning.network.heldInputTimeoutMs));
      this.publish();
    }

    override onLeave(client: Client): void {
      // Failed/late reservations never joined the roster and must not cancel a countdown.
      if (!this.players.delete(client.sessionId)) return;
      this.match?.forfeit(client.sessionId as PlayerId);
      this.gates.delete(client.sessionId);
      this.playerInputs.delete(client.sessionId);
      if (this.snapshot.match.phase === "countdown" && this.players.size < this.minimumPlayers()) {
        this.resetLobby();
        void this.unlock();
      } else {
        this.publish();
      }
    }

    override onDispose(): void {
      directory.remove(this.code);
      this.match = undefined;
      this.players.clear();
      this.gates.clear();
      this.playerInputs.clear();
      // Colyseus owns and clears the simulation interval, patch interval and room clock.
    }

    private sendMessage(client: Client, message: ServerMessage): void { client.send("message", message); }

    private command(client: Client, raw: unknown): void {
      const player = this.players.get(client.sessionId);
      const gate = this.gates.get(client.sessionId);
      if (!player || !gate) return;
      const command = gate.read(raw, this.snapshot.match.phase, player.id === this.hostId(), performance.now());
      if (command.type === "commandRejected") return this.sendMessage(client, command);
      switch (command.type) {
        case "setReady":
          player.ready = command.ready;
          this.publish();
          return;
        case "startMatch": {
          if (this.players.size < this.minimumPlayers() || [...this.players.values()].some((p) => !p.ready)) {
            return this.sendMessage(client, reject(command.type, "wrongPhase"));
          }
          this.match = new MatchSimulation({
            world, tuning, mode: this.mode, roomCode: this.code, seed: randomInt(0x1_0000_0000),
            participants: [...this.players.values()].map((p) => ({ playerId: p.id, nickname: p.nickname, joinOrder: p.joinOrder })),
          });
          void this.lock();
          this.publish();
          return;
        }
        case "requestRematch":
          this.resetLobby();
          void this.unlock();
          return;
        case "leave":
          // Remove immediately, before another message can be handled for this socket.
          this.onLeave(client);
          client.leave();
          return;
        case "input": {
          const outcome = this.playerInputs.get(client.sessionId)!.accept(command.frame, performance.now());
          if (outcome !== "accepted") this.sendMessage(client, reject(command.type, outcome === "overflow" ? "rateLimited" : "malformed"));
          return;
        }
        case "resume":
          // Reconnect identity/grace semantics remain T028.
          this.sendMessage(client, reject(command.type, "wrongPhase"));
          return;
      }
    }

    private hostId(): PlayerId | null { return this.players.values().next().value?.id ?? null; }

    private minimumPlayers(): number {
      return this.mode === "practice" ? tuning.room.minPlayersPractice : tuning.room.minPlayersNormal;
    }

    private resetLobby(): void {
      this.match = undefined;
      for (const input of this.playerInputs.values()) input.clear();
      for (const player of this.players.values()) player.ready = false;
      this.snapshot = {
        match: {
          roomCode: this.code, mode: this.mode, phase: "lobby", tick: 0, seed: 0,
          phaseEndsAtTick: null, chaseStartTick: null, chaseEndTick: null, robberRouteId: null,
          versions, hostId: this.hostId(), result: null,
        },
        players: [], robber: null, vehicles: [], police: [], interactables: [],
      };
      this.publish();
    }

    private advance(elapsedMs: number): void {
      if (!this.match || this.snapshot.match.phase === "results") return;
      const now = performance.now();
      const droppedMs = this.match.advance(elapsedMs, () => [...this.playerInputs.values()].flatMap((input) => {
        const sample = input.sample(now);
        return sample ? [sample] : [];
      }));
      if (droppedMs) console.warn(`[room] fixed-step catch-up dropped ${Math.round(droppedMs)} ms`);
      this.publish();
      for (const event of this.match.events()) this.broadcast("message", { type: "event", event } satisfies ServerMessage);
    }

    private publish(): void {
      if (this.match) {
        this.snapshot = this.match.snapshot();
      } else {
        this.snapshot.players = [...this.players.values()];
      }
      this.snapshot.match.hostId = this.hostId();
      this.state.publish(this.snapshot);
    }
  };
}
