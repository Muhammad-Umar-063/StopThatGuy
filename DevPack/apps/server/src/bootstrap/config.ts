/** Server runtime configuration read from environment variables (see apps/server/.env.example). */
export interface ServerConfig {
  port: number;
}

const DEFAULT_PORT = 2567;

export function readServerConfig(env: NodeJS.ProcessEnv): ServerConfig {
  const rawPort = env.PORT?.trim();
  if (!rawPort) return { port: DEFAULT_PORT };

  const port = Number(rawPort);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid PORT "${rawPort}": expected an integer from 1 to 65535.`);
  }
  return { port };
}
