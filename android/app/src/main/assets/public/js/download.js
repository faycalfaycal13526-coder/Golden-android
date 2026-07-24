/* eslint-env browser */
(function () {
  var btn = document.getElementById('downloadBtn');
  function setDownload(url) {
    if (!url || !btn) return;
    btn.href = url;
    btn.classList.remove('no-link');
    btn.setAttribute('download', 'goldenstore.apk');
  }
  fetch('/api/app-update', { method: 'GET', credentials: 'same-origin' })
    .then(function (r) { return r.json().catch(function () { return null; }); })
    .then(function (data) { setDownload(data && (data.apk_url || data.url)); })
    .catch(function () {});
})();
