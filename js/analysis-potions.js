// 第2段階：ポーションの分析。
window.STS = window.STS || {};

STS.potions = (function () {
  const CATS = ['boss', 'elite', 'monster', 'other']; // other = 戦闘以外のマス
  const DEATH_CATS = ['boss', 'elite', 'monster', 'event'];
  const arr = (v) => (Array.isArray(v) ? v : []);

  // マスの分類（？マスの戦闘とイベントから入った戦闘は通常戦）
  function catOf(p) {
    if (!p.isCombat) return 'other';
    if (p.type === 'elite') return 'elite';
    if (p.type === 'boss') return 'boss';
    return 'monster';
  }

  // 負けた場所の分類（イベント戦闘で負けた場合は「イベント」）
  function deathCat(e) {
    if (e.run.death && e.run.death.kind === 'event') return 'event';
    const last = e.run.points[e.run.points.length - 1];
    if (!last) return null;
    const c = catOf(last);
    return c === 'other' ? null : c;
  }

  function analyze(entries) {
    const byCat = Object.fromEntries(CATS.map((c) => [c, { cat: c, points: 0, used: 0, discarded: 0 }]));
    const byPotion = new Map();
    const pot = (id) => {
      if (!byPotion.has(id)) byPotion.set(id, { key: id, used: { boss: 0, elite: 0, monster: 0, other: 0 }, discarded: { boss: 0, elite: 0, monster: 0, other: 0 }, heldAtDeath: 0 });
      return byPotion.get(id);
    };
    const hold = Object.fromEntries(['all', ...DEATH_CATS].map((c) => [c, { cat: c, lost: 0, held: 0, potionSum: 0 }]));

    for (const e of entries) {
      for (const p of e.run.points) {
        const s = p.stats[e.pi];
        if (!s) continue;
        const c = catOf(p);
        byCat[c].points += 1;
        arr(s.potion_used).forEach((id) => { byCat[c].used += 1; pot(id).used[c] += 1; });
        arr(s.potion_discarded).forEach((id) => { byCat[c].discarded += 1; pot(id).discarded[c] += 1; });
      }
      // 抱え死に：放棄を除く敗北ランで、終了時に未使用のポーションを持っていたか
      if (!e.run.win && !e.run.abandoned) {
        const held = arr(e.run.players[e.pi].raw && e.run.players[e.pi].raw.potions).filter((x) => x && x.id);
        const dc = deathCat(e);
        for (const k of ['all', dc]) {
          if (!k || !hold[k]) continue;
          hold[k].lost += 1;
          hold[k].potionSum += held.length;
          if (held.length) hold[k].held += 1;
        }
        new Set(held.map((x) => x.id)).forEach((id) => { pot(id).heldAtDeath += 1; });
      }
    }
    return {
      hold: ['all', ...DEATH_CATS].map((k) => ({ ...hold[k], rate: hold[k].lost ? hold[k].held / hold[k].lost : null, avgHeld: hold[k].lost ? hold[k].potionSum / hold[k].lost : null })),
      byCat: CATS.map((c) => ({ ...byCat[c], usedPer: byCat[c].points ? byCat[c].used / byCat[c].points : null, discardedPer: byCat[c].points ? byCat[c].discarded / byCat[c].points : null })),
      byPotion: [...byPotion.values()],
    };
  }

  return { analyze, CATS, DEATH_CATS };
})();
