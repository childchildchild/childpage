const toolbar = document.querySelector('#floating-toolbar');
const backToTop = document.querySelector('#back-to-top');
const prefersLessMotion = () => window.childpagePreferences?.prefersReducedMotion() || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const sourceToolbar = document.querySelector('#content-toolbar');
let toolbarFrame = 0;

const updateFloatingToolbar = () => {
  const revealProgress = prefersLessMotion()
    ? (window.scrollY > 8 ? 1 : 0)
    : Math.min(1, Math.max(0, window.scrollY - 8) / 56);
  document.documentElement.style.setProperty('--details-opacity', String(revealProgress));
  const shouldShow = sourceToolbar.getBoundingClientRect().bottom < 10;
  toolbar.classList.toggle('visible', shouldShow);
  toolbar.setAttribute('aria-hidden', String(!shouldShow));
  toolbar.inert = !shouldShow;
  backToTop.classList.toggle('visible', shouldShow);
  backToTop.setAttribute('aria-hidden', String(!shouldShow));
  backToTop.inert = !shouldShow;
};

window.addEventListener('scroll', () => {
  if (toolbarFrame) return;
  toolbarFrame = requestAnimationFrame(() => { toolbarFrame = 0; updateFloatingToolbar(); });
}, { passive: true });
window.addEventListener('resize', updateFloatingToolbar);
window.addEventListener('pageshow', updateFloatingToolbar);
updateFloatingToolbar();
document.documentElement.classList.add('scroll-reveal');
backToTop.addEventListener('click', () => {
  window.scrollTo({ top: 0, behavior: prefersLessMotion() ? 'instant' : 'smooth' });
});

const searchScreen = document.querySelector('#search-screen');
const searchInput = document.querySelector('#search-input');
const sharedSearchForm = document.querySelector('.search-form');
const menuSearchSlot = document.querySelector('#menu-search');
const searchSlot = document.querySelector('#search-slot');
const searchResults = document.querySelector('#search-results');
const searchEmpty = document.querySelector('#search-empty');
const searchHistoryPanel = document.querySelector('#search-history');
const searchHistoryList = document.querySelector('#search-history-list');
let searchTrigger;
let searchFromMenu = false;
let searchAnimations = [];
let searchClosing = false;

function animateMenuToSearch(source) {
  const header = searchScreen.querySelector('.search-header');
  const field = searchScreen.querySelector('.search-form');
  const targetField = field.getBoundingClientRect();
  const targetHeader = header.getBoundingClientRect();
  const offset = source.panel.top - searchScreen.getBoundingClientRect().top;
  const motion = { duration: 340, easing: 'cubic-bezier(.22,.61,.36,1)', fill: 'both' };
  const contentMotion = { duration: 220, delay: 120, fill: 'both' };
  searchAnimations = [
    searchScreen.animate([
      { transform: `translateY(${offset}px)`, borderRadius: '44px 44px 0 0' },
      { transform: 'translateY(0)', borderRadius: '0px' },
    ], motion),
    field.animate([
      { transform: `translateY(${source.field.top - targetField.top - offset}px)` },
      { transform: 'translateY(0)' },
    ], motion),
    header.animate([
      { transform: `translateY(${source.header.top + source.header.height / 2 - targetHeader.top - targetHeader.height / 2 - offset}px)` },
      { transform: 'translateY(0)' },
    ], motion),
    searchEmpty.animate([{ opacity: 0 }, { opacity: 1 }], contentMotion),
    searchHistoryPanel.animate([{ opacity: 0 }, { opacity: 1 }], contentMotion),
    searchResults.animate([{ opacity: 0 }, { opacity: 1 }], contentMotion),
  ];
  return searchAnimations[0];
}

const normalizeSearch = value => value.toLocaleLowerCase('ru').replaceAll('ё', 'е').trim();
const searchableItems = (window.siteContent || []).filter(item => item.status === 'published').map(item => ({
  id: `content:${item.id}`,
  image: item.image || '',
  kind: item.cardType === 'tale' ? 'Сказка' : ({article:'Статья', story:'Сторис', video:'Видео', audio:'Аудио', game:'Игра'}[item.type] || 'Материал'),
  title: item.title,
  description: item.description,
  text: normalizeSearch(`${item.title} ${item.description}`),
  url: item.type === 'story' ? `index.html?story=${encodeURIComponent(item.id)}` : item.url,
}));

