/* I.General (Mes 18) — selector de tema en Settings→General. Script síncrono
   cargado antes de las hojas de estilo (ver index.html) para fijar
   data-theme en <html> antes del primer paint y evitar flash del tema
   por defecto. Mismo patrón que getLang()/setLang() en i18n.js pero para
   apariencia, no idioma. */
(function () {
  var THEME_KEY = 'orchestos-theme';
  var THEME_DEFAULT = 'orchestos';
  var THEMES = ['orchestos', 'dark2026', 'claude', 'bright'];

  function getTheme() {
    try {
      var v = localStorage.getItem(THEME_KEY);
      return THEMES.indexOf(v) !== -1 ? v : THEME_DEFAULT;
    } catch (e) {
      return THEME_DEFAULT;
    }
  }

  function setTheme(theme) {
    if (THEMES.indexOf(theme) === -1) return;
    try { localStorage.setItem(THEME_KEY, theme); } catch (e) {}
    document.documentElement.dataset.theme = theme;
  }

  document.documentElement.dataset.theme = getTheme();

  window.getTheme = getTheme;
  window.setTheme = setTheme;
  window.THEMES = THEMES;
})();
