// Browser evidence for T007 keyboard input in headless Chrome. Run from DevPack/:
//   npx tsx --test apps/client/src/input/keyboard/browser/keyboard.browser.test.ts
// Starts the client's Vite dev server on port 5207 (KEYBOARD_BROWSER_PORT overrides) to serve
// keyboard-fixture.html, starts a headless Chrome/Chromium/Edge (CHROME_PATH or PATH), sends real trusted
// key events over the DevTools protocol, and stops only the processes it started. Without a browser the
// tests fail; they are never skipped.
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { delimiter, dirname, join } from "node:path";
import { after, before, describe, test } from "node:test";
import { fileURLToPath } from "node:url";

const CLIENT_DIR = join(dirname(fileURLToPath(import.meta.url)), "../../../..");
const VITE_BIN = join(CLIENT_DIR, "../../node_modules/vite/bin/vite.js");
const PORT = Number(process.env.KEYBOARD_BROWSER_PORT ?? 5207);
const FIXTURE_URL = `http://127.0.0.1:${PORT}/src/input/keyboard/browser/keyboard-fixture.html`;
const POSIX = process.platform !== "win32";
const TIMEOUT = { start: 20_000, call: 10_000, settle: 250, stop: 5_000 };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function withTimeout<T>(promise: Promise<T>, ms: number, what: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${what} timed out after ${ms} ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// ── Processes ─────────────────────────────────────────────────────────────────────────────────────

interface Started {
  readonly name: string;
  readonly child: ChildProcess;
  readonly tail: string[];
}
const started: Started[] = [];
const isRunning = (child: ChildProcess) => child.exitCode === null && child.signalCode === null;

function start(name: string, command: string, args: string[], cwd?: string): Started {
  const child = spawn(command, args, { cwd, stdio: ["ignore", "pipe", "pipe"], detached: POSIX, env: { ...process.env, NODE_OPTIONS: "" } });
  const entry: Started = { name, child, tail: [] };
  const keep = (chunk: Buffer) => {
    entry.tail.push(...chunk.toString("utf8").split(/\r?\n/).filter(Boolean));
    entry.tail.splice(0, Math.max(0, entry.tail.length - 30));
  };
  child.stdout?.on("data", keep);
  child.stderr?.on("data", keep);
  child.on("error", (error) => entry.tail.push(`spawn error: ${error.message}`));
  started.push(entry);
  return entry;
}

async function waitFor<T>(what: string, proc: Started, probe: () => Promise<T | undefined>): Promise<T> {
  const deadline = Date.now() + TIMEOUT.start;
  while (Date.now() < deadline) {
    if (!isRunning(proc.child)) throw new Error(`${proc.name} exited before ${what}:\n  ${proc.tail.join("\n  ")}`);
    const value = await probe().catch(() => undefined);
    if (value !== undefined) return value;
    await sleep(200);
  }
  throw new Error(`${what} not ready within ${TIMEOUT.start} ms. ${proc.name} output:\n  ${proc.tail.join("\n  ")}`);
}

async function stopAll(): Promise<void> {
  for (const { child } of [...started].reverse()) {
    if (!isRunning(child) || child.pid === undefined) continue;
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
    if (!(await Promise.race([exited.then(() => true), sleep(TIMEOUT.stop).then(() => false)]))) {
      signal("SIGKILL");
      await Promise.race([exited, sleep(TIMEOUT.stop)]);
    }
  }
}

function findBrowser(): string | undefined {
  if (process.env.CHROME_PATH) return existsSync(process.env.CHROME_PATH) ? process.env.CHROME_PATH : undefined;
  if (process.platform === "darwin") {
    return ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/Applications/Chromium.app/Contents/MacOS/Chromium"].find(existsSync);
  }
  const names = process.platform === "win32" ? ["chrome.exe", "msedge.exe"] : ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser", "microsoft-edge"];
  const dirs = (process.env.PATH ?? "").split(delimiter).filter(Boolean);
  for (const name of names) for (const dir of dirs) if (existsSync(join(dir, name))) return join(dir, name);
  return undefined;
}

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => resolve(typeof address === "object" && address ? address.port : 0));
    });
  });
}

