/** Apply lang + document title before first paint (CSP: script-src 'self'). Mirrors LocaleContext STORAGE_KEY. */
(function bootLocale() {
  try {
    var key = 'tazia-locale';
    var saved = localStorage.getItem(key);
    var locale =
      saved === 'es' || saved === 'en'
        ? saved
        : typeof navigator !== 'undefined' &&
            navigator.language &&
            navigator.language.toLowerCase().indexOf('en') === 0
          ? 'en'
          : 'es';
    var titles = {
      es: 'TAZIA — Zona Anónima Temporal en Acción',
      en: 'TAZIA — Temporary Anonymous Zone In Action',
    };
    var root = document.documentElement;
    root.lang = locale;
    root.dataset.locale = locale;
    if (titles[locale]) document.title = titles[locale];
  } catch (e) {
    /* ignore */
  }
})();
