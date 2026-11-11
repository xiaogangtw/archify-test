import test from 'node:test';
import assert from 'node:assert/strict';
import { controlPacket, ScrcpyVideoParser, encodeRelayFrame, decodeRelayFrame } from './scrcpy-protocol.mjs';
test('scrcpy touch/key wire layout and invalid input rejection', () => {
  const packet = controlPacket({ type: 'touch', action: 0, pointerId: 1, x: 100, y: 200, width: 576, height: 1024 });
  assert.equal(packet.length, 32); assert.equal(packet.toString('hex'), '0200000000000000000100000064000000c802400400ffff0000000000000000');
  assert.equal(controlPacket({ type: 'key', action: 1, keycode: 3 }).toString('hex'), '0001000000030000000000000000');
  assert.throws(() => controlPacket({ type: 'touch', action: 0, pointerId: 0, x: 1000, y: 0, width: 500, height: 1000 }));
  assert.throws(() => controlPacket({ type: 'key', action: 0, keycode: 999 }));
});
test('fragmented metadata and H264 packets retain flags, timestamps and device routing', () => {
  const header = Buffer.alloc(77); header.writeUInt32BE(0x68323634, 65); header.writeUInt32BE(576, 69); header.writeUInt32BE(1024, 73);
  const payload = Buffer.from([0, 0, 0, 1, 0x67, 0x42, 0, 31]);
  const packet = Buffer.alloc(12); packet.writeBigUInt64BE((1n << 63n) | 123n); packet.writeUInt32BE(payload.length, 8);
  let info, frame;
  const parser = new ScrcpyVideoParser(value => info = value, (flags, timestamp, data) => frame = { flags, timestamp, data });
  const all = Buffer.concat([header, packet, payload]); for (const byte of all) parser.feed(Buffer.from([byte]));
  assert.deepEqual(info, { codec: 'h264', width: 576, height: 1024 }); assert.equal(frame.flags, 2); assert.equal(frame.timestamp, 123n); assert.deepEqual(frame.data, payload);
  const relay = decodeRelayFrame(encodeRelayFrame('emulator-5554', frame.flags, frame.timestamp, payload));
  assert.equal(relay.serial, 'emulator-5554'); assert.equal(relay.video[0], 2); assert.deepEqual(relay.video.subarray(9), payload);
  assert.throws(() => decodeRelayFrame(Buffer.from([0])));
});
