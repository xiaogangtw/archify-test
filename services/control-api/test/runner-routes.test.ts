import test from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import type { Pool, PoolClient } from 'pg';
import { registerRunnerRoutes } from '../src/runnerRoutes.ts';

const id = '11111111-1111-4111-8111-111111111111';
const leaseToken = '22222222-2222-4222-8222-222222222222';

function setup(results: { rows: any[]; rowCount?: number }[]) {
  const calls: { sql: string; values: any[] }[] = [];
  let transactions = 0;
  const database = {
    async query(sql: string, values: any[] = []) {
      calls.push({ sql, values });
      const result = results.shift();
      assert.ok(result, `Unexpected query: ${sql}`);
      return { rowCount: result.rows.length, ...result };
    },
  };
  const app = Fastify();
  registerRunnerRoutes(app, {
    pool: database as unknown as Pick<Pool, 'query'>,
    async transaction(work) {
      transactions++;
      return work(database as unknown as PoolClient);
    },
  });
  return { app, calls, transactions: () => transactions };
}

test('claim returns no work when queue is empty, or the claimed public run and lease', async t => {
  for (const queued of [false, true]) {
    const row = { id, status: 'running', lease_token: leaseToken, snapshot: { name: 'Smoke' } };
    const fixture = setup([{ rows: [] }, { rows: queued ? [{ id }] : [] }, ...(queued ? [{ rows: [row] }] : [])]);
    t.after(() => fixture.app.close());
    const response = await fixture.app.inject({ method: 'POST', url: '/internal/claim', payload: {} });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), queued ? { name: 'Smoke', id, status: 'running', mode: 'real', leaseToken } : null);
    assert.equal(fixture.transactions(), 1);
    assert.match(fixture.calls[0].sql, /lease_until<now\(\)/);
    assert.match(fixture.calls[1].sql, /FOR UPDATE OF r SKIP LOCKED/);
    assert.match(fixture.calls[1].sql, /prior.batch_position<r.batch_position/);
  }
});

test('heartbeat cancels an unknown lease and preserves a live cancellation flag', async t => {
  for (const rows of [[], [{ cancel_requested: false }], [{ cancel_requested: true }]]) {
    const fixture = setup([{ rows }]);
    t.after(() => fixture.app.close());
    const response = await fixture.app.inject({ method: 'POST', url: `/internal/runs/${id}/heartbeat`, payload: { leaseToken } });
    assert.deepEqual(response.json(), { cancel: rows[0]?.cancel_requested ?? true });
    assert.deepEqual(fixture.calls[0].values, [id, leaseToken]);
  }
});

test('events ignore unknown or terminal runs and do not apply duplicate events twice', async t => {
  for (const row of [undefined, { id, status: 'passed' }, { id, status: 'running' }]) {
    const fixture = setup([{ rows: row ? [row] : [] }, { rows: [], rowCount: 0 }]);
    t.after(() => fixture.app.close());
    const response = await fixture.app.inject({ method: 'POST', url: `/internal/runs/${id}/events`, payload: { leaseToken, sequence: 1, event: { type: 'step-end', status: 'passed' } } });
    assert.deepEqual(response.json(), { accepted: row?.status === 'running' });
    assert.equal(fixture.calls.length, row?.status === 'running' ? 2 : 1);
  }
});

test('result respects cancellation; only a passed step increments progress', async t => {
  for (const event of [{ type: 'result', status: 'passed' }, { type: 'step-end', status: 'passed' }, { type: 'step-end', status: 'failed' }]) {
    const fixture = setup([{ rows: [{ id, status: 'running', cancel_requested: true }] }, { rows: [{ sequence: 1 }] }, { rows: [] }]);
    t.after(() => fixture.app.close());
    const response = await fixture.app.inject({ method: 'POST', url: `/internal/runs/${id}/events`, payload: { leaseToken, sequence: 1, event } });
    assert.deepEqual(response.json(), { accepted: true });
    assert.deepEqual(fixture.calls[2].values, event.type === 'result' ? [id, 'cancelled', 'cancelled'] : [id, '', event.status === 'passed' ? 1 : 0]);
    assert.equal(fixture.transactions(), 1);
  }
});

test('invalid event input never reaches the database', async t => {
  const fixture = setup([]);
  t.after(() => fixture.app.close());
  const response = await fixture.app.inject({ method: 'POST', url: `/internal/runs/${id}/events`, payload: { leaseToken, sequence: 0, event: { type: 'result', status: 'passed' } } });
  assert.ok(response.statusCode >= 400);
  assert.equal(fixture.calls.length, 0);
});
