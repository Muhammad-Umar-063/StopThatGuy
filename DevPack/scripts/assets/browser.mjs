// Standalone T008 browser gate. No new browser dependency or bootstrap edits.
// Default checks a production bundle; --dev checks Vite source serving.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, resolve, delimiter } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocket } from 'node:http';
import { build, createServer, preview } from 'vite';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const mode = process.argv.includes('--dev') ? 'dev' : 'built';
const results = resolve(root, process.env.ASSET_EVIDENCE_DIR ?? 'test-results/assets');
const outDir = resolve(root, 'scripts/assets/.demo-dist');
const assetBrowserPort = Number(process.env.ASSET_BROWSER_PORT ?? 5208);
assert.ok(Number.isInteger(assetBrowserPort) && assetBrowserPort > 0 && assetBrowserPort <= 65535, 'ASSET_BROWSER_PORT must be a valid TCP port');
const url = `http://127.0.0.1:${assetBrowserPort}/src/render/assets/demo.html?autoload=0`;
const report = { mode, url, ok: false, browser: null, steps: [], errors: [], warnings: [] };
mkdirSync(results, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(name, probe, timeout = 20_000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const value = await probe();
    if (value) return value;
    await sleep(100);
  }
  throw new Error(`Timed out: ${name}`);
}
const step = (name, evidence) => { report.steps.push({ name, evidence }); console.log(`PASS ${name}`); };
let server;
let browser;
let ws;
let profile;
let send;
let intentionalFailure = false;
const expectedErrors = [];
const timeout = setTimeout(() => { console.error('Asset browser gate exceeded 120 s'); void cleanup().finally(() => process.exit(1)); }, 120_000);
async function cleanup() {
  ws?.close();
  if (browser?.pid && browser.exitCode === null && browser.signalCode === null) {
    const closed = new Promise((r) => browser.once('exit', r));
    browser.kill('SIGTERM');
    await Promise.race([closed, sleep(2000)]);
    if (browser.exitCode === null && browser.signalCode === null) { browser.kill('SIGKILL'); await Promise.race([closed, sleep(1000)]); }
  }
  if (server?.close) await server.close();
  else if (server?.httpServer) await new Promise((r) => server.httpServer.close(r));
  if (profile) rmSync(profile, { recursive: true, force: true });
}
try {
  const options = { configFile: resolve(root, 'apps/client/vite.config.ts'), root: resolve(root, 'apps/client') };
  if (mode === 'built') {
    await build({ ...options, build: { outDir, emptyOutDir: true, rollupOptions: { input: resolve(root, 'apps/client/src/render/assets/demo.html') } } });
    server = await preview({ ...options, build: { outDir }, preview: { host: '127.0.0.1', port: assetBrowserPort, strictPort: true } });
  } else {
    server = await createServer({ ...options, server: { host: '127.0.0.1', port: assetBrowserPort, strictPort: true } });
    await server.listen();
  }
  const browserPath = process.env.CHROME_PATH ?? (process.env.PATH ?? '').split(delimiter)
    .flatMap((dir) => ['google-chrome', 'chromium', 'chromium-browser', 'microsoft-edge'].map((name) => resolve(dir, name))).find(existsSync);
  assert.ok(browserPath, 'Install Chrome/Chromium or set CHROME_PATH; browser checks cannot be skipped');
  profile = mkdtempSync(resolve(root, 'scripts/assets/.browser-profile-'));
  browser = spawn(browserPath, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    ...(process.env.CI ? ['--no-sandbox'] : []), 'about:blank'], { stdio: 'ignore' });
  browser.on('error', (error) => report.errors.push(error.message));
  const port = await until('Chrome debug port', () => {
    if (browser.exitCode !== null) throw new Error(`Chrome exited ${browser.exitCode}`);
    const path = resolve(profile, 'DevToolsActivePort');
    return existsSync(path) ? readFileSync(path, 'utf8').split('\n')[0] : null;
  });
  const version = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
  report.browser = version.Browser;
  const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.addEventListener('open', r, { once: true }); ws.addEventListener('error', j, { once: true }); });
  const pending = new Map();
  let nextId = 0;
  let intercept = null;
  send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++nextId;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 10_000);
    pending.set(id, (message) => { clearTimeout(timer); message.error ? reject(new Error(message.error.message)) : resolve(message.result); });
    ws.send(JSON.stringify({ id, method, params }));
  });
  ws.addEventListener('message', (event) => {
    const m = JSON.parse(String(event.data));
    if (m.id) { pending.get(m.id)?.(m); pending.delete(m.id); return; }
    const p = m.params ?? {};
    const error = m.method === 'Runtime.exceptionThrown' ? p.exceptionDetails?.exception?.description ?? p.exceptionDetails?.text
      : m.method === 'Log.entryAdded' && p.entry?.level === 'error' ? p.entry.text
      : m.method === 'Runtime.consoleAPICalled' && ['error', 'assert'].includes(p.type) ? p.args.map((a) => a.value ?? a.description).join(' ') : null;
    if (error) (intentionalFailure ? expectedErrors : report.errors).push(error);
    if (m.method === 'Log.entryAdded' && p.entry?.level === 'warning') report.warnings.push(p.entry.text);
    if (m.method === 'Fetch.requestPaused') {
      const action = intercept === '404'
        ? send('Fetch.fulfillRequest', { requestId: p.requestId, responseCode: 404, body: Buffer.from('not found').toString('base64') })
        : intercept === 'invalid'
          ? send('Fetch.fulfillRequest', { requestId: p.requestId, responseCode: 200, body: Buffer.from('invalid GLB').toString('base64') })
          : send('Fetch.continueRequest', { requestId: p.requestId });
      void action.catch((e) => report.errors.push(e.message));
    }
  });
  const evaluate = async (expression) => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
    return result.result?.value;
  };
  const snapshot = () => evaluate('window.__assetDemo.snapshot()');
  const click = (id) => evaluate(`document.getElementById(${JSON.stringify(id)}).click()`);
  const state = async (wanted) => until(`asset state ${wanted}`, async () => {
    const actual = await evaluate('document.documentElement.dataset.assetState');
    if (actual === 'failed' && wanted === 'ready') throw new Error(await evaluate('document.getElementById("status").textContent'));
    return actual === wanted;
  });
  const screenshot = async (name) => {
    await sleep(200);
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(resolve(results, `${mode}-${name}.png`), Buffer.from(shot.data, 'base64'));
  };
  await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url });
  await state('unloaded');
  const loaderRequested = () => evaluate("performance.getEntriesByType('resource').some(r => r.name.includes('gltfSupport'))");
  assert.equal(await loaderRequested(), false, 'loader chunk must not be fetched at startup');
  await click('reload');
  await state('ready');
  assert.equal(await loaderRequested(), true, 'asset request must demand-load the official loader adapter');
  step('glTF loader chunk requested only after loading an asset', true);
  const initial = await snapshot();
  assert.equal(initial.inspection.ok, true);
  assert.equal(initial.inspection.triangles, 128);
  assert.equal(initial.inspection.materials, 3);
  step('real GLB loads with correct metre bounds, origin and axes', initial);
  await screenshot('perspective');
  await sleep(200);
  assert.ok((await snapshot()).frames > initial.frames, 'render loop must advance');
  await click('yaw');
  const rotated = await snapshot();
  assert.equal(rotated.inspection.ok, true);
  assert.ok(Math.abs(rotated.inspection.landmarksM.forward[0] - 1) < 1e-5);
  step('positive 90 degree yaw points forward toward +X', rotated.inspection);
  await click('camera'); await screenshot('yaw-top');
  await click('dispose');
  assert.deepEqual((await snapshot()).counts, initial.baseline);
  assert.equal((await snapshot()).sharedSceneTextures, 1);
  for (let i = 0; i < 3; i++) {
    await click('reload'); await state('ready'); await click('dispose');
    assert.deepEqual((await snapshot()).counts, initial.baseline);
    assert.equal((await snapshot()).totalTextures, 1, 'only the scene BRDF texture may persist');
  }
  step('unload and three reload cycles return resources to baseline', initial.baseline);
  await send('Fetch.enable', { patterns: [{ urlPattern: '*assets/dev/axis-marker.glb' }] });
  for (const mode of ['404', 'invalid']) {
    intercept = mode; intentionalFailure = true;
    await click('reload'); await state('failed');
    const failed = await snapshot();
    assert.ok(failed.failure.includes('dev.axis-marker'));
    assert.deepEqual(failed.counts, initial.baseline);
    await screenshot(`error-${mode}`);
    step(`visible ${mode} failure has asset ID and no leaked scene resources`, failed.failure);
    intercept = null;
    await click('reload'); await state('ready');
    await sleep(100); intentionalFailure = false;
  }
  await send('Fetch.disable');
  step('retry after each failure succeeds', { expectedErrors });
  await evaluate('window.__assetDemo.shutdown()');
  const final = await snapshot();
  assert.equal(final.counts.meshes, 0);
  assert.equal(final.counts.materials, 0);
  assert.equal(final.counts.textures, 0);
  assert.equal(final.totalTextures, 0, 'scene disposal must also free the shared BRDF texture');
  step('page shutdown disposes renderer and scene resources', final.counts);
  assert.deepEqual(report.errors, [], 'unexpected browser errors');
  report.ok = true;
} catch (error) {
  report.failure = error instanceof Error ? error.message : String(error);
  console.error(report.failure);
  if (send) {
    try {
      const shot = await send('Page.captureScreenshot', { format: 'png' });
      writeFileSync(resolve(results, `${mode}-failure.png`), Buffer.from(shot.data, 'base64'));
    } catch { /* original failure remains authoritative */ }
  }
  process.exitCode = 1;
} finally {
  clearTimeout(timeout);
  await cleanup();
  writeFileSync(resolve(results, `browser-${mode}.json`), `${JSON.stringify(report, null, 2)}\n`);
}
