(function () {
  const api = (window.GS && window.GS.api) || fetchJson;
  const android = window.GSAndroid || null;
  let currentDialog = null;

  async function fetchJson(path, opts) {
    const res = await fetch(path, opts);
    if (!res.ok) throw new Error(res.statusText);
    return res.json();
  }

  function installedVersionCode() {
    try { return android && typeof android.getVersionCode === 'function' ? android.getVersionCode() : 0; } catch (e) { return 0; }
  }
  function installedVersionName() {
    try { return android && typeof android.getVersionName === 'function' ? android.getVersionName() : ''; } catch (e) { return ''; }
  }

  function removeDialog() {
    if (currentDialog) { currentDialog.remove(); currentDialog = null; }
  }

  function showUpdate(update) {
    if (currentDialog) return;
    const overlay = document.createElement('div');
    overlay.className = 'gs-update-overlay';
    overlay.innerHTML = `
      <div class="gs-update-card">
        <div class="gs-update-icon">G</div>
        <h2>تحديث جديد متاح</h2>
        <p class="gs-update-version">الإصدار المُثبَّت: <b>${installedVersionName() || '—'}</b> <span dir="ltr">(code ${installedVersionCode()})</span></p>
        <p class="gs-update-version">الإصدار الجديد: <b>${escapeHtml(update.version_name || '')}</b> <span dir="ltr">(code ${update.version_code})</span></p>
        ${update.message ? '<p class="gs-update-message">' + escapeHtml(update.message) + '</p>' : ''}
        <p class="gs-update-note">تحميل النسخة الجديدة يحسّن الأداء ويضيف ميزات حديثة.</p>
        <div class="gs-update-actions">
          ${update.force ? '' : '<button class="gs-update-btn gs-update-later">لاحقاً</button>'}
          <button class="gs-update-btn gs-update-now">تحديث الآن</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    currentDialog = overlay;

    overlay.querySelector('.gs-update-now').addEventListener('click', () => {
      if (android && typeof android.downloadApk === 'function' && update.download_url) {
        const filename = 'goldenstore-' + (update.version_name || 'update') + '.apk';
        android.downloadApk(update.download_url, filename, 'app-update', 'com.goldenstore.app');
        overlay.querySelector('.gs-update-card').innerHTML = '<div class="gs-update-icon">G</div><h2>جارٍ التحميل…</h2><p class="gs-update-note">سيتم التثبيت تلقائياً عند اكتمال التحميل.</p>';
      } else {
        window.open(update.download_url || '/', '_blank');
      }
    });
    if (!update.force) {
      overlay.querySelector('.gs-update-later').addEventListener('click', removeDialog);
    }
  }

  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  async function checkUpdate() {
    const vCode = installedVersionCode();
    if (!vCode || !android) return;
    try {
      const data = await api('/api/app-update');
      if (!data || !data.update || !data.update.version_code) return;
      if (Number(data.update.version_code) > vCode) showUpdate(data.update);
    } catch (e) {
      // Silent on failure
    }
  }

  window.__gsCheckUpdate = function (versionCode, versionName, apkUrl, message) {
    const vCode = parseInt(versionCode, 10);
    if (!vCode || vCode <= installedVersionCode()) return;
    showUpdate({ version_code: vCode, version_name: versionName || '', download_url: apkUrl || '', message: message || '', force: false });
  };

  window.__gsApkDownloadUpdate = function (slug, status, progress) {
    if (slug !== 'app-update') return;
    if (status === 'installed' || status === 'downloaded') {
      removeDialog();
      setTimeout(() => { try { location.reload(); } catch (e) {} }, 300);
    }
  };

  const style = document.createElement('style');
  style.textContent = `
    .gs-update-overlay{position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:10000;display:flex;align-items:center;justify-content:center;padding:20px;font-family:Tajawal,Roboto,system-ui,sans-serif;}
    .gs-update-card{background:var(--surface,#1b1b1f);border:1px solid var(--line,#2e2e33);border-radius:18px;padding:28px;max-width:420px;width:100%;text-align:center;color:var(--text,#e8e8ea);box-shadow:0 20px 60px rgba(0,0,0,.4);}
    .gs-update-icon{width:64px;height:64px;border-radius:18px;background:var(--surface-2,#232328);margin:0 auto 16px;display:flex;align-items:center;justify-content:center;font-size:32px;color:var(--gold,#f4c01f);font-weight:800;}
    .gs-update-card h2{margin:0 0 12px;font-size:22px;}
    .gs-update-version{color:var(--text-2,#a8abb3);font-size:14px;margin:4px 0;}
    .gs-update-message{color:var(--text-2,#a8abb3);font-size:14px;margin:12px 0;line-height:1.6;padding:10px;background:var(--surface-2,#232328);border-radius:12px;}
    .gs-update-note{color:var(--text-3,#82858d);font-size:13px;margin:14px 0 18px;}
    .gs-update-actions{display:flex;gap:10px;justify-content:center;flex-direction:row-reverse;}
    .gs-update-btn{border:none;border-radius:12px;padding:12px 20px;font-weight:700;font-size:15px;cursor:pointer;}
    .gs-update-now{background:var(--gold,#f4c01f);color:var(--gold-ink,#1a1500);}
    .gs-update-later{background:var(--surface-2,#232328);color:var(--text,#e8e8ea);border:1px solid var(--line,#2e2e33);}
    @media (max-width:360px){.gs-update-card{padding:22px 18px;}.gs-update-btn{padding:12px 14px;font-size:14px;}}
  `;
  document.head.appendChild(style);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkUpdate);
  } else {
    setTimeout(checkUpdate, 1200);
  }
})();
