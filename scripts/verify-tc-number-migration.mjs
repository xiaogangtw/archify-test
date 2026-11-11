import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const {PGlite}=createRequire(import.meta.url)('@electric-sql/pglite');
const db=new PGlite();
try{
 // Seed the prior schema, including a deleted TC and interleaved FC numbers.
 await db.exec(`CREATE TABLE scripts(id text PRIMARY KEY,version integer NOT NULL,updated_at timestamptz NOT NULL DEFAULT now(),deleted_at timestamptz,case_number bigint);
 CREATE TABLE script_versions(script_id text NOT NULL REFERENCES scripts(id),version integer NOT NULL,body jsonb NOT NULL,source_hash text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(script_id,version));
 INSERT INTO scripts(id,version,case_number,deleted_at) VALUES('deleted',1,1,now()),('flow',1,6,NULL),('first',1,8,NULL),('second',1,12,NULL);
 INSERT INTO script_versions(script_id,version,body,source_hash) VALUES('deleted',1,'{"caseCode":"TC-000001"}','a'),('flow',1,'{"caseType":"flow","caseCode":"FC-000006"}','b'),('first',1,'{"caseCode":"TC-000008"}','c'),('second',1,'{"caseType":"test","caseCode":"TC-000012"}','d');`);
 const schema=await readFile(new URL('../services/control-api/schema.sql',import.meta.url),'utf8');
 await db.exec(schema);
 let rows=(await db.query('SELECT id,case_number,test_case_number FROM scripts ORDER BY id')).rows;
 assert.equal(rows.find(row=>row.id==='first').test_case_number,1);
 assert.equal(rows.find(row=>row.id==='second').test_case_number,2);
 assert.equal(rows.find(row=>row.id==='flow').case_number,6);
 assert.equal(rows.find(row=>row.id==='flow').test_case_number,null);
 assert.equal(rows.find(row=>row.id==='deleted').test_case_number,null);
 assert.equal((await db.query("SELECT body->>'caseCode' AS code FROM script_versions WHERE script_id='first'")).rows[0].code,'TC-000008');
 await db.exec(schema);
 assert.deepEqual((await db.query('SELECT id,case_number,test_case_number FROM scripts ORDER BY id')).rows,rows,'repeat startup must not renumber');
 assert.equal((await db.query("SELECT nextval('script_test_case_number_seq') AS number")).rows[0].number,3);
 await db.exec("UPDATE scripts SET deleted_at=now() WHERE id='first'");
 await db.exec(schema);
 assert.equal((await db.query("SELECT test_case_number FROM scripts WHERE id='second'")).rows[0].test_case_number,2);
 assert.equal((await db.query("SELECT nextval('script_test_case_number_seq') AS number")).rows[0].number,4,'deleted numbers and consumed sequence values must not be reused');
 console.log('PASS: legacy TC-000008 becomes current TC-000001; FC/history preserved; repeat migration and deletion keep stable numbers.');
}finally{await db.close();}
