import assert from 'node:assert/strict';
import test from 'node:test';
import {normalizeTags} from './tags.mjs';
test('normalizes equivalent topics and preserves legacy empty values',()=>{
  assert.deepEqual(normalizeTags(),[]);
  assert.deepEqual(normalizeTags(['  Звёзды  ','звезды','Мытье   рук','','Научные–опыты']),['звезды','мытье рук','научные-опыты']);
});
test('rejects invalid shapes, long or excessive tags and markup',()=>{
  for(const tags of ['animals',[42],['x'.repeat(41)],['<img src=x>'],Array.from({length:11},(_,i)=>`тема ${i}`)]) assert.throws(()=>normalizeTags(tags));
});
