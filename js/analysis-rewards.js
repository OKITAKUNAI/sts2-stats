// 第2段階：カード報酬の分析。
window.STS = window.STS || {};

STS.rewards = (function () {
  const S = () => STS.stats;

  // カードごとに、各ランで「最初に提示された場面」で取ったか・取らなかったかを調べる。
  // 長く生き残ったランほど何度も提示されて「取った」側に入りやすくなる偏りを避けるため。
  // あわせて「最初に取った章」も記録する。
  // opt: { sources: Set(出どころ), upgrade: 'merge' | 'split' }
  function analyze(entries, opt) {
    const split = opt.upgrade === 'split';
    const rows = new Map();
    const row = (key) => {
      if (!rows.has(key)) rows.set(key, { key, taken: [], notTaken: [], byAct: [[], [], []] });
      return rows.get(key);
    };
    for (const e of entries) {
      const first = new Map();   // カード → 最初の場面で取ったか
      const firstPick = new Map(); // カード → 最初に取った章
      for (const o of S().view(e).offers) {
        if (!opt.sources.has(o.source)) continue;
        const inOffer = new Map(); // 同じ報酬に同じカードが2枚出ても1回と数える
        o.cards.forEach((c) => {
          const k = S().cardKey(c.id, c.lvl, split);
          inOffer.set(k, inOffer.get(k) || c.picked);
        });
        for (const [k, picked] of inOffer) {
          if (!first.has(k)) first.set(k, picked);
          if (picked && !firstPick.has(k)) firstPick.set(k, o.act);
        }
      }
      for (const [k, took] of first) row(k)[took ? 'taken' : 'notTaken'].push(e);
      for (const [k, act] of firstPick) if (act >= 1 && act <= 3) row(k).byAct[act - 1].push(e);
    }
    return [...rows.values()].map((r) => ({
      key: r.key,
      offeredRuns: r.taken.length + r.notTaken.length,
      taken: S().metrics(r.taken),
      notTaken: S().metrics(r.notTaken),
      byAct: r.byAct.map((list) => S().metrics(list)),
    }));
  }

  return { analyze, SOURCES: ['monster', 'elite', 'boss', 'event', 'ancient'] };
})();
