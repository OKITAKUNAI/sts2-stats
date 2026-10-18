// 集計画面（シングル・協力の各タブ）と日本語名辞書の画面。
window.STS = window.STS || {};

STS.views = (function () {
  const T = STS.T;
  const DASH = '—';

  // ---- 小さな道具
  function el(tag, attrs, ...children) {
    const e = document.createElement(tag);
    if (attrs) for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') e.className = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else if (v === true) e.setAttribute(k, '');
      else if (v !== false && v != null) e.setAttribute(k, v);
    }
    for (const c of children.flat(Infinity)) if (c != null && c !== false) e.append(c instanceof Node ? c : String(c));
    return e;
  }
  const pct = (x) => (x == null ? DASH : `${(x * 100).toFixed(1)}%`);
  const num1 = (x) => (x == null ? DASH : x.toFixed(1));
  const fmtDate = (d) => (d ? `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}` : T.unknown);
  function fmtTime(sec) {
    if (sec == null) return T.unknown;
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = Math.floor(sec % 60);
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  const name = (id) => STS.dict.name(id);
  // カードのキー（"CARD.X" や強化済みを分けた "CARD.X+"）を表示名にする
  function cardLabel(key) {
    const i = key.indexOf('+');
    return i < 0 ? name(key) : `${name(key.slice(0, i))}${key.slice(i)}`;
  }

  // ---- 状態（タブごとの絞り込み条件など）
  const defaults = () => ({
    char: 'all', asc: 'all', vMin: '', vMax: '', includeAbandoned: false,
    timeCapOn: true, timeCapHours: 3, sortBy: 'winRate', upgrade: 'merge', own: 'final',
    // 第2段階
    cardView: 'stats', relicView: 'stats', wdAct: 'all',
    sources: ['monster', 'elite', 'boss', 'event', 'ancient'], rewardMode: 'first', rewardAct: '1', eliteAct: '1',
    eventId: '', eventBy: 'path',
    firstUp: 'smith', removalAct: '1', ancientId: 'all', shopKind: 'card',
    starterAct: '1', excludeBane: 'yes',
  });
  const ui = {
    filters: { single: defaults(), coop: defaults() }, sub: { single: 'runs', coop: 'runs' }, sort: {},
    review: { single: null, coop: null }, trendInit: { single: false, coop: false }, trendNotice: { single: false, coop: false },
  };

  // ---- 並べ替えのできる表
  // columns: [{ key, label, value(row) → 並べ替え用の値, cell(row) → 表示, num, refOf(row) → 参考値か, metric }]
  // ・見出しを押すとその列で並べ替え、もう一度押すと昇順・降順が入れ替わる（▲▼で表示）
  // ・最初は、画面で選んでいる指標（ui.metricKey）の列があればその高い順。無ければ defaultSort
  // ・参考値（n<5）の行は、どの列で並べても下にまとめる
  // opts.onRow(row)：行を押したときの動き（ラン一覧から振り返りを開くなど）
  function sortableTable(id, columns, rows, defaultSort, opts = {}) {
    const metricCol = columns.find((c) => (c.metric || c.key) === ui.metricKey);
    const s = ui.sort[id] || (metricCol && { key: metricCol.key, dir: 'desc' }) || defaultSort || { key: columns[0].key, dir: 'desc' };
    const col = columns.find((c) => c.key === s.key) || columns[0];
    const refCol = columns.find((c) => c.refOf);
    const isRef = refCol ? refCol.refOf : null;
    const sorted = [...rows].sort((a, b) => {
      if (isRef) { const ra = !!isRef(a), rb = !!isRef(b); if (ra !== rb) return ra ? 1 : -1; }
      const x = col.value(a), y = col.value(b);
      if (x == null && y == null) return 0;
      if (x == null) return 1;
      if (y == null) return -1;
      const d = typeof x === 'string' ? x.localeCompare(y, 'ja') : x - y;
      return s.dir === 'asc' ? d : -d;
    });
    const wrap = el('div', { class: 'table-wrap' });
    // CSVで書き出す（今の並び順のまま。private の列＝SteamIDやニックネームは含めない）
    const csvCols = columns.filter((c) => !c.private && (c.csvLabel ?? c.label) !== '');
    wrap.append(el('div', { class: 'table-tools' }, el('button', {
      type: 'button', class: 'btn small',
      onclick: () => STS.csv.download(`${id}-${STS.csv.today()}.csv`, [
        csvCols.map((c) => c.csvLabel ?? c.label),
        ...sorted.map((r, i) => csvCols.map((c) => (c.csv ? c.csv(r, i) : STS.csv.textOf(c.cell(r))))),
      ]),
    }, T.csv.tableButton)));
    const table = el('table', { class: 'data' });
    table.append(el('thead', null, el('tr', null, columns.map((c) => el('th', {
      class: `${c.num ? 'num' : ''} sortable`,
      'aria-sort': c.key === s.key ? (s.dir === 'asc' ? 'ascending' : 'descending') : null,
      onclick: () => {
        ui.sort[id] = { key: c.key, dir: c.key === s.key && s.dir === 'desc' ? 'asc' : 'desc' };
        wrap.replaceWith(sortableTable(id, columns, rows, defaultSort, opts));
      },
    }, c.label, c.key === s.key ? (s.dir === 'asc' ? ' ▲' : ' ▼') : '')))));
    const tbody = el('tbody');
    sorted.forEach((r) => tbody.append(el('tr', opts.onRow ? { class: 'clickable', tabindex: '0', title: opts.rowTitle || null,
      onclick: () => opts.onRow(r), onkeydown: (ev) => { if (ev.key === 'Enter') opts.onRow(r); } } : null,
    columns.map((c) => el('td', { class: c.num ? 'num' : '' }, c.cell(r))))));
    table.append(tbody);
    wrap.append(table);
    return wrap;
  }

  // 4つの指標の列（勝率には n と全体との差を併記し、n<5 は参考値）
  function metricColumns(overall, get) {
    const M = T.metrics;
    const refOf = (r) => get(r).n < 5;
    return withRef(refOf, [
      { key: 'n', label: M.n, num: true, value: (r) => get(r).n, cell: (r) => String(get(r).n) },
      {
        key: 'winRate', label: M.winRate, num: true, value: (r) => get(r).winRate,
        cell: (r) => winCell(get(r), overall),
      },
      { key: 'avgFloor', label: M.avgFloor, num: true, value: (r) => get(r).avgFloor, cell: (r) => num1(get(r).avgFloor) },
      { key: 'actClear', label: M.actClear, num: true, value: (r) => get(r).actClear, cell: (r) => pct(get(r).actClear) },
      { key: 'bossRate', label: M.bossRate, num: true, value: (r) => get(r).bossRate, cell: (r) => pct(get(r).bossRate) },
    ]);
  }
  const withRef = (refOf, cols) => cols.map((c) => ({ ...c, refOf }));
  function winCell(m, overall) {
    if (m.winRate == null) return DASH;
    const parts = [pct(m.winRate)];
    if (overall && overall.winRate != null) {
      const d = (m.winRate - overall.winRate) * 100;
      parts.push(el('span', { class: 'sub' }, ` ${d >= 0 ? '+' : ''}${d.toFixed(1)}${T.metrics.pt}`));
    }
    if (m.n < 5) parts.push(el('span', { class: 'badge', title: T.metrics.refHelp }, T.metrics.ref));
    return el('span', null, parts);
  }

  // ---- 絞り込み欄
  function filterBar(mode, allEntries, rerender) {
    const f = ui.filters[mode];
    const F = T.filters;
    const set = (k, v) => { f[k] = v; rerender(); };
    const select = (value, options, onchange) => el('select', { onchange: (ev) => onchange(ev.target.value) },
      options.map(([v, label]) => el('option', { value: v, selected: v === value }, label)));

    const chars = [...new Set(allEntries.map((e) => e.character).filter(Boolean))].sort();
    const ascs = [...new Set(allEntries.map((e) => e.run.ascension).filter((x) => x != null))].sort((a, b) => a - b);
    const versions = STS.stats.versionsOf(allEntries);
    const metricsOpts = ['winRate', 'avgFloor', 'actClear', 'bossRate', 'n'].map((k) => [k, T.metrics[k]]);

    return el('div', { class: 'card filters' },
      el('label', null, F.char, ' ', select(f.char, [['all', F.allChars], ...chars.map((c) => [c, name(c)])], (v) => set('char', v))),
      el('label', null, F.asc, ' ', select(f.asc, [['all', F.all], ...ascs.map((a) => [String(a), String(a)])], (v) => set('asc', v))),
      el('label', null, F.version, ' ',
        select(f.vMin, [['', F.all], ...versions.map((v) => [v, v])], (v) => set('vMin', v)), ` ${F.to} `,
        select(f.vMax, [['', F.all], ...versions.map((v) => [v, v])], (v) => set('vMax', v))),
      el('label', null, F.sortBy, ' ', select(f.sortBy, metricsOpts, (v) => { ui.sort = {}; set('sortBy', v); })),
      el('label', { class: 'check' }, el('input', { type: 'checkbox', checked: f.includeAbandoned, onchange: (ev) => set('includeAbandoned', ev.target.checked) }), ' ', F.abandoned),
      el('label', { class: 'check' },
        el('input', { type: 'checkbox', checked: f.timeCapOn, onchange: (ev) => set('timeCapOn', ev.target.checked) }), ' ',
        F.timeCap(f.timeCapHours), ' ',
        el('input', { type: 'number', min: '0.5', step: '0.5', value: String(f.timeCapHours), class: 'short', 'aria-label': F.timeCapHours,
          onchange: (ev) => { const h = Number(ev.target.value); if (h > 0) set('timeCapHours', h); } })),
    );
  }

  // ---- 全体の成績
  function summaryCard(entries, overall, f) {
    const S = T.summary;
    const capSec = f.timeCapHours * 3600;
    const times = entries.map((e) => e.run.runTime).filter((t) => t != null);
    const kept = f.timeCapOn ? times.filter((t) => t <= capSec) : times;
    const m = overall;
    return el('div', { class: 'card' },
      el('h2', null, S.heading),
      el('div', { class: 'kpis' },
        kpi(T.metrics.n, String(m.n)),
        kpi(T.metrics.winRate, `${pct(m.winRate)}`, `${m.wins} / ${m.n}`),
        kpi(T.metrics.avgFloor, num1(m.avgFloor)),
        kpi(T.metrics.actClear, pct(m.actClear)),
        kpi(T.metrics.bossRate, pct(m.bossRate)),
      ),
      el('p', { class: 'note' }, m.perAct.map((a, i) => S.actRow(i + 1, a.entered, a.cleared, pct(a.entered ? a.cleared / a.entered : null))).join(' ／ ')),
      el('p', { class: 'note' }, S.medianTime(fmtTime(STS.stats.median(kept)), times.length - kept.length)),
      el('p', { class: 'note' }, S.defs),
      el('p', { class: 'note' }, S.correlation),
    );
  }
  const kpi = (label, value, sub) => el('div', { class: 'kpi' }, el('div', { class: 'kpi-label' }, label), el('div', { class: 'kpi-value' }, value), sub && el('div', { class: 'kpi-sub' }, sub));

  // ---- サブ画面：ラン一覧
  function runsView(mode, listEntries, f) {
    const R = T.runs;
    const capSec = f.timeCapHours * 3600;
    const cols = [
      { key: 'date', label: R.date, value: (e) => e.run.startTime, cell: (e) => fmtDate(e.run.date) },
      { key: 'char', label: R.char, value: (e) => name(e.character), cell: (e) => name(e.character) },
      { key: 'asc', label: R.asc, num: true, value: (e) => e.run.ascension, cell: (e) => (e.run.ascension == null ? T.unknown : String(e.run.ascension)) },
      { key: 'result', label: R.result, value: (e) => (e.run.win ? 2 : e.run.abandoned ? 0 : 1),
        cell: (e) => el('span', { class: e.run.win ? 'win' : e.run.abandoned ? 'muted' : '' }, e.run.win ? R.win : e.run.abandoned ? R.abandoned : R.loss) },
      { key: 'floor', label: R.floor, num: true, value: (e) => e.run.floorReached, cell: (e) => (e.run.floorReached == null ? T.unknown : String(e.run.floorReached)) },
      { key: 'death', label: R.death, value: (e) => (e.run.death ? name(e.run.death.id) : ''),
        cell: (e) => (e.run.win ? '' : e.run.death ? name(e.run.death.id) : T.unknown) },
      { key: 'time', label: R.time, num: true, value: (e) => e.run.runTime,
        cell: (e) => fmtTime(e.run.runTime) + (f.timeCapOn && e.run.runTime > capSec ? R.overCap : '') },
    ];
    // 達成した縛りチャレンジ（★）
    if (STS.challenges.all().some((ch) => STS.challenges.inScope(ch, mode))) {
      const achieved = (e) => STS.challenges.achievedBy(e, mode).map((ch) => ch.name).join('、');
      cols.push({ key: 'challenges', label: T.challenges.column, value: achieved,
        cell: (e) => { const t = achieved(e); return t ? el('span', { class: 'star' }, `${T.challenges.mainMark} ${t}`) : ''; } });
    }
    if (mode === 'coop') {
      cols.push({ key: 'partners', label: R.partners, value: (e) => partnerText(e), cell: (e) => partnerText(e),
        csv: (e) => e.run.players.filter((_, i) => i !== e.pi).map((p) => name(p.character)).join('・') }); // CSVにはIDやニックネームを入れない
    }
    return el('div', null,
      el('p', { class: 'note' }, R.note),
      el('p', { class: 'note' }, T.review.openHint),
      sortableTable(`${mode}-runs`, cols, listEntries, { key: 'date', dir: 'desc' }, {
        rowTitle: T.review.openHint,
        onRow: (e) => { ui.review[mode] = e.run.key; ui.sub[mode] = 'review'; renderTab(mode); window.scrollTo({ top: 0 }); },
      }));
  }
  function partnerText(e) {
    return e.run.players.filter((_, i) => i !== e.pi).map((p) => `${STS.coop.label(p.id)}（${name(p.character)}）`).join('、');
  }

  // ---- サブ画面：カード別
  function cardsView(mode, entries, overall, f) {
    const C = T.cards;
    const F = T.filters;
    const viewRow = optionRow(mode, [[T.windeck.show, 'cardView', [['stats', T.windeck.showStats], ['windeck', T.windeck.showWin]]]]);
    if (f.cardView === 'windeck') return el('div', null, viewRow, STS.aviews.winDeck(mode, entries, f, 'card'));
    const rows = STS.stats.cardTable(entries, { upgrade: f.upgrade, own: f.own });
    const cols = [
      { key: 'name', label: C.name, value: (r) => cardLabel(r.key), cell: (r) => cardLabel(r.key) },
      { key: 'offered', label: C.offered, num: true, value: (r) => r.offered, cell: (r) => String(r.offered) },
      { key: 'pickRate', label: C.pickRate, num: true, value: (r) => r.pickRate, cell: (r) => pct(r.pickRate) },
      { key: 'skipRate', label: C.skipRate, num: true, value: (r) => r.skipRate, cell: (r) => pct(r.skipRate) },
      ...metricColumns(overall, (r) => r.m).map((c) => (c.key === 'n' ? { ...c, label: `${C.owned}（n）` } : c)),
    ];
    return el('div', null,
      viewRow,
      optionRow(mode, [
        [F.upgrade, 'upgrade', [['merge', F.upgradeMerge], ['split', F.upgradeSplit]]],
        [F.own, 'own', [['final', F.ownFinal], ['ever', F.ownEver]]],
      ]),
      el('p', { class: 'note' }, C.note),
      el('p', { class: 'note' }, T.table.sortHelp),
      sortableTable(`${mode}-cards`, cols, rows, { key: f.sortBy, dir: 'desc' }));
  }

  // ---- サブ画面：レリック別
  function relicsView(mode, entries, overall, f) {
    const F = T.filters;
    const viewRow = optionRow(mode, [[T.windeck.show, 'relicView', [['stats', T.windeck.showStats], ['windeck', T.windeck.showWin]]]]);
    if (f.relicView === 'windeck') return el('div', null, viewRow, STS.aviews.winDeck(mode, entries, f, 'relic'));
    const rows = STS.stats.relicTable(entries, { own: f.own });
    const cols = [
      { key: 'name', label: T.relics.name, value: (r) => name(r.key), cell: (r) => name(r.key) },
      ...metricColumns(overall, (r) => r.m),
    ];
    return el('div', null,
      viewRow,
      optionRow(mode, [[F.own, 'own', [['final', F.ownFinal], ['ever', F.ownEver]]]]),
      el('p', { class: 'note' }, T.relics.note),
      el('p', { class: 'note' }, T.table.sortHelp),
      sortableTable(`${mode}-relics`, cols, rows, { key: f.sortBy, dir: 'desc' }));
  }

  // ---- サブ画面：死因・到達階層
  function deathsView(mode, entries) {
    const D = T.deaths;
    const dt = STS.stats.deathTable(entries);
    const cols = [
      { key: 'cause', label: D.cause, value: (r) => (r.key ? name(r.key) : ''), cell: (r) => (r.key ? name(r.key) : D.unknownCause) },
      { key: 'kind', label: D.kind, value: (r) => r.kind || '', cell: (r) => (r.kind === 'event' ? D.event : r.kind === 'encounter' ? D.encounter : T.unknown) },
      { key: 'count', label: D.count, num: true, value: (r) => r.count, cell: (r) => String(r.count) },
      { key: 'share', label: D.share, num: true, value: (r) => r.share, cell: (r) => pct(r.share) },
      { key: 'avgFloor', label: D.avgFloor, num: true, value: (r) => r.avgFloor, cell: (r) => num1(r.avgFloor) },
      { key: 'act', label: D.act, num: true, value: (r) => r.act, cell: (r) => (r.act == null ? T.unknown : String(r.act)) },
    ];
    const dist = STS.stats.floorDistribution(entries);
    const max = Math.max(1, ...dist.map((d) => d.runs));
    const distTable = sortableTable(`${mode}-floors`, [
      { key: 'floor', label: D.floor, num: true, value: (d) => d.floor, cell: (d) => String(d.floor) },
      { key: 'runs', label: D.ended, num: true, value: (d) => d.runs, cell: (d) => String(d.runs) },
      { key: 'wins', label: D.wins, num: true, value: (d) => d.wins, cell: (d) => String(d.wins) },
      { key: 'bar', label: '', value: (d) => d.runs, cell: (d) => el('span', { class: 'bar', style: `width:${(d.runs / max) * 100}%` }) },
    ], dist, { key: 'floor', dir: 'asc' });
    return el('div', null,
      el('h3', null, D.heading),
      el('p', { class: 'note' }, D.eventNote),
      sortableTable(`${mode}-deaths`, cols, dt.rows, { key: 'count', dir: 'desc' }),
      el('h3', null, D.floorHeading),
      distTable);
  }

  // カード・レリック画面の切り替え（強化済みの扱い、持っていたランの数え方）
  function optionRow(mode, groups) {
    const f = ui.filters[mode];
    return el('div', { class: 'options' }, groups.map(([label, key, opts]) => el('span', { class: 'opt-group' }, `${label}：`,
      opts.map(([v, text]) => el('label', { class: 'check' },
        el('input', { type: 'radio', name: `${mode}-${key}`, value: v, checked: f[key] === v,
          onchange: () => { f[key] = v; renderTab(mode); } }), ' ', text)))));
  }

  // ---- タブ全体
  function renderTab(mode) {
    const panel = document.getElementById(`panel-${mode}`);
    const st = STS.state;
    panel.replaceChildren();
    if (mode === 'coop' && !st.selfId && st.runs.some((r) => r.mode === 'coop')) {
      panel.append(el('div', { class: 'card' }, el('p', { class: 'msg warn' }, T.summary.needSelf)));
      return;
    }
    const all = STS.stats.entriesFor(st.runs, mode, st.selfId);
    const f = ui.filters[mode];
    // 区間成績を初めて開いたときは、アセンション10に絞った状態にする
    if (ui.sub[mode] === 'trend' && !ui.trendInit[mode]) {
      ui.trendInit[mode] = true;
      if (f.asc === 'all' && all.some((e) => e.run.ascension === 10)) { f.asc = '10'; ui.trendNotice[mode] = true; }
    }
    ui.metricKey = f.sortBy; // 表を最初に並べる指標
    const rerender = () => renderTab(mode);
    panel.append(filterBar(mode, all, rerender));
    const entries = STS.stats.applyFilters(all, f, false);
    const listEntries = STS.stats.applyFilters(all, f, true);
    if (!listEntries.length) {
      panel.append(el('div', { class: 'card' }, el('p', null, T.summary.noRuns)));
      return;
    }
    const overall = STS.stats.metrics(entries);
    panel.append(summaryCard(entries, overall, f));

    const subs = ['runs', 'review', 'trend', 'records', 'challenges', ...(mode === 'coop' ? ['team'] : []),
      'cards', 'relics', 'deaths', 'rewards', 'combat', 'boss', 'potions', 'events', 'upgrades', 'shop', 'ancient', 'deck'];
    const cur = ui.sub[mode];
    panel.append(el('nav', { class: 'subtabs' }, subs.map((s) => el('button', {
      type: 'button', 'aria-selected': String(s === cur), onclick: () => { ui.sub[mode] = s; rerender(); },
    }, T.sub[s]))));
    const body = el('div', { class: 'card' });
    if (cur === 'runs') body.append(runsView(mode, listEntries, f));
    else if (cur === 'cards') body.append(cardsView(mode, entries, overall, f));
    else if (cur === 'relics') body.append(relicsView(mode, entries, overall, f));
    else if (cur === 'deaths') body.append(deathsView(mode, entries));
    else if (cur === 'review') body.append(STS.s3views.review(mode, listEntries));
    else if (cur === 'trend') body.append(STS.s3views.trend(mode, entries, f, all));
    else if (cur === 'records') body.append(STS.s3b.records(mode, all, f));
    else if (cur === 'challenges') body.append(STS.s3b.challenges(mode, all));
    else if (cur === 'team') body.append(STS.s3b.team(mode, entries, overall));
    else if (cur === 'deck') body.append(STS.s4views.deck(mode, entries, overall, f));
    else body.append(STS.aviews.render(cur, mode, entries, overall, f));
    panel.append(body);
  }

  // ---- 日本語名辞書
  const dictUi = { cat: 'CARD', onlyMissing: true, q: '' };
  const DICT_LIMIT = 300;

  function renderDict() {
    const D = T.dict;
    ui.metricKey = null;
    const panel = document.getElementById('panel-dict');
    const runs = STS.state.runs;
    const counts = STS.dict.collectIds(runs);
    const cands = STS.dict.candidates(runs);
    panel.replaceChildren();

    const fileInput = el('input', { type: 'file', accept: '.json,application/json', hidden: true,
      onchange: async (ev) => {
        const file = ev.target.files[0]; ev.target.value = '';
        if (!file) return;
        try { msg.textContent = D.imported(STS.dict.importJson(await file.text())); msg.className = 'msg ok'; renderDict(); STS.renderAll(); }
        catch (e) { msg.textContent = D.importFailed; msg.className = 'msg error'; }
      } });
    const msg = el('p', { class: 'msg' });
    panel.append(el('div', { class: 'card' },
      el('h2', null, D.heading),
      el('p', { class: 'note' }, D.help),
      el('p', { class: 'note' }, D.kindHelp),
      el('div', { class: 'btn-row' },
        el('button', { type: 'button', class: 'btn', onclick: () => downloadText('sts2-dictionary.json', STS.dict.exportJson()) }, D.exportBtn),
        el('button', { type: 'button', class: 'btn', onclick: () => fileInput.click() }, D.importBtn),
        fileInput),
      msg));

    // 自動候補
    const pending = [...cands].filter(([id]) => !(STS.dict.get(id) && STS.dict.get(id).name) && STS.dict.category(id) === dictUi.cat);
    const candCard = el('div', { class: 'card' }, el('h3', null, D.candHeading), el('p', { class: 'note' }, D.candHelp));
    if (!pending.length) candCard.append(el('p', { class: 'note' }, D.noCand));
    else {
      candCard.append(el('div', { class: 'btn-row' }, el('button', {
        type: 'button', class: 'btn',
        onclick: () => {
          if (!confirm(D.registerAllConfirm(pending.length))) return;
          pending.forEach(([id, c]) => STS.dict.set(id, { name: c.name }));
          renderDict(); STS.renderAll();
        },
      }, D.registerAll(pending.length))));
      candCard.append(sortableTable('dict-cand', [
        { key: 'id', label: D.id, value: ([id]) => id, cell: ([id]) => el('code', null, id) },
        { key: 'name', label: D.candidate, value: ([, c]) => c.name, cell: ([, c]) => c.name },
        { key: 'votes', label: D.votes, num: true, value: ([, c]) => c.total, cell: ([, c]) => D.candVotes(c.agree, c.total) },
        { key: 'act', label: '', value: () => 0, cell: ([id, c]) => el('button', { type: 'button', class: 'btn', onclick: () => { STS.dict.set(id, { name: c.name }); renderDict(); STS.renderAll(); } }, D.register) },
      ], pending, { key: 'votes', dir: 'desc' }));
    }

    // 一覧
    const catOpts = Object.entries(D.cats);
    const all = [...counts].filter(([id]) => STS.dict.category(id) === dictUi.cat);
    const q = dictUi.q.trim().toLowerCase();
    const shown = all.filter(([id]) => {
      const e = STS.dict.get(id);
      if (dictUi.onlyMissing && e && e.name) return false;
      if (q && !id.toLowerCase().includes(q) && !(e && e.name && e.name.toLowerCase().includes(q))) return false;
      return true;
    }).sort((a, b) => b[1] - a[1]);
    const registered = all.filter(([id]) => STS.dict.get(id) && STS.dict.get(id).name).length;

    const listCard = el('div', { class: 'card' },
      el('div', { class: 'filters' },
        el('label', null, D.category, ' ', el('select', { onchange: (ev) => { dictUi.cat = ev.target.value; renderDict(); } },
          catOpts.map(([k, label]) => el('option', { value: k, selected: k === dictUi.cat }, label)))),
        el('label', { class: 'check' }, el('input', { type: 'checkbox', checked: dictUi.onlyMissing, onchange: (ev) => { dictUi.onlyMissing = ev.target.checked; renderDict(); } }), ' ', D.onlyMissing),
        el('label', null, D.search, ' ', el('input', { type: 'search', value: dictUi.q, onchange: (ev) => { dictUi.q = ev.target.value; renderDict(); } })),
      ),
      el('p', { class: 'note' }, `${D.stats(registered, all.length)} ／ ${D.shown(Math.min(shown.length, DICT_LIMIT), shown.length)}`),
      shown.length > DICT_LIMIT && el('p', { class: 'msg warn' }, D.limit(DICT_LIMIT)));
    const isCard = dictUi.cat === 'CARD';
    const entryOf = (id) => STS.dict.get(id) || {};
    const listCols = [
      { key: 'id', label: D.id, value: ([id]) => id, cell: ([id]) => el('code', null, id) },
      { key: 'count', label: D.count, num: true, value: ([, n]) => n, cell: ([, n]) => String(n) },
      { key: 'name', label: D.jaName, value: ([id]) => entryOf(id).name || '', cell: ([id]) => el('input', {
        type: 'text', value: entryOf(id).name || '', 'aria-label': `${id} ${D.jaName}`,
        onchange: (ev) => { STS.dict.set(id, { name: ev.target.value.trim() }); STS.renderAll(); } }) },
    ];
    if (isCard) listCols.push({ key: 'kind', label: D.kind, value: ([id]) => entryOf(id).kind || '', cell: ([id]) => el('select', {
      onchange: (ev) => { STS.dict.set(id, { kind: ev.target.value }); } },
      D.kinds.map((k) => el('option', { value: k, selected: k === (entryOf(id).kind || '') }, k || DASH))) });
    listCols.push({ key: 'cand', label: D.candidate, value: ([id]) => (cands.get(id) ? cands.get(id).name : ''), cell: ([id]) => {
      const c = cands.get(id);
      return c && !entryOf(id).name ? el('button', { type: 'button', class: 'btn small', title: D.candVotes(c.agree, c.total),
        onclick: () => { STS.dict.set(id, { name: c.name }); renderDict(); STS.renderAll(); } }, `${D.useCandidate}：${c.name}`) : '';
    } });
    listCard.append(sortableTable('dict-list', listCols, shown.slice(0, DICT_LIMIT), { key: 'count', dir: 'desc' }));
    panel.append(candCard, listCard);
  }

  function downloadText(filename, text) {
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const a = el('a', { href: url, download: filename });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // 第2段階の画面（views-analysis.js）から使う部品
  const h = { el, pct, num1, name, cardLabel, sortableTable, metricColumns, winCell, optionRow, ui, DASH, fmtDate, fmtTime };

  return { renderTab, renderDict, h };
})();
