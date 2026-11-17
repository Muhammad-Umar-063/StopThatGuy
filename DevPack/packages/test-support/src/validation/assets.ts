// Asset provenance manifest validation (Node-only: checks files on disk). Skeleton for T008, which owns
// asset acquisition and the import pipeline. Required fields follow docs/ASSETS.md "Provenance manifest".
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

export const ASSET_MANIFEST_SCHEMA_VERSION = 1;
export const ASSET_MANIFEST_STATUSES = ["empty-development", "active"] as const;
export const ASSET_KINDS = ["model", "texture", "audio", "font", "data", "other"] as const;
export const ASSET_ORIGINS = ["self-authored", "generated", "third-party"] as const;

export interface AssetManifestEntry {
  /** Stable catalog ID: ^[a-z0-9][a-z0-9._-]{0,63}$. Gameplay and rendering refer to assets by this ID. */
  id: string;
  kind: (typeof ASSET_KINDS)[number];
  /** Shipped file, relative to apps/client/public; must start with "assets/". */
  runtimePath: string;
  /** Original source: a project-relative path (e.g. assets-source/…) and/or an https URL. */
  source: { path: string | null; url: string | null };
  creator: string;
  origin: (typeof ASSET_ORIGINS)[number];
  /** SPDX identifier or LicenseRef-…, plus where the license text lives (project-relative path and/or URL). */
  license: { id: string; textPath: string | null; url: string | null };
  attribution: { required: boolean; text: string | null };
  /** "none" when unmodified. */
  modifications: string;
  /** Size of the runtime file; checked against the file. */
  fileSizeBytes: number;
  /** YYYY-MM-DD when generator terms were checked; required for generated assets. */
  generatorTermsCheckedAt: string | null;
  /** Optional technical metadata, recorded by the import pipeline (T008). Not yet checked against files. */
  technical: { triangles?: number; lods?: number; materials?: number; textureSizes?: string[]; animations?: string[] } | null;
}

export interface AssetManifest {
  schemaVersion: number;
  /** "empty-development" declares that no assets exist yet; "active" requires at least one entry. */
  status: (typeof ASSET_MANIFEST_STATUSES)[number];
  description?: string;
  assets: AssetManifestEntry[];
}

export const ASSET_ISSUE_CODES = [
  "malformed",
  "duplicateId",
  "duplicatePath",
  "missingFile",
  "sizeMismatch",
  "missingLicenseText",
  "missingSource",
  "undeclaredEmpty",
] as const;
export type AssetIssueCode = (typeof ASSET_ISSUE_CODES)[number];

export interface AssetIssue {
  severity: "error" | "warning";
  code: AssetIssueCode;
  message: string;
  /** Asset ID or manifest path. */
  ref: string;
}

export interface AssetManifestReport {
  ok: boolean;
  status: string | null;
  assetCount: number;
  issues: AssetIssue[];
  /** What a passing report still does not prove. */
  notVerified: readonly string[];
}

export interface AssetPaths {
  /** Directory that project-relative paths (sources, license texts) resolve against: DevPack. */
  projectRoot: string;
  /** Directory that runtimePath resolves against: DevPack/apps/client/public. */
  publicDir: string;
}

export const NOT_VERIFIED_BY_MANIFEST_CHECK: readonly string[] = Object.freeze([
  "whether each license actually permits the intended use and redistribution",
  "whether creator, origin and source are truthful (files cannot prove provenance)",
  "the content of generator terms recorded for generated assets",
  "that required attributions are displayed in the game's credits",
  "technical fields (triangles, LODs, materials, texture sizes, animations) against the files; needs glTF inspection (T008)",
  "browser loading, compression/decoder support and performance budgets (T008/T031)",
]);

const ENTRY_KEYS = [
  "id",
  "kind",
  "runtimePath",
  "source",
  "creator",
  "origin",
  "license",
  "attribution",
  "modifications",
  "fileSizeBytes",
  "generatorTermsCheckedAt",
  "technical",
];
const TECHNICAL_KEYS = ["triangles", "lods", "materials", "textureSizes", "animations"];
const ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const LICENSE_ID = /^[A-Za-z0-9][A-Za-z0-9.+-]{0,63}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const URL_PATTERN = /^https?:\/\/[^\s]{1,2040}$/;

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const nonEmpty = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;

