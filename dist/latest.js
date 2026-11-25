const latestGrid = document.querySelector('.latest-grid');
const contentItems = window.siteContent || [];
const visibleCards = [
  ...contentItems.filter(item => item.status === 'published' && item.type !== 'story').sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt)),
  ...contentItems.filter(item => item.status === 'planned' && item.type !== 'story'),
];

for (const item of visibleCards) {
  const card = document.createElement('article');
  card.className = 'latest-card';
  if (item.status === 'planned') card.classList.add('latest-placeholder');
  if (item.url) card.dataset.articleUrl = item.url;

  const container = item.url ? document.createElement('a') : document.createElement('div');
  if (item.url) container.href = item.url;
  if (item.image) {
    const image = document.createElement('img');
    image.className = 'latest-image';
    image.src = item.image;
    image.alt = '';
    image.loading = 'lazy';
    container.append(image);
  } else {
    const placeholder = document.createElement('div');
    placeholder.className = 'latest-image';
    placeholder.textContent = 'Ожидается изображение';
    container.append(placeholder);
  }
  const title = document.createElement('h3');
  title.textContent = item.title;
  const description = document.createElement('p');
  description.textContent = item.description;
  container.append(title, description);
  card.append(container);
  latestGrid.append(card);
}
