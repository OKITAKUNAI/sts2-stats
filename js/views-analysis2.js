// 第2段階の画面（2回目）：ポーション、イベント。
window.STS = window.STS || {};

STS.aviews2 = (function () {
  const T = STS.T;
  const H = () => STS.views.h;
  const refBadge = () => H().el('span', { class: 'badge', title: T.metrics.refHelp }, T.metrics.ref);
  const withRef = (text, isRef) => (isRef ? H().el('span', null, text, refBadge()) : text);

  // ---- ポーション
  function potions(mode, entries) {
    const { el, pct, num1, name, sortableTable } = H();
    const P = T.potions;
    const a = STS.potions.analyze(entries);
    const isRefHold = (r) => r.lost < 5;
    const holdCols = [
      { key: 'cat', label: P.deathCat, value: (r) => ['all', ...STS.potions.DEATH_CATS].indexOf(r.cat), cell: (r) => P.deathCats[r.cat] },
      { key: 'lost', label: P.lost, num: true, value: (r) => r.lost, cell: (r) => String(r.lost) },
      { key: 'held', label: P.held, num: true, value: (r) => r.held, cell: (r) => String(r.held) },
      { key: 'rate', label: P.rate, num: true, refOf: isRefHold, value: (r) => r.rate, cell: (r) => withRef(pct(r.rate), isRefHold(r)) },
      { key: 'avgHeld', label: P.avgHeld, num: true, value: (r) => r.avgHeld, cell: (r) => (r.avgHeld == null ? H().DASH : r.avgHeld.toFixed(2)) },
    ];
    const per = (x) => (x == null ? H().DASH : x.toFixed(2));
    const catCols = [
      { key: 'cat', label: P.cat, value: (r) => STS.potions.CATS.indexOf(r.cat), cell: (r) => P.cats[r.cat] },
      { key: 'points', label: P.points, num: true, value: (r) => r.points, cell: (r) => String(r.points) },
      { key: 'used', label: P.used, num: true, value: (r) => r.used, cell: (r) => String(r.used) },
      { key: 'usedPer', label: P.usedPer, num: true, value: (r) => r.usedPer, cell: (r) => per(r.usedPer) },
      { key: 'discarded', label: P.discarded, num: true, value: (r) => r.discarded, cell: (r) => String(r.discarded) },
      { key: 'discardedPer', label: P.discardedPer, num: true, value: (r) => r.discardedPer, cell: (r) => per(r.discardedPer) },
    ];
    const potCols = [
      { key: 'name', label: P.potion, value: (r) => name(r.key), cell: (r) => name(r.key) },
      ...STS.potions.CATS.map((c) => ({ key: `u-${c}`, label: P.usedIn(P.cats[c]), num: true, value: (r) => r.used[c], cell: (r) => String(r.used[c]) })),
      ...STS.potions.CATS.map((c) => ({ key: `d-${c}`, label: P.discardedIn(P.cats[c]), num: true, value: (r) => r.discarded[c], cell: (r) => String(r.discarded[c]) })),
      { key: 'held', label: P.heldAtDeath, num: true, value: (r) => r.heldAtDeath, cell: (r) => String(r.heldAtDeath) },
    ];
    return el('div', null,
      el('h3', null, P.holdHeading),
      el('p', { class: 'note' }, P.holdNote),
      sortableTable(`${mode}-pot-hold`, holdCols, a.hold, { key: 'cat', dir: 'asc' }),
      el('h3', null, P.useHeading),
      el('p', { class: 'note' }, P.useNote),
      sortableTable(`${mode}-pot-cat`, catCols, a.byCat, { key: 'cat', dir: 'asc' }),
      el('h3', null, P.potionHeading),
      sortableTable(`${mode}-pot-each`, potCols, a.byPotion, { key: 'u-boss', dir: 'desc' }));
  }

  // ---- イベント
  // 選択肢の表示名：辞書に名前があればそれ、無ければ記録の内部名（最初の段階以外は「段階／選択肢」）
  function optLabel(id) {
    const e = STS.dict.get(id);
    if (e && e.name) return e.name;
    if (id.startsWith('RELIC.')) return STS.dict.name(id);
    const m = id.match(/\.pages\.([^.]+)\.options\.([^.]+)$/);
    if (!m) return STS.dict.shortId(id);
    return m[1] === 'INITIAL' ? m[2] : `${m[1]}／${m[2]}`;
  }
  const pathLabel = (path) => (path ? path.split(' → ').map(optLabel).join(' → ') : T.events.noChoice);

  function events(mode, entries, overall, f) {
    const { el, pct, num1, name, sortableTable, metricColumns, optionRow } = H();
    const E = T.events;
    const list = STS.events.eventTable(entries);
    const isRef = (r) => r.visits < 5;
    const listCols = [
      { key: 'name', label: E.event, value: (r) => name(r.key), cell: (r) => (r.key ? name(r.key) : T.unknown) },
      { key: 'mainAct', label: E.mainAct, num: true, value: (r) => r.mainAct, cell: (r) => (r.mainAct == null ? T.unknown : E.mainActCell(r.mainAct, pct(r.mainActShare))) },
      { key: 'visits', label: E.visits, num: true, value: (r) => r.visits, cell: (r) => String(r.visits) },
      ...metricColumns(overall, (r) => r.m).map((c) => ({ ...c, refOf: isRef })),
      { key: 'actClear', label: E.actClear, num: true, refOf: isRef, value: (r) => r.actClear, cell: (r) => pct(r.actClear) },
    ];

    // 詳しく見るイベント
    const ids = list.filter((r) => r.key).sort((x, y) => y.visits - x.visits).map((r) => r.key);
    if (f.eventId && !ids.includes(f.eventId)) f.eventId = '';
    const picker = el('label', null, `${E.pick} `, el('select', {
      onchange: (ev) => { f.eventId = ev.target.value; STS.views.renderTab(mode); },
    }, el('option', { value: '' }, E.pickNone), ids.map((id) => el('option', { value: id, selected: id === f.eventId }, name(id)))));

    const out = [
      el('h3', null, E.listHeading),
      el('p', { class: 'msg warn' }, E.actWarning),
      el('p', { class: 'note' }, E.listNote),
      sortableTable(`${mode}-events`, listCols, list, { key: 'visits', dir: 'desc' }),
      el('div', { class: 'filters', style: 'margin-top:16px' }, picker),
    ];
    if (!f.eventId) return el('div', null, out);

    // 選択肢の表
    const byPath = f.eventBy !== 'option';
    const rows = STS.events.choiceTable(entries, f.eventId, byPath ? 'path' : 'option');
    const choiceLabel = (r) => (byPath ? pathLabel(r.key) : optLabel(r.key)) + (r.eventThenCombat ? ' ※' : '');
    const refN = (r) => r.n < 5;
    const sign = (x, digits) => (x == null ? H().DASH : `${x > 0 ? '+' : ''}${x.toFixed(digits)}`);
    const cols = [
      { key: 'choice', label: E.choice, value: choiceLabel, cell: choiceLabel },
      { key: 'times', label: E.times, num: true, value: (r) => r.n, cell: (r) => String(r.n) },
      ...metricColumns(overall, (r) => r.m).map((c) => (c.key === 'n' ? { ...c, label: E.runs, refOf: refN } : { ...c, refOf: refN })),
      { key: 'actClear', label: E.actClear, num: true, refOf: refN, value: (r) => r.actClear, cell: (r) => withRef(pct(r.actClear), refN(r)) },
    ];
    if (byPath) {
      STS.events.DELTAS.forEach((k) => cols.push({
        key: `d-${k}`, label: E.d[k], num: true, refOf: refN, value: (r) => r.d[k],
        cell: (r) => sign(r.d[k], ['hp', 'maxHp', 'gold'].includes(k) ? 1 : 2),
      }));
    }
    out.push(
      optionRow(mode, [[E.by, 'eventBy', [['path', E.byPath], ['option', E.byOption]]]]),
      el('p', { class: 'note' }, byPath ? E.pathNote : E.optionNote),
      byPath && el('p', { class: 'note' }, E.deltaNote),
      sortableTable(`${mode}-event-choices-${byPath ? 'path' : 'option'}`, cols, rows, { key: 'times', dir: 'desc' }));

    // HP割合別
    const HP_ORDER = ['low', 'mid', 'high', 'unknown'];
    const hpRows = STS.events.hpTable(entries, f.eventId);
    const hpCols = [
      { key: 'choice', label: E.choice, value: (r) => pathLabel(r.key), cell: (r) => pathLabel(r.key) },
      { key: 'hp', label: E.hp, value: (r) => HP_ORDER.indexOf(r.bucket), cell: (r) => T.boss.hpLabels[r.bucket] },
      { key: 'times', label: E.times, num: true, value: (r) => r.n, cell: (r) => String(r.n) },
      ...metricColumns(overall, (r) => r.m).map((c) => (c.key === 'n' ? { ...c, label: E.runs, refOf: refN } : { ...c, refOf: refN })),
      { key: 'actClear', label: E.actClear, num: true, refOf: refN, value: (r) => r.actClear, cell: (r) => withRef(pct(r.actClear), refN(r)) },
    ];
    out.push(
      el('h3', null, E.hpHeading),
      el('p', { class: 'note' }, E.hpNote),
      sortableTable(`${mode}-event-hp`, hpCols, hpRows, { key: 'times', dir: 'desc' }));
    return el('div', null, out);
  }

  return { potions, events, optLabel };
})();
