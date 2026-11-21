const toolbar = document.querySelector('#floating-toolbar');
const sourceToolbar = document.querySelector('#content-toolbar');

const updateFloatingToolbar = () => {
  const shouldShow = sourceToolbar.getBoundingClientRect().bottom < 10;
  toolbar.classList.toggle('visible', shouldShow);
  toolbar.setAttribute('aria-hidden', String(!shouldShow));
};

window.addEventListener('scroll', updateFloatingToolbar, { passive: true });
updateFloatingToolbar();

const searchScreen = document.querySelector('#search-screen');
const searchInput = document.querySelector('#search-input');
const searchResults = document.querySelector('#search-results');
const searchEmpty = document.querySelector('#search-empty');
let searchTrigger;
let highlightedResult;

const normalizeSearch = value => value.toLocaleLowerCase('ru').replaceAll('ё', 'е').trim();
const searchableItems = [...document.querySelectorAll('.content-tile, .age-card, .latest-card')].map(element => ({
  element,
  title: element.querySelector('h3')?.textContent || element.querySelector('span:last-child').textContent,
  description: element.querySelector('p')?.textContent || 'Раздел контента',
  text: normalizeSearch(element.textContent),
}));

function closeSearch() {
  searchScreen.close();
}

function renderSearch() {
  const words = normalizeSearch(searchInput.value).split(/\s+/).filter(Boolean);
  searchResults.replaceChildren();
  searchEmpty.hidden = words.length > 0;
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
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'search-result';
    const title = document.createElement('strong');
    title.textContent = item.title;
    const description = document.createElement('span');
    description.textContent = item.description;
    button.append(title, description);
    button.addEventListener('click', () => {
      closeSearch();
      highlightedResult?.classList.remove('search-match');
      highlightedResult = item.element;
      item.element.classList.add('search-match');
      const top = item.element.getBoundingClientRect().top + window.scrollY - 110;
      window.scrollTo({ top, behavior: 'instant' });
      updateFloatingToolbar();
    });
    searchResults.append(button);
  }
}

document.querySelectorAll('button[aria-label="Открыть поиск"]').forEach(button => {
  button.addEventListener('click', () => {
    searchTrigger = button;
    document.body.classList.add('search-open');
    searchScreen.showModal();
    renderSearch();
    searchInput.focus();
  });
});
document.querySelector('#search-back').addEventListener('click', closeSearch);
searchScreen.addEventListener('close', () => {
  document.body.classList.remove('search-open');
  searchTrigger?.focus({ preventScroll: true });
});
searchInput.addEventListener('input', renderSearch);
document.querySelector('.search-form').addEventListener('submit', event => {
  event.preventDefault();
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
  }, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 240);
}

document.querySelectorAll('button[aria-label="Открыть меню"]').forEach(button => {
  button.addEventListener('click', () => {
    menuTrigger = button;
    document.body.classList.add('menu-open');
    menuSheet.showModal();
    requestAnimationFrame(() => requestAnimationFrame(() => menuSheet.classList.add('is-open')));
  });
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
  menuTrigger?.focus({ preventScroll: true });
});
document.querySelector('#menu-search').addEventListener('click', () => {
  closeMenu(() => document.querySelector('button[aria-label="Открыть поиск"]').click());
});
document.querySelectorAll('[data-menu-target]').forEach(button => {
  button.addEventListener('click', () => {
    const target = document.querySelector(button.dataset.menuTarget);
    closeMenu(() => {
      window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - 110, behavior: 'instant' });
      updateFloatingToolbar();
    });
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
