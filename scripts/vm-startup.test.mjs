import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { readyMarker, startupCommand, sshStartupCommand, waitForRemoteReady } from './vm-startup.mjs';
const child = () => Object.assign(new EventEmitter(), { stdout: new PassThrough() });
test('container Started text never signals readiness; marker can span chunks', async () => {
  const process = child(); let ready = false;
  const waiting = waitForRemoteReady(process, { write: () => {}, timeoutMs: 1000 }).then(() => { ready = true; });
  process.stdout.write('Container control-api Started\n');
  await Promise.resolve(); assert.equal(ready, false);
  process.stdout.write(readyMarker.slice(0, 8)); process.stdout.write(readyMarker.slice(8) + '\r\n');
  await waiting; assert.equal(ready, true);
});
test('exit, process errors and timeouts reject startup instead of starting clients', async () => {
  const failed = child(), pending = waitForRemoteReady(failed, { write: () => {} });
  failed.emit('close', 1); await assert.rejects(pending, /已結束/);
  const error = child(), pendingError = waitForRemoteReady(error, { write: () => {} });
  error.emit('error', new Error('SSH unavailable')); await assert.rejects(pendingError, /SSH unavailable/);
  await assert.rejects(waitForRemoteReady(child(), { timeoutMs: 10, write: () => {} }), /逾時/);
});
test('VM command probes health and prints diagnostics before its success marker', () => {
  const command = startupCommand(false);
  assert.ok(command.includes('curl -fsS --max-time 3 http://127.0.0.1:3001/api/health'));
  assert.ok(command.includes('docker compose port control-api 3001'));
  assert.ok(command.includes('docker compose logs --tail 80 control-api'));
  assert.ok(command.indexOf('/api/health') < command.indexOf(readyMarker));
});
test('Windows SSH transport round-trips the full script without quote escaping', () => {
  const encoded = sshStartupCommand(false).split(' ')[2];
  assert.equal(Buffer.from(encoded, 'base64').toString('utf8'), startupCommand(false));
  assert.ok(!sshStartupCommand().includes('"'));
  assert.ok(startupCommand(false).includes("printf '%s\\n' '" + readyMarker + "'"));
});
