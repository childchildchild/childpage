import { initUI, syncSelects, ask } from './ui.js';
import { initPhotoCarousel } from '../article-carousel.js?v=20261127-2';
import { cropImage } from './crop.js';
import { normalizeTags } from '../content-tags.js?v=20261127-1';

const apiUrl = '/api/admin';
const $ = selector => document.querySelector(selector);
const labels = { article: 'Статья', story: 'Сторис', video: 'Видео', audio: 'Аудио', game: 'Игра' };
const states = { published: 'Опубликовано', draft: 'Черновик', planned: 'Заготовка', trashed: 'В корзине' };
const contentForm = $('#content-form');
const articleEditor = $('#article-editor');
const trashLifetime = 7 * 24 * 60 * 60 * 1000;
const richColors = new Set(['#222334', '#d73c3c', '#e77b1e', '#c69a00', '#25834a', '#2962c8', '#7a4da3']);
let content = { version: 1, items: [] };
let sha = '';
let currentId = '';
let typeFilter = 'all';
let previewMode = 'card';
let noticeTimer;
let editorGeneration = 0;
let savedEditorSnapshot = '';
let mutationBusy = false;
let releaseMutation = null;
let previewTimer = 0;
let previewRevision = 0;
let mediaOperation = 0;
let listScrollY = 0;
let loadingContent = false;
const filterTitles = { all: 'Все материалы', article: 'Статьи', story: 'Сторис', video: 'Видео', audio: 'Аудио', game: 'Игры', trash: 'Корзина' };

function editorOpen() { return !$('#app-view').hidden && !$('#editor-view').hidden; }
function editorSnapshot() {
  const item = readForm('draft');
  for (const key of ['id', 'status', 'publishedAt', 'updatedAt']) delete item[key];
  return JSON.stringify(item);
}
function editorHasChanges() {
  return editorOpen() && Boolean(savedEditorSnapshot) && (editorSnapshot() !== savedEditorSnapshot || Boolean(pendingCoverUrl) || Boolean(coverUploadPromise) || Boolean(storyVideoUploadPromise) || richUploads.size > 0);
}
function updateSaveState() {
  const state = $('#editor-save-state');
  if (!state || mutationBusy) return;
  const message = editorHasChanges() ? 'Есть несохранённые изменения' : currentId ? 'Все изменения сохранены' : 'Новый материал';
  if (state.textContent !== message) state.textContent = message;
  state.classList.toggle('has-changes', editorHasChanges());
}
async function allowNavigation() {
  if (mutationBusy) { notice('Дождитесь завершения операции.'); return false; }
  return !editorHasChanges() || await ask({title:'Выйти без сохранения?', message:'В материале есть изменения. Сохраните их перед выходом или продолжите без сохранения.', action:'Выйти без сохранения', danger:true});
}
function invalidateEditorMedia() {
  clearTimeout(previewTimer);
  previewRevision++;
  editorGeneration++;
  mediaOperation++;
  coverUploadId++;
  storyVideoUploadId++;
  storyVideoUploadPromise = null;
  coverUploadPromise = null;
  richUploads.clear();
  if (pendingCoverUrl && ![...localImageUrls.values()].includes(pendingCoverUrl)) URL.revokeObjectURL(pendingCoverUrl);
  pendingCoverUrl = '';
}
function beginMutation(message) {
  if (mutationBusy) return false;
  mutationBusy = true;
  const controls = [...$('#app-view').querySelectorAll('button,input,select,textarea')].map(control => [control, control.disabled]);
  controls.forEach(([control]) => { control.disabled = true; });
  const editable = articleEditor.contentEditable;
  articleEditor.contentEditable = 'false';
  contentForm.setAttribute('aria-busy', 'true');
  $('#editor-save-state').textContent = message;
  releaseMutation = () => {
    controls.forEach(([control, disabled]) => { control.disabled = disabled; });
    articleEditor.contentEditable = editable;
    contentForm.removeAttribute('aria-busy');
  };
  notice(message);
  return true;
}
function endMutation() {
  releaseMutation?.();
  releaseMutation = null;
  mutationBusy = false;
  $('#crop-cover').disabled = !contentForm.elements.image.value.trim();
  updateSaveState();
}
async function showList(force = false, keepNotice = false) {
  if (!force && !(await allowNavigation())) return;
  if (!keepNotice) { clearTimeout(noticeTimer); $('#notice').classList.remove('show', 'error'); }
  const focusId = currentId;
  invalidateEditorMedia();
  savedEditorSnapshot = '';
  $('#editor-view').hidden = true;
  $('#list-view').hidden = false;
  $('#view-title').textContent = filterTitles[typeFilter];
  renderList();
  window.scrollTo({ top: listScrollY, behavior: 'instant' });
  [...document.querySelectorAll('.item-row[data-item-id]')].find(row => row.dataset.itemId === focusId)?.focus({ preventScroll: true });
}
function clearFormError() {
  $('#editor-validation').hidden = true;
  contentForm.querySelectorAll('[aria-invalid="true"]').forEach(control => { control.removeAttribute('aria-invalid'); control.removeAttribute('aria-describedby'); });
}
function showFormError(error) {
  const control = error.field === 'body' ? articleEditor : contentForm.elements[error.field];
  const summary = $('#editor-validation');
  summary.textContent = error.message;
  summary.hidden = false;
  if (control) {
    control.setAttribute('aria-invalid', 'true');
    control.setAttribute('aria-describedby', summary.id);
    control.focus({ preventScroll: true });
    control.scrollIntoView({ block: 'center', behavior: 'instant' });
  }
  notice(error.message, true);
}
const localImageUrls = new Map();
let pendingCoverUrl = '';
let coverUploadId = 0;
let coverUploadPromise = null;
let storyVideoUploadPromise = null;
let storyVideoUploadId = 0;
const localVideoUrls = new Map();
const richUploads = new Set();

