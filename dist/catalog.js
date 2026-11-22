const params = new URLSearchParams(location.search);
const category = params.get('category') || 'all';
const names = { all: 'Все материалы', cartoons: 'Мультики', games: 'Игры', for_all: 'Интересно всем', tales: 'Сказки на ночь', medicine: 'Медицина', more: 'Больше' };
const kinds = { article: 'Статья', story: 'Сторис', video: 'Видео', audio: 'Аудио', game: 'Игра' };
document.querySelector('#catalog-title').textContent = names[category] || names.all;
document.title = `${names[category] || names.all} — Детская страница`;
const grid = document.querySelector('#catalog-grid');
function render() {
  grid.replaceChildren();
  const age = document.querySelector('#age-filter').value;
  const type = document.querySelector('#type-filter').value;
  const items = (window.siteContent || []).filter(item => item.status === 'published' && (category === 'all' || category === 'more' || item.category === category) && (age === 'all' || !item.ages.length || item.ages.includes(age)) && (type === 'all' || item.type === type)).sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
  for (const item of items) {
    const card = document.createElement('article'); card.className = 'catalog-card';
    const link = document.createElement('a'); link.href = item.type === 'story' ? `index.html?story=${encodeURIComponent(item.id)}` : item.url;
    const visual = document.createElement('div'); visual.className = 'catalog-image';
    if (item.image) { const image = document.createElement('img'); image.src = item.image; image.alt = ''; image.loading = 'lazy'; visual.append(image); }
    else visual.textContent = 'Ожидается изображение';
    const kind = document.createElement('span'); kind.className = 'catalog-kind'; kind.textContent = kinds[item.type];
    const title = document.createElement('h2'); title.textContent = item.title;
    const description = document.createElement('p'); description.textContent = item.description;
    link.append(visual, kind, title, description); card.append(link); grid.append(card);
  }
  document.querySelector('#catalog-empty').hidden = items.length > 0;
}
document.querySelector('#age-filter').addEventListener('change', render);
document.querySelector('#type-filter').addEventListener('change', render);
render();