async function getJson(url: string): Promise<any> {
  const response = await fetch(url, { signal: AbortSignal.timeout(2_000) });
  return response.ok ? response.json() : undefined;
}

// ── DevTools protocol ─────────────────────────────────────────────────────────────────────────────

interface Cdp {
  send(method: string, params?: Record<string, unknown>): Promise<any>;
  close(): void;
}

async function connect(webSocketUrl: string): Promise<Cdp> {
  const ws = new WebSocket(webSocketUrl);
  await withTimeout(
    new Promise((resolve, reject) => {
      ws.addEventListener("open", resolve, { once: true });
      ws.addEventListener("error", () => reject(new Error("DevTools socket error")), { once: true });
    }),
    TIMEOUT.call,
    "DevTools connection",
  );
  const pending = new Map<number, (message: { result?: unknown; error?: { message: string } }) => void>();
  let nextId = 1;
  ws.addEventListener("message", (event) => {
    const message = JSON.parse(String(event.data)) as { id?: number; result?: unknown; error?: { message: string } };
    if (message.id !== undefined) {
      pending.get(message.id)?.(message);
      pending.delete(message.id);
    }
  });
  return {
    send: (method, params = {}) =>
      withTimeout(
        new Promise((resolve, reject) => {
          const id = nextId++;
          pending.set(id, (m) => (m.error ? reject(new Error(`${method}: ${m.error.message}`)) : resolve(m.result)));
          ws.send(JSON.stringify({ id, method, params }));
        }),
        TIMEOUT.call,
        `DevTools ${method}`,
      ),
    close: () => ws.close(),
  };
}

// ── Fixture session ───────────────────────────────────────────────────────────────────────────────

interface Held {
  forwardHeld: boolean;
  brakeHeld: boolean;
  sprintHeld: boolean;
  interactHeld: boolean;
}
interface Sample {
  held: Held;
  actions: { id: number; kind: string }[];
}
const NEUTRAL: Held = { forwardHeld: false, brakeHeld: false, sprintHeld: false, interactHeld: false };
const SHIFT = 8;

const KEYS: Record<string, { key: string; code: string; vk: number; text?: string; location?: number }> = {
  ArrowUp: { key: "ArrowUp", code: "ArrowUp", vk: 38 },
  ArrowDown: { key: "ArrowDown", code: "ArrowDown", vk: 40 },
  ArrowLeft: { key: "ArrowLeft", code: "ArrowLeft", vk: 37 },
  ArrowRight: { key: "ArrowRight", code: "ArrowRight", vk: 39 },
  Escape: { key: "Escape", code: "Escape", vk: 27 },
  ShiftLeft: { key: "Shift", code: "ShiftLeft", vk: 16, location: 1 },
  Tab: { key: "Tab", code: "Tab", vk: 9 },
  KeyE: { key: "e", code: "KeyE", vk: 69, text: "e" },
  KeyF: { key: "f", code: "KeyF", vk: 70, text: "f" },
  KeyX: { key: "x", code: "KeyX", vk: 88, text: "x" },
};

let browserCdp: Cdp;
let page: Cdp;
let pageTargetId: string;
let profileDir: string | undefined;

async function evaluate<T>(expression: string): Promise<T> {
  const response = await page.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (response.exceptionDetails) throw new Error(`page exception: ${response.exceptionDetails.exception?.description ?? response.exceptionDetails.text}`);
  return response.result.value as T;
}

const fixture = <T>(call: string) => evaluate<T>(`window.keyboardFixture.${call}`);

