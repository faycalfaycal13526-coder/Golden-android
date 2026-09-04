// Golden Store — shared frontend helpers, auth gate, and UI chrome.
// Exposed as window.Store. Public store pages use this (admin keeps common.js).

const STORE = { name: 'Golden Store', domain: 'goldenstore.me' };

/* ----------------------------- Theme (light/dark) ----------------------------- */
const THEME_KEY = 'gs_theme';
function currentTheme() {
  try { return localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark'; } catch { return 'dark'; }
}
function applyTheme(theme) {
  const th = theme === 'light' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', th);
  try { localStorage.setItem(THEME_KEY, th); } catch {}
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', th === 'light' ? '#ffffff' : '#0d0d0f');
  document.querySelectorAll('.theme-toggle').forEach((b) => syncThemeBtn(b, th));
}
function toggleTheme() { applyTheme(currentTheme() === 'light' ? 'dark' : 'light'); }
function syncThemeBtn(btn, th) {
  btn.innerHTML = '';
  btn.append(ico(th === 'light' ? 'moon' : 'sun', 'icon'));
  btn.setAttribute('aria-label', th === 'light' ? t('الوضع الغامق') : t('الوضع الفاتح'));
  btn.setAttribute('title', th === 'light' ? t('الوضع الغامق') : t('الوضع الفاتح'));
}
function themeToggleBtn() {
  const btn = el('button', { class: 'icon-btn theme-toggle', type: 'button', onclick: toggleTheme });
  syncThemeBtn(btn, currentTheme());
  return btn;
}
function langSwitcherEl() {
  try { if (window.GSI18N && window.GSI18N.switcherEl) return window.GSI18N.switcherEl(); } catch (e) {}
  return document.createComment('lang');
}
// Apply persisted theme as early as possible.
applyTheme(currentTheme());

/* ----------------------------- API ----------------------------- */
function isNativeApp() {
  return typeof window !== 'undefined' && window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform();
}
function apiBaseUrl() {
  if (!isNativeApp()) return '';
  const cfg = window.Capacitor.getConfig && window.Capacitor.getConfig();
  return (cfg && cfg.apiBase) || 'https://goldenstore.vercel.app';
}

function fullApiUrl(path) {
  const base = apiBaseUrl();
  return base && path.startsWith('/') ? base + path : path;
}
async function apiNativeCap(path, opts, timeoutMs) {
  const capHttp = window.Capacitor.Plugins.CapacitorHttp;
  const isJsonBody = opts.body && typeof opts.body !== 'string' && !(opts.body instanceof FormData);
  const body = isJsonBody ? JSON.stringify(opts.body) : opts.body;
  let headers = opts.headers || {};
  if (isJsonBody && !headers['Content-Type'] && !headers['content-type']) {
    headers = { 'Content-Type': 'application/json', ...headers };
  }
  const options = {
    url: fullApiUrl(path),
    method: opts.method || 'GET',
    headers,
    data: body,
    responseType: 'json',
  };
  if (timeoutMs > 0) {
    options.connectTimeout = timeoutMs;
    options.readTimeout = timeoutMs;
  }
  let response;
  try {
    response = await capHttp.request(options);
  } catch (e) {
    const err = new Error((e && e.message) || 'network_error');
    err.status = 0;
    throw err;
  }
  const data = response.data || null;
  if (response.status < 200 || response.status >= 300) {
    const err = new Error((data && data.error) || 'error');
    err.status = response.status;
    err.data = data;
    throw err;
  }
  return data;
}
async function api(path, opts = {}) {
  const timeoutMs = typeof opts.timeoutMs === 'number' ? opts.timeoutMs : 15000;
  if (isNativeApp() && window.Capacitor.Plugins && window.Capacitor.Plugins.CapacitorHttp) {
    return apiNativeCap(path, opts, timeoutMs);
  }
  const ctrl = new AbortController();
  const timer = timeoutMs > 0 ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
  let res;
  try {
    res = await fetch(fullApiUrl(path), {
      credentials: 'include',
      headers: opts.body && !(opts.body instanceof FormData) && typeof opts.body !== 'string'
        ? { 'Content-Type': 'application/json', ...(opts.headers || {}) }
        : opts.headers || {},
      ...opts,
      signal: opts.signal || ctrl.signal,
      body: opts.body && typeof opts.body !== 'string' && !(opts.body instanceof FormData)
        ? JSON.stringify(opts.body)
        : opts.body,
    });
  } catch (e) {
    if (timer) clearTimeout(timer);
    const err = new Error(e && e.name === 'AbortError' ? 'timeout' : (e && e.message) || 'network_error');
    err.status = 0;
    throw err;
  }
  if (timer) clearTimeout(timer);
  let data = null;
  try { data = await res.json(); } catch {}
  if (!res.ok) {
    const err = new Error((data && data.error) || res.statusText || 'error');
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

/* --------------------------- DOM helper --------------------------- */
function el(tag, attrs = null, ...children) {
  const node = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') node.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
      else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'html') node.innerHTML = v;
      else node.setAttribute(k, v);
    }
  }
  for (const c of children) {
    if (c == null || c === false) continue;
    if (Array.isArray(c)) c.forEach((x) => x && node.append(x.nodeType ? x : document.createTextNode(String(x))));
    else if (c.nodeType) node.append(c);
    else node.append(document.createTextNode(String(c)));
  }
  return node;
}

function ico(name, extra = 'icon') { return window.GSIcons.iconEl(name, extra); }
function t(s) { try { return window.GSI18N.t(s); } catch { return s; } }

/* --------------------------- Formatters --------------------------- */
function i18nUnits(kind) {
  try { const u = window.GSI18N && window.GSI18N.units(kind); if (u && u.length) return u; } catch (e) {}
  return kind === 'count' ? ['', 'ألف', 'مليون', 'مليار'] : ['ب', 'ك.ب', 'م.ب', 'ج.ب'];
}
function formatBytes(bytes) {
  const units = i18nUnits('bytes');
  if (!bytes) return `0 ${units[0]}`;
  let i = 0, v = bytes;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}
function formatCount(n) {
  n = Number(n || 0);
  const u = i18nUnits('count');
  if (n >= 1e9) return (n / 1e9).toFixed(1).replace(/\.0$/, '') + ' ' + u[3];
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + ' ' + u[2];
  if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + ' ' + u[1];
  return String(n);
}
function formatNum(n) { return Number(n || 0).toLocaleString('en-US'); }
function formatDate(ts) {
  if (!ts) return '—';
  const lang = (window.GSI18N && window.GSI18N.lang) || 'ar';
  return new Date(ts * 1000).toLocaleDateString(lang, { year: 'numeric', month: 'short', day: 'numeric', numberingSystem: 'latn' });
}

// Real rating helpers — based on actual user votes from the backend.
// rating = average (0–5), rating_count/stars = number of ratings.
function ratingCountOf(app) {
  return Number((app && (app.rating_count != null ? app.rating_count : app.stars)) || 0);
}
function ratingValue(app) {
  return Number((app && app.rating) || 0);
}
// Formatted average for display, or null when the app has no ratings yet.
function ratingOf(app) {
  if (ratingCountOf(app) <= 0) return null;
  return ratingValue(app).toFixed(1);
}

function getQuery(name) { return new URLSearchParams(location.search).get(name) || ''; }

// Public origin of the store website for share links. Inside the native
// WebView the document origin is a local scheme (capacitor://localhost), so
// shared links must point at the real site instead.
function publicOrigin() {
  try {
    if (isNativeApp()) {
      const cfg = window.Capacitor && window.Capacitor.getConfig && window.Capacitor.getConfig();
      const base = (cfg && (cfg.apiBase || cfg.server && cfg.server.url)) || '';
      if (base) return base.replace(/\/+$/, '');
      return 'https://goldenstore-new.vercel.app';
    }
  } catch (e) {}
  return location.origin;
}


function toast(msg, type = 'info', ms = 3000) {
  let stack = document.querySelector('.toast-stack');
  if (!stack) { stack = el('div', { class: 'toast-stack' }); document.body.append(stack); }
  const t = el('div', { class: `toast ${type}` }, msg);
  stack.append(t);
  setTimeout(() => {
    t.style.transition = 'opacity .2s, transform .2s';
    t.style.opacity = '0'; t.style.transform = 'translateY(8px)';
    setTimeout(() => t.remove(), 200);
  }, ms);
}

/* ----------------------------- Cards ----------------------------- */
// Square poster card (horizontal rows)
// <bdi> keeps Latin/mixed app names from breaking RTL punctuation order.
function posterCard(a) {
  const rt = ratingOf(a);
  return el('a', { href: `/app?slug=${encodeURIComponent(a.slug)}`, class: 'poster' },
    el('div', { class: 'art' }, a.icon_url ? el('img', { src: a.icon_url, alt: a.name, loading: 'lazy' }) : ico('package', 'icon icon-lg')),
    el('div', { class: 'nm' }, el('bdi', null, a.name)),
    rt
      ? el('div', { class: 'rt' }, el('span', null, rt), ico('star', 'icon fill'))
      : el('div', { class: 'rt' }, el('span', null, t('جديد'))),
  );
}

