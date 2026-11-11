import WebSocket from 'ws';
import { openScrcpy, prepareScrcpy } from './scrcpy.mjs';
import { encodeRelayFrame } from './scrcpy-protocol.mjs';
import { createScrcpySessions } from './scrcpy-sessions.mjs';
import { runFile } from './bridge.mjs';

export function createScrcpyWorker({ base, token, session, bridge, connected }) {
  let socket, retry, stopped = false;
  const send = value => { if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(value)); };
  const sessions = createScrcpySessions({
    async open(serial, callbacks) {
      const tools = await bridge.tools();
      if (!tools) throw new Error('Android SDK 尚未就緒。');
      return openScrcpy({ adb: tools.adb, execute: runFile, serial, ...callbacks });
    },
    metadata: (serial, info) => send({ type: 'metadata', serial, ...info }),
    packet(serial, flags, timestamp, payload) {
      if (socket?.readyState !== WebSocket.OPEN) return;
      if (socket.bufferedAmount > 2200000) { socket.close(1013); return; }
      socket.send(encodeRelayFrame(serial, flags, timestamp, payload), { binary: true });
    },
    notify: (serial, message) => send({ type: 'error', serial, message }),
  });
  async function connect() {
    if (stopped) return;
    if (!connected()) { retry = setTimeout(connect, 1000); return; }
    socket = new WebSocket(`${base.replace('http:', 'ws:')}/internal/android/scrcpy?session=${session}`, { headers: { Authorization: `Bearer ${token}` }, maxPayload: 8192, handshakeTimeout: 10000 });
    socket.on('message', raw => {
      try {
        const message = JSON.parse(raw.toString());
        if (message.type === 'subscribe') sessions.subscribe(message.serial);
        else if (message.type === 'unsubscribe') sessions.unsubscribe(message.serial);
        else if (message.type === 'release') sessions.release(message.serial);
        else if (message.type === 'input' && !bridge.appiumBusy?.(message.serial)) sessions.input(message.serial, message.event);
      } catch { socket.close(1008); }
    });
    socket.on('error', () => {});
    socket.on('close', () => { sessions.clear(); if (!stopped) retry = setTimeout(connect, 2000); });
  }
  // Download errors remain visible in the worker console; device management
  // continues and a later subscription retries preparation.
  void prepareScrcpy().catch(error => console.error(error.message));
  void connect();
  return { reset() { sessions.clear(); socket?.close(); }, release: serial => sessions.release(serial), close() { stopped = true; clearTimeout(retry); sessions.close(); socket?.close(); } };
}
