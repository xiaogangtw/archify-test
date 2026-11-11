import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { parse, validate, buildSchema } from 'graphql';
import { fixture } from './test-support.mjs';
import { graphqlPayload } from './graphql-payload.mjs';
import { playwrightSource } from './playwright-source.mjs';
import { refreshGraphqlSource } from './refresh-graphql.mjs';

test('從前端取 query 及 variables 結構，保留常數型別和動態占位，不執行來源', async () => {
  const f = await fixture();
  try {
    await writeFile(join(f.source, 'src/profile.ts'), `import axios from 'axios';
const api = axios.create({baseURL:'https://api.example.test/graphql'});
const QUERY = \`query Profile($id: ID!, $input: Filter!, $limit: Int = 12) { profile(id: $id, input: $input, limit: $limit) { id } }\`;
export function profile(userId: string) {
  return api.post('', {query: QUERY, variables: {id:userId, input:{enabled:true, names:['qa'], nested:{count:3, term: searchText}}}, operationName:'Profile'});
}
throw new Error('DO_NOT_EXECUTE_GRAPHQL_SOURCE');`);
    await f.workspace.initialize(); const result = await f.workspace.scan();
    const item = result.requests.find(row => row.operationName === 'Profile'); assert.ok(item);
    assert.equal(item.body.variables.id, '{{userId}}');
    assert.equal(item.body.variables.limit, 12);
    assert.deepEqual(item.body.variables.input, { enabled: true, names: ['qa'], nested: { count: 3, term: '{{searchText}}' } });
    assert.match(item.body.query, /query Profile/);
    const source = playwrightSource(item, undefined, '../../support/bff.mjs');
    assert.match(source, /"query": `query Profile/);
    assert.ok(source.includes('test.skip('));
    assert.ok(!source.includes('request.fetch') && !source.includes('const scenario') && !source.includes('const steps'));
    assert.ok(!source.includes('DO_NOT_EXECUTE_GRAPHQL_SOURCE'));
    const ts = createRequire(new URL('../control-api/package.json', import.meta.url))('typescript');
    assert.deepEqual(ts.createSourceFile('Profile.spec.ts', source, ts.ScriptTarget.Latest, true).parseDiagnostics, []);
  } finally { await f.dispose(); }
});

test('多呼叫只將衝突欄位留變數，秘密與預設不洩漏，無參數保留空物件', () => {
  const query = 'query Search($input: Filter!, $count: Int = 5) { search(input:$input, count:$count) }';
  const result = graphqlPayload({ query }, [
    { scope: 'transport', variables: { input: { mode: 'active', id: 'a', tags: ['qa'] } } },
    { scope: 'transport', variables: { input: { mode: 'active', id: 'b', tags: ['qa'] } } },
    { scope: 'caller', variables: { input: { mode: 'should-not-replace-template' }, count: 99 } },
  ]);
  assert.deepEqual(result.variables, { input: { mode: 'active', id: '{{input.id}}', tags: ['qa'] }, count: 5 });
  const secured = graphqlPayload({ query: 'mutation Login($password: String = "synthetic-secret") { login(password: $password) }' });
  assert.equal(secured.variables.password, '{{PASSWORD}}');
  assert.ok(!JSON.stringify(secured).includes('synthetic-secret'));
  assert.match(secured.query, /login\(password: \$password\)/);
  const schema = buildSchema('type Query { ping: String } type Mutation { login(password: String): String }');
  assert.deepEqual(validate(schema, parse(secured.query)), []);
  assert.deepEqual(graphqlPayload({ query: 'query Ping { ping }' }).variables, {});
});

test('既有草稿只更新未人工修改的請求區，保留測試資料與業務斷言', () => {
  const old = { id: 'a'.repeat(20), kind: 'graphql', method: 'POST', endpoint: '/graphql', operationType: 'query', name: 'Card', body: { query: 'query Card($id: ID!) { card(id:$id) { id } }', variables: {} } };
  const next = { ...old, body: { ...old.body, variables: { id: '{{cardId}}' } } };
  const source = playwrightSource(old, { enabled: true, variables: { cardId: 'synthetic-test-id' }, expectedStatus: 200, assertions: [] }, '../../support/bff.mjs') + '\n// 人工業務斷言不可刪除\n';
  const result = refreshGraphqlSource(source, old, next);
  assert.ok(result.source.includes('"id": "{{cardId}}"'));
  assert.ok(result.source.includes('"cardId": "synthetic-test-id"'));
  assert.ok(result.source.includes('// 人工業務斷言不可刪除'));
  assert.ok(result.source.includes('"ready": true'));
  assert.ok(refreshGraphqlSource(source.replace('"variables": {}', '"variables": {"id":"manual"}'), old, next).skipped);
});
