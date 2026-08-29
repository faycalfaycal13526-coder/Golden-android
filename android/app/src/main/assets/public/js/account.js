// Account ("أنت") page — settings only. Library is accessed via bottom nav.
(function () {
  const S = window.Store;
  const { el, ico, formatBytes, formatDate, toast, t, getQuery } = S;
  const root = document.getElementById('root');

  // Determine which view to show based on URL param
  const tabParam = getQuery('tab');
  const isLibraryView = tabParam === 'library';

  S.bottomNav(isLibraryView ? 'library' : 'account');

  S.ready((user) => {
    // Account and library pages require login
    if (!user) {
      S.goToLogin();
      return;
    }
    root.innerHTML = '';
    root.append(S.topbarSearch(user));

    const content = el('div', { class: 'acct-page' });
    root.append(content);

    if (isLibraryView) {
      renderLibraryPage(content);
    } else {
      renderSettingsPage(content, user);
    }
  });

  // --- Library page (standalone, accessed from bottom nav) ---
  function renderLibraryPage(content) {
    content.append(el('div', { class: 'page-title', style: { padding: '16px' } }, t('مكتبتي')));
    const body = el('div', { class: 'acct-body' });
    content.append(body);

    // --- Live downloads: in-flight downloads + ready-to-install packages ---
    // Progress/status update in real time (Google Play style) via the central
    // state hub; entries survive app restarts through the native bridge.
    mountLiveDownloads(body);

    const history = S.getDownloadHistory();

    if (!history.length) {
      body.append(
        el('div', { class: 'empty-lib' },
          el('div', { class: 'empty-lib-icon' }, ico('download', 'icon')),
          el('h3', null, t('مكتبتك فارغة')),
          el('p', null, t('ستظهر هنا التطبيقات التي قمت بتحميلها لتسهيل إعادة تحميلها في أي وقت.')),
          el('a', { class: 'btn btn-primary', href: '/' }, t('تصفح التطبيقات')),
        ),
      );
      return;
    }

    const header = el('div', { class: 'lib-header' },
      el('div', { class: 'lib-header-info' },
        ico('package', 'icon lib-header-ico'),
        el('span', { class: 'lib-count' }, `${history.length} ${t('تطبيق في مكتبتك')}`),
      ),
      el('button', { class: 'btn btn-sm btn-secondary', type: 'button', onclick: () => {
        if (!confirm(t('حذف سجل التحميلات بالكامل؟'))) return;
        S.clearDownloadHistory();
        content.innerHTML = '';
        renderLibraryPage(content);
        toast(t('تم مسح السجل'), 'success');
      } }, ico('trash', 'icon icon-sm'), t('مسح السجل')),
    );
    body.append(header);

    const list = el('div', { class: 'lib-list' });
    history.forEach((item) => {
      // Real device check: mark items actually installed on this device.
      const deviceVer = S.installedVersionOnDevice(item.package_name || '');
      const row = el('a', { href: `/app?slug=${encodeURIComponent(item.slug)}`, class: 'lib-row' },
        el('div', { class: 'art' },
          item.icon_url
            ? el('img', { src: item.icon_url, alt: item.name, loading: 'lazy' })
            : ico('package', 'icon icon-lg'),
        ),
        el('div', { class: 'lib-info' },
          el('div', { class: 'nm' }, item.name),
          el('div', { class: 'sub' }, item.developer || 'Golden Store'),
          el('div', { class: 'meta' },
            el('span', null, formatBytes(item.size_bytes || 0)),
            el('span', null, '•'),
            el('span', null, formatDate(item.downloaded_at)),
          ),
        ),
        el('div', { class: 'lib-action' },
          deviceVer
            ? el('span', { class: 'lib-installed-badge' }, ico('check', 'icon icon-sm'), t('مثبّت'))
            : el('span', { class: 'lib-open-btn' }, ico('chevronStart', 'icon icon-sm')),
        ),
      );
      list.append(row);
    });
    body.append(list);
  }

  // --- Live downloads section (library) ---
  // Renders downloading / downloaded / installing entries from the central
  // hub, enriched with names/icons from the download history. Re-renders on
  // every state event so progress and status stay live on this page.
  function mountLiveDownloads(body) {
    const section = el('div', { class: 'live-dls' });
    let paintQueued = false;

    function paint() {
      paintQueued = false;
      const map = S.getApkStateMap ? S.getApkStateMap() : {};
      let entries = Object.values(map).filter((st) => st && st.slug);
      section.innerHTML = '';
      if (!entries.length) return;

      const historyById = {};
      S.getDownloadHistory().forEach((h) => { historyById[h.slug] = h; });

      // Self-heal FIRST: an "installing" entry whose package is REALLY
      // installed (its event was lost while navigating between pages) is
      // dropped right away instead of sticking on "جارٍ التثبيت…" forever.
      entries = entries.filter((st) => {
        if (st.status !== 'installing') return true;
        const pkg = st.package_name || (historyById[st.slug] || {}).package_name || '';
        const ver = (pkg && S.installedVersionOnDevice(pkg)) || S.isSlugInstalled(st.slug);
        if (!ver) return true;
        S.removeApkState(st.slug);
        S.removeActiveDownload(st.slug);
        return false;
      });
      if (!entries.length) return;

      section.append(el('div', { class: 'live-dls-title' },
        ico('download', 'icon'),
        el('span', null, t('جارٍ التنزيل الآن')),
        el('span', { class: 'live-count' }, String(entries.length)),
      ));

      entries
        .sort((a, b) => (b.updated_at || 0) - (a.updated_at || 0))
        .forEach((st) => {
          const info = historyById[st.slug] || {};
          const name = info.name || st.name || st.slug;
          const pct = st.status === 'downloading' && typeof st.progress === 'number' && st.progress >= 0
            ? Math.max(0, Math.min(100, Math.round(st.progress * 100))) : null;

          const statusText = st.status === 'downloading'
            ? (pct === null ? t('جارٍ التنزيل…') : `${t('جارٍ التنزيل…')} ${pct}%`)
            : st.status === 'downloaded' ? t('تم التنزيل — جاهز للتثبيت')
            : st.status === 'installing' ? t('جارٍ التثبيت…')
            : t('قيد المعالجة…');

          const barFill = el('span');
          if (st.status === 'downloading') {
            if (pct !== null) barFill.style.width = pct + '%';
            else barFill.style.width = '100%';
          } else if (st.status === 'installing') {
            barFill.style.width = '100%';
          } else {
            barFill.style.width = '100%';
          }
          if (st.status !== 'downloading' || pct === null) barFill.classList.add('indeterminate');

          const meta = el('div', { class: 'meta' },
            el('span', null, statusText),
            el('span', null, info.size_bytes ? formatBytes(info.size_bytes) : ''),
          );

          const infoCol = el('div', { class: 'info' },
            el('div', { class: 'nm' }, name),
            el('div', { class: 'bar' }, barFill),
            meta,
          );

          const row = el('div', { class: `live-dl live-dl-${st.status}` },
            el('div', { class: 'art' },
              info.icon_url
                ? el('img', { src: info.icon_url, alt: '', loading: 'lazy' })
                : ico('package', 'icon icon-lg'),
            ),
            infoCol,
          );

          if (st.status === 'downloading') {
            row.append(el('button', {
              class: 'live-dl-cancel', type: 'button',
              'aria-label': t('إلغاء'), title: t('إلغاء'),
              onclick: (e) => {
                e.preventDefault();
                S.cancelDownload(st.slug);
                toast(t('تم إلغاء التنزيل'), 'info');
                paint();
              },
            }, ico('close', 'icon')));
          } else if (st.status === 'downloaded') {
            row.append(el('button', {
              class: 'live-dl-install', type: 'button',
              onclick: (e) => {
                e.preventDefault();
                if (window.GSAndroid && typeof window.GSAndroid.openDownloadedApk === 'function') {
                  window.GSAndroid.openDownloadedApk(st.filename || '', st.slug, st.package_name || info.package_name || '');
                  toast(t('جارٍ فتح مثبّت النظام…'), 'info');
                } else {
                  location.href = `/app?slug=${encodeURIComponent(st.slug)}`;
                }
              },
            }, ico('download', 'icon'), t('تثبيت')));
          }
          section.append(row);
        });
    }

    function queuePaint() {
      if (paintQueued) return;
      paintQueued = true;
      requestAnimationFrame(paint);
    }

    const offState = S.onApkState ? S.onApkState(() => queuePaint()) : null;
    const offDl = S.onActiveDownloadsChange ? S.onActiveDownloadsChange(() => queuePaint()) : null;
    // Stop listening when navigating away (page unload clears everything).
    window.addEventListener('pagehide', () => {
      if (offState) offState();
      if (offDl) offDl();
    }, { once: true });

    paint();
    // Only mount when there is something live to show (or updates arrive).
    if (section.childNodes.length) body.append(section);
    else {
      const earlyOff = S.onApkState(() => {
        if (section.childNodes.length) return;
        if (!Object.keys(S.getApkStateMap ? S.getApkStateMap() : {}).length) return;
        earlyOff();
        body.prepend(section);
        queuePaint();
      });
    }
  }

  // --- Settings page (profile + settings) ---
  function renderSettingsPage(content, user) {
    // Profile header
    const photo = user && user.photoURL
      ? el('img', { src: user.photoURL, alt: '', referrerpolicy: 'no-referrer' })
      : document.createTextNode((user && (user.displayName || user.email) || '?').trim().charAt(0).toUpperCase());

    content.append(
      el('div', { class: 'acct-head' },
        el('div', { class: 'avatar avatar-lg' }, photo),
        el('div', { class: 'acct-info' },
          el('div', { class: 'nm' }, (user && user.displayName) || t('مستخدم') + ' Golden Store'),
          el('div', { class: 'em' }, (user && user.email) || ''),
        ),
      ),
    );

    // Settings title
    // Settings title
    content.append(el('div', { class: 'page-title', style: { padding: '16px 16px 0' } }, t('الإعدادات')));

    const settingsBody = el('div', { class: 'acct-body' });
    content.append(settingsBody);

    function renderSettings() {
      settingsBody.innerHTML = '';
      settingsBody.append(
        el('div', { class: 'acct-list' },
          settingItem('moon', t('المظهر'), S.currentTheme() === 'light' ? t('فاتح') : t('غامق'), () => {
            S.toggleTheme();
            renderSettings();
          }),
          langSettingItem(),
          aboutDropdown(),
        ),
        contactCard(),
        el('div', { style: { padding: '24px 0' } },
          el('button', { class: 'btn btn-outline btn-block', onclick: () => confirmSignOut() },
            ico('logout', 'icon icon-sm'), t('تسجيل الخروج')),
        ),
      );
    }

    renderSettings();
  }

  function langSettingItem() {
    const langs = [
      { code: 'ar', label: 'العربية' },
      { code: 'en', label: 'English' },
      { code: 'fr', label: 'Français' },
      { code: 'es', label: 'Español' },
    ];
    const currentLang = (window.GSI18N && window.GSI18N.lang) || 'ar';
    const current = langs.find((l) => l.code === currentLang) || langs[0];

    const dropdown = el('div', { class: 'lang-dropdown', 'data-noi18n': '' });

    const trigger = el('button', { type: 'button', class: 'lang-trigger' },
      ico('globe', 'icon'),
      el('span', { class: 'label' }, t('اللغة')),
      el('span', { class: 'lang-current' }, current.label),
      ico('chevronDown', 'icon chevron'),
    );

    const menu = el('div', { class: 'lang-menu-pop' });
    langs.forEach((l) => {
      const item = el('button', {
        type: 'button',
        class: `lang-option ${l.code === currentLang ? 'active' : ''}`,
        onclick: () => {
          if (l.code === currentLang) { dropdown.classList.remove('open'); return; }
          if (window.GSI18N && window.GSI18N.setLang) window.GSI18N.setLang(l.code);
        },
      },
        el('span', { class: 'lang-name' }, l.label),
        l.code === currentLang ? ico('check', 'icon check') : el('span'),
      );
      menu.append(item);
    });

    trigger.onclick = (e) => { e.stopPropagation(); dropdown.classList.toggle('open'); };
    document.addEventListener('click', (e) => { if (!dropdown.contains(e.target)) dropdown.classList.remove('open'); });

    dropdown.append(trigger, menu);
    return dropdown;
  }

  function confirmSignOut() {
    const overlay = el('div', { class: 'dialog-overlay', onclick: (e) => { if (e.target === overlay) close(); } });
    function close() { overlay.remove(); document.removeEventListener('keydown', esc); }
    function esc(e) { if (e.key === 'Escape') close(); }
    const card = el('div', { class: 'dialog-card', dir: document.documentElement.dir || 'rtl' },
      el('div', { class: 'dialog-head' },
        el('div', { class: 'dialog-title' }, ico('logout', 'icon'), t('تسجيل الخروج')),
        el('button', { class: 'dialog-close', 'aria-label': t('إغلاق'), onclick: () => close() }, ico('close')),
      ),
      el('div', { class: 'dialog-body' },
        el('p', { class: 'store-card-text' }, t('هل تريد بالتأكيد تسجيل الخروج من حسابك؟ ستحتاج لتسجيل الدخول مجدداً للوصول إلى المتجر.')),
      ),
      el('div', { class: 'dialog-actions' },
        el('button', { class: 'btn btn-secondary', onclick: () => close() }, t('إلغاء')),
        el('button', { class: 'btn btn-danger', onclick: () => { close(); S.signOut(); } },
          ico('logout', 'icon icon-sm'), t('تسجيل الخروج')),
      ),
    );
    overlay.append(card);
    document.addEventListener('keydown', esc);
    document.body.append(overlay);
  }

  function aboutDropdown() {
    const wrap = el('div', { class: 'about-collapse' });
    const trigger = el('button', { type: 'button', class: 'acct-setting about-trigger' },
      ico('info', 'icon'),
      el('span', { class: 'label' }, t('عن Golden Store')),
      el('span', { class: 'value' }, t('الإصدار') + ' 2.0'),
      ico('chevronDown', 'icon icon-sm chevron'),
    );
    const body = el('div', { class: 'about-body' },
      el('p', { class: 'store-card-text' },
        t('Golden Store هو متجرك العربي لتحميل أحدث التطبيقات والألعاب المهكرة (Mod) والمدفوعة مجاناً بأحدث إصداراتها، مع ميزات مفتوحة بالكامل وبدون إعلانات. نختار المحتوى بعناية ونحدّثه باستمرار، ونوفّر تحميلاً مباشراً سريعاً وآمناً.')),
    );
    trigger.onclick = () => wrap.classList.toggle('open');
    wrap.append(trigger, body);
    return wrap;
  }

  function contactCard() {
    const links = [
      { icon: 'facebook',  label: 'Facebook',  href: 'https://www.facebook.com/F.Pony.Z', fill: true },
      { icon: 'instagram', label: 'Instagram', href: 'https://www.instagram.com/faycalzaouani', fill: false },
      { icon: 'telegram',  label: 'Telegram',  href: 'https://t.me/goldenstore_10', fill: true },
    ];
    const list = el('div', { class: 'acct-list contact-list' });
    links.forEach((l) => {
      list.append(el('a', { class: 'acct-setting contact-row', href: l.href, target: '_blank', rel: 'noopener noreferrer' },
        ico(l.icon, `icon ${l.fill ? 'fill ' : ''}brand-${l.icon}`),
        el('span', { class: 'label' }, l.label),
        ico('external', 'icon icon-sm'),
      ));
    });
    return el('div', null,
      el('div', { class: 'page-title', style: { padding: '8px 16px 0', fontSize: '15px' } }, t('تواصل معنا')),
      list,
    );
  }

  function settingItem(icon, label, value, onClick) {
    const attrs = { class: 'acct-setting' };
    if (onClick) attrs.onclick = onClick;
    return el('div', attrs,
      ico(icon, 'icon'),
      el('span', { class: 'label' }, label),
      el('span', { class: 'value' }, value || ''),
      onClick ? ico('chevronStart', 'icon icon-sm') : null,
    );
  }

  function langLabel() {
    const lang = (window.GSI18N && window.GSI18N.lang) || 'ar';
    const map = { ar: 'العربية', en: 'English', fr: 'Français', es: 'Español' };
    return map[lang] || lang;
  }
})();
