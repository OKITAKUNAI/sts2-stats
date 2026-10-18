// 第4段階の画面：デッキ（初期カードの削除数、ボス戦開始時のデッキ枚数、呪い）。
window.STS = window.STS || {};

STS.s4views = (function () {
  const T = STS.T;
  const H = () => STS.views.h;
  const refBadge = () => H().el('span', { class: 'badge', title: T.metrics.refHelp }, T.metrics.ref);
  const withRef = (text, isRef) => (isRef ? H().el('span', null, text, refBadge()) : text);
  const actOpts = () => [['1', T.windeck.actN(1)], ['2', T.windeck.actN(2)]];

  function deck(mode, entries, overall, f) {
    const { el, pct, name, sortableTable, metricColumns, optionRow } = H();
    const D = T.deck;
    const out = [];

    // ---- 初期カードの削除数
    const a = Number(f.starterAct);
    const rem = STS.deck.starterRemoval(entries, a);
    out.push(
      el('h3', null, D.removalHeading),
      optionRow(mode, [[D.removalAct, 'starterAct', actOpts()]]),
      el('p', { class: 'note' }, D.removalNote(a)),
      sortableTable(`${mode}-starter-${a}`, [
        { key: 'bucket', label: D.removed, value: (r) => ['0', '1', '2', '3+'].indexOf(r.bucket), cell: (r) => r.bucket },
        ...metricColumns(overall, (r) => r.m),
      ], rem.rows, { key: 'bucket', dir: 'asc' }),
      el('p', null, el('strong', null, D.partsHeading(a))),
      sortableTable(`${mode}-starter-parts-${a}`, [
        { key: 'kind', label: D.removed, value: (r) => r.i, cell: (r) => D.parts[r.k] },
        { key: 'n', label: D.partsCount, num: true, value: (r) => r.n, cell: (r) => String(r.n) },
      ], ['strike', 'defend', 'other', 'transform'].map((k, i) => ({ k, i, n: rem.parts[k] })), { key: 'kind', dir: 'asc' }));

    // ---- ボス戦開始時のデッキ枚数
    out.push(el('h3', null, D.deckHeading), el('p', { class: 'note' }, D.deckNote), el('p', { class: 'note' }, D.binNote));
    for (const act of [1, 2, 3]) {
      const rows = STS.deck.deckAtBoss(entries, act);
      const isRef = (r) => r.n < 5;
      const base = [
        { key: 'bin', label: D.deckSize, value: (r) => r.key, cell: (r) => r.label },
        { key: 'n', label: T.metrics.n, num: true, refOf: isRef, value: (r) => r.n, cell: (r) => String(r.n) },
        { key: 'bossRateAt', label: D.bossRate, num: true, metric: act === 3 ? 'bossRate' : undefined, refOf: isRef, value: (r) => r.bossRate, cell: (r) => withRef(pct(r.bossRate), isRef(r)) },
      ];
      // 3章はボスを倒すことがそのまま勝利なので、ボス撃破率だけ
      const cols = act < 3 ? [...base, ...metricColumns(overall, (r) => r.m).filter((c) => c.key !== 'n')] : base;
      out.push(el('p', null, el('strong', null, T.windeck.actN(act))),
        act === 3 ? el('p', { class: 'note' }, D.deckAct3Note) : null,
        sortableTable(`${mode}-deck-${act}`, cols, rows, { key: 'bin', dir: 'asc' }));
    }
    out.push(el('p', { class: 'note' }, `${D.winnersHeading}：${D.winners(STS.deck.winnerDecks(entries))}`));

    // ---- 呪い
    out.push(el('h3', null, D.curseHeading));
    const curses = STS.deck.curseSet(f.excludeBane === 'yes');
    const registered = STS.deck.curseSet(false);
    if (!registered.size) {
      out.push(el('p', { class: 'msg warn' }, D.curseNone));
      return el('div', null, out);
    }
    out.push(
      el('p', { class: 'note' }, D.curseList([...registered].map(name).join('、'))),
      registered.has(STS.deck.BANE) ? optionRow(mode, [[D.excludeBane, 'excludeBane', [['yes', D.excludeBaneOpts.yes], ['no', D.excludeBaneOpts.no]]]]) : null);
    const boss = STS.deck.curseAtBoss(entries, curses);
    const refB = (r) => r.n < 5;
    out.push(
      el('p', null, el('strong', null, D.curseBossHeading)),
      el('p', { class: 'note' }, D.curseBossNote),
      sortableTable(`${mode}-curse-boss`, [
        { key: 'act', label: D.act, num: true, value: (r) => r.act * 10 + ['0', '1', '2+'].indexOf(r.bucket), cell: (r) => T.windeck.actN(r.act) },
        { key: 'bucket', label: D.curses, value: (r) => ['0', '1', '2+'].indexOf(r.bucket), cell: (r) => r.bucket },
        { key: 'n', label: T.boss.fights, num: true, refOf: refB, value: (r) => r.n, cell: (r) => String(r.n) },
        { key: 'rate', label: D.bossRate, num: true, metric: 'bossRate', refOf: refB, value: (r) => r.bossRate, cell: (r) => withRef(pct(r.bossRate), refB(r)) },
      ], boss, { key: 'act', dir: 'asc' }));
    const end = STS.deck.curseAtEnd(entries, curses);
    out.push(
      el('p', null, el('strong', null, D.curseEndHeading)),
      el('p', { class: 'note' }, D.curseEndNote),
      sortableTable(`${mode}-curse-end`, [
        { key: 'bucket', label: D.curses, value: (r) => ['0', '1', '2', '3+'].indexOf(r.bucket), cell: (r) => r.bucket },
        ...metricColumns(overall, (r) => r.m),
      ], end.byCount, { key: 'bucket', dir: 'asc' }),
      el('p', null, el('strong', null, D.curseCardHeading)),
      sortableTable(`${mode}-curse-card`, [
        { key: 'card', label: D.card, value: (r) => name(r.key), cell: (r) => name(r.key) },
        ...metricColumns(overall, (r) => r.m),
      ], end.byCard, { key: 'n', dir: 'desc' }));
    return el('div', null, out);
  }

  return { deck };
})();