async function key(type: "down" | "up", name: string, options: { repeat?: boolean; modifiers?: number } = {}): Promise<void> {
  const k = KEYS[name];
  assert.ok(k, name);
  const shifted = (options.modifiers ?? 0) & SHIFT;
  const text = k.text && shifted ? k.text.toUpperCase() : k.text;
  await page.send("Input.dispatchKeyEvent", {
    type: type === "up" ? "keyUp" : text ? "keyDown" : "rawKeyDown",
    key: text ?? k.key,
    code: k.code,
    windowsVirtualKeyCode: k.vk,
    nativeVirtualKeyCode: k.vk,
    autoRepeat: options.repeat === true,
    modifiers: options.modifiers ?? 0,
    ...(type === "down" && text ? { text, unmodifiedText: k.text } : {}),
    ...(k.location ? { location: k.location } : {}),
  });
}

async function press(name: string, options: { repeats?: number; modifiers?: number } = {}): Promise<void> {
  await key("down", name, options);
  for (let i = 0; i < (options.repeats ?? 0); i++) await key("down", name, { ...options, repeat: true });
  await key("up", name, options);
}

const focus = (id: string) => evaluate<string>(`document.getElementById(${JSON.stringify(id)}).focus(); document.activeElement.id`);
const scrollY = async () => {
  await sleep(TIMEOUT.settle);
  return evaluate<number>("window.scrollY");
};

async function resetPage(): Promise<void> {
  await evaluate("window.scrollTo(0, 0); keyboardFixture.setActive(true); keyboardFixture.sample(); keyboardFixture.resetLog(); 0");
  assert.equal(await focus("surface"), "surface");
  assert.equal(await evaluate<number>("window.scrollY"), 0);
}

/** Listener counts on window and document by event type, read from Chrome itself. */
async function listenerCounts(): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const [label, expression] of [["window", "window"], ["document", "document"]] as const) {
    const { result } = await page.send("Runtime.evaluate", { expression });
    const { listeners } = (await page.send("DOMDebugger.getEventListeners", { objectId: result.objectId })) as { listeners: { type: string }[] };
    for (const { type } of listeners) counts[`${label}:${type}`] = (counts[`${label}:${type}`] ?? 0) + 1;
  }
  return counts;
}

const OWN_LISTENERS = ["window:keydown", "window:keyup", "window:focusin", "window:blur", "window:pagehide", "document:visibilitychange"];

// ── Tests ─────────────────────────────────────────────────────────────────────────────────────────

