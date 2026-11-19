// All Chrome runs must be wrapped in batch4/run-browser.sh. Explicit fixture evidence only.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { delimiter, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer, preview } from 'vite';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../../..');
const results = resolve(root, 'test-results/hud'); mkdirSync(results, { recursive: true });
const dev = process.argv.includes('--dev'), mode = dev ? 'dev' : 'built';
const url = 'http://127.0.0.1:5218/src/ui/hud/browser/demo.html';
const report = { mode, url, dataSource: 'fixture', ok: false, checks: [], errors: [] };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const pass = (name, details = true) => { report.checks.push({ name, details }); console.log(`PASS ${name}`); };
const children = []; let vite, profile, socket;
async function until(name, probe) {
  const end = Date.now() + 15000;
  while (Date.now() < end) { const value = await probe(); if (value) return value; await sleep(40); }
  throw new Error(`Timed out: ${name}`);
}
async function cleanup() {
  socket?.close();
  for (const child of children) {
    if (child.exitCode !== null || child.signalCode !== null) continue;
    const ended = new Promise(r => child.once('exit', r)); child.kill('SIGTERM');
    await Promise.race([ended, sleep(2000)]);
    if (child.exitCode === null && child.signalCode === null) { child.kill('SIGKILL'); await Promise.race([ended, sleep(1000)]); }
  }
  if (vite?.close) await vite.close(); else if (vite) await new Promise(r => vite.httpServer.close(r));
  if (profile) rmSync(profile, { recursive: true, force: true });
}
const timeout = setTimeout(() => { console.error('HUD acceptance exceeded 90 seconds'); void cleanup().finally(() => process.exit(1)); }, 90000);
try {
  const options = { configFile: resolve(root, 'apps/client/vite.config.ts'), root: resolve(root, 'apps/client') };
  if (dev) { vite = await createServer({ ...options, server: { host: '127.0.0.1', port: 5218, strictPort: true } }); await vite.listen(); }
  else vite = await preview({ ...options, preview: { host: '127.0.0.1', port: 5218, strictPort: true } });
  const executable = process.env.CHROME_PATH ?? (process.env.PATH ?? '').split(delimiter).flatMap(dir => ['google-chrome', 'chromium', 'chromium-browser'].map(name => resolve(dir, name))).find(existsSync);
  assert.ok(executable, 'Chrome/Chromium required'); profile = mkdtempSync(resolve(results, '.chrome-'));
  const chrome = spawn(executable, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', '--disable-extensions', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', ...(process.env.CI ? ['--no-sandbox'] : []), 'about:blank'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
  children.push(chrome); let chromeOutput = ''; chrome.stdout.on('data', c => chromeOutput += c); chrome.stderr.on('data', c => chromeOutput += c);
  const port = await until('Chrome', () => { if (chrome.exitCode !== null) throw new Error(chromeOutput); const path = resolve(profile, 'DevToolsActivePort'); return existsSync(path) && readFileSync(path, 'utf8').split('\n')[0]; });
  report.browser = (await (await fetch(`http://127.0.0.1:${port}/json/version`)).json()).Browser;
  const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
  socket = new WebSocket(target.webSocketDebuggerUrl); await new Promise((r, j) => { socket.addEventListener('open', r, { once: true }); socket.addEventListener('error', j, { once: true }); });
  let sequence = 0; const pending = new Map();
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence, timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 10000);
    pending.set(id, m => { clearTimeout(timer); m.error ? reject(new Error(m.error.message)) : resolve(m.result); }); socket.send(JSON.stringify({ id, method, params }));
  });
  socket.addEventListener('message', event => {
    const m = JSON.parse(String(event.data)); if (m.id) { pending.get(m.id)?.(m); pending.delete(m.id); return; }
    if (m.method === 'Runtime.exceptionThrown') report.errors.push(m.params.exceptionDetails?.exception?.description ?? m.params.exceptionDetails?.text);
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') report.errors.push(m.params.args.map(a => a.value ?? a.description).join(' '));
  });
  const evaluate = async expression => { const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text); return r.result?.value; };
  const read = name => evaluate(`document.querySelector('.stg-hud [data-${name}]').textContent`);
  const scenario = name => evaluate(`window.hudFixture.scenario(${JSON.stringify(name)})`);
  const diagnostics = () => evaluate('window.hudFixture.diagnostics()');
  const key = async (key, code, vk, type = 'press', modifiers = 0) => {
    if (type !== 'up') await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key, code, windowsVirtualKeyCode: vk, modifiers });
    if (type !== 'down') await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: vk, modifiers });
  };
  const tabTo = async id => { for (let n = 0; n < 15; n++) { if (await evaluate('document.activeElement.id') === id) return; await key('Tab', 'Tab', 9); } throw new Error(`Unreachable by Tab: ${id}`); };
  const viewport = (width, height) => send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
  const shot = async name => { const r = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(resolve(results, `${mode}-${name}.png`), Buffer.from(r.data, 'base64')); };
  await send('Runtime.enable'); await send('Page.enable');
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `
    window.mediaCounts = { added: 0, removed: 0 }; const nativeMatch = window.matchMedia.bind(window);
    window.matchMedia = query => { const media = nativeMatch(query); const add = media.addEventListener.bind(media), remove = media.removeEventListener.bind(media);
      media.addEventListener = (...args) => { if(args[0] === 'change') window.mediaCounts.added++; return add(...args); };
      media.removeEventListener = (...args) => { if(args[0] === 'change') window.mediaCounts.removed++; return remove(...args); }; return media; };
  ` });
  await viewport(1280, 720); await send('Page.navigate', { url }); await until('HUD', () => evaluate('!!window.hudFixture')); await send('Page.bringToFront');
  assert.match(await read('fixture'), /Fixture.*not live gameplay/); assert.equal(await read('timer'), '3:38'); assert.equal(await read('stamina-text'), '72%');
  await tabTo('play-surface'); await key('ArrowUp', 'ArrowUp', 38, 'down'); assert.equal((await diagnostics()).held.forwardHeld, true); await key('ArrowUp', 'ArrowUp', 38, 'up');
  await key('ArrowLeft', 'ArrowLeft', 37); await key('ArrowRight', 'ArrowRight', 39); await key('Escape', 'Escape', 27);
  const input = await diagnostics(); assert.deepEqual(input.actions.map(a => a.kind), ['left', 'right']); assert.equal(input.menuCount, 1); assert.equal(input.held.forwardHeld, false);
  pass('trusted arrows/Escape reach existing keyboard controller without HUD interception');
  await tabTo('note'); await key('End', 'End', 35); await key('ArrowLeft', 'ArrowLeft', 37); await send('Input.insertText', { text: '!' });
  assert.equal(await evaluate('document.querySelector("#note").value'), 'Lisbo!n'); assert.equal((await diagnostics()).actions.length, 2);
  await sleep(450);
  await evaluate(`window.savedHud = document.querySelector('.stg-hud'); window.savedTimer = document.querySelector('[data-timer]'); window.announcementChanges = 0; window.feedbackObserver = new MutationObserver(() => window.announcementChanges++); window.feedbackObserver.observe(document.querySelector('[data-announcement]'), { childList: true, subtree: true, characterData: true }); window.hudFixture.rapid();`);
  await sleep(450);
  assert.equal(await evaluate('document.activeElement.id'), 'note'); assert.equal(await evaluate('document.querySelector("#note").selectionStart'), 6);
  assert.equal(await evaluate("window.savedHud === document.querySelector('.stg-hud') && window.savedTimer === document.querySelector('[data-timer]')"), true);
  assert.equal(await evaluate('window.announcementChanges'), 0);
  pass('300 rapid snapshots preserve text selection, HUD nodes and quiet timer/stamina announcements');
  await evaluate(`{ const v = window.hudFixture.getView(); v.messages = [{ id: 'repeat-1', kind: 'warning', text: 'Capture rejected' }]; window.hudFixture.setView(v); }`); await sleep(450);
  const first = await evaluate('window.announcementChanges');
  await evaluate(`{ const v = window.hudFixture.getView(); v.messages[0].id = 'repeat-2'; window.hudFixture.setView(v); }`); await sleep(450);
  assert.ok(await evaluate('window.announcementChanges') > first); assert.match(await read('announcement'), /Capture rejected/);
  pass('distinct event IDs reannounce identical essential feedback without per-tick repetition');
  await scenario('turn'); assert.equal(await read('left'), 'Turn left'); assert.equal(await read('right'), 'Change lane right'); assert.match(await read('turn-label'), /Left: Rua do Banco/); assert.match(await read('robber'), /Ahead left/); assert.equal(await read('visibility'), 'Out of sight');
  await shot('wide-turn');
  for (const [name, phase, timer] of [['countdown', 'Get ready', '0:03'], ['intro', 'Robbery in progress', '0:08'], ['expired', 'Catch the robber', '0:00']]) {
    await scenario(name); assert.equal(await read('phase'), phase); assert.equal(await read('timer'), timer);
    if (name !== 'expired') assert.equal(await read('action-state'), 'Actions inactive');
  }
  assert.equal(await read('stamina-text'), '0%'); assert.match(await read('time-hint'), /Waiting for server/); assert.equal(await read('outcome'), '');
  await evaluate(`{ const v = window.hudFixture.getView(); v.localPlayer.staminaFraction = 4; v.timer.remainingMs = -500; window.hudFixture.setView(v); }`); assert.equal(await read('stamina-text'), '100%'); assert.equal(await read('timer'), '0:00');
  await scenario('unavailable'); assert.equal(await read('left'), 'Cue unavailable'); assert.equal(await read('robber'), 'Robber cue unavailable'); assert.equal(await read('visibility'), 'Visibility unavailable');
  await scenario('results'); assert.match(await read('outcome'), /caught the robber/); assert.equal(await read('action-state'), 'Actions inactive'); assert.equal(await read('timer'), '—:—');
  await scenario('disconnected'); assert.match(await read('phase'), /Connection lost/); assert.equal(await read('stamina-text'), 'Unavailable'); assert.equal(await read('robber'), 'Robber cue unavailable');
  pass('countdown/intro/chase/results/disconnect, unavailable cues and clamped/expired values');
  await scenario('chase');
  await evaluate(`{ const v = window.hudFixture.getView(); v.messages = [{ id: 'unsafe', kind: 'error', text: '<img src=x onerror="window.injected=true">' }]; v.actions.turnLabel = '<script>window.injected=true</script>'; v.connection.error = 'roomNotFound'; window.hudFixture.setView(v); }`);
  assert.match(await read('messages'), /<img/); assert.equal(await evaluate("!!window.injected || !!document.querySelector('.stg-hud img, .stg-hud script')"), false); assert.match(await read('error'), /Room not found/);
  pass('error mapping and external labels/messages are safe text');
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] }); await until('OS reduced motion', () => evaluate('document.querySelector(".stg-hud").dataset.reducedMotion === "true"'));
  await tabTo('reduced'); await key(' ', 'Space', 32);
  assert.equal(await evaluate('document.querySelector("#reduced").getAttribute("aria-pressed")'), 'true');
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
  assert.equal(await evaluate('document.querySelector(".stg-hud").dataset.reducedMotion'), 'true');
  assert.equal(await evaluate(`Array.from(document.querySelectorAll('.stg-hud, .stg-hud *')).every(e => { const s = getComputedStyle(e); return s.animationName === 'none' && s.transitionDuration === '0s'; })`), true);
  pass('OS and user reduced-motion settings; no HUD animation or interpolation');
  for (const [width, height] of [[1280, 720], [844, 390], [640, 360]]) {
    await viewport(width, height); await scenario('wanted');
    const bounds = await evaluate(`({ width: innerWidth, scroll: document.documentElement.scrollWidth, panels: Array.from(document.querySelectorAll('.hud-plaque')).map(e => { const r = e.getBoundingClientRect(); return { x:r.x,y:r.y,right:r.right,bottom:r.bottom }; }) })`);
    assert.ok(bounds.scroll <= width, `horizontal overflow ${width}`);
    for (const p of bounds.panels) assert.ok(p.x >= 0 && p.right <= width && p.bottom > p.y && p.bottom <= height, 'panel must remain inside the viewport');
    for (let i = 0; i < bounds.panels.length; i++) for (let j = i + 1; j < bounds.panels.length; j++) { const a = bounds.panels[i], b = bounds.panels[j]; assert.ok(a.right <= b.x || b.right <= a.x || a.bottom <= b.y || b.bottom <= a.y, 'HUD panels must not overlap'); }
    await tabTo('play-surface'); assert.equal(await evaluate('document.activeElement.id'), 'play-surface');
    await shot(`${width}x${height}-wanted`); pass(`readable nonoverlapping landscape layout ${width}x${height}`, bounds);
  }
  await scenario('chase'); await evaluate('window.feedbackObserver.disconnect(); for (let n=0; n<8; n++) window.hudFixture.remount()');
  assert.equal((await diagnostics()).listeners, 1); assert.equal(await evaluate('document.querySelectorAll(".stg-hud").length'), 1);
  assert.equal(await evaluate('window.mediaCounts.added - window.mediaCounts.removed'), 1);
  await scenario('wanted'); await evaluate('window.hudFixture.unmount(); window.hudFixture.unmount()'); await sleep(450);
  assert.equal((await diagnostics()).listeners, 0); assert.equal(await evaluate('document.querySelectorAll(".stg-hud").length'), 0); assert.equal(await evaluate('window.mediaCounts.added - window.mediaCounts.removed'), 0);
  assert.equal((await diagnostics()).keyboardActive, true, 'HUD disposal does not own gameplay input');
  await evaluate('window.hudFixture.shutdown(); window.hudFixture.shutdown()');
  assert.equal((await diagnostics()).disposed, true); assert.equal((await diagnostics()).keyboardActive, false);
  pass('repeated mount/dispose removes HUD subscriptions/media listeners/pending feedback and leaves input ownership separate');
  assert.deepEqual(report.errors, []); report.ok = true;
} catch (e) { report.failure = e.stack ?? String(e); console.error(report.failure); process.exitCode = 1; }
finally { clearTimeout(timeout); await cleanup(); writeFileSync(resolve(results, `browser-${mode}.json`), JSON.stringify(report, null, 2) + '\n'); }