function notice(message, error = false) {
  const node = $('#notice');
  node.textContent = message;
  node.classList.toggle('error', error);
  node.classList.add('show');
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => node.classList.remove('show'), 6000);
}
async function request(action, body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45000);
  try {
    const response = await fetch(`${apiUrl}?action=${encodeURIComponent(action)}`, {
      method: body ? 'POST' : 'GET', credentials: 'same-origin', signal: controller.signal,
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify({ action, ...body }) : undefined,
    });
    const result = await response.json().catch(() => null);
    if (!response.ok) {
      const message = response.status === 409 ? 'Материалы уже изменены в другой вкладке. Ваши правки остались в форме. Скопируйте их перед обновлением списка.'
        : response.status === 401 ? (action === 'login' ? result?.error || 'Проверьте логин и пароль.' : 'Сеанс закончился. Правки остались в форме. Скопируйте их перед повторным входом.')
        : result?.error || 'Не удалось связаться с сервером. Повторите попытку.';
      const error = new Error(message); error.status = response.status; throw error;
    }
    if (!result || typeof result !== 'object') throw new Error('Сервер прислал непонятный ответ. Повторите попытку.');
    return result;
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('Сервер не ответил вовремя. Проверьте соединение и повторите попытку; правки остались в форме.');
    if (error instanceof TypeError) throw new Error('Нет связи с сервером. Проверьте интернет и повторите попытку.');
    throw error;
  } finally { clearTimeout(timer); }
}
function setView(loggedIn) {
  $('#admin-loading').hidden = true;
  $('#login-view').hidden = loggedIn;
  $('#app-view').hidden = !loggedIn;
}
async function loadContent() {
  const result = await request('content');
  if (result.content?.version !== 1 || !Array.isArray(result.content.items)) throw new Error('Не удалось прочитать список материалов. Повторите вход.');
  content = result.content;
  sha = result.sha;
  renderList();
}
async function refreshContent() {
  if (loadingContent) return;
  loadingContent = true;
  $('#content-loading').hidden = false;
  $('#content-load-error').hidden = true;
  $('#retry-content').disabled = true;
  $('#new-item').disabled = true;
  try { await loadContent(); $('#new-item').disabled = false; }
  catch (error) { $('#content-error-message').textContent = error.message; $('#content-load-error').hidden = false; }
  finally { loadingContent = false; $('#content-loading').hidden = true; $('#retry-content').disabled = false; }
}
function imageSource(path) {
  if (!path) return '';
  if (localImageUrls.has(path)) return localImageUrls.get(path);
  if (path.startsWith('blob:')) return path;
  if (path.startsWith('assets/')) return `../${path}`;
  if (path.startsWith('https://')) return path;
  return '';
}
function contentUrl(item) {
  if (item.status !== 'published') return '';
  if (item.type === 'story') return '../index.html';
  return item.id === 'handwashing' ? '../handwashing.html' : `../read/${item.id}.html`;
}
function statusBadge(status) {
  const badge = document.createElement('span');
  badge.className = `status ${status}`;
  badge.textContent = states[status];
  return badge;
}
function parseLegacyBody(markdown) {
  const blocks = [];
  let list;
  for (const raw of String(markdown || '').replace(/\r/g, '').split('\n')) {
    const line = raw.trim();
    if (!line) { list = undefined; continue; }
    const runs = line.split(/(\*\*.+?\*\*)/g).filter(Boolean).map(part => part.startsWith('**') && part.endsWith('**')
      ? { text: part.slice(2, -2), marks: ['bold'] }
      : { text: part });
    if (line.startsWith('## ')) {
      list = undefined;
      blocks.push({ type: 'heading', runs: parseLegacyBody(line.slice(3))[0]?.runs || [{ text: line.slice(3) }] });
      continue;
    }
    const numbered = line.match(/^\d+\. (.+)$/);
    const bullet = line.match(/^[-*] (.+)$/);
    if (numbered || bullet) {
      const ordered = Boolean(numbered);
      if (!list || list.ordered !== ordered) {
        list = { type: 'list', ordered, items: [] };
        blocks.push(list);
      }
      list.items.push(parseLegacyBody((numbered || bullet)[1])[0]?.runs || runs);
      continue;
    }
    list = undefined;
    blocks.push({ type: 'paragraph', runs });
  }
  return blocks;
}
function appendRichRuns(doc, parent, runs) {
  for (const run of runs || []) {
    let node = doc.createTextNode(run.text);
    if (run.href) {
      const link = doc.createElement('a'); link.href = run.href; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.append(node); node = link;
    }
    if (run.color && richColors.has(run.color)) {
      const color = doc.createElement('span'); color.style.color = run.color; color.append(node); node = color;
    }
    for (const mark of run.marks || []) {
      const tag = { bold: 'strong', italic: 'em', underline: 'u', strike: 's' }[mark];
      if (tag) { const wrapper = doc.createElement(tag); wrapper.append(node); node = wrapper; }
    }
    parent.append(node);
  }
}
function editorImageSource(source) {
  return imageSource(source);
}
function createRichMediaBlock(block) {
  const figure = document.createElement('figure');
  figure.className = block.type === 'carousel' ? 'rich-media-block rich-carousel-block' : 'rich-media-block';
  figure.dataset.richType = block.type;
  figure.contentEditable = 'false';
  const images = block.type === 'carousel' ? block.images : [block];
  const strip = document.createElement('div'); strip.className = 'rich-media-strip';
  for (const image of images) {
    const item = document.createElement('div');
    item.className = 'rich-media-item';
    const img = document.createElement('img');
    img.src = editorImageSource(image.src);
    img.alt = image.alt || '';
    img.dataset.src = image.src;
    img.dataset.alt = image.alt || '';
    const crop = document.createElement('button');
    crop.type = 'button';
    crop.dataset.cropRichImage = '';
    crop.textContent = 'Кадрировать';
    crop.setAttribute('aria-label', `Кадрировать фото: ${image.alt || 'без описания'}`);
    item.append(img, crop);
    strip.append(item);
  }
  figure.append(strip);
  const caption = document.createElement('figcaption');
  caption.textContent = block.type === 'carousel' ? `Карусель · ${images.length} фото` : 'Фото / GIF';
  const remove = document.createElement('button');
  remove.type = 'button'; remove.dataset.removeRichBlock = ''; remove.textContent = 'Удалить блок';
  figure.append(caption, remove);
  return figure;
}
function editorRuns(element) {
  const runs = [];
  function add(text, state) {
    if (!text) return;
    const last = runs[runs.length - 1];
    if (last && last.marks.join() === state.marks.join() && last.color === state.color && last.href === state.href) last.text += text;
    else runs.push({ text, ...state, marks: [...state.marks] });
  }
  function visit(node, state) {
    if (node.nodeType === Node.TEXT_NODE) { add(node.nodeValue, state); return; }
    if (node.nodeType !== Node.ELEMENT_NODE || node.tagName === 'BR') return;
    const next = { marks: [...state.marks], color: state.color, href: state.href };
    const tag = node.tagName.toLowerCase();
    const mark = { b: 'bold', strong: 'bold', i: 'italic', em: 'italic', u: 'underline', s: 'strike', strike: 'strike', del: 'strike' }[tag];
    if (mark && !next.marks.includes(mark)) next.marks.push(mark);
    const color = node.getAttribute('color') || node.style.color;
    if (color) {
      const hex = color.startsWith('#') ? color.toLowerCase() : (() => {
        const rgb = color.match(/\d+/g);
        return rgb?.length >= 3 ? `#${rgb.slice(0, 3).map(value => Number(value).toString(16).padStart(2, '0')).join('')}` : '';
      })();
      if (richColors.has(hex)) next.color = hex;
    }
    if (tag === 'a' && node.getAttribute('href')) next.href = node.getAttribute('href');
    for (const child of node.childNodes) visit(child, next);
  }
  visit(element, { marks: [], color: undefined, href: undefined });
  return runs;
}
function readRichBlocks() {
  const blocks = [];
  function readNode(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      if (node.nodeValue.trim()) blocks.push({ type: 'paragraph', runs: [{ text: node.nodeValue }] });
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const tag = node.tagName.toLowerCase();
    if (tag === 'figure' && node.dataset.richType) {
      const images = [...node.querySelectorAll('img')].map(img => ({ src: img.dataset.src || img.getAttribute('src')?.replace(/^\.\.\//, ''), alt: img.dataset.alt || img.alt || '' }));
      if (node.dataset.richType === 'carousel') blocks.push({ type: 'carousel', images });
      else if (images[0]) blocks.push({ type: 'image', ...images[0] });
    } else if (tag === 'ol' || tag === 'ul') {
      const items = [...node.children].filter(child => child.tagName === 'LI').map(editorRuns);
      if (items.length) blocks.push({ type: 'list', ordered: tag === 'ol', items });
    } else if (/^h[1-6]$/.test(tag)) {
      blocks.push({ type: 'heading', runs: editorRuns(node) });
    } else if (tag === 'p') {
      const runs = editorRuns(node);
      if (runs.some(run => run.text.trim())) blocks.push({ type: 'paragraph', runs });
    } else if (tag === 'div' && [...node.children].some(child => /^(p|h[1-6]|ul|ol|figure)$/.test(child.tagName.toLowerCase()))) {
      for (const child of node.childNodes) readNode(child);
    } else if (tag !== 'br') {
      const runs = editorRuns(node);
      if (runs.some(run => run.text.trim())) blocks.push({ type: 'paragraph', runs });
    }
  }
  for (const node of articleEditor.childNodes) readNode(node);
  return blocks;
}
function setRichEditor(item) {
  articleEditor.replaceChildren();
  const blocks = Array.isArray(item.bodyBlocks) ? item.bodyBlocks : parseLegacyBody(item.body);
  for (const block of blocks) {
    if (block.type === 'image' || block.type === 'carousel') {
      articleEditor.append(createRichMediaBlock(block));
      continue;
    }
    if (block.type === 'list') {
      const list = document.createElement(block.ordered ? 'ol' : 'ul');
      for (const runs of block.items) { const li = document.createElement('li'); appendRichRuns(document, li, runs); list.append(li); }
      articleEditor.append(list);
      continue;
    }
    const element = document.createElement(block.type === 'heading' ? 'h2' : 'p');
    appendRichRuns(document, element, block.runs);
    articleEditor.append(element);
  }
}
let savedEditorRange;
function rememberEditorSelection() {
  const selection = window.getSelection();
  if (selection?.rangeCount && articleEditor.contains(selection.anchorNode)) savedEditorRange = selection.getRangeAt(0).cloneRange();
}
function restoreEditorSelection() {
  articleEditor.focus();
  if (!savedEditorRange || !articleEditor.contains(savedEditorRange.commonAncestorContainer)) return;
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(savedEditorRange);
}
function insertRichBlock(block) {
  const figure = createRichMediaBlock(block);
  restoreEditorSelection();
  const selection = window.getSelection();
  const range = selection?.rangeCount ? selection.getRangeAt(0).cloneRange() : document.createRange();
  const selectedNode = range.startContainer.nodeType === Node.ELEMENT_NODE ? range.startContainer : range.startContainer.parentElement;
  const currentBlock = selectedNode?.closest('p,h1,h2,h3,h4,h5,h6,ul,ol');
  if (currentBlock && articleEditor.contains(currentBlock)) { range.setStartAfter(currentBlock); range.collapse(true); }
  else { range.selectNodeContents(articleEditor); range.collapse(false); }
  range.insertNode(figure);
  const paragraph = document.createElement('p'); paragraph.append(document.createElement('br')); figure.after(paragraph);
  const nextRange = document.createRange(); nextRange.setStart(paragraph, 0); nextRange.collapse(true);
  selection?.removeAllRanges(); selection?.addRange(nextRange);
  rememberEditorSelection();
  updatePreview();
}
function renderList() {
  const list = $('#items-list');
  list.replaceChildren();
  const query = $('#filter-text').value.toLocaleLowerCase('ru').trim();
  const status = $('#filter-status').value;
  const inTrash = typeFilter === 'trash';
  $('#filter-status').hidden = inTrash;
  const items = content.items.filter(item =>
    (inTrash ? item.status === 'trashed' : item.status !== 'trashed' && (typeFilter === 'all' || item.type === typeFilter)) &&
    (inTrash || status === 'all' || item.status === status) &&
    (!query || `${item.title || 'Без названия'} ${item.description}`.toLocaleLowerCase('ru').includes(query))
  );
  const sorted = [...items].sort((a, b) => inTrash
    ? Date.parse(b.deletedAt) - Date.parse(a.deletedAt)
    : (a.status === 'published' ? 0 : 1) - (b.status === 'published' ? 0 : 1) || Date.parse(b.publishedAt || b.updatedAt || 0) - Date.parse(a.publishedAt || a.updatedAt || 0));
  for (const item of sorted) {
    if (inTrash) {
      const entry = document.createElement('div');
      entry.className = 'trash-entry';
      const row = document.createElement('div');
      row.className = 'item-row';
      const thumb = document.createElement('span');
      thumb.className = 'item-thumb';
      const image = imageSource(item.image);
      if (image) { const img = document.createElement('img'); img.src = image; img.alt = ''; img.loading = 'lazy'; img.decoding = 'async'; thumb.append(img); }
      else thumb.textContent = '◦';
      const main = document.createElement('span');
      main.className = 'item-main';
      const title = document.createElement('strong');
      title.textContent = item.title || 'Без названия';
      const meta = document.createElement('small');
      const daysLeft = Math.max(0, Math.ceil((Date.parse(item.deletedAt) + trashLifetime - Date.now()) / 86400000));
      meta.textContent = `${labels[item.type]} · удаление через ${daysLeft} дн.`;
      main.append(title, meta);
      row.append(thumb, main, statusBadge(item.status));
      const actions = document.createElement('div');
      actions.className = 'trash-actions';
      const restore = document.createElement('button');
      restore.type = 'button'; restore.className = 'secondary'; restore.textContent = 'Восстановить';
      restore.addEventListener('click', () => restoreItem(item.id));
      const destroy = document.createElement('button');
      destroy.type = 'button'; destroy.className = 'danger-text'; destroy.textContent = 'Удалить навсегда';
      destroy.addEventListener('click', () => deletePermanently(item.id));
      actions.append(restore, destroy);
      entry.append(row, actions);
      list.append(entry);
      continue;
    }
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'item-row';
    row.dataset.itemId = item.id;
    row.addEventListener('click', () => openEditor(item.id));
    const thumb = document.createElement('span');
    thumb.className = 'item-thumb';
    const image = imageSource(item.image);
    if (image) { const img = document.createElement('img'); img.src = image; img.alt = ''; img.loading = 'lazy'; img.decoding = 'async'; thumb.append(img); }
    else thumb.textContent = '◦';
    const main = document.createElement('span');
    main.className = 'item-main';
    const title = document.createElement('strong');
    title.textContent = item.title || 'Без названия';
    const meta = document.createElement('small');
    meta.textContent = labels[item.type] + (item.publishedAt && item.status === 'published' ? ` · ${new Date(item.publishedAt).toLocaleDateString('ru-RU')}` : '');
    main.append(title, meta);
    const arrow = document.createElement('span'); arrow.className = 'item-arrow'; arrow.textContent = 'Редактировать';
    row.append(thumb, main, statusBadge(item.status), arrow);
    list.append(row);
  }
  $('#empty-list').hidden = sorted.length !== 0;
  const hasFilters = Boolean(query) || (!inTrash && status !== 'all');
  $('#empty-list').textContent = hasFilters ? 'По этим условиям ничего не найдено. Попробуйте другой запрос или сбросьте фильтры.'
    : inTrash ? 'Корзина пуста.' : 'В этом разделе пока нет материалов. Можно добавить первый.';
  $('#clear-filters').hidden = !hasFilters;
  document.querySelectorAll('.side-nav button').forEach(button => {
    button.classList.toggle('active', button.dataset.filter === typeFilter);
    if (button.dataset.filter === typeFilter) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
  for (const type of ['article', 'story', 'video', 'audio', 'game']) $(`#count-${type}`).textContent = content.items.filter(item => item.type === type && item.status !== 'trashed').length;
  $('#count-all').textContent = content.items.filter(item => item.status !== 'trashed').length;
  $('#count-trash').textContent = content.items.filter(item => item.status === 'trashed').length;
  $('#stat-published').textContent = content.items.filter(item => item.status === 'published').length;
  $('#stat-draft').textContent = content.items.filter(item => item.status === 'draft').length;
  $('#stat-planned').textContent = content.items.filter(item => item.status === 'planned').length;
}
function updateTypeFields() {
  const type = contentForm.elements.type.value;
  contentForm.querySelectorAll('[data-for]').forEach(field => { field.hidden = !field.dataset.for.split(' ').includes(type); });
  $('#editor-title').textContent = `${currentId ? 'Редактирование' : 'Новый материал'}: ${labels[type].toLocaleLowerCase('ru')}`;
  updatePreview();
}
function updateStoryVideoPreview() {
  const field = contentForm.elements.storyVideoUrl;
  const source = field.value.trim();
  const preview = $('#story-video-preview');
  const url = localVideoUrls.get(source) || (source.startsWith('assets/') ? `../${source}` : source.startsWith('https://') ? source : '');
  if (preview.getAttribute('src') !== url) {
    preview.pause();
    if (url) preview.src = url;
    else preview.removeAttribute('src');
  }
  preview.hidden = !url;
  $('#story-video-status').textContent = url ? 'Видео выбрано' : 'Фото сторис';
}
function previewDocument(stylesheet) {
  const frame = $('#site-preview');
  const doc = frame.contentDocument;
  const css = new URL(`../${stylesheet}`, location.href).href;
  doc.open();
  doc.write(`<!doctype html><html lang="ru"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><link rel="stylesheet" href="${css}"><link rel="stylesheet" href="${new URL("../card-badges.css?v=20261127-3", location.href).href}"><link rel="stylesheet" href="${new URL("../assets/phosphor/bold/style.css", location.href).href}"><link rel="stylesheet" href="${new URL("preview.css?v=20261127-1", location.href).href}"></head><body></body></html>`);
  doc.close();
  return doc;
}
function appendFormattedText(doc, parent, text) {
  for (const part of text.split(/(\*\*.+?\*\*)/g)) {
    if (part.startsWith('**') && part.endsWith('**')) {
      const strong = doc.createElement('strong');
      strong.textContent = part.slice(2, -2);
      parent.append(strong);
    } else {
      parent.append(doc.createTextNode(part));
    }
  }
}
function renderPreviewBody(doc, container, markdown) {
  let list;
  for (const raw of String(markdown || '').replace(/\r/g, '').split('\n')) {
    const line = raw.trim();
    if (!line) { list = undefined; continue; }
    if (line.startsWith('## ')) {
      list = undefined;
      const heading = doc.createElement('h2');
      appendFormattedText(doc, heading, line.slice(3));
      container.append(heading);
      continue;
    }
    const numbered = line.match(/^\d+\. (.+)$/);
    const bullet = line.match(/^[-*] (.+)$/);
    if (numbered || bullet) {
      const kind = numbered ? 'ol' : 'ul';
      if (!list || list.tagName.toLowerCase() !== kind) {
        list = doc.createElement(kind);
        container.append(list);
      }
      const item = doc.createElement('li');
      appendFormattedText(doc, item, (numbered || bullet)[1]);
      list.append(item);
      continue;
    }
    list = undefined;
    const paragraph = doc.createElement('p');
    appendFormattedText(doc, paragraph, line);
    container.append(paragraph);
  }
}
function renderPreviewRichBody(doc, container, blocks) {
  for (const block of blocks) {
    if (block.type === 'paragraph' || block.type === 'heading') {
      const element = doc.createElement(block.type === 'heading' ? 'h2' : 'p');
      appendRichRuns(doc, element, block.runs);
      container.append(element);
    } else if (block.type === 'list') {
      const list = doc.createElement(block.ordered ? 'ol' : 'ul');
      for (const runs of block.items) { const item = doc.createElement('li'); appendRichRuns(doc, item, runs); list.append(item); }
      container.append(list);
    } else if (block.type === 'image') {
      const figure = doc.createElement('figure'); figure.className = 'article-media';
      const img = doc.createElement('img'); img.src = imageSource(block.src); img.alt = block.alt; figure.append(img); container.append(figure);
    } else {
      const carousel = doc.createElement('section'); carousel.className = 'article-carousel'; carousel.dataset.carousel = ''; carousel.setAttribute('aria-label', 'Фотографии');
      const previous = doc.createElement('button'); previous.type = 'button'; previous.className = 'article-carousel-arrow previous'; previous.dataset.carouselPrevious = ''; previous.innerHTML = '<i class="ph-bold ph-caret-left" aria-hidden="true"></i>'; previous.setAttribute('aria-label', 'Предыдущее фото');
      const track = doc.createElement('div'); track.className = 'article-carousel-track'; track.tabIndex = 0;
      for (const image of block.images) {
        const slide = doc.createElement('figure'); slide.className = 'article-carousel-slide';
        const frame = doc.createElement('div'); frame.className = 'article-carousel-frame';
        const img = doc.createElement('img'); img.src = imageSource(image.src); img.alt = image.alt; frame.append(img); slide.append(frame);
        track.append(slide);
      }
      const next = doc.createElement('button'); next.type = 'button'; next.className = 'article-carousel-arrow next'; next.dataset.carouselNext = ''; next.innerHTML = '<i class="ph-bold ph-caret-right" aria-hidden="true"></i>'; next.setAttribute('aria-label', 'Следующее фото');
      const controls = doc.createElement('div'); controls.className = 'article-carousel-controls';
      const counter = doc.createElement('p'); counter.className = 'article-carousel-count'; counter.setAttribute('role', 'status'); counter.setAttribute('aria-live', 'polite');
      controls.append(previous, counter, next); carousel.append(track, controls); container.append(carousel);
    }
  }
}
function renderPreviewCard(doc, item) {
  doc.body.classList.add('admin-card-preview');
  const page = doc.createElement('main'); page.className = 'catalog-page';
  const section = doc.createElement('section'); section.className = 'catalog-content';
  const grid = doc.createElement('div'); grid.className = 'catalog-grid admin-card-grid';
  const card = doc.createElement('article'); card.className = 'catalog-card';
  const link = doc.createElement('a'); link.href = '#preview-page';
  const visual = doc.createElement('div'); visual.className = 'catalog-image';
  const image = imageSource(item.image);
  if (image) { const img = doc.createElement('img'); img.src = image; img.alt = item.imageAlt || ''; visual.append(img); }
  else visual.textContent = 'Ожидается изображение';
  const kind = doc.createElement('span'); kind.className = 'catalog-kind'; kind.textContent = labels[item.type];
  if (item.type !== 'story') window.childpageCardBadges.decorate(visual, item);
  const title = doc.createElement('h2'); title.textContent = item.title || 'Название материала';
  const description = doc.createElement('p'); description.textContent = item.description || 'Короткое описание материала';
  link.append(visual, ...(item.type === 'story' ? [kind] : []), title, description);
  link.addEventListener('click', event => { event.preventDefault(); previewMode = 'page'; updatePreview(); });
  card.append(link); grid.append(card); section.append(grid); page.append(section); doc.body.append(page);
}
function renderPreviewPage(doc, item) {
  const page = doc.createElement('main'); page.className = 'article-page';
  const header = doc.createElement('header'); header.className = 'article-header';
  const back = doc.createElement('a'); back.className = 'article-back'; back.href = '#preview-card'; back.setAttribute('aria-label', 'Вернуться к карточке');
  back.innerHTML = '<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M20 5 5 20l15 15M6 20h30"/></svg>';
  back.addEventListener('click', event => { event.preventDefault(); previewMode = 'card'; updatePreview(); });
  const label = doc.createElement('span'); label.textContent = item.label || labels[item.type];
  header.append(back, label);
  const article = doc.createElement('article');
  const image = imageSource(item.image);
  if (image) { const photo = doc.createElement('img'); photo.className = 'article-photo'; photo.src = image; photo.alt = item.imageAlt || ''; article.append(photo); }
  const body = doc.createElement('div'); body.className = 'article-body';
  const title = doc.createElement('h1'); title.textContent = item.title || 'Название материала';
  const intro = doc.createElement('p'); intro.className = 'article-intro'; intro.textContent = item.description || 'Короткое описание материала';
  body.append(title, intro);
  const media = item.mediaUrl?.startsWith('assets/') ? `../${item.mediaUrl}` : item.mediaUrl?.startsWith('https://') ? item.mediaUrl : '';
  if (item.type === 'video' && media) {
    const player = doc.createElement('video'); player.className = 'content-player'; player.controls = true; player.playsInline = true; player.preload = 'metadata'; player.src = media;
    if (image) player.poster = image;
    body.append(player);
  } else if (item.type === 'audio' && media) {
    const player = doc.createElement('audio'); player.className = 'content-audio'; player.controls = true; player.preload = 'metadata'; player.src = media; body.append(player);
  } else if (item.type === 'game' && item.gameUrl) {
    const game = doc.createElement('a'); game.className = 'article-home'; game.href = item.gameUrl; game.textContent = 'Открыть игру'; game.target = '_blank'; game.rel = 'noopener noreferrer'; body.append(game);
  }
  const text = doc.createElement('div'); text.className = 'article-text';
  if (Array.isArray(item.bodyBlocks)) renderPreviewRichBody(doc, text, item.bodyBlocks);
  else renderPreviewBody(doc, text, item.body);
  body.append(text);
  const home = doc.createElement('a'); home.className = 'article-home'; home.href = '#preview-card'; home.textContent = 'Вернуться к карточке';
  home.addEventListener('click', event => { event.preventDefault(); previewMode = 'card'; updatePreview(); });
  body.append(home); article.append(body); page.append(header, article); doc.body.append(page);
  page.querySelectorAll('[data-carousel]').forEach(initPhotoCarousel);
}
function schedulePreview() {
  updateSaveState();
  clearTimeout(previewTimer);
  previewTimer = setTimeout(updatePreview, 180);
}
function updatePreview() {
  clearTimeout(previewTimer);
  if ($('#editor-view').hidden) return;
  updateSaveState();
  updateStoryVideoPreview();
  const item = readForm('draft');
  if (pendingCoverUrl) item.image = pendingCoverUrl;
  $('#crop-cover').disabled = mutationBusy || !item.image;
  syncSelects();
  for (const button of document.querySelectorAll('[data-preview-view]')) button.classList.toggle('active', button.dataset.previewView === previewMode);
  const frame = $('#site-preview');
  const oldScroll = frame.contentDocument?.body?.dataset.previewMode === previewMode ? frame.contentWindow.scrollY : 0;
  const revision = ++previewRevision;
  frame.addEventListener('load', () => {
    if (revision === previewRevision) frame.contentWindow.scrollTo(0, oldScroll);
  }, { once: true });
  const doc = previewDocument(previewMode === 'card' ? 'catalog.css' : 'content-page.css');
  doc.body.dataset.previewMode = previewMode;
  if (previewMode === 'card') renderPreviewCard(doc, item);
  else renderPreviewPage(doc, item);
  const imagePreview = $('#image-preview');
  imagePreview.replaceChildren();
  const path = imageSource(item.image);
  if (path) { const img = document.createElement('img'); img.src = path; img.alt = ''; img.addEventListener('error', () => { if (img.isConnected) imagePreview.textContent = 'Фото не загрузилось. Проверьте ссылку.'; }, { once: true }); imagePreview.append(img); }
  else imagePreview.textContent = 'Нет изображения';
}
async function openEditor(id = '', type = 'article', force = false) {
  if (!force && !(await allowNavigation())) return;
  if (!force) { clearTimeout(noticeTimer); $('#notice').classList.remove('show', 'error'); }
  if (!editorOpen()) listScrollY = window.scrollY;
  invalidateEditorMedia();
  clearTimeout(previewTimer);
  previewRevision++;
  currentId = id;
  previewMode = 'card';
  const item = content.items.find(record => record.id === id) || { type, status: 'draft', ages: [] };
  contentForm.reset();
  for (const key of ['type', 'category', 'title', 'description', 'image', 'imageAlt', 'label', 'cardType', 'cardStatus', 'body', 'mediaUrl', 'gameUrl', 'linkedId']) {
    if (item[key] !== undefined && contentForm.elements[key]) contentForm.elements[key].value = item[key];
  }
  contentForm.elements.storyVideoUrl.value = item.type === 'story' ? item.mediaUrl || '' : '';
  contentForm.elements.tags.value = (item.tags || []).join(', ');
  setRichEditor(item);
  savedEditorRange = null;
  contentForm.querySelectorAll('input[name="ages"]').forEach(input => { input.checked = item.ages?.includes(input.value) || false; });
  const linked = $('#linked-item');
  linked.replaceChildren(new Option('Без кнопки перехода', ''));
  for (const candidate of content.items.filter(record => record.type !== 'story' && record.status === 'published')) linked.add(new Option(candidate.title, candidate.id));
  linked.value = item.linkedId || '';
  $('#editor-status').replaceWith(statusBadge(item.status));
  $('#editor-status')?.remove();
  const badge = $('.editor-head .status'); badge.id = 'editor-status';
  $('#delete-item').hidden = !id;
  $('#unpublish').hidden = item.status !== 'published';
  $('#save-draft').hidden = item.status === 'published';
  $('#publish').textContent = item.status === 'published' ? 'Сохранить на сайте' : 'Опубликовать';
  $('#save-draft').textContent = item.status === 'planned' ? 'Сохранить заготовку' : 'Сохранить черновик';
  const link = $('#public-link'); link.hidden = item.status !== 'published'; link.href = contentUrl(item);
  $('#list-view').hidden = true;
  $('#editor-view').hidden = false;
  $('#view-title').textContent = id ? item.title || 'Без названия' : 'Новый материал';
  updateTypeFields();
  clearFormError();
  savedEditorSnapshot = editorSnapshot();
  updateSaveState();
  window.scrollTo(0, 0);
}
function readForm(status) {
  const old = content.items.find(item => item.id === currentId) || {};
  const get = name => contentForm.elements[name].value.trim();
  const now = new Date().toISOString();
  return {
    ...old,
    id: old.id || `item-${crypto.randomUUID()}`,
    type: get('type'),
    cardType: get('cardType'),
    cardStatus: get('cardStatus'),
    status,
    title: get('title'),
    description: get('description'),
    category: get('category') || old.category || 'for_all',
    ages: [...contentForm.querySelectorAll('input[name="ages"]:checked')].map(input => input.value),
    tags: get('tags').split(/[,;\n]/).map(tag => tag.trim()).filter(Boolean),
    image: get('image'), imageAlt: get('imageAlt'), label: get('label'), body: get('body'),
    bodyBlocks: contentForm.elements.type.value === 'article' ? readRichBlocks() : old.bodyBlocks,
    linkedId: get('linkedId'), mediaUrl: get('type') === 'story' ? get('storyVideoUrl') : get('mediaUrl'), gameUrl: get('gameUrl'),
    publishedAt: status === 'published' ? old.publishedAt || now : old.publishedAt || '',
    updatedAt: now,
  };
}
function validMaterialUrl(value, mp4 = false) {
  if (/^assets\//.test(value)) {
    const parts = value.slice(7).split('/');
    return parts.every(part => part && part !== '.' && part !== '..' && /^[a-zA-Z0-9_.-]+$/.test(part)) && (!mp4 || /\.mp4$/i.test(value));
  }
  try { return new URL(value).protocol === 'https:'; } catch { return false; }
}
function validateItem(item) {
  try { item.tags = normalizeTags(item.tags); }
  catch (error) { return { message: error.message, field: 'tags' }; }
  if (!['published', 'planned'].includes(item.status)) return null;
  if (!item.title) return { message: 'Добавьте название материала.', field: 'title' };
  if (!item.description) return { message: 'Добавьте короткое описание для карточки.', field: 'description' };
  if (item.image && !validMaterialUrl(item.image)) return { message: 'Обложка должна быть файлом из assets/ или корректной HTTPS-ссылкой.', field: 'image' };
  if (item.status !== 'published') return null;
  if (item.type === 'article' && !item.bodyBlocks?.some(block => {
    const runs = block.type === 'list' ? block.items.flat() : block.runs || [];
    return runs.some(run => run.text.trim());
  })) return { message: 'Добавьте текст статьи.', field: 'body' };
  if (item.type === 'story' && !item.image) return { message: 'Добавьте фото сторис.', field: 'image' };
  if (item.type === 'story' && item.mediaUrl && !validMaterialUrl(item.mediaUrl, true)) return { message: 'Укажите прямую HTTPS-ссылку на MP4 или загруженный MP4 из assets/.', field: 'storyVideoUrl' };
  if (['video', 'audio'].includes(item.type) && !validMaterialUrl(item.mediaUrl)) return { message: 'Добавьте корректную HTTPS-ссылку на медиафайл или путь assets/.', field: 'mediaUrl' };
  if (item.type === 'game' && !validMaterialUrl(item.gameUrl)) return { message: 'Добавьте корректную HTTPS-ссылку на игру или путь assets/.', field: 'gameUrl' };
  return null;
}
async function save(status) {
  if (!beginMutation('Сохраняю материал…')) return;
  let savedId = '';
  let validationError;
  try {
    clearFormError();
    if (storyVideoUploadPromise || coverUploadPromise || richUploads.size) {
      $('#editor-save-state').textContent = 'Дожидаюсь загрузки файлов…';
      while (storyVideoUploadPromise || coverUploadPromise || richUploads.size) {
        await Promise.all([storyVideoUploadPromise, coverUploadPromise, ...richUploads].filter(Boolean));
      }
    }
    const item = readForm(status);
    validationError = validateItem(item);
    if (validationError) return;
    const index = content.items.findIndex(record => record.id === currentId);
    const updated = { version: 1, items: [...content.items] };
    if (index < 0) updated.items.push(item); else updated.items[index] = item;
    $('#editor-save-state').textContent = 'Отправляю изменения…';
    const result = await request('save', { content: updated, sha });
    content = updated; sha = result.sha; savedId = item.id;
    notice(status === 'published' ? 'Изменения сохранены и отправлены на сайт. Проверьте результат после его обновления.' : 'Черновик сохранён.');
  } catch (failure) { notice(failure.message, true); }
  finally {
    endMutation();
    if (validationError) showFormError(validationError);
    else if (savedId) { openEditor(savedId, 'article', true); renderList(); }
  }
}
async function persistContent(updated) {
  const result = await request('save', { content: updated, sha });
  content = updated;
  sha = result.sha;
  renderList();
}
async function removeItem() {
  if (mutationBusy) return;
  const item = content.items.find(record => record.id === currentId);
  if (!item || item.status === 'trashed' || !(await ask({title:'Переместить в корзину?', message:`«${item.title || 'Без названия'}» можно будет восстановить в течение 7 дней.`, action:'В корзину', danger:true}))) return;
  const trashedItem = { ...item, status: 'trashed', previousStatus: item.status, deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  const updated = { version: 1, items: content.items.map(record => record.id === item.id ? trashedItem : record) };
  if (!beginMutation('Перемещаю в корзину…')) return;
  let removed = false;
  try {
    await persistContent(updated);
    removed = true;
    notice('Материал перемещён в корзину. Он будет удалён окончательно через 7 дней.');
  } catch (error) { notice(error.message, true); }
  finally { endMutation(); if (removed) { showList(true, true); currentId = ''; } }
}
async function restoreItem(id) {
  const item = content.items.find(record => record.id === id && record.status === 'trashed');
  if (!item) return;
  const restored = { ...item, status: item.previousStatus, updatedAt: new Date().toISOString() };
  delete restored.previousStatus;
  delete restored.deletedAt;
  const updated = { version: 1, items: content.items.map(record => record.id === id ? restored : record) };
  if (!beginMutation('Восстанавливаю материал…')) return;
  try { await persistContent(updated); notice('Материал восстановлен.'); }
  catch (error) { notice(error.message, true); }
  finally { endMutation(); }
}
async function deletePermanently(id) {
  if (mutationBusy) return;
  const item = content.items.find(record => record.id === id && record.status === 'trashed');
  if (!item || !(await ask({title:'Удалить навсегда?', message:`«${item.title || 'Без названия'}» нельзя будет восстановить.`, action:'Удалить навсегда', danger:true}))) return;
  const updated = { version: 1, items: content.items.filter(record => record.id !== id) };
  if (!beginMutation('Удаляю материал…')) return;
  try { await persistContent(updated); notice('Материал удалён навсегда.'); }
  catch (error) { notice(error.message, true); }
  finally { endMutation(); }
}
async function uploadImageFile(file, previewUrl = '') {
  const supportedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif'];
  if (!supportedTypes.includes(file.type)) throw new Error('Поддерживаются JPG, PNG, WebP, AVIF и GIF.');
  if (file.size > 2_500_000) throw new Error('Файл должен быть меньше 2,5 МБ.');
  const localUrl = previewUrl || URL.createObjectURL(file);
  try {
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1]);
      reader.onerror = () => reject(new Error('Не удалось прочитать файл.'));
      reader.readAsDataURL(file);
    });
    const result = await request('upload', { mime: file.type, base64 });
    localImageUrls.set(result.path, localUrl);
    return result.path;
  } catch (error) {
    URL.revokeObjectURL(localUrl);
    throw error;
  }
}
async function uploadStoryVideo(file) {
  if (!file || mutationBusy) return;
  if (file.type !== 'video/mp4' || file.size > 2_500_000 || !file.size) { notice('Выберите MP4 до 2,5 МБ.', true); return; }
  const uploadId = ++storyVideoUploadId;
  const localUrl = URL.createObjectURL(file);
  const field = contentForm.elements.storyVideoUrl;
  const previousSource = field.value;
  field.value = localUrl;
  localVideoUrls.set(localUrl, localUrl);
  updateStoryVideoPreview();
  updateSaveState();
  notice('Загружаю видео…');
  const transfer = (async () => {
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1]);
      reader.onerror = () => reject(new Error('Не удалось прочитать видео.'));
      reader.readAsDataURL(file);
    });
    return request('upload', { mime: file.type, base64 });
  })();
  storyVideoUploadPromise = transfer;
  try {
    const result = await transfer;
    if (uploadId !== storyVideoUploadId) { localVideoUrls.delete(localUrl); URL.revokeObjectURL(localUrl); return; }
    localVideoUrls.set(result.path, localUrl);
    field.value = result.path;
    updateStoryVideoPreview();
    notice('Видео загружено. Сохраните сторис, чтобы оно появилось на сайте.');
  } catch (error) {
    localVideoUrls.delete(localUrl);
    URL.revokeObjectURL(localUrl);
    if (uploadId === storyVideoUploadId) { field.value = previousSource; updateStoryVideoPreview(); notice(error.message, true); }
  } finally {
    if (storyVideoUploadPromise === transfer) storyVideoUploadPromise = null;
    updateSaveState();
  }
}
async function uploadImage(file) {
  if (!file) return;
  const uploadId = ++coverUploadId;
  const localUrl = URL.createObjectURL(file);
  pendingCoverUrl = localUrl;
  updatePreview();
  notice('Загружаю фото…');
  const transfer = uploadImageFile(file, localUrl);
  coverUploadPromise = transfer;
  try {
    const path = await transfer;
    if (uploadId !== coverUploadId) {
      localImageUrls.delete(path);
      URL.revokeObjectURL(localUrl);
      return;
    }
    contentForm.elements.image.value = path;
    pendingCoverUrl = '';
    updatePreview();
    notice('Фото загружено. Сохраните материал, чтобы использовать его.');
  } catch (error) {
    URL.revokeObjectURL(localUrl);
    if (uploadId === coverUploadId) { pendingCoverUrl = ''; updatePreview(); notice(error.message, true); }
  } finally {
    if (coverUploadPromise === transfer) coverUploadPromise = null;
    updateSaveState();
  }
}
async function chooseCover(file) {
  if (!file || mutationBusy) return;
  const generation = editorGeneration;
  try {
    const result = await cropImage(file, { ratio: contentForm.elements.type.value === 'story' ? 'story' : 'card', caption: 'Настройте кадр обложки пальцем или мышью.' });
    if (generation === editorGeneration && editorOpen() && result instanceof File) await uploadImage(result);
  } catch (error) { if (generation === editorGeneration) notice(error.message, true); }
}
async function cropCurrentCover() {
  if (mutationBusy) return;
  const path = contentForm.elements.image.value.trim();
  if (!path) return;
  const generation = editorGeneration;
  try {
    const result = await cropImage(imageSource(path), { ratio: contentForm.elements.type.value === 'story' ? 'story' : 'card', caption: 'Измените кадр уже загруженной обложки.' });
    if (generation === editorGeneration && editorOpen() && result instanceof File) await uploadImage(result);
  } catch (error) { if (generation === editorGeneration) notice(error.message, true); }
}
async function cropRichPhoto(button) {
  if (mutationBusy) return;
  const generation = editorGeneration;
  const figure = button.closest('[data-rich-type]');
  const image = button.closest('.rich-media-item').querySelector('img');
  const oldSource = image.dataset.src;
  try {
    const result = await cropImage(imageSource(oldSource), { ratio: figure.dataset.richType === 'carousel' ? 'card' : 'original', caption: 'Кадрируйте это фото, не удаляя его из статьи.' });
    if (!(result instanceof File) || generation !== editorGeneration || !figure.isConnected) return;
    const localUrl = URL.createObjectURL(result);
    image.src = localUrl;
    const transfer = uploadImageFile(result, localUrl);
    richUploads.add(transfer);
    notice('Загружаю кадрированное фото…');
    try {
      const src = await transfer;
      if (generation !== editorGeneration || !figure.isConnected) return;
      image.dataset.src = src;
      image.src = imageSource(image.dataset.src);
      updatePreview();
      notice('Фото в статье обновлено. Сохраните материал.');
    } catch (error) {
      if (generation === editorGeneration && figure.isConnected) { image.src = imageSource(oldSource); notice(error.message, true); }
    } finally { richUploads.delete(transfer); updateSaveState(); }
  } catch (error) { if (generation === editorGeneration) notice(error.message, true); }
}
function httpsUrl(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error('Введите корректную HTTPS-ссылку.'); }
  if (url.protocol !== 'https:') throw new Error('Разрешены только HTTPS-ссылки.');
  return url.href;
}
function closeMediaDialog(dialogId) {
  const dialog = $(`#${dialogId}`);
  dialog.querySelector('form').reset();
  dialog.close();
}
async function insertRichImage() {
  if (mutationBusy) return;
  const generation = editorGeneration;
  const operation = ++mediaOperation;
  const stillCurrent = () => generation === editorGeneration && operation === mediaOperation && editorOpen();
  const file = $('#rich-media-file').files[0];
  const url = $('#rich-media-url').value.trim();
  const alt = $('#rich-media-alt').value.trim();
  if (file && url) { notice('Выберите файл или ссылку, но не оба варианта.', true); return; }
  const button = $('#rich-media-confirm');
  button.disabled = true;
  let transfer;
  try {
    const selected = file || httpsUrl(url);
    const cropped = await cropImage(selected, { ratio: 'original', caption: 'Выберите кадр фотографии для статьи.' });
    if (cropped === null || !stillCurrent()) return;
    transfer = cropped instanceof File ? uploadImageFile(cropped) : Promise.resolve(cropped);
    richUploads.add(transfer);
    updateSaveState();
    const src = await transfer;
    if (!stillCurrent()) return;
    insertRichBlock({ type: 'image', src, alt });
    closeMediaDialog('media-dialog');
    notice('Изображение добавлено в статью.');
  } catch (error) { if (stillCurrent()) notice(error.message, true); }
  finally { if (transfer) richUploads.delete(transfer); if (operation === mediaOperation) button.disabled = false; updateSaveState(); }
}
async function insertRichCarousel() {
  if (mutationBusy) return;
  const generation = editorGeneration;
  const operation = ++mediaOperation;
  const stillCurrent = () => generation === editorGeneration && operation === mediaOperation && editorOpen();
  const files = [...$('#rich-carousel-files').files];
  const urls = $('#rich-carousel-urls').value.split(/\r?\n/).map(value => value.trim()).filter(Boolean);
  if (files.length + urls.length < 2 || files.length + urls.length > 12) { notice('Добавьте в карусель от 2 до 12 изображений.', true); return; }
  const button = $('#rich-carousel-confirm');
  button.disabled = true;
  try {
    const sources = [...urls.map(httpsUrl), ...files];
    const cropped = [];
    for (const [index, source] of sources.entries()) {
      const result = await cropImage(source, { ratio: 'card', caption: `Кадрируйте фото ${index + 1} из ${sources.length}.` });
      if (result === null || !stillCurrent()) return;
      cropped.push({ value: result, alt: source instanceof File ? source.name.replace(/\.[^.]+$/, '') : `Фото ${index + 1}` });
    }
    const images = [];
    for (const [index, item] of cropped.entries()) {
      if (!stillCurrent()) return;
      if (item.value instanceof File) notice(`Загружаю фото ${index + 1} из ${cropped.length}…`);
      const transfer = item.value instanceof File ? uploadImageFile(item.value) : Promise.resolve(item.value);
      richUploads.add(transfer);
      updateSaveState();
      let src;
      try { src = await transfer; } finally { richUploads.delete(transfer); }
      if (!stillCurrent()) return;
      images.push({ src, alt: item.alt || `Фото ${index + 1}` });
    }
    insertRichBlock({ type: 'carousel', images });
    closeMediaDialog('carousel-dialog');
    notice('Карусель добавлена в статью.');
  } catch (error) { if (stillCurrent()) notice(error.message, true); }
  finally { if (operation === mediaOperation) button.disabled = false; updateSaveState(); }
}