// Full-width list row (recommended / search results)
function listRow(a, opts = {}) {
  const cat = categoryName(a.category);
  const rt = ratingOf(a);
  return el('a', { href: `/app?slug=${encodeURIComponent(a.slug)}`, class: 'approw' },
    el('div', { class: 'art' }, a.icon_url ? el('img', { src: a.icon_url, alt: a.name, loading: 'lazy' }) : ico('package', 'icon icon-lg')),
    el('div', { class: 'info' },
      el('div', { class: 'nm' }, el('bdi', null, a.name)),
      el('div', { class: 'sub' }, el('bdi', null, a.developer || cat || STORE.name)),
      el('div', { class: 'meta-line' },
        rt ? el('span', null, rt) : el('span', null, t('جديد')),
        rt ? ico('star', 'icon fill') : null,
        el('span', null, '•'),
        el('span', null, formatBytes(a.size_bytes || 0)),
      ),
    ),
    opts.installed
      ? el('span', { class: 'badge' }, ico('check', 'icon icon-sm'), t('مثبّت'))
      : el('span', { class: 'row-dl-btn' }, ico('download', 'icon')),
  );
}

// Square grid card used in the home-page grid view.
function gridCard(a) {
  const rt = ratingOf(a);
  return el('a', { href: `/app?slug=${encodeURIComponent(a.slug)}`, class: 'grid-card' },
    el('div', { class: 'grid-art' }, a.icon_url ? el('img', { src: a.icon_url, alt: a.name, loading: 'lazy' }) : ico('package', 'icon icon-lg')),
    el('div', { class: 'grid-info' },
      el('div', { class: 'grid-name' }, el('bdi', null, a.name)),
      el('div', { class: 'grid-meta' }, `${a.version_name ? 'v' + a.version_name : ''}${a.version_name ? ' • ' : ''}${formatBytes(a.size_bytes || 0)}`),
      el('div', { class: 'grid-rating' },
        rt ? el('span', null, rt) : el('span', null, t('جديد')),
        rt ? ico('star', 'icon fill') : null,
      ),
    ),
  );
}

// Google Play-style featured card: image with gradient + description overlay, compact info bar below.
function featureSlide(a) {
  const slide = el('a', { href: `/app?slug=${encodeURIComponent(a.slug)}`, class: 'fc-slide' });
  const media = el('div', { class: 'fc-media' });
  if (a.feature_url) {
    media.append(el('img', { src: a.feature_url, alt: a.name, loading: 'lazy', class: 'fc-media-img' }));
  } else {
    media.classList.add('fc-media-fallback');
    media.append(a.icon_url
      ? el('img', { class: 'fc-fallback-ico', src: a.icon_url, alt: '', loading: 'lazy' })
      : ico('package', 'icon icon-lg'));
  }
  // Description overlay on gradient at bottom of image
  const desc = a.short_description || a.description || '';
  if (desc) {
    media.append(el('div', { class: 'fc-desc' }, desc));
  }
  const rt = ratingOf(a);
  slide.append(
    media,
    el('div', { class: 'fc-bar' },
      el('div', { class: 'fc-bar-ico' }, a.icon_url ? el('img', { src: a.icon_url, alt: '' }) : ico('package', 'icon')),
      el('div', { class: 'fc-bar-text' },
        el('div', { class: 'fc-bar-name' }, a.name),
        el('div', { class: 'fc-bar-sub' },
          el('span', null, a.developer || ''),
          rt ? el('span', { class: 'fc-bar-rate' }, rt, ico('star', 'icon fill')) : null,
        ),
      ),
      el('span', { class: 'fc-bar-btn' }, t('تثبيت')),
    ),
  );
  return slide;
}

function featureCarousel(apps, opts = {}) {
  const list = (apps || []).filter(Boolean).slice(0, opts.max || 8);
  if (!list.length) return el('span');

  const track = el('div', { class: 'fc-track' });
  list.forEach((a) => track.append(featureSlide(a)));

  const dots = el('div', { class: 'fc-dots' });
  list.forEach((_, i) => dots.append(el('button', {
    class: `fc-dot ${i === 0 ? 'on' : ''}`, type: 'button',
    'aria-label': `${t('شريحة')} ${i + 1}`, onclick: (e) => { e.preventDefault(); go(i, true); },
  })));

  const wrap = el('div', { class: 'feature-carousel' }, track, list.length > 1 ? dots : null);

  let idx = 0;
  let timer = null;
  // Auto-advance is OFF by default — users complained that the carousel
  // "scrolls by itself" which interrupted manual touch scrolling. Manual
  // touch scroll + dots is the Google Play model.
  const AUTO_ADVANCE = false;

  // --- Touch-scroll carousel ---
  // The track is a native horizontal scroller: momentum, edge resistance and
  // swipe direction all follow the finger exactly (like Google Play). The
  // active index is derived from the scroll position; dots stay in sync.
  function slideWidth() {
    return track.clientWidth || wrap.clientWidth || 1;
  }
  function maxIndex() { return Math.max(0, list.length - 1); }
  function setIdx(i) {
    const clamped = Math.max(0, Math.min(maxIndex(), i));
    if (clamped === idx) return;
    idx = clamped;
    Array.from(dots.children).forEach((d, k) => d.classList.toggle('on', k === idx));
  }
  function goTo(i, smooth) {
    const clamped = Math.max(0, Math.min(maxIndex(), i));
    try { track.scrollTo({ left: clamped * slideWidth(), behavior: smooth ? 'smooth' : 'auto' }); }
    catch (e) { track.scrollLeft = clamped * slideWidth(); }
    setIdx(clamped);
  }
  function go(i, manual) { goTo(i, true); if (manual && AUTO_ADVANCE) restart(); }
  function restart() {
    if (timer) clearInterval(timer);
    if (!AUTO_ADVANCE || list.length <= 1) return;
    timer = setInterval(() => go(idx >= maxIndex() ? 0 : idx + 1), opts.interval || 6000);
  }
  function paint() { goTo(idx, false); }

  let rafPending = false;
  track.addEventListener('scroll', () => {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(() => {
      rafPending = false;
      const w = slideWidth();
      if (w > 0) setIdx(Math.round(track.scrollLeft / w));
    });
  }, { passive: true });

  // Resume auto-advance (if enabled) after the user finishes touching.
  let touchResumeTimer = null;
  track.addEventListener('touchstart', () => {
    if (timer) clearInterval(timer);
    if (touchResumeTimer) clearTimeout(touchResumeTimer);
  }, { passive: true });
  track.addEventListener('touchend', () => {
    if (!AUTO_ADVANCE) return;
    if (touchResumeTimer) clearTimeout(touchResumeTimer);
    touchResumeTimer = setTimeout(restart, 4000);
  }, { passive: true });
  wrap.addEventListener('mouseenter', () => { if (timer) clearInterval(timer); });
  wrap.addEventListener('mouseleave', restart);
  paint();
  restart();
  return wrap;
}

const CAT_NAMES = {
  // App categories
  social: 'تواصل اجتماعي', communication: 'اتصالات', tools: 'أدوات', productivity: 'إنتاجية',
  entertainment: 'ترفيه', education: 'تعليم', photography: 'تصوير', music: 'موسيقى وصوتيات',
  video_players: 'مشغّلات فيديو', finance: 'مالية', shopping: 'تسوق', news: 'أخبار ومجلات',
  health: 'صحة ولياقة', travel: 'سفر ومحلّي', food: 'طعام وشراب', lifestyle: 'أسلوب حياة',
  books: 'كتب ومراجع', business: 'أعمال', dating: 'تعارف', maps: 'خرائط وملاحة',
  medical: 'طبّي', personalization: 'تخصيص', sports: 'رياضة', weather: 'طقس',
  auto: 'سيارات ومركبات', beauty: 'جمال وتجميل', art_design: 'فنّ وتصميم',
  house_home: 'منزل', parenting: 'أبوّة وأمومة', events: 'فعاليات', comics: 'قصص مصوّرة',
  vpn: 'VPN وخصوصية', system: 'أدوات النظام', wallpapers: 'خلفيات', files: 'إدارة الملفات',
  connectivity: 'اتصال وشبكات', other: 'أخرى',
  // Game categories
  game_action: 'أكشن', game_adventure: 'مغامرات', game_arcade: 'أركيد', game_board: 'ألعاب لوحية',
  game_card: 'ورق (كوتشينة)', game_casino: 'كازينو', game_casual: 'عادية', game_educational: 'تعليمية',
  game_music: 'موسيقى', game_puzzle: 'ألغاز', game_racing: 'سباقات', game_rpg: 'تقمّص أدوار',
  game_simulation: 'محاكاة', game_sports: 'رياضية', game_strategy: 'استراتيجية',
  game_trivia: 'معلومات عامة', game_word: 'كلمات', game_other: 'ألعاب أخرى',
  game_family: 'عائلية', game_shooter: 'إطلاق نار', game_action_adventure: 'حركة ومغامرة',
  game_role_playing: 'ألعاب جماعية',
  // Legacy
  games: 'ألعاب',
};
function categoryName(slug) {
  if (!slug) return '';
  const known = CAT_NAMES[slug];
  if (known) return t(known);
  const lookup = window.GSI18N && window.GSI18N.lookup;
  const arKey = typeof lookup === 'function' ? lookup(slug) : null;
  if (arKey) return t(arKey);
  return t(slug);
}

