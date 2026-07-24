// Common helpers exposed via window.GS

const STORE = { name: 'Goldenstore', domain: 'goldenstore.me' };

/* ----------------------------- Theme (light/dark) ----------------------------- */
const THEME_KEY = 'gs_theme';
function currentTheme() {
  try { return localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark'; } catch { return 'dark'; }
}
function applyTheme(theme) {
  const t = theme === 'light' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', t);
  try { localStorage.setItem(THEME_KEY, t); } catch {}
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', t === 'light' ? '#ffffff' : '#000000');
  document.querySelectorAll('.theme-toggle').forEach((b) => syncThemeBtn(b, t));
}
function toggleTheme() { applyTheme(currentTheme() === 'light' ? 'dark' : 'light'); }
function syncThemeBtn(btn, t) {
  btn.innerHTML = '';
  btn.append(ico(t === 'light' ? 'moon' : 'sun'));
  btn.setAttribute('aria-label', t === 'light' ? 'الوضع الغامق' : 'الوضع الفاتح');
  btn.setAttribute('title', t === 'light' ? 'الوضع الغامق' : 'الوضع الفاتح');
}
function themeToggleBtn() {
  const btn = el('button', { class: 'tab theme-toggle', type: 'button', onclick: toggleTheme });
  syncThemeBtn(btn, currentTheme());
  return btn;
}
applyTheme(currentTheme());

async function api(path, opts = {}) {
  const ctrl = new AbortController();
  const timeoutMs = typeof opts.timeoutMs === 'number' ? opts.timeoutMs : 15000;
  const timer = timeoutMs > 0 ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
  let res;
  try {
    res = await fetch(path, {
      credentials: 'include',
      headers: opts.body && !(opts.body instanceof FormData) && typeof opts.body !== 'string'
        ? { 'Content-Type': 'application/json' }
        : opts.headers || {},
      ...opts,
      signal: opts.signal || ctrl.signal,
      body: opts.body && typeof opts.body !== 'string' && !(opts.body instanceof FormData) && !(opts.body instanceof Blob)
        ? JSON.stringify(opts.body)
        : opts.body,
    });
  } catch (e) {
    if (timer) clearTimeout(timer);
    const err = new Error(e && e.name === 'AbortError' ? 'timeout' : (e && e.message) || 'network_error');
    err.status = 0;
    err.cause = e;
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

function formatBytes(bytes) {
  const lang = (window.GSI18N && window.GSI18N.lang) || 'ar';
  if (!bytes) return `0 ${lang === 'ar' ? 'ب' : 'B'}`;
  const units = {
    ar: ['ب', 'ك.ب', 'م.ب', 'ج.ب'],
    en: ['B', 'KB', 'MB', 'GB'],
    fr: ['o', 'Ko', 'Mo', 'Go'],
    es: ['B', 'KB', 'MB', 'GB'],
  };
  const u = units[lang] || units['ar'];
  let i = 0;
  let v = bytes;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${u[i]}`;
}

function formatNum(n) {
  return Number(n || 0).toLocaleString('en-US');
}

function formatDate(ts) {
  if (!ts) return '—';
  const lang = (window.GSI18N && window.GSI18N.lang) || 'ar';
  const d = new Date(ts * 1000);
  return d.toLocaleDateString(lang, { year: 'numeric', month: 'short', day: 'numeric', numberingSystem: 'latn' });
}

function getQuery(name) {
  return new URLSearchParams(location.search).get(name) || '';
}

function setQuery(params, replace = false) {
  const url = new URL(location.href);
  for (const [k, v] of Object.entries(params)) {
    if (v == null || v === '' || v === false) url.searchParams.delete(k);
    else url.searchParams.set(k, String(v));
  }
  if (replace) history.replaceState(null, '', url.toString());
  else history.pushState(null, '', url.toString());
}

function toast(msg, type = 'info', ms = 3500) {
  let stack = document.querySelector('.toast-stack');
  if (!stack) {
    stack = el('div', { class: 'toast-stack' });
    document.body.append(stack);
  }
  const t = el('div', { class: `toast ${type}` }, msg);
  stack.append(t);
  setTimeout(() => {
    t.style.transition = 'opacity 0.2s, transform 0.2s';
    t.style.opacity = '0';
    t.style.transform = 'translateY(8px)';
    setTimeout(() => t.remove(), 200);
  }, ms);
}

function ico(name, extra = 'icon') {
  return window.GSIcons.iconEl(name, extra);
}

// App card builder
function appCard(a) {
  return el('a', { href: `/app?slug=${encodeURIComponent(a.slug)}`, class: 'app-card' },
    (a.stars > 0) ? el('span', { class: 'star-pin' }, ico('star'), formatNum(a.stars)) : null,
    el('div', { class: 'ico' },
      a.icon_url ? el('img', { src: a.icon_url, alt: a.name, loading: 'lazy' }) : ico('package', 'icon icon-xl')
    ),
    el('div', { class: 'meta' },
      el('div', { class: 'name' }, a.name),
      a.developer ? el('div', { class: 'dev' }, a.developer) : null,
    ),
    el('div', { class: 'stats' },
      el('span', { class: 'size' }, formatBytes(a.size_bytes || 0)),
      el('span', { class: 'dl' }, ico('star'), formatNum(a.stars || 0)),
      el('span', { class: 'dl' }, ico('download'), formatNum(a.downloads || 0)),
    ),
  );
}

function renderHeader(active = '') {
  const h = document.querySelector('.header');
  if (!h) return;
  h.innerHTML = '';
  const inner = el('div', { class: 'container header-inner' },
    el('a', { href: '/', class: 'brand', dir: 'ltr' },
      el('img', { src: '/images/logo.png', alt: 'Goldenstore' }),
      el('span', { class: 'brand-text' },
        el('span', null, 'Golden'),
        el('b', null, 'store'),
      ),
    ),
    el('nav', { class: 'nav' },
      el('a', { href: '/', class: active === 'home' ? 'active' : '' }, 'الرئيسية'),
      el('a', { href: '/browse', class: active === 'browse' ? 'active' : '' }, 'تصفّح'),
      el('a', { href: '/categories', class: active === 'categories' ? 'active' : '' }, 'التصنيفات'),
    ),
    (() => {
      const f = el('form', { class: 'search-form', onsubmit: (e) => {
        e.preventDefault();
        const q = f.querySelector('input').value.trim();
        location.href = `/browse?q=${encodeURIComponent(q)}`;
      } });
      f.append(
        el('input', { class: 'search-input', type: 'search', name: 'q', placeholder: 'ابحث عن تطبيق مهكر…', value: getQuery('q') }),
        el('button', { type: 'submit', class: 'search-btn', 'aria-label': 'بحث' }, ico('search')),
      );
      return f;
    })(),
  );
  h.append(inner);
}

function renderFooter() {
  const f = document.querySelector('.footer');
  if (!f) return;
  f.innerHTML = '';
  const inner = el('div', { class: 'container footer-inner' },
    el('div', { class: 'brand-mark' },
      el('img', { src: '/images/logo.png', alt: '' }),
      el('span', null, '© '),
      el('b', { dir: 'ltr' }, STORE.domain),
      el('span', null, ' — المتجر الذهبي للتطبيقات المهكرة'),
    ),
    el('div', { class: 'footer-links' },
      el('span', null, 'جميع الحقوق محفوظة'),
    ),
  );
  f.append(inner);
}

async function loadStoreInfo() {
  try {
    const data = await api('/api/store');
    if (data.name) STORE.name = data.name;
    if (data.domain) STORE.domain = data.domain;
  } catch {}
}

function init() {
  const active = document.body.dataset.page || '';
  renderHeader(active);
  renderFooter();
  loadStoreInfo().then(() => renderFooter());
}

window.GS = {
  api, el, ico, appCard, toast,
  formatBytes, formatNum, formatDate,
  getQuery, setQuery,
  init, STORE,
  themeToggleBtn, toggleTheme, currentTheme,
};

document.addEventListener('DOMContentLoaded', init);
