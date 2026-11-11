// Opt-in integration against an already-running emulator. Uses an isolated
// loopback relay, sends Home and a swipe, saves no images or device data.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, readdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import Fastify from 'fastify';
import { registerAndroidScrcpy } from '../services/control-api/src/androidScrcpy.ts';
import { createAndroidBridge } from '../services/android/bridge.mjs';
import { createScrcpyWorker } from '../services/android/scrcpy-worker.mjs';
const require = createRequire(import.meta.url), { chromium } = require('playwright');
const { build } = createRequire(new URL('../apps/web/package.json', import.meta.url))('esbuild');
const serial = process.argv[2] || 'emulator-5554', bridge = createAndroidBridge();
assert.ok((await bridge.status()).devices.some(d => d.serial === serial && d.booted), 'Start an emulator first');
const session = randomUUID(), token = randomUUID(), app = Fastify({ forceCloseConnections: true });
app.addHook('onRequest', async (req, reply) => { if (req.url.startsWith('/internal/') && req.headers.authorization !== `Bearer ${token}`) return reply.code(401).send(); });
registerAndroidScrcpy(app, { session: () => session, fresh: () => true, available: value => value === serial, owns: () => true });
const bundle = await build({ stdin: { contents: `import React from 'react';import {createRoot} from 'react-dom/client';import {DeviceViewer} from './apps/web/src/features/testing/AndroidDeviceViewer';createRoot(document.getElementById('root')).render(<main className="bg-canvas p-4 font-sans text-ink"><h1 className="text-title font-bold">串流驗證</h1><DeviceViewer device={{serial:${JSON.stringify(serial)},state:'device',booted:true,canControl:true,error:''}} refresh={async()=>{}}/></main>);`, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, write: false, format: 'iife', jsx: 'automatic', nodePaths: ['apps/web/node_modules'] });
const assets = 'apps/web/dist/assets', css = await readFile(`${assets}/${(await readdir(assets)).find(n => n.endsWith('.css'))}`, 'utf8');
app.get('/', async (_req, reply) => reply.type('text/html').send(`<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Scrcpy verification</title><style>${css}</style><body><div id="root"></div><script>${bundle.outputFiles[0].text}</script></body></html>`));
const base = await app.listen({ host: '127.0.0.1', port: 0 });
const previous = process.env.WEB_ORIGINS; process.env.WEB_ORIGINS = base;
const worker = createScrcpyWorker({ base, token, session, bridge, connected: () => true });
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH });
try {
  const page = await browser.newPage({ viewport: { width: 1000, height: 1000 } }), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    window.inputEvents = []; window.drawnFrames = 0; window.streamSockets = 0; window.streamCloses = 0;
    const NativeSocket = WebSocket; window.WebSocket = class extends NativeSocket { constructor(...args) { super(...args); window.streamSockets++; this.addEventListener('close', () => window.streamCloses++); } };
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => window.testHidden === true });
    const send = WebSocket.prototype.send; WebSocket.prototype.send = function(data) { if (typeof data === 'string') window.inputEvents.push(JSON.parse(data)); return send.call(this, data); };
    const draw = CanvasRenderingContext2D.prototype.drawImage; CanvasRenderingContext2D.prototype.drawImage = function(...args) { window.drawnFrames++; return draw.apply(this, args); };
  });
  const started = performance.now(); await page.goto(base);
  const status = page.getByRole('status'); await status.filter({ hasText: '即時串流中' }).waitFor({ timeout: 30000 });
  const firstFrameMs = Math.round(performance.now() - started);
  const canvas = page.getByRole('img');
  const pixels = await canvas.evaluate(c => [...c.getContext('2d').getImageData(0, 0, c.width, c.height).data].some((v, i) => i % 4 !== 3 && v > 0)); assert.equal(pixels, true);
  if (!process.env.ARCHIFY_TEST_BACKGROUND_ONLY) {
  await page.getByRole('button', { name: '主畫面', exact: true }).click();
  const rect = await canvas.boundingBox();
  await page.mouse.move(rect.x + rect.width / 2 + 50, rect.y + rect.height / 2); await page.mouse.down(); await page.mouse.move(rect.x + rect.width / 2 - 50, rect.y + rect.height / 2, { steps: 12 }); await page.mouse.up();
  await page.waitForFunction(() => window.drawnFrames >= 5);
  const events = await page.evaluate(() => window.inputEvents);
  assert.ok(events.some(e => e.type === 'key' && e.keycode === 3)); for (const action of [0, 1, 2]) assert.ok(events.some(e => e.type === 'touch' && e.action === action));
  }
  await page.getByRole('button', { name: '暫停串流', exact: true }).click(); await status.filter({ hasText: '已暫停' }).waitFor();
  await page.getByRole('button', { name: '恢復串流', exact: true }).click(); await status.filter({ hasText: '即時串流中' }).waitFor({ timeout: 30000 });
  // Deterministic visibility/blur event harness: no Android app input.
  const connections = await page.evaluate(() => window.streamSockets);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  assert.equal(await page.evaluate(() => window.streamSockets), connections, 'blur must not reconnect');
  for (let cycle = 0; cycle < 3; cycle++) {
    await page.evaluate(() => { window.testHidden = true; document.dispatchEvent(new Event('visibilitychange')); });
    await page.waitForTimeout(100);
    await page.evaluate(() => { window.testHidden = false; document.dispatchEvent(new Event('visibilitychange')); });
  }
  assert.equal(await page.evaluate(() => window.streamSockets), connections, 'brief hidden transitions must reuse socket');
  for (let cycle = 0; cycle < 2; cycle++) {
    await page.evaluate(() => { window.testHidden = true; document.dispatchEvent(new Event('visibilitychange')); });
    await status.filter({ hasText: '背景暫停' }).waitFor();
    await page.evaluate(() => { window.testHidden = false; document.dispatchEvent(new Event('visibilitychange')); });
    await status.filter({ hasText: '即時串流中' }).waitFor({ timeout: 30000 });
    assert.equal(await page.getByRole('alert').count(), 0);
  }
  for (const width of [320, 390, 1280]) { await page.setViewportSize({ width, height: 1000 }); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true); }
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ result: 'PASS', serial, firstFrameMs, drawnFrames: await page.evaluate(() => window.drawnFrames), checked: ['real H264 decode', 'nonempty pixels', ...(process.env.ARCHIFY_TEST_BACKGROUND_ONLY ? [] : ['Home', 'continuous touch']), 'pause/resume', 'blur preserves socket', '3 brief background transitions', '2 long background transitions recover', 'responsive overflow'], screenshotsSaved: false }));
  if (process.env.ARCHIFY_INSPECT_MS) {
    console.log('INSPECT ' + base);
    await new Promise(resolve => setTimeout(resolve, Math.min(60000, Number(process.env.ARCHIFY_INSPECT_MS))));
  }
} finally { await browser.close(); worker.close(); await app.close(); if (previous === undefined) delete process.env.WEB_ORIGINS; else process.env.WEB_ORIGINS = previous; }