/* -------------------------- States UI -------------------------- */
function spinner() { return el('div', { class: 'center' }, el('div', { class: 'spinner' })); }

// --- Skeleton loaders ---
function skEl(w, h, cls = '') {
  return el('div', { class: `sk ${cls}`, style: { width: w, height: h, flexShrink: '0' } });
}
function skeletonHome() {
  const wrap = el('div', { class: 'sk-section' });
  // Hero skeleton
  wrap.append(el('div', { class: 'sk-card', style: { width: '100%', height: '180px', marginBottom: '20px' } }));
  // Section title
  wrap.append(skEl('35%', '18px'));
  // Poster row
  const row = el('div', { class: 'sk-hrow', style: { marginTop: '12px' } });
  for (let i = 0; i < 4; i++) {
    const p = el('div', { class: 'sk-poster' });
    p.append(el('div', { class: 'sk-card', style: { width: '100px', height: '100px', borderRadius: '20px' } }));
    p.append(skEl('80px', '10px'));
    p.append(skEl('50px', '8px'));
    row.append(p);
  }
  wrap.append(row);
  // List section
  wrap.append(skEl('30%', '18px', ''), el('div', { style: { height: '16px' } }));
  for (let i = 0; i < 4; i++) {
    const r = el('div', { class: 'sk-row' });
    r.append(skEl('48px', '48px', 'sk-circle'));
    const info = el('div', { style: { flex: '1', display: 'flex', flexDirection: 'column', gap: '6px' } });
    info.append(skEl('60%', '12px'));
    info.append(skEl('40%', '10px'));
    r.append(info);
    wrap.append(r);
  }
  return wrap;
}
function skeletonDetail() {
  const wrap = el('div');
  const hdr = el('div', { class: 'sk-detail-header' });
  hdr.append(skEl('80px', '80px', '', ''));
  const hInfo = el('div', { style: { flex: '1', display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '4px' } });
  hInfo.append(skEl('70%', '18px'));
  hInfo.append(skEl('40%', '14px'));
  hInfo.append(skEl('30%', '12px'));
  hdr.append(hInfo);
  wrap.append(hdr);
  // Button skeleton
  const body = el('div', { class: 'sk-detail-body' });
  body.append(skEl('100%', '44px', ''));
  // Stats row
  const stats = el('div', { style: { display: 'flex', gap: '24px', justifyContent: 'center', marginTop: '8px' } });
  for (let i = 0; i < 3; i++) {
    const s = el('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' } });
    s.append(skEl('40px', '16px'));
    s.append(skEl('50px', '10px'));
    stats.append(s);
  }
  body.append(stats);
  // Screenshots
  const scrRow = el('div', { style: { display: 'flex', gap: '10px', overflow: 'hidden', marginTop: '12px' } });
  for (let i = 0; i < 3; i++) scrRow.append(el('div', { class: 'sk-card', style: { width: '140px', height: '250px', flexShrink: '0', borderRadius: '12px' } }));
  body.append(scrRow);
  // Description
  body.append(skEl('50%', '16px'));
  body.append(skEl('100%', '12px'));
  body.append(skEl('90%', '12px'));
  body.append(skEl('75%', '12px'));
  wrap.append(body);
  return wrap;
}
function skeletonList() {
  const wrap = el('div', { class: 'sk-list-section' });
  for (let i = 0; i < 6; i++) {
    const r = el('div', { class: 'sk-row' });
    r.append(skEl('48px', '48px', 'sk-circle'));
    const info = el('div', { style: { flex: '1', display: 'flex', flexDirection: 'column', gap: '6px' } });
    info.append(skEl('65%', '13px'));
    info.append(skEl('35%', '10px'));
    r.append(info);
    wrap.append(r);
  }
  return wrap;
}
// Poster-row skeleton for the "similar apps" section of the detail page.
function skeletonSimilar() {
  const row = el('div', { class: 'sk-similar' });
  for (let i = 0; i < 4; i++) {
    const c = el('div', { class: 'sk-sim-card' });
    c.append(el('div', { class: 'sk-card', style: { width: '104px', height: '104px', borderRadius: '20px' } }));
    c.append(skEl('84px', '10px'));
    row.append(c);
  }
  const wrap = el('div', { class: 'd-section' }, skEl('35%', '16px'), row);
  wrap.style.padding = '16px';
  return wrap;
}
function emptyState(title, hint, icon = 'package') {
  return el('div', { class: 'empty' }, ico(icon, 'icon'), el('h3', null, title), hint ? el('p', null, hint) : null);
}
function errorState(err) {
  if (err && (err.status === 0 || err.message === 'timeout'))
    return emptyState(t('تعذّر الاتصال بالخادم'), t('تحقّق من اتصالك بالإنترنت ثمّ حدّث الصفحة.'), 'globe');
  if (err && err.status >= 500)
    return emptyState(t('الخدمة غير متاحة مؤقتاً'), t('حاول لاحقاً بعد دقائق قليلة.'), 'info');
  return emptyState(t('تعذّر تحميل البيانات'), t('حدّث الصفحة وحاول مجدداً.'), 'info');
}

/* ----------------------------- Chrome ----------------------------- */
function avatarEl(user) {
  if (!user) {
    const btn = el('a', { href: '/login', class: 'avatar login-avatar', 'aria-label': t('تسجيل الدخول') });
    btn.append(ico('user', 'icon'));
    return btn;
  }
  const a = el('a', { href: '/account', class: 'avatar', 'aria-label': t('حسابك') });
  if (user.photoURL) a.append(el('img', { src: user.photoURL, alt: '', referrerpolicy: 'no-referrer' }));
  else a.append(document.createTextNode(initials(user)));
  return a;
}
function initials(user) {
  const n = (user && (user.displayName || user.email)) || '?';
  return n.trim().charAt(0).toUpperCase();
}

const NOTIF_SEEN_KEY = 'gs_notif_seen';

function notifSeenAt() {
  try { return Number(localStorage.getItem(NOTIF_SEEN_KEY) || 0) || 0; } catch { return 0; }
}
// Notifications baseline: set once at first sign-in so everything that
// existed on the platform BEFORE this user joined never appears to them.
function notifBaseline(uid) {
  try {
    if (!uid) return 0;
    const k = 'gs_notif_base_' + uid;
    let b = Number(localStorage.getItem(k) || 0) || 0;
    if (!b) { b = Math.floor(Date.now() / 1000); localStorage.setItem(k, String(b)); }
    return b;
  } catch { return 0; }
}
function setNotifSeenAt(ts) {
  try { localStorage.setItem(NOTIF_SEEN_KEY, String(Math.max(0, Number(ts || 0) || 0))); } catch {}
}
function maxNotifCreated(list) {
  return (list || []).reduce((max, n) => Math.max(max, Number(n && n.created_at || 0) || 0), 0);
}
function notifUnreadCount(list) {
  const seen = notifSeenAt();
  return (list || []).reduce((count, n) => count + (Number(n && n.created_at || 0) > seen ? 1 : 0), 0);
}
async function fetchNotifications() {
  try {
    const res = await api('/api/notifications?limit=30');
    return Array.isArray(res.notifications) ? res.notifications : [];
  } catch {
    return [];
  }
}
async function refreshBellBadge() {
  const badge = document.querySelector('.bell-btn .bell-badge');
  if (!badge) return;
  try {
    let list = await fetchNotifications();
    const base = notifBaseline(_user && _user.uid);
    if (base) list = list.filter((n) => Number(n.created_at || 0) > base);
    const count = notifUnreadCount(list);
    badge.textContent = count ? String(count) : '';
    badge.classList.toggle('hidden', !count);
  } catch {
    badge.textContent = '';
    badge.classList.add('hidden');
  }
}
async function openNotifications() {
  const overlay = el('div', { class: 'dialog-overlay' });
  const card = el('div', { class: 'dialog-card' });
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  card.append(
    el('div', { class: 'dialog-head' },
      el('div', { class: 'dialog-title' }, ico('bell'), t('الإشعارات')),
      el('button', { class: 'dialog-close', type: 'button', onclick: () => overlay.remove(), 'aria-label': t('إغلاق') }, ico('close')),
    ),
    el('div', { class: 'dialog-body' },
      el('div', { class: 'notifications-loading' }, el('div', { class: 'spinner' })),
    ),
  );
  overlay.append(card);
  document.body.append(overlay);

  let list = [];
  try {
    list = await fetchNotifications();
  } catch {}
  // Hide everything created before this user's sign-in baseline.
  const base = notifBaseline(_user && _user.uid);
  if (base) list = list.filter((n) => Number(n.created_at || 0) > base);
  const seen = maxNotifCreated(list);
  if (seen) setNotifSeenAt(Math.max(notifSeenAt(), seen));
  await refreshBellBadge();

  const body = card.querySelector('.dialog-body');
  body.innerHTML = '';
  if (!list.length) {
    body.append(emptyState(t('لا توجد إشعارات بعد'), '', 'bell'));
    return;
  }

  list.forEach((n) => {
    const type = n.type === 'new_app' || n.type === 'update' || n.type === 'announcement' ? n.type : 'announcement';
    let row;
    if (type === 'update' && n.data && n.data.apk_url) {
      row = el('a', { class: 'notif-row', href: '#', onclick: (e) => { e.preventDefault(); showUpdateDialog(n.data); overlay.remove(); } });
    } else if (n.app_slug) {
      row = el('a', { class: 'notif-row', href: `/app?slug=${encodeURIComponent(n.app_slug)}` });
    } else {
      row = el('div', { class: 'notif-row' });
    }
    row.append(
      el('div', { class: 'notif-ico' }, ico(type === 'new_app' ? 'package' : type === 'update' ? 'download' : 'bell')),
      el('div', { class: 'notif-info' },
        el('div', { class: 'notif-top' },
          el('strong', null, n.title || ''),
          el('span', { class: `notif-type notif-type-${type}` }, type === 'new_app' ? t('تطبيق جديد') : type === 'update' ? t('تحديث') : t('إعلان')),
        ),
        n.body ? el('div', { class: 'notif-body' }, n.body) : null,
        el('div', { class: 'notif-meta' }, formatDate(n.created_at)),
      ),
    );
    body.append(row);
  });
}

