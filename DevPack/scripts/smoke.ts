// npm run smoke — end-to-end smoke check of the built application (run `npm run build` first).
//
// Starts the built server and the Vite preview of the built client on free ports, checks the server's
// /health versions, loads the client in a headless Chromium-family browser over the DevTools protocol,
// and fails on startup errors, a renderer that does not start or advance, a missing protocol label, or
// any console error / uncaught exception / failed resource. Every wait is bounded. Only processes
// started here are stopped. Without a browser the check FAILS; it is never reported as skipped/passed.
// Artifacts: test-results/smoke/result.json and screenshot.png.
import { spawn, type ChildProcess, type SpawnOptions } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { WebSocket } from "node:http";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { delimiter, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CONFIG_VERSION, PROTOCOL_VERSION } from "@stopthatguy/shared";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const RESULTS_DIR = join(ROOT, "test-results", "smoke");
const TIMEOUT_MS = { start: 20_000, render: 20_000, cdpCall: 10_000, stop: 5_000, total: 120_000 };
const MIN_FRAMES_PER_SECOND = 5;
const POSIX = process.platform !== "win32";

class SmokeFailure extends Error {}

interface Started {
  name: string;
  child: ChildProcess;
  tail: string[];
}
const started: Started[] = [];
const steps: { step: string; ok: boolean; detail: string }[] = [];

