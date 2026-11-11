import type { FastifyInstance } from 'fastify';
import websocket from '@fastify/websocket';
import { WebSocket } from 'ws';
import { decodeRelayFrame, controlPacket } from '../../android/scrcpy-protocol.mjs';

type State = { session: () => string; fresh: () => boolean; available: (serial: string) => boolean; owns: (serial: string, user: string) => boolean };
export function registerAndroidScrcpy(app: FastifyInstance, state: State) {
  // Parent authentication may reject before the websocket plugin's request
  // hook runs. End that upgraded TCP socket after the HTTP rejection flushes.
  app.addHook('onResponse', async (req, reply) => {
    if (req.headers.upgrade?.toLowerCase() === 'websocket' && reply.statusCode !== 101) req.raw.socket.destroy();
  });
  app.register(async scope => {
    await scope.register(websocket, {
      options: { maxPayload: 2200000 },
      preClose(done) {
        for (const client of this.websocketServer.clients) client.terminate();
        this.websocketServer.close(done);
      },
    });
    let worker: WebSocket | undefined, session = '';
    const viewers = new Map<WebSocket, { serial: string; user: string }>();
    const metadata = new Map<string, unknown>();
    const controllers = new Map<string, WebSocket>();
    const send = (socket: WebSocket | undefined, value: unknown) => { if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(value)); };
    const valid = () => worker?.readyState === WebSocket.OPEN && state.fresh() && session === state.session();
    function reset() { metadata.clear(); for (const socket of viewers.keys()) socket.close(1012, 'Worker disconnected'); }
    const monitor = setInterval(() => {
      if (worker && !valid()) { worker.close(1008); reset(); }
      for (const [socket, view] of viewers) if (!state.available(view.serial) || !state.fresh()) socket.close(1012);
      worker?.ping(); for (const socket of viewers.keys()) socket.ping();
    }, 5000); monitor.unref();
    scope.addHook('preClose', async () => { clearInterval(monitor); worker?.terminate(); for (const socket of viewers.keys()) socket.terminate(); });
    scope.get('/internal/android/scrcpy', { websocket: true }, (socket, req) => {
      const supplied = (req.query as { session?: string }).session;
      if (!state.fresh() || supplied !== state.session() || worker?.readyState === WebSocket.OPEN) { socket.close(1008); return; }
      worker = socket; session = supplied!;
      socket.on('message', (raw, binary) => {
        if (!valid() || worker !== socket) { socket.close(1008); return; }
        try {
          if (binary) {
            const { serial, video } = decodeRelayFrame(Buffer.from(raw as Buffer));
            if (!state.available(serial)) return;
            for (const [viewer, view] of viewers) if (view.serial === serial) {
              if (viewer.bufferedAmount > 2200000) viewer.close(1013, 'Slow viewer');
              else if (viewer.readyState === WebSocket.OPEN) viewer.send(video, { binary: true });
            }
          } else {
            if (raw.toString().length > 4096) throw new Error();
            const message = JSON.parse(raw.toString());
            if (!/^emulator-\d+$/.test(message.serial)) throw new Error();
            if (message.type === 'metadata') {
              if (message.codec !== 'h264' || ![message.width, message.height].every(n => Number.isInteger(n) && n > 0 && n <= 4096)) throw new Error();
              metadata.set(message.serial, message);
            } else if (message.type !== 'error') throw new Error();
            for (const [viewer, view] of viewers) if (view.serial === message.serial) send(viewer, message.type === 'error' ? { type: 'error', message: String(message.message).slice(0, 500) } : message);
          }
        } catch { socket.close(1008); }
      });
      socket.on('close', () => { if (worker === socket) { worker = undefined; reset(); } });
      send(socket, { type: 'ready' });
    });
    scope.get<{ Params: { serial: string } }>('/api/android/devices/:serial/scrcpy', { websocket: true }, (socket, req) => {
      const { serial } = req.params;
      // Browsers cannot attach a client header to a WebSocket handshake. Require
      // the exact allowed origin instead; gateway authentication still applies.
      const origin = req.headers.origin;
      const allowed = (process.env.WEB_ORIGINS || 'http://127.0.0.1:5173,http://localhost:5173,http://127.0.0.1:4173').split(',');
      if (!origin || !allowed.includes(origin) || !/^emulator-\d+$/.test(serial) || !valid() || !state.available(serial) || viewers.size >= 8) { socket.close(1008, 'Unavailable or forbidden'); return; }
      const user = String(req.headers['x-archify-user'] || 'local');
      viewers.set(socket, { serial, user });
      const control = state.owns(serial, user) && !controllers.has(serial);
      if (control) controllers.set(serial, socket);
      send(socket, { type: 'connected', control });
      if (metadata.has(serial)) send(socket, metadata.get(serial));
      send(worker, { type: 'subscribe', serial });
      let count = 0, windowAt = Date.now(), resetAt = 0;
      socket.on('message', (raw, binary) => {
        try {
          if (binary || raw.toString().length > 2048 || !valid()) throw new Error();
          if (Date.now() - windowAt > 1000) { count = 0; windowAt = Date.now(); }
          if (++count > 240) throw new Error();
          const event = JSON.parse(raw.toString());
          if (event.type === 'reset') {
            if (Date.now() - resetAt >= 2000) { resetAt = Date.now(); send(worker, { type: 'input', serial, event: { type: 'reset' } }); }
            return;
          }
          if (controllers.get(serial) !== socket || !state.owns(serial, user)) throw new Error();
          controlPacket(event);
          if (worker!.bufferedAmount > 65536) throw new Error();
          send(worker, { type: 'input', serial, event });
        } catch { socket.close(1008, 'Invalid control'); }
      });
      socket.on('close', () => {
        viewers.delete(socket);
        if (controllers.get(serial) === socket) { controllers.delete(serial); send(worker, { type: 'release', serial }); }
        if (![...viewers.values()].some(view => view.serial === serial)) { metadata.delete(serial); send(worker, { type: 'unsubscribe', serial }); }
      });
    });
  });
}
