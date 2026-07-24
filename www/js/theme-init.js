// Theme & language init — runs synchronously before render to prevent FOUC.
try {
  var _th = localStorage.getItem('gs_theme') === 'light' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', _th);
  var _lg = localStorage.getItem('gs_lang') || 'ar';
  if (['ar', 'en', 'fr', 'es'].indexOf(_lg) < 0) _lg = 'ar';
  document.documentElement.lang = _lg;
  document.documentElement.dir = _lg === 'ar' ? 'rtl' : 'ltr';
} catch (e) {}

// The public store is only available inside the native Android wrapper.
// All regular website visitors are redirected to the app download page.
// Admin panel and the download page itself are excluded.
(function () {
  var path = location.pathname;
  if (path.indexOf('/gs-admin-c0d982f8') === 0 || path.indexOf('/download') === 0 || path.indexOf('/404') === 0) return;
  try {
    if (!/GoldenStoreApp/.test(navigator.userAgent) && !window.Capacitor) {
      location.replace('/download.html');
    }
  } catch (e) {}
})();
