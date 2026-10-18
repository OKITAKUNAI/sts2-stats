// 第2段階：ショップとゴールドの分析。
// 購入の判定（シングルと協力で記録方法が違うため3つの和）：
//   was_picked が true ／ bought_ 系に載っている ／ そのマスの cards_gained に載っている
window.STS = window.STS || {};

STS.shop = (function () {
  const cache = new WeakMap();
  const arr = (v) => (Array.isArray(v) ? v : []);
  const avg = (xs) => { const v = xs.filter((x) => x != null && !Number.isNaN(x)); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null; };
  const median = (xs) => STS.stats.median(xs.filter((x) => x != null));
  const metrics = (list) => STS.stats.metrics(list);
  const KINDS = ['card', 'relic', 'potion'];

  // 1エントリ分の来店記録
  function visits(e) {
    let byPi = cache.get(e.run);
    if (!byPi) { byPi = new Map(); cache.set(e.run, byPi); }
    if (byPi.has(e.pi)) return byPi.get(e.pi);
    const out = [];
    e.run.points.forEach((p, i) => {
      if (p.type !== 'shop') return; // ？マスのショップも type が shop になる
      const s = p.stats[e.pi];
      if (!s) return;
      const prev = i > 0 ? e.run.points[i - 1].stats[e.pi] : null;

      // 無色カードは cards_gained にも出るので、カードの購入から1枚ずつ除く
      const colorless = arr(s.bought_colorless).slice();
      const gainedCards = [];
      const rest = colorless.slice();
      arr(s.cards_gained).forEach((c) => {
        const j = rest.indexOf(c && c.id);
        if (j >= 0) rest.splice(j, 1); else if (c && c.id) gainedCards.push(c.id);
      });
      const cardShown = new Set([...arr(s.card_choices).map((c) => c && c.card && c.card.id).filter(Boolean), ...gainedCards]);
      const cardBought = new Set([...arr(s.card_choices).filter((c) => c && c.was_picked).map((c) => c.card.id), ...gainedCards]);
      const relicShown = new Set([...arr(s.relic_choices).map((c) => c && c.choice).filter(Boolean), ...arr(s.bought_relics)]);
      const relicBought = new Set([...arr(s.relic_choices).filter((c) => c && c.was_picked).map((c) => c.choice), ...arr(s.bought_relics)]);
      const potionShown = new Set([...arr(s.potion_choices).map((c) => c && c.choice).filter(Boolean), ...arr(s.bought_potions)]);
      const potionBought = new Set([...arr(s.potion_choices).filter((c) => c && c.was_picked).map((c) => c.choice), ...arr(s.bought_potions)]);
      const removed = arr(s.cards_removed).map((c) => c && c.id).filter(Boolean);
      const gold = prev && typeof prev.current_gold === 'number' ? prev.current_gold : null;
      const spent = (s.gold_spent || 0) + (s.gold_lost || 0);
      out.push({
        act: p.act, floor: p.floor, gold, spent,
        shown: { card: cardShown, relic: relicShown, potion: potionShown },
        bought: { card: cardBought, relic: relicBought, potion: potionBought },
        colorless, removed,
        boughtAny: cardBought.size + relicBought.size + potionBought.size + colorless.length + removed.length > 0,
        entry: e,
      });
    });
    byPi.set(e.pi, out);
    return out;
  }

  // ---- 商品ごとの購入率と、最初に並んだ場面で買ったラン・買わなかったランの比較
  function itemTable(entries, kind) {
    const rows = new Map();
    const row = (k) => { if (!rows.has(k)) rows.set(k, { key: k, shown: 0, bought: 0, took: [], notTook: [] }); return rows.get(k); };
    for (const e of entries) {
      const first = new Map();
      for (const v of visits(e)) {
        for (const k of v.shown[kind]) {
          const r = row(k);
          r.shown += 1;
          const b = v.bought[kind].has(k);
          if (b) r.bought += 1;
          if (!first.has(k)) first.set(k, b);
        }
      }
      for (const [k, b] of first) row(k)[b ? 'took' : 'notTook'].push(e);
    }
    return [...rows.values()].map((r) => ({
      key: r.key, shown: r.shown, bought: r.bought, rate: r.shown ? r.bought / r.shown : null,
      took: metrics(r.took), notTook: metrics(r.notTook),
    }));
  }

  // 無色カード：並んでいた記録が無いので購入数だけ
  function colorlessTable(entries) {
    const rows = new Map();
    for (const e of entries) {
      const runSet = new Set();
      for (const v of visits(e)) v.colorless.forEach((id) => {
        if (!rows.has(id)) rows.set(id, { key: id, bought: 0, runs: [] });
        rows.get(id).bought += 1;
        runSet.add(id);
      });
      runSet.forEach((id) => rows.get(id).runs.push(e));
    }
    return [...rows.values()].map((r) => ({ key: r.key, bought: r.bought, m: metrics(r.runs) }));
  }

  // ---- カード削除（エリート数と同じ考え方）
  const REMOVAL_BUCKETS = ['0', '1', '2+'];
  function removalTable(entries, act) {
    const groups = new Map(REMOVAL_BUCKETS.map((b) => [b, []]));
    for (const e of entries) {
      const a = e.run.acts[act - 1];
      if (!a || !a.entered) continue;
      if (act < 3 ? !a.cleared : a.bosses.length === 0) continue;
      const n = visits(e).filter((v) => v.act === act).reduce((s, v) => s + v.removed.length, 0);
      groups.get(n >= 2 ? '2+' : String(n)).push(e);
    }
    return REMOVAL_BUCKETS.map((b) => {
      const list = groups.get(b);
      if (act < 3) return { bucket: b, m: metrics(list) };
      const bs = list.flatMap((e) => STS.combat.records(e).bosses.filter((x) => x.act === 3));
      return { bucket: b, n: list.length, bossFights: bs.length, bossRate: bs.length ? bs.filter((x) => x.defeated).length / bs.length : null };
    });
  }
  function removedCards(entries) {
    const m = new Map();
    entries.forEach((e) => visits(e).forEach((v) => v.removed.forEach((id) => m.set(id, (m.get(id) || 0) + 1))));
    return [...m].map(([key, count]) => ({ key, count }));
  }

  // ---- 入店時の所持金と使った割合（章ごと）
  function goldTable(entries) {
    const byAct = new Map();
    entries.forEach((e) => visits(e).forEach((v) => {
      if (!byAct.has(v.act)) byAct.set(v.act, []);
      byAct.get(v.act).push(v);
    }));
    return [...byAct].sort((a, b) => a[0] - b[0]).map(([act, vs]) => ({
      act, visits: vs.length,
      avgGold: avg(vs.map((v) => v.gold)),
      avgSpent: avg(vs.map((v) => v.spent)),
      avgRatio: avg(vs.map((v) => (v.gold > 0 ? Math.min(1, v.spent / v.gold) : null))),
      noBuy: vs.filter((v) => !v.boughtAny).length / vs.length,
    }));
  }

  // ---- 余らせゴールド：ラン終了時の所持金（勝ち・負け別。放棄は除く）
  function leftoverTable(entries) {
    const g = { win: [], loss: [] };
    for (const e of entries) {
      if (e.run.abandoned) continue;
      const last = e.run.points[e.run.points.length - 1];
      const s = last && last.stats[e.pi];
      if (!s || typeof s.current_gold !== 'number') continue;
      g[e.run.win ? 'win' : 'loss'].push(s.current_gold);
    }
    return ['win', 'loss'].map((k) => ({ key: k, n: g[k].length, avg: avg(g[k]), median: median(g[k]) }));
  }

  // 章ごとのボス戦開始時の所持金（倒したか・負けたか別）
  // 負けたランは途中で終わるため、終了時の所持金だけでは比べられない
  function bossGoldTable(entries) {
    const groups = new Map();
    for (const e of entries) {
      for (const b of STS.combat.records(e).bosses) {
        if (!b.defeated && e.run.abandoned) continue; // 放棄は「負け」に入れない
        const k = `${b.act}-${b.defeated ? 'win' : 'loss'}`;
        if (!groups.has(k)) groups.set(k, { act: b.act, result: b.defeated ? 'win' : 'loss', golds: [] });
        if (b.goldStart != null) groups.get(k).golds.push(b.goldStart);
      }
    }
    return [...groups.values()].map((g) => ({ act: g.act, result: g.result, n: g.golds.length, avg: avg(g.golds), median: median(g.golds) }));
  }

  return { visits, itemTable, colorlessTable, removalTable, removedCards, goldTable, leftoverTable, bossGoldTable, KINDS, REMOVAL_BUCKETS };
})();
