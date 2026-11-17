import catalog from "../../../../../assets/catalog.json";

/** The only runtime path table. Keep IDs stable when replacing files. */
export const ASSET_CATALOG = catalog;
export type AssetId = keyof typeof ASSET_CATALOG;
export const DEVELOPMENT_SAMPLE_ID: AssetId = "dev.axis-marker";

export function assetUrl(id: AssetId, baseUrl = import.meta.env?.BASE_URL ?? "/"): string {
  if (!Object.hasOwn(ASSET_CATALOG, id)) throw new Error(`Unknown visual asset ID: ${id}`);
  return `${baseUrl.replace(/\/?$/, "/")}${ASSET_CATALOG[id].runtimePath}`;
}
