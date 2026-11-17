import { createEndpoint, defineRoom, matchMaker } from "@colyseus/core";
import { DEFAULT_TUNING, PROTOCOL_VERSION, type GameTuning, type WorldData } from "@stopthatguy/shared";
import { RoomFailure, readCreateOptions, readJoinOptions } from "../validation/room-options.js";
import { createGameRoom } from "./game-room.js";
import { RoomDirectory } from "./room-directory.js";
import { readRoomRequest } from "../validation/room-request.js";

/** Compose once per server, with trusted versioned world data. No fixtures in production. */
export function createRoomLifecycle(options: { world: WorldData; tuning?: GameTuning }) {
  // Capture immutable server configuration; callers cannot change versions/rules after registration.
  const world = structuredClone(options.world);
  const tuning = structuredClone(options.tuning ?? DEFAULT_TUNING);
  const versions = { protocolVersion: PROTOCOL_VERSION, worldVersion: world.worldVersion, configVersion: tuning.configVersion };
  const directory = new RoomDirectory();
  const GameRoom = createGameRoom(world, tuning, directory);
  const roomName = "chase";

  const endpoints = {
    createRoom: createEndpoint("/rooms/create", { method: "POST", disableBody: true, requireRequest: true }, async (ctx) => {
      try {
        const request = readCreateOptions(await readRoomRequest(ctx.request), versions);
        const listing = await matchMaker.createRoom(roomName, request);
        const room = matchMaker.getLocalRoomById(listing.roomId) as InstanceType<typeof GameRoom>;
        const roomCode = room.roomCode;
        const reservation = await matchMaker.reserveSeatFor(listing, { nickname: request.nickname, versions: request.versions, roomCode });
        return ctx.json({ reservation, roomCode });
      } catch (error) {
        if (!(error instanceof RoomFailure)) throw error;
        return ctx.json({ code: error.roomCode, message: error.message }, {
          status: error.status, headers: error.status === 413 ? { Connection: "close" } : {},
        });
      }
    }),
    joinRoom: createEndpoint("/rooms/join", { method: "POST", disableBody: true, requireRequest: true }, async (ctx) => {
      try {
        const request = readJoinOptions(await readRoomRequest(ctx.request), versions);
        const room = directory.get(request.roomCode);
        room.assertJoinable();
        const listing = await matchMaker.driver.findOne({ roomId: room.roomId });
        if (!listing) throw new RoomFailure("roomExpired", 404);
        // Recheck after the await; capacity is then atomically claimed by Colyseus.
        directory.get(request.roomCode).assertJoinable();
        try {
          const reservation = await matchMaker.reserveSeatFor(listing, request);
          return ctx.json({ reservation, roomCode: request.roomCode });
        } catch (error) {
          directory.get(request.roomCode).assertJoinable();
          throw error;
        }
      } catch (error) {
        if (!(error instanceof RoomFailure)) throw error;
        return ctx.json({ code: error.roomCode, message: error.message }, {
          status: error.status, headers: error.status === 413 ? { Connection: "close" } : {},
        });
      }
    }),
  };

  return { rooms: { [roomName]: defineRoom(GameRoom) }, endpoints };
}
