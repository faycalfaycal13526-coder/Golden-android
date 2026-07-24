// Featured page — editors' choice & curated picks.
(function () {
  const S = window.Store;
  const { el, ico, api, t } = S;
  const root = document.getElementById('root');

  S.bottomNav('');

  S.ready((user) => {
    root.innerHTML = '';
    root.append(S.topbarSearch(user));

    const content = el('div', { class: 'content' });
    root.append(content);
    content.append(S.skeletonHome());
    render(content);
  });

  function dedupe(lists) {
    const seen = new Set();
    const out = [];
    lists.forEach((arr) => (arr || []).forEach((a) => {
      if (!a || seen.has(a.slug)) return;
      seen.add(a.slug);
      out.push(a);
    }));
    return out;
  }

  async function render(content) {
    try {
      const [top, popular, recent] = await Promise.all([
        api('/api/apps?sort=rating&limit=40').catch(() => ({ apps: [] })),
        api('/api/apps?sort=popular&limit=40').catch(() => ({ apps: [] })),
        api('/api/apps?sort=recent&limit=40').catch(() => ({ apps: [] })),
      ]);
      content.innerHTML = '';

      const all = dedupe([top.apps, popular.apps, recent.apps]);
      if (!all.length) {
        content.append(S.emptyState(t('لا توجد تطبيقات مميّزة بعد'), t('ستظهر هنا اختيارات المحرّرين فور إضافتها من لوحة الإدارة.')));
        return;
      }

      const editors = all.filter((a) => a.feature_url);
      const rated = (top.apps || []).filter((a) => S.ratingCountOf(a) > 0);

      content.append(el('div', { class: 'page-title' }, t('المميّزة')));
      content.append(el('div', { class: 'section-sub' }, t('اختيارات المحرّرين المنتقاة لك')));

      // Hero: curved auto-scrolling carousel built from feature graphics.
      const heroApps = editors.length ? editors : (popular.apps || top.apps || []);
      content.append(S.featureCarousel(heroApps, { max: 8 }));

      // Editors' choice grid (apps with a feature graphic).
      if (editors.length) {
        content.append(gridSection(t('اختيارات المحرّرين'), editors));
      }

      // Top rated — meaningful curated list (only when there are real ratings).
      if (rated.length) {
        content.append(listSection(t('الأعلى تقييماً'), rated.slice(0, 10)));
      }

      // If there are no editors' picks yet, offer the most popular as a grid
      // so the page is never just a single hero.
      if (!editors.length) {
        const pop = (popular.apps && popular.apps.length ? popular.apps : recent.apps) || [];
        if (pop.length) content.append(gridSection(t('الأكثر رواجًا'), pop.slice(0, 18)));
      }
    } catch (err) {
      content.innerHTML = '';
      content.append(S.errorState(err));
    }
  }

  function gridSection(title, apps) {
    if (!apps || !apps.length) return el('span');
    const grid = el('div', { class: 'poster-grid' });
    apps.forEach((a) => grid.append(S.posterCard(a)));
    return el('div', { class: 'section' },
      el('div', { class: 'section-head' }, el('h2', null, title)),
      grid,
    );
  }

  function listSection(title, apps) {
    if (!apps || !apps.length) return el('span');
    const list = el('div', { class: 'applist' });
    apps.forEach((a) => list.append(S.listRow(a)));
    return el('div', { class: 'section' },
      el('div', { class: 'section-head' }, el('h2', null, title)),
      list,
    );
  }
})();
