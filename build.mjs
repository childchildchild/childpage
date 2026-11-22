import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeRichBlocks, renderRichBody } from './content/rich-content.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const dist = join(root, 'dist');
const source = JSON.parse(await readFile(join(root, 'content', 'content.json'), 'utf8'));
if (source.version !== 1 || !Array.isArray(source.items)) throw new Error('Invalid content/content.json');

const types = new Set(['article', 'story', 'video', 'audio', 'game']);
const statuses = new Set(['draft', 'planned', 'published', 'trashed']);
const ids = new Set();
for (const item of source.items) {
  if (!/^[a-z0-9][a-z0-9-]{1,63}$/.test(item.id) || ids.has(item.id)) throw new Error(`Invalid or duplicate id: ${item.id}`);
  ids.add(item.id);
  if (!types.has(item.type) || !statuses.has(item.status) || typeof item.title !== 'string') throw new Error(`Invalid item: ${item.id}`);
  if (item.status === 'published' && !Number.isFinite(Date.parse(item.publishedAt))) throw new Error(`Published item needs a date: ${item.id}`);
  if (item.bodyBlocks !== undefined) item.bodyBlocks = normalizeRichBlocks(item.bodyBlocks);
}

const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const safePath = value => {
  const path = String(value || '');
  if (/^assets\/[a-zA-Z0-9/_\-.]+$/.test(path)) return path;
  if (/^https:\/\//.test(path)) return path;
  return '';
};
const urlFor = item => item.id === 'handwashing' ? 'handwashing.html' : `read/${item.id}.html`;
const published = source.items.filter(item => item.status === 'published');
const publicItems = source.items.filter(item => item.status === 'published' || item.status === 'planned').map(item => ({
  id: item.id,
  type: item.type,
  status: item.status,
  title: item.title,
  description: item.description || '',
  category: item.category || 'more',
  ages: item.ages || [],
  image: safePath(item.image),
  label: item.label || '',
  linkedId: item.linkedId || '',
  publishedAt: item.publishedAt || '',
  url: item.type === 'story' ? '' : item.status === 'published' ? urlFor(item) : '',
}));

const linked = new Map(publicItems.filter(item => item.status === 'published').map(item => [item.id, item]));
for (const item of publicItems.filter(item => item.type === 'story')) {
  item.link = linked.get(item.linkedId)?.url || '';
}

const cards = publicItems.filter(item => item.status === 'published' && item.type !== 'story').sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
const planned = publicItems.filter(item => item.status === 'planned' && item.type !== 'story');
const jsonScript = (name, value) => `window.${name} = ${JSON.stringify(value, null, 2).replace(/</g, '\\u003c')};\n`;
await writeFile(join(dist, 'content-data.js'), jsonScript('siteContent', publicItems));
await writeFile(join(dist, 'articles-data.js'), jsonScript('siteArticles', cards));

const inline = text => escape(text).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
function renderBody(markdown) {
  const lines = String(markdown || '').replace(/\r/g, '').split('\n');
  let html = '';
  let list = '';
  const closeList = () => { if (list) { html += `</${list}>`; list = ''; } };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { closeList(); continue; }
    if (line.startsWith('## ')) { closeList(); html += `<h2>${inline(line.slice(3))}</h2>`; continue; }
    const numbered = line.match(/^\d+\. (.+)$/);
    const bullet = line.match(/^[-*] (.+)$/);
    if (numbered || bullet) {
      const kind = numbered ? 'ol' : 'ul';
      if (list !== kind) { closeList(); html += `<${kind}>`; list = kind; }
      html += `<li>${inline((numbered || bullet)[1])}</li>`;
      continue;
    }
    closeList();
    html += `<p>${inline(line)}</p>`;
  }
  closeList();
  return html;
}

function renderPage(item) {
  const kind = { article: 'Статья', video: 'Видео', audio: 'Аудио', game: 'Игра' }[item.type];
  const title = escape(item.title);
  const image = safePath(item.image);
  const media = safePath(item.mediaUrl);
  const link = safePath(item.gameUrl);
  const prefix = item.id === 'handwashing' ? '' : '../';
  const body = Array.isArray(item.bodyBlocks) ? renderRichBody(item.bodyBlocks, prefix) : renderBody(item.body);
  const photo = image ? `<img class="article-photo" src="${escape(prefix + image)}" alt="${escape(item.imageAlt || '')}">` : '';
  let player = '';
  if (item.type === 'video' && media) player = `<video class="content-player" controls playsinline preload="metadata" ${image ? `poster="${escape(prefix + image)}"` : ''} src="${escape(media.startsWith('assets/') ? prefix + media : media)}"></video>`;
  if (item.type === 'audio' && media) player = `<audio class="content-audio" controls preload="metadata" src="${escape(media.startsWith('assets/') ? prefix + media : media)}"></audio>`;
  if (item.type === 'game' && link) player = `<a class="article-home" href="${escape(link.startsWith('assets/') ? prefix + link : link)}" ${link.startsWith('https://') ? 'target="_blank" rel="noopener noreferrer"' : ''}>Открыть игру</a>`;
  return `<!doctype html>
<html lang="ru"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover"><meta name="color-scheme" content="light">
<meta name="article:published" content="${escape(item.publishedAt)}"><meta name="article:title" content="${title}"><meta name="article:description" content="${escape(item.description || '')}"><meta name="article:image" content="${escape(image)}">
<title>${title} — Детская страница</title><link rel="stylesheet" href="${prefix}content-page.css?v=20261122-2"></head>
<body><main class="article-page"><header class="article-header"><a class="article-back" href="${prefix}index.html" aria-label="На главную"><svg viewBox="0 0 40 40" aria-hidden="true"><path d="M20 5 5 20l15 15M6 20h30"/></svg></a><span>${escape(item.label || kind)}</span></header>
<article>${photo}<div class="article-body"><h1>${title}</h1><p class="article-intro">${escape(item.description || '')}</p>${player}<div class="article-text">${body}</div><a class="article-home" href="${prefix}index.html">На главную</a></div></article></main><script src="${prefix}article-carousel.js" defer></script></body></html>`;
}

await mkdir(join(dist, 'read'), { recursive: true });
for (const item of published.filter(item => item.type !== 'story')) {
  await writeFile(join(dist, urlFor(item)), renderPage(item));
}
console.log(`Built ${cards.length} published item(s), ${planned.length} planned item(s), ${published.filter(item => item.type === 'story').length} story/stories.`);