// Google Play–style home header: brand logo (start), search + bell + avatar (end).
function topbarSearch(user) {
  const bellBadge = el('span', { class: 'bell-badge hidden' });
  const searchBtn = el('button', {
    class: 'icon-btn',
    type: 'button',
    'aria-label': t('بحث'),
    title: t('بحث'),
    onclick: () => { location.href = '/search'; },
  }, ico('search'));
  const bellBtn = el('button', {
    class: 'bell-btn icon-btn',
    type: 'button',
    'aria-label': t('الإشعارات'),
    title: t('الإشعارات'),
    onclick: openNotifications,
  }, ico('bell'), bellBadge);
  Promise.resolve().then(() => refreshBellBadge());
  // Profile avatar moved to the bottom nav ("أنت"); the search button now sits
  // where the avatar used to be (top end).
  return el('div', { class: 'topbar' },
    el('div', { class: 'topbar-home' },
      el('a', { href: '/', class: 'brand', 'aria-label': 'Golden Store' }, el('img', { src: '/images/logo.png', alt: 'Golden Store' })),
      el('div', { class: 'tb-spacer' }),
      bellBtn,
      searchBtn,
    ),
  );
}

// Back/title top bar (detail)
// Smart back: return to wherever the user came from (search, home, games…);
// only fall back to the home page when this page was opened directly
// (deep link / cold start), where history.back() has nowhere to go.
function topbarNav(title = '', actions = []) {
  return el('div', { class: 'topbar-nav' },
    el('button', { class: 'icon-btn', 'aria-label': t('رجوع'), onclick: () => {
      if (document.referrer && history.length > 1) history.back();
      else location.href = '/';
    } }, ico('chevronEnd')),
    title ? el('div', { class: 'title' }, title) : el('div', { class: 'spacer' }),
    ...actions,
  );
}

const NAV_ITEMS_RAW = [
  { key: 'apps', label: 'التطبيقات', icon: 'apps', href: '/' },
  { key: 'games', label: 'الألعاب', icon: 'gamepad', href: '/games' },
  { key: 'library', label: 'مكتبتي', icon: 'download', href: '/account?tab=library' },
  { key: 'account', label: 'أنت', icon: 'user', href: '/account' },
];
function bottomNav(active) {
  const brand = el('a', { href: '/', class: 'sidebar-brand', 'aria-label': 'Golden Store' },
    el('img', { src: '/images/logo.png', alt: 'Golden Store' }),
    el('span', { class: 'sidebar-brand-text' },
      el('span', null, 'Golden'),
      el('b', null, 'Store'),
    ),
  );
  const nav = el('nav', { class: 'bottomnav' },
    el('div', { class: 'bottomnav-inner' },
      brand,
      ...NAV_ITEMS_RAW.map((it) => {
        // The account tab ("أنت") shows the signed-in user's profile picture
        // instead of a generic icon.
        const isAccount = it.key === 'account';
        let iconNode;
        if (isAccount && _user) {
          const av = el('span', { class: 'pill-ico nav-avatar' });
          if (_user.photoURL) av.append(el('img', { src: _user.photoURL, alt: '', referrerpolicy: 'no-referrer' }));
          else av.append(el('span', { class: 'nav-avatar-txt' }, initials(_user)));
          iconNode = av;
        } else {
          iconNode = el('span', { class: 'pill-ico' }, ico(it.icon, 'icon'));
        }
        return el('a', { href: it.href, class: `navitem ${it.key === active ? 'active' : ''}` },
          iconNode,
          el('span', { class: 'nav-label' }, t(it.label)),
        );
      }),
    ),
  );
  document.body.append(nav);
}

/* --------------------------- Auth gate --------------------------- */
// Sign-in UI lives on the dedicated /login page (see login.html / login.js).
// Other pages render optimistically from cache and redirect to /login when
// there is no valid session.

let _user = null;
let _authed = false;
let _ready = [];
let _gateEl = null;
let _chromeDone = false;

function devUser() {
  return { displayName: 'مستخدم تجريبي', email: 'demo@goldenstore.me', photoURL: null, uid: 'dev' };
}
function isLocalhost() {
  return ['localhost', '127.0.0.1', '0.0.0.0'].includes(location.hostname);
}

// Cache the last signed-in user so navigation between pages renders instantly
// (no login-screen flash) while Firebase re-validates the session in the background.
const CACHE_KEY = 'gs_user';
function cacheUser(user) {
  try {
    if (user) localStorage.setItem(CACHE_KEY, JSON.stringify({
      displayName: user.displayName || '', email: user.email || '', photoURL: user.photoURL || '', uid: user.uid || '',
    }));
    else localStorage.removeItem(CACHE_KEY);
  } catch {}
}
function cachedUser() {
  try { const v = localStorage.getItem(CACHE_KEY); return v ? JSON.parse(v) : null; } catch { return null; }
}

function hideGate() { if (_gateEl) { _gateEl.remove(); _gateEl = null; } }
// The mandatory sign-in gate is hidden through hideAuthGate() (called by
// initAuth's onAuthChange handler), nothing else needed here.

function onAuthed(user) {
  const firstRender = !_authed;
  _user = user;
  _authed = true;
  if (user && user.uid && !String(user.uid).startsWith('gs_')) notifBaseline(user.uid);
  hideGate();
  document.body.style.overflow = '';
  if (firstRender) {
    _ready.forEach((fn) => { try { fn(user); } catch (e) { console.error(e); } });
    _ready = [];
  }
}

function ready(fn) {
  if (_authed) { try { fn(_user); } catch (e) { console.error(e); } }
  else _ready.push(fn);
}

function isLoggedIn() { return !!_user; }

