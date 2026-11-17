// T012 real Chromium keyboard acceptance; no synthetic click/focus substitutes for navigation.
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { delimiter, dirname, join } from "node:path";
import { after, afterEach, before, describe, test } from "node:test";
import { fileURLToPath } from "node:url";

const CLIENT_DIR = join(dirname(fileURLToPath(import.meta.url)), "../../../..");
const VITE_BIN = join(CLIENT_DIR, "../../node_modules/vite/bin/vite.js");
const ROOT = join(CLIENT_DIR, "../..");
const EVIDENCE = join(ROOT, "test-results/lobby");
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

let page: Cdp;
let browserCdp: Cdp;
let profileDir: string | undefined;
let baseUrl = "";
const failures: string[] = [];

async function evaluate<T>(expression: string): Promise<T> {
  const response = await page.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.exception?.description ?? response.exceptionDetails.text);
  return response.result.value as T;
}
async function until(what: string, check: () => Promise<boolean>) {
  const end = Date.now() + 10_000;
  while (!(await check())) { assert.ok(Date.now() < end, `Timed out: ${what}`); await sleep(30); }
}
const active = () => evaluate<string>("document.activeElement.id || document.activeElement.dataset.retry !== undefined && 'retry' || document.activeElement.tagName");
const title = () => evaluate<string>("document.querySelector('h1')?.textContent");
const text = (selector: string) => evaluate<string>(`document.querySelector(${JSON.stringify(selector)})?.textContent ?? ''`);
const intents = () => evaluate<{ type: string; roomCode?: string; nickname?: string; ready?: boolean }[]>("lobbyFixture.getIntents()");
const disabled = (id: string) => evaluate<boolean>(`document.getElementById(${JSON.stringify(id)}).getAttribute('aria-disabled') === 'true'`);
async function key(name: string, modifiers = 0, repeat = false) {
  const vk: Record<string, number> = { Enter: 13, Escape: 27, Tab: 9, ArrowUp: 38, ArrowDown: 40, ArrowLeft: 37, ArrowRight: 39, Backspace: 8, a: 65 };
  await page.send("Input.dispatchKeyEvent", { type: "keyDown", key: name, code: name === "a" ? "KeyA" : name, windowsVirtualKeyCode: vk[name], modifiers, autoRepeat: repeat, ...(name === "Enter" ? { text: "\r" } : {}) });
  await page.send("Input.dispatchKeyEvent", { type: "keyUp", key: name, code: name === "a" ? "KeyA" : name, windowsVirtualKeyCode: vk[name], modifiers });
}
async function type(value: string) { await page.send("Input.insertText", { text: value }); }
async function replace(value: string) { await key("a", 2); await key("Backspace"); await type(value); }
async function tabTo(id: string) {
  for (let n = 0; n < 18; n++) { if (await active() === id) return; await key("Tab"); }
  assert.fail(`Tab could not reach ${id}; focused ${await active()}`);
}
async function reset() {
  await page.send("Page.navigate", { url: baseUrl });
  await until("fixture", () => evaluate<boolean>("document.documentElement.dataset.lobbyFixture === 'ready'").catch(() => false));
  await page.send("Page.bringToFront");
  await until("initial focus", async () => await active() === "nickname");
}
async function choose() { await reset(); await type("Ana"); await key("Enter"); assert.equal(await active(), "create"); }
async function joinForm() { await choose(); await key("ArrowDown"); assert.equal(await active(), "join"); await key("Enter"); assert.equal(await active(), "room-code"); }
async function waitLobby() { await until("lobby", async () => await title() === "Get ready to give chase."); }
async function snapshot(name: string) {
  const { data } = await page.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
  writeFileSync(join(EVIDENCE, name), Buffer.from(data, "base64"));
}

