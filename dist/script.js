const toolbar = document.querySelector('#floating-toolbar');
const sourceToolbar = document.querySelector('#content-toolbar');

const updateFloatingToolbar = () => {
  const revealProgress = Math.min(1, Math.max(0, window.scrollY - 8) / 56);
  document.documentElement.style.setProperty('--details-opacity', String(revealProgress));
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
let searchFromMenu = false;
let highlightedResult;
let searchAnimations = [];

function animateMenuToSearch(source) {
  const header = searchScreen.querySelector('.search-header');
  const field = searchScreen.querySelector('.search-form');
  const targetField = field.getBoundingClientRect();
  const targetHeader = header.getBoundingClientRect();
  const offset = source.panel.top - searchScreen.getBoundingClientRect().top;
  const motion = { duration: 340, easing: 'cubic-bezier(.22,.61,.36,1)' };
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
    searchEmpty.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220, delay: 120, fill: 'backwards' }),
    searchResults.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220, delay: 120, fill: 'backwards' }),
  ];
}

const normalizeSearch = value => value.toLocaleLowerCase('ru').replaceAll('ё', 'е').trim();
const searchableItems = [...document.querySelectorAll('.content-tile, .age-card, .latest-card')].map(element => ({
  element,
  title: element.querySelector('h3')?.textContent || element.querySelector('span:last-child').textContent,
  description: element.querySelector('p')?.textContent || 'Раздел контента',
  text: normalizeSearch(element.textContent),
}));

function closeSearch() {
  if (searchFromMenu && menuSheet.open) {
    menuSheet.close();
    menuSheet.classList.remove('is-open');
    document.body.classList.remove('menu-open');
    searchTrigger = menuTrigger;
  }
  searchFromMenu = false;
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
  searchScreen.classList.toggle('from-menu', fromMenu);
  document.body.classList.add('search-open');
  document.documentElement.classList.add('search-open');
  document.querySelector('meta[name="theme-color"]').content = '#fffdfb';
  searchScreen.showModal();
  renderSearch();
  if (source && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    animateMenuToSearch(source);
  }
  searchInput.focus({ preventScroll: true });
}

function backFromSearch() {
  if (searchFromMenu) {
    searchFromMenu = false;
    searchScreen.close();
  } else {
    closeSearch();
  }
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
  button.addEventListener('click', () => openSearch(button));
});
document.querySelector('#search-back').addEventListener('click', backFromSearch);
searchScreen.addEventListener('cancel', event => {
  event.preventDefault();
  backFromSearch();
});
searchScreen.addEventListener('close', () => {
  searchAnimations.forEach(animation => animation.cancel());
  searchAnimations = [];
  searchScreen.classList.remove('from-menu');
  document.body.classList.remove('search-open');
  document.documentElement.classList.remove('search-open');
  document.querySelector('meta[name="theme-color"]').content = '#cbcced';
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
  if (!searchScreen.open) menuTrigger?.focus({ preventScroll: true });
});
document.querySelector('#menu-search').addEventListener('click', () => {
  if (menuClosing) return;
  openSearch(document.querySelector('#menu-search'), true);
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
