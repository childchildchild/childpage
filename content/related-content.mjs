export function materialType(item) {
  return item.cardType || (item.type === 'article' && item.category === 'tales' ? 'tale' : item.type);
}

export function relatedMaterials(items, current, limit = 6) {
  const ages = current.ages || [];
  const score = item => (item.category === current.category ? 16 : 0)
    + (materialType(item) === materialType(current) ? 6 : 0)
    + (item.type === current.type ? 2 : 0)
    + (item.ages || []).filter(age => ages.includes(age)).length;
  return items.filter(item => item.id !== current.id && item.status === 'published' && item.type !== 'story'
    && (!ages.length || !item.ages?.length || item.ages.some(age => ages.includes(age))))
    .sort((a, b) => score(b) - score(a) || Date.parse(b.publishedAt) - Date.parse(a.publishedAt) || a.id.localeCompare(b.id))
    .slice(0, limit);
}
