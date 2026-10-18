// 第3段階：1ラン分の振り返りデータ。
window.STS = window.STS || {};

STS.review = (function () {
  const arr = (v) => (Array.isArray(v) ? v : []);

  // e: { run, pi }（pi = 振り返る本人）
  function build(e) {
    const run = e.run;
    const pts = run.points;

    // 全員のHP推移（シングルは1人）
    const hp = run.players.map((pl, k) => ({
      id: pl.id, character: pl.character, self: k === e.pi,
      points: pts.map((p) => {
        const s = p.stats[k];
        return { x: p.floor, hp: s && typeof s.current_hp === 'number' ? s.current_hp : null, maxHp: s && typeof s.max_hp === 'number' ? s.max_hp : null };
      }),
    }));
    const actStarts = run.acts.filter((a) => a.entered).map((a) => ({ act: a.act, floor: (pts.find((p) => p.act === a.act) || {}).floor })).filter((a) => a.floor);
    const marks = pts.filter((p) => p.type === 'elite' || p.type === 'boss').map((p) => ({ floor: p.floor, kind: p.type, id: p.combatModelId }));
    const last = pts[pts.length - 1];
    const deathFloor = !run.win && !run.abandoned && last ? last.floor : null;

    const rec = STS.combat.records(e);
    const worst = [...rec.combats].filter((c) => c.damage != null).sort((a, b) => b.damage - a.damage || b.floor - a.floor).slice(0, 3);

    // 戦闘ごとの被ダメージ（協力では全員分）
    const combatsAll = pts.filter((p) => p.isCombat).map((p) => ({
      floor: p.floor, id: p.combatModelId, kind: p.type === 'elite' ? 'elite' : p.type === 'boss' ? 'boss' : 'monster',
      eventThenCombat: p.eventThenCombat,
      damage: run.players.map((_, k) => (p.stats[k] && typeof p.stats[k].damage_taken === 'number' ? p.stats[k].damage_taken : null)),
    }));

    // カード報酬の流れ（戦闘・イベント・エンシェント）
    const rewards = STS.stats.view(e).offers.map((o) => ({
      floor: o.floor, source: o.source,
      cards: o.cards,
      picked: o.cards.filter((c) => c.picked),
    }));

    const raw = run.players[e.pi].raw || {};
    const deckMap = new Map();
    arr(raw.deck).forEach((c) => {
      if (!c || !c.id) return;
      const k = `${c.id}|${c.current_upgrade_level || 0}|${(c.enchantment && c.enchantment.id) || ''}`;
      if (!deckMap.has(k)) deckMap.set(k, { id: c.id, lvl: c.current_upgrade_level || 0, enchant: c.enchantment ? c.enchantment.id : null, count: 0, floor: c.floor_added_to_deck });
      deckMap.get(k).count += 1;
    });
    const endStats = last ? last.stats[e.pi] : null;
    return {
      run, pi: e.pi,
      hp, actStarts, marks, deathFloor,
      worst,
      bosses: rec.bosses,
      combatsAll,
      rewards,
      deck: [...deckMap.values()],
      deckSize: arr(raw.deck).length,
      relics: arr(raw.relics).filter((x) => x && x.id).map((x) => ({ id: x.id, floor: x.floor_added_to_deck })),
      potions: arr(raw.potions).filter((x) => x && x.id).map((x) => x.id),
      endGold: endStats && typeof endStats.current_gold === 'number' ? endStats.current_gold : null,
    };
  }

  return { build };
})();
