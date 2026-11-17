// No added dependencies. Real Chromium/WebGL gate, with owned preview/evidence paths.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { delimiter, resolve } from 'node:path';
import { startPreview, previewUrl, cameraDir, root } from './preview.mjs';

const mode = process.argv.includes('--dev') ? 'dev' : 'built';
const evidence = process.env.CAMERA_EVIDENCE_DIR ? resolve(process.env.CAMERA_EVIDENCE_DIR) : resolve(root, 'test-results/camera');
mkdirSync(evidence, { recursive: true });
const report = { mode, url: previewUrl, dataSource: 'fixture', ok: false, browser: null, checks: [], errors: [] };
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(name, probe) {
  const end = Date.now() + 20000;
  while (Date.now() < end) { const value = await probe(); if (value) return value; await sleep(100); }
  throw new Error(`Timed out: ${name}`);
}
const pass = (name, details) => { report.checks.push({ name, details }); console.log(`PASS ${name}`); };
let closeServer, browser, profile, ws, send;
async function cleanup() {
  ws?.close();
  if (browser && browser.exitCode === null && browser.signalCode === null) {
    const exited = new Promise((resolve) => browser.once('exit', resolve));
    browser.kill('SIGTERM');
    await Promise.race([exited, sleep(2000)]);
    if (browser.exitCode === null && browser.signalCode === null) { browser.kill('SIGKILL'); await Promise.race([exited, sleep(1000)]); }
  }
  if (closeServer) await closeServer();
  if (profile) rmSync(profile, { recursive: true, force: true });
}
const timeout = setTimeout(() => { console.error('Camera browser acceptance exceeded 120 s'); void cleanup().finally(() => process.exit(1)); }, 120000);
try {
  closeServer = await startPreview(mode === 'dev');
  const executable = process.env.CHROME_PATH ?? (process.env.PATH ?? '').split(delimiter)
    .flatMap((dir) => ['google-chrome', 'chromium', 'chromium-browser', 'microsoft-edge'].map((name) => resolve(dir, name))).find(existsSync);
  assert.ok(executable, 'A real Chrome/Chromium is required; set CHROME_PATH');
  profile = mkdtempSync(resolve(cameraDir, '.browser-profile-'));
  browser = spawn(executable, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check',
    '--disable-extensions', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', ...(process.env.CI ? ['--no-sandbox'] : []), 'about:blank'], { stdio: 'ignore' });
  browser.on('error', (error) => report.errors.push(error.message));
  const port = await until('Chrome debug port', () => {
    if (browser.exitCode !== null) throw new Error(`Chrome exited ${browser.exitCode}`);
    const path = resolve(profile, 'DevToolsActivePort');
    return existsSync(path) && readFileSync(path, 'utf8').split('\n')[0];
  });
  report.browser = (await (await fetch(`http://127.0.0.1:${port}/json/version`)).json()).Browser;
  const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.addEventListener('open', resolve, { once: true }); ws.addEventListener('error', reject, { once: true }); });
  const pending = new Map();
  let id = 0;
  send = (method, params = {}) => new Promise((resolve, reject) => {
    const request = ++id;
    const timer = setTimeout(() => { pending.delete(request); reject(new Error(`CDP timeout: ${method}`)); }, 10000);
    pending.set(request, (message) => { clearTimeout(timer); message.error ? reject(new Error(message.error.message)) : resolve(message.result); });
    ws.send(JSON.stringify({ id: request, method, params }));
  });
  ws.addEventListener('message', (event) => {
    const message = JSON.parse(String(event.data));
    if (message.id) { pending.get(message.id)?.(message); pending.delete(message.id); return; }
    const p = message.params ?? {};
    const error = message.method === 'Runtime.exceptionThrown' ? p.exceptionDetails?.exception?.description ?? p.exceptionDetails?.text
      : message.method === 'Log.entryAdded' && p.entry?.level === 'error' ? p.entry.text
      : message.method === 'Runtime.consoleAPICalled' && ['error', 'assert'].includes(p.type) ? p.args.map((a) => a.value ?? a.description).join(' ') : null;
    if (error) report.errors.push(error);
  });
  const evaluate = async (expression) => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
    return result.result?.value;
  };
  const snapshot = () => evaluate('window.cameraFixture.snapshot()');
  const seek = (scenario, seconds, fps) => evaluate(`window.cameraFixture.seek(${JSON.stringify(scenario)},${seconds},${fps})`);
  const screenshot = async (name) => {
    await sleep(100);
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(resolve(evidence, `${mode}-${name}.png`), Buffer.from(shot.data, 'base64'));
  };
  const key = async (key, code, vk) => {
    await send('Input.dispatchKeyEvent', { type: key === 'Enter' ? 'keyDown' : 'rawKeyDown', key, code, windowsVirtualKeyCode: vk, ...(key === 'Enter' ? { text: '\r' } : {}) });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: vk });
  };
  await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable');
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `
    window.cameraPreferenceListeners = 0;
    const originalMatchMedia = window.matchMedia.bind(window);
    window.matchMedia = (query) => {
      const media = originalMatchMedia(query);
      if (query !== '(prefers-reduced-motion: reduce)') return media;
      const add = media.addEventListener.bind(media), remove = media.removeEventListener.bind(media), listeners = new Set();
      media.addEventListener = (type, fn, options) => { if (type === 'change' && !listeners.has(fn)) { listeners.add(fn); window.cameraPreferenceListeners++; } add(type, fn, options); };
      media.removeEventListener = (type, fn, options) => { if (type === 'change' && listeners.delete(fn)) window.cameraPreferenceListeners--; remove(type, fn, options); };
      return media;
    };` });
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
  await send('Page.navigate', { url: `${previewUrl}?autoplay=0` });
  await until('fixture initialized', () => evaluate('!!window.cameraFixture'));
  const initial = await snapshot();
  assert.equal(initial.dataSource, 'fixture');
  assert.equal(initial.cameraInputs, false);
  await sleep(100);
  assert.ok((await snapshot()).frames > initial.frames);
  pass('real Babylon render loop runs with no camera input bindings', { frames: (await snapshot()).frames });

  // Trusted keyboard events traverse controls and start playback, without mouse use.
  await key('Tab', 'Tab', 9);
  assert.equal(await evaluate('document.activeElement.id'), 'scenario');
  await key('Tab', 'Tab', 9);
  assert.equal(await evaluate('document.activeElement.id'), 'play');
  await key('Enter', 'Enter', 13);
  assert.equal((await snapshot()).playing, true);
  await key('Enter', 'Enter', 13);
  assert.equal((await snapshot()).playing, false);
  pass('keyboard-only navigation and playback', true);

  for (const scenario of ['turn', 'slope', 'wall', 'narrow']) {
    const samples = [];
    for (const fps of [30, 60, 144]) {
      const sample = await seek(scenario, 6, fps);
      assert.equal(sample.collisions, 0, `${scenario} at ${fps} FPS must maintain a clear camera volume/sight line`);
      assert.equal(sample.cameraRotation[2], 0, 'no camera roll');
      assert.equal(sample.fov, 0.9, 'no FOV pulses');
      samples.push({ fps, position: sample.frame.position, yaw: sample.frame.yaw });
    }
    for (const sample of samples.slice(1)) {
      const delta = Math.hypot(...['x', 'y', 'z'].map((axis) => sample.position[axis] - samples[0].position[axis]));
      assert.ok(delta < 0.08, `${scenario}: frame-rate drift ${delta} m`);
    }
    pass(`${scenario}: 30/60/144 FPS, no wall penetration, level horizon, fixed FOV`, samples);
    await seek(scenario, scenario === 'wall' ? 2.5 : scenario === 'turn' ? 2 : 4, 60);
    if (scenario === 'wall') assert.equal((await snapshot()).frame.obstructed, true);
    if (mode === 'built') await screenshot(scenario);
  }

  await seek('turn', 0, 60);
  const beforePointer = (await snapshot()).frame;
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 500, y: 350, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 700, y: 450, button: 'left', buttons: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 700, y: 450, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 700, y: 450, deltaX: 0, deltaY: 100 });
  assert.deepEqual((await snapshot()).frame, beforePointer);
  pass('drag and wheel never control the camera', true);

  const standard = await seek('turn', 2, 60);
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await until('OS reduced-motion change', async () => (await snapshot()).frame.reducedMotion);
  const reduced = await seek('turn', 2, 60);
  assert.ok(reduced.frame.yaw < standard.frame.yaw, 'reduced motion restrains the turn');
  assert.equal(reduced.collisions, 0);
  pass('live OS preference and restrained reduced-motion turn', { standardYaw: standard.frame.yaw, reducedYaw: reduced.frame.yaw });
  if (mode === 'built') await screenshot('reduced');
  await evaluate("document.getElementById('motion').value='standard'; document.getElementById('motion').dispatchEvent(new Event('change'))");
  await until('explicit override', async () => !(await snapshot()).frame.reducedMotion);
  await evaluate("document.getElementById('motion').value='system'; document.getElementById('motion').dispatchEvent(new Event('change'))");
  await until('system preference restored', async () => (await snapshot()).frame.reducedMotion);
  pass('user setting overrides OS and can return to system preference', true);

  const baseline = await snapshot();
  for (let i = 0; i < 4; i++) {
    const current = await evaluate('window.cameraFixture.remount()');
    for (const field of ['cameraCount', 'meshes', 'materials', 'textures']) assert.equal(current[field], baseline[field], field);
    assert.equal(await evaluate('window.cameraPreferenceListeners'), 1);
  }
  await evaluate('window.cameraFixture.shutdown()');
  const final = await snapshot();
  for (const field of ['cameraCount', 'meshes', 'materials', 'textures']) assert.equal(final[field], 0, field);
  assert.equal(await evaluate('window.cameraPreferenceListeners'), 0);
  await sleep(100);
  assert.equal((await snapshot()).frames, final.frames, 'render loop stops');
  assert.deepEqual(report.errors, []);
  pass('four remounts and shutdown release cameras, media listeners, scene resources and render loop', true);
  report.ok = true;
} catch (error) {
  report.failure = error instanceof Error ? error.stack : String(error);
  console.error(report.failure);
  process.exitCode = 1;
} finally {
  clearTimeout(timeout);
  await cleanup();
  writeFileSync(resolve(evidence, `browser-${mode}.json`), `${JSON.stringify(report, null, 2)}\n`);
}
