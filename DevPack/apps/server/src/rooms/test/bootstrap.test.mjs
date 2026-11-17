import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { test } from 'node:test';
import { Client } from '@colyseus/sdk';
import { FIRST_STREET_WORLD } from '@stopthatguy/world';
import { DEFAULT_TUNING } from '@stopthatguy/shared';
import { checkSnapshotConsistency } from '@stopthatguy/test-support';

// Exercises the actual compiled application entry point, not a test-composed room.
test('production bootstrap serves the authored world to independent real clients', { timeout: 20000 }, async () => {
  const probe = createServer();
  probe.listen(0, '127.0.0.1');
  await once(probe, 'listening');
  const port = probe.address().port;
  await new Promise((resolve) => probe.close(resolve));
  const endpoint = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, [fileURLToPath(new URL('../../../dist/bootstrap/main.js', import.meta.url))], {
    env: { ...process.env, PORT: String(port) }, stdio: 'ignore',
  });
  let spawnError;
  child.on('error', (error) => { spawnError = error; });
  const peers = [];
  const snapshot = (room) => JSON.parse(room.state.snapshotJson);
  async function until(probe, name) {
    const deadline = Date.now() + 6000;
    while (Date.now() < deadline) {
      if (spawnError) throw spawnError;
      assert.equal(child.exitCode, null, 'production server exited unexpectedly');
      const value = await probe();
      if (value) return value;
      await delay(25);
    }
    assert.fail(`Timed out: ${name}`);
  }
  try {
    const health = await until(async () => {
      try { const response = await fetch(`${endpoint}/health`); return response.ok ? response.json() : null; }
      catch { return null; }
    }, 'health');
    assert.equal(health.worldVersion, FIRST_STREET_WORLD.worldVersion);
    const versions = { protocolVersion: health.protocolVersion, configVersion: health.configVersion, worldVersion: health.worldVersion };
    let roomCode;
    for (let i = 0; i < 2; i++) {
      const response = await fetch(`${endpoint}/rooms/${i ? 'join' : 'create'}`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify(i ? { nickname: 'Guest', roomCode, versions } : { nickname: 'Host', mode: 'normal', versions }),
      });
      assert.equal(response.status, 200);
      const body = await response.json();
      roomCode = body.roomCode;
      const room = await new Client(endpoint).consumeSeatReservation(body.reservation);
      room.reconnection.enabled = false;
      room.onMessage('message', () => {});
      peers.push(room);
    }
    await until(() => peers.every((p) => p.state?.snapshotJson && snapshot(p).players.length === 2), 'two-player lobby');
    assert.notEqual(peers[0].sessionId, peers[1].sessionId);
    for (const peer of peers) peer.send('command', { type: 'setReady', ready: true });
    await until(() => snapshot(peers[0]).players.every((p) => p.ready), 'ready');
    peers[0].send('command', { type: 'startMatch' });
    await until(() => peers.every((p) => snapshot(p).match.phase === 'countdown'), 'countdown');
    for (const peer of peers) {
      const state = snapshot(peer);
      assert.equal(state.match.versions.worldVersion, FIRST_STREET_WORLD.worldVersion);
      assert.deepEqual(checkSnapshotConsistency(state, FIRST_STREET_WORLD, DEFAULT_TUNING), []);
      assert.ok(state.players.every((p) => p.route !== null), 'authored spawns enter simulation');
    }
  } finally {
    await Promise.allSettled(peers.map((p) => p.leave()));
    if (child.exitCode === null && child.signalCode === null) {
      const exited = once(child, 'exit');
      child.kill('SIGTERM');
      await Promise.race([exited, delay(2000)]);
      if (child.exitCode === null && child.signalCode === null) { child.kill('SIGKILL'); await exited; }
    }
  }
});
