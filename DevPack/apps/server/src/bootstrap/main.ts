import { createEndpoint, createRouter, defineServer } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { CONFIG_VERSION, PROTOCOL_VERSION } from "@stopthatguy/shared";
import { FIRST_STREET_WORLD } from "@stopthatguy/world";
import { createRoomLifecycle } from "../rooms/index.js";
import { readServerConfig } from "./config.js";

const config = readServerConfig(process.env);

const lifecycle = createRoomLifecycle({ world: FIRST_STREET_WORLD });
const server = defineServer({
  transport: new WebSocketTransport(),
  greet: false,
  rooms: lifecycle.rooms,
  routes: createRouter({
    ...lifecycle.endpoints,
    health: createEndpoint("/health", { method: "GET" }, async (ctx) =>
      ctx.json({ status: "ok", protocolVersion: PROTOCOL_VERSION, configVersion: CONFIG_VERSION, worldVersion: FIRST_STREET_WORLD.worldVersion }),
    ),
  }),
});

try {
  await server.listen(config.port);
} catch (error) {
  console.error(`[server] Failed to listen on port ${config.port}. Set PORT to a free port.`);
  throw error;
}

console.info(`[server] Colyseus listening on ws://localhost:${config.port}`);
console.info(`[server] Health check: http://localhost:${config.port}/health`);
