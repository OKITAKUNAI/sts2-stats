// 第2段階の画面（3回目）：アップグレード、ショップ、エンシェント・エンチャント。
window.STS = window.STS || {};

STS.aviews3 = (function () {
  const T = STS.T;
  const H = () => STS.views.h;
  const refBadge = () => H().el('span', { class: 'badge', title: T.metrics.refHelp }, T.metrics.ref);
  const withRef = (text, isRef) => (isRef ? H().el('span', null, text, refBadge()) : text);
  const HP_ORDER = ['low', 'mid', 'high', 'unknown'];
  const actOpts = () => [['1', T.windeck.actN(1)], ['2', T.windeck.actN(2)], ['3', T.windeck.actN(3)]];

  // 2つのグループ（例：買った／買わなかった）の4指標と、選んでいる指標の差の列
  function compareCols(f, gA, labelA, gB, labelB, isRef) {
    const { pct, num1 } = H();
    const sortKey = f.sortBy === 'n' ? 'winRate' : f.sortBy;
    const fmt = (k, v) => (v == null ? H().DASH : k === 'avgFloor' ? num1(v) : pct(v));
    const group = (g, label) => [
      { key: `${g}-n`, label: `${label}：n`, num: true, refOf: isRef, value: (r) => r[g].n, cell: (r) => String(r[g].n) },
      ...['winRate', 'avgFloor', 'actClear', 'bossRate'].map((k) => ({
        key: `${g}-${k}`, label: `${label}：${T.metrics[k]}`, num: true, refOf: isRef, value: (r) => r[g][k], cell: (r) => fmt(k, r[g][k]),
      })),
    ];
    const diffOf = (r) => (r[gA][sortKey] != null && r[gB][sortKey] != null ? r[gA][sortKey] - r[gB][sortKey] : null);
    return [
      ...group(gA, labelA), ...group(gB, labelB),
      { key: 'diff', label: T.compare.diff(T.metrics[sortKey]), num: true, refOf: isRef, metric: sortKey, value: diffOf,
        cell: (r) => {
          const d = diffOf(r);
          if (d == null) return H().DASH;
          const text = sortKey === 'avgFloor' ? `${d >= 0 ? '+' : ''}${d.toFixed(1)}` : `${d >= 0 ? '+' : ''}${(d * 100).toFixed(1)}${T.metrics.pt}`;
          return withRef(text, isRef(r));
        } },
    ];
  }
  const restName = (k) => STS.dict.name(`REST.${k}`);

  // ---- アップグレード
  function upgrades(mode, entries, overall, f) {
    const { el, pct, name, sortableTable, metricColumns, optionRow } = H();
    const U = T.upgrades;

    const rest = STS.upgrades.restTable(entries);
    const restCols = [
      { key: 'choice', label: U.choice, value: (r) => restName(r.key), cell: (r) => restName(r.key) },
      { key: 'times', label: U.times, num: true, value: (r) => r.times, cell: (r) => String(r.times) },
      { key: 'share', label: U.share, num: true, value: (r) => r.share, cell: (r) => pct(r.share) },
      { key: 'avgHp', label: U.avgHp, num: true, value: (r) => r.avgHp, cell: (r) => pct(r.avgHp) },
      { key: 'actClear', label: U.actClear, num: true, value: (r) => r.actClear, cell: (r) => pct(r.actClear) },
    ];
    const hpRows = STS.upgrades.restHpTable(entries);
    const refT = (r) => r.times < 5;
    const hpCols = [
      { key: 'hp', label: U.hp, refOf: refT, value: (r) => HP_ORDER.indexOf(r.bucket), cell: (r) => T.boss.hpLabels[r.bucket] },
      { key: 'choice', label: U.choice, refOf: refT, value: (r) => restName(r.key), cell: (r) => restName(r.key) },
      { key: 'times', label: U.times, num: true, refOf: refT, value: (r) => r.times, cell: (r) => String(r.times) },
      { key: 'share', label: U.share, num: true, refOf: refT, value: (r) => r.share, cell: (r) => pct(r.share) },
      { key: 'actClear', label: U.actClear, num: true, refOf: refT, value: (r) => r.actClear, cell: (r) => withRef(pct(r.actClear), refT(r)) },
    ];

    const cardRows = STS.upgrades.cardUpgradeTable(entries);
    const refCard = (r) => r.up.n < 5 || r.no.n < 5;
    const cardCols = [
      { key: 'name', label: U.card, value: (r) => name(r.key), cell: (r) => name(r.key) },
      { key: 'owned', label: U.owned, num: true, refOf: refCard, value: (r) => r.owned, cell: (r) => String(r.owned) },
      { key: 'rate', label: U.rate, num: true, refOf: refCard, value: (r) => r.rate, cell: (r) => pct(r.rate) },
      ...compareCols(f, 'up', U.up, 'no', U.no, refCard),
    ];

    const first = STS.upgrades.firstUpgradeTable(entries, f.firstUp);
    const firstCols = [
      { key: 'name', label: U.card, value: (r) => name(r.key), cell: (r) => name(r.key) },
      { key: 'count', label: U.count, num: true, value: (r) => r.count, cell: (r) => String(r.count) },
      { key: 'share', label: U.share, num: true, value: (r) => r.share, cell: (r) => pct(r.share) },
      ...metricColumns(overall, (r) => r.m),
    ];

    const src = STS.upgrades.sourceTable(entries);
    const srcCols = [
      { key: 'source', label: U.source, value: (r) => U.sources[r.key] || r.key, cell: (r) => U.sources[r.key] || r.key },
      { key: 'n', label: U.n, num: true, value: (r) => r.n, cell: (r) => String(r.n) },
      { key: 'share', label: U.share, num: true, value: (r) => r.share, cell: (r) => pct(r.share) },
      { key: 'perRun', label: U.perRun, num: true, value: (r) => r.perRun, cell: (r) => (r.perRun == null ? H().DASH : r.perRun.toFixed(2)) },
    ];

    return el('div', null,
      el('h3', null, U.restHeading),
      el('p', { class: 'note' }, U.restNote(rest.visits)),
      sortableTable(`${mode}-rest`, restCols, rest.rows, { key: 'times', dir: 'desc' }),
      el('h3', null, U.restHpHeading),
      el('p', { class: 'note' }, U.restHpNote),
      sortableTable(`${mode}-rest-hp`, hpCols, hpRows, { key: 'hp', dir: 'asc' }),
      el('h3', null, U.cardHeading),
      el('p', { class: 'note' }, U.cardNote),
      el('p', { class: 'note' }, T.compare.diffHelp),
      sortableTable(`${mode}-up-card`, cardCols, cardRows, { key: 'owned', dir: 'desc' }),
      el('h3', null, U.firstHeading),
      optionRow(mode, [[U.firstMode, 'firstUp', [['smith', U.firstSmith], ['all', U.firstAll]]]]),
      el('p', { class: 'note' }, U.firstNote(first.runs)),
      sortableTable(`${mode}-up-first-${f.firstUp}`, firstCols, first.rows, { key: 'count', dir: 'desc' }),
      el('h3', null, U.sourceHeading),
      sortableTable(`${mode}-up-src`, srcCols, src, { key: 'n', dir: 'desc' }));
  }

  // ---- ショップ
  function shop(mode, entries, overall, f) {
    const { el, pct, num1, name, sortableTable, metricColumns, optionRow } = H();
    const S = T.shop;
    const out = [el('h3', null, S.itemHeading),
      optionRow(mode, [[S.kind, 'shopKind', ['card', 'relic', 'potion', 'colorless'].map((k) => [k, S.kinds[k]])]])];
    if (f.shopKind === 'colorless') {
      const rows = STS.shop.colorlessTable(entries);
      out.push(el('p', { class: 'note' }, S.colorlessNote), sortableTable(`${mode}-shop-colorless`, [
        { key: 'name', label: S.item, value: (r) => name(r.key), cell: (r) => name(r.key) },
        { key: 'bought', label: S.bought, num: true, value: (r) => r.bought, cell: (r) => String(r.bought) },
        ...metricColumns(overall, (r) => r.m),
      ], rows, { key: 'bought', dir: 'desc' }));
    } else {
      const rows = STS.shop.itemTable(entries, f.shopKind);
      const isRef = (r) => r.took.n < 5 || r.notTook.n < 5;
      out.push(el('p', { class: 'note' }, S.itemNote), el('p', { class: 'note' }, T.compare.diffHelp), sortableTable(`${mode}-shop-${f.shopKind}`, [
        { key: 'name', label: S.item, value: (r) => name(r.key), cell: (r) => name(r.key) },
        { key: 'shown', label: S.shown, num: true, refOf: isRef, value: (r) => r.shown, cell: (r) => String(r.shown) },
        { key: 'bought', label: S.bought, num: true, refOf: isRef, value: (r) => r.bought, cell: (r) => String(r.bought) },
        { key: 'rate', label: S.rate, num: true, refOf: isRef, value: (r) => r.rate, cell: (r) => pct(r.rate) },
        ...compareCols(f, 'took', S.took, 'notTook', S.notTook, isRef),
      ], rows, { key: 'shown', dir: 'desc' }));
    }

    // カード削除
    const a = Number(f.removalAct);
    const rRows = STS.shop.removalTable(entries, a);
    const bucketCol = { key: 'bucket', label: S.removals, value: (r) => STS.shop.REMOVAL_BUCKETS.indexOf(r.bucket), cell: (r) => r.bucket };
    const removalTable = a < 3
      ? sortableTable(`${mode}-removal-${a}`, [bucketCol, ...metricColumns(overall, (r) => r.m)], rRows, { key: 'bucket', dir: 'asc' })
      : sortableTable(`${mode}-removal-3`, [
        bucketCol,
        { key: 'n', label: T.metrics.n, num: true, refOf: (r) => r.n < 5, value: (r) => r.n, cell: (r) => String(r.n) },
        { key: 'bossFights', label: T.combat.bossFights, num: true, refOf: (r) => r.n < 5, value: (r) => r.bossFights, cell: (r) => String(r.bossFights) },
        { key: 'rate', label: T.combat.act3BossRate, num: true, metric: 'bossRate', refOf: (r) => r.n < 5, value: (r) => r.bossRate, cell: (r) => withRef(pct(r.bossRate), r.n < 5) },
      ], rRows, { key: 'bucket', dir: 'asc' });
    out.push(
      el('h3', null, S.removalHeading),
      optionRow(mode, [[S.removalAct, 'removalAct', actOpts()]]),
      el('p', { class: 'note' }, a < 3 ? S.removalNote12(a) : S.removalNote3),
      removalTable,
      el('h3', null, S.removedHeading),
      sortableTable(`${mode}-removed`, [
        { key: 'name', label: T.cards.name, value: (r) => name(r.key), cell: (r) => name(r.key) },
        { key: 'count', label: S.removedCount, num: true, value: (r) => r.count, cell: (r) => String(r.count) },
      ], STS.shop.removedCards(entries), { key: 'count', dir: 'desc' }));

    // 所持金
    const g0 = (x) => (x == null ? H().DASH : x.toFixed(0));
    out.push(
      el('h3', null, S.goldHeading),
      el('p', { class: 'note' }, S.goldNote),
      sortableTable(`${mode}-shop-gold`, [
        { key: 'act', label: S.act, num: true, value: (r) => r.act, cell: (r) => T.windeck.actN(r.act) },
        { key: 'visits', label: S.visits, num: true, value: (r) => r.visits, cell: (r) => String(r.visits) },
        { key: 'avgGold', label: S.avgGold, num: true, value: (r) => r.avgGold, cell: (r) => g0(r.avgGold) },
        { key: 'avgSpent', label: S.avgSpent, num: true, value: (r) => r.avgSpent, cell: (r) => g0(r.avgSpent) },
        { key: 'avgRatio', label: S.avgRatio, num: true, value: (r) => r.avgRatio, cell: (r) => pct(r.avgRatio) },
        { key: 'noBuy', label: S.noBuy, num: true, value: (r) => r.noBuy, cell: (r) => pct(r.noBuy) },
      ], STS.shop.goldTable(entries), { key: 'act', dir: 'asc' }),
      el('h3', null, S.leftoverHeading),
      el('p', { class: 'note' }, S.leftoverNote),
      sortableTable(`${mode}-leftover`, [
        { key: 'result', label: S.result, value: (r) => r.key, cell: (r) => S.results[r.key] },
        { key: 'n', label: T.metrics.n, num: true, refOf: (r) => r.n < 5, value: (r) => r.n, cell: (r) => String(r.n) },
        { key: 'avg', label: S.avg, num: true, value: (r) => r.avg, cell: (r) => withRef(g0(r.avg), r.n < 5) },
        { key: 'median', label: S.median, num: true, value: (r) => r.median, cell: (r) => g0(r.median) },
      ], STS.shop.leftoverTable(entries), { key: 'result', dir: 'desc' }),
      el('h3', null, S.bossGoldHeading),
      el('p', { class: 'note' }, S.bossGoldNote),
      sortableTable(`${mode}-boss-gold`, [
        { key: 'act', label: S.act, num: true, value: (r) => r.act * 2 + (r.result === 'win' ? 0 : 1), cell: (r) => T.windeck.actN(r.act) },
        { key: 'result', label: S.result, value: (r) => r.result, cell: (r) => S.bossResults[r.result] },
        { key: 'n', label: T.boss.fights, num: true, refOf: (r) => r.n < 5, value: (r) => r.n, cell: (r) => String(r.n) },
        { key: 'avg', label: S.avg, num: true, value: (r) => r.avg, cell: (r) => withRef(g0(r.avg), r.n < 5) },
        { key: 'median', label: S.median, num: true, value: (r) => r.median, cell: (r) => g0(r.median) },
      ], STS.shop.bossGoldTable(entries), { key: 'act', dir: 'asc' }));
    return el('div', null, out);
  }

  // ---- エンシェント・エンチャント
  function ancient(mode, entries, overall, f) {
    const { el, pct, name, sortableTable, metricColumns } = H();
    const A = T.ancient;
    const all = STS.ancient.choiceTable(entries);
    const ancients = [...new Set(all.map((r) => r.ancient).filter(Boolean))].sort();
    if (f.ancientId !== 'all' && !ancients.includes(f.ancientId)) f.ancientId = 'all';
    const rows = f.ancientId === 'all' ? all : all.filter((r) => r.ancient === f.ancientId);
    const isRef = (r) => r.chosen.n < 5 || r.notChosen.n < 5;
    const cols = [
      { key: 'ancient', label: A.ancient, value: (r) => name(r.ancient), cell: (r) => `${name(r.ancient)}（${T.windeck.actN(r.act)}）` },
      { key: 'option', label: A.option, value: (r) => name(r.key), cell: (r) => name(r.key) },
      { key: 'offered', label: A.offered, num: true, refOf: isRef, value: (r) => r.offered, cell: (r) => String(r.offered) },
      { key: 'times', label: A.times, num: true, refOf: isRef, value: (r) => r.times, cell: (r) => String(r.times) },
      { key: 'rate', label: A.rate, num: true, refOf: isRef, value: (r) => r.rate, cell: (r) => pct(r.rate) },
      ...compareCols(f, 'chosen', A.chosen, 'notChosen', A.notChosen, isRef),
    ];
    const picker = el('label', null, `${A.pick} `, el('select', { onchange: (ev) => { f.ancientId = ev.target.value; STS.views.renderTab(mode); } },
      el('option', { value: 'all', selected: f.ancientId === 'all' }, A.all),
      ancients.map((id) => el('option', { value: id, selected: id === f.ancientId }, name(id)))));

    const ench = STS.ancient.enchantTable(entries);
    return el('div', null,
      el('h3', null, A.choiceHeading),
      el('div', { class: 'filters' }, picker),
      el('p', { class: 'msg warn' }, A.note),
      el('p', { class: 'note' }, T.compare.diffHelp),
      sortableTable(`${mode}-ancient`, cols, rows, { key: 'offered', dir: 'desc' }),
      el('h3', null, A.enchHeading),
      el('p', { class: 'note' }, A.enchNote),
      sortableTable(`${mode}-ench`, [
        { key: 'name', label: A.ench, value: (r) => name(r.key), cell: (r) => name(r.key) },
        { key: 'applied', label: A.applied, num: true, value: (r) => r.applied, cell: (r) => String(r.applied) },
        ...metricColumns(overall, (r) => r.m),
      ], ench, { key: 'applied', dir: 'desc' }));
  }

  return { upgrades, shop, ancient };
})();
