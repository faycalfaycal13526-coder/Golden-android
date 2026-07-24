// Games page — same Play-style layout as the apps page, restricted to type=game.
(function () {
  const S = window.Store;
  const { el, ico, api, getQuery, t } = S;
  const root = document.getElementById('root');

  S.bottomNav('games');

  const TOP_TABS = [
    { key: 'foryou', label: 'محتوى يهمّك' },
    { key: 'top', label: 'الأكثر رواجًا' },
    { key: 'rated', label: 'الأعلى تقييماً' },
    { key: 'categories', label: 'الفئات' },
  ];

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

    function baseQuery() { return 'type=game'; }
    function filt(apps) { return apps || []; }

    function q(params) {
      const base = baseQuery();
      return `/api/apps?${base ? base + '&' : ''}${params}`;
    }

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

      // Build a single deduplicated pool of ALL games
      const seenAll = new Set();
      const allApps = [];
      [...recentApps, ...popularApps, ...topApps].forEach((a) => {
        if (!a || seenAll.has(a.slug)) return;
        seenAll.add(a.slug);
        allApps.push(a);
      });

      if (!allApps.length) {
        content.append(S.emptyState(t('لا توجد ألعاب بعد'), t('ميّز تطبيقاً كـ«لعبة» من لوحة التحكم لتظهر هنا.'), 'gamepad'));
        return;
      }

      // Editors' choice carousel
      const carouselApps = pickCarousel(allApps).slice(0, 6);
      if (carouselApps.length) content.append(S.featureCarousel(carouselApps));

      // Track which slugs are shown in browsable sections to avoid duplication
      const usedSlugs = new Set();

      // Recommended poster row
      const recommended = (popularApps.length ? popularApps : recentApps).slice(0, 8);
      if (recommended.length) {
        content.append(posterSection(t('ألعاب موصى بها'), recommended));
        recommended.forEach((a) => usedSlugs.add(a.slug));
      }

      // Full catalog with grid/list toggle — exactly like the apps page
      const leftover = allApps.filter((a) => !usedSlugs.has(a.slug));
      const inRecommended = allApps.filter((a) => usedSlugs.has(a.slug));
      const others = [...inRecommended, ...leftover];
      if (others.length) content.append(toggleSection('', others));
    }

    async function renderTop() {
      const res = await api(q('sort=popular&limit=60'));
      const apps = filt(res.apps).slice(0, 50);
      content.innerHTML = '';
      if (!apps.length) { content.append(S.emptyState(t('لا توجد ألعاب بعد'), null, 'gamepad')); return; }
      content.append(rankedList(apps));
    }

    async function renderTopRated() {
      const res = await api(q('sort=rating&limit=60'));
      const apps = filt(res.apps).filter((a) => S.ratingCountOf(a) > 0).slice(0, 50);
      content.innerHTML = '';
      if (!apps.length) { content.append(S.emptyState(t('لا توجد ألعاب مقيّمة بعد'), t('قيّم الألعاب لتظهر هنا الأعلى تقييماً.'), 'gamepad')); return; }
      content.append(rankedList(apps));
    }

    async function renderCategories() {
      const { categories } = await api('/api/categories?type=game');
      content.innerHTML = '';
      const list = el('div', { class: 'applist', style: { marginTop: '8px' } });
      categories.forEach((c) => {
        list.append(el('a', { href: `/search?category=${c.slug}`, class: 'approw' },
          el('div', { class: 'art', style: { background: 'var(--surface-2)' } }, ico(c.icon, 'icon icon-lg')),
          el('div', { class: 'info' },
            el('div', { class: 'nm' }, S.categoryName(c.slug) || t(c.name)),
            el('div', { class: 'sub' }, `${c.count || 0} ${t('لعبة')}`),
          ),
          ico('chevronStart', 'icon'),
        ));
      });
      content.append(el('div', { class: 'section' }, list));
    }
  });

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
    apps.forEach((a) => row.append(S.posterCard(a)));
    return el('div', { class: 'section' },
      el('div', { class: 'section-head' }, el('h2', null, title), ico('chevronStart', 'icon more')),
      row,
    );
  }

  // Section with a vertical (list) / grid (2-col icons) view switch.
  const VIEW_KEY = 'gs_games_view';
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
        const grid = el('div', { class: 'grid-list' });
        apps.forEach((a) => grid.append(S.gridCard(a)));
        body.append(grid);
      } else {
        const list = el('div', { class: 'applist' });
        apps.forEach((a) => list.append(S.listRow(a)));
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

  function rankedList(apps) {
    const list = el('div', { class: 'applist' });
    apps.forEach((a, i) => {
      const row = S.listRow(a);
      const rank = el('div', { style: { width: '24px', textAlign: 'center', fontWeight: '700', color: 'var(--text-2)', fontSize: '15px', flexShrink: '0' } }, String(i + 1));
      row.insertBefore(rank, row.firstChild);
      list.append(row);
    });
    return el('div', { class: 'section' }, list);
  }
})();
