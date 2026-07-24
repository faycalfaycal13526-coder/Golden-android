(async function () {
  const { api, el, ico, toast, formatBytes, formatNum, formatDate, themeToggleBtn } = window.GS;
  const t = (window.GSI18N && window.GSI18N.t) ? window.GSI18N.t : (s) => s;
  const root = document.getElementById('content');

  let me = null;
  let cats = [];
  let activeTab = 'dashboard';
  let newKind = 'app';

  // ---------------- helpers ----------------

  function emptyMsg(title, sub) {
    return el('div', { class: 'empty-state' },
      ico('package', 'icon icon-xxl'),
      el('h3', null, title),
      sub ? el('p', null, sub) : null,
    );
  }

  function showSpinner() {
    root.innerHTML = '';
    root.append(el('div', { class: 'center-spinner' }, el('div', { class: 'spinner' })));
  }

  const MULTIPART_THRESHOLD = 10 * 1024 * 1024; // 10 MB

  function xhrPut(url, data, contentType, onProgress) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', url, true);
      if (contentType) xhr.setRequestHeader('Content-Type', contentType);
      if (onProgress) {
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) onProgress(e.loaded, e.total);
        };
      }
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const etag = xhr.getResponseHeader('ETag');
          resolve(etag);
        } else {
          reject(new Error(`upload_failed_${xhr.status}`));
        }
      };
      xhr.onerror = () => reject(new Error('upload_error'));
      xhr.send(data);
    });
  }

  async function retryXhrPut(url, data, contentType, onProgress, maxRetries) {
    let lastErr;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await xhrPut(url, data, contentType, onProgress);
      } catch (err) {
        lastErr = err;
        if (attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
        }
      }
    }
    throw lastErr;
  }

  async function r2Upload(file, kind, slugHint, onProgress) {
    const contentType = file.type || 'application/octet-stream';

    if (file.size > MULTIPART_THRESHOLD) {
      return await r2MultipartUpload(file, kind, slugHint, contentType, onProgress);
    }

    // Small file: single presigned PUT (with retry)
    const { url, key } = await api('/api/admin/upload-url', {
      method: 'POST',
      body: {
        kind,
        filename: file.name,
        content_type: contentType,
        slug_hint: slugHint || file.name,
      },
    });

    await retryXhrPut(url, file, contentType, (loaded, total) => {
      if (onProgress) onProgress(loaded / total);
    }, 2);
    return key;
  }

  async function r2MultipartUpload(file, kind, slugHint, contentType, onProgress) {
    // 1. Create multipart upload and get presigned part URLs
    const mp = await api('/api/admin/multipart/create', {
      method: 'POST',
      timeoutMs: 60000,
      body: {
        kind,
        filename: file.name,
        content_type: contentType,
        slug_hint: slugHint || file.name,
        file_size: file.size,
      },
    });

    const { key, uploadId, partSize, parts: partUrls } = mp;
    const completedParts = [];
    let totalUploaded = 0;

    try {
      // 2. Upload each part with retry
      for (let i = 0; i < partUrls.length; i++) {
        const start = i * partSize;
        const end = Math.min(start + partSize, file.size);
        const chunk = file.slice(start, end);
        const partNum = partUrls[i].partNumber;
        const partUrl = partUrls[i].url;

        const etag = await retryXhrPut(partUrl, chunk, null, (loaded) => {
          if (onProgress) onProgress((totalUploaded + loaded) / file.size);
        }, 3);

        if (!etag) {
          throw new Error('upload_etag_missing');
        }

        totalUploaded += (end - start);
        if (onProgress) onProgress(totalUploaded / file.size);

        completedParts.push({ PartNumber: partNum, ETag: etag });
      }

      // 3. Complete multipart upload
      await api('/api/admin/multipart/complete', {
        method: 'POST',
        timeoutMs: 30000,
        body: { key, uploadId, parts: completedParts },
      });

      return key;
    } catch (err) {
      // Abort multipart upload on failure (cleanup)
      api('/api/admin/multipart/abort', {
        method: 'POST',
        body: { key, uploadId },
      }).catch(() => {});
      throw err;
    }
  }

  function dropzone({ accept, multiple = false, label = 'انقر أو اسحب الملف هنا', onFiles }) {
    let chosen = [];
    const dz = el('div', { class: 'dropzone', tabindex: '0' },
      ico('upload', 'icon icon-xxl'),
      el('div', null, label),
      el('div', { class: 'filename muted' }, ''),
    );
    const list = el('div', { class: 'upload-list' });
    const wrap = el('div', null, dz, list);
    const inp = el('input', { type: 'file', accept: accept || '*/*', multiple, style: 'display:none' });

    inp.addEventListener('change', () => {
      const files = Array.from(inp.files || []);
      chosen = multiple ? files : files.slice(0, 1);
      updateUI();
      if (onFiles) onFiles(chosen);
    });
    dz.addEventListener('click', () => inp.click());
    dz.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') inp.click(); });
    ['dragover', 'dragenter'].forEach((ev) => dz.addEventListener(ev, (e) => {
      e.preventDefault(); dz.classList.add('over');
    }));
    ['dragleave', 'drop'].forEach((ev) => dz.addEventListener(ev, () => dz.classList.remove('over')));
    dz.addEventListener('drop', (e) => {
      e.preventDefault();
      const files = Array.from(e.dataTransfer.files || []);
      chosen = multiple ? files : files.slice(0, 1);
      updateUI();
      if (onFiles) onFiles(chosen);
    });

    function updateUI() {
      const fn = dz.querySelector('.filename');
      if (chosen.length === 0) { fn.textContent = ''; return; }
      if (chosen.length === 1) fn.textContent = `${chosen[0].name} (${formatBytes(chosen[0].size)})`;
      else fn.textContent = `${chosen.length} ملف، ${formatBytes(chosen.reduce((s, f) => s + f.size, 0))}`;
    }

    wrap.appendChild(inp);
    wrap.getFiles = () => chosen;
    wrap.reset = () => { chosen = []; inp.value = ''; updateUI(); list.innerHTML = ''; };
    wrap.setProgress = (idx, ratio) => {
      let row = list.children[idx];
      if (!row) {
        row = el('div', { class: 'item' },
          el('span', null, chosen[idx]?.name || ''),
          el('div', { class: 'progress' }, el('div', null)),
        );
        list.append(row);
      }
      row.querySelector('.progress > div').style.width = `${Math.round(ratio * 100)}%`;
    };
    return wrap;
  }

  // ---------------- views ----------------

  async function renderLogin() {
    root.innerHTML = '';

    const passInput = el('input', {
      name: 'password',
      type: 'password',
      required: true,
      autofocus: true,
      autocomplete: 'current-password',
      placeholder: 'كلمة مرور الإدارة',
      'aria-label': 'كلمة مرور الإدارة',
    });

    const submitBtn = el('button', { type: 'submit', class: 'btn btn-primary btn-block btn-lg mt-md' },
      ico('shield'), 'دخول مباشر');

    function setBusy(busy) {
      submitBtn.disabled = busy;
      passInput.disabled = busy;
      submitBtn.innerHTML = '';
      if (busy) {
        submitBtn.append(el('div', { class: 'spinner', style: 'width:18px; height:18px; border-width:2px;' }));
      } else {
        submitBtn.append(ico('shield'), document.createTextNode('دخول مباشر'));
      }
    }

    const form = el('form', { class: 'form', autocomplete: 'on', onsubmit: async (e) => {
      e.preventDefault();
      const password = passInput.value;
      if (!password) { passInput.focus(); return; }
      setBusy(true);
      try {
        await api('/api/login', { method: 'POST', body: { password } });
        // Direct in — no extra round trip; render the admin app immediately.
        activeTab = 'dashboard';
        await renderApp();
      } catch (err) {
        setBusy(false);
        passInput.select();
        let msg = 'كلمة المرور غير صحيحة';
        if (err && (err.status === 0 || err.message === 'timeout')) {
          msg = 'تعذّر الاتصال بالخادم. حدّث الصفحة وحاول من جديد.';
        } else if (err && err.status === 500) {
          msg = 'الإعدادات ناقصة على الخادم. تواصل مع مالك المتجر.';
        } else if (err && err.status >= 502 && err.status <= 504) {
          msg = 'الخادم لا يستجيب حالياً. حاول لاحقاً.';
        }
        toast(msg, 'error');
      }
    } });

    form.append(
      el('div', { class: 'field' },
        el('label', { for: 'admin-pass' }, 'كلمة المرور'),
        passInput,
        el('div', { class: 'hint' }, 'الدخول للإدارة فقط — لا يوجد تسجيل عام.'),
      ),
      submitBtn,
    );
    // Hidden username field for password-manager UX (kept off-screen).
    form.prepend(el('input', {
      type: 'text', name: 'username', value: 'admin', autocomplete: 'username',
      tabindex: '-1', 'aria-hidden': 'true',
      style: 'position:absolute; opacity:0; pointer-events:none; height:0; width:0; padding:0; margin:0; border:0;',
    }));

    const themeBtn = themeToggleBtn();
    themeBtn.classList.remove('tab');
    themeBtn.classList.add('theme-toggle-float');
    const wrap = el('div', { class: 'login-wrap' },
      themeBtn,
      el('div', { class: 'login-card' },
        el('div', { class: 'title' }, ico('shield'), ' دخول الإدارة'),
        el('div', { class: 'sub' }, 'صفحة مخصصة لمالك المتجر فقط — أدخل كلمة المرور للمتابعة.'),
        form,
      ),
    );
    root.append(wrap);
    setTimeout(() => passInput.focus(), 0);
  }

  function renderTopbar() {
    const themeBtn = themeToggleBtn();
    themeBtn.classList.remove('tab');
    themeBtn.classList.add('icon-btn');
    const logoutBtn = el('button', {
      class: 'icon-btn',
      type: 'button',
      'aria-label': 'خروج',
      title: 'خروج',
      onclick: async () => {
        try { await api('/api/logout', { method: 'POST' }); } catch {}
        renderLogin();
      },
    }, ico('logout'));

    return el('div', { class: 'admin-topbar' },
      el('div', { class: 'admin-topbar-inner' },
        el('a', { class: 'admin-brand', href: '/', 'aria-label': 'Golden Store' },
          el('img', { src: '/images/logo.png', alt: 'Golden Store' }),
          el('span', null, 'Golden'),
          el('b', null, 'Store'),
        ),
        el('div', { class: 'spacer' }),
        el('div', { class: 'admin-title' }, 'لوحة التحكم'),
        el('div', { class: 'admin-actions' }, themeBtn, logoutBtn),
      ),
    );
  }

  async function renderApp() {
    showSpinner();
    try {
      cats = (await api('/api/categories')).categories;
    } catch {}
    root.innerHTML = '';

    const shell = el('div', { class: 'admin-shell' });
    const topbar = renderTopbar();

    const logoutTab = el('button', { class: 'tab', onclick: async () => {
      try { await api('/api/logout', { method: 'POST' }); } catch {}
      renderLogin();
    } }, ico('logout'), 'خروج');

    const tabs = el('div', { class: 'admin-tabs' },
      tabBtn('dashboard', 'dashboard', 'لوحة المعلومات'),
      tabBtn('apps', 'apps', 'التطبيقات'),
      tabBtn('games', 'gamepad', 'الألعاب'),
      tabBtn('new', 'plus', 'إضافة جديد'),
      tabBtn('requests', 'flag', 'الطلبات والبلاغات'),
      tabBtn('notifications', 'bell', 'الإشعارات'),
      tabBtn('app-update', 'download', 'رابط تحميل التطبيق'),
      el('span', { class: 'tab-spacer' }),
      logoutTab,
    );

    const body = el('div', { class: 'admin-body', id: 'tab-body' });
    shell.append(topbar, tabs, body);
    root.append(shell);

    if (activeTab === 'dashboard') await renderDashboard(body);
    else if (activeTab === 'apps') await renderAppsList(body, 'app');
    else if (activeTab === 'games') await renderAppsList(body, 'game');
    else if (activeTab === 'new') await renderNewApp(body);
    else if (activeTab === 'requests') await renderRequests(body);
    else if (activeTab === 'notifications') await renderNotifications(body);
    else if (activeTab === 'app-update') await renderAppUpdate(body);
    else if (activeTab.startsWith('edit:')) await renderEditApp(body, activeTab.slice(5));
  }

  function tabBtn(key, icon, label) {
    return el('button', { class: `tab ${activeTab === key ? 'active' : ''}`, onclick: () => {
      activeTab = key; renderApp();
    } }, ico(icon), label);
  }

  // -------- dashboard --------
  async function renderDashboard(body) {
    body.innerHTML = '<div class="center-spinner"><div class="spinner"></div></div>';
    try {
      const stats = await api('/api/admin/stats');
      body.innerHTML = '';
      body.append(
        el('div', { class: 'stat-cards' },
          statCard('apps', 'إجمالي التطبيقات', formatNum(stats.total_apps)),
          statCard('downloadCount', 'إجمالي التنزيلات', formatNum(stats.total_downloads)),
          statCard('storage', 'حجم التخزين', formatBytes(stats.total_size_bytes)),
        ),
        el('div', { class: 'panel' },
          el('div', { class: 'panel-head' }, ico('trending'), 'الأكثر تنزيلاً'),
          stats.top_apps.length ? el('div', { class: 'table-wrap' },
            (() => {
              const tableEl = el('table', { class: 'table' },
                el('thead', null, el('tr', null,
                  el('th', null, ''), el('th', null, 'الاسم'),
                  el('th', null, 'التنزيلات'), el('th', null, ''),
                )),
                el('tbody', null, ...stats.top_apps.map((a) => el('tr', null,
                  el('td', { class: 'cell-icon' }, a.icon_url
                    ? el('img', { src: a.icon_url, class: 'ico-sm' })
                    : el('div', { class: 'ico-sm' })),
                  el('td', { 'data-label': 'الاسم' }, a.name),
                  el('td', { 'data-label': 'التنزيلات' }, formatNum(a.downloads)),
                  el('td', { class: 'cell-actions' }, el('a', { class: 'btn btn-sm btn-secondary', href: `/app?slug=${a.slug}`, target: '_blank' }, ico('external'), 'عرض')),
                ))),
              );
              return tableEl;
            })(),
          ) : emptyMsg('لا توجد بيانات بعد', 'ارفع تطبيقك الأول لرؤية الإحصائيات.'),
        ),
        el('div', { class: 'panel' },
          el('div', { class: 'panel-head' }, ico('refresh'), 'صيانة'),
          el('div', { class: 'sub', style: 'margin-bottom:10px;' }, 'العناصر القديمة بلا نوع محدّد تُعامَل كـ«تطبيق». اضغط لتعيين النوع لها دفعة واحدة (آمن، يُشغَّل مرة واحدة).'),
          el('button', { class: 'btn btn-secondary btn-sm', onclick: async (e) => {
            const b = e.currentTarget; b.disabled = true;
            try {
              const r = await api('/api/admin/migrate-types', { method: 'POST' });
              toast(t('تم تحديث أنواع العناصر') + ': ' + r.updated + ' / ' + r.total, 'success');
            } catch { toast('فشل التحديث', 'error'); }
            b.disabled = false;
          } }, ico('check'), 'تعيين النوع للعناصر القديمة'),
        ),
      );
    } catch (e) {
      body.innerHTML = '';
      body.append(emptyMsg('تعذر التحميل', e.message));
    }
  }

  function statCard(icon, label, value) {
    return el('div', { class: 'stat-card' },
      el('div', { class: 'l' }, ico(icon), label),
      el('div', { class: 'v' }, value),
    );
  }

  // -------- requests & reports --------
  async function renderRequests(body) {
    body.innerHTML = '<div class="center-spinner"><div class="spinner"></div></div>';
    try {
      const { requests } = await api('/api/admin/requests');
      body.innerHTML = '';
      if (!requests.length) {
        body.append(emptyMsg('لا توجد طلبات أو بلاغات', 'ستظهر هنا طلبات التحديث والبلاغات الواردة من المستخدمين.'));
        return;
      }
      const list = el('div', { class: 'panel' });
      requests.forEach((r) => list.append(requestCard(r, body)));
      body.append(list);
    } catch (e) {
      body.innerHTML = '';
      body.append(emptyMsg('تعذر التحميل', e.message));
    }
  }

  async function renderNotifications(body) {
    body.innerHTML = '<div class="center-spinner"><div class="spinner"></div></div>';
    try {
      body.innerHTML = '';

      const titleInput = el('input', {
        class: 'input',
        type: 'text',
        placeholder: 'عنوان الإشعار',
        'aria-label': 'عنوان الإشعار',
      });
      const bodyInput = el('textarea', {
        class: 'input',
        rows: 4,
        placeholder: 'النص',
        'aria-label': 'النص',
      });
      const publishBtn = el('button', { class: 'btn btn-primary', type: 'button' }, ico('bell'), 'نشر إشعار');
      const testBtn = el('button', { class: 'btn btn-secondary', type: 'button' }, ico('bell'), 'إشعار تجريبي');
      const pushInfo = el('div', { class: 'push-info', style: { fontSize: '13px', marginTop: '8px', lineHeight: '1.6' } });
      const listWrap = el('div', { class: 'panel' });
      const list = el('div', { class: 'notif-list' });

      function showPush(push) {
        if (!push) { pushInfo.textContent = ''; return; }
        const parts = [
          `الأجهزة المستهدفة: ${push.targeted || 0}`,
          `نجح: ${push.success || 0}`,
          `فشل: ${push.failure || 0}`,
        ];
        if (push.errors && push.errors.length) parts.push(`أخطاء: ${push.errors.join(' | ')}`);
        pushInfo.textContent = parts.join(' • ');
        if ((push.targeted || 0) === 0) {
          pushInfo.textContent += ' — لا يوجد أي جهاز مسجّل. افتح تطبيق الأندرويد، اسمح بالإشعارات، وسجّل الدخول.';
        }
      }

      async function refreshStatus() {
        try {
          const s = await api('/api/admin/push/status');
          pushInfo.textContent = `الأجهزة المسجّلة حالياً: ${s.registered_tokens || 0}`;
        } catch (e) {}
      }

      testBtn.onclick = async () => {
        testBtn.disabled = true;
        try {
          const res = await api('/api/admin/push/test', { method: 'POST', body: {} });
          showPush(res.push);
          toast('تم إرسال إشعار تجريبي', 'success');
        } catch (e) {
          toast(e.message || 'تعذر الإرسال', 'error');
        } finally {
          testBtn.disabled = false;
        }
      };

      async function load() {
        list.innerHTML = '<div class="center-spinner"><div class="spinner"></div></div>';
        try {
          const res = await api('/api/admin/notifications');
          const notifications = res.notifications || [];
          list.innerHTML = '';
          if (!notifications.length) {
            list.append(emptyMsg('لا توجد إشعارات بعد', 'ستظهر هنا الإشعارات المنشورة والتنبيهات الآلية.'));
            return;
          }
          notifications.forEach((n) => list.append(notificationCard(n, load)));
        } catch (e) {
          list.innerHTML = '';
          list.append(emptyMsg('تعذر التحميل', e.message));
        }
      }

      publishBtn.onclick = async () => {
        const title = titleInput.value.trim();
        const bodyText = bodyInput.value.trim();
        if (!title) { toast('أدخل عنوان الإشعار', 'error'); return; }
        publishBtn.disabled = true;
        try {
          const res = await api('/api/admin/notifications', {
            method: 'POST',
            body: { title, body: bodyText },
          });
          titleInput.value = '';
          bodyInput.value = '';
          showPush(res && res.push);
          toast('تم نشر الإشعار', 'success');
          await load();
        } catch (e) {
          toast(e.message || 'تعذر النشر', 'error');
        } finally {
          publishBtn.disabled = false;
        }
      };

      listWrap.append(
        el('div', { class: 'panel-head' }, ico('bell'), 'الإشعارات'),
        list,
      );
      body.append(
        el('div', { class: 'panel' },
          el('div', { class: 'panel-head' }, ico('bell'), 'نشر إشعار جديد'),
          el('div', { class: 'form' },
            el('div', { class: 'field' },
              el('label', null, 'عنوان الإشعار'),
              titleInput,
            ),
            el('div', { class: 'field' },
              el('label', null, 'النص'),
              bodyInput,
            ),
            el('div', { class: 'btn-row', style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } }, publishBtn, testBtn),
            pushInfo,
          ),
        ),
        listWrap,
      );

      await refreshStatus();
      await load();
    } catch (e) {
      body.innerHTML = '';
      body.append(emptyMsg('تعذر التحميل', e.message));
    }
  }

  // -------- app download link (upload APK to R2, link appears on landing page) --------
  async function renderAppUpdate(body) {
    body.innerHTML = '<div class="center-spinner"><div class="spinner"></div></div>';
    try {
      let current = null;
      try { current = await api('/api/app-update'); } catch {}

      const apkDz = dropzone({ accept: '.apk', label: 'اسحب أو اختر ملف APK للتطبيق' });
      const versionInput = el('input', { class: 'input', type: 'text', placeholder: 'مثلاً: 1.2.0 (اختياري)', value: current && current.version_name || '', 'aria-label': t('إصدار التطبيق') });
      const notesInput = el('textarea', { class: 'input', rows: 3, placeholder: 'ملاحظات قصيرة تظهر في نافذة التحديث (اختياري)', 'aria-label': t('ملاحظات التحديث') }, current && current.notes || '');
      const notifyInput = el('input', { type: 'checkbox' });
      notifyInput.checked = true;

      const saveBtn = el('button', { class: 'btn btn-primary', type: 'button' }, ico('download'), t('نشر التحديث'));
      const currentInfo = current && current.apk_url
        ? el('div', { class: 'hint' }, `الرابط الحالي: ${current.apk_url} — الإصدار: ${current.version_name || '—'}`)
        : null;
      const resultInfo = el('div', { class: 'push-info', style: { fontSize: '13px', marginTop: '8px', lineHeight: '1.6' } });

      saveBtn.onclick = async () => {
        const files = apkDz.getFiles();
        if (!files.length) { toast(t('اختر ملف APK أولاً'), 'error'); return; }
        const version_name = versionInput.value.trim() || undefined;
        const version_code = version_name ? Math.floor(Date.now() / 1000) : 0;
        const notes = notesInput.value.trim();
        saveBtn.disabled = true;
        try {
          toast(t('جارٍ رفع APK…'));
          const apk_key = await r2Upload(files[0], 'apk', 'goldenstore-app', (r) => apkDz.setProgress(0, r));
          const res = await api('/api/admin/app-update', {
            method: 'POST',
            body: { version_name, version_code, apk_key, notes, force: false, send_notification: notifyInput.checked },
          });
          resultInfo.textContent = t('تم حفظ الرابط') + (res && res.push ? ` — ${res.push.success || 0}/${res.push.targeted || 0} ` + t('إشعار') : '');
          toast(t('تم نشر التحديث'), 'success');
        } catch (e) {
          toast(t('فشل نشر التحديث'), 'error');
        } finally {
          saveBtn.disabled = false;
        }
      };

      body.innerHTML = '';
      body.append(
        el('div', { class: 'panel' },
          el('div', { class: 'panel-head' }, ico('download'), t('رفع تحديث التطبيق')),
          el('div', { class: 'form' },
            el('div', { class: 'field' },
              el('label', null, t('ملف APK'), el('span', { class: 'req' }, ' *')),
              apkDz,
            ),
            el('div', { class: 'field' },
              el('label', null, t('إصدار التطبيق'), ' ', el('span', { style: { color: 'var(--text-3)', fontSize: '12px' } }, '(اختياري — لإظهار نافذة تحديث داخل التطبيق)')),
              versionInput,
            ),
            el('div', { class: 'field' },
              el('label', null, t('ملاحظات التحديث')),
              notesInput,
            ),
            el('div', { class: 'field' },
              el('label', { style: { display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' } }, notifyInput, t('إرسال إشعار للمستخدمين')),
            ),
            currentInfo,
            saveBtn,
            resultInfo,
          ),
        ),
      );
    } catch (e) {
      body.innerHTML = '';
      body.append(emptyMsg('تعذر التحميل', e.message));
    }
  }

  function notificationCard(n, refreshList) {
    const type = n.type === 'new_app' || n.type === 'update' || n.type === 'announcement' ? n.type : 'announcement';
    const badgeLabel = type === 'new_app' ? 'تطبيق جديد' : type === 'update' ? 'تحديث' : 'إعلان';
    const card = el('div', { class: 'notif-card' });
    const delBtn = el('button', {
      class: 'btn btn-sm btn-secondary',
      type: 'button',
      onclick: async () => {
        delBtn.disabled = true;
        try {
          await api(`/api/admin/notifications/${n.id}`, { method: 'DELETE' });
          toast('تم الحذف', 'success');
            if (refreshList) {
              await refreshList();
            } else {
              card.remove();
            }
        } catch {
          delBtn.disabled = false;
          toast('تعذر الحذف', 'error');
        }
      },
    }, ico('trash'), 'حذف');

    card.append(
      el('div', { class: 'notif-top' },
        el('span', { class: `notif-badge ${type}` }, badgeLabel),
        el('strong', null, n.title || ''),
        el('span', { class: 'tab-spacer' }),
        el('span', { class: 'notif-meta' }, formatDate(n.created_at)),
        delBtn,
      ),
      n.body ? el('div', { class: 'notif-body' }, n.body) : null,
    );
    return card;
  }

  function requestCard(r, body) {
    const isUpdate = r.type === 'update';
    const card = el('div', { class: 'req-card' });
    const dismissBtn = el('button', { class: 'btn btn-sm btn-secondary', onclick: async () => {
      dismissBtn.disabled = true;
      try { await api(`/api/admin/requests/${r.id}`, { method: 'DELETE' }); card.remove(); toast('تم الحذف', 'success'); }
      catch { dismissBtn.disabled = false; toast('تعذّر الحذف', 'error'); }
    } }, ico('trash'), 'حذف');

    card.append(
      el('div', { class: 'req-top' },
        el('span', { class: `req-badge ${isUpdate ? 'update' : 'report'}` }, isUpdate ? 'طلب تحديث' : 'بلاغ'),
        el('strong', null, r.app_name || r.slug),
        el('span', { class: 'tab-spacer' }),
        el('a', { class: 'btn btn-sm btn-secondary', href: `/app?slug=${encodeURIComponent(r.slug)}`, target: '_blank' }, ico('external'), 'عرض'),
        dismissBtn,
      ),
      el('div', { class: 'req-meta' }, r.ts ? formatDate(r.ts) : ''),
    );

    if (isUpdate) {
      card.append(el('div', { class: 'req-detail' }, `الإصدار الحالي: ${r.current_version || '—'} ← الإصدار المطلوب: ${r.new_version || '—'}`));
      if (r.source) card.append(el('div', { class: 'req-detail' }, 'المصدر: ', el('a', { href: r.source, target: '_blank', rel: 'noopener' }, r.source)));
    } else {
      card.append(el('div', { class: 'req-detail' }, `السبب: ${r.reason || '—'}`));
      if (r.details) card.append(el('div', { class: 'req-detail' }, r.details));
    }
    return card;
  }

  // -------- apps list --------
  async function renderAppsList(body, kind) {
    kind = kind === 'game' ? 'game' : 'app';
    const isGame = (a) => a.type === 'game';
    const noun = kind === 'game' ? 'لعبة' : 'تطبيق';
    body.innerHTML = '<div class="center-spinner"><div class="spinner"></div></div>';
    try {
      const { apps: allApps } = await api('/api/admin/apps');
      const apps = allApps.filter((a) => kind === 'game' ? isGame(a) : !isGame(a));
      body.innerHTML = '';

      const head = el('div', { class: 'flex gap-md', style: 'align-items:center; justify-content:space-between; margin-bottom:14px; flex-wrap:wrap;' },
        el('div', { style: 'font-weight:700; font-size:17px;' }, `${kind === 'game' ? 'الألعاب' : 'التطبيقات'} (${apps.length})`),
        el('button', { class: 'btn btn-primary btn-sm', onclick: () => { newKind = kind; activeTab = 'new'; renderApp(); } },
          ico('plus'), kind === 'game' ? 'إضافة لعبة' : 'إضافة تطبيق'),
      );
      body.append(head);

      if (!apps.length) {
        body.append(emptyMsg(`لا توجد ${kind === 'game' ? 'ألعاب' : 'تطبيقات'} بعد`, `أضف ${noun}اً جديداً من زر «${kind === 'game' ? 'إضافة لعبة' : 'إضافة تطبيق'}».`));
        return;
      }
      const tableWrap = el('div', { class: 'table-wrap' },
        el('table', { class: 'table' },
          el('thead', null, el('tr', null,
            el('th', null, ''),
            el('th', null, 'الاسم'),
            el('th', null, 'التصنيف'),
            el('th', null, 'الإصدار'),
            el('th', null, 'الحجم'),
            el('th', null, 'التنزيلات'),
            el('th', null, 'الإجراءات'),
          )),
          el('tbody', null, ...apps.map((a) => el('tr', null,
            el('td', { class: 'cell-icon' }, a.icon_url
              ? el('img', { src: a.icon_url, class: 'ico-sm' })
              : el('div', { class: 'ico-sm' })),
            el('td', { 'data-label': 'الاسم' },
              el('div', null, a.name),
              (a.stars > 0) ? el('span', { class: 'star-pin', style: 'position:relative; top:auto; inset-inline-end:auto; display:inline-flex; margin-top:6px;' }, ico('star'), formatNum(a.stars)) : null,
            ),
            el('td', { 'data-label': 'التصنيف' }, t(cats.find(c => c.slug === a.category)?.name) || t(a.category) || '—'),
            el('td', { 'data-label': 'الإصدار' }, a.version_name || '—'),
            el('td', { 'data-label': 'الحجم' }, formatBytes(a.size_bytes)),
            el('td', { 'data-label': 'التنزيلات' }, formatNum(a.downloads)),
            el('td', { class: 'cell-actions' }, el('div', { class: 'row-actions' },
              el('a', { class: 'btn btn-sm btn-secondary', href: `/app?slug=${a.slug}`, target: '_blank' }, ico('external'), 'عرض'),
              el('button', { class: 'btn btn-sm btn-secondary', onclick: () => { activeTab = `edit:${a.id}`; renderApp(); } }, ico('edit'), 'تعديل'),
              el('button', { class: 'btn btn-sm btn-danger', onclick: async () => {
                if (!confirm(`حذف «${a.name}» نهائياً؟`)) return;
                try {
                  await api(`/api/admin/apps/${a.id}`, { method: 'DELETE' });
                  toast('تم الحذف', 'success');
                  renderAppsList(body, kind);
                } catch { toast('فشل الحذف', 'error'); }
              } }, ico('trash'), 'حذف'),
            )),
          ))),
        ),
      );
      body.append(tableWrap);
    } catch (e) {
      body.innerHTML = '';
      body.append(emptyMsg('تعذر التحميل', e.message));
    }
  }

  // -------- new app form --------
  async function renderNewApp(body) {
    body.innerHTML = '';

    const apkDz = dropzone({ accept: '.apk', label: 'اسحب أو اختر ملف APK' });
    const iconDz = dropzone({ accept: 'image/*', label: 'اختر أيقونة (PNG/JPG)' });
    const featDz = dropzone({ accept: 'image/*', label: 'اختر صورة عرضية (يفضّل 1024×500)' });
    const ssDz = dropzone({ accept: 'image/*', multiple: true, label: 'اختر لقطات الشاشة (متعددة)' });

    const form = el('form', { class: 'form', onsubmit: async (e) => {
      e.preventDefault();
      const apkFiles = apkDz.getFiles();
      if (!apkFiles.length) { toast('يجب رفع ملف APK', 'error'); return; }
      const data = Object.fromEntries(new FormData(form).entries());
      const submitBtn = form.querySelector('button[type=submit]');
      submitBtn.disabled = true;
      submitBtn.innerHTML = '';
      submitBtn.append(el('div', { class: 'spinner', style: 'width:18px; height:18px; border-width:2px;' }));

      try {
        const slugHint = (data.name || 'app').slice(0, 60);

        // Upload APK first
        toast('بدء رفع الملفات…');
        const apk_key = await r2Upload(apkFiles[0], 'apk', slugHint, (r) => apkDz.setProgress(0, r));
        let icon_key = null;
        const iconFiles = iconDz.getFiles();
        if (iconFiles.length) icon_key = await r2Upload(iconFiles[0], 'icon', slugHint, (r) => iconDz.setProgress(0, r));
        let feature_key = null;
        const featFiles = featDz.getFiles();
        if (featFiles.length) feature_key = await r2Upload(featFiles[0], 'feature', slugHint, (r) => featDz.setProgress(0, r));
        const screenshot_keys = [];
        const ssFiles = ssDz.getFiles();
        for (let i = 0; i < ssFiles.length; i++) {
          const k = await r2Upload(ssFiles[i], 'screenshot', slugHint, (r) => ssDz.setProgress(i, r));
          screenshot_keys.push(k);
        }

        const payload = {
          name: data.name,
          package_name: data.package_name,
          developer: data.developer,
          category: data.category,
          type: data.type === 'game' ? 'game' : 'app',
          short_description: data.short_description,
          description: data.description,
          version_name: data.version_name,
          version_code: data.version_code ? Number(data.version_code) : undefined,
          min_sdk: data.min_sdk ? Number(data.min_sdk) : undefined,
          apk_key,
          icon_key,
          feature_key,
          screenshot_keys,
        };
        const res = await api('/api/admin/apps', { method: 'POST', body: payload });
        toast('تم رفع التطبيق بنجاح', 'success');
        activeTab = `edit:${res.id}`;
        renderApp();
      } catch (err) {
        toast(t('فشل الرفع') + ': ' + (err.message || ''), 'error');
        submitBtn.disabled = false;
        submitBtn.innerHTML = '';
        submitBtn.append(ico('upload'), document.createTextNode('رفع التطبيق'));
      }
    } });

    form.append(
      el('div', { class: 'panel' },
        el('div', { class: 'panel-head' }, ico('plus'), newKind === 'game' ? 'إضافة لعبة جديدة' : 'إضافة تطبيق جديد'),
        formField('name', 'الاسم', 'text', { required: true, placeholder: newKind === 'game' ? 'مثلاً: لعبة الألغاز' : 'مثلاً: تطبيق محرر النصوص' }),
        formField('package_name', 'اسم الحزمة (Package name)', 'text', { required: true, placeholder: 'com.example.app' }),
        formRow(
          formField('developer', 'المطوّر', 'text', { placeholder: 'اسم المطوّر' }),
          categoryField('category', null, 'type'),
        ),
        typeField('type', newKind),
        formField('short_description', 'وصف مختصر', 'text', { placeholder: 'سطر واحد يصف التطبيق' }),
        formTextarea('description', 'الوصف الكامل', { placeholder: 'تفاصيل التطبيق وميزاته…', rows: 5 }),
        formRow(
          formField('version_name', 'اسم الإصدار', 'text', { placeholder: '1.0.0' }),
          formField('version_code', 'رمز الإصدار (رقم)', 'number', { placeholder: '1' }),
        ),
        formField('min_sdk', 'الحد الأدنى لـ Android SDK', 'number', { placeholder: '21', hint: '21 = أندرويد 5.0' }),
      ),
      el('div', { class: 'panel' },
        el('div', { class: 'panel-head' }, ico('android'), 'ملف APK *'),
        apkDz,
      ),
      el('div', { class: 'panel' },
        el('div', { class: 'panel-head' }, ico('image'), 'الأيقونة'),
        iconDz,
      ),
      el('div', { class: 'panel' },
        el('div', { class: 'panel-head' }, ico('image'), 'الصورة العرضية (تظهر في بطاقات اختيارات المحررين)'),
        featDz,
      ),
      el('div', { class: 'panel' },
        el('div', { class: 'panel-head' }, ico('image'), 'لقطات الشاشة'),
        ssDz,
      ),
      el('div', { class: 'flex gap-md' },
        el('button', { type: 'submit', class: 'btn btn-primary btn-lg' }, ico('upload'), 'رفع التطبيق'),
        el('button', { type: 'button', class: 'btn btn-secondary', onclick: () => { activeTab = 'apps'; renderApp(); } }, 'إلغاء'),
      ),
    );
    body.append(form);
  }

  // -------- edit app --------
  async function renderEditApp(body, id) {
    body.innerHTML = '<div class="center-spinner"><div class="spinner"></div></div>';
    try {
      const { app, screenshots } = await api(`/api/admin/apps/${id}`);
      body.innerHTML = '';

      // Header
      body.append(
        el('div', { class: 'flex gap-md mt-md', style: 'align-items:center;' },
          el('button', { class: 'btn btn-secondary btn-sm', onclick: () => { activeTab = 'apps'; renderApp(); } },
            ico('arrowRight'), 'العودة'),
          el('h2', { class: 'section-title' }, app.name),
          el('span', { class: 'right' },
            el('a', { class: 'btn btn-secondary btn-sm', href: `/app?slug=${app.slug}`, target: '_blank' }, ico('external'), 'عرض في المتجر'),
          ),
        ),
      );

      // Metadata form
      const form = el('form', { class: 'form', onsubmit: async (e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(form).entries());
        if (data.version_code === '') delete data.version_code;
        if (data.min_sdk === '') delete data.min_sdk;
        try {
          await api(`/api/admin/apps/${id}`, { method: 'PATCH', body: data });
          toast('تم الحفظ', 'success');
        } catch (err) {
          toast('فشل الحفظ', 'error');
        }
      } });
      form.append(
        el('div', { class: 'panel' },
          el('div', { class: 'panel-head' }, ico('edit'), 'البيانات الأساسية'),
          formField('name', 'اسم التطبيق', 'text', { required: true, value: app.name }),
          formField('package_name', 'اسم الحزمة', 'text', { required: true, value: app.package_name }),
          formRow(
            formField('developer', 'المطوّر', 'text', { value: app.developer || '' }),
            categoryField('category', app.category, 'type'),
          ),
          typeField('type', app.type),
          formField('short_description', 'وصف مختصر', 'text', { value: app.short_description || '' }),
          formTextarea('description', 'الوصف الكامل', { rows: 5, value: app.description || '' }),
          formRow(
            formField('version_name', 'اسم الإصدار', 'text', { value: app.version_name || '' }),
            formField('version_code', 'رمز الإصدار', 'number', { value: app.version_code ?? '' }),
          ),
          formField('min_sdk', 'الحد الأدنى لـ SDK', 'number', { value: app.min_sdk ?? '' }),
          el('button', { type: 'submit', class: 'btn btn-primary' }, ico('check'), 'حفظ التغييرات'),
        ),
      );
      body.append(form);

      // APK replace
      const apkDz = dropzone({ accept: '.apk', label: 'استبدل ملف APK' });
      const apkForm = el('form', { class: 'form', onsubmit: async (e) => {
        e.preventDefault();
        const files = apkDz.getFiles();
        if (!files.length) { toast('اختر ملف APK', 'error'); return; }
        const vn = apkForm.querySelector('[name=version_name]').value;
        const vc = apkForm.querySelector('[name=version_code]').value;
        try {
          const apk_key = await r2Upload(files[0], 'apk', app.slug, (r) => apkDz.setProgress(0, r));
          await api(`/api/admin/apps/${id}/apk`, {
            method: 'POST',
            body: { apk_key, version_name: vn || undefined, version_code: vc ? Number(vc) : undefined },
          });
          toast('تم تحديث APK', 'success');
          renderEditApp(body, id);
        } catch (err) { toast('فشل التحديث', 'error'); }
      } });
      apkForm.append(
        apkDz,
        formRow(
          formField('version_name', 'اسم الإصدار الجديد', 'text', { placeholder: 'مثلاً: 1.1.0' }),
          formField('version_code', 'رمز الإصدار', 'number', { placeholder: '2' }),
        ),
        el('button', { type: 'submit', class: 'btn btn-primary btn-sm' }, ico('upload'), 'تحديث APK'),
      );
      body.append(el('div', { class: 'panel' },
        el('div', { class: 'panel-head' }, ico('android'), 'تحديث ملف APK'),
        el('p', { class: 'muted', style: 'font-size:13px;' }, `الحالي: ${formatBytes(app.size_bytes)} · ${app.version_name || '—'}`),
        apkForm,
      ));

      // Icon replace
      const iconDz = dropzone({ accept: 'image/*', label: 'اختر أيقونة جديدة' });
      const iconForm = el('form', { class: 'form', onsubmit: async (e) => {
        e.preventDefault();
        const files = iconDz.getFiles();
        if (!files.length) { toast('اختر صورة', 'error'); return; }
        try {
          const icon_key = await r2Upload(files[0], 'icon', app.slug, (r) => iconDz.setProgress(0, r));
          await api(`/api/admin/apps/${id}/icon`, { method: 'POST', body: { icon_key } });
          toast('تم تحديث الأيقونة', 'success');
          renderEditApp(body, id);
        } catch (err) { toast('فشل التحديث', 'error'); }
      } });
      iconForm.append(iconDz, el('button', { type: 'submit', class: 'btn btn-primary btn-sm' }, ico('upload'), 'استبدال الأيقونة'));
      body.append(el('div', { class: 'panel' },
        el('div', { class: 'panel-head' }, ico('image'), 'الأيقونة'),
        app.icon_url ? el('img', { src: app.icon_url, style: 'width:80px; height:80px; border-radius:18px; border:1px solid var(--line); margin-bottom:12px;' }) : null,
        iconForm,
      ));

      // Feature graphic (wide image used in the home editors-choice carousel)
      const featDz = dropzone({ accept: 'image/*', label: 'اختر صورة عرضية (يفضّل 1024×500)' });
      const featForm = el('form', { class: 'form', onsubmit: async (e) => {
        e.preventDefault();
        const files = featDz.getFiles();
        if (!files.length) { toast('اختر صورة', 'error'); return; }
        try {
          const feature_key = await r2Upload(files[0], 'feature', app.slug, (r) => featDz.setProgress(0, r));
          await api(`/api/admin/apps/${id}/feature`, { method: 'POST', body: { feature_key } });
          toast('تم تحديث الصورة العرضية', 'success');
          renderEditApp(body, id);
        } catch (err) { toast('فشل التحديث', 'error'); }
      } });
      featForm.append(featDz, el('button', { type: 'submit', class: 'btn btn-primary btn-sm' }, ico('upload'), 'حفظ الصورة العرضية'));
      body.append(el('div', { class: 'panel' },
        el('div', { class: 'panel-head' }, ico('image'), 'الصورة العرضية (بطاقات اختيارات المحررين)'),
        app.feature_url ? el('img', { src: app.feature_url, style: 'width:100%; max-width:420px; aspect-ratio:1024/500; object-fit:cover; border-radius:16px; border:1px solid var(--line); margin-bottom:12px;' }) : null,
        featForm,
      ));

      // Screenshots
      const ssDz = dropzone({ accept: 'image/*', multiple: true, label: 'أضف لقطات جديدة' });
      const ssForm = el('form', { class: 'form', onsubmit: async (e) => {
        e.preventDefault();
        const files = ssDz.getFiles();
        if (!files.length) { toast('اختر صور', 'error'); return; }
        try {
          const screenshot_keys = [];
          for (let i = 0; i < files.length; i++) {
            const k = await r2Upload(files[i], 'screenshot', app.slug, (r) => ssDz.setProgress(i, r));
            screenshot_keys.push(k);
          }
          await api(`/api/admin/apps/${id}/screenshots`, { method: 'POST', body: { screenshot_keys } });
          toast('تمت الإضافة', 'success');
          renderEditApp(body, id);
        } catch (err) { toast('فشل الرفع', 'error'); }
      } });
      ssForm.append(ssDz, el('button', { type: 'submit', class: 'btn btn-primary btn-sm' }, ico('upload'), 'إضافة لقطات'));
      const ssPanel = el('div', { class: 'panel' },
        el('div', { class: 'panel-head' }, ico('image'), 'لقطات الشاشة'),
      );
      if (screenshots.length) {
        const row = el('div', { class: 'screenshots' });
        screenshots.forEach((ss) => {
          const wrap = el('div', { style: 'position:relative; flex-shrink:0;' },
            ss.url ? el('img', { src: ss.url, style: 'height:200px; width:auto; border:1px solid var(--line); border-radius:8px;' }) : null,
            el('button', { class: 'btn btn-sm btn-danger', style: 'position:absolute; top:6px; inset-inline-end:6px;',
              onclick: async () => {
                if (!confirm('حذف هذه اللقطة؟')) return;
                try {
                  await api(`/api/admin/apps/${id}/screenshots/${ss.id}`, { method: 'DELETE' });
                  toast('تم الحذف', 'success');
                  renderEditApp(body, id);
                } catch { toast('فشل الحذف', 'error'); }
              } }, ico('trash')),
          );
          row.append(wrap);
        });
        ssPanel.append(row);
      }
      ssPanel.append(el('div', { class: 'mt-md' }, ssForm));
      body.append(ssPanel);

      // Danger zone
      body.append(el('div', { class: 'panel' },
        el('div', { class: 'panel-head', style: 'border-color: var(--danger);' }, ico('trash'), 'منطقة الخطر'),
        el('p', { class: 'muted', style: 'font-size:13px;' }, 'حذف التطبيق يحذف ملف APK والأيقونة وجميع اللقطات نهائياً.'),
        el('button', { class: 'btn btn-danger mt-md', onclick: async () => {
          if (!confirm(`حذف «${app.name}» نهائياً؟`)) return;
          try {
            await api(`/api/admin/apps/${id}`, { method: 'DELETE' });
            toast('تم الحذف', 'success');
            activeTab = 'apps'; renderApp();
          } catch { toast('فشل الحذف', 'error'); }
        } }, ico('trash'), 'حذف التطبيق نهائياً'),
      ));
    } catch (e) {
      body.innerHTML = '';
      body.append(emptyMsg('تعذر التحميل', e.message));
    }
  }

  // ---------------- form builders ----------------

  function formField(name, label, type = 'text', opts = {}) {
    const inp = el('input', {
      name, type,
      placeholder: opts.placeholder || '',
      required: opts.required ? true : null,
      value: opts.value != null ? String(opts.value) : null,
    });
    return el('div', { class: 'field' },
      el('label', null, label, opts.required ? el('span', { class: 'req' }, ' *') : null),
      inp,
      opts.hint ? el('div', { class: 'hint' }, opts.hint) : null,
    );
  }
  function formTextarea(name, label, opts = {}) {
    const ta = el('textarea', { name, placeholder: opts.placeholder || '', rows: String(opts.rows || 4) });
    if (opts.value) ta.value = opts.value;
    return el('div', { class: 'field' },
      el('label', null, label),
      ta,
    );
  }
  function formRow(...children) {
    return el('div', { class: 'form-row' }, ...children);
  }
  function categoryField(name, value, typeSelectName) {
    const sel = el('select', { name });
    function populateCats(currentType) {
      const selected = sel.value || value || 'other';
      sel.innerHTML = '';
      cats.forEach((c) => {
        // Show app categories for apps, game categories for games
        const isGameCat = c.slug.startsWith('game_');
        if (currentType === 'game' && !isGameCat && c.slug !== 'other') return;
        if (currentType !== 'game' && isGameCat) return;
        const opt = el('option', { value: c.slug }, t(c.name));
        if (selected === c.slug) opt.selected = true;
        sel.append(opt);
      });
    }
    // Defer linking to type select to allow DOM construction
    setTimeout(() => {
      const typeEl = typeSelectName && sel.closest('form')?.querySelector(`[name="${typeSelectName}"]`);
      if (typeEl) {
        populateCats(typeEl.value);
        typeEl.addEventListener('change', () => populateCats(typeEl.value));
      } else {
        populateCats(value && value.startsWith('game_') ? 'game' : 'app');
      }
    }, 0);
    populateCats(value && value.startsWith('game_') ? 'game' : 'app');
    return el('div', { class: 'field' },
      el('label', null, 'التصنيف'),
      sel,
    );
  }
  function typeField(name, value) {
    const sel = el('select', { name });
    [['app', 'تطبيق'], ['game', 'لعبة']].forEach(([v, lbl]) => {
      const opt = el('option', { value: v }, lbl);
      if ((value || 'app') === v) opt.selected = true;
      sel.append(opt);
    });
    return el('div', { class: 'field' },
      el('label', null, 'النوع'),
      sel,
      el('div', { class: 'hint' }, 'الألعاب تظهر في تبويب «ألعاب» بالشريط السفلي'),
    );
  }
  function formToggle(name, label, checked) {
    const inp = el('input', { type: 'checkbox', name });
    if (checked) inp.checked = true;
    return el('label', { class: 'toggle', style: 'padding-top:6px;' },
      inp,
      el('span', { class: 'track' }),
      el('span', null, label),
    );
  }

  // ---------------- init ----------------
  try {
    me = await api('/api/me');
  } catch {}
  if (me && me.authenticated) await renderApp();
  else await renderLogin();
})();
