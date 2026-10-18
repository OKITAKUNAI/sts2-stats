// 第2段階：エンシェントの選択とエンチャントの分析。
window.STS = window.STS || {};

STS.ancient = (function () {
  const arr = (v) => (Array.isArray(v) ? v : []);
  const metrics = (list) => STS.stats.metrics(list);

  // ancient_choice の選択肢 → レリックのID（キャラ名つき「SEA_GLASS.REGENT」はキャラ部分を除いてまとめる）
  function optionId(x) {
    const key = x && x.title && typeof x.title.key === 'string' ? x.title.key.replace(/\.title$/, '') : (x && x.TextKey) || null;
    return key ? `RELIC.${key.split('.')[0]}` : null;
  }

  // エンシェントごと・選択肢ごとに、提示回数・選んだ回数と、選んだラン・選ばなかったランの成績
  function choiceTable(entries) {
    const rows = new Map();
    for (const e of entries) {
      for (const p of e.run.points) {
        if (p.type !== 'ancient') continue;
        const s = p.stats[e.pi];
        const opts = arr(s && s.ancient_choice);
        if (!opts.length) continue; // ancient_choice の無い古い記録は飛ばす
        const seen = new Map();
        opts.forEach((x) => { const id = optionId(x); if (id) seen.set(id, seen.get(id) || x.was_chosen === true); });
        for (const [id, chosen] of seen) {
          const k = `${p.modelId}\u0000${id}`;
          if (!rows.has(k)) rows.set(k, { ancient: p.modelId, key: id, act: p.act, chosen: [], notChosen: [] });
          rows.get(k)[chosen ? 'chosen' : 'notChosen'].push(e);
        }
      }
    }
    return [...rows.values()].map((r) => ({
      ancient: r.ancient, key: r.key, act: r.act,
      offered: r.chosen.length + r.notChosen.length,
      times: r.chosen.length,
      rate: r.chosen.length / (r.chosen.length + r.notChosen.length),
      chosen: metrics(r.chosen), notChosen: metrics(r.notChosen),
    }));
  }

  // エンチャントの種類ごと：ラン終了時のデッキにそのエンチャントのカードがあったランの成績と、付与された回数
  function enchantTable(entries) {
    const rows = new Map();
    const row = (k) => { if (!rows.has(k)) rows.set(k, { key: k, applied: 0, runs: [] }); return rows.get(k); };
    for (const e of entries) {
      for (const p of e.run.points) {
        const s = p.stats[e.pi];
        arr(s && s.cards_enchanted).forEach((c) => { if (c && c.enchantment) row(c.enchantment).applied += 1; });
      }
      const deck = arr(e.run.players[e.pi].raw && e.run.players[e.pi].raw.deck);
      new Set(deck.map((c) => c && c.enchantment && c.enchantment.id).filter(Boolean)).forEach((k) => row(k).runs.push(e));
    }
    return [...rows.values()].map((r) => ({ key: r.key, applied: r.applied, m: metrics(r.runs) }));
  }

  return { choiceTable, enchantTable, optionId };
})();
