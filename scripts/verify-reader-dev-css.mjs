import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const vitePath = createRequire(new URL('../apps/web/package.json', import.meta.url)).resolve('vite');
const { createServer } = await import(pathToFileURL(vitePath).href);

// Exercise Vite's development CSS pipeline from the repository root.
const server = await createServer({
  root: resolve('apps/web'),
  configFile: resolve('apps/web/vite.config.ts'),
  server: { middlewareMode: true, hmr: false },
});
try {
  const result = await server.transformRequest('/src/styles.css');
  assert.ok(result?.code.includes('16rem'), 'sidebar theme token resolved');
  assert.ok(result.code.includes('grid-template-columns: 12rem minmax(0, 1fr)'), 'reader layout generated');
  assert.ok(result.code.includes('.text-ink'), 'application utilities generated');
  console.log('PASS: root-cwd Vite development CSS resolves sidebar token and reader utilities');
} finally {
  await server.close();
}
