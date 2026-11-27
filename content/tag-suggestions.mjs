import { normalizeTags } from './tags.mjs';

const fold = value => String(value || '').normalize('NFKC').toLocaleLowerCase('ru').replaceAll('ё', 'е').trim().replace(/\s+/g, ' ');
export function collectTagCatalog(items) {
  const counts = new Map();
  for (const item of items) {
    if (item.status === 'trashed') continue;
    let tags; try { tags = normalizeTags(item.tags); } catch { continue; }
    for (const tag of tags) counts.set(tag, (counts.get(tag) || 0) + 1);
  }
  return [...counts].map(([tag, count]) => ({tag, count})).sort((a,b) => b.count-a.count || a.tag.localeCompare(b.tag,'ru'));
}

export function autocompleteTags(catalog, query, selected = [], limit = 6) {
  query = fold(query);
  if (!query) return [];
  const excluded = new Set(normalizeTags(selected));
  const rank = tag => tag.startsWith(query) ? 2 : tag.split(/[ -]/).some(word => word.startsWith(query)) ? 1 : 0;
  return catalog.filter(item => !excluded.has(item.tag) && rank(item.tag))
    .sort((a,b) => rank(b.tag)-rank(a.tag) || b.count-a.count || a.tag.localeCompare(b.tag,'ru')).slice(0,limit);
}

const stopWords = new Set(['для','при','про','или','как','что','это','его','все','без','под','над']);
const words = value => fold(value).match(/[\p{L}\p{N}]+/gu) || [];
function stem(word) {
  if (!/^[а-я]+$/.test(word)) return word;
  const root = word.replace(/(иями|ями|ами|ого|ему|ому|ыми|ими|иях|ах|ях|ость|ение|ения|ией|ия|ии|ые|ие|ое|ая|яя|ый|ий|ой|ых|их|ов|ев|ей|ам|ям|ом|ем|ую|юю|а|я|ы|и|е|о|у|ю|ь)$/,'').replace(/[ьй]$/,'');
  return root.length >= 3 ? root : word;
}
function roots(value) {
  const result = new Set();
  for (const word of words(value)) {
    const root = stem(word); result.add(root);
    for (let length = Math.max(4,root.length-4); length < root.length; length++) result.add(root.slice(0,length));
  }
  return result;
}
export function suggestTags(catalog, material, selected = [], limit = 6) {
  const excluded = new Set(normalizeTags(selected));
  const title = roots(material.title), description = roots(material.description), body = roots(material.text);
  const all = new Set([...title,...description,...body]);
  const score = tag => {
    const terms = words(tag).filter(word => word.length >= 3 && !stopWords.has(word)).map(stem);
    if (!terms.length || !terms.every(term => all.has(term))) return 0;
    return (terms.every(term => title.has(term)) ? 12 : 0) + (terms.every(term => description.has(term)) ? 6 : 0) + 2;
  };
  return catalog.filter(item => !excluded.has(item.tag)).map(item => ({...item, score:score(item.tag)}))
    .filter(item => item.score > 0).sort((a,b) => b.score-a.score || b.count-a.count || a.tag.localeCompare(b.tag,'ru')).slice(0,limit);
}
