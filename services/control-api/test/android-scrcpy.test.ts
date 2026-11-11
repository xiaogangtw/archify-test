import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import Fastify from 'fastify';
import WebSocket from 'ws';
import { registerAndroidScrcpy } from '../src/androidScrcpy.ts';
import { encodeRelayFrame } from '../../android/scrcpy-protocol.mjs';

test('persistent relay fences worker, origin, ownership, tabs and releases controls', { timeout: 15000 }, async () => {
  const app = Fastify({ forceCloseConnections: true });
  app.addHook('onRequest', async (req, reply) => { if (req.url.startsWith('/internal/') && req.headers.authorization !== 'Bearer test-only') return reply.header('Connection', 'close').code(401).send({ error: 'Unauthorized' }); });
  registerAndroidScrcpy(app, { session: () => 'current', fresh: () => true, available: serial => serial === 'emulator-5554', owns: (_serial, user) => user === 'alice' });
  const address = await app.listen({ host: '127.0.0.1', port: 0 }), base = address.replace('http:', 'ws:');
  const sockets: WebSocket[] = [];
  function connect(path: string, headers: Record<string, string> = {}) {
    const socket = new WebSocket(base + path, { headers }); sockets.push(socket); return socket;
  }
  const route = '/api/android/devices/emulator-5554/scrcpy', origin = 'http://127.0.0.1:5173';
  try {
    const denied = connect('/internal/android/scrcpy?session=current');
    const [error] = await once(denied, 'error'); assert.match(error.message, /401/);
    const worker = connect('/internal/android/scrcpy?session=current', { Authorization: 'Bearer test-only' });
    assert.equal(JSON.parse(String((await once(worker, 'message'))[0])).type, 'ready');
    const wrong = connect(route, { Origin: 'https://other.example' }); await once(wrong, 'close');
    const alice = connect(route, { Origin: origin, 'x-archify-user': 'alice' });
    const subscribed = once(worker, 'message');
    assert.equal(JSON.parse(String((await once(alice, 'message'))[0])).control, true);
    assert.equal(JSON.parse(String((await subscribed)[0])).type, 'subscribe');
    const metadata = once(alice, 'message'); worker.send(JSON.stringify({ type: 'metadata', serial: 'emulator-5554', codec: 'h264', width: 464, height: 1024 }));
    assert.equal(JSON.parse(String((await metadata)[0])).width, 464);
    const frame = once(alice, 'message'); worker.send(encodeRelayFrame('emulator-5554', 1, 123n, Buffer.from([1, 2, 3])));
    const [video, binary] = await frame; assert.equal(binary, true); assert.deepEqual(Buffer.from(video as Buffer).subarray(9), Buffer.from([1, 2, 3]));
    const input = once(worker, 'message'); alice.send(JSON.stringify({ type: 'key', keycode: 3, action: 0 }));
    assert.equal(JSON.parse(String((await input)[0])).event.keycode, 3);
    const tab = connect(route, { Origin: origin, 'x-archify-user': 'alice' });
    assert.equal(JSON.parse(String((await once(tab, 'message'))[0])).control, false);
    const bob = connect(route, { Origin: origin, 'x-archify-user': 'bob' });
    assert.equal(JSON.parse(String((await once(bob, 'message'))[0])).control, false);
    bob.send(JSON.stringify({ type: 'key', keycode: 3, action: 0 })); await once(bob, 'close');
    // Drain any subscribe messages before testing close-time release.
    const released = new Promise<void>(resolve => worker.on('message', raw => { if (JSON.parse(String(raw)).type === 'release') resolve(); }));
    alice.close(); await released; 
    worker.close(); await once(tab, 'close'); 
  } finally { for (const socket of sockets) socket.terminate(); await app.close(); }
});






