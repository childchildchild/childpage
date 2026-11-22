const apiUrl = '/api/admin';
const $ = selector => document.querySelector(selector);
const labels = { article: 'Статья', story: 'Сторис', video: 'Видео', audio: 'Аудио', game: 'Игра' };
const states = { published: 'Опубликовано', draft: 'Черновик', planned: 'Заготовка' };
const contentForm = $('#content-form');
let content = { version: 1, items: [] };
let sha = '';
let currentId = '';
let typeFilter = 'all';
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
  const items = content.items.filter(item => (typeFilter === 'all' || item.type === typeFilter) && (status === 'all' || item.status === status) && (!query || `${item.title} ${item.description}`.toLocaleLowerCase('ru').includes(query)));
  const sorted = [...items].sort((a, b) => (a.status === 'published' ? 0 : 1) - (b.status === 'published' ? 0 : 1) || Date.parse(b.publishedAt || b.updatedAt || 0) - Date.parse(a.publishedAt || a.updatedAt || 0));
  for (const item of sorted) {
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
  for (const type of ['article', 'story', 'video', 'audio', 'game']) $(`#count-${type}`).textContent = content.items.filter(item => item.type === type).length;
  $('#count-all').textContent = content.items.length;
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
function updatePreview() {
  const preview = $('#card-preview');
  preview.replaceChildren();
  const path = imageSource(contentForm.elements.image.value.trim());
  if (path) { const img = document.createElement('img'); img.src = path; img.alt = ''; preview.append(img); }
  else { const box = document.createElement('div'); box.className = 'image-fallback'; box.textContent = 'Ожидается изображение'; preview.append(box); }
  const title = document.createElement('h3'); title.textContent = contentForm.elements.title.value || 'Название материала';
  const description = document.createElement('p'); description.textContent = contentForm.elements.description.value || 'Короткое описание материала';
  preview.append(title, description);
  const imagePreview = $('#image-preview');
  imagePreview.replaceChildren();
  if (path) { const img = document.createElement('img'); img.src = path; img.alt = ''; imagePreview.append(img); }
  else imagePreview.textContent = 'Нет изображения';
}
function openEditor(id = '', type = 'article') {
  currentId = id;
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
    category: get('category'),
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
async function removeItem() {
  const item = content.items.find(record => record.id === currentId);
  if (!item || !confirm(`Удалить «${item.title}»? Это действие уберёт материал с сайта после обновления.`)) return;
  const updated = { version: 1, items: content.items.filter(record => record.id !== currentId) };
  try {
    const result = await request('save', { content: updated, sha });
    content = updated; sha = result.sha; currentId = '';
    $('#editor-view').hidden = true; $('#list-view').hidden = false; $('#view-title').textContent = 'Все материалы';
    renderList(); notice('Материал удалён.');
  } catch (error) { notice(error.message, true); }
}
async function uploadImage(file) {
  if (!file) return;
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

try {
  const session = await request('session');
  $('#signed-user').textContent = session.user;
  await loadContent();
  setView(true);
} catch (error) {
  setView(false);
  if (!error.message.includes('Войдите')) notice(error.message, true);
}