// Store only IDs of opened results; resolve current names, images and links from site data.
const searchItemsById = new Map(searchableItems.map(item => [item.id, item]));
const searchHistoryKey = 'childpage-search-history-v2';
const searchHistoryLimit = 10;
function loadSearchHistory() {
  try {
    localStorage.removeItem('childpage-search-history-v1');
    const stored = JSON.parse(localStorage.getItem(searchHistoryKey) || '[]');
    if (!Array.isArray(stored)) return [];
    return [...new Set(stored.filter(id => typeof id === 'string' && searchItemsById.has(id)))].slice(0, searchHistoryLimit);
  } catch { return []; }
}
let searchHistory = loadSearchHistory();
function persistSearchHistory() {
  try {
    if (searchHistory.length) localStorage.setItem(searchHistoryKey, JSON.stringify(searchHistory));
    else localStorage.removeItem(searchHistoryKey);
  } catch { /* Keep in-memory history available when storage is blocked. */ }
}
function openSearchResult(item) {
  searchHistory = [item.id, ...searchHistory.filter(id => id !== item.id)].slice(0, searchHistoryLimit);
  persistSearchHistory();
  closeSearch();
  window.childpageArticleNavigation.go(item.url);
}
function createSearchEntry(item, className) {
    const open = document.createElement('button'); open.type = 'button'; open.className = `search-entry ${className}`;
    const visual = document.createElement('span'); visual.className = 'search-history-thumb';
    const fallback = document.createElement('i'); fallback.className = 'ph-bold ph-article'; fallback.setAttribute('aria-hidden', 'true'); visual.append(fallback);
    if (item.image) {
      const image = document.createElement('img'); image.src = item.image; image.alt = ''; image.loading = 'lazy'; image.decoding = 'async';
      image.addEventListener('error', () => image.remove(), {once:true}); visual.append(image);
    }
    const text = document.createElement('span'); text.className = 'search-history-info';
    const title = document.createElement('strong'); title.textContent = item.title;
    const kind = document.createElement('small'); kind.textContent = item.kind; text.append(title, kind); open.append(visual, text);
    open.addEventListener('click', () => openSearchResult(item));
    return open;
}
function renderSearchHistory() {
  searchHistoryList.replaceChildren();
  for (const id of searchHistory) {
    const item = searchItemsById.get(id);
    const row = document.createElement('li');
    const open = createSearchEntry(item, 'search-history-open');
    const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'search-history-remove'; remove.setAttribute('aria-label', `Удалить «${item.title}» из истории`);
    const cross = document.createElement('i'); cross.className = 'ph-bold ph-x'; cross.setAttribute('aria-hidden', 'true'); remove.append(cross);
    remove.addEventListener('click', () => {
      const index = searchHistory.indexOf(id);
      searchHistory = searchHistory.filter(value => value !== id); persistSearchHistory(); renderSearch();
      (searchHistoryList.children[Math.min(index, searchHistory.length - 1)]?.querySelector('.search-history-remove') || searchInput).focus({preventScroll:true});
    });
    row.append(open, remove); searchHistoryList.append(row);
  }
}

function restoreSharedSearch() {
  searchAnimations.forEach(animation => animation.cancel());
  searchAnimations = [];
  searchInput.blur();
  searchInput.readOnly = true;
  menuSearchSlot.append(sharedSearchForm);
}

function closeSearch() {
  if (searchFromMenu && menuSheet.open) {
    menuSheet.close();
    menuSheet.classList.remove('is-open');
    document.body.classList.remove('menu-open');
    searchTrigger = menuTrigger;
  }
  searchFromMenu = false;
  restoreSharedSearch();
  searchScreen.close();
}

function openSearch(trigger, fromMenu = false) {
  const source = fromMenu ? {
    panel: menuSheet.getBoundingClientRect(),
    field: trigger.getBoundingClientRect(),
    header: menuSheet.querySelector('.menu-header').getBoundingClientRect(),
  } : null;
  searchTrigger = trigger;
  searchFromMenu = fromMenu;
  searchSlot.append(sharedSearchForm);
  searchInput.value = '';
  searchInput.readOnly = false;
  searchScreen.classList.toggle('from-menu', fromMenu);
  document.body.classList.add('search-open');
  document.documentElement.classList.add('search-open');
  searchScreen.showModal();
  renderSearch();
  if (source && !prefersLessMotion()) {
    animateMenuToSearch(source);
  }
  searchInput.focus({ preventScroll: true });
}

function backFromSearch() {
  if (searchClosing) return;
  if (searchFromMenu) {
    const finish = () => {
      searchFromMenu = false;
      restoreSharedSearch();
      searchScreen.close();
    };
    if (prefersLessMotion() || !searchAnimations.length) {
      finish();
      return;
    }
    searchClosing = true;
    searchScreen.classList.add('returning-to-menu');
    searchAnimations.forEach(animation => animation.reverse());
    Promise.all(searchAnimations.map(animation => animation.finished)).then(finish, () => {});
  } else {
    closeSearch();
  }
}

