// 集計。
// 「エントリ」＝ 1ラン × 集計対象のプレイヤー（シングルは本人、協力は「自分」）。
window.STS = window.STS || {};

STS.stats = (function () {
  const REWARD_TYPES = ['monster', 'elite', 'boss', 'event', 'ancient'];
  const viewCache = new WeakMap();

  // ---- エントリを作る
  function entriesFor(runs, mode, selfId) {
    const out = [];
    for (const run of runs) {
      if (run.mode !== mode) continue;
      const pi = mode === 'single' ? 0 : run.players.findIndex((p) => p.id === selfId);
      if (pi < 0) continue;
      out.push({ run, pi, character: run.players[pi].character });
    }
    return out;
  }

  function versionsOf(entries) {
    return [...new Set(entries.map((e) => e.run.buildId).filter(Boolean))].sort(STS.normalize.compareVersion);
  }

  // f: 絞り込み条件。forList=true のときは放棄の扱いを無視する（ラン一覧用）
  function applyFilters(entries, f, forList) {
    const cmp = STS.normalize.compareVersion;
    return entries.filter((e) => {
      const r = e.run;
      if (f.char !== 'all' && e.character !== f.char) return false;
      if (f.asc !== 'all' && String(r.ascension) !== f.asc) return false;
      if (f.vMin && r.buildId && cmp(r.buildId, f.vMin) < 0) return false;
      if (f.vMax && r.buildId && cmp(r.buildId, f.vMax) > 0) return false;
      if (!forList && r.abandoned && !f.includeAbandoned) return false;
      return true;
    });
  }

  // ---- 指標
  function metrics(entries) {
    const n = entries.length;
    let wins = 0, floorSum = 0, floorN = 0, actIn = 0, actOut = 0, bossIn = 0, bossOut = 0;
    const perAct = [1, 2, 3].map(() => ({ entered: 0, cleared: 0 }));
    for (const { run } of entries) {
      if (run.win) wins += 1;
      if (run.floorReached != null) { floorSum += run.floorReached; floorN += 1; }
      run.acts.forEach((a, i) => {
        if (!a.entered) return;
        actIn += 1; if (a.cleared) actOut += 1;
        if (perAct[i]) { perAct[i].entered += 1; if (a.cleared) perAct[i].cleared += 1; }
        a.bosses.forEach((b) => { bossIn += 1; if (b.defeated) bossOut += 1; });
      });
    }
    return {
      n,
      wins,
      winRate: n ? wins / n : null,
      avgFloor: floorN ? floorSum / floorN : null,
      actClear: actIn ? actOut / actIn : null,
      bossRate: bossIn ? bossOut / bossIn : null,
      perAct,
    };
  }

  function median(values) {
    if (!values.length) return null;
    const s = [...values].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }

  // ---- 1エントリ分のカード・レリックの情報（計算結果は覚えておく）
  const cardKey = (id, lvl, split) => (split && lvl > 0 ? `${id}+${lvl > 1 ? lvl : ''}` : id);

  function view(e) {
    let byPi = viewCache.get(e.run);
    if (!byPi) { byPi = new Map(); viewCache.set(e.run, byPi); }
    if (byPi.has(e.pi)) return byPi.get(e.pi);
    const pl = e.run.players[e.pi].raw || {};
    const arr = (v) => (Array.isArray(v) ? v : []);
    const v = { offers: [], finalCards: [], everCards: [], finalRelics: [], everRelics: [], finalRelicsF: [] };
    // 入手した階（floor_added_to_deck）→ 章
    const actOf = (floor) => (typeof floor === 'number' && e.run.points[floor - 1] ? e.run.points[floor - 1].act : null);

    arr(pl.deck).forEach((c) => c && v.finalCards.push({ id: c.id, lvl: c.current_upgrade_level || 0, act: actOf(c.floor_added_to_deck) }));
    arr(pl.relics).forEach((x) => {
      if (!x) return;
      v.finalRelics.push(x.id);
      v.finalRelicsF.push({ id: x.id, act: actOf(x.floor_added_to_deck) });
    });
    v.everCards.push(...v.finalCards);
    v.everRelics.push(...v.finalRelics);

    for (const p of e.run.points) {
      const ps = p.stats[e.pi];
      if (!ps) continue;
      arr(ps.cards_gained).forEach((c) => c && v.everCards.push({ id: c.id, lvl: c.current_upgrade_level || 0 }));
      arr(ps.cards_removed).forEach((c) => c && v.everCards.push({ id: c.id, lvl: c.current_upgrade_level || 0 }));
      arr(ps.cards_transformed).forEach((t) => {
        if (t && t.original_card) v.everCards.push({ id: t.original_card.id, lvl: t.original_card.current_upgrade_level || 0 });
        if (t && t.final_card) v.everCards.push({ id: t.final_card.id, lvl: t.final_card.current_upgrade_level || 0 });
      });
      arr(ps.relics_removed).forEach((id) => v.everRelics.push(id));
      // カード報酬（ショップ・休憩所・宝箱は含めない）
      if (REWARD_TYPES.includes(p.type) && arr(ps.card_choices).length) {
        v.offers.push({
          type: p.type,
          // 報酬の出どころ。イベントから戦闘に入るマスの報酬は戦闘の報酬とみなして「通常戦」
          source: p.eventThenCombat ? 'monster' : p.type,
          floor: p.floor,
          act: p.act,
          cards: arr(ps.card_choices).filter((c) => c && c.card).map((c) => ({
            id: c.card.id, lvl: c.card.current_upgrade_level || 0, picked: c.was_picked === true,
          })),
        });
      }
    }
    byPi.set(e.pi, v);
    return v;
  }

  // ---- カード別
  function cardTable(entries, opt) {
    const split = opt.upgrade === 'split';
    const rows = new Map();
    const row = (key) => {
      if (!rows.has(key)) rows.set(key, { key, offered: 0, picked: 0, skipped: 0, owners: [] });
      return rows.get(key);
    };
    for (const e of entries) {
      const v = view(e);
      for (const o of v.offers) {
        const anyPicked = o.cards.some((c) => c.picked);
        const seen = new Map(); // 同じ報酬に同じカードが2枚出ても1回と数える
        o.cards.forEach((c) => {
          const k = cardKey(c.id, c.lvl, split);
          seen.set(k, (seen.get(k) || false) || c.picked);
        });
        for (const [k, picked] of seen) {
          const r = row(k);
          r.offered += 1;
          if (picked) r.picked += 1;
          if (!anyPicked) r.skipped += 1;
        }
      }
      const owned = new Set((opt.own === 'ever' ? v.everCards : v.finalCards).map((c) => cardKey(c.id, c.lvl, split)));
      owned.forEach((k) => row(k).owners.push(e));
    }
    return [...rows.values()].map((r) => ({
      key: r.key,
      offered: r.offered,
      pickRate: r.offered ? r.picked / r.offered : null,
      skipRate: r.offered ? r.skipped / r.offered : null,
      m: metrics(r.owners),
    }));
  }

  // ---- レリック別
  function relicTable(entries, opt) {
    const rows = new Map();
    for (const e of entries) {
      const v = view(e);
      new Set(opt.own === 'ever' ? v.everRelics : v.finalRelics).forEach((id) => {
        if (!rows.has(id)) rows.set(id, []);
        rows.get(id).push(e);
      });
    }
    return [...rows].map(([key, owners]) => ({ key, m: metrics(owners) }));
  }

  // ---- 死因
  function deathTable(entries) {
    const losses = entries.filter((e) => !e.run.win);
    const rows = new Map();
    for (const e of losses) {
      const d = e.run.death;
      const key = d ? d.id : null;
      const k = key || '__unknown__';
      if (!rows.has(k)) rows.set(k, { key, kind: d ? d.kind : null, runs: [] });
      rows.get(k).runs.push(e);
    }
    return {
      losses: losses.length,
      rows: [...rows.values()].map((r) => {
        const floors = r.runs.map((e) => e.run.floorReached).filter((x) => x != null);
        const acts = new Map();
        r.runs.forEach((e) => { const a = e.run.points.length ? e.run.points[e.run.points.length - 1].act : null; acts.set(a, (acts.get(a) || 0) + 1); });
        const topAct = [...acts].sort((a, b) => b[1] - a[1])[0];
        return {
          key: r.key, kind: r.kind, count: r.runs.length,
          share: losses.length ? r.runs.length / losses.length : null,
          avgFloor: floors.length ? floors.reduce((s, x) => s + x, 0) / floors.length : null,
          act: topAct ? topAct[0] : null,
        };
      }),
    };
  }

  function floorDistribution(entries) {
    const m = new Map();
    for (const e of entries) {
      const f = e.run.floorReached;
      if (f == null) continue;
      if (!m.has(f)) m.set(f, { floor: f, runs: 0, wins: 0 });
      const r = m.get(f);
      r.runs += 1; if (e.run.win) r.wins += 1;
    }
    return [...m.values()].sort((a, b) => a.floor - b.floor);
  }

  // ---- 勝利デッキ分析：勝利したランの最終デッキ（レリック）に入っていた割合 ÷ 全ランの割合
  // act を指定したときは、その章で手に入れた物だけを数え、母数を「その章に入ったラン」にそろえる
  // （後半でしか手に入らない物の割合が高く出る偏りを避けるため）
  function winDeckTable(entries, opt) {
    const base = opt.act === 'all' ? entries : entries.filter((e) => e.run.acts[opt.act - 1] && e.run.acts[opt.act - 1].entered);
    const wins = base.filter((e) => e.run.win).length;
    const rows = new Map();
    for (const e of base) {
      const v = view(e);
      const items = opt.kind === 'relic'
        ? v.finalRelicsF.map((x) => ({ key: x.id, act: x.act }))
        : v.finalCards.map((c) => ({ key: cardKey(c.id, c.lvl, opt.upgrade === 'split'), act: c.act }));
      const keys = new Set(items.filter((x) => opt.act === 'all' || x.act === opt.act).map((x) => x.key));
      keys.forEach((k) => {
        if (!rows.has(k)) rows.set(k, { key: k, winN: 0, allN: 0 });
        const r = rows.get(k);
        r.allN += 1;
        if (e.run.win) r.winN += 1;
      });
    }
    return {
      runs: base.length,
      wins,
      rows: [...rows.values()].map((r) => {
        const winShare = wins ? r.winN / wins : null;
        const allShare = base.length ? r.allN / base.length : null;
        return { ...r, winShare, allShare, ratio: winShare != null && allShare ? winShare / allShare : null };
      }),
    };
  }

  return {
    entriesFor, versionsOf, applyFilters, metrics, median, cardTable, relicTable, deathTable, floorDistribution,
    winDeckTable, view, cardKey,
  };
})();
