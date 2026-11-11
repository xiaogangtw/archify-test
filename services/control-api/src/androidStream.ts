import type { FastifyInstance } from 'fastify';
import type { ServerResponse } from 'node:http';
import { z } from 'zod';

export function registerAndroidStream(app: FastifyInstance, state: { session: () => string; fresh: () => boolean; available: (serial: string) => boolean }) {
  const viewers = new Map<string, Set<ServerResponse>>();
  const emit = (response: ServerResponse, event: string, value: unknown) => response.write(`event: ${event}\ndata: ${JSON.stringify(value)}\n\n`);
  function close(serial: string) {
    const group = viewers.get(serial);
    viewers.delete(serial);
    for (const response of group || []) {
      if (!response.destroyed && !response.writableEnded) { emit(response, 'offline', { message: '裝置或執行器已離線。' }); response.end(); }
    }
  }
  const monitor = setInterval(() => {
    for (const [serial, group] of viewers) {
      if (!state.fresh() || !state.available(serial)) { close(serial); continue; }
      for (const response of group) {
        // Disconnect slow clients instead of accumulating unbounded frame buffers.
        if (response.writableLength > 2500000) { response.destroy(); continue; }
        response.write(': keepalive\n\n');
      }
    }
  }, 5000);
  monitor.unref();
  app.addHook('preClose', async () => { clearInterval(monitor); for (const serial of viewers.keys()) close(serial); });
  app.get<{ Params: { serial: string } }>('/api/android/devices/:serial/stream', async (req, reply) => {
    const serial = z.string().regex(/^emulator-\d+$/).parse(req.params.serial);
    if (!state.fresh() || !state.available(serial)) return reply.code(503).send({ error: '裝置尚未連線，暫時無法串流。' });
    if ([...viewers.values()].reduce((sum, set) => sum + set.size, 0) >= 8) return reply.code(429).send({ error: '串流觀看人數已達上限。' });
    reply.hijack();
    const response = reply.raw;
    response.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no', Connection: 'keep-alive' });
    const group = viewers.get(serial) || new Set<ServerResponse>();
    group.add(response); viewers.set(serial, group);
    response.on('close', () => { group.delete(response); if (!group.size && viewers.get(serial) === group) viewers.delete(serial); });
    emit(response, 'connected', { serial });
  });
  app.post('/internal/android/frame', async (req, reply) => {
    const frame = z.object({ session: z.string().uuid(), serial: z.string().regex(/^emulator-\d+$/), png: z.string().max(2000000).optional(), error: z.string().max(500).optional() }).parse(req.body);
    if (frame.session !== state.session() || !state.fresh()) return reply.code(409).send({ error: '串流工作階段已失效。' });
    const group = viewers.get(frame.serial);
    if (!group?.size || !state.available(frame.serial)) return { accepted: false };
    if (frame.error) {
      for (const response of group) emit(response, 'frame-error', { message: frame.error });
      return { accepted: true };
    }
    if (!frame.png || Buffer.from(frame.png, 'base64').subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') return reply.code(400).send({ error: '無效的裝置畫面。' });
    const capturedAt = new Date().toISOString();
    for (const response of group) {
      if (response.destroyed || response.writableLength > 2500000) { response.destroy(); continue; }
      emit(response, 'frame', { png: frame.png, capturedAt });
    }
    return { accepted: true };
  });
  return { targets: () => state.fresh() ? [...viewers.keys()].filter(state.available).slice(0, 4) : [] };
}
