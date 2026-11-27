export function normalizeTags(value = []) {
  if (!Array.isArray(value)) throw new Error('Темы нужно передать списком.');
  const tags = [];
  for (const raw of value) {
    if (typeof raw !== 'string') throw new Error('Каждая тема должна быть текстом.');
    const tag = raw.normalize('NFKC').toLocaleLowerCase('ru').replaceAll('ё', 'е').replace(/[–—]/g, '-').trim().replace(/\s+/g, ' ');
    if (!tag) continue;
    if (tag.length > 40 || !/^[\p{L}\p{N}][\p{L}\p{N} -]*$/u.test(tag)) throw new Error('Тема — до 40 символов: буквы, цифры, пробелы и дефисы.');
    if (!tags.includes(tag)) tags.push(tag);
  }
  if (tags.length > 10) throw new Error('Оставьте не больше 10 тем для одного материала.');
  return tags;
}