function record(step: string, ok: boolean, detail: string): void {
  steps.push({ step, ok, detail });
  console.log(`${ok ? "✔" : "✖"} ${step}: ${detail}`);
  if (!ok) throw new SmokeFailure(`${step}: ${detail}`);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function withTimeout<T>(promise: Promise<T>, ms: number, what: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new SmokeFailure(`${what} timed out after ${ms} ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close(() => resolve(port));
    });
  });
}

function start(name: string, command: string, args: string[], options: SpawnOptions): Started {
  // POSIX: own process group, so stopping it also stops helpers it spawned (e.g. browser renderers).
  const child = spawn(command, args, { ...options, stdio: ["ignore", "pipe", "pipe"], detached: POSIX });
  const entry: Started = { name, child, tail: [] };
  const keep = (chunk: Buffer) => {
    entry.tail.push(...chunk.toString("utf8").split(/\r?\n/).filter(Boolean));
    entry.tail.splice(0, Math.max(0, entry.tail.length - 40));
  };
  child.stdout?.on("data", keep);
  child.stderr?.on("data", keep);
  child.on("error", (error) => entry.tail.push(`spawn error: ${error.message}`));
  started.push(entry);
  return entry;
}

const isRunning = (child: ChildProcess) => child.exitCode === null && child.signalCode === null;

/** Polls `probe` until it returns a value, the process exits, or the timeout passes. */
async function waitFor<T>(what: string, proc: Started, probe: () => Promise<T | undefined>): Promise<T> {
  const deadline = Date.now() + TIMEOUT_MS.start;
  while (Date.now() < deadline) {
    if (!isRunning(proc.child)) {
      throw new SmokeFailure(`${proc.name} exited (code ${proc.child.exitCode ?? proc.child.signalCode}) before ${what}:\n  ${proc.tail.join("\n  ")}`);
    }
    const value = await probe().catch(() => undefined);
    if (value !== undefined) return value;
    await sleep(250);
  }
  throw new SmokeFailure(`${what} not ready within ${TIMEOUT_MS.start} ms. ${proc.name} output:\n  ${proc.tail.join("\n  ")}`);
}

async function stop(entry: Started): Promise<void> {
  const { child } = entry;
  if (!isRunning(child) || child.pid === undefined) return;
  const exited = new Promise<void>((resolve) => child.once("exit", () => resolve()));
  const signal = (sig: NodeJS.Signals) => {
    try {
      if (POSIX) process.kill(-child.pid!, sig);
      else child.kill(sig);
    } catch {
      /* already gone */
    }
  };
  signal("SIGTERM");
  const stopped = await Promise.race([exited.then(() => true), sleep(TIMEOUT_MS.stop).then(() => false)]);
  if (!stopped) {
    signal("SIGKILL");
    await Promise.race([exited, sleep(TIMEOUT_MS.stop)]);
  }
}

async function stopAll(): Promise<void> {
  for (const entry of [...started].reverse()) await stop(entry);
}

function findBrowser(): string | undefined {
  const fromEnv = process.env.CHROME_PATH;
  if (fromEnv) return existsSync(fromEnv) ? fromEnv : undefined;
  if (process.platform === "darwin") {
    return [
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
      "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    ].find(existsSync);
  }
  if (process.platform === "win32") {
    const roots = [process.env.PROGRAMFILES, process.env["PROGRAMFILES(X86)"], process.env.LOCALAPPDATA].filter(Boolean) as string[];
    return roots
      .flatMap((root) => [join(root, "Google/Chrome/Application/chrome.exe"), join(root, "Microsoft/Edge/Application/msedge.exe")])
      .find(existsSync);
  }
  const names = ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser", "microsoft-edge"];
  const dirs = (process.env.PATH ?? "").split(delimiter).filter(Boolean);
  for (const name of names) for (const dir of dirs) if (existsSync(join(dir, name))) return join(dir, name);
  return undefined;
}

async function getJson(url: string): Promise<unknown> {
  const response = await fetch(url, { signal: AbortSignal.timeout(2_000) });
  return response.ok ? response.json() : undefined;
}

interface PageResult {
  marker: string | null;
  status: string | null;
  framesInOneSecond: number;
  errors: string[];
  warnings: string[];
}

/** Loads `url` in a new tab through the DevTools protocol and collects render state and problems. */
async function inspectPage(debugPort: number, url: string): Promise<PageResult> {
  const target = (await (await fetch(`http://127.0.0.1:${debugPort}/json/new?about:blank`, { method: "PUT" })).json()) as {
    id: string;
    webSocketDebuggerUrl: string;
  };
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await withTimeout(new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", () => reject(new SmokeFailure("cannot connect to the browser DevTools socket")), { once: true });
  }), TIMEOUT_MS.cdpCall, "DevTools connection");

  const errors: string[] = [];
  const warnings: string[] = [];
  const pending = new Map<number, (message: { result?: unknown; error?: { message: string } }) => void>();
  let nextId = 1;
  ws.addEventListener("message", (event) => {
    const msg = JSON.parse(String(event.data)) as { id?: number; method?: string; params?: Record<string, any>; result?: unknown };
    if (msg.id !== undefined) {
      pending.get(msg.id)?.(msg as { result?: unknown });
      pending.delete(msg.id);
      return;
    }
    const p = msg.params ?? {};
    if (msg.method === "Runtime.consoleAPICalled") {
      const text = (p.args ?? []).map((a: { value?: unknown; description?: string }) => String(a.value ?? a.description ?? "")).join(" ");
      if (p.type === "error" || p.type === "assert") errors.push(`console.${p.type}: ${text}`);
      else if (p.type === "warning") warnings.push(`console.warn: ${text}`);
    } else if (msg.method === "Runtime.exceptionThrown") {
      errors.push(`uncaught exception: ${p.exceptionDetails?.exception?.description ?? p.exceptionDetails?.text}`);
    } else if (msg.method === "Log.entryAdded") {
      const line = `${p.entry?.source}: ${p.entry?.text} ${p.entry?.url ?? ""}`.trim();
      if (p.entry?.level === "error") errors.push(line);
      else if (p.entry?.level === "warning") warnings.push(line);
    }
  });
  const send = (method: string, params: Record<string, unknown> = {}) =>
    withTimeout(
      new Promise<any>((resolve, reject) => {
        const id = nextId++;
        pending.set(id, (message) => (message.error ? reject(new SmokeFailure(`${method}: ${message.error.message}`)) : resolve(message.result)));
        ws.send(JSON.stringify({ id, method, params }));
      }),
      TIMEOUT_MS.cdpCall,
      `DevTools ${method}`,
    );
  const evaluate = async (expression: string) =>
    (await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }))?.result?.value as unknown;

  try {
    await send("Runtime.enable");
    await send("Log.enable");
    await send("Page.enable");
    await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
    await send("Page.navigate", { url });

    let marker: string | null = null;
    const deadline = Date.now() + TIMEOUT_MS.render;
    while (Date.now() < deadline && marker !== "running" && marker !== "failed") {
      await sleep(250);
      marker = ((await evaluate("document.documentElement.dataset.renderer ?? null")) as string | null) ?? null;
    }
    const status = (await evaluate("document.getElementById('status')?.textContent ?? null")) as string | null;
    const framesInOneSecond = Number(
      await evaluate(`new Promise((done) => { const start = performance.now(); let frames = 0;
        const tick = () => { frames++; performance.now() - start < 1000 ? requestAnimationFrame(tick) : done(frames); };
        requestAnimationFrame(tick); })`),
    );
    const shot = (await send("Page.captureScreenshot", { format: "png" })) as { data: string };
    writeFileSync(join(RESULTS_DIR, "screenshot.png"), Buffer.from(shot.data, "base64"));
    return { marker, status, framesInOneSecond, errors, warnings };
  } finally {
    ws.close();
    await fetch(`http://127.0.0.1:${debugPort}/json/close/${target.id}`).catch(() => undefined);
  }
}

