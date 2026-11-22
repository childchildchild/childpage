const latestGrid = document.querySelector('.latest-grid');
const publishedArticles = (window.siteArticles || []).slice(0, 8);
const publishedTitles = new Set((window.siteArticles || []).map(article => article.title.toLocaleLowerCase('ru')));

for (const placeholder of latestGrid.querySelectorAll('.latest-placeholder')) {
  if (publishedTitles.has(placeholder.querySelector('h3').textContent.toLocaleLowerCase('ru'))) {
    placeholder.remove();
  }
}

for (const article of publishedArticles) {
  const card = document.createElement('article');
  card.className = 'latest-card';
  card.dataset.articleUrl = article.url;

  const link = document.createElement('a');
  link.href = article.url;
  const image = document.createElement('img');
  image.className = 'latest-image';
  image.src = article.image;
  image.alt = '';
  image.loading = 'lazy';
  const title = document.createElement('h3');
  title.textContent = article.title;
  const description = document.createElement('p');
  description.textContent = article.description;

  link.append(image, title, description);
  card.append(link);
  latestGrid.insertBefore(card, latestGrid.querySelector('.latest-placeholder'));
}
