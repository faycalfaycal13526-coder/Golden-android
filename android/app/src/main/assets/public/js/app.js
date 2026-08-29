// App detail page — Google Play–style.
(function () {
  const S = window.Store;
  const { el, ico, api, getQuery, formatBytes, formatNum, formatCount, formatDate, ratingOf, toast, t } = S;
  const root = document.getElementById('root');
  S.bottomNav('');

  const slug = getQuery('slug');

  // True when running inside the Golden Store native Android wrapper, where the
  // GSAndroid JS bridge is available for real device downloads.
  function isNativeApp() {
    return !!(window.GSAndroid && typeof window.GSAndroid.downloadApk === 'function');
  }

  const apkStateHandlers = Object.create(null);
  // IMPORTANT: the central hub (store.js) must ALWAYS run — it maintains the
  // global registry (gs_apk_states / gs_active_dl) used by the library, home
  // badges and future page loads. Previously this wrapper swallowed every
  // non-"app-update" event, so states were never cleaned up while this page
  // was open and the install button appeared "stuck" on other screens.
  const storeApkHandler = window.__gsApkDownloadUpdate;
  window.__gsApkDownloadUpdate = function (slug, status, progress, message) {
    if (typeof storeApkHandler === 'function') storeApkHandler(slug, status, progress, message);
    const h = apkStateHandlers[slug];
    if (h) h(status, (typeof progress === 'number' ? progress : -1), message);
  };

  function sdkName(sdk) {
    const map = { 21: '5.0', 22: '5.1', 23: '6.0', 24: '7.0', 25: '7.1', 26: '8.0', 27: '8.1', 28: '9', 29: '10', 30: '11', 31: '12', 32: '12L', 33: '13', 34: '14', 35: '15' };
    return map[sdk] || (sdk ? `SDK ${sdk}` : '—');
  }

  function openModal(src) {
    const m = el('div', { class: 'modal', onclick: (e) => { if (e.target === m) m.remove(); } },
      el('button', { class: 'close', 'aria-label': t('إغلاق'), onclick: () => m.remove() }, ico('close')),
      el('img', { src }),
    );
    document.body.append(m);
    document.addEventListener('keydown', function esc(e) { if (e.key === 'Escape') { m.remove(); document.removeEventListener('keydown', esc); } });
  }

  // Browser fingerprint for the star-vote endpoint.
  async function getFingerprint() {
    const parts = [];
    try {
      const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64;
      const ctx = cv.getContext('2d'); ctx.textBaseline = 'top'; ctx.font = '14px Arial';
      ctx.fillStyle = '#f60'; ctx.fillRect(50, 0, 100, 30);
      ctx.fillStyle = '#069'; ctx.fillText('GoldenStore\uD83D\uDE00fp', 2, 4);
      parts.push(cv.toDataURL());
    } catch { parts.push('no-canvas'); }
    parts.push(`${screen.width}x${screen.height}x${screen.colorDepth}`);
    parts.push(String(navigator.hardwareConcurrency || 0));
    parts.push(Intl.DateTimeFormat().resolvedOptions().timeZone || '');
    parts.push(navigator.language || '');
    parts.push(navigator.platform || '');
    const raw = parts.join('|||');
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
    return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  S.ready(async () => {
    root.innerHTML = '';

    const menuBtn = el('button', { class: 'icon-btn', 'aria-label': t('مشاركة'), onclick: () => share(app) }, ico('share'));
    const nav = S.topbarNav('', [menuBtn]);
    root.append(nav);
    const content = el('div', { class: 'detail' });
    root.append(content);
    content.append(S.skeletonDetail());

    function share(a) {
      // Share/copy the PUBLIC web link of the app on the store site — never a
      // local WebView URL like capacitor://localhost (meaningless outside the app).
      const origin = (window.Store && window.Store.publicOrigin) ? window.Store.publicOrigin() : null;
      const url = origin
        ? `${origin}/app?slug=${encodeURIComponent(a && a.slug ? a.slug : slug)}`
        : location.href;
      if (navigator.share) navigator.share({ title: (a && a.name) || 'Golden Store', url }).catch(() => {});
      else { navigator.clipboard && navigator.clipboard.writeText(url); toast(t('تم نسخ الرابط'), 'success'); }
    }

    if (!slug) { content.innerHTML = ''; content.append(S.emptyState(t('لا يوجد تطبيق محدد'), t('الرابط غير صحيح.'), 'info')); return; }

    let app, screenshots;
    try {
      const data = await api(`/api/apps/${encodeURIComponent(slug)}`);
      app = data.app; screenshots = data.screenshots || [];
    } catch (e) {
      content.innerHTML = '';
      const errTitle = (e && (e.status === 0 || e.message === 'timeout')) ? t('تعذّر الاتصال بالخادم') : t('التطبيق غير موجود');
      content.append(S.emptyState(errTitle, t('تأكد من الرابط أو عُد للرئيسية.'), 'info'),
        el('div', { style: { textAlign: 'center', marginTop: '16px' } }, el('a', { class: 'btn btn-primary', href: '/' }, t('العودة للرئيسية'))));
      return;
    }

    document.title = `${app.name} — Golden Store`;
    nav.querySelector('.title') && (nav.querySelector('.title').textContent = '');
    content.innerHTML = '';

    // Head
    content.append(el('div', { class: 'd-head' },
      el('div', { class: 'd-icon' }, app.icon_url ? el('img', { src: app.icon_url, alt: app.name }) : ico('package', 'icon icon-lg')),
      el('div', { class: 'd-titles' },
        el('div', { class: 'd-name' }, app.name),
        el('div', { class: 'd-dev' }, app.developer || S.STORE.name),
        el('div', { class: 'd-sub' }, S.categoryName(app.category) || S.STORE.name),
      ),
    ));

    // Stats row
    const rt = ratingOf(app);
    content.append(el('div', { class: 'd-stats' },
      stat(rt ? el('span', null, rt, ico('star', 'icon fill')) : el('span', null, '—'), t('تقييمات')),
      stat(formatCount(app.downloads), t('تنزيلات')),
      stat(formatBytes(app.size_bytes || 0), t('الحجم')),
      stat(sdkName(app.min_sdk), t('أندرويد')),
    ));

    // Actions — animated install with a smooth progress bar.
    content.append(installControl(app));
    content.append(el('div', { class: 'd-note' }, t('سيتم تنزيل ملف APK') + ` (${formatBytes(app.size_bytes || 0)}). ` + t('فعّل «تثبيت من مصادر غير معروفة» لإكمال التثبيت.')));

    // Screenshots
    if (screenshots.length) {
      const shots = el('div', { class: 'shots' });
      screenshots.forEach((s) => { if (s.url) shots.append(el('img', { src: s.url, alt: '', loading: 'lazy', onclick: () => openModal(s.url) })); });
      content.append(el('div', { class: 'd-section' }, shots));
    }

    // About
    if (app.short_description || app.description) {
      content.append(el('div', { class: 'd-section' },
        el('h3', null, t('لمحة عن هذا التطبيق')),
        el('div', { class: 'd-desc' }, app.description || app.short_description),
      ));
    }

    // Tags
    content.append(el('div', { class: 'chip-row' },
      app.category ? el('span', { class: 'chip' }, S.categoryName(app.category)) : null,
      el('span', { class: 'chip' }, t('الإصدار') + ' ' + (app.version_name || '—')),
    ));

    // Rating section (star vote)
    content.append(ratingSection(app));

    // Similar apps/games
    loadSimilar(app, content);

    function stat(value, label) {
      const v = el('div', { class: 'v' });
      if (value && value.nodeType) v.append(value); else v.textContent = value;
      return el('div', { class: 'd-stat' }, v, el('div', { class: 'l' }, label));
    }
  });

  async function loadSimilar(app, container) {
    const simTitle = app.type === 'game' ? t('ألعاب مماثلة') : t('تطبيقات مماثلة');
    // Skeleton placeholder while the similar list loads (smooth content loading).
    const section = el('div', { class: 'd-section' },
      el('h3', null, simTitle),
      S.skeletonSimilar(),
    );
    container.append(section);
    try {
      const catParam = app.category ? `&category=${encodeURIComponent(app.category)}` : '';
      const typeParam = app.type ? `&type=${encodeURIComponent(app.type)}` : '';
      const res = await api(`/api/apps?limit=20${catParam}${typeParam}&sort=popular`);
      const similar = (res.apps || []).filter((a) => a.slug !== app.slug).slice(0, 10);
      if (!similar.length) { section.remove(); return; }
      const row = el('div', { class: 'hrow' });
      similar.forEach((a) => row.append(S.posterCard(a)));
      section.innerHTML = '';
      section.append(el('h3', null, simTitle), row);
    } catch (e) {
      section.remove();
    }
  }

  // Static 5-star bar reflecting an average value (filled vs empty).
  function starBar(value) {
    const wrap = el('div', { class: 'rate-static', style: { marginTop: '4px' } });
    const rounded = Math.round(Number(value) || 0);
    for (let i = 1; i <= 5; i++) wrap.append(el('span', { class: `star ${i <= rounded ? 'on' : ''}` }, i <= rounded ? '★' : '☆'));
    return wrap;
  }

  // One row of the rating distribution bar chart (Google Play style).
  function distRow(starN, c, total) {
    const pct = total > 0 ? Math.round((c / total) * 100) : 0;
    return el('div', { class: 'row' },
      el('span', { class: 'lbl' }, String(starN)),
      el('div', { class: 'bar' }, el('span', { style: { width: pct + '%' } })),
    );
  }

  // A single review card: avatar + name + date, star row, then the comment.
  function reviewCard(r) {
    const initial = ((r.name || 'م').trim().charAt(0) || 'م').toUpperCase();
    const stars = el('div', { class: 'stars' });
    const rt = Math.round(Number(r.rating) || 0);
    for (let i = 1; i <= 5; i++) stars.append(el('span', { class: `star ${i <= rt ? 'on' : ''}` }, i <= rt ? '★' : '☆'));
    const avatar = el('div', { class: 'avatar' });
    if (r.photo_url) avatar.append(el('img', { src: r.photo_url, alt: '', referrerpolicy: 'no-referrer' }));
    else avatar.textContent = initial;
    return el('div', { class: 'review' },
      el('div', { class: 'head' },
        avatar,
        el('div', { class: 'who' },
          el('div', { class: 'nm' }, r.name || t('مستخدم')),
          el('div', { class: 'dt' }, formatDate(r.ts)),
        ),
      ),
      stars,
      r.comment ? el('div', { class: 'body' }, r.comment) : null,
    );
  }

  // ----- Install: persist "installed" apps locally so the state survives reloads.
  // (Registry helpers live in store.js now; the REAL source of truth is the
  // device PackageManager via S.installedVersionOnDevice.)
  const isInstalled = (slug) => S.isInstalledStored(slug);
  const markInstalledStored = (slug) => S.markInstalledStored(slug);
  const unmarkInstalledStored = (slug) => S.unmarkInstalledStored(slug);
  // Generic centered dialog (used by "request update" and "report").
  function openDialog({ icon, title, fields, submitLabel, onSubmit }) {
    const overlay = el('div', { class: 'dialog-overlay', onclick: (e) => { if (e.target === overlay) close(); } });
    const inputs = {};
    const body = el('div', { class: 'dialog-body' });
    fields.forEach((f) => {
      const lbl = el('label', { class: 'dialog-field' },
        el('span', { class: 'dialog-label' }, f.label, f.required ? el('b', { class: 'req' }, ' *') : null));
      let input;
      if (f.type === 'textarea') input = el('textarea', { class: 'field', rows: '3', placeholder: f.placeholder || '', maxlength: f.maxlength || '2000' });
      else if (f.type === 'select') {
        input = el('select', { class: 'field' });
        (f.options || []).forEach((o) => input.append(el('option', { value: o }, o)));
      } else input = el('input', { class: 'field', type: 'text', placeholder: f.placeholder || '', maxlength: f.maxlength || '200', value: f.value || '', disabled: f.readonly ? true : false });
      inputs[f.key] = input;
      lbl.append(input);
      body.append(lbl);
    });

    const submitBtn = el('button', { class: 'btn btn-primary' }, ico(icon, 'icon'), submitLabel);
    const errLine = el('div', { class: 'dialog-err' });
    submitBtn.addEventListener('click', async () => {
      const values = {};
      for (const f of fields) values[f.key] = (inputs[f.key].value || '').trim();
      for (const f of fields) {
        if (f.required && !values[f.key]) { errLine.textContent = t('يرجى ملء الحقول المطلوبة'); inputs[f.key].focus(); return; }
      }
      submitBtn.disabled = true; errLine.textContent = '';
      try { await onSubmit(values); close(); toast(t('تم إرسال طلبك إلى الإدارة'), 'success'); }
      catch (e) { submitBtn.disabled = false; errLine.textContent = t('تعذّر الإرسال، حاول مجدداً'); }
    });

    const card = el('div', { class: 'dialog-card', dir: document.documentElement.dir || 'rtl' },
      el('div', { class: 'dialog-head' },
        el('div', { class: 'dialog-title' }, ico(icon, 'icon'), title),
        el('button', { class: 'dialog-close', 'aria-label': t('إغلاق'), onclick: () => close() }, ico('close')),
      ),
      body,
      errLine,
      el('div', { class: 'dialog-actions' },
        el('button', { class: 'btn btn-secondary', onclick: () => close() }, t('إلغاء')),
        submitBtn,
      ),
    );
    overlay.append(card);
    function close() { overlay.remove(); document.removeEventListener('keydown', esc); }
    function esc(e) { if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', esc);
    document.body.append(overlay);
  }

  function openRequestUpdate(app) {
    openDialog({
      icon: 'refresh', title: t('طلب تحديث'), submitLabel: t('إرسال الطلب'),
      fields: [
        { key: 'current', label: t('الإصدار الحالي'), value: app.version_name || '—', readonly: true },
        { key: 'new_version', label: t('الإصدار الجديد'), required: true, placeholder: t('مثال: 2.5.1'), maxlength: '60' },
        { key: 'source', label: t('رابط المصدر'), placeholder: t('مثال: https://play.google.com/...'), maxlength: '500' },
      ],
      onSubmit: (v) => api(`/api/apps/${encodeURIComponent(app.slug)}/request-update`, {
        method: 'POST', body: { new_version: v.new_version, source: v.source },
      }),
    });
  }

  function openReport(app) {
    openDialog({
      icon: 'flag', title: t('إبلاغ عن التطبيق'), submitLabel: t('إرسال البلاغ'),
      fields: [
        { key: 'reason', label: t('سبب البلاغ'), required: true, type: 'select',
          options: [t('التطبيق فيه فيروس'), t('رابط التحميل لا يعمل'), t('محتوى غير لائق'), t('انتهاك حقوق نشر'), t('معلومات خاطئة'), t('سبب آخر')] },
        { key: 'details', label: t('تفاصيل إضافية'), type: 'textarea', placeholder: t('اشرح المشكلة…'), maxlength: '2000' },
      ],
      onSubmit: (v) => api(`/api/apps/${encodeURIComponent(app.slug)}/report`, {
        method: 'POST', body: { reason: v.reason, details: v.details },
      }),
    });
  }

  // Save a downloaded blob to the user's device.
  function saveBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = el('a', { href: url, download: filename, style: { display: 'none' } });
    document.body.append(a);
    a.click();
    setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 30000);
  }

  // Fallback: plain navigation download (browser's own download UI) when the
  // streaming fetch isn't possible.
  function fallbackDownload(slug) {
    const a = el('a', { href: `/api/apps/${encodeURIComponent(slug)}/download`, download: '', style: { display: 'none' } });
    document.body.append(a);
    a.click();
    setTimeout(() => a.remove(), 30000);
  }

  // The install button + REAL download progress bar. Streams the APK while
  // reporting genuine progress, saves the file to the device, then settles into
  // an "installed" state ("التطبيق لديك").
  function installControl(app) {
    const label = el('span', { class: 'install-label', 'data-noi18n': '' }, t('تثبيت'));
    const fill = el('span', { class: 'install-fill' });
    const btn = el('button', { class: 'btn btn-primary btn-lg install-btn', type: 'button' }, fill, label);
    let nativeActiveDownloadRegistered = false;

    function setProgress(ratio) {
      const pct = Math.max(0, Math.min(100, Math.round(ratio * 100)));
      btn.classList.remove('indeterminate');
      fill.style.transition = 'width .15s linear';
      fill.style.width = pct + '%';
      label.textContent = `${t('جارٍ التنزيل…')} ${pct}%`;
    }
    function setIndeterminate() {
      btn.classList.add('indeterminate');
      label.textContent = t('جارٍ التنزيل…');
    }
    function resetBar() {
      btn.classList.remove('installing', 'indeterminate');
      fill.style.transition = 'none';
      fill.style.width = '0%';
    }
    function showInstalled(mode) {
      resetBar();
      btn.disabled = false;
      label.innerHTML = '';
      if (mode === 'update') {
        // A newer store version is available: Google Play style "تحديث" button.
        btn.classList.remove('installed');
        btn.classList.add('has-update');
        label.append(ico('refresh', 'icon'), document.createTextNode(t('تحديث')));
      } else {
        btn.classList.add('installed');
        label.append(ico('check', 'icon'), document.createTextNode(t('تم التثبيت')));
      }
    }

    // ---- Post-install actions: Open + Uninstall (native app only) ----
    function openInstalled(a) {
      if (isNativeApp() && window.GSAndroid && typeof window.GSAndroid.openInstalledApp === 'function') {
        try { window.GSAndroid.openInstalledApp(a.package_name || '', a.slug || ''); return; } catch (e) {}
      }
      toast(t('تعذّر فتح التطبيق'), 'error');
    }
    function uninstallInstalled(a) {
      if (isNativeApp() && window.GSAndroid && typeof window.GSAndroid.uninstallApp === 'function') {
        try { window.GSAndroid.uninstallApp(a.package_name || ''); return; } catch (e) {}
      }
      toast(t('غير متاح في هذا المتصفح'), 'info');
    }
    // Open the system installer for a previously-downloaded APK file
    // (lets the user retry installation if they dismissed the prompt).
    function openDownloadedApk(a, filename) {
      if (isNativeApp() && window.GSAndroid && typeof window.GSAndroid.openDownloadedApk === 'function') {
        try {
          window.GSAndroid.openDownloadedApk(filename || '', a.slug || '', a.package_name || '');
          toast(t('جارٍ فتح مثبّت النظام…'), 'info');
        } catch (e) { toast(t('تعذّر فتح الملف'), 'error'); }
        return;
      }
      toast(t('غير متاح في هذا المتصفح'), 'info');
    }
    function deleteDownloadedApk(a, filename) {
      if (isNativeApp() && window.GSAndroid && typeof window.GSAndroid.deleteDownloadedApk === 'function') {
        try { window.GSAndroid.deleteDownloadedApk(filename || '', a.slug || ''); } catch (e) {}
      }
    }
    /**
     * Post-install actions. Default (fully installed): the Open + Uninstall
     * pair REPLACES the install button entirely — Google Play end state.
     * With a newer store version available (opts.withOpen=false): keep the
     * "تحديث" button visible and show only the Uninstall action below it.
     */
    function showInstalledActions(a, opts = {}) {
      if (!isNativeApp()) return;
      const withOpen = opts.withOpen !== false;
      removeInstalledActions();
      const bar = el('div', { class: 'installed-actions', id: 'gs-installed-actions' });
      if (withOpen) {
        bar.append(
          el('button', { class: 'btn btn-primary btn-lg', type: 'button', onclick: () => openInstalled(a) },
            ico('play', 'icon'), t('فتح')),
          el('button', { class: 'btn btn-secondary btn-lg', type: 'button', onclick: () => uninstallInstalled(a) },
            ico('trash', 'icon'), t('إلغاء التثبيت')),
        );
      } else {
        bar.append(
          el('button', { class: 'btn btn-secondary btn-lg', type: 'button', onclick: () => uninstallInstalled(a) },
            ico('trash', 'icon'), t('إلغاء التثبيت')),
        );
      }
      const anchor = document.querySelector('.detail .d-actions');
      if (anchor && anchor.parentNode) {
        if (withOpen) anchor.style.display = 'none'; // no duplicate "تم التثبيت" button
        anchor.parentNode.insertBefore(bar, anchor.nextSibling);
      } else {
        const det = document.querySelector('.detail');
        if (det) det.prepend(bar);
      }
    }
    // Show "open APK / delete file" actions after a download completes but
    // before the package is actually installed (e.g. user dismissed the
    // installer or installation is still pending).
    function showDownloadedActions(a, filename) {
      if (!isNativeApp()) return;
      removeInstalledActions();
      const bar = el('div', { class: 'installed-actions', id: 'gs-installed-actions' },
        el('button', { class: 'btn btn-primary btn-lg', type: 'button', onclick: () => openDownloadedApk(a, filename) },
          ico('download', 'icon'), t('تثبيت')),
        el('button', { class: 'btn btn-secondary btn-lg', type: 'button', onclick: () => { deleteDownloadedApk(a, filename); removeInstalledActions(); showIdle(true); toast(t('تم حذف ملف التحميل'), 'info'); } },
          ico('trash', 'icon'), t('حذف الملف')),
      );
      const anchor = document.querySelector('.detail .d-actions');
      if (anchor) {
        anchor.style.display = 'none';
        anchor.parentNode.insertBefore(bar, anchor);
      } else {
        document.querySelector('.detail').prepend(bar);
      }
    }
    function removeInstalledActions() {
      const existing = document.getElementById('gs-installed-actions');
      if (existing) existing.remove();
      // Restore the install button row (hidden while Open/Uninstall shown).
      const anchor = document.querySelector('.detail .d-actions');
      if (anchor) anchor.style.display = '';
    }
    function showIdle(skipAnchorRestore) {
      resetBar();
      btn.classList.remove('installed');
      btn.disabled = false;
      label.textContent = t('تثبيت');
    }

    apkStateHandlers[app.slug] = function (status, progress, message) {
      const errMap = {
        signature_mismatch: t('تعارض توقيع الحزمة: ألغِ التطبيق المثبت ثم ثبّت النسخة الجديدة.'),
        package_mismatch: t('اسم الحزمة غير متطابق مع التطبيق.'),
        apk_parse_failed: t('تعذّر قراءة ملف APK.'),
        install_error: t('فشل التثبيت.'),
        file_missing: t('ملف التحميل مفقود.'),
      };
      if (status === 'downloading') {
        btn.classList.add('installing');
        btn.disabled = true;
        if (!nativeActiveDownloadRegistered) {
          S.setActiveDownload({
            slug: app.slug,
            name: app.name,
            icon_url: app.icon_url || null,
            developer: app.developer || '',
            size_bytes: app.size_bytes || 0,
            progress: progress >= 0 ? progress : 0,
            status: 'downloading',
            started_at: Math.floor(Date.now() / 1000),
          });
          nativeActiveDownloadRegistered = true;
        } else {
          S.updateActiveDownloadProgress(app.slug, progress);
        }
        if (progress >= 0) setProgress(progress);
        else setIndeterminate();
        return;
      }
      if (status === 'downloaded') {
        // The APK is on the device. Never leave the button stuck in a
        // disabled "installing…" state: if the system installer prompt was
        // dismissed (or the user cancelled inside it), the button must
        // become an active "جاهز للتثبيت" state with retry/delete actions —
        // exactly like Google Play's "ready to install" row.
        setProgress(1);
        btn.classList.remove('installing');
        btn.disabled = false;
        label.textContent = t('جاهز للتثبيت');
        S.removeActiveDownload(app.slug);
        S.addToDownloadHistory(app);
        // Show the post-download actions bar immediately so the user can
        // retry the install or delete the file. The native bridge reports
        // the real filename.
        showDownloadedActions(app, message || filename);
        return;
      }
      if (status === 'installing') {
        btn.classList.add('installing');
        btn.disabled = true;
        setProgress(1);
        label.textContent = t('جارٍ التثبيت…');
        S.setActiveDownload({ slug: app.slug, status: 'installing', progress: 1 });
        return;
      }
      if (status === 'installed') {
        // Install finished — IMMEDIATELY swap to the Google Play end state:
        // [فتح] + [إلغاء التثبيت] replacing the download button, and clean
        // every pending state (the central hub already did the registry cleanup).
        markInstalledStored(app.slug);
        S.removeActiveDownload(app.slug);
        S.removeApkState(app.slug);
        const devVer = S.installedVersionOnDevice(app.package_name || '');
        const hasUpdate = S.versionIsNewer(app.version_name || '', devVer);
        showInstalled(hasUpdate ? 'update' : 'open');
        showInstalledActions(app, { withOpen: !hasUpdate });
        toast(t('تم تثبيت التطبيق بنجاح'), 'success');
        return;
      }
      if (status === 'cancelled') {
        S.removeActiveDownload(app.slug);
        removeInstalledActions();
        showIdle();
        toast(t('تم إلغاء التنزيل'), 'info');
        return;
      }
      if (status === 'uninstalled') {
        unmarkInstalledStored(app.slug);
        removeInstalledActions();
        showIdle();
        toast(t('تم إلغاء تثبيت التطبيق'), 'info');
        return;
      }
      if (status === 'open_failed') {
        toast(t('التطبيق غير مثبت على هذا الجهاز'), 'error');
        return;
      }
      if (status === 'failed') {
        S.removeActiveDownload(app.slug);
        showIdle();
        toast(errMap[message] || t('تعذّر التنزيل، حاول مجدداً'), 'error');
      }
    };

    // Listen for native uninstall events: when THIS app's package is removed
    // from the device, drop the local installed state and restore the button.
    window.addEventListener('gs-package-uninstalled', (e) => {
      const pkg = e && e.detail && e.detail.packageName;
      if (!pkg || !app.package_name) return;
      if (pkg === app.package_name) {
        unmarkInstalledStored(app.slug);
        removeInstalledActions();
        showIdle();
      }
    });

    const filename = `${app.slug || 'app'}-${app.version_name || ''}.apk`.replace(/-+/g, '-');

    async function runInstall() {
      if (btn.classList.contains('installing')) return;
      // Already installed: tapping the button opens the app directly.
      if (btn.classList.contains('installed')) { openInstalled(app); return; }

      // APK already downloaded but not installed: open the system installer
      // again instead of re-downloading the whole file.
      const liveState = S.getApkState(app.slug);
      if (isNativeApp() && liveState && liveState.status === 'downloaded' && liveState.filename) {
        openDownloadedApk(app, liveState.filename);
        return;
      }

      // Require login before downloading (skip in native wrapper where anonymous
      // downloads are allowed and the redirect sign-in flow interrupts the flow)
      if (!isNativeApp() && !S.isLoggedIn()) {
        try { await S.requireAuth(); } catch { return; }
      }

      // Native Android app: blob/<a download> don't persist files inside a
      // WebView, so hand off to the native DownloadManager bridge which saves
      // the APK to the device's Downloads and shows an "open to install" notice.
      if (isNativeApp()) {
        const apiBase = (window.Capacitor && window.Capacitor.getConfig && window.Capacitor.getConfig().apiBase) || 'https://goldenstore.vercel.app';
        const dlUrl = `${apiBase}/api/apps/${encodeURIComponent(app.slug)}/download`;
        btn.classList.add('installing');
        btn.disabled = true;
        setIndeterminate();
        S.setActiveDownload({
          slug: app.slug,
          name: app.name,
          icon_url: app.icon_url || null,
          developer: app.developer || '',
          size_bytes: app.size_bytes || 0,
          progress: 0,
          status: 'downloading',
          started_at: Math.floor(Date.now() / 1000),
        });
        nativeActiveDownloadRegistered = true;
        try {
          window.GSAndroid.downloadApk(dlUrl, filename, app.slug || '', app.package_name || '', app.name || '', app.icon_url || '');
          toast(t('بدأ التنزيل…'), 'info');
        } catch (e) {
          delete apkStateHandlers[app.slug];
          S.removeActiveDownload(app.slug);
          fallbackDownload(app.slug);
          showIdle();
        }
        return;
      }

      btn.classList.add('installing');
      btn.disabled = true;
      fill.style.transition = 'none';
      fill.style.width = '0%';
      label.textContent = `${t('جارٍ التنزيل…')} 0%`;

      S.setActiveDownload({
        slug: app.slug,
        name: app.name,
        icon_url: app.icon_url || null,
        developer: app.developer || '',
        size_bytes: app.size_bytes || 0,
        progress: 0,
        status: 'downloading',
        started_at: Math.floor(Date.now() / 1000),
      });

      let finished = false;
      let handoffTriggered = false;
      const onHandoff = () => {
        if (finished || handoffTriggered) return;
        handoffTriggered = true;
        try { fallbackDownload(app.slug); } catch {}
      };
      const cleanupHandoffListeners = () => {
        window.removeEventListener('pagehide', onHandoff);
        window.removeEventListener('beforeunload', onHandoff);
      };
      window.addEventListener('pagehide', onHandoff);
      window.addEventListener('beforeunload', onHandoff);

      try {
        const res = await fetch(`/api/apps/${encodeURIComponent(app.slug)}/download?stream=1`, { credentials: 'include' });
        if (!res.ok || !res.body) throw new Error('http_' + res.status);

        const total = Number(res.headers.get('Content-Length') || 0);
        const reader = res.body.getReader();
        const chunks = [];
        let received = 0;
        let lastProgressWrite = 0;
        let lastProgressValue = -1;
        const pushProgress = (value, force = false) => {
          const now = Date.now();
          if (!force && now - lastProgressWrite < 200 && Math.abs(value - lastProgressValue) < 0.02) return;
          lastProgressWrite = now;
          lastProgressValue = value;
          S.updateActiveDownloadProgress(app.slug, value);
        };
        if (!total) {
          setIndeterminate();
          S.updateActiveDownloadProgress(app.slug, -1);
        } else {
          pushProgress(0, true);
        }
        for (;;) {
          const { done: readDone, value } = await reader.read();
          if (readDone) break;
          chunks.push(value);
          received += value.length;
          if (total) {
            setProgress(received / total);
            pushProgress(received / total);
          }
        }
        const blob = new Blob(chunks, { type: 'application/vnd.android.package-archive' });
        if (total) setProgress(1);
        saveBlob(blob, filename);
        finished = true;
        cleanupHandoffListeners();
        S.removeActiveDownload(app.slug);
        markInstalledStored(app.slug);
        S.addToDownloadHistory(app);
        showInstalled();
        toast(t('اكتمل التحميل وحفظ الملف في جهازك'), 'success');
      } catch (e) {
        // Streaming failed (network/limits) — fall back to a normal download so
        // the user still gets the file, and don't fake an "installed" state.
        finished = true;
        cleanupHandoffListeners();
        fallbackDownload(app.slug);
        S.removeActiveDownload(app.slug);
        S.addToDownloadHistory(app);
        showIdle();
        toast(t('تعذر عرض شريط التقدم، وبدأ التنزيل بالطريقة العادية'), 'info');
      }
    }

    btn.addEventListener('click', runInstall);

    // ----- Restore the REAL install/download state when the page (re)loads.
    // Native: the device PackageManager is the source of truth — this is what
    // makes the page show "فتح / إلغاء التثبيت" instead of "تثبيت" after
    // returning to the store, and shows live progress for in-flight installs.
    function resolveInstallState() {
      const deviceVer = S.installedVersionOnDevice(app.package_name || '');
      const live = S.getApkState(app.slug);
      if (deviceVer) {
        markInstalledStored(app.slug);
        const hasUpdate = S.versionIsNewer(app.version_name || '', deviceVer);
        showInstalled(hasUpdate ? 'update' : 'open');
        // Installed → [فتح][إلغاء التثبيت] replacing the button; update
        // available → keep the "تحديث" button and show uninstall only.
        showInstalledActions(app, { withOpen: !hasUpdate });
        return;
      }
      // Not installed on the device — never trust a stale local registry.
      unmarkInstalledStored(app.slug);
      removeInstalledActions();
      if (live && live.status === 'downloading') {
        btn.classList.add('installing');
        btn.disabled = true;
        if (live.progress >= 0) setProgress(live.progress);
        else setIndeterminate();
        return;
      }
      if (live && live.status === 'installing') {
        btn.classList.add('installing');
        btn.disabled = true;
        setProgress(1);
        label.textContent = t('جارٍ التثبيت…');
        return;
      }
      if (live && live.status === 'downloaded') {
        // APK downloaded but not installed yet (e.g. installer dismissed).
        setProgress(1);
        btn.classList.remove('installing');
        btn.disabled = false;
        label.textContent = t('جاهز للتثبيت');
        showDownloadedActions(app, live.filename || filename);
        return;
      }
      showIdle();
    }

    if (isNativeApp()) {
      resolveInstallState();
    } else {
      // Browser fallback: restore download state on page reload by estimating
      // progress (no native bridge to ask for the truth).
      const activeDls = S.getActiveDownloads();
      const activeDl = activeDls.find((d) => d.slug === app.slug);
      if (activeDl && activeDl.status === 'downloading') {
      btn.classList.add('installing');
      btn.disabled = true;

      // Calculate estimated progress based on elapsed time
      const startedAt = activeDl.started_at || Math.floor(Date.now() / 1000);
      const elapsed = Math.floor(Date.now() / 1000) - startedAt;
      const sizeBytes = app.size_bytes || activeDl.size_bytes || 20 * 1024 * 1024;
      // Estimate: ~400KB/s average mobile speed
      const estimatedTotalTime = Math.max(10, sizeBytes / (400 * 1024));
      const lastProgress = (activeDl.progress >= 0) ? activeDl.progress : 0;
      // Start from either the stored progress or the time-based estimate (whichever is higher)
      const timeBasedProgress = Math.min(0.95, elapsed / estimatedTotalTime);
      let currentProgress = Math.max(lastProgress, timeBasedProgress);

      if (currentProgress >= 0.95) {
        // Likely finished already — mark as installed
        S.removeActiveDownload(app.slug);
        markInstalledStored(app.slug);
        S.addToDownloadHistory(app);
        showInstalled();
      } else {
        setProgress(currentProgress);
        // Continue advancing the bar smoothly until completion
        const remainingTime = (estimatedTotalTime - elapsed) * 1000;
        const stepInterval = 300;
        const steps = Math.max(1, Math.floor(remainingTime / stepInterval));
        const increment = (0.98 - currentProgress) / steps;
        let stepsDone = 0;
        const progressTimer = setInterval(() => {
          stepsDone++;
          currentProgress = Math.min(0.98, currentProgress + increment);
          setProgress(currentProgress);
          S.updateActiveDownloadProgress(app.slug, currentProgress);
          if (stepsDone >= steps) {
            clearInterval(progressTimer);
            // After reaching ~98%, complete the download
            setTimeout(() => {
              setProgress(1);
              S.removeActiveDownload(app.slug);
              markInstalledStored(app.slug);
              S.addToDownloadHistory(app);
              showInstalled();
              toast(t('اكتمل التحميل'), 'success');
                  }, 800);
          }
        }, stepInterval);
      }
      } else if (isInstalled(app.slug)) {
        showInstalled();
      }
    }

    // Split dropdown attached to the install button: request-update / report.
    const menu = el('div', { class: 'install-menu' },
      el('button', { class: 'install-menu-item', type: 'button', onclick: () => { toggleMenu(false); openRequestUpdate(app); } },
        ico('refresh', 'icon'), t('طلب تحديث')),
      el('button', { class: 'install-menu-item', type: 'button', onclick: () => { toggleMenu(false); openReport(app); } },
        ico('flag', 'icon'), t('إبلاغ عن مشكلة')),
    );
    const caret = el('button', { class: 'btn btn-primary btn-lg install-caret', type: 'button', 'aria-label': t('خيارات إضافية') }, ico('chevronDown', 'icon'));
    const group = el('div', { class: 'install-group' }, btn, caret, menu);

    function toggleMenu(force) {
      const open = typeof force === 'boolean' ? force : !group.classList.contains('menu-open');
      group.classList.toggle('menu-open', open);
    }
    caret.addEventListener('click', (e) => { e.stopPropagation(); toggleMenu(); });
    document.addEventListener('click', (e) => { if (!group.contains(e.target)) toggleMenu(false); });

    return el('div', { class: 'd-actions' }, group);
  }

  function ratingSection(app) {
    let fingerprint = null, voted = false, myRating = 0, selected = 0;
    let reviews = [];

    const avg = S.ratingValue(app);
    const initialCount = S.ratingCountOf(app);
    const user = S.getUser ? S.getUser() : null;

    const big = el('div', { class: 'rate-big' }, initialCount > 0 ? avg.toFixed(1) : '—');
    const avgBar = starBar(avg);
    const count = el('div', { class: 'rate-meta' },
      initialCount > 0 ? `${formatNum(initialCount)} ${t('تقييم')}` : t('كن أول من يقيّم هذا التطبيق'));

    // Rating distribution (5 → 1)
    const distRows = el('div', { class: 'rate-dist' });
    function renderDist(dist, total) {
      distRows.innerHTML = '';
      for (let s = 5; s >= 1; s--) distRows.append(distRow(s, Number((dist && dist[s]) || 0), total));
    }
    renderDist({}, 0);

    function refreshAverage(ratingAvg, ratingCount) {
      big.textContent = ratingCount > 0 ? Number(ratingAvg).toFixed(1) : '—';
      const fresh = starBar(ratingAvg);
      avgBar.replaceChildren(...fresh.childNodes);
      count.textContent = ratingCount > 0 ? `${formatNum(ratingCount)} ${t('تقييم')}` : t('كن أول من يقيّم هذا التطبيق');
    }

    // Interactive star picker (1–5). Text glyphs so stars are always visible/tappable.
    const icons = [];
    const picker = el('div', { class: 'rate-input' });
    function paint(n) {
      icons.forEach((sp, idx) => {
        const on = idx < n;
        sp.classList.toggle('on', on);
        sp.textContent = on ? '★' : '☆';
      });
    }
    for (let i = 1; i <= 5; i++) {
      const sp = el('span', { class: 'star-pick' }, '☆');
      sp.setAttribute('role', 'button');
      sp.setAttribute('aria-label', `${i} ${t('نجوم')}`);
      sp.addEventListener('mouseenter', () => { if (!voted) paint(i); });
      sp.addEventListener('mouseleave', () => paint(voted ? myRating : selected));
      sp.addEventListener('click', () => {
        if (voted) { toast(t('لقد قيّمت هذا التطبيق مسبقاً'), 'info'); return; }
        selected = i; paint(i);
      });
      icons.push(sp);
      picker.append(sp);
    }
    const pickerHint = el('div', { style: { fontSize: '14px', marginBottom: '8px' } }, t('قيّم واكتب مراجعتك'));

    // Review form — reviews are tied to the signed-in Google account, so the
    // reviewer identity (name + photo) is shown and submitted automatically.
    const accountName = (user && (user.displayName || user.email)) || t('مستخدم');
    const accountPhoto = (user && user.photoURL) || '';
    const accountUid = (user && user.uid) || '';
    const idAvatar = el('div', { class: 'avatar' });
    if (accountPhoto) idAvatar.append(el('img', { src: accountPhoto, alt: '', referrerpolicy: 'no-referrer' }));
    else idAvatar.textContent = (accountName.trim().charAt(0) || 'م').toUpperCase();
    const identity = el('div', { class: 'review-identity' },
      idAvatar,
      el('div', { class: 'who' }, el('div', { class: 'nm' }, accountName), el('div', { class: 'dt' }, t('تنشر باسم حسابك'))),
    );
    const commentInput = el('textarea', { class: 'field', maxlength: '2000', placeholder: t('شارك رأيك في هذا التطبيق…') });
    const submitBtn = el('button', { class: 'btn btn-primary' }, t('نشر المراجعة'));
    submitBtn.addEventListener('click', () => submit());
    const form = el('div', { class: 'review-form' }, identity, commentInput, el('div', { class: 'actions' }, submitBtn));

    // Reviews list — show only 1-2 initially, "show more" opens modal
    const INITIAL_REVIEWS = 2;
    const reviewsList = el('div', { class: 'reviews' });
    const showMoreBtn = el('button', { class: 'btn btn-secondary btn-sm', style: { marginTop: '12px', display: 'none' } }, t('عرض المزيد'));
    showMoreBtn.addEventListener('click', () => openReviewsModal());

    function renderReviews(list) {
      reviewsList.innerHTML = '';
      showMoreBtn.style.display = 'none';
      if (!list || !list.length) {
        reviewsList.append(el('div', { class: 'reviews-empty' }, t('لا توجد مراجعات بعد. كن أول من يكتب مراجعة!')));
        return;
      }
      const visible = list.slice(0, INITIAL_REVIEWS);
      visible.forEach((r) => reviewsList.append(reviewCard(r)));
      if (list.length > INITIAL_REVIEWS) {
        showMoreBtn.style.display = '';
        showMoreBtn.textContent = `${t('عرض المزيد')} (${list.length})`;
      }
    }

    function openReviewsModal() {
      const overlay = el('div', { class: 'dialog-overlay', onclick: (e) => { if (e.target === overlay) overlay.remove(); } });
      const body = el('div', { class: 'dialog-body', style: { maxHeight: '60vh', overflowY: 'auto' } });
      reviews.forEach((r) => body.append(reviewCard(r)));
      const card = el('div', { class: 'dialog-card' },
        el('div', { class: 'dialog-head' },
          el('div', { class: 'dialog-title' }, ico('star', 'icon'), t('جميع التقييمات والمراجعات')),
          el('button', { class: 'dialog-close', 'aria-label': t('إغلاق'), onclick: () => overlay.remove() }, ico('close')),
        ),
        body,
        el('div', { class: 'dialog-actions' },
          el('button', { class: 'btn btn-secondary', onclick: () => overlay.remove() }, t('عرض أقل')),
        ),
      );
      overlay.append(card);
      document.body.append(overlay);
      document.addEventListener('keydown', function esc(e) { if (e.key === 'Escape') { overlay.remove(); document.removeEventListener('keydown', esc); } });
    }

    renderReviews([]);

    function lockVoted(rating, comment) {
      voted = true; myRating = rating; selected = rating;
      paint(myRating);
      picker.classList.add('voted');
      pickerHint.textContent = myRating ? `${t('تقييمك')}: ${myRating} ${t('من')} 5` : t('لقد قيّمت هذا التطبيق');
      // Completely hide the input form after voting
      form.style.display = 'none';
    }

    // Initial load — my vote state.
    (async () => {
      try {
        fingerprint = await getFingerprint();
        const res = await window.Store.api(`/api/apps/${encodeURIComponent(app.slug)}/star-check`, { method: 'POST', body: { fp: fingerprint, uid: accountUid } });
        if (res.voted) lockVoted(Number(res.my_rating || 0), res.my_comment || '');
        if (typeof res.rating === 'number') refreshAverage(res.rating, Number(res.rating_count || 0));
      } catch {}
    })();

    // Initial load — reviews list + distribution.
    async function loadReviews() {
      try {
        const res = await window.Store.api(`/api/apps/${encodeURIComponent(app.slug)}/reviews`);
        reviews = res.reviews || [];
        renderReviews(reviews);
        renderDist(res.dist || {}, Number(res.rating_count || 0));
        if (typeof res.rating === 'number') refreshAverage(res.rating, Number(res.rating_count || 0));
      } catch {}
    }
    loadReviews();

    async function submit() {
      if (voted) { toast(t('لقد قيّمت هذا التطبيق مسبقاً'), 'info'); return; }
      if (!selected) { toast(t('اختر عدد النجوم أولاً'), 'info'); return; }
      // Require login before rating (skip in native wrapper where anonymous
      // votes are allowed and the redirect sign-in flow cannot be awaited)
      if (!isNativeApp() && !S.isLoggedIn()) {
        try { await S.requireAuth(); } catch { return; }
      }
      submitBtn.disabled = true;
      const myComment = commentInput.value.trim();
      const myName = accountName;
      try {
        if (!fingerprint) fingerprint = await getFingerprint();
        const res = await window.Store.api(`/api/apps/${encodeURIComponent(app.slug)}/star`, {
          method: 'POST',
          body: { fp: fingerprint, rating: selected, comment: myComment, name: myName, uid: accountUid, photo_url: accountPhoto },
        });
        const rated = selected;
        lockVoted(rated, myComment);
        refreshAverage(res.rating, Number(res.rating_count || 0));
        if (res.review || myComment) {
          reviews.unshift(res.review || { name: myName || t('مستخدم'), rating: rated, comment: myComment, photo_url: accountPhoto || null, ts: Math.floor(Date.now() / 1000) });
          renderReviews(reviews);
        }
        loadReviews();
        toast(t('شكراً لمراجعتك!'), 'success');
      } catch (e) {
        submitBtn.disabled = false;
        if (e && e.status === 409) {
          lockVoted(selected, myComment);
          toast(t('لقد قيّمت هذا التطبيق مسبقاً'), 'info');
          if (e.data && typeof e.data.rating === 'number') refreshAverage(e.data.rating, Number(e.data.rating_count || 0));
        } else if (e && e.data && e.data.error === 'invalid_rating') {
          toast(t('اختر عدد النجوم أولاً'), 'info');
        } else {
          toast(t('تعذّر إرسال المراجعة'), 'error');
        }
      }
    }

    // Collapsible rating section
    const rateBody = el('div', { class: 'rate-collapse-body' });
    rateBody.append(
      el('div', { style: { marginTop: '18px' } },
        pickerHint,
        picker,
        form,
      ),
      reviewsList,
      showMoreBtn,
    );
    // Initially collapsed
    rateBody.style.maxHeight = '0';
    rateBody.style.overflow = 'hidden';
    rateBody.style.transition = 'max-height .35s ease';

    let rateOpen = false;
    const toggleIcon = ico('chevronDown', 'icon rate-toggle-ico');
    const rateHeader = el('div', { class: 'rate-collapse-header', onclick: () => {
      rateOpen = !rateOpen;
      if (rateOpen) {
        rateBody.style.maxHeight = rateBody.scrollHeight + 2000 + 'px';
        toggleIcon.style.transform = 'rotate(180deg)';
      } else {
        rateBody.style.maxHeight = '0';
        toggleIcon.style.transform = 'rotate(0deg)';
      }
    } },
      el('h3', { style: { margin: '0', flex: '1', cursor: 'pointer' } }, t('التقييمات والمراجعات')),
      toggleIcon,
    );
    toggleIcon.style.transition = 'transform .3s ease';

    // Auto-close after rating: watch for the 'voted' class on picker
    const collapseObserver = new MutationObserver(() => {
      if (picker.classList.contains('voted') && rateOpen) {
        setTimeout(() => {
          rateOpen = false;
          rateBody.style.maxHeight = '0';
          toggleIcon.style.transform = 'rotate(0deg)';
        }, 1500);
      }
    });
    collapseObserver.observe(picker, { attributes: true, attributeFilter: ['class'] });

    return el('div', { class: 'd-section' },
      rateHeader,
      el('div', { class: 'rate-summary' },
        el('div', { class: 'rate-side' }, big, avgBar, count),
        distRows,
      ),
      rateBody,
    );
  }
})();