async function authedApi(path, opts = {}) {
  if (!window.GAuth || !window.GAuth.getIdToken) { const e = new Error('unauthorized'); e.status = 401; throw e; }
  // Pages render optimistically from the cached user, so Firebase may not have
  // resolved _currentUser yet. Wait for it before requesting an ID token.
  let token = await window.GAuth.getIdToken();
  if (!token && window.GAuth.ready) { await window.GAuth.ready(); token = await window.GAuth.getIdToken(true); }
  if (!token) { const e = new Error('unauthorized'); e.status = 401; throw e; }
  const headers = Object.assign({ 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, opts.headers || {});
  return api(path, { ...opts, headers });
}

// Shows a login-required modal; returns a Promise that resolves to the user
// (after successful sign-in) or rejects if cancelled.
function requireAuth() {
  if (_user) return Promise.resolve(_user);
  return new Promise((resolve, reject) => {
    const overlay = el('div', { class: 'dialog-overlay auth-required-overlay' });
    overlay.addEventListener('click', (e) => { if (e.target === overlay) { overlay.remove(); reject(new Error('cancelled')); } });
    const card = el('div', { class: 'dialog-card auth-required-card' },
      el('div', { class: 'auth-required-header' },
        el('img', { src: '/images/logo.png', alt: 'Golden Store', class: 'auth-logo' }),
        el('h2', { class: 'auth-title' }, t('تسجيل الدخول مطلوب')),
        el('p', { class: 'auth-desc' }, t('سجّل الدخول بحساب Google لتتمكن من تنزيل التطبيقات والتقييم والمزيد.')),
      ),
      el('button', { class: 'gbtn auth-google-btn', type: 'button', html: '<svg class="gico" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg><span class="gbtn-label">' + t('متابعة باستخدام Google') + '</span>', onclick: async () => {
        try {
          const user = await window.GAuth.signInWithGoogle();
          if (user) {
            cacheUser(user);
            onAuthed(user);
            overlay.remove();
            resolve(user);
          }
        } catch (e) {
          if (e && e.code === 'auth/in-app-browser') {
            toast(t('افتح الرابط في المتصفح الخارجي لتسجيل الدخول'), 'error');
          } else {
            toast(t('تعذّر تسجيل الدخول، حاول مجدداً'), 'error');
          }
        }
      } }),
      el('button', { class: 'btn btn-secondary auth-cancel-btn', type: 'button', onclick: () => { overlay.remove(); reject(new Error('cancelled')); } }, t('إلغاء')),
    );
    overlay.append(card);
    document.body.append(overlay);
  });
}

let _redirectingToLogin = false;
function goToLogin() {
  if (_redirectingToLogin) return;
  _redirectingToLogin = true;
  const next = location.pathname + location.search;
  location.replace('/login?next=' + encodeURIComponent(next));
}

function showAuthGate() {
  // Full-screen sign-in gate: nothing in the store is reachable until the
  // user signs in with Google. Notifications are only registered after this
  // succeeds, so users never receive platform notifications before signing in.
  if (document.getElementById('gs-auth-gate')) return;
  const gate = el('div', { id: 'gs-auth-gate', class: 'gate' });
  const inner = el('div', null,
    el('div', { class: 'logo' }, el('img', { src: '/images/logo.png', alt: 'Golden Store' })),
    el('h1', null, 'Golden', el('b', null, 'Store')),
    el('p', null, t('سجّل الدخول بحساب Google للوصول إلى المتجر وتطبيقاته وإشعاراته.')),
    el('button', { class: 'gbtn auth-google-btn', type: 'button', html: '<svg class="gico" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg><span class="gbtn-label">' + t('متابعة باستخدام Google') + '</span>' }),
    el('div', { class: 'gate-spinner hidden' }, el('div', { class: 'spinner' })),
    el('div', { class: 'gate-error hidden' }),
  );
  gate.append(inner);
  document.body.append(gate);
  document.body.style.overflow = 'hidden';

  const btn = gate.querySelector('.gbtn');
  const spin = gate.querySelector('.gate-spinner');
  const errBox = gate.querySelector('.gate-error');
  function setError(msg) {
    if (!errBox) return;
    errBox.textContent = msg;
    errBox.classList.remove('hidden');
    if (spin) spin.classList.add('hidden');
    if (btn) { btn.disabled = false; btn.style.display = 'inline-flex'; }
  }
  function mapError(e) {
    const code = e && e.code;
    if (code === 'auth/in-app-browser') return t('افتح الصفحة في متصفّح مثل Chrome لإتمام تسجيل الدخول.');
    if (code === 'auth/unauthorized-domain') return t('هذا النطاق غير مُصرَّح به في Firebase Authentication.');
    if (code === 'auth/operation-not-allowed') return t('مزوّد Google غير مُفعَّل في Firebase.');
    if (code === 'auth/network-request-failed') return t('تعذّر الاتصال بالشبكة. تحقّق من الإنترنت وحاول مجدداً.');
    if (code === 'auth/popup-blocked') return t('المتصفّح حظر النافذة المنبثقة. اسمح بها ثم حاول مجدداً.');
    return t('تعذّر تسجيل الدخول. حاول مجدداً.');
  }
  if (btn) btn.addEventListener('click', async () => {
    if (errBox) errBox.classList.add('hidden');
    if (btn) btn.disabled = true;
    if (spin) spin.classList.remove('hidden');
    try {
      const user = await window.GAuth.signInWithGoogle();
      if (user) return; // onAuthChange will tear the gate down
      if (spin) spin.classList.add('hidden');
      if (btn) btn.disabled = false;
    } catch (e) {
      setError(mapError(e));
    }
  });
}

function hideAuthGate() {
  const gate = document.getElementById('gs-auth-gate');
  if (gate) gate.remove();
  document.body.style.overflow = '';
}

function initAuth() {
  // Localhost-only preview bypass (never active in production).
  if (isLocalhost() && getQuery('devskip') === '1') { onAuthed(devUser()); return; }

  // If GAuth isn't available (SDK failed to load), keep the gate visible
  // with a retry affordance instead of letting guests browse the store.
  if (!window.GAuth || typeof window.GAuth.onAuthChange !== 'function') {
    console.error('GAuth not available — Firebase SDK may have failed to load');
    showAuthGate();
    return;
  }

  try { window.GAuth.init(); } catch (e) { console.error('GAuth.init failed', e); }
  window.GAuth.onAuthChange((user) => {
    if (user) {
      cacheUser(user);
      onAuthed(user);
      hideAuthGate();
    } else {
      // No valid session: block the store behind the sign-in gate.
      cacheUser(null);
      _user = null;
      hideGate();
      showAuthGate();
    }
  });
}
async function signOut() {
  cacheUser(null);
  try { await window.GAuth.signOut(); } catch {}
  location.href = '/';
}

/* ----------------------------- App update popup ----------------------------- */
const APP_UPDATE_DISMISS_KEY = 'gs_app_update_dismissed';

function getCurrentAppVersion() {
  try {
    const cfg = window.Capacitor && window.Capacitor.getConfig && window.Capacitor.getConfig();
    if (cfg && cfg.appVersion) return String(cfg.appVersion);
  } catch (e) {}
  return '1.0';
}

function shouldShowUpdate(update) {
  if (!update || !update.version_name || !update.apk_url) return false;
  try {
    const dismissed = JSON.parse(localStorage.getItem(APP_UPDATE_DISMISS_KEY) || '{}');
    if (!update.force && dismissed[update.version_name]) return false;
  } catch (e) {}
  return String(update.version_name) !== getCurrentAppVersion();
}

function showUpdateDialog(update) {
  if (!update || !update.apk_url) return;
  const existing = document.getElementById('gs-update-dialog');
  if (existing) existing.remove();

  const overlay = el('div', {
    id: 'gs-update-dialog',
    style: {
      position: 'fixed', inset: '0', zIndex: '300',
      background: 'rgba(0,0,0,.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
    },
  });
  const card = el('div', {
    style: {
      background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--line)', borderRadius: '20px',
      maxWidth: '420px', width: '100%', padding: '24px', textAlign: 'center', boxShadow: '0 24px 80px rgba(0,0,0,.4)',
    },
  },
    el('div', { style: { fontSize: '48px', marginBottom: '10px' } }, '⬆'),
    el('h2', { style: { fontSize: '20px', marginBottom: '8px' } }, t('تحديث جديد متاح')),
    el('p', { style: { color: 'var(--text-2)', fontSize: '14px', lineHeight: '1.7', marginBottom: '18px' } },
      update.notes || t('يتوفر إصدار جديد من التطبيق. حمّله الآن للحصول على أحدث الميزات والإصلاحات.'),
    ),
  );

  const android = window.GSAndroid;
  function startDownload() {
    if (android && typeof android.downloadApk === 'function') {
      const filename = 'goldenstore-' + (update.version_name || 'update') + '.apk';
      try {
        android.downloadApk(update.apk_url, filename, 'app-update', 'com.goldenstore.app');
        card.innerHTML = '<div style="font-size:48px;margin-bottom:10px">⬇</div><h2 style="font-size:20px;margin-bottom:8px">' + t('جارٍ التحميل…') + '</h2><p style="color:var(--text-2);font-size:14px;line-height:1.7">' + t('سيتم التثبيت تلقائياً عند اكتمال التحميل.') + '</p>';
        return;
      } catch (e) {}
    }
    // Fallback: open the APK URL in the system/browser.
    window.open(update.apk_url, '_blank');
    setTimeout(() => overlay.remove(), 200);
  }

  const actions = el('div', { style: { display: 'flex', gap: '10px', flexDirection: 'column' } },
    el('button', {
      class: 'btn btn-primary btn-lg',
      type: 'button',
      onclick: startDownload,
    }, ico('download'), t('تحميل الآن')),
    update.force ? null : el('button', {
      class: 'btn btn-secondary',
      type: 'button',
      onclick: () => {
        try { const d = JSON.parse(localStorage.getItem(APP_UPDATE_DISMISS_KEY) || '{}'); d[update.version_name] = Date.now(); localStorage.setItem(APP_UPDATE_DISMISS_KEY, JSON.stringify(d)); } catch (e) {}
        overlay.remove();
      },
    }, t('لاحقاً')),
  );
  card.append(actions);

  overlay.append(card);
  overlay.addEventListener('click', (e) => { if (e.target === overlay && !update.force) overlay.remove(); });
  document.body.append(overlay);
}

