import test from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import { randomUUID } from 'node:crypto';
import { setTimeout as pause } from 'node:timers/promises';
import { registerAndroid } from '../src/android.ts';

test('continuous frames fan out to viewers; no per-frame command queue and viewers release subscriptions', async () => {
  const app = Fastify(); registerAndroid(app);
  await app.listen({ host: '127.0.0.1', port: 0 });
  const address = app.server.address(); if (!address || typeof address === 'string') throw new Error('No test listener');
  const base = `http://127.0.0.1:${address.port}`, session = randomUUID();
  const post = (url: string, payload: Record<string, unknown>) => app.inject({ method: 'POST', url, payload });
  const controllers = [new AbortController(), new AbortController()];
  const readers: ReadableStreamDefaultReader<Uint8Array>[] = [];
  try {
    await post('/internal/android/status', { session, status: { sdk: { ready: true, path: '/sdk' }, avds: ['Pixel'], devices: [{ serial: 'emulator-5554', state: 'device', booted: false, managed: true, avd: 'Pixel', error: '' }], issues: [], appium: { reachable: false, ready: false } } });
    for (const controller of controllers) {
      const response = await fetch(base + '/api/android/devices/emulator-5554/stream', { signal: controller.signal });
      assert.equal(response.status, 200); assert.match(response.headers.get('content-type') || '', /text\/event-stream/);
      const reader = response.body!.getReader(); readers.push(reader);
      assert.match(new TextDecoder().decode((await reader.read()).value), /event: connected/);
    }
    const claim = (await post('/internal/android/claim', { session })).json();
    assert.deepEqual(claim, { action: 'stream', serials: ['emulator-5554'] });
    assert.equal((await app.inject('/api/android/status')).json().queued, 0);
    const starting = post('/api/android/start', { avd: 'Pixel', count: 1 });
    void starting.then(() => {}); await pause(10);
    const priority = (await post('/internal/android/claim', { session })).json();
    assert.equal(priority.action, 'start', 'device commands take priority over streaming frames');
    await post('/internal/android/result/' + priority.id, { session, result: { started: ['emulator-5556'] } });
    assert.equal((await starting).statusCode, 200);
    const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
    assert.equal((await post('/internal/android/frame', { session: randomUUID(), serial: 'emulator-5554', png })).statusCode, 409);
    assert.equal((await post('/internal/android/frame', { session, serial: 'emulator-5554', png: 'invalid' })).statusCode, 400);
    for (let frame = 0; frame < 2; frame++) {
      assert.equal((await post('/internal/android/frame', { session, serial: 'emulator-5554', png })).statusCode, 200);
      for (const reader of readers) assert.match(new TextDecoder().decode((await reader.read()).value), /event: frame\ndata: .*capturedAt/);
    }
    for (const controller of controllers) controller.abort();
    await pause(50);
    assert.equal((await post('/internal/android/claim', { session })).json(), null);
    const missing = await app.inject('/api/android/devices/emulator-9999/stream');
    assert.equal(missing.statusCode, 503);
  } finally { for (const controller of controllers) controller.abort(); await app.close(); }
});