describe("keyboard input in headless Chrome", { timeout: 120_000 }, () => {
  before(async () => {
    const browserPath = findBrowser();
    assert.ok(browserPath, "no Chrome, Chromium or Edge found; install one or set CHROME_PATH (this check cannot pass without a browser)");
    assert.ok(existsSync(VITE_BIN), `missing ${VITE_BIN}; run npm ci`);

    const vite = start("vite dev", process.execPath, [VITE_BIN, "--host", "127.0.0.1", "--port", String(PORT), "--strictPort"], CLIENT_DIR);
    await waitFor("fixture page", vite, async () => ((await fetch(FIXTURE_URL, { signal: AbortSignal.timeout(2_000) })).ok ? true : undefined));

    profileDir = mkdtempSync(join(tmpdir(), "stg-keyboard-browser-"));
    const debugPort = await freePort();
    const browser = start("browser", browserPath, [
      "--headless=new",
      `--remote-debugging-port=${debugPort}`,
      `--user-data-dir=${profileDir}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-extensions",
      // Scroll position settles immediately, so a missing preventDefault is measurable.
      "--disable-smooth-scrolling",
      ...(process.env.CI ? ["--no-sandbox"] : []),
      "about:blank",
    ]);
    const version = await waitFor("browser DevTools endpoint", browser, () => getJson(`http://127.0.0.1:${debugPort}/json/version`));
    console.log(`# browser: ${version.Browser}; fixture: ${FIXTURE_URL}`);
    browserCdp = await connect(version.webSocketDebuggerUrl);
    const target = await (await fetch(`http://127.0.0.1:${debugPort}/json/new?about:blank`, { method: "PUT" })).json();
    pageTargetId = target.id;
    page = await connect(target.webSocketDebuggerUrl);
    await page.send("Runtime.enable");
    await page.send("Page.enable");
    await page.send("Emulation.setDeviceMetricsOverride", { width: 1024, height: 600, deviceScaleFactor: 1, mobile: false });
    await page.send("Page.navigate", { url: FIXTURE_URL });
    const deadline = Date.now() + TIMEOUT.start;
    while ((await evaluate<string | null>("document.documentElement.dataset.keyboardFixture ?? null").catch(() => null)) !== "ready") {
      assert.ok(Date.now() < deadline, "fixture did not become ready");
      await sleep(100);
    }
    await page.send("Page.bringToFront");
    assert.equal(await evaluate<boolean>("document.hasFocus()"), true, "page has focus");
  });

  after(async () => {
    page?.close();
    browserCdp?.close();
    await stopAll();
    if (profileDir) rmSync(profileDir, { recursive: true, force: true });
    const leftovers = started.filter((entry) => isRunning(entry.child)).map((entry) => entry.name);
    assert.deepEqual(leftovers, [], "all processes started by this check have stopped");
  });

  test("arrow keys, including key-repeat, do not scroll while gameplay owns focus", async () => {
    await resetPage();
    await key("down", "ArrowDown");
    for (let i = 0; i < 10; i++) await key("down", "ArrowDown", { repeat: true });
    assert.deepEqual(await fixture<Held>("held()"), { ...NEUTRAL, brakeHeld: true });
    await key("up", "ArrowDown");
    await press("ArrowUp", { repeats: 3 });
    assert.equal(await scrollY(), 0);
    assert.deepEqual(await fixture<Held>("held()"), NEUTRAL);
  });

  test("control: the same keys scroll when gameplay is inactive or focus is on a control outside the surface", async () => {
    await resetPage();
    await fixture("setActive(false)");
    await press("ArrowDown", { repeats: 3 });
    assert.ok((await scrollY()) > 0, "inactive gameplay leaves arrow scrolling to the page");
    assert.deepEqual(await fixture<Sample>("sample()"), { held: NEUTRAL, actions: [] });

    await resetPage();
    assert.equal(await focus("outside"), "outside");
    await press("ArrowDown", { repeats: 3 });
    assert.ok((await scrollY()) > 0, "button outside the gameplay surface keeps page scrolling");
    assert.deepEqual(await fixture<Sample>("sample()"), { held: NEUTRAL, actions: [] });
  });

  test("Chrome marks auto-repeat; holding Left/Right sends one request per press", async () => {
    await resetPage();
    await key("down", "ArrowLeft");
    for (let i = 0; i < 8; i++) await key("down", "ArrowLeft", { repeat: true });
    const first = await fixture<Sample>("sample()");
    assert.deepEqual(first.actions.map((a) => a.kind), ["left"]);
    const flags = await evaluate<boolean[]>("keyboardFixture.log.keydowns.filter((k) => k.code === 'ArrowLeft').map((k) => k.repeat)");
    assert.deepEqual(flags, [false, ...Array<boolean>(8).fill(true)], "browser-delivered event.repeat flags");
    await key("up", "ArrowLeft");
    await press("ArrowLeft");
    const second = await fixture<Sample>("sample()");
    assert.deepEqual(second.actions.map((a) => a.kind), ["left"], "release and press again gives one more request");
    assert.ok(second.actions[0]!.id > first.actions[0]!.id);

    await key("down", "ArrowRight");
    await key("down", "ArrowLeft");
    assert.deepEqual((await fixture<Sample>("sample()")).actions, [], "simultaneous left and right cancel");
    await key("up", "ArrowLeft");
    await key("up", "ArrowRight");
  });

  test("held versus edge: Shift+ArrowUp sprints, E holds interact with one press, F and X are single presses", async () => {
    await resetPage();
    await key("down", "ShiftLeft", { modifiers: SHIFT });
    await key("down", "ArrowUp", { modifiers: SHIFT });
    await key("down", "KeyE", { modifiers: SHIFT });
    for (let i = 0; i < 5; i++) await key("down", "KeyE", { modifiers: SHIFT, repeat: true });
    const holding = await fixture<Sample>("sample()");
    assert.deepEqual(holding.held, { forwardHeld: true, brakeHeld: false, sprintHeld: true, interactHeld: true });
    assert.deepEqual(holding.actions.map((a) => a.kind), ["interact"]);
    await press("KeyF", { modifiers: SHIFT, repeats: 2 });
    await press("KeyX", { modifiers: SHIFT, repeats: 2 });
    const presses = await fixture<Sample>("sample()");
    assert.deepEqual(presses.actions.map((a) => a.kind), ["capture", "sabotage"]);
    assert.equal(presses.held.interactHeld, true, "E still held");
    await key("up", "KeyE", { modifiers: SHIFT });
    assert.equal((await fixture<Held>("held()")).interactHeld, false);
    await key("up", "ArrowUp", { modifiers: SHIFT });
    await key("up", "ShiftLeft");
    assert.deepEqual(await fixture<Held>("held()"), NEUTRAL);
  });

  test("Escape emits one local menu intent per press and no edge action", async () => {
    await resetPage();
    await press("Escape", { repeats: 3 });
    await press("Escape");
    assert.equal(await evaluate<number>("keyboardFixture.log.menuIntents"), 2);
    assert.deepEqual((await fixture<Sample>("sample()")).actions, []);
  });

  test("a text field keeps typing, caret movement and Escape; focusing it releases held controls", async () => {
    await resetPage();
    await key("down", "ArrowUp");
    assert.equal((await fixture<Held>("held()")).forwardHeld, true);
    await evaluate("document.getElementById('name').value = ''; 0");
    assert.equal(await focus("name"), "name");
    assert.deepEqual(await fixture<Held>("held()"), NEUTRAL, "focus moved to a text field");
    await key("up", "ArrowUp");

    for (const name of ["KeyE", "KeyF", "KeyX"]) await press(name);
    await press("ArrowLeft");
    await press("ArrowLeft", { repeats: 1 });
    await press("Escape");
    const field = await evaluate<{ value: string; caret: number }>(
      "({ value: document.getElementById('name').value, caret: document.getElementById('name').selectionStart })",
    );
    // Three ArrowLeft keydowns (one is key-repeat) move the caret from 3 to 0.
    assert.deepEqual(field, { value: "efx", caret: 0 }, "typed letters kept; arrows (including repeat) moved the caret");
    assert.deepEqual(await fixture<Sample>("sample()"), { held: NEUTRAL, actions: [] });
    assert.equal(await evaluate<number>("keyboardFixture.log.menuIntents"), 0);
  });

  test("Tab and Shift+Tab keep standard focus navigation while gameplay is active", async () => {
    await resetPage();
    await press("Tab");
    assert.equal(await evaluate<string>("document.activeElement.id"), "name", "Tab moves from the surface to the text field");
    await press("Tab");
    assert.equal(await evaluate<string>("document.activeElement.id"), "outside");
    await key("down", "ShiftLeft", { modifiers: SHIFT });
    await press("Tab", { modifiers: SHIFT });
    await press("Tab", { modifiers: SHIFT });
    await key("up", "ShiftLeft");
    assert.equal(await evaluate<string>("document.activeElement.id"), "surface", "Shift+Tab returns to the gameplay surface");
    assert.deepEqual(await fixture<Sample>("sample()"), { held: NEUTRAL, actions: [] });
  });

  test("switching tabs (real blur and hidden visibility) releases everything; returning does not restore held keys", async () => {
    await resetPage();
    await key("down", "ArrowUp");
    await key("down", "KeyE");
    await key("down", "ArrowLeft");
    assert.deepEqual(await fixture<Held>("held()"), { ...NEUTRAL, forwardHeld: true, interactHeld: true });
    await evaluate("window.lifecycle = []; addEventListener('blur', () => lifecycle.push('blur')); document.addEventListener('visibilitychange', () => lifecycle.push(document.visibilityState)); 0");

    const { targetId } = await browserCdp.send("Target.createTarget", { url: "about:blank" });
    try {
      const deadline = Date.now() + TIMEOUT.call;
      while ((await evaluate<string>("document.visibilityState")) !== "hidden") {
        assert.ok(Date.now() < deadline, "page did not become hidden");
        await sleep(50);
      }
      assert.deepEqual(await evaluate<string[]>("lifecycle"), ["blur", "hidden"], "real browser events");
      assert.deepEqual(await fixture<Held>("held()"), NEUTRAL);
    } finally {
      await browserCdp.send("Target.activateTarget", { targetId: pageTargetId });
      await page.send("Page.bringToFront");
      await browserCdp.send("Target.closeTarget", { targetId });
    }
    assert.equal(await evaluate<string>("document.visibilityState"), "visible");
    assert.equal(await evaluate<boolean>("document.hasFocus()"), true);

    // Keys still physically down after returning: the browser only sends auto-repeat.
    for (const name of ["ArrowUp", "KeyE", "ArrowLeft"]) await key("down", name, { repeat: true });
    assert.deepEqual(await fixture<Sample>("sample()"), { held: NEUTRAL, actions: [] }, "nothing restored; the unsent Left press was discarded");
    await key("up", "ArrowUp");
    await key("down", "ArrowUp");
    assert.equal((await fixture<Held>("held()")).forwardHeld, true, "a fresh press works");
    for (const name of ["ArrowUp", "KeyE", "ArrowLeft"]) await key("up", name);
  });

  test("explicit release (disconnect) and suspension release held keys in the page", async () => {
    await resetPage();
    await key("down", "ArrowUp");
    await fixture("releaseAll()");
    assert.deepEqual(await fixture<Held>("held()"), NEUTRAL);
    await key("down", "ArrowUp", { repeat: true });
    assert.deepEqual(await fixture<Held>("held()"), NEUTRAL);
    await key("up", "ArrowUp");
    await key("down", "ShiftLeft", { modifiers: SHIFT });
    await fixture("setActive(false)");
    await fixture("setActive(true)");
    await key("down", "ShiftLeft", { modifiers: SHIFT, repeat: true });
    assert.deepEqual(await fixture<Held>("held()"), NEUTRAL);
    await key("up", "ShiftLeft");
  });

  test("re-initialization keeps exactly one listener set; dispose removes them and returns keys to the page", async () => {
    await resetPage();
    await page.send("DOMDebugger.enable").catch(() => undefined);
    const attached = await listenerCounts();
    await fixture("dispose()");
    const baseline = await listenerCounts();
    for (const type of OWN_LISTENERS) assert.equal((attached[type] ?? 0) - (baseline[type] ?? 0), 1, `${type}: one listener while attached`);

    await press("ArrowDown", { repeats: 3 });
    assert.ok((await scrollY()) > 0, "after dispose the page scrolls normally");
    assert.deepEqual(await fixture<Sample>("sample()"), { held: NEUTRAL, actions: [] });

    await fixture("attach()");
    await fixture("attach()");
    await fixture("attach()");
    const reattached = await listenerCounts();
    for (const type of OWN_LISTENERS) assert.equal((reattached[type] ?? 0) - (baseline[type] ?? 0), 1, `${type}: still one listener after three attaches`);
    await resetPage();
    await press("KeyF");
    const sample = await fixture<Sample>("sample()");
    assert.deepEqual(sample.actions.map((a) => a.kind), ["capture"], "one press, one action");
  });
});
