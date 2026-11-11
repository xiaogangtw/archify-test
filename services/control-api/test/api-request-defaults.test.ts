import test from 'node:test';
import assert from 'node:assert/strict';
import {initialRequest} from '../../../apps/web/src/features/testing/apiRequestDefaults.ts';
import {editableRequestSchema} from '../src/requestTransport.ts';
import type {RequestDefinition} from '../src/apiContracts.ts';

test('saved edits on scanned interfaces survive reopening without overwriting source evidence',()=>{
 const defaults=editableRequestSchema.parse({environmentId:'qa',authReference:'qa-auth',method:'POST',endpoint:'{{BASE_URL}}',body:'{"query":"query Saved { viewer }"}',variables:{request:{scopeId:'my-scope'}}});
 const item={origin:'source',kind:'graphql',defaults,sourceRequest:{body:'{"query":"query Source { viewer }"}',variables:'{"request":{"scopeId":"old"}}'}} as RequestDefinition;
 const reopened=initialRequest(item,'qa');
 assert.deepEqual(reopened,defaults);
 reopened.variables.request={scopeId:'changed'};
 assert.deepEqual(defaults.variables,{request:{scopeId:'my-scope'}});
 assert.equal(initialRequest(item,'other').authReference,'');
 assert.equal(item.sourceRequest?.variables,'{"request":{"scopeId":"old"}}');
});
