// 第3段階の画面（2回目）：記録、縛りチャレンジ、チーム・相方（協力のみ）。
window.STS = window.STS || {};

STS.s3b = (function () {
  const T = STS.T;
  const H = () => STS.views.h;
  const openReview = (mode, e) => {
    H().ui.review[mode] = e.run.key;
    H().ui.sub[mode] = 'review';
    STS.views.renderTab(mode);
    window.scrollTo({ top: 0 });
  };

  // ---- 記録
  function records(mode, all, f) {
    const { el, name, sortableTable, fmtDate, fmtTime } = H();
    const R = T.records;
    const base = STS.stats.applyFilters(all, { ...f, char: 'all', includeAbandoned: true }, false);
    const rows = STS.records.table(base);
    const link = (e, text) => (e ? el('a', { href: '#', onclick: (ev) => { ev.preventDefault(); openReview(mode, e); } }, text) : H().DASH);
    const cols = [
      { key: 'char', label: R.char, value: (r) => (r.char === 'all' ? '' : name(r.char)), cell: (r) => (r.char === 'all' ? el('strong', null, T.filters.allChars) : name(r.char)) },
      { key: 'runs', label: R.runs, num: true, value: (r) => r.runs, cell: (r) => String(r.runs) },
      { key: 'wins', label: R.wins, num: true, value: (r) => r.wins, cell: (r) => String(r.wins) },
      { key: 'longest', label: R.longest, num: true, value: (r) => r.longest.len,
        cell: (r) => (r.longest.len ? link(r.longest.to, R.streak(r.longest.len, fmtDate(r.longest.from.run.date), fmtDate(r.longest.to.run.date))) : '0') },
      { key: 'current', label: R.current, num: true, value: (r) => r.current, cell: (r) => String(r.current) },
      { key: 'fastest', label: R.fastest, num: true, value: (r) => (r.fastest ? r.fastest.run.runTime : null),
        cell: (r) => (r.fastest ? link(r.fastest, `${fmtTime(r.fastest.run.runTime)}${R.on(fmtDate(r.fastest.run.date))}`) : H().DASH) },
      { key: 'minDeck', label: R.minDeck, num: true, value: (r) => (r.minDeck ? r.minDeck.size : null),
        cell: (r) => (r.minDeck ? link(r.minDeck.entry, `${R.cards(r.minDeck.size)}${R.on(fmtDate(r.minDeck.entry.run.date))}`) : H().DASH) },
      { key: 'maxFloor', label: R.maxFloor, num: true, value: (r) => (r.maxFloor ? r.maxFloor.run.floorReached : null),
        cell: (r) => (r.maxFloor ? link(r.maxFloor, `${R.floor(r.maxFloor.run.floorReached, r.maxFloor.run.win)}${R.on(fmtDate(r.maxFloor.run.date))}`) : H().DASH) },
    ];
    return el('div', null, el('p', { class: 'note' }, R.note), sortableTable(`${mode}-records`, cols, rows, { key: 'runs', dir: 'desc' }));
  }

  // ---- 縛りチャレンジ
  const form = { single: null, coop: null }; // 編集中の内容
  const openRuns = new Set();
  let idCache = { n: -1, card: [], relic: [] };
  function idOptions() {
    const runs = STS.state.runs;
    if (idCache.n !== runs.length) {
      const ids = [...STS.dict.collectIds(runs).keys()];
      idCache = { n: runs.length, card: ids.filter((id) => id.startsWith('CARD.')).sort(), relic: ids.filter((id) => id.startsWith('RELIC.')).sort() };
    }
    return idCache;
  }
  const emptyForm = (mode) => ({ id: null, name: '', desc: '', scope: mode, manual: false, conds: [] });

  function condText(c) {
    const C = T.challenges;
    const t = STS.challenges.TEMPLATES[c.type];
    if (!t) return T.unknown;
    const vals = t.params.map((p) => (p.kind === 'number' ? c[p.key] : STS.dict.name(c[p.key])));
    return `${C.templates[c.type]}${vals.length ? `：${vals.join('、')}` : ''}${STS.challenges.validCond(c) ? '' : C.invalid}`;
  }

  function challengeForm(mode, all) {
    const { el } = H();
    const C = T.challenges;
    const st = form[mode] || (form[mode] = emptyForm(mode));
    const rerender = () => STS.views.renderTab(mode);
    const ids = idOptions();
    const chars = [...new Set(all.map((e) => e.character).filter(Boolean))].sort();
    const condRow = (c, i) => {
      const t = STS.challenges.TEMPLATES[c.type];
      const inputs = t.params.map((p) => {
        if (p.kind === 'number') return el('input', { type: 'number', class: 'short', value: c[p.key] ?? '', oninput: (ev) => { c[p.key] = ev.target.value; } });
        if (p.kind === 'char') {
          if (!c[p.key] && chars[0]) c[p.key] = chars[0];
          return el('select', { onchange: (ev) => { c[p.key] = ev.target.value; } }, chars.map((ch) => el('option', { value: ch, selected: ch === c[p.key] }, STS.dict.name(ch))));
        }
        return el('input', { type: 'text', list: `${mode}-ids-${p.kind}`, value: c[p.key] || '', placeholder: C.idPlaceholder[p.kind], oninput: (ev) => { c[p.key] = ev.target.value.trim(); } });
      });
      return el('div', { class: 'cond-row' },
        el('select', { onchange: (ev) => { st.conds[i] = { type: ev.target.value }; rerender(); } },
          Object.keys(STS.challenges.TEMPLATES).map((k) => el('option', { value: k, selected: k === c.type }, C.templates[k]))),
        inputs,
        el('button', { type: 'button', class: 'btn small', onclick: () => { st.conds.splice(i, 1); rerender(); } }, C.removeCond));
    };
    const msg = el('span', { class: 'msg error' });
    return el('div', { class: 'card' },
      el('h3', null, st.id ? C.formEdit : C.formNew),
      el('datalist', { id: `${mode}-ids-card` }, ids.card.map((id) => el('option', { value: id }, STS.dict.name(id)))),
      el('datalist', { id: `${mode}-ids-relic` }, ids.relic.map((id) => el('option', { value: id }, STS.dict.name(id)))),
      el('label', { class: 'field' }, C.name, el('input', { type: 'text', value: st.name, oninput: (ev) => { st.name = ev.target.value; } })),
      el('label', { class: 'field' }, C.desc, el('textarea', { rows: '2', oninput: (ev) => { st.desc = ev.target.value; } }, st.desc)),
      el('div', { class: 'filters' },
        el('label', null, `${C.scope} `, el('select', { onchange: (ev) => { st.scope = ev.target.value; } },
          Object.entries(C.scopes).map(([k, v]) => el('option', { value: k, selected: k === st.scope }, v)))),
        el('label', { class: 'check' }, el('input', { type: 'checkbox', checked: st.manual, onchange: (ev) => { st.manual = ev.target.checked; } }), ' ', C.manual)),
      el('p', null, el('strong', null, C.conds)),
      st.conds.length ? st.conds.map(condRow) : el('p', { class: 'note' }, C.noCond),
      el('p', { class: 'note' }, C.idHelp),
      el('div', { class: 'btn-row' },
        el('button', { type: 'button', class: 'btn', onclick: () => { st.conds.push({ type: 'win' }); rerender(); } }, C.addCond),
        el('button', { type: 'button', class: 'btn primary', onclick: async () => {
          if (!st.name.trim()) { msg.textContent = C.nameRequired; return; }
          await STS.challenges.upsert({ ...st, name: st.name.trim(), conds: st.conds.map((c) => ({ ...c })) });
          form[mode] = null;
          STS.renderAll();
        } }, C.save),
        st.id && el('button', { type: 'button', class: 'btn', onclick: () => { form[mode] = null; rerender(); } }, C.cancel),
        msg));
  }

  function challenges(mode, all) {
    const { el, name, sortableTable, fmtDate } = H();
    const C = T.challenges;
    const list = STS.challenges.all().filter((ch) => STS.challenges.inScope(ch, mode));
    const out = [el('p', { class: 'note' }, C.note), challengeForm(mode, all), el('h3', null, C.listHeading)];
    if (!list.length) out.push(el('p', { class: 'note' }, C.none));
    for (const ch of list) {
      const cand = all.filter((e) => STS.challenges.autoOk(ch, e));
      const done = all.filter((e) => STS.challenges.achieved(ch, e));
      const open = openRuns.has(`${mode}:${ch.id}`);
      const card = el('div', { class: 'card challenge' },
        el('div', { class: 'challenge-head' },
          el('strong', null, `${C.mainMark} ${ch.name}`),
          el('span', { class: 'badge' }, ch.manual ? C.needsManual : C.autoOnly),
          el('span', { class: 'sub' }, C.scopes[ch.scope])),
        ch.desc ? el('p', null, ch.desc) : null,
        el('ul', { class: 'compact' }, ch.conds.length ? ch.conds.map((c) => el('li', null, condText(c))) : el('li', null, C.noCond)),
        el('p', null, C.achievedCount(done.length, all.length)),
        el('div', { class: 'btn-row' },
          el('button', { type: 'button', class: 'btn small', onclick: () => { const k = `${mode}:${ch.id}`; if (open) openRuns.delete(k); else openRuns.add(k); STS.views.renderTab(mode); } }, open ? C.hideRuns : C.showRuns),
          el('button', { type: 'button', class: 'btn small', onclick: () => { form[mode] = JSON.parse(JSON.stringify(ch)); STS.views.renderTab(mode); window.scrollTo({ top: 0 }); } }, C.edit),
          el('button', { type: 'button', class: 'btn small danger', onclick: async () => {
            if (!confirm(C.removeConfirm(ch.name))) return;
            await STS.challenges.remove(ch.id);
            STS.renderAll();
          } }, C.remove)));
      if (open) {
        const rows = ch.manual ? cand : done;
        const cols = [
          { key: 'date', label: T.runs.date, value: (e) => e.run.startTime, cell: (e) => el('a', { href: '#', onclick: (ev) => { ev.preventDefault(); openReview(mode, e); } }, fmtDate(e.run.date)) },
          { key: 'char', label: T.runs.char, value: (e) => name(e.character), cell: (e) => name(e.character) },
          { key: 'asc', label: T.runs.asc, num: true, value: (e) => e.run.ascension, cell: (e) => String(e.run.ascension ?? T.unknown) },
          { key: 'result', label: T.runs.result, value: (e) => (e.run.win ? 1 : 0), cell: (e) => (e.run.win ? T.runs.win : e.run.abandoned ? T.runs.abandoned : T.runs.loss) },
          { key: 'floor', label: T.runs.floor, num: true, value: (e) => e.run.floorReached, cell: (e) => String(e.run.floorReached ?? T.unknown) },
        ];
        if (ch.manual) {
          cols.unshift({ key: 'mark', label: C.mark, value: (e) => (STS.challenges.isMarked(ch.id, e.run.key) ? 1 : 0),
            cell: (e) => el('input', { type: 'checkbox', checked: STS.challenges.isMarked(ch.id, e.run.key), 'aria-label': C.mark,
              onchange: async (ev) => { await STS.challenges.toggleMark(ch.id, e.run.key, ev.target.checked); STS.renderAll(); } }) });
          card.append(el('p', { class: 'note' }, C.manualHelp));
        }
        card.append(sortableTable(`${mode}-ch-${ch.id}`, cols, rows, { key: 'date', dir: 'desc' }));
      }
      out.push(card);
    }
    return el('div', null, out);
  }

  // ---- チーム・相方（協力のみ）
  function team(mode, entries, overall) {
    const { el, name, sortableTable, metricColumns, fmtDate } = H();
    const TM = T.team;
    const sizeRows = STS.coop.bySize(entries);
    const comboRows = STS.coop.combos(entries);
    const partnerRows = STS.coop.byPartner(entries);
    return el('div', null,
      el('p', { class: 'note' }, TM.teamNote),
      el('h3', null, TM.sizeHeading),
      sortableTable(`${mode}-team-size`, [
        { key: 'size', label: TM.size, num: true, value: (r) => r.size, cell: (r) => TM.sizeN(r.size) },
        ...metricColumns(overall, (r) => r.m),
      ], sizeRows, { key: 'size', dir: 'asc' }),
      el('h3', null, TM.comboHeading),
      sortableTable(`${mode}-team-combo`, [
        { key: 'mine', label: TM.mine, value: (r) => name(r.mine), cell: (r) => name(r.mine) },
        { key: 'others', label: TM.others, value: (r) => r.others.map(name).join('・'), cell: (r) => r.others.map(name).join('・') },
        ...metricColumns(overall, (r) => r.m),
      ], comboRows, { key: 'n', dir: 'desc' }),
      el('h3', null, TM.partnerHeading),
      el('p', { class: 'note' }, TM.partnerNote),
      sortableTable(`${mode}-team-partner`, [
        { key: 'partner', label: TM.partner, value: (r) => STS.coop.label(r.id), cell: (r) => STS.maskId(r.id), csv: (r, i) => T.csv.partnerN(i + 1) },
        { key: 'nick', label: TM.nickname, private: true, value: (r) => STS.coop.nickname(r.id),
          cell: (r) => el('input', { type: 'text', value: STS.coop.nickname(r.id), 'aria-label': TM.nickname,
            onchange: async (ev) => { await STS.coop.setNickname(r.id, ev.target.value); STS.renderAll(); } }) },
        { key: 'chars', label: TM.partnerChars, value: (r) => r.chars.map(name).join('・'), cell: (r) => r.chars.map(name).join('・') },
        ...metricColumns(overall, (r) => r.m),
        { key: 'last', label: TM.last, value: (r) => (r.last ? r.last.getTime() : null), cell: (r) => fmtDate(r.last) },
      ], partnerRows, { key: 'n', dir: 'desc' }));
  }

  return { records, challenges, team };
})();
