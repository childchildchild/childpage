const colors = new Set(['#222334', '#d73c3c', '#e77b1e', '#c69a00', '#25834a', '#2962c8', '#7a4da3']);
const marks = new Set(['bold', 'italic', 'underline', 'strike']);
const blockTypes = new Set(['paragraph', 'heading', 'list', 'image', 'carousel']);

function boundedText(value, maxLength) {
  if (typeof value !== 'string' || value.length > maxLength) throw new Error('Проверьте текст статьи.');
  return value;
}

function safeMediaSource(value) {
  const source = boundedText(value, 1000);
  const parts = source.split('/');
  if (parts[0] === 'assets' && parts.length > 1 && parts.slice(1).every(part => part && part !== '.' && part !== '..' && /^[A-Za-z0-9._-]+$/.test(part))) return source;
  try {
    if (new URL(source).protocol === 'https:') return source;
  } catch {}
  throw new Error('В статье разрешены только HTTPS-ссылки и файлы из assets/.');
}

function safeLink(value) {
  const href = boundedText(value, 1000);
  try {
    if (new URL(href).protocol === 'https:') return href;
  } catch {}
  if (/^\/(?!\/)[A-Za-z0-9/_?&=.%#-]*$/.test(href)) return href;
  throw new Error('Ссылка в статье должна вести на HTTPS-адрес или страницу сайта.');
}

function normalizeRuns(value, total) {
  if (!Array.isArray(value) || value.length > 1000) throw new Error('Проверьте формат текста статьи.');
  return value.map(run => {
    const text = boundedText(run?.text, 5000);
    total.value += text.length;
    if (total.value > 30000) throw new Error('Текст статьи слишком большой.');
    const normalized = { text };
    if (run.marks !== undefined) {
      if (!Array.isArray(run.marks) || run.marks.some(mark => !marks.has(mark))) throw new Error('Проверьте форматирование текста статьи.');
      normalized.marks = [...new Set(run.marks)];
    }
    if (run.color !== undefined) {
      if (!colors.has(run.color)) throw new Error('Выберите цвет текста из палитры.');
      normalized.color = run.color;
    }
    if (run.href !== undefined) normalized.href = safeLink(run.href);
    return normalized;
  }).filter(run => run.text.length > 0);
}

export function normalizeRichBlocks(value) {
  if (!Array.isArray(value) || value.length > 500) throw new Error('Проверьте блоки статьи.');
  const total = { value: 0 };
  return value.map(block => {
    if (!blockTypes.has(block?.type)) throw new Error('Неизвестный блок статьи.');
    if (block.type === 'paragraph' || block.type === 'heading') {
      return { type: block.type, runs: normalizeRuns(block.runs, total) };
    }
    if (block.type === 'list') {
      if (typeof block.ordered !== 'boolean' || !Array.isArray(block.items) || block.items.length > 100) throw new Error('Проверьте список статьи.');
      return { type: 'list', ordered: block.ordered, items: block.items.map(item => normalizeRuns(item, total)) };
    }
    if (block.type === 'image') {
      const alt = boundedText(block.alt || '', 200);
      total.value += alt.length;
      if (total.value > 30000) throw new Error('Текст статьи слишком большой.');
      return { type: 'image', src: safeMediaSource(block.src), alt };
    }
    if (!Array.isArray(block.images) || block.images.length < 2 || block.images.length > 12) throw new Error('В карусели должно быть от 2 до 12 изображений.');
    const images = block.images.map(image => {
      const alt = boundedText(image?.alt || '', 200);
      total.value += alt.length;
      if (total.value > 30000) throw new Error('Текст статьи слишком большой.');
      return { src: safeMediaSource(image?.src), alt };
    });
    return { type: 'carousel', images };
  });
}

export function hasRichText(blocks) {
  return blocks.some(block => {
    const runs = block.type === 'list' ? block.items.flat() : block.runs || [];
    return runs.some(run => run.text.trim().length > 0);
  });
}

export const richTextColors = [...colors];

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

function renderRuns(runs) {
  return runs.map(run => {
    let html = escapeHtml(run.text);
    if (run.marks?.includes('bold')) html = `<strong>${html}</strong>`;
    if (run.marks?.includes('italic')) html = `<em>${html}</em>`;
    if (run.marks?.includes('underline')) html = `<u>${html}</u>`;
    if (run.marks?.includes('strike')) html = `<s>${html}</s>`;
    if (run.color) html = `<span style="color:${run.color}">${html}</span>`;
    if (run.href) html = `<a href="${escapeHtml(run.href)}" target="_blank" rel="noopener noreferrer">${html}</a>`;
    return html;
  }).join('');
}

export function renderRichBody(blocks, prefix = '') {
  return normalizeRichBlocks(blocks).map(block => {
    if (block.type === 'paragraph') return `<p>${renderRuns(block.runs)}</p>`;
    if (block.type === 'heading') return `<h2>${renderRuns(block.runs)}</h2>`;
    if (block.type === 'list') {
      const tag = block.ordered ? 'ol' : 'ul';
      return `<${tag}>${block.items.map(item => `<li>${renderRuns(item)}</li>`).join('')}</${tag}>`;
    }
    if (block.type === 'image') {
      const src = block.src.startsWith('assets/') ? `${prefix}${block.src}` : block.src;
      return `<figure class="article-media"><img src="${escapeHtml(src)}" alt="${escapeHtml(block.alt)}"></figure>`;
    }
    const images = block.images.map((image, index) => {
      const src = image.src.startsWith('assets/') ? `${prefix}${image.src}` : image.src;
      return `<figure class="article-carousel-slide"><div class="article-carousel-frame"><img src="${escapeHtml(src)}" alt="${escapeHtml(image.alt)}"></div><figcaption>${index + 1} / ${block.images.length}</figcaption></figure>`;
    }).join('');
    return `<section class="article-carousel" data-carousel><button type="button" class="article-carousel-arrow previous" data-carousel-previous aria-label="Предыдущее фото">‹</button><div class="article-carousel-track" tabindex="0">${images}</div><button type="button" class="article-carousel-arrow next" data-carousel-next aria-label="Следующее фото">›</button></section>`;
  }).join('');
}