window.__gsApkDownloadUpdate = function (slug, status, progress, message) {
  // --- Central live-state hub (page-independent, like Google Play) ---
  // Every native download/install event flows through here so ANY screen
  // (app page, library, home) can render the same live progress and status.
  try {
    if (slug && slug !== 'app-update') {
      if (status === 'downloading') {
        const prev = getApkState(slug) || {};
        setApkState(slug, {
          slug, status: 'downloading',
          progress: progress >= 0 ? progress : (prev.progress || 0),
          filename: message || prev.filename || '',
          updated_at: Math.floor(Date.now() / 1000),
        });
        const dls = getActiveDownloadMap();
        const entry = dls[slug] || {};
        setActiveDownload({
          slug,
          name: entry.name || slug,
          icon_url: entry.icon_url || null,
          developer: entry.developer || '',
          size_bytes: entry.size_bytes || 0,
          progress: progress >= 0 ? progress : (entry.progress || 0),
          status: 'downloading',
          started_at: entry.started_at || Math.floor(Date.now() / 1000),
        });
      } else if (status === 'downloaded') {
        setApkState(slug, { slug, status: 'downloaded', progress: 1, filename: message || (getApkState(slug) || {}).filename || '', updated_at: Math.floor(Date.now() / 1000) });
        const dls = getActiveDownloadMap();
        if (dls[slug]) setActiveDownload({ slug, status: 'downloaded', progress: 1 });
      } else if (status === 'installing') {
        setApkState(slug, { slug, status: 'installing', progress: 1, updated_at: Math.floor(Date.now() / 1000) });
        const dls = getActiveDownloadMap();
        if (dls[slug]) setActiveDownload({ slug, status: 'installing', progress: 1 });
      } else if (status === 'installed') {
        // Central pipeline: registry + state cleanup + UI events. `message`
        // carries the REAL resolved package name (native ground truth).
        applyInstalled(slug, message || '');
      } else if (status === 'uninstalled') {
        unmarkInstalledStored(slug);
        removeApkState(slug);
        removeActiveDownload(slug);
        try { window.dispatchEvent(new CustomEvent('gs-apk-state', { detail: { slug, status: 'uninstalled', progress: -1, message } })); } catch (e) {}
        try { window.dispatchEvent(new CustomEvent('gs-package-uninstalled', { detail: { slug, packageName: message } })); } catch (e) {}
        return;
      } else if (status === 'cancelled' || status === 'failed') {
        const isInst = (typeof isSlugInstalled === 'function' && isSlugInstalled(slug)) || (typeof resolvedPackageName === 'function' && resolvedPackageName(slug) && typeof isPackageInstalled === 'function' && isPackageInstalled(resolvedPackageName(slug)));
        if (isInst && status === 'failed') {
          return;
        }
        removeApkState(slug);
        removeActiveDownload(slug);
      }
      // NOTE: for "installed" applyInstalled() already dispatched the
      // gs-apk-state event — don't fire it twice (double toasts/UI swaps).
      if (status !== 'installed') {
        try { window.dispatchEvent(new CustomEvent('gs-apk-state', { detail: { slug, status, progress, message } })); } catch (e) {}
      }
    }
  } catch (e) { console.error('[apkStateHub]', e); }

  // --- Self-update dialog (Golden Store app itself) ---
  if (slug !== 'app-update') return;
  if (status === 'failed') {
    const map = {
      signature_mismatch: t('تعارض توقيع الحزمة: ألغِ التطبيق المثبت ثم ثبّت النسخة الجديدة.'),
      package_mismatch: t('اسم الحزمة غير متطابق مع التطبيق.'),
      apk_parse_failed: t('تعذّر قراءة ملف APK.'),
      install_error: t('فشل التثبيت.'),
      file_missing: t('ملف التحميل مفقود.'),
    };
    toast(map[message] || t('فشل التحميل'), 'error');
    const card = document.querySelector('#gs-update-dialog .gs-update-card');
    if (card) card.innerHTML = '<div style="font-size:48px;margin-bottom:10px">⚠</div><h2 style="font-size:20px;margin-bottom:8px">' + t('فشل التحديث') + '</h2><p style="color:var(--text-2);font-size:14px;line-height:1.7">' + (map[message] || t('تعذّر تحديث التطبيق. حاول إلغاء التثبيت وإعادة المحاولة.')) + '</p>';
  } else if (status === 'installed') {
    toast(t('تم التحديث بنجاح'), 'success');
    setTimeout(() => { try { location.reload(); } catch (e) {} }, 500);
  }
};

// Native pushes a full snapshot after reconciling states with the device
// (fired on every onResume). Merges everything into the live hub.
window.__gsDownloadStatesSnapshot = function (states) {
  try {
    if (!states || typeof states !== 'object') return;
    Object.keys(states).forEach((slug) => {
      const st = states[slug] || {};
      const status = st.status || 'downloading';
      const progress = typeof st.progress === 'number' ? st.progress : -1;
      if (status === 'downloading') {
        setApkState(slug, {
          slug, status: 'downloading', progress: progress >= 0 ? progress : 0,
          filename: st.filename || '', package_name: st.package_name || '',
          updated_at: st.updated_at || 0,
        });
        const dls = getActiveDownloadMap();
        const entry = dls[slug] || {};
        setActiveDownload({
          slug, name: entry.name || slug, icon_url: entry.icon_url || null,
          developer: entry.developer || '', size_bytes: entry.size_bytes || st.total_bytes || 0,
          progress: progress >= 0 ? progress : (entry.progress || 0),
          status: 'downloading', started_at: entry.started_at || Math.floor(Date.now() / 1000),
        });
      } else if (status === 'downloaded' || status === 'installing') {
        setApkState(slug, { slug, status, progress: 1, filename: st.filename || '', package_name: st.package_name || '', updated_at: st.updated_at || 0 });
      } else {
        removeApkState(slug);
        removeActiveDownload(slug);
      }
      try { window.dispatchEvent(new CustomEvent('gs-apk-state', { detail: { slug, status, progress, message: st.filename || '' } })); } catch (e) {}
    });
    // Native is the SOURCE OF TRUTH: prune web-side entries it no longer
    // tracks (installs completed / cancelled while this page was closed).
    // Without this, the library keeps showing "جارٍ التثبيت" forever.
    const valid = new Set(Object.keys(states));
    const apkMap = getApkStateMap();
    Object.keys(apkMap).forEach((slug) => {
      if (slug === 'app-update') return; // self-update flow tracks itself
      if (!valid.has(slug)) { removeApkState(slug); removeActiveDownload(slug); }
    });
    notifyActiveDownloads();
  } catch (e) { console.error('[statesSnapshot]', e); }
};

// Native bridge notifies the web layer when any package is uninstalled.
// Pages that care (app detail) listen for 'gs-package-uninstalled' and can
// match the removed package name against the app they display.
window.__gsPackageUninstalled = function (packageName) {
  try {
    if (!packageName) return;
    window.dispatchEvent(new CustomEvent('gs-package-uninstalled', { detail: { packageName: packageName } }));
    watchedApps.forEach((pkg, slug) => {
      if (pkg === packageName || resolvedPackageName(slug) === packageName) {
        unmarkInstalledStored(slug);
        removeApkState(slug);
        removeActiveDownload(slug);
        try { window.dispatchEvent(new CustomEvent('gs-apk-state', { detail: { slug, status: 'uninstalled', progress: -1, message: packageName } })); } catch (e) {}
      }
    });
  } catch (e) {}
};

async function checkAppUpdate() {
  if (!isNativeApp()) return;
  try {
    const update = await api('/api/app-update', { timeoutMs: 8000 });
    if (shouldShowUpdate(update)) showUpdateDialog(update);
  } catch (e) { console.error('[appUpdate] check failed', e); }
}

/* ------------------- Live APK state registry (persistent) ------------------- */
// Tracks downloading / downloaded / installing states across pages and app
// restarts. The native bridge pushes snapshots; every page can subscribe.
const APK_STATE_KEY = 'gs_apk_states';
function getApkStateMap() {
  try {
    const raw = JSON.parse(localStorage.getItem(APK_STATE_KEY) || '{}');
    return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  } catch { return {}; }
}
function getApkState(slug) {
  if (!slug) return null;
  return getApkStateMap()[slug] || null;
}
function setApkState(slug, patch) {
  if (!slug || !patch) return;
  const map = getApkStateMap();
  map[slug] = { ...(map[slug] || {}), ...patch, slug };
  try { localStorage.setItem(APK_STATE_KEY, JSON.stringify(map)); } catch {}
}
function removeApkState(slug) {
  if (!slug) return;
  const map = getApkStateMap();
  if (!map[slug]) return;
  delete map[slug];
  try { localStorage.setItem(APK_STATE_KEY, JSON.stringify(map)); } catch {}
}
function onApkState(fn) {
  const handler = (e) => { try { fn(e.detail || {}); } catch (err) { console.error(err); } };
  window.addEventListener('gs-apk-state', handler);
  return () => window.removeEventListener('gs-apk-state', handler);
}