$('#login-form').addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('button'); button.disabled = true;
  try {
    const result = await request('login', { user: form.elements.user.value, password: form.elements.password.value });
    form.elements.password.value = '';
    $('#signed-user').textContent = result.user;
    setView(true); await refreshContent();
  } catch (error) { notice(error.message, true); }
  finally { button.disabled = false; }
});
$('#logout').addEventListener('click', async () => {
  if (!(await allowNavigation()) || !beginMutation('Выхожу из панели…')) return;
  try { await request('logout', {}); typeFilter = 'all'; listScrollY = 0; showList(true); currentId = ''; setView(false); }
  catch (error) { notice(error.message, true); }
  finally { endMutation(); }
});
document.querySelectorAll('.side-nav button').forEach(button => button.addEventListener('click', async () => {
  if (!(await allowNavigation())) return;
  typeFilter = button.dataset.filter;
  listScrollY = 0;
  showList(true);
}));
$('#filter-text').addEventListener('input', renderList);
$('#filter-status').addEventListener('change', renderList);
$('#retry-content').addEventListener('click', refreshContent);
$('#clear-filters').addEventListener('click', () => { $('#filter-text').value = ''; $('#filter-status').value = 'all'; renderList(); $('#filter-text').focus(); });
$('#new-item').addEventListener('click', () => {
  if (mutationBusy) return;
  const dialog = $('#type-dialog'); dialog.returnValue = 'cancel'; dialog.showModal();
});
$('#type-dialog').addEventListener('close', event => { if (event.currentTarget.returnValue !== 'cancel' && labels[event.currentTarget.returnValue]) openEditor('', event.currentTarget.returnValue); });
$('#back-list').addEventListener('click', () => showList());
$('#item-type').addEventListener('change', updateTypeFields);
contentForm.addEventListener('input', event => {
  if (event.target.getAttribute('aria-invalid') === 'true' || event.target.closest('[aria-invalid="true"]')) clearFormError();
  schedulePreview();
});
contentForm.elements.image.addEventListener('input', () => {
  coverUploadId++;
  if (pendingCoverUrl) URL.revokeObjectURL(pendingCoverUrl);
  pendingCoverUrl = '';
});
contentForm.addEventListener('submit', event => event.preventDefault());
$('#save-draft').addEventListener('click', () => save($('#save-draft').textContent.includes('заготовку') ? 'planned' : 'draft'));
$('#publish').addEventListener('click', () => save('published'));
$('#unpublish').addEventListener('click', () => save('draft'));
$('#delete-item').addEventListener('click', removeItem);
$('#image-upload').addEventListener('change', event => chooseCover(event.target.files[0]));
$('#story-video-upload').addEventListener('change', event => { uploadStoryVideo(event.target.files[0]); event.target.value = ''; });
contentForm.elements.storyVideoUrl.addEventListener('input', () => { storyVideoUploadId++; });
$('#image-upload').addEventListener('change', event => { event.target.value = ''; });
$('#crop-cover').addEventListener('click', cropCurrentCover);
$('#image-preview').addEventListener('keydown', event => {
  if (['Enter', ' '].includes(event.key) && !mutationBusy) { event.preventDefault(); $('#image-upload').click(); }
});
$('#image-preview').addEventListener('click', () => { if (!mutationBusy) $('#image-upload').click(); });
document.querySelectorAll('.upload-label').forEach(label => {
  label.tabIndex = 0;
  label.setAttribute('role', 'button');
  label.addEventListener('keydown', event => {
    if (['Enter', ' '].includes(event.key) && !mutationBusy) { event.preventDefault(); label.querySelector('input[type="file"]').click(); }
  });
});
window.addEventListener('beforeunload', event => {
  if (editorHasChanges() || mutationBusy) { event.preventDefault(); event.returnValue = ''; }
});
document.addEventListener('click', async event => {
  const link = event.target.closest('a[href]');
  if (!link || event.defaultPrevented || event.ctrlKey || event.metaKey || event.shiftKey || event.button !== 0 || link.target === '_blank' || link.getAttribute('href').startsWith('#')) return;
  event.preventDefault();
  if (await allowNavigation()) { savedEditorSnapshot = ''; location.assign(link.href); }
});
$('#image-preview').addEventListener('dragover', event => {
  event.preventDefault();
  event.currentTarget.classList.add('is-dragging');
});
$('#image-preview').addEventListener('dragleave', event => {
  if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.classList.remove('is-dragging');
});
$('#image-preview').addEventListener('drop', event => {
  event.preventDefault();
  event.currentTarget.classList.remove('is-dragging');
  chooseCover(event.dataTransfer.files[0]);
});
document.querySelectorAll('[data-preview-view]').forEach(button => button.addEventListener('click', () => {
  previewMode = button.dataset.previewView;
  updatePreview();
}));
articleEditor.addEventListener('mouseup', rememberEditorSelection);
articleEditor.addEventListener('keyup', rememberEditorSelection);
articleEditor.addEventListener('input', rememberEditorSelection);
articleEditor.addEventListener('click', event => {
  if (mutationBusy) return;
  const crop = event.target.closest('[data-crop-rich-image]');
  if (crop) { cropRichPhoto(crop); return; }
  const remove = event.target.closest('[data-remove-rich-block]');
  if (remove) { remove.closest('[data-rich-type]').remove(); updatePreview(); }
});
document.querySelectorAll('[data-rich-command]').forEach(button => {
  button.addEventListener('mousedown', event => event.preventDefault());
  button.addEventListener('click', () => {
    restoreEditorSelection();
    document.execCommand(button.dataset.richCommand, false, button.dataset.richValue || null);
    rememberEditorSelection();
    updatePreview();
  });
});
$('#rich-color').addEventListener('change', event => {
  restoreEditorSelection();
  if (richColors.has(event.target.value)) document.execCommand('foreColor', false, event.target.value);
  rememberEditorSelection();
  updatePreview();
});
$('#rich-insert-link').addEventListener('mousedown', event => event.preventDefault());
$('#rich-insert-link').addEventListener('click', async () => {
  restoreEditorSelection();
  if (!window.getSelection()?.toString()) { notice('Сначала выделите текст для ссылки.', true); return; }
  rememberEditorSelection();
  const value = await ask({title:'Добавить ссылку', message:'Ссылка откроется при нажатии на выделенный текст.', action:'Добавить ссылку', input:true});
  if (value === null) return;
  try {
    restoreEditorSelection();
    document.execCommand('createLink', false, httpsUrl(value));
    rememberEditorSelection();
    updatePreview();
  } catch (error) { notice(error.message, true); }
});
$('#rich-insert-image').addEventListener('mousedown', event => event.preventDefault());
$('#rich-insert-image').addEventListener('click', () => { rememberEditorSelection(); $('#media-dialog').showModal(); });
$('#rich-insert-carousel').addEventListener('mousedown', event => event.preventDefault());
$('#rich-insert-carousel').addEventListener('click', () => { rememberEditorSelection(); $('#carousel-dialog').showModal(); });
$('#rich-media-confirm').addEventListener('click', insertRichImage);
$('#rich-carousel-confirm').addEventListener('click', insertRichCarousel);
document.querySelectorAll('[data-close-dialog]').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
for (const id of ['media-dialog', 'carousel-dialog']) {
  const dialog = $(`#${id}`);
  dialog.addEventListener('close', () => {
    mediaOperation++;
    dialog.querySelector('form').reset();
    dialog.querySelectorAll('button').forEach(button => { button.disabled = false; });
  });
}

try {
  const session = await request('session');
  $('#signed-user').textContent = session.user;
  setView(true);
  await refreshContent();
} catch (error) {
  setView(false);
  if (error.status !== 401) notice(error.message, true);
}

initUI(updatePreview);
