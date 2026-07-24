// Home page — single "All apps" feed with Play-style top tabs (For you / Top charts / Categories).
(function () {
  const S = window.Store;
  const { el, ico, api, getQuery, t } = S;
  const root = document.getElementById('root');

  S.bottomNav('apps');

  const TOP_TABS = [
    { key: 'foryou', label: 'محتوى يهمّك' },
    { key: 'top', label: 'الأكثر رواجًا' },
    { key: 'rated', label: 'الأعلى تقييماً' },
    { key: 'categories', label: 'الفئات' },
  ];
  // Translate tab labels at render time so they're instant

  S.ready((user) => {
    root.innerHTML = '';
    root.append(S.topbarSearch(user));

    let topTab = 'foryou';
    const tabsBar = el('div', { class: 'tabs' });
    const content = el('div', { class: 'content' });

    function renderTabs() {
      tabsBar.innerHTML = '';
      TOP_TABS.forEach((t_item) => {
        tabsBar.append(el('button', {
          class: `tab ${t_item.key === topTab ? 'active' : ''}`,
          onclick: () => { if (topTab !== t_item.key) { topTab = t_item.key; renderTabs(); renderContent(); } },
        }, t(t_item.label)));
      });
    }

    root.append(tabsBar, content);
    renderTabs();
    renderContent();

    function baseQuery() { return 'type=app'; }
    function filt(apps) { return apps || []; }

    async function renderContent() {
      content.innerHTML = '';
      content.append(topTab === 'categories' ? S.skeletonList() : S.skeletonHome());
      try {
        if (topTab === 'categories') return renderCategories();
        if (topTab === 'top') return renderTop();
        if (topTab === 'rated') return renderTopRated();
        return renderForYou();
      } catch (err) {
        content.innerHTML = '';
        content.append(S.errorState(err));
      }
    }

    function q(params) {
      const base = baseQuery();
      return `/api/apps?${base ? base + '&' : ''}${params}`;
    }

    async function renderForYou() {
      const [recent, popular, top] = await Promise.all([
        api(q('sort=recent&limit=60')).catch(() => ({ apps: [] })),
        api(q('sort=popular&limit=30')).catch(() => ({ apps: [] })),
        api(q('sort=rating&limit=30')).catch(() => ({ apps: [] })),
      ]);
      content.innerHTML = '';

      const recentApps = filt(recent.apps);
      const popularApps = filt(popular.apps);
      const topApps = filt(top.apps);

      // Build a single deduplicated pool of ALL apps
      const seenAll = new Set();
      const allApps = [];
      [...recentApps, ...popularApps, ...topApps].forEach((a) => {
        if (!a || seenAll.has(a.slug)) return;
        seenAll.add(a.slug);
        allApps.push(a);
      });

      if (!allApps.length) {
        content.append(S.emptyState(t('لا توجد تطبيقات بعد'), t('ستظهر هنا تطبيقات المتجر فور إضافتها من لوحة الإدارة.')));
        return;
      }

      // Editors' choice carousel — visual hero only, does NOT consume apps
      const carouselApps = pickCarousel(allApps).slice(0, 6);
      if (carouselApps.length) content.append(S.featureCarousel(carouselApps));

      // Track which slugs are shown in browsable sections to avoid duplication
      const usedSlugs = new Set();

      // "موصى به لك" — horizontal poster row
      const recommended = (popularApps.length ? popularApps : recentApps).slice(0, 8);
      if (recommended.length) {
        content.append(posterSection(t('موصى به لك'), recommended));
        recommended.forEach((a) => usedSlugs.add(a.slug));
      }

      // Directly under "موصى به لك": grid/list toggle showing the FULL catalog.
      // Show every app here (recommended ones first) so nothing is ever hidden
      // from the grid/list view — apps highlighted in the row above still appear
      // in the browsable grid below.
      const leftover = allApps.filter((a) => !usedSlugs.has(a.slug));
      const inRecommended = allApps.filter((a) => usedSlugs.has(a.slug));
      const others = [...inRecommended, ...leftover];
      if (others.length) content.append(toggleSection('', others));
    }

    async function renderTop() {
      const res = await api(q('sort=popular&limit=60'));
      const apps = filt(res.apps).slice(0, 50);
      content.innerHTML = '';
      if (!apps.length) { content.append(S.emptyState(t('لا توجد تطبيقات بعد'))); return; }
      const list = el('div', { class: 'applist' });
      apps.forEach((a, i) => {
        const row = S.listRow(a);
        const rank = el('div', { style: { width: '24px', textAlign: 'center', fontWeight: '700', color: 'var(--text-2)', fontSize: '15px', flexShrink: '0' } }, String(i + 1));
        row.insertBefore(rank, row.firstChild);
        list.append(row);
      });
      content.append(el('div', { class: 'section' }, list));
    }

    async function renderTopRated() {
      const res = await api(q('sort=rating&limit=60'));
      const apps = filt(res.apps).filter((a) => S.ratingCountOf(a) > 0).slice(0, 50);
      content.innerHTML = '';
      if (!apps.length) { content.append(S.emptyState(t('لا توجد تطبيقات مقيّمة بعد'), t('قيّم التطبيقات لتظهر هنا الأعلى تقييماً.'))); return; }
      const list = el('div', { class: 'applist' });
      apps.forEach((a, i) => {
        const row = S.listRow(a);
        const rank = el('div', { style: { width: '24px', textAlign: 'center', fontWeight: '700', color: 'var(--text-2)', fontSize: '15px', flexShrink: '0' } }, String(i + 1));
        row.insertBefore(rank, row.firstChild);
        list.append(row);
      });
      content.append(el('div', { class: 'section' }, list));
    }

    async function renderCategories() {
      const { categories } = await api('/api/categories?type=app');
      content.innerHTML = '';
      const list = el('div', { class: 'applist', style: { marginTop: '8px' } });
      categories.forEach((c) => {
        list.append(el('a', { href: `/search?category=${c.slug}`, class: 'approw' },
          el('div', { class: 'art', style: { background: 'var(--surface-2)' } }, ico(c.icon, 'icon icon-lg')),
          el('div', { class: 'info' },
            el('div', { class: 'nm' }, S.categoryName(c.slug) || t(c.name)),
            el('div', { class: 'sub' }, `${c.count || 0} ${t('تطبيق')}`),
          ),
          ico('chevronStart', 'icon'),
        ));
      });
      content.append(el('div', { class: 'section' }, list));
    }
  });

  // Choose carousel apps: prefer those with a feature graphic, de-duplicated,
  // then top up with the best remaining apps so the carousel is never empty.
  function pickCarousel(pool) {
    const seen = new Set();
    const withFeat = [];
    const without = [];
    pool.forEach((a) => {
      if (!a || seen.has(a.slug)) return;
      seen.add(a.slug);
      (a.feature_url ? withFeat : without).push(a);
    });
    return [...withFeat, ...without].slice(0, 8);
  }

  function posterSection(title, apps) {
    if (!apps || !apps.length) return el('span');
    const row = el('div', { class: 'hrow' });
    apps.forEach((a) => row.append(window.Store.posterCard(a)));
    return el('div', { class: 'section' },
      el('div', { class: 'section-head' }, el('h2', null, title), ico('chevronStart', 'icon more')),
      row,
    );
  }

  // Section with a vertical (list) / grid (2-col icons) view switch.
  const VIEW_KEY = 'gs_home_view';
  function toggleSection(title, apps) {
    if (!apps || !apps.length) return el('span');
    let mode = localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'grid';

    const body = el('div');
    const gridBtn = el('button', { type: 'button', 'aria-label': t('شبكة'), title: t('شبكة') }, ico('grid', 'icon'));
    const listBtn = el('button', { type: 'button', 'aria-label': t('قائمة'), title: t('قائمة') }, ico('list', 'icon'));

    function render() {
      body.innerHTML = '';
      gridBtn.classList.toggle('on', mode === 'grid');
      listBtn.classList.toggle('on', mode === 'list');
      if (mode === 'grid') {
        // Square grid cards
        const grid = el('div', { class: 'grid-list' });
        apps.forEach((a) => grid.append(window.Store.gridCard(a)));
        body.append(grid);
      } else {
        // Single column list
        const list = el('div', { class: 'applist' });
        apps.forEach((a) => list.append(window.Store.listRow(a)));
        body.append(list);
      }
    }
    function setMode(m) { if (m === mode) return; mode = m; try { localStorage.setItem(VIEW_KEY, m); } catch (e) {} render(); }
    gridBtn.onclick = () => setMode('grid');
    listBtn.onclick = () => setMode('list');

    render();
    const head = el('div', { class: 'section-head' });
    if (title) head.append(el('h2', null, title));
    else head.style.justifyContent = 'flex-start';
    head.append(el('div', { class: 'view-toggle' }, gridBtn, listBtn));
    return el('div', { class: 'section' }, head, body);
  }
})();