async function run(): Promise<{ browser: string; page?: PageResult }> {
  rmSync(RESULTS_DIR, { recursive: true, force: true });
  mkdirSync(RESULTS_DIR, { recursive: true });

  const serverEntry = join(ROOT, "apps/server/dist/bootstrap/main.js");
  const clientIndex = join(ROOT, "apps/client/dist/index.html");
  const viteBin = join(ROOT, "node_modules/vite/bin/vite.js");
  const missing = [serverEntry, clientIndex, viteBin].filter((file) => !existsSync(file));
  record("build output", missing.length === 0, missing.length ? `missing ${missing.join(", ")}; run \`npm ci\` and \`npm run build\` first` : "server and client builds present");
  const browserPath = findBrowser();
  record(
    "browser",
    browserPath !== undefined,
    browserPath ?? "no Chrome, Chromium or Edge found; install one or set CHROME_PATH (the smoke check cannot pass without a browser)",
  );

  const serverPort = await freePort();
  const server = start("server", process.execPath, [serverEntry], {
    cwd: join(ROOT, "apps/server"),
    env: { ...process.env, PORT: String(serverPort), NODE_OPTIONS: "" },
  });
  const health = (await waitFor("server /health", server, () => getJson(`http://127.0.0.1:${serverPort}/health`))) as Record<string, unknown>;
  const expected = { status: "ok", protocolVersion: PROTOCOL_VERSION, configVersion: CONFIG_VERSION };
  record(
    "server health",
    Object.entries(expected).every(([key, value]) => health[key] === value),
    `GET /health on port ${serverPort} → ${JSON.stringify(health)} (expected ${JSON.stringify(expected)})`,
  );

  const previewPort = await freePort();
  const previewUrl = `http://127.0.0.1:${previewPort}/`;
  const preview = start("client preview", process.execPath, [viteBin, "preview", "--host", "127.0.0.1", "--port", String(previewPort), "--strictPort"], {
    cwd: join(ROOT, "apps/client"),
    env: { ...process.env, NODE_OPTIONS: "" },
  });
  await waitFor("client preview", preview, async () => ((await fetch(previewUrl, { signal: AbortSignal.timeout(2_000) })).ok ? true : undefined));
  record("client preview", true, `serving the production build at ${previewUrl}`);

  const profile = mkdtempSync(join(tmpdir(), "stg-smoke-browser-"));
  try {
    const debugPort = await freePort();
    const browserArgs = [
      "--headless=new",
      `--remote-debugging-port=${debugPort}`,
      `--user-data-dir=${profile}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-extensions",
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
      // CI containers/runners often cannot provide the browser sandbox.
      ...(process.env.CI ? ["--no-sandbox"] : []),
      "about:blank",
    ];
    const browser = start("browser", browserPath!, browserArgs, {});
    const version = (await waitFor("browser DevTools endpoint", browser, () => getJson(`http://127.0.0.1:${debugPort}/json/version`))) as { Browser?: string };
    record("browser started", true, `${version.Browser ?? "unknown"} (headless, SwiftShader WebGL)`);

    const page = await inspectPage(debugPort, previewUrl);
    record("renderer started", page.marker === "running", `html[data-renderer] = ${JSON.stringify(page.marker)}`);
    record("status label", page.status?.includes(`protocol v${PROTOCOL_VERSION}`) === true, JSON.stringify(page.status));
    record("render loop advancing", page.framesInOneSecond >= MIN_FRAMES_PER_SECOND, `${page.framesInOneSecond} frames in 1 s (minimum ${MIN_FRAMES_PER_SECOND})`);
    for (const warning of page.warnings) console.log(`  ⚠ ${warning}`);
    record("no console errors", page.errors.length === 0, page.errors.length ? page.errors.join(" | ") : "no errors, exceptions or failed resources");
    return { browser: version.Browser ?? browserPath!, page };
  } finally {
    await stopAll();
    rmSync(profile, { recursive: true, force: true });
  }
}

let exitCode = 0;
let failure: string | undefined;
const interrupted = () => {
  void stopAll().finally(() => process.exit(130));
};
process.once("SIGINT", interrupted);
process.once("SIGTERM", interrupted);

let outcome: Awaited<ReturnType<typeof run>> | undefined;
try {
  outcome = await withTimeout(run(), TIMEOUT_MS.total, "smoke check");
} catch (error) {
  exitCode = 1;
  failure = error instanceof Error ? error.message : String(error);
  if (!(error instanceof SmokeFailure)) console.error(error);
} finally {
  await stopAll();
}
const leftovers = started.filter((entry) => isRunning(entry.child)).map((entry) => entry.name);
if (leftovers.length) {
  exitCode = 1;
  failure ??= `processes still running after shutdown: ${leftovers.join(", ")}`;
}
mkdirSync(RESULTS_DIR, { recursive: true });
writeFileSync(
  join(RESULTS_DIR, "result.json"),
  `${JSON.stringify({ ok: exitCode === 0, failure: failure ?? null, steps, browser: outcome?.browser ?? null, page: outcome?.page ?? null }, null, 2)}\n`,
);
console.log(exitCode === 0 ? "\nSmoke check passed" : `\nSmoke check FAILED: ${failure}`);
process.exit(exitCode);
