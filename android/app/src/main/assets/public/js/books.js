// Books ("الكتب") placeholder page.
(function () {
  const S = window.Store;
  S.bottomNav('books');
  S.ready((user) => {
    const root = document.getElementById('root');
    root.innerHTML = '';
    root.append(S.topbarSearch(user));
    root.append(S.emptyState('الكتب قريباً', 'سيتوفّر قسم الكتب في تحديث قادم من Golden Store.', 'book'));
  });
})();
