// @stopthatguy/world: versioned, authored world data on the shared WorldData contract. Plain frozen
// data only; validation lives in @stopthatguy/test-support (validateWorldData) and `npm run validate`.
import type { WorldData } from "@stopthatguy/shared";
import { FIRST_STREET_WORLD } from "./first-street.js";
import { LISBON_CITY_WORLD } from "./lisbon-city.js";

export { FIRST_STREET_IDS, FIRST_STREET_WORLD } from "./first-street.js";
export { LISBON_CITY_IDS, LISBON_CITY_WORLD } from "./lisbon-city.js";

/** Every authored world; `npm run validate` and CI validate each entry. */
export const AUTHORED_WORLDS: readonly WorldData[] = Object.freeze([FIRST_STREET_WORLD, LISBON_CITY_WORLD]);
