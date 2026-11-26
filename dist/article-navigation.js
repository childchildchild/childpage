(() => {
  const storageKey = 'childpage-article-transition';
  const reduceMotion = () => window.childpagePreferences?.prefersReducedMotion() || matchMedia('(prefers-reduced-motion: reduce)').matches;
  const currentPath = location.pathname;
  let backTarget;
  // This file also runs in <head>; configure the return link once markup exists.
  function configureBackLink() {
    const link = document.querySelector('.article-back');
    if (!link || !document.referrer) return;
    try {
      const from = new URL(document.referrer);
      const home = new URL(link.href);
      const catalog = new URL('catalog.html', home);
      if (from.origin !== location.origin || ![home.pathname, new URL('./', home).pathname, catalog.pathname].includes(from.pathname)) return;
      backTarget = from;
      link.href = from.href;
      link.setAttribute('aria-label', from.pathname === catalog.pathname ? 'Вернуться к подборке' : 'Вернуться на главную');
    } catch {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', configureBackLink, { once: true });
  else configureBackLink();

  function remember(url) {
    if (reduceMotion() || url.origin !== location.origin) return;
    try { sessionStorage.setItem(storageKey, JSON.stringify({ path: url.pathname, at: Date.now() })); } catch {}
  }

  try {
    const pending = JSON.parse(sessionStorage.getItem(storageKey) || 'null');
    sessionStorage.removeItem(storageKey);
    if (pending?.path === currentPath && Date.now() - pending.at < 10000 && !reduceMotion()) {
      document.documentElement.classList.add('article-entering');
    }
  } catch {}

  window.childpageArticleNavigation = {
    go(href) {
      const url = new URL(href, location.href);
      remember(url);
      location.assign(url.href);
    },
  };

  document.addEventListener('click', event => {
    const link = event.target.closest('a[href]');
    if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || link.target && link.target !== '_self' || link.hasAttribute('download')) return;
    const url = new URL(link.href);
    if (url.origin !== location.origin) return;
    const page = document.querySelector('.article-page');
    const returnToSource = page && link.classList.contains('article-back') && backTarget && history.length > 1;
    const navigate = () => returnToSource ? history.back() : location.assign(url.href);
    if (page && link.closest('.article-page') && (link.classList.contains('article-back') || link.classList.contains('article-home')) && !reduceMotion()) {
      event.preventDefault();
      document.documentElement.classList.remove('article-entering');
      page.classList.add('article-leaving');
      setTimeout(navigate, 280);
      return;
    }
    if (returnToSource) {
      event.preventDefault();
      navigate();
      return;
    }
    remember(url);
  });

  addEventListener('pageshow', event => {
    if (event.persisted) {
      document.documentElement.classList.remove('article-entering');
      document.querySelector('.article-page')?.classList.remove('article-leaving');
    }
  });
})();