/** Project-relative POSIX path without traversal, absolute roots, backslashes or a trailing slash. */
function isSafeRelativePath(path: string): boolean {
  return (
    path.length > 0 &&
    path.length <= 512 &&
    !path.startsWith("/") &&
    !path.endsWith("/") &&
    !path.includes("\\") &&
    !/^[A-Za-z]:/.test(path) &&
    !path.split("/").some((part) => part === ".." || part === "." || part === "")
  );
}

export function validateAssetManifest(input: unknown, paths: AssetPaths): AssetManifestReport {
  const issues: AssetIssue[] = [];
  const add = (severity: AssetIssue["severity"], code: AssetIssueCode, ref: string, message: string) => issues.push({ severity, code, ref, message });
  const report = (status: string | null, assetCount: number): AssetManifestReport => ({
    ok: !issues.some((i) => i.severity === "error"),
    status,
    assetCount,
    issues,
    notVerified: NOT_VERIFIED_BY_MANIFEST_CHECK,
  });

  if (!isObj(input)) {
    add("error", "malformed", "$", "manifest must be a JSON object");
    return report(null, 0);
  }
  for (const key of Object.keys(input)) {
    if (!["schemaVersion", "status", "description", "assets"].includes(key)) add("error", "malformed", `$.${key}`, "unknown field");
  }
  if (input.schemaVersion !== ASSET_MANIFEST_SCHEMA_VERSION) add("error", "malformed", "$.schemaVersion", `must be ${ASSET_MANIFEST_SCHEMA_VERSION}`);
  if (input.description !== undefined && typeof input.description !== "string") add("error", "malformed", "$.description", "must be a string");
  const status = typeof input.status === "string" ? input.status : null;
  if (!ASSET_MANIFEST_STATUSES.some((s) => s === status)) add("error", "malformed", "$.status", `must be one of ${ASSET_MANIFEST_STATUSES.join(", ")}`);
  if (!Array.isArray(input.assets)) {
    add("error", "malformed", "$.assets", "must be an array");
    return report(status, 0);
  }
  const assets: unknown[] = input.assets;
  if (status === "active" && assets.length === 0) add("error", "undeclaredEmpty", "$.status", 'an empty manifest must declare status "empty-development"');
  if (status === "empty-development" && assets.length > 0) add("error", "malformed", "$.status", 'status "empty-development" cannot list assets; use "active"');

  const ids = new Set<string>();
  const runtimePaths = new Set<string>();
  assets.forEach((raw, index) => {
    const at = `$.assets[${index}]`;
    if (!isObj(raw)) return add("error", "malformed", at, "entry must be an object");
    const ref = typeof raw.id === "string" ? raw.id : at;
    const malformed = (field: string, message: string) => add("error", "malformed", ref, `${field}: ${message}`);

    for (const key of Object.keys(raw)) if (!ENTRY_KEYS.includes(key)) malformed(key, "unknown field");
    for (const key of ENTRY_KEYS) if (!(key in raw)) malformed(key, "missing field");

    if (typeof raw.id !== "string" || !ID_PATTERN.test(raw.id)) malformed("id", "must match ^[a-z0-9][a-z0-9._-]{0,63}$");
    else if (ids.has(raw.id)) add("error", "duplicateId", ref, `duplicate asset id ${raw.id}`);
    else ids.add(raw.id);

    if (!ASSET_KINDS.some((k) => k === raw.kind)) malformed("kind", `must be one of ${ASSET_KINDS.join(", ")}`);
    if (!ASSET_ORIGINS.some((o) => o === raw.origin)) malformed("origin", `must be one of ${ASSET_ORIGINS.join(", ")}`);
    if (!nonEmpty(raw.creator)) malformed("creator", "must be a non-empty string");
    if (!nonEmpty(raw.modifications)) malformed("modifications", 'must be a non-empty string ("none" when unmodified)');

    const size = raw.fileSizeBytes;
    const sizeValid = Number.isSafeInteger(size) && (size as number) >= 0;
    if (!sizeValid) malformed("fileSizeBytes", "must be an integer ≥ 0");

    const runtimePath = raw.runtimePath;
    if (typeof runtimePath !== "string" || !isSafeRelativePath(runtimePath) || !runtimePath.startsWith("assets/")) {
      malformed("runtimePath", 'must be a relative path under "assets/" without "..", "\\" or a leading "/"');
    } else if (runtimePaths.has(runtimePath)) {
      add("error", "duplicatePath", ref, `runtime path ${runtimePath} is listed twice`);
    } else {
      runtimePaths.add(runtimePath);
      const file = join(paths.publicDir, runtimePath);
      if (!existsSync(file) || !statSync(file).isFile()) add("error", "missingFile", ref, `runtime file apps/client/public/${runtimePath} does not exist`);
      else if (sizeValid && statSync(file).size !== size) {
        add("error", "sizeMismatch", ref, `fileSizeBytes ${String(size)} ≠ actual ${statSync(file).size} bytes`);
      }
    }

    const source = raw.source;
    if (!isObj(source) || Object.keys(source).sort().join() !== "path,url") malformed("source", "must be {path, url}");
    else {
      const pathOk = source.path === null || (typeof source.path === "string" && isSafeRelativePath(source.path));
      const urlOk = source.url === null || (typeof source.url === "string" && URL_PATTERN.test(source.url));
      if (!pathOk || !urlOk || (source.path === null && source.url === null)) malformed("source", "needs a safe relative path and/or an http(s) URL");
      else if (typeof source.path === "string" && !existsSync(join(paths.projectRoot, source.path))) {
        add("warning", "missingSource", ref, `source ${source.path} is not in the repository (may be external or in LFS)`);
      }
    }

    const license = raw.license;
    if (!isObj(license) || Object.keys(license).sort().join() !== "id,textPath,url") malformed("license", "must be {id, textPath, url}");
    else {
      if (typeof license.id !== "string" || !LICENSE_ID.test(license.id)) malformed("license.id", "must be an SPDX identifier or LicenseRef-…");
      const textOk = license.textPath === null || (typeof license.textPath === "string" && isSafeRelativePath(license.textPath));
      const urlOk = license.url === null || (typeof license.url === "string" && URL_PATTERN.test(license.url));
      if (!textOk || !urlOk || (license.textPath === null && license.url === null)) malformed("license", "needs a license text path and/or URL");
      else if (typeof license.textPath === "string" && !existsSync(join(paths.projectRoot, license.textPath))) {
        add("error", "missingLicenseText", ref, `license text ${license.textPath} does not exist`);
      }
    }

    const attribution = raw.attribution;
    if (!isObj(attribution) || typeof attribution.required !== "boolean" || !(attribution.text === null || typeof attribution.text === "string")) {
      malformed("attribution", "must be {required: boolean, text: string | null}");
    } else if (attribution.required && !nonEmpty(attribution.text)) malformed("attribution.text", "required attribution needs its text");

    const checkedAt = raw.generatorTermsCheckedAt;
    if (!(checkedAt === null || (typeof checkedAt === "string" && DATE.test(checkedAt)))) malformed("generatorTermsCheckedAt", "must be YYYY-MM-DD or null");
    if (raw.origin === "generated" && checkedAt === null) malformed("generatorTermsCheckedAt", "generated assets must record when generator terms were checked");

    const technical = raw.technical;
    if (technical !== null && technical !== undefined) {
      if (!isObj(technical)) malformed("technical", "must be an object or null");
      else
        for (const [key, value] of Object.entries(technical)) {
          const count = ["triangles", "lods", "materials"].includes(key) && Number.isSafeInteger(value) && (value as number) >= 0;
          const strings = ["textureSizes", "animations"].includes(key) && Array.isArray(value) && value.every((v) => typeof v === "string");
          if (!TECHNICAL_KEYS.includes(key) || !(count || strings)) malformed(`technical.${key}`, "unknown field or wrong type");
        }
    }
  });
  return report(status, assets.length);
}

/** Reads and validates a manifest file; unreadable or invalid JSON is reported as malformed. */
export function validateAssetManifestFile(manifestPath: string, paths: AssetPaths): AssetManifestReport {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch (error) {
    return {
      ok: false,
      status: null,
      assetCount: 0,
      issues: [{ severity: "error", code: "malformed", ref: manifestPath, message: `cannot read manifest: ${(error as Error).message}` }],
      notVerified: NOT_VERIFIED_BY_MANIFEST_CHECK,
    };
  }
  return validateAssetManifest(parsed, paths);
}
