import { createEndpoint, createRouter, defineServer } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { CONFIG_VERSION, PROTOCOL_VERSION } from "@stopthatguy/shared";
import { readServerConfig } from "./config.js";

const config = readServerConfig(process.env);

// T001 bootstrap only: no room types are registered yet. Rooms and matchmaking arrive with T006.
const server = defineServer({
  transport: new WebSocketTransport(),
  greet: false,
  rooms: {},
  routes: createRouter({
    health: createEndpoint("/health", { method: "GET" }, async (ctx) =>
      ctx.json({ status: "ok", protocolVersion: PROTOCOL_VERSION, configVersion: CONFIG_VERSION }),
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