for (const mode of ["dev", "built"] as const) {
  describe(`T012 keyboard lobby (${mode})`, { timeout: 120_000 }, () => {
    before(async () => {
      mkdirSync(EVIDENCE, { recursive: true });
      const port = mode === "dev" ? Number(process.env.KEYBOARD_BROWSER_PORT ?? 5412) : 5212;
      baseUrl = `http://127.0.0.1:${port}/src/ui/lobby/demo.html`;
      const vite = start(`lobby ${mode}`, process.execPath, [VITE_BIN, ...(mode === "built" ? ["preview"] : []), "--host", "127.0.0.1", "--port", String(port), "--strictPort"], CLIENT_DIR);
      await waitFor("demo page", vite, async () => (await fetch(baseUrl, { signal: AbortSignal.timeout(2_000) })).ok ? true : undefined);
      const browserPath = findBrowser(); assert.ok(browserPath, "Chromium required; no skipped browser acceptance");
      profileDir = mkdtempSync(join(tmpdir(), "stg-lobby-"));
      const debugPort = await freePort();
      const browser = start("lobby browser", browserPath, ["--headless=new", `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profileDir}`, "--no-first-run", "--no-default-browser-check", "--disable-extensions", ...(process.env.CI ? ["--no-sandbox"] : []), "about:blank"]);
      const version = await waitFor("browser", browser, () => getJson(`http://127.0.0.1:${debugPort}/json/version`));
      console.log(`# ${mode}: ${version.Browser}; ${baseUrl}`);
      browserCdp = await connect(version.webSocketDebuggerUrl);
      const target = await (await fetch(`http://127.0.0.1:${debugPort}/json/new?about:blank`, { method: "PUT" })).json();
      page = await connect(target.webSocketDebuggerUrl);
      await page.send("Runtime.enable"); await page.send("Page.enable");
      await page.send("Emulation.setDeviceMetricsOverride", { width: 1100, height: 920, deviceScaleFactor: 1, mobile: false });
      // Capture application errors inside each new document, independently of CDP command responses.
      await page.send("Page.addScriptToEvaluateOnNewDocument", { source: "window.lobbyErrors=[];addEventListener('error',e=>lobbyErrors.push(e.message));addEventListener('unhandledrejection',e=>lobbyErrors.push(String(e.reason)));" });
      writeFileSync(join(EVIDENCE, `${mode}-environment.json`), JSON.stringify({ browser: version.Browser, url: baseUrl, transport: "fixture", realDevice: false }, null, 2));
    });
    afterEach(async () => { failures.push(...await evaluate<string[]>("lobbyErrors ?? []")); });
    after(async () => {
      page?.close(); browserCdp?.close(); await stopAll();
      if (profileDir) rmSync(profileDir, { recursive: true, force: true });
      assert.deepEqual(started.filter((p) => isRunning(p.child)).map((p) => p.name), [], "only own processes stopped");
      assert.deepEqual(failures, []);
    });

    test("nickname errors, Unicode normalization, native caret/Tab, arrows and Escape restoration", async () => {
      await reset();
      assert.match(await text("[data-fixture]"), /No online connection/);
      await key("Enter");
      assert.equal(await active(), "nickname");
      assert.equal(await evaluate("document.querySelector('#nickname').getAttribute('aria-invalid')"), "true");
      assert.match(await text("#nickname-error"), /valid nickname/);
      await type("A\u200bna"); await key("Enter"); assert.equal(await active(), "nickname");
      await replace("  Jose\u0301  ");
      await key("ArrowLeft");
      assert.equal(await evaluate("document.querySelector('#nickname').selectionStart"), 8);
      await key("Tab"); assert.equal(await active(), "continue");
      await key("Tab", 8); assert.equal(await active(), "nickname");
      await key("Enter"); assert.equal(await active(), "create");
      assert.match(await text(".lobby-subtitle"), /José/);
      await key("ArrowDown"); assert.equal(await active(), "join");
      await key("Enter"); await type("ab"); await key("Enter");
      assert.match(await text("#room-code-error"), /Check the room code/);
      await key("Escape"); assert.equal(await active(), "join");
      await key("Escape"); assert.equal(await active(), "nickname");
      assert.equal(await evaluate("document.querySelector('#nickname').value"), "José");
      await snapshot(`${mode}-nickname.png`);
    });

    test("host create/ready/unready/start, loading guard and fixture-only endpoint", async () => {
      await choose(); await key("Enter");
      assert.match(await text("[data-status]"), /Creating/);
      await key("Enter", 0, true); await key("Enter");
      assert.equal((await intents()).filter((i) => i.type === "createRoom").length, 1);
      await waitLobby(); assert.equal(await active(), "ready");
      assert.equal(await evaluate("getComputedStyle(document.activeElement).outlineStyle"), "solid");
      assert.equal(await disabled("start"), true);
      await key("Tab"); assert.equal(await active(), "start"); await key("ArrowDown"); assert.equal(await active(), "leave");
      await key("Tab", 8); await key("Enter");
      assert.equal((await intents()).filter((i) => i.type === "startMatch").length, 0);
      await key("Tab", 8); await key("Enter");
      assert.match(await text("[data-status]"), /readiness/);
      assert.equal(await text("#ready"), "I'm ready", "no optimistic state");
      await until("ready ack", async () => await text("#ready") === "I'm not ready");
      assert.equal(await active(), "ready"); assert.equal(await disabled("start"), false);
      await key("Enter"); await until("unready ack", async () => await text("#ready") === "I'm ready");
      assert.equal(await disabled("start"), true);
      await key("Enter"); await until("second ready ack", async () => !(await disabled("start")));
      await snapshot(`${mode}-lobby.png`);
      await key("ArrowDown"); assert.equal(await active(), "start"); await key("Enter");
      await until("start ack", async () => await title() === "The chase is starting.");
      assert.match(await text("[data-started]"), /no online match/);
      await key("Escape"); assert.equal(await title(), "The chase is starting.");
      await tabTo("leave"); await key("Enter"); assert.equal(await active(), "create");
    });

    test("join normalizes code; guest cannot start; roster/host changes preserve focus", async () => {
      await joinForm(); await type("abcde"); await key("Enter");
      assert.equal(await evaluate("document.querySelector('#room-code').readOnly"), true);
      await waitLobby();
      assert.equal((await intents()).find((i) => i.type === "joinRoom")?.roomCode, "ABCDE");
      assert.equal(await disabled("start"), true);
      await key("Enter"); await until("guest ready", async () => await text("#ready") === "I'm not ready");
      assert.equal(await disabled("start"), true);
      await evaluate("{const v=lobbyFixture.adapter.getView();lobbyFixture.setView({...v,lobby:{...v.lobby,localIsHost:true,canStart:true,players:v.lobby.players.map(p=>({...p,isHost:p.isLocal}))}})}");
      assert.equal(await active(), "ready"); assert.equal(await disabled("start"), false);
      await key("Escape"); assert.equal(await active(), "join");
    });

    test("all eight room errors, generic server failure and successful keyboard retry", async () => {
      const cases = { invalidRequest: /request was not accepted/, invalidNickname: /nickname is not valid/, invalidRoomCode: /code is not valid/, roomNotFound: /Room not found/, roomFull: /room is full/, roomExpired: /room has expired/, matchInProgress: /already started/, versionMismatch: /version does not match/, server: /server connection was lost/ };
      for (const [code, message] of Object.entries(cases)) {
        await joinForm(); await type("ABCDE");
        await evaluate(`lobbyFixture.failNext(${JSON.stringify(code)})`); await key("Enter");
        await until(code, async () => message.test(await text("[data-error]")));
        assert.equal(await evaluate("document.querySelector('#room-code').value"), "ABCDE");
        await tabTo("retry"); await key("Enter"); await waitLobby();
        assert.equal(await active(), "ready");
      }
    });

    test("Escape cancels admission, stale completion cannot reopen it, practice can start", async () => {
      await choose(); await key("Enter"); await key("Escape");
      assert.equal(await active(), "create"); await sleep(550);
      assert.equal(await title(), "Find your chasing crew.");
      await key("ArrowDown"); await key("ArrowDown"); assert.equal(await active(), "practice");
      await key("Enter"); await waitLobby(); assert.match(await text("[data-mode]"), /practice/);
      assert.equal(await evaluate("document.querySelectorAll('.roster li').length"), 1);
      await key("Enter"); await until("practice ready", async () => !(await disabled("start")));
      await key("Escape"); assert.equal(await active(), "practice");
    });

    test("IME composition, timeout latch, late errors, delayed leave and disposal", async () => {
      await reset();
      await page.send("Input.imeSetComposition", { text: "Ana", selectionStart: 3, selectionEnd: 3 });
      await key("Enter"); assert.equal(await active(), "nickname");
      await type("Ana"); await key("Enter"); assert.equal(await active(), "create");
      await key("Enter"); await waitLobby();
      await evaluate("lobbyFixture.remount(70)");
      await key("Enter");
      await until("ready timeout", async () => /taking too long/.test(await text("[data-error]")));
      await evaluate("{const v=lobbyFixture.adapter.getView();lobbyFixture.setView({...v,messages:[{id:'rejected',kind:'warning',text:'Request rejected. Wait before trying again.'}]})}");
      assert.match(await text("[data-messages]"), /Request rejected/);
      await key("Enter"); assert.equal((await intents()).filter(i=>i.type==='setReady').length, 1);
      await until("late ready ack", async () => await text("#ready") === "I'm not ready");
      assert.equal(await text("[data-error]"), "");
      // Delay the transport's departure acknowledgement; UI must stay gated even after timeout.
      await evaluate("{const dispatch=lobbyFixture.adapter.dispatch;lobbyFixture.adapter.dispatch=i=>i.type==='leaveRoom'?setTimeout(()=>dispatch(i),350):dispatch(i)}");
      await key("Escape");
      await until("leave timeout", async () => /confirm leaving/.test(await text("[data-error]")));
      assert.equal(await disabled("ready"), true); assert.equal(await disabled("start"), true);
      await key("Enter"); assert.equal((await intents()).filter(i=>i.type==='setReady').length, 1);
      await key("Escape"); // idempotent leave retry is available after expiry.
      await until("leave ack", async () => await active() === "create");
      await sleep(400);
      await key("Enter"); await waitLobby();
      assert.equal((await intents()).filter(i=>i.type==='createRoom').at(-1)?.nickname, "Ana", "remount retained nickname");
      await evaluate("{const b=document.createElement('button');b.id='outside';b.textContent='Outside';document.body.prepend(b)}");
      await key("Tab", 8); assert.equal(await active(), "outside");
      await evaluate("lobbyFixture.remount(70)"); assert.equal(await active(), "ready");
      await evaluate("lobbyFixture.unmount()"); assert.equal(await active(), "outside");
      await evaluate("lobbyFixture.setView(lobbyFixture.adapter.getView())");
      assert.equal(await evaluate("document.querySelector('#lobby').children.length"), 0);
      await joinForm(); await type("ABCDE"); await evaluate("lobbyFixture.remount(70)");
      // remount without a room correctly requires a nickname again.
      await type("Ana"); await key("Enter"); await key("ArrowDown"); await key("Enter"); await type("ABCDE");
      await evaluate("lobbyFixture.failNext('roomFull')"); await key("Enter");
      await until("join timeout", async () => /taking too long/.test(await text("[data-error]")));
      await until("explicit late failure replaces timeout", async () => /room is full/.test(await text("[data-error]")));
      await key("Escape"); assert.equal(await active(), "join");
    });

    test("disconnect/closure recovery, text-safe long roster, narrow viewport and reduced motion", async () => {
      await choose(); await key("Enter"); await waitLobby();
      await evaluate("{const v=lobbyFixture.adapter.getView();lobbyFixture.setView({...v,connection:{state:'disconnected',error:null}})}");
      assert.equal(await disabled("ready"), true); assert.equal(await disabled("start"), true);
      assert.match(await text("[data-error]"), /connection was lost/);
      await evaluate("{const v=lobbyFixture.adapter.getView();lobbyFixture.setView({...v,connection:{state:'connected',error:null},lobby:{...v.lobby,players:Array.from({length:6},(_,i)=>({...v.lobby.players[0],id:'fixture-'+i,isLocal:i===0,isHost:i===0,nickname:i===1?'<img src=x onerror=alert(1)>':'Long fixture name '+i}))}})}");
      assert.equal(await evaluate("document.querySelectorAll('.roster img').length"), 0);
      await page.send("Emulation.setDeviceMetricsOverride", { width: 360, height: 740, deviceScaleFactor: 1, mobile: false });
      await page.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
      assert.equal(await evaluate("document.documentElement.scrollWidth <= innerWidth"), true);
      await tabTo("leave");
      assert.equal(await evaluate("document.activeElement.getBoundingClientRect().bottom <= innerHeight"), true);
      await snapshot(`${mode}-narrow.png`);
      await evaluate("{const v=lobbyFixture.adapter.getView();lobbyFixture.setView({...v,phase:'closed'})}");
      assert.equal(await title(), "This room has closed.");
      await tabTo("leave"); await key("Enter"); assert.equal(await active(), "create");
      failures.push(...await evaluate<string[]>("lobbyErrors"));
      await page.send("Emulation.setDeviceMetricsOverride", { width: 1100, height: 920, deviceScaleFactor: 1, mobile: false });
    });
  });
}