// Pull the full download/install snapshot from the native bridge (called on
// every page load). This is what makes progress/status live across restarts:
// the native side persists its states and reconciles them with the device.
function syncNativeStates() {
  if (!isNativeApp()) return;
  try {
    if (window.GSAndroid && typeof window.GSAndroid.getDownloadStates === 'function') {
      const raw = window.GSAndroid.getDownloadStates();
      if (raw) window.__gsDownloadStatesSnapshot(JSON.parse(raw));
    }
  } catch (e) { console.error('[syncNativeStates]', e); }
}

/* ------------------- Device truth resolver + heartbeat (v1.9) -------------------
 * The #1 reliability rule of Google Play: the DEVICE decides, always.
 * Native checkAppStatus(slug, pkg) resolves an app through every ground truth
 * (metadata package → slug registry → REAL package read from the APK file),
 * so a missed broadcast, a stale snapshot or wrong store metadata can never
 * leave a button stuck on "جارٍ التثبيت" or "تثبيت + حذف الملف" again:
 * within a heartbeat the UI re-syncs itself to the real device state. */
function isNativeBridge() {
  return !!(window.GSAndroid && typeof window.GSAndroid.checkAppStatus === 'function');
}
// Ask the device for the REAL install status of an app. Returns
// { installed, version, package_name, status, progress, filename } or null.
function checkAppStatus(slug, packageName) {
  if (!slug || !isNativeBridge()) return null;
  try {
    const raw = window.GSAndroid.checkAppStatus(String(slug), String(packageName || ''));
    const obj = raw ? JSON.parse(raw) : null;
    if (obj && obj.package_name) rememberResolvedPackage(slug, obj.package_name);
    return obj;
  } catch (e) { return null; }
}
// slug → REAL device package (learned from successful status checks / install
// events). Open/Uninstall must always use THIS, never the possibly-wrong
// store metadata.
const RESOLVED_PKG_KEY = 'gs_resolved_pkgs';
function rememberResolvedPackage(slug, pkg) {
  if (!slug || !pkg) return;
  try {
    const map = JSON.parse(sessionStorage.getItem(RESOLVED_PKG_KEY) || '{}');
    if (map[slug] === pkg) return;
    map[slug] = pkg;
    sessionStorage.setItem(RESOLVED_PKG_KEY, JSON.stringify(map));
  } catch {}
}
function resolvedPackageName(slug) {
  if (!slug) return '';
  try {
    const map = JSON.parse(sessionStorage.getItem(RESOLVED_PKG_KEY) || '{}');
    return map[slug] || '';
  } catch { return ''; }
}
// Central "install completed" pipeline — the ONLY place that flips states,
// so events from the native push, the snapshot and the heartbeat all end up
// in exactly the same clean state.
const recentInstalledAt = Object.create(null);
function applyInstalled(slug, resolvedPkg) {
  if (!slug) return;
  const now = Date.now();
  if (now - (recentInstalledAt[slug] || 0) < 3000) return; // dedupe bursts
  recentInstalledAt[slug] = now;
  if (resolvedPkg) rememberResolvedPackage(slug, resolvedPkg);
  markInstalledStored(slug);
  removeApkState(slug);
  removeActiveDownload(slug);
  try { window.dispatchEvent(new CustomEvent('gs-apk-state', { detail: { slug, status: 'installed', progress: 1, message: resolvedPkg || '' } })); } catch (e) {}
  try { window.dispatchEvent(new CustomEvent('gs-install-resolved', { detail: { slug, packageName: resolvedPkg || '' } })); } catch (e) {}
}
// Apps the current page wants watched (detail page registers its app here;
// the heartbeat keeps it synced even with zero live downloads).
const watchedApps = new Map(); // slug → packageName
let heartbeatTimer = null;
function registerInstallWatch(slug, packageName) {
  if (!slug) return;
  watchedApps.set(slug, packageName || '');
  startHeartbeat();
}
function startHeartbeat() {
  if (heartbeatTimer || !isNativeBridge()) return;
  heartbeatTimer = setInterval(heartbeatTick, 1500);
  // Re-sync the moment the page becomes visible/focused again (returning
  // from the system installer, app switch, lock screen…).
  const onVisible = () => { if (!document.hidden) heartbeatTick(); };
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('focus', onVisible);
  window.addEventListener('pageshow', onVisible);
}
function heartbeatTick() {
  if (!isNativeBridge()) return;
  try {
    // 1) The app this page displays (even when no live download exists).
    watchedApps.forEach((pkg, slug) => {
      const targetPkg = pkg || resolvedPackageName(slug) || '';
      const st = checkAppStatus(slug, targetPkg);
      if (st && st.installed) {
        applyInstalled(slug, st.package_name);
      } else if (st && !st.installed && isInstalledStored(slug)) {
        unmarkInstalledStored(slug);
        removeApkState(slug);
        removeActiveDownload(slug);
        try { window.dispatchEvent(new CustomEvent('gs-apk-state', { detail: { slug, status: 'uninstalled', progress: -1, message: targetPkg } })); } catch (e) {}
        try { window.dispatchEvent(new CustomEvent('gs-package-uninstalled', { detail: { slug, packageName: targetPkg } })); } catch (e) {}
      }
    });
    // 2) Every non-idle live entry (self-heals the library & other pages).
    const map = getApkStateMap();
    Object.keys(map).forEach((slug) => {
      const st = map[slug];
      if (!st || st.status === 'none') return;
      if (st.status === 'downloading') return;
      const info = st.package_name || resolvedPackageName(slug) || '';
      const res = checkAppStatus(slug, info);
      if (res && res.installed) {
        applyInstalled(slug, res.package_name);
      } else if (res && !res.installed && isInstalledStored(slug)) {
        unmarkInstalledStored(slug);
        removeApkState(slug);
        removeActiveDownload(slug);
        try { window.dispatchEvent(new CustomEvent('gs-apk-state', { detail: { slug, status: 'uninstalled', progress: -1, message: info } })); } catch (e) {}
      }
    });
  } catch (e) { console.error('[heartbeat]', e); }
}

/* ------------------- Installed apps registry (device truth) ------------------- */
const INSTALL_KEY = 'gs_installed';
function installedSet() {
  try { return new Set(JSON.parse(localStorage.getItem(INSTALL_KEY) || '[]')); } catch { return new Set(); }
}
function isInstalledStored(slug) { return installedSet().has(slug); }
function markInstalledStored(slug) {
  try { const s = installedSet(); s.add(slug); localStorage.setItem(INSTALL_KEY, JSON.stringify([...s])); } catch {}
}
function unmarkInstalledStored(slug) {
  try { const s = installedSet(); s.delete(slug); localStorage.setItem(INSTALL_KEY, JSON.stringify([...s])); } catch {}
}
// REAL device check: asks the native PackageManager. Returns the installed
// versionName, or '' when not installed / not running natively.
function installedVersionOnDevice(packageName) {
  if (!isNativeApp() || !packageName) return '';
  try {
    if (window.GSAndroid && typeof window.GSAndroid.isPackageInstalled === 'function') {
      return window.GSAndroid.isPackageInstalled(packageName) || '';
    }
  } catch (e) {}
  return '';
}
// Slug-based installed check: the native registry remembers slug→package for
// every real install, so this keeps فتح/إلغاء التثبيت correct even when the
// store metadata package name is missing or wrong. Returns versionName or ''.
function isSlugInstalled(slug) {
  if (!isNativeApp() || !slug) return '';
  try {
    if (window.GSAndroid && typeof window.GSAndroid.isSlugInstalled === 'function') {
      return window.GSAndroid.isSlugInstalled(slug) || '';
    }
  } catch (e) {}
  return '';
}
// Compare dotted versions: true when `store` is strictly newer than `device`.
function versionIsNewer(storeVersion, deviceVersion) {
  if (!storeVersion || !deviceVersion) return false;
  if (deviceVersion === 'installed') return false;
  const norm = (v) => String(v).split(/[.\-_+]/).map((x) => parseInt(x, 10) || 0);
  const a = norm(storeVersion), b = norm(deviceVersion);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] || 0, y = b[i] || 0;
    if (x > y) return true;
    if (x < y) return false;
  }
  return false;
}
// Cancel a native download (Google Play style long-press/cancel affordance).
function cancelDownload(slug) {
  try {
    if (isNativeApp() && window.GSAndroid && typeof window.GSAndroid.cancelDownload === 'function') {
      window.GSAndroid.cancelDownload(slug);
    }
    removeActiveDownload(slug);
    removeApkState(slug);
  } catch (e) {}
}

