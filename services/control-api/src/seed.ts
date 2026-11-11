import { defaultAgents, upgradeBuiltinAgents } from './agentDefaults.ts';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { transaction } from './db.ts';
export async function seed() {
  const source=await readFile(new URL('../../runner/smoke.spec.ts',import.meta.url),'utf8');
  const body={id:'archify-readonly-smoke',name:'唯讀 API Smoke',source,version:1,messages:[]};
  await transaction(async client=>{
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',['archify.agents.v1']);
    const agentDocument=(await client.query('SELECT value FROM documents WHERE key=$1',['archify.agents.v1'])).rows[0];
    if(agentDocument && Array.isArray(agentDocument.value)) {
      const upgraded=upgradeBuiltinAgents(agentDocument.value);
      if(JSON.stringify(upgraded)!==JSON.stringify(agentDocument.value)) await client.query('UPDATE documents SET value=$2,revision=revision+1 WHERE key=$1',['archify.agents.v1',JSON.stringify(upgraded)]);
    }
    if(!agentDocument) await client.query('INSERT INTO documents(key,value) VALUES($1,$2) ON CONFLICT DO NOTHING',['archify.agents.v1',JSON.stringify(defaultAgents)]);
    await client.query('INSERT INTO documents(key,value) VALUES($1,$2) ON CONFLICT DO NOTHING',['archify.testing.v1',JSON.stringify({project:{name:'Archify Test',repositoryUrl:'',branch:'release',websiteUrl:''},cases:[],flows:[]})]);
    await client.query('INSERT INTO scripts(id,version) VALUES($1,1) ON CONFLICT DO NOTHING',[body.id]);
    await client.query('INSERT INTO script_versions(script_id,version,body,source_hash) VALUES($1,1,$2,$3) ON CONFLICT DO NOTHING',[body.id,JSON.stringify(body),createHash('sha256').update(source).digest('hex')]);
    await client.query("UPDATE scripts SET test_case_number=nextval('script_test_case_number_seq') WHERE id=$1 AND deleted_at IS NULL AND test_case_number IS NULL",[body.id]);
  });
}
