(() => {
  const storageKey = 'childpage-preferences';
  const allowed = new Set(['largeText', 'reduceMotion']);
  let saved = {};

  try {
    const value = JSON.parse(localStorage.getItem(storageKey) || '{}');
    if (value && typeof value === 'object') saved = value;
  } catch {}

  const preferences = {
    largeText: saved.largeText === true,
    reduceMotion: saved.reduceMotion === true,
  };

  function apply() {
    document.documentElement.dataset.readingSize = preferences.largeText ? 'large' : 'normal';
    document.documentElement.dataset.reduceMotion = String(preferences.reduceMotion);
  }

  apply();
  window.childpagePreferences = {
    get: () => ({ ...preferences }),
    set(name, value) {
      if (!allowed.has(name)) return false;
      preferences[name] = value === true;
      apply();
      try {
        localStorage.setItem(storageKey, JSON.stringify(preferences));
        return true;
      } catch {
        return false;
      }
    },
    prefersReducedMotion: () => preferences.reduceMotion || matchMedia('(prefers-reduced-motion: reduce)').matches,
  };
})();
