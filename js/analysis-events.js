// 第2段階：イベントの分析（エンシェントは含めない）。
window.STS = window.STS || {};

STS.events = (function () {
  const cache = new WeakMap();
  const arr = (v) => (Array.isArray(v) ? v : []);
  const avg = (xs) => { const v = xs.filter((x) => x != null && !Number.isNaN(x)); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null; };
  const DELTAS = ['hp', 'maxHp', 'gold', 'add', 'remove', 'upgrade', 'downgrade', 'transform'];

  // 選択肢のID。events の項目は「イベント名.pages.段階.options.選択肢」、
  // relics の項目（EVENT.DOLL_ROOM など）はレリック名なので RELIC.〜 にする
  function optionId(ec) {
    const key = ec && ec.title && typeof ec.title.key === 'string' ? ec.title.key.replace(/\.title$/, '') : null;
    if (!key) return null;
    if (ec.title.table === 'relics') return `RELIC.${key.split('.')[0]}`;
    return `EVENTOPT.${key}`;
  }

  // 1エントリ分のイベント訪問の記録
  function visits(e) {
    let byPi = cache.get(e.run);
    if (!byPi) { byPi = new Map(); cache.set(e.run, byPi); }
    if (byPi.has(e.pi)) return byPi.get(e.pi);
    const pts = e.run.points;
    const out = [];
    pts.forEach((p, i) => {
      if (p.type !== 'event') return; // エンシェントは type が ancient なので入らない
      const s = p.stats[e.pi];
      if (!s) return;
      const prev = i > 0 ? pts[i - 1].stats[e.pi] : null;
      const options = arr(s.event_choices).map(optionId).filter(Boolean);
      const hpPrev = prev && typeof prev.current_hp === 'number' ? prev.current_hp : null;
      const goldPrev = prev && typeof prev.current_gold === 'number' ? prev.current_gold : null;
      const act = e.run.acts[p.act - 1];
      out.push({
        eventId: p.modelId,
        act: p.act,
        floor: p.floor,
        options,
        path: options.join(' → '),
        hpRatio: hpPrev != null && prev.max_hp > 0 ? hpPrev / prev.max_hp : null,
        actCleared: !!(act && act.cleared),
        eventThenCombat: p.eventThenCombat,
        d: {
          hp: hpPrev != null ? s.current_hp - hpPrev : (s.hp_healed || 0) - (s.damage_taken || 0),
          maxHp: (s.max_hp_gained || 0) - (s.max_hp_lost || 0),
          gold: goldPrev != null ? s.current_gold - goldPrev : (s.gold_gained || 0) - (s.gold_spent || 0) - (s.gold_lost || 0) - (s.gold_stolen || 0),
          add: arr(s.cards_gained).length,
          remove: arr(s.cards_removed).length,
          upgrade: arr(s.upgraded_cards).length,
          downgrade: arr(s.downgraded_cards).length,
          transform: arr(s.cards_transformed).length,
        },
        entry: e,
      });
    });
    byPi.set(e.pi, out);
    return out;
  }

  const allVisits = (entries) => entries.flatMap((e) => visits(e));

  // ---- イベント一覧（訪れたランの成績と、主に出る章）
  function eventTable(entries) {
    const rows = new Map();
    for (const v of allVisits(entries)) {
      const k = v.eventId || '__unknown__';
      if (!rows.has(k)) rows.set(k, { key: v.eventId, list: [] });
      rows.get(k).list.push(v);
    }
    return [...rows.values()].map((r) => {
      const acts = new Map();
      r.list.forEach((v) => acts.set(v.act, (acts.get(v.act) || 0) + 1));
      const top = [...acts].sort((a, b) => b[1] - a[1])[0];
      return {
        key: r.key,
        visits: r.list.length,
        mainAct: top ? top[0] : null,
        mainActShare: top ? top[1] / r.list.length : null,
        m: STS.stats.metrics([...new Set(r.list.map((v) => v.entry))]),
        actClear: avg(r.list.map((v) => (v.actCleared ? 1 : 0))),
      };
    });
  }

  // ---- 1つのイベントの選択肢
  // by: 'path'（選択の並び。収支つき）または 'option'（各段階の選択肢。収支なし）
  function choiceTable(entries, eventId, by) {
    const list = allVisits(entries).filter((v) => v.eventId === eventId);
    const groups = new Map();
    for (const v of list) {
      const keys = by === 'option' ? [...new Set(v.options)] : [v.path];
      for (const k of keys) {
        if (!groups.has(k)) groups.set(k, []);
        groups.get(k).push(v);
      }
    }
    return [...groups].map(([key, vs]) => summarize(key, vs, by === 'path'));
  }

  // 選んだ時のHP割合別（選択の並びごと）
  function hpTable(entries, eventId) {
    const list = allVisits(entries).filter((v) => v.eventId === eventId);
    const groups = new Map();
    for (const v of list) {
      const b = STS.combat.hpBucket(v.hpRatio);
      const k = `${v.path}\u0000${b}`;
      if (!groups.has(k)) groups.set(k, { path: v.path, bucket: b, list: [] });
      groups.get(k).list.push(v);
    }
    return [...groups.values()].map((g) => ({ ...summarize(g.path, g.list, false), bucket: g.bucket }));
  }

  function summarize(key, vs, withDeltas) {
    const out = {
      key,
      n: vs.length,
      m: STS.stats.metrics([...new Set(vs.map((v) => v.entry))]),
      actClear: avg(vs.map((v) => (v.actCleared ? 1 : 0))),
      eventThenCombat: vs.some((v) => v.eventThenCombat),
    };
    if (withDeltas) out.d = Object.fromEntries(DELTAS.map((k) => [k, avg(vs.map((v) => v.d[k]))]));
    return out;
  }

  return { visits, eventTable, choiceTable, hpTable, optionId, DELTAS };
})();
