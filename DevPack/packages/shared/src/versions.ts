/** Wire protocol version. Bump for any breaking change to commands, input frames, state records or events. */
export const PROTOCOL_VERSION = 2;

/** Version of the WorldData format (not of a particular map; maps carry their own `worldVersion`). */
export const WORLD_SCHEMA_VERSION = 1;

/** Sent in join/resume metadata; the server rejects a session whose versions differ from its own. */
export interface VersionInfo {
  /** Integer, compared with PROTOCOL_VERSION. */
  protocolVersion: number;
  /** Version label of the loaded map data (WorldData.worldVersion). */
  worldVersion: string;
  /** Version label of the tuning in use (GameTuning.configVersion). */
  configVersion: string;
}

/** Names of the fields that differ; empty when both sides are compatible. */
export function versionMismatches(local: VersionInfo, remote: VersionInfo): (keyof VersionInfo)[] {
  const fields: (keyof VersionInfo)[] = ["protocolVersion", "worldVersion", "configVersion"];
  return fields.filter((field) => local[field] !== remote[field]);
}