function renderSearch() {
  const words = normalizeSearch(searchInput.value).split(/\s+/).filter(Boolean);
  searchResults.replaceChildren();
  searchEmpty.hidden = words.length > 0 || searchHistory.length > 0;
  searchHistoryPanel.hidden = words.length > 0 || searchHistory.length === 0;
  if (!words.length) renderSearchHistory();
  if (!words.length) return;

  const matches = searchableItems.filter(item => words.every(word => item.text.includes(word)));
  if (!matches.length) {
    const message = document.createElement('p');
    message.className = 'search-no-results';
    message.textContent = 'Ничего не найдено. Попробуй другой запрос.';
    searchResults.append(message);
    return;
  }

  for (const item of matches) {
    searchResults.append(createSearchEntry(item, 'search-result'));
  }
}

document.querySelectorAll('button[aria-label="Открыть поиск"]').forEach(button => {
  button.addEventListener('click', () => openSearch(button));
});
document.querySelector('#search-back').addEventListener('click', backFromSearch);
searchScreen.addEventListener('cancel', event => {
  event.preventDefault();
  backFromSearch();
});
searchScreen.addEventListener('close', () => {
  restoreSharedSearch();
  searchClosing = false;
  searchScreen.classList.remove('from-menu', 'returning-to-menu');
  document.body.classList.remove('search-open');
  document.documentElement.classList.remove('search-open');
  searchTrigger?.focus({ preventScroll: true });
});
searchInput.addEventListener('input', renderSearch);
document.querySelector('#search-history-clear').addEventListener('click', () => {
  searchHistory = []; persistSearchHistory(); renderSearch(); searchInput.focus({preventScroll:true});
});
sharedSearchForm.addEventListener('submit', event => {
  event.preventDefault();
  if (!searchScreen.open) {
    openSearch(menuSearchSlot, true);
    return;
  }
  renderSearch();
  searchInput.blur();
});

const menuSheet = document.querySelector('#menu-sheet');
let menuTrigger;
let menuClosing = false;
let menuTouchStart;

function closeMenu(afterClose) {
  if (!menuSheet.open || menuClosing) return;
  menuClosing = true;
  menuSheet.classList.remove('is-open');
  window.setTimeout(() => {
    menuSheet.close();
    menuClosing = false;
    afterClose?.();
  }, prefersLessMotion() ? 0 : 240);
}

function openMenu(trigger) {
  menuTrigger = trigger;
  document.body.classList.add('menu-open');
  menuSheet.showModal();
  requestAnimationFrame(() => requestAnimationFrame(() => menuSheet.classList.add('is-open')));
}

document.querySelectorAll('button[aria-label="Открыть меню"]').forEach(button => {
  button.addEventListener('click', () => openMenu(button));
});
document.querySelector('#menu-back').addEventListener('click', () => closeMenu());
menuSheet.addEventListener('cancel', event => {
  event.preventDefault();
  closeMenu();
});
menuSheet.addEventListener('click', event => {
  if (event.target === menuSheet && event.clientY < menuSheet.getBoundingClientRect().top) closeMenu();
});
menuSheet.addEventListener('close', () => {
  document.body.classList.remove('menu-open');
  menuSheet.classList.remove('is-open');
  if (!searchScreen.open) menuTrigger?.focus({ preventScroll: true });
});
menuSearchSlot.addEventListener('click', () => {
  if (menuClosing || searchScreen.open) return;
  openSearch(menuSearchSlot, true);
});
document.querySelectorAll('[data-menu-target]').forEach(button => {
  button.addEventListener('click', () => {
    if (button.closest('.menu-categories')) {
      const index = Number(button.dataset.menuTarget.match(/nth-child\((\d+)\)/)?.[1]) - 1;
      const categories = ['cartoons', 'games', 'for_all', 'tales', 'medicine', 'all'];
      window.location.href = `catalog.html?category=${categories[index] || 'all'}`;
      return;
    }
    const target = document.querySelector(button.dataset.menuTarget);
    closeMenu(() => {
      window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - 110, behavior: 'instant' });
      updateFloatingToolbar();
    });
  });
});
document.querySelectorAll('.content-tile').forEach((button, index) => {
  const categories = ['cartoons', 'games', 'for_all', 'tales', 'medicine', 'all'];
  button.addEventListener('click', () => {
    if (button.hasAttribute('data-open-menu')) {
      openMenu(button);
      return;
    }
    window.location.href = `catalog.html?category=${categories[index]}`;
  });
});
const menuHeader = document.querySelector('.menu-header');
menuHeader.addEventListener('touchstart', event => {
  menuTouchStart = event.touches[0].clientY;
}, { passive: true });
menuHeader.addEventListener('touchend', event => {
  if (menuTouchStart !== undefined && event.changedTouches[0].clientY - menuTouchStart > 60) closeMenu();
  menuTouchStart = undefined;
}, { passive: true });
