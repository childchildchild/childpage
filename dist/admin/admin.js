const apiUrl = '/api/admin';
const $ = selector => document.querySelector(selector);
const labels = { article: 'Статья', story: 'Сторис', video: 'Видео', audio: 'Аудио', game: 'Игра' };
const states = { published: 'Опубликовано', draft: 'Черновик', planned: 'Заготовка', trashed: 'В корзине' };
const contentForm = $('#content-form');
const trashLifetime = 7 * 24 * 60 * 60 * 1000;
let content = { version: 1, items: [] };
let sha = '';
let currentId = '';
let typeFilter = 'all';
let previewMode = 'card';
let noticeTimer;

function notice(message, error = false) {
  const node = $('#notice');
  node.textContent = message;
  node.classList.toggle('error', error);
  node.classList.add('show');
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => node.classList.remove('show'), 6000);
}
async function request(action, body) {
  const response = await fetch(`${apiUrl}?action=${encodeURIComponent(action)}`, {
    method: body ? 'POST' : 'GET',
    credentials: 'same-origin',
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify({ action, ...body }) : undefined,
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'Не удалось связаться с сервером.');
  return result;
}
function setView(loggedIn) {
  $('#login-view').hidden = loggedIn;
  $('#app-view').hidden = !loggedIn;
}
async function loadContent() {
  const result = await request('content');
  content = result.content;
  sha = result.sha;
  renderList();
}
function imageSource(path) {
  if (!path) return '';
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
    (!query || `${item.title} ${item.description}`.toLocaleLowerCase('ru').includes(query))
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
      if (image) { const img = document.createElement('img'); img.src = image; img.alt = ''; thumb.append(img); }
      else thumb.textContent = '◦';
      const main = document.createElement('span');
      main.className = 'item-main';
      const title = document.createElement('strong');
      title.textContent = item.title;
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
    row.addEventListener('click', () => openEditor(item.id));
    const thumb = document.createElement('span');
    thumb.className = 'item-thumb';
    const image = imageSource(item.image);
    if (image) { const img = document.createElement('img'); img.src = image; img.alt = ''; thumb.append(img); }
    else thumb.textContent = '◦';
    const main = document.createElement('span');
    main.className = 'item-main';
    const title = document.createElement('strong');
    title.textContent = item.title;
    const meta = document.createElement('small');
    meta.textContent = labels[item.type] + (item.publishedAt && item.status === 'published' ? ` · ${new Date(item.publishedAt).toLocaleDateString('ru-RU')}` : '');
    main.append(title, meta);
    const arrow = document.createElement('span'); arrow.className = 'item-arrow'; arrow.textContent = '›';
    row.append(thumb, main, statusBadge(item.status), arrow);
    list.append(row);
  }
  $('#empty-list').hidden = sorted.length !== 0;
  $('#empty-list').textContent = inTrash ? 'Корзина пуста.' : 'Здесь пока нет материалов.';
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
function previewDocument(stylesheet) {
  const frame = $('#site-preview');
  const doc = frame.contentDocument;
  const css = new URL(`../${stylesheet}`, location.href).href;
  doc.open();
  doc.write(`<!doctype html><html lang="ru"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><link rel="stylesheet" href="${css}"></head><body></body></html>`);
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
function renderPreviewCard(doc, item) {
  const page = doc.createElement('main'); page.className = 'catalog-page';
  const header = doc.createElement('header'); header.className = 'catalog-header';
  const brand = doc.createElement('span'); brand.textContent = 'Детская страница';
  header.append(brand);
  const section = doc.createElement('section'); section.className = 'catalog-content';
  const eyebrow = doc.createElement('p'); eyebrow.className = 'eyebrow'; eyebrow.textContent = 'Материалы';
  const heading = doc.createElement('h1'); heading.textContent = 'Предпросмотр';
  const grid = doc.createElement('div'); grid.className = 'catalog-grid';
  const card = doc.createElement('article'); card.className = 'catalog-card';
  const link = doc.createElement('a'); link.href = '#preview-page';
  const visual = doc.createElement('div'); visual.className = 'catalog-image';
  const image = imageSource(item.image);
  if (image) { const img = doc.createElement('img'); img.src = image; img.alt = item.imageAlt || ''; visual.append(img); }
  else visual.textContent = 'Ожидается изображение';
  const kind = doc.createElement('span'); kind.className = 'catalog-kind'; kind.textContent = labels[item.type];
  const title = doc.createElement('h2'); title.textContent = item.title || 'Название материала';
  const description = doc.createElement('p'); description.textContent = item.description || 'Короткое описание материала';
  link.append(visual, kind, title, description);
  link.addEventListener('click', event => { event.preventDefault(); previewMode = 'page'; updatePreview(); });
  card.append(link); grid.append(card); section.append(eyebrow, heading, grid); page.append(header, section); doc.body.append(page);
}
function renderPreviewPage(doc, item) {
  const page = doc.createElement('main'); page.className = 'article-page';
  const header = doc.createElement('header'); header.className = 'article-header';
  const back = doc.createElement('a'); back.className = 'article-back'; back.href = '#preview-card'; back.setAttribute('aria-label', 'Вернуться к карточке'); back.textContent = '←';
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
  const text = doc.createElement('div'); text.className = 'article-text'; renderPreviewBody(doc, text, item.body); body.append(text);
  const home = doc.createElement('a'); home.className = 'article-home'; home.href = '#preview-card'; home.textContent = 'Вернуться к карточке';
  home.addEventListener('click', event => { event.preventDefault(); previewMode = 'card'; updatePreview(); });
  body.append(home); article.append(body); page.append(header, article); doc.body.append(page);
}
function updatePreview() {
  const item = readForm('draft');
  $('.editor-grid').classList.toggle('preview-expanded', previewMode === 'page');
  for (const button of document.querySelectorAll('[data-preview-view]')) button.classList.toggle('active', button.dataset.previewView === previewMode);
  const doc = previewDocument(previewMode === 'card' ? 'catalog.css' : 'content-page.css');
  if (previewMode === 'card') renderPreviewCard(doc, item);
  else renderPreviewPage(doc, item);
  const imagePreview = $('#image-preview');
  imagePreview.replaceChildren();
  const path = imageSource(item.image);
  if (path) { const img = document.createElement('img'); img.src = path; img.alt = ''; imagePreview.append(img); }
  else imagePreview.textContent = 'Нет изображения';
}
function openEditor(id = '', type = 'article') {
  currentId = id;
  previewMode = 'card';
  const item = content.items.find(record => record.id === id) || { type, status: 'draft', ages: [] };
  contentForm.reset();
  for (const key of ['type', 'category', 'title', 'description', 'image', 'imageAlt', 'label', 'body', 'mediaUrl', 'gameUrl', 'linkedId']) {
    if (item[key] !== undefined && contentForm.elements[key]) contentForm.elements[key].value = item[key];
  }
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
  $('#save-draft').textContent = item.status === 'planned' ? 'Сохранить заготовку' : 'Сохранить черновик';
  const link = $('#public-link'); link.hidden = item.status !== 'published'; link.href = contentUrl(item);
  $('#list-view').hidden = true;
  $('#editor-view').hidden = false;
  $('#view-title').textContent = id ? item.title : 'Новый материал';
  updateTypeFields();
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
    status,
    title: get('title'),
    description: get('description'),
    category: get('category') || old.category || 'for_all',
    ages: [...contentForm.querySelectorAll('input[name="ages"]:checked')].map(input => input.value),
    image: get('image'), imageAlt: get('imageAlt'), label: get('label'), body: get('body'),
    linkedId: get('linkedId'), mediaUrl: get('mediaUrl'), gameUrl: get('gameUrl'),
    publishedAt: status === 'published' ? old.publishedAt || now : old.publishedAt || '',
    updatedAt: now,
  };
}
function validateItem(item) {
  if (!item.title || !item.description) return 'Заполните название и короткое описание.';
  if (item.status !== 'published') return '';
  if (item.type === 'article' && !item.body) return 'Добавьте текст статьи.';
  if (item.type === 'story' && !item.image) return 'Добавьте фото сторис.';
  if (['video', 'audio'].includes(item.type) && !item.mediaUrl) return 'Добавьте прямую ссылку на медиафайл.';
  if (item.type === 'game' && !item.gameUrl) return 'Добавьте ссылку на игру.';
  return '';
}
async function save(status) {
  const item = readForm(status);
  const error = validateItem(item);
  if (error) { notice(error, true); return; }
  const index = content.items.findIndex(record => record.id === currentId);
  const updated = { version: 1, items: [...content.items] };
  if (index < 0) updated.items.push(item); else updated.items[index] = item;
  const buttons = [...$('#editor-view').querySelectorAll('button')];
  buttons.forEach(button => { button.disabled = true; });
  try {
    const result = await request('save', { content: updated, sha });
    content = updated; sha = result.sha; currentId = item.id;
    notice(status === 'published' ? 'Материал отправлен на сайт. Vercel обновит его после сборки.' : 'Изменения сохранены.');
    openEditor(item.id);
    renderList();
  } catch (failure) { notice(failure.message, true); }
  finally { buttons.forEach(button => { button.disabled = false; }); }
}
async function persistContent(updated) {
  const result = await request('save', { content: updated, sha });
  content = updated;
  sha = result.sha;
  renderList();
}
async function removeItem() {
  const item = content.items.find(record => record.id === currentId);
  if (!item || item.status === 'trashed' || !confirm(`Переместить «${item.title}» в корзину? Его можно будет восстановить в течение 7 дней.`)) return;
  const trashedItem = { ...item, status: 'trashed', previousStatus: item.status, deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  const updated = { version: 1, items: content.items.map(record => record.id === item.id ? trashedItem : record) };
  try {
    await persistContent(updated);
    currentId = '';
    $('#editor-view').hidden = true; $('#list-view').hidden = false; $('#view-title').textContent = 'Все материалы';
    notice('Материал перемещён в корзину. Он будет удалён окончательно через 7 дней.');
  } catch (error) { notice(error.message, true); }
}
async function restoreItem(id) {
  const item = content.items.find(record => record.id === id && record.status === 'trashed');
  if (!item) return;
  const restored = { ...item, status: item.previousStatus, updatedAt: new Date().toISOString() };
  delete restored.previousStatus;
  delete restored.deletedAt;
  const updated = { version: 1, items: content.items.map(record => record.id === id ? restored : record) };
  try { await persistContent(updated); notice('Материал восстановлен.'); }
  catch (error) { notice(error.message, true); }
}
async function deletePermanently(id) {
  const item = content.items.find(record => record.id === id && record.status === 'trashed');
  if (!item || !confirm(`Удалить «${item.title}» навсегда? Восстановить его будет нельзя.`)) return;
  const updated = { version: 1, items: content.items.filter(record => record.id !== id) };
  try { await persistContent(updated); notice('Материал удалён навсегда.'); }
  catch (error) { notice(error.message, true); }
}
async function uploadImage(file) {
  if (!file) return;
  const supportedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
  if (!supportedTypes.includes(file.type)) { notice('Загрузите JPG, PNG, WebP или AVIF.', true); return; }
  if (file.size > 2_500_000) { notice('Фото должно быть меньше 2,5 МБ.', true); return; }
  notice('Загружаю фото…');
  try {
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    const result = await request('upload', { mime: file.type, base64 });
    contentForm.elements.image.value = result.path;
    updatePreview();
    notice('Фото загружено. Сохраните материал, чтобы использовать его.');
  } catch (error) { notice(error.message, true); }
}

$('#login-form').addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('button'); button.disabled = true;
  try {
    const result = await request('login', { user: form.elements.user.value, password: form.elements.password.value });
    form.elements.password.value = '';
    $('#signed-user').textContent = result.user;
    await loadContent(); setView(true);
  } catch (error) { notice(error.message, true); }
  finally { button.disabled = false; }
});
$('#logout').addEventListener('click', async () => { await request('logout', {}); setView(false); });
document.querySelectorAll('.side-nav button').forEach(button => button.addEventListener('click', () => {
  document.querySelector('.side-nav .active')?.classList.remove('active'); button.classList.add('active');
  typeFilter = button.dataset.filter; $('#view-title').textContent = button.textContent.trim().replace(/\d+$/, '').trim();
  $('#editor-view').hidden = true; $('#list-view').hidden = false; renderList();
}));
$('#filter-text').addEventListener('input', renderList);
$('#filter-status').addEventListener('change', renderList);
$('#new-item').addEventListener('click', () => $('#type-dialog').showModal());
$('#type-dialog').addEventListener('close', event => { if (event.currentTarget.returnValue !== 'cancel' && labels[event.currentTarget.returnValue]) openEditor('', event.currentTarget.returnValue); });
$('#back-list').addEventListener('click', () => { $('#editor-view').hidden = true; $('#list-view').hidden = false; renderList(); });
$('#item-type').addEventListener('change', updateTypeFields);
contentForm.addEventListener('input', updatePreview);
contentForm.addEventListener('submit', event => event.preventDefault());
$('#save-draft').addEventListener('click', () => save($('#save-draft').textContent.includes('заготовку') ? 'planned' : 'draft'));
$('#publish').addEventListener('click', () => save('published'));
$('#unpublish').addEventListener('click', () => save('draft'));
$('#delete-item').addEventListener('click', removeItem);
$('#image-upload').addEventListener('change', event => uploadImage(event.target.files[0]));
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
  uploadImage(event.dataTransfer.files[0]);
});
document.querySelectorAll('[data-preview-view]').forEach(button => button.addEventListener('click', () => {
  previewMode = button.dataset.previewView;
  updatePreview();
}));

try {
  const session = await request('session');
  $('#signed-user').textContent = session.user;
  await loadContent();
  setView(true);
} catch (error) {
  setView(false);
  if (!error.message.includes('Войдите')) notice(error.message, true);
}
