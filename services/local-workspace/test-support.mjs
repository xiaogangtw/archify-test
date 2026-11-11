import {knowledgeStore} from './knowledge.mjs';
import assert from 'node:assert/strict';
import { existsSync, lstatSync } from 'node:fs';
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm, symlink, cp } from 'node:fs/promises';
import { join, resolve, dirname, basename } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { Readable } from 'node:stream';
import { loadConfig } from './config.mjs';
import { createWorkspace } from './workspace.mjs';
import { createHandler } from './plugin.mjs';
import { noLinks } from './paths.mjs';
import { fileURLToPath } from 'node:url';

export async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'archify-workspace-'));
  const platform = join(root, 'platform'), source = join(root, 'frontend'), project = join(root, 'independent-tests');
  await mkdir(platform); await mkdir(join(source, 'src'), { recursive: true });
  await writeFile(join(source, '.env'), 'PASSWORD=DO_NOT_READ_ENV');
  await writeFile(join(source, 'src', 'api.ts'), `import axios from 'axios';
const api=axios.create({baseURL:'https://api.example.test'});
export const list=()=>api.get('/cards');
export const again=()=>api.get('/cards');
export const login=()=>fetch('/login',{method:'POST',body:JSON.stringify({password:'DO_NOT_PUBLISH',email:'qa@example.test'})});
throw new Error('DO_NOT_EXECUTE_SOURCE');`);
  await writeFile(join(source, 'src', 'cards.gql'), 'query GetCard($id: ID!) { card(id: $id) { id } }');
  await writeFile(join(source, 'src', 'api.test.ts'), "fetch('https://fixture.example/DO_NOT_INCLUDE_TEST')");
  const config = await loadConfig(platform, { ARCHIFY_SOURCE_DIR: source, ARCHIFY_TEST_PROJECT_DIR: project });
  return { root, source, project, platform, config, workspace: createWorkspace(config),
    async enableUi() { await knowledgeStore(config).bootstrap();const file=join(project,'knowledge/index.json');const index=JSON.parse(await readFile(file,'utf8'));index.onboardingCompleted=true;await writeFile(file,JSON.stringify(index)); },
    async attachDependencies() {
      const localMods = fileURLToPath(new URL('../../test-project/node_modules', import.meta.url));
      const rootMods = fileURLToPath(new URL('../../node_modules', import.meta.url));
      await cp(rootMods, join(project, 'node_modules'), {
        recursive: true,
        filter: src => !/[\\/]node_modules[\\/](?:archify-local-tests|archify-test-design-prototype|react|react-dom|vite|esbuild|@esbuild|tailwindcss|pdf-lib|@pdf-lib|@vitejs|@rollup|autoprefixer|postcss)([\\/]|$)/.test(src) && !lstatSync(src).isSymbolicLink(),
      });
      if (existsSync(localMods)) {
        await cp(localMods, join(project, 'node_modules'), { recursive: true });
      }
    },
    async dispose() {
    assert.equal(dirname(resolve(root)), resolve(tmpdir())); assert.ok(basename(root).startsWith('archify-workspace-'));
    await rm(root, { recursive: true, force: true });
  } };
}
export async function request(handler, path, input, options = {}) {
  const req = Readable.from(input === undefined ? [] : [JSON.stringify(input)]);
  req.url = path; req.method = options.method || 'POST'; req.socket = { remoteAddress: '127.0.0.1' };
  req.headers = { host: '127.0.0.1:5173', origin: 'http://127.0.0.1:5173', 'content-type': 'application/json', 'x-archify-session': 'test-session', ...options.headers };
  let status = 200, body;
  const res = { set statusCode(value) { status = value; }, setHeader() {}, end(value) { body = JSON.parse(value); } };
  await handler(req, res);
  return { status, body };
}
