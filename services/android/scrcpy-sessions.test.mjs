import test from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as wait } from 'node:timers/promises';
import { createScrcpySessions } from './scrcpy-sessions.mjs';
function fixture() {
  const starts = [], errors = [], metadata = [], inputs = [];
  const manager = createScrcpySessions({ graceMs: 5, retryMs: 5,
    open(serial, callbacks) { return new Promise((resolve, reject) => starts.push({ serial, callbacks, resolve: () => resolve({ close: () => callbacks.onClose(), send: event => inputs.push(event) }), reject })); },
    metadata: (...args) => metadata.push(args), packet() {}, notify: (...args) => errors.push(args),
  });
  return { manager, starts, errors, metadata, inputs };
}
test('switching away during startup cannot create overlapping startup or report a retired error', async () => {
  const f = fixture();
  try {
    f.manager.subscribe('emulator-5554'); f.manager.unsubscribe('emulator-5554'); await wait(15);
    f.manager.subscribe('emulator-5554'); assert.equal(f.starts.length, 1);
    f.starts[0].resolve(); await wait(0);
    f.manager.unsubscribe('emulator-5554'); await wait(15);
    assert.deepEqual(f.errors, []);
    f.manager.subscribe('emulator-5554'); assert.equal(f.starts.length, 2);
    f.manager.unsubscribe('emulator-5554'); await wait(15);
    f.starts[1].reject(new Error('retired startup')); await wait(0);
    assert.deepEqual(f.errors, []);
  } finally { f.manager.close(); }
});
test('quick return reuses video and unexpected exit retries without replaying controls', async () => {
  const f = fixture();
  try {
    f.manager.subscribe('emulator-5554'); f.starts[0].resolve(); await wait(0);
    f.manager.input('emulator-5554', { type: 'touch', action: 0, pointerId: 0 });
    f.manager.unsubscribe('emulator-5554'); f.manager.subscribe('emulator-5554');
    assert.equal(f.starts.length, 1); assert.ok(f.inputs.some(event => event.action === 1));
    f.starts[0].callbacks.onClose(); await wait(15); assert.equal(f.starts.length, 2);
    f.starts[1].resolve(); await wait(0);
    assert.equal(f.inputs.filter(event => event.action === 0).length, 1);
    assert.match(f.errors[0][1], /自動恢復/);
  } finally { f.manager.close(); }
});
test('shutdown while starting closes late handle and cannot restart', async () => {
  const f = fixture(); f.manager.subscribe('emulator-5554'); f.manager.close(); f.starts[0].resolve(); await wait(15);
  f.manager.subscribe('emulator-5554'); assert.equal(f.starts.length, 1); assert.deepEqual(f.errors, []);
});
