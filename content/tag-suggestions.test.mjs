import assert from 'node:assert/strict';
import test from 'node:test';
import {collectTagCatalog,autocompleteTags,suggestTags} from './tag-suggestions.mjs';
const catalog=collectTagCatalog([
 {status:'published',tags:['животные','собаки','питомцы','собаки']},
 {status:'draft',tags:['Животные','кошки','Звёзды','мытье рук','уход за собаками']},
 {status:'trashed',tags:['удаленная тема']},
 {status:'published'},
]);
test('builds a shared normalized vocabulary without duplicate counts or trashed tags',()=>{
 assert.equal(catalog.find(i=>i.tag==='животные').count,2);assert.equal(catalog.find(i=>i.tag==='собаки').count,1);assert.ok(!catalog.some(i=>i.tag==='удаленная тема'));
});
test('autocomplete matches prefixes and words, excludes selected topics, handles ё',()=>{
 assert.deepEqual(autocompleteTags(catalog,'СОБ').map(i=>i.tag),['собаки','уход за собаками']);
 assert.deepEqual(autocompleteTags(catalog,'соб',['собаки']).map(i=>i.tag),['уход за собаками']);
 assert.equal(autocompleteTags(catalog,'звё')[0].tag,'звезды');assert.deepEqual(autocompleteTags(catalog,''),[]);
});
test('suggests existing topics from title and text with common Russian word forms',()=>{
 const suggestions=suggestTags(catalog,{title:'Как ухаживать за собакой',description:'Забота о питомцах',text:'Собаки — домашние животные.'});
 assert.ok(suggestions.some(i=>i.tag==='собаки'));assert.ok(suggestions.some(i=>i.tag==='животные'));assert.ok(suggestions.some(i=>i.tag==='питомцы'));assert.ok(!suggestions.some(i=>i.tag==='звезды'));
 assert.equal(suggestions[0].tag,'собаки');
});
test('does not invent tags or auto-add selected themes and matches multi-word topics',()=>{
 assert.ok(suggestTags(catalog,{title:'Правильно мыть руки'}).some(i=>i.tag==='мытье рук'));
 assert.deepEqual(suggestTags(catalog,{title:'Совсем другая тема'}),[]);
 assert.ok(!suggestTags(catalog,{title:'Собаки'},['собаки']).some(i=>i.tag==='собаки'));
});
