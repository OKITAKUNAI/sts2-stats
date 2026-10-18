// 第2段階：戦闘・エリート数・ボスの分析。
window.STS = window.STS || {};

STS.combat = (function () {
  const cache = new WeakMap();
  const metrics = (list) => STS.stats.metrics(list);
  const avg = (xs) => { const v = xs.filter((x) => x != null && !Number.isNaN(x)); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null; };
  const arr = (v) => (Array.isArray(v) ? v : []);

  // 1エントリ分の戦闘・ボスの記録（計算結果は覚えておく）
  function records(e) {
    let byPi = cache.get(e.run);
    if (!byPi) { byPi = new Map(); cache.set(e.run, byPi); }
    if (byPi.has(e.pi)) return byPi.get(e.pi);

    const pts = e.run.points;
    const ps = (i) => (pts[i] && pts[i].stats[e.pi]) || null;
    const last = pts.length - 1;
    const lostRun = !e.run.win && !e.run.abandoned;

    // 各マスが終わった時点のデッキ枚数を、ラン終了時のデッキから逆算する
    // （そのマス以降の入手・削除を差し引く。変化は枚数が変わらない）
    const deckAfter = new Array(pts.length).fill(null);
    const finalDeck = arr(e.run.players[e.pi].raw && e.run.players[e.pi].raw.deck).length;
    let size = finalDeck;
    for (let i = last; i >= 0; i--) {
      deckAfter[i] = size;
      const s = ps(i);
      if (s) size -= arr(s.cards_gained).length - arr(s.cards_removed).length;
    }

    const combats = [];
    const bosses = [];
    pts.forEach((p, i) => {
      if (!p.isCombat) return;
      const s = ps(i);
      if (!s) return;
      const prev = i > 0 ? ps(i - 1) : null;
      const maxHpStart = prev && prev.max_hp > 0 ? prev.max_hp : s.max_hp > 0 ? s.max_hp : null;
      const hpStart = prev && typeof prev.current_hp === 'number' ? prev.current_hp : null;
      const rooms = arr(p.raw && p.raw.rooms);
      const kind = p.type === 'elite' ? 'elite' : p.type === 'boss' ? 'boss' : 'monster';
      const rec = {
        index: i,
        floor: p.floor,
        act: p.act,
        id: p.combatModelId,
        kind,
        damage: typeof s.damage_taken === 'number' ? s.damage_taken : null,
        maxHpStart,
        hpStart,
        hpRatioStart: hpStart != null && maxHpStart ? hpStart / maxHpStart : null,
        turns: rooms.length ? rooms[rooms.length - 1].turns_taken ?? null : null,
        lost: lostRun && i === last, // この戦闘で負けた（放棄は負けに数えない）
        eventThenCombat: p.eventThenCombat,
      };
      combats.push(rec);
      if (kind === 'boss') {
        const prevPoint = i > 0 ? pts[i - 1] : null;
        bosses.push({
          ...rec,
          defeated: i < last || e.run.win === true,
          deckStart: i > 0 ? deckAfter[i - 1] : null,
          goldStart: prev && typeof prev.current_gold === 'number' ? prev.current_gold : null,
          prevChoice: prevChoiceOf(prevPoint, prev),
          orderInAct: bosses.filter((b) => b.act === p.act).length + 1, // 3章の2連戦なら2
        });
      }
    });
    const out = { combats, bosses };
    byPi.set(e.pi, out);
    return out;
  }

  // ボスの直前のマスでの選択
  function prevChoiceOf(p, s) {
    if (!p) return { key: 'none' };
    if (p.type === 'boss' || p.mapType === 'boss') return { key: 'boss' }; // 3章2連戦の2体目
    if (p.type === 'rest_site') {
      const ch = arr(s && s.rest_site_choices).slice().sort();
      return { key: ch.length ? `rest:${ch.join('+')}` : 'rest:', rest: ch };
    }
    return { key: p.type || 'unknown' };
  }

  // ---- 敵（戦闘）ごと
  function encounterTable(entries) {
    const rows = new Map();
    for (const e of entries) {
      for (const c of records(e).combats) {
        const k = c.id || '__unknown__';
        if (!rows.has(k)) rows.set(k, { key: c.id, kinds: new Map(), list: [] });
        const r = rows.get(k);
        r.kinds.set(c.kind, (r.kinds.get(c.kind) || 0) + 1);
        r.list.push(c);
      }
    }
    return [...rows.values()].map((r) => ({
      key: r.key,
      kind: [...r.kinds].sort((a, b) => b[1] - a[1])[0][0],
      fights: r.list.length,
      avgDamage: avg(r.list.map((c) => c.damage)),
      avgDamageRatio: avg(r.list.map((c) => (c.damage != null && c.maxHpStart ? c.damage / c.maxHpStart : null))),
      avgTurns: avg(r.list.map((c) => c.turns)),
      lossRate: r.list.length ? r.list.filter((c) => c.lost).length / r.list.length : null,
      eventThenCombat: r.list.some((c) => c.eventThenCombat),
    }));
  }

  // ---- 敗北ランで最もHPを削られた戦闘（ランごとに1つ）
  function worstInLosses(entries) {
    const rows = new Map();
    let runs = 0;
    for (const e of entries) {
      if (e.run.win || e.run.abandoned) continue;
      const cs = records(e).combats.filter((c) => c.damage != null);
      if (!cs.length) continue;
      runs += 1;
      // 同じ被ダメージなら後の戦闘を選ぶ
      const worst = cs.reduce((a, b) => (b.damage >= a.damage ? b : a));
      const k = worst.id || '__unknown__';
      if (!rows.has(k)) rows.set(k, { key: worst.id, kind: worst.kind, list: [] });
      rows.get(k).list.push(worst);
    }
    return {
      runs,
      rows: [...rows.values()].map((r) => ({
        key: r.key, kind: r.kind,
        count: r.list.length,
        share: runs ? r.list.length / runs : null,
        avgDamage: avg(r.list.map((c) => c.damage)),
        avgDamageRatio: avg(r.list.map((c) => (c.maxHpStart ? c.damage / c.maxHpStart : null))),
      })),
    };
  }

  const eliteBucket = (n) => (n >= 4 ? '4+' : String(n));
  const ELITE_BUCKETS = ['0', '1', '2', '3', '4+'];

  // ---- エリート数と成績
  // 1章・2章：その章のボスを全員倒したランだけを対象に、その章のエリート数ごとの最終成績
  // 3章：3章のボスに挑んだランを対象に、1体目のボス開始時のHP割合とボス撃破率
  function eliteTable(entries, act) {
    const groups = new Map(ELITE_BUCKETS.map((b) => [b, []]));
    for (const e of entries) {
      const a = e.run.acts[act - 1];
      if (!a || !a.entered) continue;
      if (act < 3 ? !a.cleared : a.bosses.length === 0) continue;
      const elites = e.run.points.filter((p) => p.act === act && p.type === 'elite').length;
      groups.get(eliteBucket(elites)).push(e);
    }
    return ELITE_BUCKETS.map((b) => {
      const list = groups.get(b);
      if (act < 3) return { bucket: b, m: metrics(list) };
      const bs = list.flatMap((e) => records(e).bosses.filter((x) => x.act === 3));
      return {
        bucket: b,
        n: list.length,
        firstBossHp: avg(list.map((e) => { const f = records(e).bosses.find((x) => x.act === 3); return f ? f.hpRatioStart : null; })),
        bossRate: bs.length ? bs.filter((x) => x.defeated).length / bs.length : null,
        bossFights: bs.length,
      };
    });
  }

  // ---- ボス
  function bossFights(entries) {
    return entries.flatMap((e) => records(e).bosses);
  }
  function hpBucket(r) {
    if (r == null) return 'unknown';
    if (r < 0.5) return 'low';
    if (r < 0.8) return 'mid';
    return 'high';
  }
  function groupBosses(fights, keyOf) {
    const m = new Map();
    fights.forEach((f) => { const k = keyOf(f); if (!m.has(k)) m.set(k, []); m.get(k).push(f); });
    return [...m].map(([key, list]) => ({
      key,
      sample: list[0],
      n: list.length,
      defeated: list.filter((f) => f.defeated).length,
      rate: list.filter((f) => f.defeated).length / list.length,
      avgHp: avg(list.map((f) => f.hpRatioStart)),
      avgDeck: avg(list.map((f) => f.deckStart)),
      avgDamage: avg(list.map((f) => f.damage)),
    }));
  }

  return { records, encounterTable, worstInLosses, eliteTable, bossFights, groupBosses, hpBucket, ELITE_BUCKETS };
})();
