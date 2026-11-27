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
  const visual = document.createElement('div');
  visual.className = 'latest-visual';
  if (item.image) {
    const image = document.createElement('img');
    image.className = 'latest-image';
    image.src = item.image;
    image.alt = '';
    image.loading = 'lazy';
    visual.append(image);
  } else {
    const placeholder = document.createElement('div');
    placeholder.className = 'latest-image';
    placeholder.textContent = 'Ожидается изображение';
    visual.append(placeholder);
  }
  window.childpageCardBadges.decorate(visual, item);
  const title = document.createElement('h3');
  title.textContent = item.title;
  const description = document.createElement('p');
  description.textContent = item.description;
  container.append(visual, title, description);
  card.append(container);
  latestGrid.append(card);
}

// Share a compact text budget between the full heading and its excerpt.
// One heading line leaves three excerpt lines; two leave two, and so on.
function fitLatestExcerpts() {
  const updates = [...latestGrid.querySelectorAll('.latest-card')].map(card => {
    const title = card.querySelector('h3');
    const lineHeight = Number.parseFloat(getComputedStyle(title).lineHeight);
    const titleLines = Math.max(1, Math.round(title.getBoundingClientRect().height / lineHeight));
    return { card, lines: String(Math.max(1, 4 - titleLines)) };
  });
  for (const { card, lines } of updates) {
    if (card.style.getPropertyValue('--excerpt-lines') !== lines) card.style.setProperty('--excerpt-lines', lines);
  }
}

let excerptFrame = 0;
function scheduleExcerptFit() {
  if (excerptFrame) return;
  excerptFrame = requestAnimationFrame(() => { excerptFrame = 0; fitLatestExcerpts(); });
}

fitLatestExcerpts();
document.fonts.ready.then(scheduleExcerptFit);
if ('ResizeObserver' in window) {
  const observer = new ResizeObserver(scheduleExcerptFit);
  observer.observe(latestGrid);
  latestGrid.querySelectorAll('h3').forEach(title => observer.observe(title));
} else {
  window.addEventListener('resize', scheduleExcerptFit, { passive: true });
}
