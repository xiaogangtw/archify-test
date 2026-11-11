import test from 'node:test';
import assert from 'node:assert/strict';
import {requestFingerprint} from '../src/apiWorkflow.ts';
import {editableRequestSchema} from '../src/requestTransport.ts';
test('GraphQL formatting and editor defaults do not change case identity; real input changes do',()=>{
 const original=editableRequestSchema.parse({environmentId:'dev',method:'POST',endpoint:'{{BASE_URL}}',body:'{ "query": "query Login { login }", "variables": { "scopeId": "one" } }'});
 const edited={...original,variables:{scopeId:'one'},body:JSON.stringify({query:'query Login { login }',operationName:'',variables:{scopeId:'one'}})};
 assert.equal(requestFingerprint(original),requestFingerprint(edited));
 assert.notEqual(requestFingerprint(original),requestFingerprint({...edited,variables:{scopeId:'two'}}));
 assert.notEqual(requestFingerprint(original),requestFingerprint({...edited,expectedStatus:401}));
 assert.notEqual(requestFingerprint(original),requestFingerprint({...edited,environmentId:'qa'}));
 assert.notEqual(requestFingerprint({...original,body:'plain text'}),requestFingerprint({...original,body:'plain  text'}));
});
