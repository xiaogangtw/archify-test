import type { FastifyInstance } from 'fastify';
import type { Pool, PoolClient } from 'pg';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { publicRun, terminal } from './model.ts';

interface RunnerDependencies {
  pool: Pick<Pool, 'query'>;
  transaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T>;
}

// 應用程式先安裝 worker 授權；本模組負責租約、順序與事件冪等性。
export function registerRunnerRoutes(app: FastifyInstance, { pool, transaction }: RunnerDependencies) {
  const fail = (statusCode: number, message: string): never => {
    throw Object.assign(new Error(message), { statusCode });
  };
  app.post('/internal/claim',async()=>transaction(async client=>{
    // 租約過期保留結果未知，不自動重跑可能已有副作用的腳本。
    await client.query(`UPDATE runs SET status='failed',message='Runner lease expired; outcome unknown',finished_at=now() WHERE status='running' AND lease_until<now()`);
    const next=await client.query(`SELECT r.* FROM runs r WHERE r.status='queued' AND r.cancel_requested=false AND (r.batch_id IS NULL OR NOT EXISTS (SELECT 1 FROM runs prior WHERE prior.batch_id=r.batch_id AND prior.batch_position<r.batch_position AND prior.status IN ('queued','running'))) ORDER BY r.created_at,r.batch_position FOR UPDATE OF r SKIP LOCKED LIMIT 1`);
    if(!next.rows[0]) return null;
    const result=await client.query(`UPDATE runs SET status='running',started_at=now(),lease_until=now()+interval '45 seconds',lease_token=$2,message='啟動隔離 Runner' WHERE id=$1 RETURNING *`,[next.rows[0].id,randomUUID()]);
    return {...publicRun(result.rows[0]),leaseToken:result.rows[0].lease_token};
  }));
  app.post<{Params:{id:string}}>('/internal/runs/:id/heartbeat',async(req)=>{
    const input=z.object({leaseToken:z.uuid()}).parse(req.body);
    const result=await pool.query(`UPDATE runs SET lease_until=now()+interval '45 seconds' WHERE id=$1 AND lease_token=$2 AND status='running' RETURNING cancel_requested`,[z.uuid().parse(req.params.id),input.leaseToken]);
    return {cancel:result.rows[0]?.cancel_requested ?? true};
  });
  app.post<{Params:{id:string}}>('/internal/runs/:id/events',async(req)=>{
    const input = z.object({
      leaseToken: z.uuid(),
      sequence: z.number().int().positive(),
      event: z.object({
        type: z.enum(['step-start', 'step-end', 'result', 'error']),
        title: z.string().max(500).optional(),
        status: z.enum(['passed', 'failed', 'skipped', 'cancelled']).optional(),
        message: z.string().max(10000).optional(),
      }),
    }).parse(req.body);
    return transaction(async client=>{
      const result=await client.query(`SELECT * FROM runs WHERE id=$1 AND lease_token=$2 FOR UPDATE`,[z.uuid().parse(req.params.id),input.leaseToken]);
      const row=result.rows[0];
      if(!row || terminal.has(row.status)) return {accepted:false};
      const inserted=await client.query('INSERT INTO run_events(run_id,sequence,event) VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING sequence',[row.id,input.sequence,JSON.stringify(input.event)]);
      if(!inserted.rowCount) return {accepted:true};
      const event=input.event;
      if(event.type==='result') {
        if(!event.status) fail(400,'Missing result status');
        const status=row.cancel_requested?'cancelled':event.status;
        await client.query('UPDATE runs SET status=$2,message=$3,finished_at=now() WHERE id=$1',[row.id,status,event.message || status]);
      } else await client.query('UPDATE runs SET message=$2,completed=completed+$3 WHERE id=$1',[row.id,event.message || event.title || '',event.type==='step-end' && event.status==='passed'?1:0]);
      return {accepted:true};
    });
  });
}
