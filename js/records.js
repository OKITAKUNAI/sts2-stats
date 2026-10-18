// 第3段階：記録（連勝・最速クリア・最少デッキ枚数でのクリア・最高到達階層）。
window.STS = window.STS || {};

STS.records = (function () {
  const arr = (v) => (Array.isArray(v) ? v : []);
  const deckSize = (e) => arr(e.run.players[e.pi].raw && e.run.players[e.pi].raw.deck).length;

  // entries：記録の対象（放棄も含めて渡す。ネオーでの放棄は無視し、それ以外の放棄は連勝を止める）
  function compute(entries) {
    const list = STS.trend.ordered(entries).filter((e) => !e.run.abandonedAtNeow);
    let cur = 0, curStart = null;
    let best = { len: 0, from: null, to: null };
    for (const e of list) {
      if (e.run.win) {
        if (cur === 0) curStart = e;
        cur += 1;
        if (cur > best.len) best = { len: cur, from: curStart, to: e };
      } else {
        cur = 0;
        curStart = null;
      }
    }
    const wins = list.filter((e) => e.run.win);
    const pickMin = (xs, f) => xs.reduce((a, b) => (f(b) != null && (a == null || f(b) < f(a)) ? b : a), null);
    // 同じ値なら最初に達成したラン（list は古い順なので、厳密に大きいときだけ入れ替える）
    const fastest = pickMin(wins.filter((e) => e.run.runTime != null), (e) => e.run.runTime);
    const minDeck = pickMin(wins, deckSize);
    const maxFloor = list.reduce((a, b) => (b.run.floorReached != null && (a == null || b.run.floorReached > a.run.floorReached) ? b : a), null);
    return {
      runs: list.length,
      wins: wins.length,
      longest: best,
      current: cur,
      fastest,
      minDeck: minDeck ? { entry: minDeck, size: deckSize(minDeck) } : null,
      maxFloor,
    };
  }

  // キャラごとの行と、全キャラ合計の行
  function table(entries) {
    const chars = [...new Set(entries.map((e) => e.character).filter(Boolean))].sort();
    return [
      { char: 'all', ...compute(entries) },
      ...chars.map((c) => ({ char: c, ...compute(entries.filter((e) => e.character === c)) })),
    ];
  }

  return { compute, table, deckSize };
})();
