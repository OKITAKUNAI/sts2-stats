// 第3段階の画面：ラン振り返り、区間成績。
window.STS = window.STS || {};

STS.s3views = (function () {
  const T = STS.T;
  const H = () => STS.views.h;
  const SRC = () => T.rewards.src;

  // ---- ラン振り返り
  function review(mode, listEntries) {
    const { el, pct, name, cardLabel, sortableTable, ui, fmtDate, fmtTime } = H();
    const R = T.review;
    const sorted = [...listEntries].sort((a, b) => (b.run.startTime || 0) - (a.run.startTime || 0));
    const resultText = (r) => (r.win ? T.runs.win : r.abandoned ? T.runs.abandoned : T.runs.loss);
    if (!sorted.some((e) => e.run.key === ui.review[mode])) ui.review[mode] = null;
    const picker = el('label', null, `${R.pick} `, el('select', {
      onchange: (ev) => { ui.review[mode] = ev.target.value || null; STS.views.renderTab(mode); },
    }, el('option', { value: '' }, R.pickNone), sorted.map((e) => el('option', { value: e.run.key, selected: e.run.key === ui.review[mode] },
      R.runLabel(fmtDate(e.run.date), name(e.character), e.run.ascension ?? T.unknown, resultText(e.run), e.run.floorReached ?? T.unknown)))));
    const out = [el('div', { class: 'filters' }, picker)];
    const e = sorted.find((x) => x.run.key === ui.review[mode]);
    if (!e) return el('div', null, out, el('p', { class: 'note' }, T.review.openHint));

    const rv = STS.review.build(e);
    const run = e.run;
    out.push(el('p', null, el('strong', null, R.summary({
      date: fmtDate(run.date), char: name(e.character), asc: run.ascension ?? T.unknown, result: resultText(run),
      floor: run.floorReached ?? T.unknown, time: fmtTime(run.runTime), version: run.buildId || T.unknown,
    }))), run.death ? el('p', null, R.death(name(run.death.id))) : null);
    const done = STS.challenges.achievedBy(e, mode);
    if (done.length) out.push(el('p', { class: 'star' }, `${T.challenges.reviewHeading}：${done.map((ch) => `${T.challenges.mainMark} ${ch.name}`).join('　')}`));

    // HP推移
    const coop = run.players.length > 1;
    const series = [];
    rv.hp.forEach((p, k) => {
      const who = coop ? `${p.self ? '' : `${STS.coop.label(p.id)} `}${name(p.character)}` : '';
      series.push({ label: `${who}${who ? '：' : ''}${R.hp}`, cls: `c${k + 1}${p.self ? ' self' : ''}`, points: p.points.map((q) => ({ x: q.x, y: q.hp })) });
      if (!coop || p.self) series.push({ label: `${who}${who ? '：' : ''}${R.maxHp}`, cls: `c${k + 1} dashed`, points: p.points.map((q) => ({ x: q.x, y: q.maxHp })) });
    });
    const selfHp = rv.hp[e.pi].points;
    const yAt = (floor) => { const q = selfHp.find((p) => p.x === floor); return q ? q.hp : null; };
    const marks = [
      ...rv.marks.map((m) => ({ x: m.floor, y: yAt(m.floor), cls: m.kind, title: `${m.floor}${R.floor} ${name(m.id)}` })),
      ...(rv.deathFloor ? [{ x: rv.deathFloor, y: 0, cls: 'death', title: R.legendDeath }] : []),
    ].filter((m) => m.y != null);
    out.push(el('h3', null, R.hpHeading),
      el('p', { class: 'note' }, coop ? `${R.hpNote}${R.hpNoteCoop}` : R.hpNote),
      STS.charts.line({
        series, marks, xMin: 1, yMin: 0, xLabel: R.floorAxis, ariaLabel: R.hpHeading,
        vlines: rv.actStarts.filter((a) => a.act > 1).map((a) => ({ x: a.floor - 0.5, label: R.actLine(a.act) })),
        legend: [[R.legendElite, 'mark elite'], [R.legendBoss, 'mark boss'], [R.legendDeath, 'mark death']],
      }));

    // 最も削られた戦闘
    const dmgRatio = (c) => (c.damage != null && c.maxHpStart ? c.damage / c.maxHpStart : null);
    out.push(el('h3', null, R.worstHeading), sortableTable(`${mode}-rv-worst`, [
      { key: 'floor', label: R.floor, num: true, value: (c) => c.floor, cell: (c) => String(c.floor) },
      { key: 'enemy', label: R.enemy, value: (c) => name(c.id), cell: (c) => name(c.id) + (c.eventThenCombat ? ' ※' : '') },
      { key: 'damage', label: R.damage, num: true, value: (c) => c.damage, cell: (c) => String(c.damage) },
      { key: 'ratio', label: R.ratio, num: true, value: dmgRatio, cell: (c) => pct(dmgRatio(c)) },
    ], rv.worst, { key: 'damage', dir: 'desc' }));

    // ボス戦
    const B = R.bossCols;
    out.push(el('h3', null, R.bossHeading), sortableTable(`${mode}-rv-boss`, [
      { key: 'act', label: B.act, num: true, value: (b) => b.floor, cell: (b) => T.windeck.actN(b.act) },
      { key: 'boss', label: B.boss, value: (b) => name(b.id), cell: (b) => name(b.id) },
      { key: 'hp', label: B.hp, num: true, value: (b) => b.hpStart, cell: (b) => (b.hpStart == null ? T.unknown : `${b.hpStart} / ${b.maxHpStart ?? '?'}`) },
      { key: 'hpRatio', label: B.hpRatio, num: true, value: (b) => b.hpRatioStart, cell: (b) => pct(b.hpRatioStart) },
      { key: 'deck', label: B.deck, num: true, value: (b) => b.deckStart, cell: (b) => (b.deckStart == null ? T.unknown : String(b.deckStart)) },
      { key: 'gold', label: B.gold, num: true, value: (b) => b.goldStart, cell: (b) => (b.goldStart == null ? T.unknown : String(b.goldStart)) },
      { key: 'damage', label: B.damage, num: true, value: (b) => b.damage, cell: (b) => (b.damage == null ? T.unknown : String(b.damage)) },
      { key: 'result', label: B.result, value: (b) => (b.defeated ? 1 : 0), cell: (b) => (b.defeated ? R.defeated : R.lost) },
    ], rv.bosses, { key: 'act', dir: 'asc' }));

    // ポーション・ゴールド
    out.push(el('div', { class: 'two-col' },
      el('div', null, el('h3', null, R.potionHeading), el('p', null, rv.potions.length ? rv.potions.map(name).join('、') : R.noPotion)),
      el('div', null, el('h3', null, R.goldHeading), el('p', null, R.endGold(rv.endGold ?? T.unknown)))));

    // 協力：戦闘ごとの被ダメージ（全員）
    if (coop) {
      const cols = [
        { key: 'floor', label: R.floor, num: true, value: (c) => c.floor, cell: (c) => String(c.floor) },
        { key: 'enemy', label: R.enemy, value: (c) => name(c.id), cell: (c) => name(c.id) + (c.eventThenCombat ? ' ※' : '') },
        ...run.players.map((p, k) => ({
          key: `p${k}`, label: `${k === e.pi ? T.review.me : STS.coop.label(p.id)}（${name(p.character)}）`, num: true,
          csvLabel: `${k === e.pi ? T.review.me : T.csv.partnerN(k + (k < e.pi ? 1 : 0))}（${name(p.character)}）`,
          value: (c) => c.damage[k], cell: (c) => (c.damage[k] == null ? T.unknown : String(c.damage[k])),
        })),
      ];
      out.push(el('h3', null, R.combatsHeading), sortableTable(`${mode}-rv-combats`, cols, rv.combatsAll, { key: 'floor', dir: 'asc' }));
    }

    // カード報酬の流れ
    out.push(el('h3', null, R.rewardHeading), el('p', { class: 'note' }, R.rewardNote), sortableTable(`${mode}-rv-rewards`, [
      { key: 'floor', label: R.floor, num: true, value: (r) => r.floor, cell: (r) => String(r.floor) },
      { key: 'source', label: R.source, value: (r) => SRC()[r.source] || r.source, cell: (r) => SRC()[r.source] || r.source },
      { key: 'offered', label: R.offered, value: (r) => r.cards.length,
        cell: (r) => el('span', null, r.cards.map((c, i) => [i ? '、' : '', c.picked ? el('strong', null, cardLabel(STS.stats.cardKey(c.id, c.lvl, true))) : cardLabel(STS.stats.cardKey(c.id, c.lvl, true))])) },
      { key: 'result', label: R.result, value: (r) => (r.picked.length ? 1 : 0),
        cell: (r) => (r.picked.length ? R.took(r.picked.map((c) => cardLabel(STS.stats.cardKey(c.id, c.lvl, true))).join('、')) : el('span', { class: 'muted' }, R.skip)) },
    ], rv.rewards, { key: 'floor', dir: 'asc' }));

    // 最終デッキ・レリック
    out.push(el('div', { class: 'two-col' },
      el('div', null, el('h3', null, R.deckHeading(rv.deckSize)), sortableTable(`${mode}-rv-deck`, [
        { key: 'card', label: R.card, value: (c) => name(c.id), cell: (c) => cardLabel(STS.stats.cardKey(c.id, c.lvl, true)) },
        { key: 'count', label: R.count, num: true, value: (c) => c.count, cell: (c) => String(c.count) },
        { key: 'enchant', label: R.enchant, value: (c) => (c.enchant ? name(c.enchant) : ''), cell: (c) => (c.enchant ? name(c.enchant) : '') },
        { key: 'floor', label: R.gotFloor, num: true, value: (c) => c.floor, cell: (c) => (c.floor == null ? T.unknown : String(c.floor)) },
      ], rv.deck, { key: 'floor', dir: 'asc' })),
      el('div', null, el('h3', null, R.relicHeading(rv.relics.length)), sortableTable(`${mode}-rv-relics`, [
        { key: 'relic', label: R.relic, value: (x) => name(x.id), cell: (x) => name(x.id) },
        { key: 'floor', label: R.gotFloor, num: true, value: (x) => x.floor, cell: (x) => (x.floor == null ? T.unknown : String(x.floor)) },
      ], rv.relics, { key: 'floor', dir: 'asc' }))));
    return el('div', null, out);
  }

  // ---- 区間成績
  function trend(mode, entries, f, all) {
    const { el, pct, num1, name, sortableTable, ui, fmtDate } = H();
    const TR = T.trend;
    const out = [];

    // 今かかっている絞り込み
    out.push(el('div', { class: 'filter-summary' },
      el('strong', null, `${TR.filterHeading}：`),
      TR.filterLine({
        char: f.char === 'all' ? T.filters.allChars : name(f.char),
        asc: f.asc === 'all' ? T.filters.all : f.asc,
        ver: f.vMin || f.vMax ? `${f.vMin || T.filters.all} ${T.filters.to} ${f.vMax || T.filters.all}` : T.filters.all,
        ab: f.includeAbandoned ? TR.abIn : TR.abOut,
      }),
      ui.trendNotice[mode] ? el('div', { class: 'note' }, TR.ascNotice) : null));

    // 区間の表
    const size = Number(f.trendSize || 10);
    const blocks = STS.trend.blocks(entries, size);
    const fmtCi = (ci, isRate) => (ci ? TR.ciTitle(...[ci.lo, ci.hi].map((v) => (isRate ? `${(v * 100).toFixed(1)}pt` : v.toFixed(1)))) : '');
    const judgeCell = (j, ci, isRate) => el('span', { class: `judge ${j}`, title: fmtCi(ci, isRate) }, TR.judge[j || 'na']);
    const g0 = (x) => (x == null ? H().DASH : x.toFixed(0));
    const cols = [
      { key: 'block', label: TR.block, num: true, value: (b) => b.index, cell: (b) => `${b.index}${b.complete ? '' : TR.partial}` },
      { key: 'from', label: TR.from, value: (b) => b.from && b.from.getTime(), cell: (b) => fmtDate(b.from) },
      { key: 'to', label: TR.to, value: (b) => b.to && b.to.getTime(), cell: (b) => fmtDate(b.to) },
      { key: 'n', label: T.metrics.n, num: true, value: (b) => b.n, cell: (b) => String(b.n) },
      // 区間の表は「前の区間との差」を読むため、選んでいる指標ではなく区間の順で開く（キーを指標名と別にしている）
      { key: 'blockWinRate', label: TR.winRate, num: true, value: (b) => b.winRate, cell: (b) => `${pct(b.winRate)}（${b.wins}/${b.n}）` },
      { key: 'winJudge', label: `${TR.winRate}：${TR.vsPrev}`, value: (b) => ['down', 'noise', 'na', 'up'].indexOf(b.winJudge || 'na'), cell: (b) => judgeCell(b.winJudge, b.winCi, true) },
      { key: 'blockAvgFloor', label: TR.avgFloor, num: true, value: (b) => b.avgFloor, cell: (b) => num1(b.avgFloor) },
      { key: 'floorJudge', label: `${TR.avgFloor}：${TR.vsPrev}`, value: (b) => ['down', 'noise', 'na', 'up'].indexOf(b.floorJudge || 'na'), cell: (b) => judgeCell(b.floorJudge, b.floorCi, false) },
      { key: 'bossDefeated', label: TR.bossDefeated, num: true, value: (b) => b.bossDefeated, cell: (b) => `${b.bossDefeated}/${b.bossFights}` },
      { key: 'blockBossRate', label: TR.bossRate, num: true, value: (b) => b.bossRate, cell: (b) => pct(b.bossRate) },
      { key: 'holdRate', label: TR.holdRate, num: true, value: (b) => b.holdRate, cell: (b) => (b.holdRate == null ? H().DASH : `${pct(b.holdRate)}（${b.losses}）`) },
      { key: 'goldWin', label: TR.goldWin, num: true, value: (b) => b.goldWin, cell: (b) => g0(b.goldWin) },
      { key: 'goldLoss', label: TR.goldLoss, num: true, value: (b) => b.goldLoss, cell: (b) => g0(b.goldLoss) },
    ];
    out.push(
      el('h3', null, TR.blockHeading),
      el('div', { class: 'options' }, el('span', { class: 'opt-group' }, `${TR.size}：`, [10, 20].map((n) => el('label', { class: 'check' },
        el('input', { type: 'radio', name: `${mode}-trendSize`, checked: size === n, onchange: () => { f.trendSize = n; STS.views.renderTab(mode); } }), ' ', TR.sizeN(n))))),
      el('p', { class: 'note' }, TR.blockNote),
      sortableTable(`${mode}-trend-${size}`, cols, blocks, { key: 'block', dir: 'asc' }),
      el('details', { class: 'how' }, el('summary', null, TR.howHeading), TR.how.map((t) => el('p', { class: 'note' }, t))));

    // 移動平均
    const W = 20;
    const mv = STS.trend.moving(entries, W);
    out.push(el('h3', null, TR.movingHeading(W)));
    if (mv.total < W) {
      out.push(el('p', { class: 'note' }, TR.movingShort(W, mv.total)));
    } else {
      const vlines = mv.versions.map((v) => ({ x: v.x - 0.5, label: v.label, cls: 'version' }));
      out.push(
        el('p', { class: 'note' }, TR.movingNote(W)),
        mv.firstVersion ? el('p', { class: 'note' }, TR.firstVersion(mv.firstVersion)) : null,
        STS.charts.line({ series: [{ label: TR.winRate, cls: 'c1', points: mv.points.map((p) => ({ x: p.x, y: p.winRate })) }],
          xMin: 1, xMax: mv.total, yMin: 0, yMax: Math.max(0.2, ...mv.points.map((p) => p.winRate)), yFormat: (y) => `${Math.round(y * 100)}%`,
          xLabel: TR.runAxis, vlines, ariaLabel: TR.movingHeading(W), height: 280 }),
        STS.charts.line({ series: [{ label: TR.avgFloor, cls: 'c2', points: mv.points.map((p) => ({ x: p.x, y: p.avgFloor })) }],
          xMin: 1, xMax: mv.total, yMin: 0, yMax: 60, xLabel: TR.runAxis, vlines, ariaLabel: TR.avgFloor, height: 280 }),
        el('p', { class: 'note' }, TR.versionList(mv.versions.map((v) => `${v.label}（${v.x}戦目〜）`).join('、'))));
    }
    return el('div', null, out);
  }

  return { review, trend };
})();
