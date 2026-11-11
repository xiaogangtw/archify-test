import test from 'node:test';
import assert from 'node:assert/strict';
import {isPngInput,imageMessage} from '../src/modelImages.ts';
test('vision payload contains only validated local PNG data and never external URLs',()=>{
 const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII=';
 assert.equal(isPngInput(png),true);assert.equal(isPngInput('https://example.com/private.png'),false);assert.equal(isPngInput('bad'),false);
 assert.match(JSON.stringify(imageMessage([png])),/data:image\/png;base64/);assert.deepEqual(imageMessage([]),[]);assert.throws(()=>imageMessage([png,png]));
});
