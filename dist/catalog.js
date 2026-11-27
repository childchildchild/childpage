const params = new URLSearchParams(location.search);
let category = params.get('category') || 'all';
const names = { all: 'Все материалы', cartoons: 'Мультики', games: 'Игры', for_all: 'Интересно всем', tales: 'Сказки на ночь', medicine: 'Медицина', more: 'Больше' };
const kinds = { article: 'Статья', story: 'Сторис', video: 'Видео', audio: 'Аудио', game: 'Игра' };
if (!Object.hasOwn(names, category)) category = 'all';
const ageNames = { '0-3': 'Для малышей 0–3 лет', '4-12': 'Для детей 4–12 лет', '13+': 'Для подростков 13+' };
const ageFilter = document.querySelector('#age-filter');
const typeFilter = document.querySelector('#type-filter');
if ([...ageFilter.options].some(option => option.value === params.get('age'))) ageFilter.value = params.get('age');
if ([...typeFilter.options].some(option => option.value === params.get('type'))) typeFilter.value = params.get('type');
const grid = document.querySelector('#catalog-grid');
function render() {
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
  ageFilter.focus();
});
render();
