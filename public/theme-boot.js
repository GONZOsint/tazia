/** Apply light/dark before first paint (CSP: script-src 'self'). Mirrors ThemeContext STORAGE_KEY. */
(function bootTheme() {
  try {
    var key = 'tazia-theme';
    var saved = localStorage.getItem(key);
    var mode =
      saved === 'light' || saved === 'dark'
        ? saved
        : window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light';
    var root = document.documentElement;
    root.classList.toggle('dark', mode === 'dark');
    root.style.colorScheme = mode;
    root.dataset.theme = mode;
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', mode === 'dark' ? '#0b0d09' : '#e4e1da');
  } catch (e) {
    /* ignore */
  }
})();
