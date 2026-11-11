import test from 'node:test';
import assert from 'node:assert/strict';
import { waitForSsh } from './vm-ssh.mjs';
test('SSH readiness waits for guest response, then continues without repeating startup commands', async () => {
  let attempts=0, notices=0;
  await waitForSsh({probe:async()=>++attempts===3,pause:async()=>{},onWait:()=>notices++});
  assert.equal(attempts,3);assert.equal(notices,1);
});
test('Healthy SSH continues immediately without displaying a false stall', async () => {
  await waitForSsh({probe:async()=>true,onWait:()=>assert.fail('unexpected wait')});
});
test('Unresponsive guest stops before authentication with an SSH-specific diagnosis', async () => {
  await assert.rejects(waitForSsh({timeoutMs:10,probe:async()=>false,pause:ms=>new Promise(resolve=>setTimeout(resolve,ms))}),/SSH.*尚未進入登入/);
});
