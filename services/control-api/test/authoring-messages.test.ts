import test from 'node:test';
import assert from 'node:assert/strict';
import {authoringMessages} from '../../../apps/web/src/features/testing/authoringMessages.ts';

test('long conversations keep the latest question and fit the API message-count limit',()=>{
 const history=Array.from({length:35},(_,i)=>({role:(i%2?'assistant':'user') as 'user'|'assistant',content:`舊訊息 ${i}`}));
 const messages=authoringMessages(history,'如果網頁逾時，就會失敗嗎？');
 assert.equal(messages.length,30);
 assert.equal(messages[0].content,'舊訊息 6');
 assert.match(messages.at(-1)!.content,/較早的 6 則對話未包含/);
 assert.match(messages.at(-1)!.content,/如果網頁逾時，就會失敗嗎？/);
 assert.equal(history.length,35);
});

test('multibyte conversations stay within the request budget without cutting a message',()=>{
 const history=Array.from({length:29},(_,i)=>({role:'user' as const,content:`${i}:`+'測'.repeat(20000)}));
 const messages=authoringMessages(history,'最近問題');
 assert.ok(messages.length<30);
 assert.ok(new TextEncoder().encode(JSON.stringify({purpose:'android-flow',agentId:'code',messages})).length<=900000);
 assert.match(messages.at(-1)!.content,/最近問題/);
 assert.equal(messages.at(-2)!.content,history.at(-1)!.content);
 assert.throws(()=>authoringMessages([], '測'.repeat(400000)),/資料過大/);
});
