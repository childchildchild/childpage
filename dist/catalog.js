const params = new URLSearchParams(location.search);
let category = params.get('category') || 'all';
const names = { all: 'Все материалы', cartoons: 'Мультики', games: 'Игры', for_all: 'Интересно всем', tales: 'Сказки на ночь', medicine: 'Медицина', more: 'Больше' };
const kinds = { article: 'Статья', story: 'Сторис', video: 'Видео', audio: 'Аудио', game: 'Игра' };
if (!Object.hasOwn(names, category)) category = 'all';
const ageNames = { '0-3': 'Для малышей 0–3 лет', '4-12': 'Для детей 4–12 лет', '13+': 'Для подростков 13+' };
const ageFilter = document.querySelector('#age-filter');
const typeFilter = document.querySelector('#type-filter');
const filterControls = new Map();
let openFilter = null;
function closeFilter() {
  if (!openFilter) return;
  openFilter.menu.hidden = true;
  openFilter.button.setAttribute('aria-expanded', 'false');
  openFilter.button.removeAttribute('aria-activedescendant');
  openFilter = null;
}
function syncFilters() {
  for (const [select, control] of filterControls) {
    control.button.querySelector('span').textContent = select.selectedOptions[0].textContent;
    [...control.menu.children].forEach((option, index) => option.setAttribute('aria-selected', String(index === select.selectedIndex)));
  }
}
function enhanceFilter(select) {
  const label = select.parentElement;
  const field = document.createElement('div'); field.className = 'catalog-filter';
  const caption = document.createElement('span'); caption.className = 'catalog-filter-label'; caption.id = `${select.id}-label`; caption.textContent = label.firstChild.textContent;
  const button = document.createElement('button'); button.type = 'button'; button.id = `${select.id}-button`; button.className = 'catalog-filter-button';
  button.innerHTML = '<span></span><i class="ph-bold ph-caret-down" aria-hidden="true"></i>';
  button.setAttribute('role', 'combobox'); button.setAttribute('aria-labelledby', caption.id); button.setAttribute('aria-haspopup', 'listbox'); button.setAttribute('aria-expanded', 'false');
  const menu = document.createElement('div'); menu.id = `${select.id}-options`; menu.className = 'catalog-filter-menu'; menu.hidden = true;
  menu.setAttribute('role', 'listbox'); menu.setAttribute('aria-labelledby', caption.id); button.setAttribute('aria-controls', menu.id);
  select.hidden = true; label.replaceWith(field); field.append(caption, select, button, menu);
  const options = [...select.options]; let active = select.selectedIndex;
  const activate = index => {
    active = index;
    [...menu.children].forEach((row, i) => row.classList.toggle('is-active', i === active));
    button.setAttribute('aria-activedescendant', `${menu.id}-${active}`);
    menu.children[active].scrollIntoView({block:'nearest'});
  };
  const choose = index => {
    select.value = options[index].value;
    select.dispatchEvent(new Event('change', {bubbles:true}));
    closeFilter(); button.focus({preventScroll:true});
  };
  options.forEach((option, index) => {
    const row = document.createElement('div'); row.className = 'catalog-filter-option'; row.id = `${menu.id}-${index}`; row.setAttribute('role', 'option');
    const text = document.createElement('span'); text.textContent = option.textContent; row.append(text);
    const check = document.createElement('i'); check.className = 'ph-bold ph-check'; check.setAttribute('aria-hidden','true'); row.append(check);
    row.addEventListener('mousedown', event => event.preventDefault()); row.addEventListener('click', () => choose(index)); menu.append(row);
  });
  const control = {button, menu, field}; filterControls.set(select, control);
  function open() {
    closeFilter(); openFilter = control; menu.hidden = false; button.setAttribute('aria-expanded', 'true');
    field.classList.remove('opens-up');
    const rect = button.getBoundingClientRect();
    if (innerHeight - rect.bottom < Math.min(menu.scrollHeight, 300) + 12 && rect.top > innerHeight - rect.bottom) field.classList.add('opens-up');
    activate(select.selectedIndex);
  }
  button.addEventListener('click', () => openFilter === control ? closeFilter() : open());
  button.addEventListener('keydown', event => {
    if (event.key === 'Tab') { closeFilter(); return; }
    if (event.key === 'Escape') { if (openFilter === control) { event.preventDefault(); closeFilter(); } return; }
    if (['ArrowDown','ArrowUp','Home','End','Enter',' '].includes(event.key)) {
      event.preventDefault();
      if (openFilter !== control) { open(); return; }
      if (event.key === 'Enter' || event.key === ' ') { choose(active); return; }
      activate(event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : Math.max(0, Math.min(options.length - 1, active + (event.key === 'ArrowDown' ? 1 : -1))));
    } else if (event.key.length === 1 && openFilter === control) {
      const index = options.findIndex(option => option.textContent.toLocaleLowerCase().startsWith(event.key.toLocaleLowerCase()));
      if (index >= 0) activate(index);
    }
  });
}
document.addEventListener('pointerdown', event => { if (openFilter && !openFilter.field.contains(event.target)) closeFilter(); });
document.addEventListener('focusin', event => { if (openFilter && !openFilter.field.contains(event.target)) closeFilter(); });
window.addEventListener('resize', closeFilter);
if ([...ageFilter.options].some(option => option.value === params.get('age'))) ageFilter.value = params.get('age');
if ([...typeFilter.options].some(option => option.value === params.get('type'))) typeFilter.value = params.get('type');
const grid = document.querySelector('#catalog-grid');
function render() {
  syncFilters();
  grid.replaceChildren();
  const age = ageFilter.value;
  const type = typeFilter.value;
  const title = (category === 'all' || category === 'more') && ageNames[age] ? ageNames[age] : names[category];
  document.querySelector('#catalog-title').textContent = title;
  document.title = `${title} — Детская страница`;
  const url = new URL(location.href);
  for (const [key, value] of [['age', age], ['type', type]]) {
    if (value === 'all') url.searchParams.delete(key);
    else url.searchParams.set(key, value);
  }
  history.replaceState(null, '', url);
  const available = (window.siteContent || []).filter(item => item.status === 'published' && (category === 'all' || category === 'more' || item.category === category));
  const items = available.filter(item => (age === 'all' || !item.ages?.length || item.ages.includes(age)) && (type === 'all' || item.type === type)).sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
  for (const item of items) {
    const card = document.createElement('article'); card.className = 'catalog-card';
    const link = document.createElement('a'); link.href = item.type === 'story' ? `index.html?story=${encodeURIComponent(item.id)}` : item.url;
    const visual = document.createElement('div'); visual.className = 'catalog-image';
    if (item.image) { const image = document.createElement('img'); image.src = item.image; image.alt = ''; image.loading = 'lazy'; visual.append(image); }
    else visual.textContent = 'Ожидается изображение';
    const kind = document.createElement('span'); kind.className = 'catalog-kind'; kind.textContent = kinds[item.type];
    if (item.type !== 'story') window.childpageCardBadges.decorate(visual, item);
    const title = document.createElement('h2'); title.textContent = item.title;
    const description = document.createElement('p'); description.textContent = item.description;
    link.append(visual, ...(item.type === 'story' ? [kind] : []), title, description); card.append(link); grid.append(card);
  }
  document.querySelector('#catalog-empty').hidden = items.length > 0;
  document.querySelector('#catalog-status').textContent = items.length ? `Найдено материалов: ${items.length}` : '';
  document.querySelector('#catalog-empty-message').textContent = available.length
    ? 'Для этого возраста и формата пока нет материалов. Попробуйте другой выбор.'
    : 'В этом разделе пока нет материалов. В других разделах уже есть что почитать и посмотреть.';
  document.querySelector('#catalog-reset').hidden = !available.length || (age === 'all' && type === 'all');
}
ageFilter.addEventListener('change', render);
typeFilter.addEventListener('change', render);
document.querySelector('#catalog-reset').addEventListener('click', () => {
  ageFilter.value = 'all';
  typeFilter.value = 'all';
  render();
  filterControls.get(ageFilter).button.focus();
});
[ageFilter, typeFilter].forEach(enhanceFilter);
render();