/* ----------------------------- Boot ----------------------------- */
function boot() {
  initAuth();
  // Restore live download/install states from the native bridge right away so
  // the app page and the library show real progress/status after a restart.
  syncNativeStates();
  // Device-truth heartbeat: continuously reconcile install states with the
  // real PackageManager so no missed event can ever leave a button stuck.
  startHeartbeat();
  // Check for a newer app version shortly after the store renders.
  if (isNativeApp()) setTimeout(checkAppUpdate, 2000);
}

/* ----------------------------- Download History ----------------------------- */
const DL_HISTORY_KEY = 'gs_downloads';
function getDownloadHistory() {
  try { return JSON.parse(localStorage.getItem(DL_HISTORY_KEY) || '[]'); } catch { return []; }
}
function addToDownloadHistory(app) {
  try {
    const list = getDownloadHistory();
    // Remove existing entry for same slug to avoid duplicates
    const filtered = list.filter((e) => e.slug !== app.slug);
    filtered.unshift({
      slug: app.slug,
      name: app.name,
      icon_url: app.icon_url || null,
      developer: app.developer || '',
      size_bytes: app.size_bytes || 0,
      package_name: app.package_name || '',
      downloaded_at: Math.floor(Date.now() / 1000),
    });
    // Keep max 200 entries
    localStorage.setItem(DL_HISTORY_KEY, JSON.stringify(filtered.slice(0, 200)));
  } catch {}
}
function clearDownloadHistory() {
  try { localStorage.removeItem(DL_HISTORY_KEY); } catch {}
}

const ACTIVE_DL_KEY = 'gs_active_dl';
function getActiveDownloadMap() {
  try {
    const raw = JSON.parse(localStorage.getItem(ACTIVE_DL_KEY) || '{}');
    return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  } catch {
    return {};
  }
}
function notifyActiveDownloads() {
  try { window.dispatchEvent(new CustomEvent('gs-active-dl')); } catch {}
}
function writeActiveDownloadMap(map) {
  try { localStorage.setItem(ACTIVE_DL_KEY, JSON.stringify(map)); } catch {}
  notifyActiveDownloads();
}
function getActiveDownloads() {
  return Object.values(getActiveDownloadMap()).sort((a, b) => (b.started_at || 0) - (a.started_at || 0));
}
function setActiveDownload(entry) {
  if (!entry || !entry.slug) return null;
  const map = getActiveDownloadMap();
  map[entry.slug] = { ...(map[entry.slug] || {}), ...entry };
  writeActiveDownloadMap(map);
  return map[entry.slug];
}
function updateActiveDownloadProgress(slug, progress) {
  if (!slug) return;
  const map = getActiveDownloadMap();
  const entry = map[slug];
  if (!entry) return;
  entry.progress = progress;
  map[slug] = entry;
  writeActiveDownloadMap(map);
}
function removeActiveDownload(slug) {
  if (!slug) return;
  const map = getActiveDownloadMap();
  if (!map[slug]) return;
  delete map[slug];
  writeActiveDownloadMap(map);
}
function onActiveDownloadsChange(fn) {
  const handler = () => fn(getActiveDownloads());
  const onStorage = (e) => {
    if (!e || e.key === ACTIVE_DL_KEY || e.key === null) handler();
  };
  window.addEventListener('gs-active-dl', handler);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener('gs-active-dl', handler);
    window.removeEventListener('storage', onStorage);
  };
}


/* --------------- Native app integration (Capacitor/WebView) --------------- */
// Disable pinch/double-tap zoom, long-press text selection and the callout
// menu so the store feels like a native app. Inputs stay selectable so search
// and forms keep working.
(function injectNativeUx() {
  try {
    var style = document.createElement('style');
    style.textContent =
      'html,body{-webkit-text-size-adjust:100%;touch-action:manipulation;}' +
      '*{-webkit-touch-callout:none;-webkit-tap-highlight-color:transparent;}' +
      'body{-webkit-user-select:none;-moz-user-select:none;-ms-user-select:none;user-select:none;}' +
      'input,textarea,[contenteditable="true"]{-webkit-user-select:text;user-select:text;}' +
      '.bottomnav .nav-avatar{display:flex;align-items:center;justify-content:center;}' +
      '.bottomnav .nav-avatar img{width:24px;height:24px;border-radius:50%;object-fit:cover;display:block;}' +
      '.bottomnav .nav-avatar-txt{width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#0d0d0f;background:#e0b64c;}';
    (document.head || document.documentElement).appendChild(style);
    document.addEventListener('gesturestart', function (e) { e.preventDefault(); }, { passive: false });
    // Block pinch-zoom via multi-touch.
    document.addEventListener('touchmove', function (e) {
      if (e.touches && e.touches.length > 1) e.preventDefault();
    }, { passive: false });
  } catch (e) {}
})();

// FCM push token bridge. The native app fetches its FCM token and calls
// window.__gsRegisterPushToken(token). We forward it to the backend only for
// logged-in users, so pushes reach registered users only.
(function pushBridge() {
  var currentToken = null;
  var registeredToken = null;

  function getStoredReg() {
    try { return JSON.parse(localStorage.getItem('__gs_push_reg')); } catch (e) { return null; }
  }
  function setStoredReg(token, uid) {
    try { localStorage.setItem('__gs_push_reg', JSON.stringify({ token: token, uid: uid, ts: Date.now() })); } catch (e) {}
  }
  function clearStoredReg() {
    try { localStorage.removeItem('__gs_push_reg'); } catch (e) {}
  }

  function currentUid() {
    try { return window.Store && window.Store.getUser && window.Store.getUser().uid; } catch (e) { return null; }
  }

  async function registerIfPossible() {
    if (!currentToken) return;
    if (registeredToken === currentToken) return;
    if (!window.Store || !window.Store.isLoggedIn || !window.Store.isLoggedIn()) return;
    var uid = currentUid();
    // Only real signed-in users (Google accounts) get push notifications.
    // Anonymous guest sessions use uid prefix 'gs_' and must never register.
    if (!uid || String(uid).indexOf('gs_') === 0) return;
    var stored = getStoredReg();
    if (stored && stored.token === currentToken && stored.uid === uid) {
      registeredToken = currentToken;
      return;
    }
    try {
      await authedApi('/api/notifications/register-token', {
        method: 'POST',
        body: JSON.stringify({ token: currentToken, platform: 'android' }),
      });
      registeredToken = currentToken;
      setStoredReg(currentToken, uid);
      console.log('[pushBridge] token registered', currentToken.slice(0, 16));
    } catch (e) {
      console.error('[pushBridge] register token failed', e);
      try { toast(t('فشل تفعيل الإشعارات: ') + (e && e.message ? e.message : 'unknown'), 'error', 4000); } catch (t) {}
    }
  }

  window.__gsRegisterPushToken = function (token) {
    if (!token || typeof token !== 'string') return;
    currentToken = token;
    registerIfPossible();
  };

  window.__gsUnregisterPushToken = function (token) {
    var tok = token || currentToken;
    if (!tok) return;
    registeredToken = null;
    clearStoredReg();
    try {
      api('/api/notifications/unregister-token', {
        method: 'POST',
        body: JSON.stringify({ token: tok }),
      });
    } catch (e) {}
  };

  // Re-register whenever auth state settles (login) and drop on logout.
  try {
    if (window.GAuth && window.GAuth.onAuthChange) {
      window.GAuth.onAuthChange(function (user) {
        if (user) registerIfPossible();
        else if (currentToken) window.__gsUnregisterPushToken(currentToken);
      });
    }
  } catch (e) {}
})();

window.Store = {
  STORE, api, el, ico, t,
  formatBytes, formatCount, formatNum, formatDate, ratingOf, ratingValue, ratingCountOf, getQuery, toast,
  publicOrigin,
  posterCard, listRow, gridCard, featureCarousel, categoryName,
  spinner, skeletonHome, skeletonDetail, skeletonList, skeletonSimilar, emptyState, errorState,
  topbarSearch, topbarNav, bottomNav, avatarEl, themeToggleBtn, langSwitcherEl, toggleTheme, currentTheme,
  fetchNotifications, notifUnreadCount, openNotifications,
  ready, signOut, getUser: () => _user, isLoggedIn, requireAuth, goToLogin,
  apiBaseUrl,
  getDownloadHistory, addToDownloadHistory, clearDownloadHistory,
  getActiveDownloads, setActiveDownload, updateActiveDownloadProgress, removeActiveDownload, onActiveDownloadsChange,
  getApkState, getApkStateMap, setApkState, removeApkState, onApkState, syncNativeStates,
  isInstalledStored, markInstalledStored, unmarkInstalledStored,
  installedVersionOnDevice, versionIsNewer, cancelDownload, isSlugInstalled,
  checkAppStatus, resolvedPackageName, rememberResolvedPackage, registerInstallWatch, applyInstalled,
  checkAppUpdate, showUpdateDialog,
};

document.addEventListener('DOMContentLoaded', boot);
