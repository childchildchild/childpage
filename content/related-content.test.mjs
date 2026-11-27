import assert from 'node:assert/strict';
import test from 'node:test';
import {relatedMaterials} from './related-content.mjs';
const current={id:'current',type:'article',cardType:'tale',category:'tales',ages:['0-3'],status:'published'};
const item=(id,fields={})=>({...current,id,publishedAt:'2026-11-22T00:00:00Z',...fields});
test('excludes self, stories, unpublished and non-overlapping ages',()=>{
  assert.deepEqual(relatedMaterials([current,item('story',{type:'story'}),item('draft',{status:'draft'}),item('planned',{status:'planned'}),item('older',{ages:['13+']}),item('matching')],current).map(i=>i.id),['matching']);
});
test('ranks the same topic before format and supports games, audio and video',()=>{
  const matches=relatedMaterials([item('format',{category:'for_all'}),item('topic',{type:'audio',cardType:'audio'}),item('game',{type:'game',cardType:'game',category:'games',ages:[]}),item('video',{type:'video',cardType:'video',ages:[]})],current);
  assert.equal(matches[0].id,'topic');assert.ok(matches.some(i=>i.type==='game'));assert.ok(matches.some(i=>i.type==='video'));
});
test('returns bounded results and handles an empty set',()=>{
  assert.equal(relatedMaterials(Array.from({length:12},(_,i)=>item(String(i))),current).length,6);
  assert.deepEqual(relatedMaterials([current],current),[]);
});
