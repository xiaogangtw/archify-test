import {test} from 'node:test';import assert from 'node:assert/strict';import {cliFailure} from '../../agents/adapter.mjs';
test('CLI failure categories distinguish deadlines from auth without exposing stderr or source',()=>{
 assert.match(cliFailure('timeout','secret-source',null),/^CLI_TIMEOUT/);assert.match(cliFailure('','401 token revoked secret',1),/^CLI_AUTH/);assert.match(cliFailure('','429 quota secret',1),/^CLI_RATE_LIMIT/);assert.match(cliFailure('','unexpected argument secret',2),/^CLI_ARGUMENT/);assert.match(cliFailure('','network connection failed secret',1),/^CLI_NETWORK/);assert.equal(cliFailure('','unrecognized sensitive source',1).includes('sensitive'),false);
});
