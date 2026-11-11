import {test} from 'node:test';import assert from 'node:assert/strict';import {npmCliEntry} from '../../agents/adapter.mjs';
test('npm CLI launchers resolve provider-specific entrypoints',()=>{
 assert.match(npmCliEntry('codex','C:/npm/codex.cmd').replaceAll('\\','/'),/node_modules\/@openai\/codex\/bin\/codex.js$/);
 assert.match(npmCliEntry('claude','C:/npm/claude.cmd').replaceAll('\\','/'),/node_modules\/@anthropic-ai\/claude-code\/cli.js$/);
 assert.match(npmCliEntry('gemini','C:/npm/gemini.cmd').replaceAll('\\','/'),/node_modules\/@google\/gemini-cli\/dist\/index.js$/);
 assert.throws(()=>npmCliEntry('unknown','/npm/unknown.cmd'));
});
