// Read-only real-device video probe. No screenshots or frames are saved.
import { createAndroidBridge, runFile } from '../services/android/bridge.mjs';
import { openScrcpy } from '../services/android/scrcpy.mjs';
const bridge = createAndroidBridge(), tools = await bridge.tools();
const serial = process.argv[2] || 'emulator-5554';
let packets = 0, bytes = 0, metadata, configs = 0, keys = 0;
const start = performance.now();
const stream = await openScrcpy({ adb: tools.adb, execute: runFile, serial,
  onMetadata: value => { metadata = value; },
  onPacket: (flags, _pts, data) => { packets++; bytes += data.length; if (flags & 2) configs++; if (flags & 1) keys++; },
});
try {
  const deadline = Date.now() + 10000;
  while (!packets && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 100));
  if (!metadata || !configs || !keys) throw new Error('Missing video metadata/config/keyframe');
  console.log(JSON.stringify({ serial, metadata, packets, bytes, configs, keys, firstVideoMs: Math.round(performance.now() - start) }));
} finally { stream.close(); }
