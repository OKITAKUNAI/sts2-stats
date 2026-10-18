// 第2段階の画面：勝利デッキ分析、カード報酬、戦闘、ボス。
window.STS = window.STS || {};

STS.aviews = (function () {
  const T = STS.T;
  const H = () => STS.views.h;

  // 参考値の印
  const refBadge = () => H().el('span', { class: 'badge', title: T.metrics.refHelp }, T.metrics.ref);
  const withRef = (text, isRef) => (isRef ? H().el('span', null, text, refBadge()) : text);
  const rerender = (mode) => STS.views.renderTab(mode);

  // ---- 勝利デッキ分析（カード別・レリック別から切り替え）
  function winDeck(mode, entries, f, kind) {
    const { el, pct, name, cardLabel, sortableTable, optionRow } = H();
    const W = T.windeck;
    const act = f.wdAct === 'all' ? 'all' : Number(f.wdAct);
    const t = STS.stats.winDeckTable(entries, { kind, act, upgrade: f.upgrade });
    const label = kind === 'relic' ? (r) => name(r.key) : (r) => cardLabel(r.key);
    const isRef = (r) => r.winN < 5;
    const cols = [
      { key: 'name', label: kind === 'relic' ? T.relics.name : T.cards.name, value: label, cell: label },
      { key: 'winN', label: W.winN, num: true, value: (r) => r.winN, cell: (r) => String(r.winN) },
      { key: 'winShare', label: kind === 'relic' ? W.winShareRelic : W.winShare, num: true, value: (r) => r.winShare, cell: (r) => pct(r.winShare), refOf: isRef },
      { key: 'allN', label: W.allN, num: true, value: (r) => r.allN, cell: (r) => String(r.allN) },
      { key: 'allShare', label: kind === 'relic' ? W.allShareRelic : W.allShare, num: true, value: (r) => r.allShare, cell: (r) => pct(r.allShare), refOf: isRef },
      { key: 'ratio', label: W.ratio, num: true, value: (r) => r.ratio, refOf: isRef,
        cell: (r) => withRef(r.ratio == null ? H().DASH : `×${r.ratio.toFixed(2)}`, isRef(r)) },
    ];
    const opts = [[W.act, 'wdAct', [['all', W.actAll], ['1', W.actN(1)], ['2', W.actN(2)], ['3', W.actN(3)]]]];
    if (kind === 'card') opts.push([T.filters.upgrade, 'upgrade', [['merge', T.filters.upgradeMerge], ['split', T.filters.upgradeSplit]]]);
    return el('div', null,
      optionRow(mode, opts),
      el('p', { class: 'note' }, W.base(t.runs, t.wins, act)),
      el('p', { class: 'note' }, W.note),
      t.wins ? sortableTable(`${mode}-windeck-${kind}`, cols, t.rows, { key: 'ratio', dir: 'desc' })
        : el('p', { class: 'msg warn' }, W.noWins));
  }

  // ---- カード報酬
  function rewards(mode, entries, overall, f) {
    const { el, pct, num1, cardLabel, sortableTable, metricColumns, optionRow } = H();
    const R = T.rewards;
    const sources = new Set(f.sources);
    const rows = STS.rewards.analyze(entries, { sources, upgrade: f.upgrade });

    const srcBox = el('div', { class: 'options' }, el('span', { class: 'opt-group' }, `${R.sources}：`,
      STS.rewards.SOURCES.map((s) => el('label', { class: 'check' },
        el('input', { type: 'checkbox', checked: sources.has(s), onchange: (ev) => {
          f.sources = ev.target.checked ? [...new Set([...f.sources, s])] : f.sources.filter((x) => x !== s);
          rerender(mode);
        } }), ' ', R.src[s]))));
    const head = [
      srcBox,
      el('p', { class: 'note' }, R.srcNote),
      optionRow(mode, [
        [R.mode, 'rewardMode', [['first', R.modeFirst], ['act', R.modeAct]]],
        [T.filters.upgrade, 'upgrade', [['merge', T.filters.upgradeMerge], ['split', T.filters.upgradeSplit]]],
      ]),
    ];
    const nameCol = { key: 'name', label: T.cards.name, value: (r) => cardLabel(r.key), cell: (r) => cardLabel(r.key) };

    if (f.rewardMode === 'act') {
      const a = Number(f.rewardAct);
      const list = rows.map((r) => ({ key: r.key, m: r.byAct[a - 1] })).filter((r) => r.m.n > 0);
      return el('div', null, head,
        optionRow(mode, [[R.act, 'rewardAct', [['1', T.windeck.actN(1)], ['2', T.windeck.actN(2)], ['3', T.windeck.actN(3)]]]]),
        el('p', { class: 'note' }, R.actNote),
        el('p', { class: 'note' }, T.table.sortHelp),
        sortableTable(`${mode}-rewards-act`, [nameCol, ...metricColumns(overall, (r) => r.m)], list, { key: f.sortBy, dir: 'desc' }));
    }

    // 最初に提示された場面での比較
    const sortKey = f.sortBy === 'n' ? 'winRate' : f.sortBy;
    const metricLabel = T.metrics[sortKey];
    const fmt = (k, v) => (v == null ? H().DASH : k === 'avgFloor' ? num1(v) : pct(v));
    const isRef = (r) => r.taken.n < 5 || r.notTaken.n < 5;
    const diffOf = (r) => (r.taken[sortKey] != null && r.notTaken[sortKey] != null ? r.taken[sortKey] - r.notTaken[sortKey] : null);
    const group = (g, label) => [
      { key: `${g}-n`, label: `${label}：n`, num: true, value: (r) => r[g].n, cell: (r) => String(r[g].n) },
      ...['winRate', 'avgFloor', 'actClear', 'bossRate'].map((k) => ({
        key: `${g}-${k}`, label: `${label}：${T.metrics[k]}`, num: true, refOf: isRef,
        value: (r) => r[g][k], cell: (r) => fmt(k, r[g][k]),
      })),
    ];
    const cols = [
      nameCol,
      { key: 'offeredRuns', label: R.offeredRuns, num: true, value: (r) => r.offeredRuns, cell: (r) => String(r.offeredRuns) },
      ...group('taken', R.taken),
      ...group('notTaken', R.notTaken),
      { key: 'diff', label: R.diff(metricLabel), num: true, refOf: isRef, value: diffOf, metric: sortKey,
        cell: (r) => {
          const d = diffOf(r);
          if (d == null) return H().DASH;
          const text = sortKey === 'avgFloor' ? `${d >= 0 ? '+' : ''}${d.toFixed(1)}` : `${d >= 0 ? '+' : ''}${(d * 100).toFixed(1)}${T.metrics.pt}`;
          return withRef(text, isRef(r));
        } },
    ];
    return el('div', null, head,
      el('p', { class: 'note' }, R.firstNote),
      el('p', { class: 'note' }, `${R.diffHelp} ${T.table.sortHelp}`),
      sortableTable(`${mode}-rewards-first`, cols, rows.filter((r) => r.offeredRuns > 0), { key: 'diff', dir: 'desc' }));
  }

  // ---- 戦闘
  function combat(mode, entries, overall, f) {
    const { el, pct, num1, name, sortableTable, metricColumns, optionRow } = H();
    const C = T.combat;
    const avgNum = (x) => (x == null ? H().DASH : x.toFixed(1));
    const enemyCell = (r) => (r.key ? name(r.key) : T.unknown) + (r.eventThenCombat ? ' ※' : '');

    const enc = STS.combat.encounterTable(entries);
    const isRefFights = (r) => r.fights < 5;
    const encCols = [
      { key: 'name', label: C.enemy, value: (r) => (r.key ? name(r.key) : ''), cell: enemyCell },
      { key: 'kind', label: C.kind, value: (r) => r.kind, cell: (r) => C.kinds[r.kind] || T.unknown },
      { key: 'fights', label: C.fights, num: true, value: (r) => r.fights, cell: (r) => String(r.fights) },
      { key: 'avgDamage', label: C.avgDamage, num: true, refOf: isRefFights, value: (r) => r.avgDamage, cell: (r) => avgNum(r.avgDamage) },
      { key: 'avgDamageRatio', label: C.avgDamageRatio, num: true, refOf: isRefFights, value: (r) => r.avgDamageRatio, cell: (r) => pct(r.avgDamageRatio) },
      { key: 'avgTurns', label: C.avgTurns, num: true, refOf: isRefFights, value: (r) => r.avgTurns, cell: (r) => avgNum(r.avgTurns) },
      { key: 'lossRate', label: C.lossRate, num: true, refOf: isRefFights, value: (r) => r.lossRate, cell: (r) => withRef(pct(r.lossRate), isRefFights(r)) },
    ];

    const worst = STS.combat.worstInLosses(entries);
    const worstCols = [
      { key: 'name', label: C.enemy, value: (r) => (r.key ? name(r.key) : ''), cell: (r) => (r.key ? name(r.key) : T.unknown) },
      { key: 'kind', label: C.kind, value: (r) => r.kind, cell: (r) => C.kinds[r.kind] || T.unknown },
      { key: 'count', label: C.count, num: true, value: (r) => r.count, cell: (r) => String(r.count) },
      { key: 'share', label: C.share, num: true, value: (r) => r.share, cell: (r) => pct(r.share) },
      { key: 'avgDamage', label: C.avgDamage, num: true, value: (r) => r.avgDamage, cell: (r) => avgNum(r.avgDamage) },
      { key: 'avgDamageRatio', label: C.avgDamageRatio, num: true, value: (r) => r.avgDamageRatio, cell: (r) => pct(r.avgDamageRatio) },
    ];

    const a = Number(f.eliteAct);
    const eRows = STS.combat.eliteTable(entries, a);
    const bucketCol = { key: 'bucket', label: C.elites, value: (r) => STS.combat.ELITE_BUCKETS.indexOf(r.bucket), cell: (r) => r.bucket };
    const eliteTable = a < 3
      ? sortableTable(`${mode}-elite-${a}`, [bucketCol, ...metricColumns(overall, (r) => r.m)], eRows, { key: 'bucket', dir: 'asc' })
      : sortableTable(`${mode}-elite-3`, [
        bucketCol,
        { key: 'n', label: T.metrics.n, num: true, value: (r) => r.n, cell: (r) => String(r.n) },
        { key: 'hp', label: C.firstBossHp, num: true, refOf: (r) => r.n < 5, value: (r) => r.firstBossHp, cell: (r) => pct(r.firstBossHp) },
        { key: 'bossFights', label: C.bossFights, num: true, value: (r) => r.bossFights, cell: (r) => String(r.bossFights) },
        { key: 'rate', label: C.act3BossRate, num: true, metric: 'bossRate', refOf: (r) => r.n < 5, value: (r) => r.bossRate, cell: (r) => withRef(pct(r.bossRate), r.n < 5) },
      ], eRows, { key: 'bucket', dir: 'asc' });

    return el('div', null,
      el('h3', null, C.encHeading),
      el('p', { class: 'note' }, C.encNote),
      sortableTable(`${mode}-enc`, encCols, enc, { key: 'fights', dir: 'desc' }),
      el('h3', null, C.worstHeading),
      el('p', { class: 'note' }, C.worstNote(worst.runs)),
      sortableTable(`${mode}-worst`, worstCols, worst.rows, { key: 'count', dir: 'desc' }),
      el('h3', null, C.eliteHeading),
      optionRow(mode, [[C.eliteAct, 'eliteAct', [['1', T.windeck.actN(1)], ['2', T.windeck.actN(2)], ['3', T.windeck.actN(3)]]]]),
      el('p', { class: 'note' }, a < 3 ? C.eliteNote12(a) : C.eliteNote3),
      eliteTable);
  }

  // ---- ボス
  function boss(mode, entries) {
    const { el, pct, num1, name, sortableTable } = H();
    const B = T.boss;
    const fights = STS.combat.bossFights(entries);
    const prevLabel = (k) => {
      if (k.startsWith('rest:')) {
        const ch = k.slice(5);
        return ch ? B.rest(ch.split('+').map((x) => name(`REST.${x}`)).join('・')) : B.restNone;
      }
      return B.prevLabels[k] || name(k);
    };
    const isRef = (r) => r.n < 5;
    const common = [
      { key: 'n', label: B.fights, num: true, value: (r) => r.n, cell: (r) => String(r.n) },
      { key: 'defeated', label: B.defeated, num: true, value: (r) => r.defeated, cell: (r) => String(r.defeated) },
      { key: 'rate', label: B.rate, num: true, metric: 'bossRate', refOf: isRef, value: (r) => r.rate, cell: (r) => withRef(pct(r.rate), isRef(r)) },
      { key: 'avgHp', label: B.avgHp, num: true, refOf: isRef, value: (r) => r.avgHp, cell: (r) => pct(r.avgHp) },
      { key: 'avgDeck', label: B.avgDeck, num: true, refOf: isRef, value: (r) => r.avgDeck, cell: (r) => num1(r.avgDeck) },
      { key: 'avgDamage', label: B.avgDamage, num: true, refOf: isRef, value: (r) => r.avgDamage, cell: (r) => num1(r.avgDamage) },
    ];
    const HP_ORDER = ['low', 'mid', 'high', 'unknown'];
    return el('div', null,
      el('p', { class: 'note' }, B.note),
      el('h3', null, B.byPrev),
      sortableTable(`${mode}-boss-prev`, [{ key: 'key', label: B.prev, value: (r) => prevLabel(r.key), cell: (r) => prevLabel(r.key) }, ...common],
        STS.combat.groupBosses(fights, (x) => x.prevChoice.key), { key: 'n', dir: 'desc' }),
      el('h3', null, B.byHp),
      sortableTable(`${mode}-boss-hp`, [{ key: 'key', label: B.hp, value: (r) => HP_ORDER.indexOf(r.key), cell: (r) => B.hpLabels[r.key] }, ...common],
        STS.combat.groupBosses(fights, (x) => STS.combat.hpBucket(x.hpRatioStart)), { key: 'key', dir: 'asc' }),
      el('h3', null, B.byBoss),
      sortableTable(`${mode}-boss-boss`, [{ key: 'key', label: B.boss, value: (r) => name(r.key), cell: (r) => name(r.key) }, ...common],
        STS.combat.groupBosses(fights, (x) => x.id), { key: 'n', dir: 'desc' }));
  }

  function render(sub, mode, entries, overall, f) {
    if (sub === 'rewards') return rewards(mode, entries, overall, f);
    if (sub === 'combat') return combat(mode, entries, overall, f);
    if (sub === 'potions') return STS.aviews2.potions(mode, entries);
    if (sub === 'events') return STS.aviews2.events(mode, entries, overall, f);
    if (sub === 'upgrades') return STS.aviews3.upgrades(mode, entries, overall, f);
    if (sub === 'shop') return STS.aviews3.shop(mode, entries, overall, f);
    if (sub === 'ancient') return STS.aviews3.ancient(mode, entries, overall, f);
    return boss(mode, entries);
  }

  return { render, winDeck };
})();
