// 第2段階：アップグレード（強化）と休憩所の分析。
window.STS = window.STS || {};

STS.upgrades = (function () {
  const arr = (v) => (Array.isArray(v) ? v : []);
  const avg = (xs) => { const v = xs.filter((x) => x != null && !Number.isNaN(x)); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null; };
  const metrics = (list) => STS.stats.metrics(list);
  const SOURCES = ['rest_site', 'event', 'ancient', 'elite', 'treasure', 'monster', 'shop', 'boss'];

  const hpRatioBefore = (e, i) => {
    const prev = i > 0 ? e.run.points[i - 1].stats[e.pi] : null;
    return prev && typeof prev.current_hp === 'number' && prev.max_hp > 0 ? prev.current_hp / prev.max_hp : null;
  };

  // ---- 休憩所に寄った記録
  function restVisits(entries) {
    const out = [];
    for (const e of entries) {
      e.run.points.forEach((p, i) => {
        if (p.type !== 'rest_site') return;
        const s = p.stats[e.pi];
        if (!s) return;
        const act = e.run.acts[p.act - 1];
        out.push({ choices: [...new Set(arr(s.rest_site_choices))], hpRatio: hpRatioBefore(e, i), act: p.act, actCleared: !!(act && act.cleared), entry: e });
      });
    }
    return out;
  }

  // 選択肢ごとの比率と、選んだ時のHP割合
  function restTable(entries) {
    const visits = restVisits(entries);
    const rows = new Map();
    visits.forEach((v) => v.choices.forEach((c) => {
      if (!rows.has(c)) rows.set(c, []);
      rows.get(c).push(v);
    }));
    return {
      visits: visits.length,
      rows: [...rows].map(([key, vs]) => ({
        key, times: vs.length, share: visits.length ? vs.length / visits.length : null,
        avgHp: avg(vs.map((v) => v.hpRatio)),
        actClear: avg(vs.map((v) => (v.actCleared ? 1 : 0))),
      })),
    };
  }

  // HP割合ごとに、選択肢の比率と「その章を突破できた割合」
  function restHpTable(entries) {
    const visits = restVisits(entries);
    const bucketTotal = new Map();
    const rows = new Map();
    visits.forEach((v) => {
      const b = STS.combat.hpBucket(v.hpRatio);
      bucketTotal.set(b, (bucketTotal.get(b) || 0) + 1);
      v.choices.forEach((c) => {
        const k = `${b}\u0000${c}`;
        if (!rows.has(k)) rows.set(k, { bucket: b, key: c, list: [] });
        rows.get(k).list.push(v);
      });
    });
    return [...rows.values()].map((r) => ({
      bucket: r.bucket, key: r.key, times: r.list.length,
      share: r.list.length / bucketTotal.get(r.bucket),
      actClear: avg(r.list.map((v) => (v.actCleared ? 1 : 0))),
    }));
  }

  // ---- カードごとの強化率と、強化あり・なしの成績
  // ラン終了時のデッキにそのカードがあったランが対象。1枚以上強化されていれば「強化あり」
  function cardUpgradeTable(entries) {
    const rows = new Map();
    for (const e of entries) {
      const deck = arr(e.run.players[e.pi].raw && e.run.players[e.pi].raw.deck);
      const state = new Map(); // カード → 強化されたものがあるか
      deck.forEach((c) => { if (c && c.id) state.set(c.id, state.get(c.id) || (c.current_upgrade_level || 0) > 0); });
      for (const [id, up] of state) {
        if (!rows.has(id)) rows.set(id, { key: id, up: [], no: [] });
        rows.get(id)[up ? 'up' : 'no'].push(e);
      }
    }
    return [...rows.values()].map((r) => ({
      key: r.key, owned: r.up.length + r.no.length,
      rate: r.up.length / (r.up.length + r.no.length),
      up: metrics(r.up), no: metrics(r.no),
    }));
  }

  // ---- 最初に強化したカード
  // mode 'smith'：休憩所の鍛冶で最初に強化したカード（既定。ネオーやイベントの強化は自分で選べないことがあるため）
  // mode 'all'：どの入手経路でも、最初に強化されたカード
  function firstUpgradeTable(entries, mode) {
    const rows = new Map();
    let runs = 0;
    for (const e of entries) {
      let first = null;
      for (const p of e.run.points) {
        const s = p.stats[e.pi];
        if (!s || !arr(s.upgraded_cards).length) continue;
        if (mode === 'smith' && !(p.type === 'rest_site' && arr(s.rest_site_choices).includes('SMITH'))) continue;
        first = s.upgraded_cards[0];
        break;
      }
      if (!first) continue;
      runs += 1;
      if (!rows.has(first)) rows.set(first, []);
      rows.get(first).push(e);
    }
    return { runs, rows: [...rows].map(([key, list]) => ({ key, count: list.length, share: list.length / runs, m: metrics(list) })) };
  }

  // ---- 強化の入手経路
  function sourceTable(entries) {
    const counts = new Map(SOURCES.map((s) => [s, 0]));
    let total = 0;
    for (const e of entries) {
      for (const p of e.run.points) {
        const s = p.stats[e.pi];
        const n = s ? arr(s.upgraded_cards).length : 0;
        if (!n) continue;
        const k = SOURCES.includes(p.type) ? p.type : 'other';
        counts.set(k, (counts.get(k) || 0) + n);
        total += n;
      }
    }
    return [...counts].map(([key, n]) => ({ key, n, share: total ? n / total : null, perRun: entries.length ? n / entries.length : null }));
  }

  return { restTable, restHpTable, cardUpgradeTable, firstUpgradeTable, sourceTable, SOURCES };
})();
