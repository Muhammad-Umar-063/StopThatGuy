// Run through the batch-3 browser lock. Two independent browser sessions, real server and existing lobby.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { delimiter, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer, preview } from 'vite';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../..');
const results = resolve(root, 'test-results/network');
mkdirSync(results, { recursive: true });
const dev = process.argv.includes('--dev');
const mode = dev ? 'dev' : 'built';
const url = 'http://127.0.0.1:5214/src/network/browser/demo.html';
const report = { mode, url, dataSource: 'real server', ok: false, checks: [], errors: [] };
const processes = [], sockets = [];
let vite, profile;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pass = (name, details = true) => { report.checks.push({ name, details }); console.log(`PASS ${name}`); };
async function until(name, probe, ms = 20000) {
  const end = Date.now() + ms;
  while (Date.now() < end) { const value = await probe(); if (value) return value; await sleep(50); }
  throw new Error(`Timed out: ${name}`);
}
function start(command, args, env = process.env) {
  const child = spawn(command, args, { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] });
  const tail = [];
  for (const stream of [child.stdout, child.stderr]) stream.on('data', (chunk) => { tail.push(String(chunk)); if (tail.length > 20) tail.shift(); });
  child.on('error', (e) => report.errors.push(e.message));
  processes.push(child);
  return { child, tail };
}
async function cleanup() {
  for (const socket of sockets) socket.close();
  for (const child of [...processes].reverse()) {
    if (child.exitCode !== null || child.signalCode !== null) continue;
    const closed = new Promise((r) => child.once('exit', r));
    child.kill('SIGTERM'); await Promise.race([closed, sleep(2000)]);
    if (child.exitCode === null && child.signalCode === null) { child.kill('SIGKILL'); await Promise.race([closed, sleep(1000)]); }
  }
  if (vite?.close) await vite.close();
  else if (vite) await new Promise((r) => vite.httpServer.close(r));
  if (profile) rmSync(profile, { recursive: true, force: true });
}
const timeout = setTimeout(() => { console.error('Network browser acceptance exceeded 120 seconds'); void cleanup().finally(() => process.exit(1)); }, 120000);
try {
  const server = start(process.execPath, dev ? ['--import', 'tsx', '--conditions=stopthatguy-source', 'apps/server/src/bootstrap/main.ts'] : ['apps/server/dist/bootstrap/main.js'], { ...process.env, PORT: '2614' });
  await until('owned server listening', async () => {
    if (server.child.exitCode !== null) throw new Error(server.tail.join(''));
    if (!server.tail.join('').includes('[server] Colyseus listening on ws://localhost:2614')) return false;
    try { return (await fetch('http://127.0.0.1:2614/health')).ok; } catch { return false; }
  });
  const options = { configFile: resolve(root, 'apps/client/vite.config.ts'), root: resolve(root, 'apps/client') };
  if (dev) { vite = await createServer({ ...options, server: { host: '127.0.0.1', port: 5214, strictPort: true } }); await vite.listen(); }
  else vite = await preview({ ...options, preview: { host: '127.0.0.1', port: 5214, strictPort: true } });
  const executable = process.env.CHROME_PATH ?? (process.env.PATH ?? '').split(delimiter).flatMap((dir) => ['google-chrome', 'chromium', 'chromium-browser'].map((name) => resolve(dir, name))).find(existsSync);
  assert.ok(executable, 'Chrome/Chromium required');
  profile = mkdtempSync(resolve(results, '.chrome-'));
  const chrome = start(executable, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', ...(process.env.CI ? ['--no-sandbox'] : []), 'about:blank']);
  const port = await until('Chrome debugging port', () => {
    if (chrome.child.exitCode !== null) throw new Error(chrome.tail.join(''));
    const p = resolve(profile, 'DevToolsActivePort'); return existsSync(p) && readFileSync(p, 'utf8').split('\n')[0];
  });
  report.browser = (await (await fetch(`http://127.0.0.1:${port}/json/version`)).json()).Browser;
  async function open() {
    const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
    const ws = new WebSocket(target.webSocketDebuggerUrl); sockets.push(ws);
    await new Promise((r, j) => { ws.addEventListener('open', r, { once: true }); ws.addEventListener('error', j, { once: true }); });
    const pending = new Map(); let id = 0;
    const send = (method, params = {}) => new Promise((resolve, reject) => {
      const request = ++id; const timer = setTimeout(() => { pending.delete(request); reject(new Error(`CDP timeout ${method}`)); }, 10000);
      pending.set(request, (message) => { clearTimeout(timer); message.error ? reject(new Error(message.error.message)) : resolve(message.result); });
      ws.send(JSON.stringify({ id: request, method, params }));
    });
    ws.addEventListener('message', (event) => {
      const m = JSON.parse(String(event.data));
      if (m.id) { pending.get(m.id)?.(m); pending.delete(m.id); return; }
      const p = m.params;
      if (m.method === 'Runtime.exceptionThrown') report.errors.push(p.exceptionDetails?.exception?.description ?? p.exceptionDetails?.text);
      if (m.method === 'Runtime.consoleAPICalled' && p.type === 'error') report.errors.push(p.args.map((a) => a.value ?? a.description).join(' '));
    });
    const evaluate = async (expression) => {
      const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
      return r.result?.value;
    };
    await send('Runtime.enable'); await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
    await send('Page.navigate', { url });
    await until('network demo', () => evaluate('!!window.networkDemo'));
    return { send, evaluate, snapshot: () => evaluate('window.networkDemo.snapshot()') };
  }
  const key = async (page, key, code, vk, type = 'press', modifiers = 0) => {
    await page.send('Page.bringToFront');
    if (type !== 'up') await page.send('Input.dispatchKeyEvent', { type: key === 'Enter' ? 'keyDown' : 'rawKeyDown', key, code, windowsVirtualKeyCode: vk, modifiers, ...(key === 'Enter' ? { text: '\r' } : {}) });
    if (type !== 'down') await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: vk, modifiers });
  };
  const enter = (p) => key(p, 'Enter', 'Enter', 13);
  const tabTo = async (page, id) => {
    await page.send('Page.bringToFront');
    for (let i = 0; i < 25; i++) { if (await page.evaluate('document.activeElement.id') === id) return; await key(page, 'Tab', 'Tab', 9); }
    throw new Error(`Keyboard could not reach ${id}`);
  };
  const text = (page, text) => page.send('Input.insertText', { text });
  const shot = async (page, name) => { const image = await page.send('Page.captureScreenshot', { format: 'png' }); writeFileSync(resolve(results, `${mode}-${name}.png`), Buffer.from(image.data, 'base64')); };
  const host = await open();
  await tabTo(host, 'nickname'); await text(host, 'Browser Ana'); await enter(host);
  await tabTo(host, 'create'); await enter(host);
  const hostLobby = await until('created lobby', async () => (await host.snapshot()).view.lobby);
  const code = hostLobby.roomCode;
  assert.equal((await host.snapshot()).view.dataSource, 'server');
  const guest = await open();
  await tabTo(guest, 'nickname'); await text(guest, 'Browser Bruno'); await enter(guest);
  await tabTo(guest, 'join'); await enter(guest);
  await tabTo(guest, 'room-code'); await text(guest, code === 'AAAAA' ? 'BBBBB' : 'AAAAA'); await enter(guest);
  await until('unknown room error', async () => (await guest.snapshot()).view.connection.error === 'roomNotFound');
  assert.match(await guest.evaluate("document.querySelector('[data-error]').textContent"), /Room not found/);
  await tabTo(guest, 'room-code'); await key(guest, 'a', 'KeyA', 65, 'press', 2); await text(guest, code); await enter(guest);
  await until('two real players', async () => (await host.snapshot()).view.lobby?.players.length === 2 && (await guest.snapshot()).view.lobby?.players.length === 2);
  pass('keyboard create, failed join recovery and real code join through existing lobby');
  await tabTo(guest, 'ready'); await enter(guest);
  await until('guest ready ACK', async () => (await guest.snapshot()).view.lobby.players.find((p) => p.isLocal).ready);
  await tabTo(host, 'ready'); await enter(host);
  await until('all ready ACK', async () => (await host.snapshot()).view.lobby.canStart);
  await shot(host, 'lobby');
  await tabTo(host, 'start'); await enter(host);
  await until('real chase', async () => (await host.snapshot()).view.phase === 'chase' && (await guest.snapshot()).view.phase === 'chase');
  pass('server-confirmed ready/start and shared countdown/intro/chase');
  const before = await host.snapshot(); const localId = before.view.localPlayer.id;
  assert.notEqual(localId, (await guest.snapshot()).view.localPlayer.id);
  const beforeZ = before.snapshot.players.find((p) => p.id === localId).pose.position.z;
  await tabTo(host, 'game-input');
  await key(host, 'ArrowUp', 'ArrowUp', 38, 'down'); await sleep(1000); await key(host, 'ArrowUp', 'ArrowUp', 38, 'up');
  await key(host, 'ArrowRight', 'ArrowRight', 39);
  await until('authoritative movement/input ACK', async () => { const s = await host.snapshot(); const p = s.snapshot.players.find((p) => p.id === localId); return p.pose.position.z > beforeZ + 1 && p.lastProcessedInputSequence > 0 && p.lastProcessedActionId > 0; });
  const common = await until('matching moving-player snapshots', async () => {
    const [h, g] = await Promise.all([host.snapshot(), guest.snapshot()]);
    return h.history.filter((s) => s.players.some((p) => p.id === localId && p.pose.position.z > beforeZ + 1 && p.lastProcessedActionId > 0)).reverse()
      .map((s) => [s, g.history.find((other) => other.match.tick === s.match.tick)]).find((pair) => pair[1]);
  });
  assert.deepEqual(common[0], common[1]);
  const guestId = (await guest.snapshot()).view.localPlayer.id;
  assert.deepEqual(common[0].players.find((p) => p.id === guestId).pose, before.snapshot.players.find((p) => p.id === guestId).pose);
  const h = await host.snapshot();
  pass('trusted arrow input moves only the authenticated player; matching server-tick snapshots', { matchedTick: common[0].match.tick, acknowledgedSequence: h.diagnostics.acknowledgedSequence, acknowledgedActionId: h.diagnostics.acknowledgedActionId });
  await shot(host, 'movement');
  await tabTo(guest, 'leave'); await enter(guest);
  await until('guest left', async () => (await guest.snapshot()).view.connection.state === 'idle');
  pass('keyboard leave clears the real session');
  for (const page of [guest, host]) {
    await page.evaluate('window.networkDemo.shutdown()');
    const s = await page.snapshot(); assert.equal(s.diagnostics.disposed, true); assert.equal(s.diagnostics.listeners, 0); assert.equal(s.keyboardActive, false); assert.equal(s.snapshot, null);
  }
  pass('unmount/dispose clears listeners, input and snapshots');
  assert.deepEqual(report.errors, []);
  report.ok = true;
} catch (error) { report.failure = error.stack ?? String(error); console.error(report.failure); process.exitCode = 1; }
finally { clearTimeout(timeout); await cleanup(); writeFileSync(resolve(results, `browser-${mode}.json`), JSON.stringify(report, null, 2) + '\n'); }
