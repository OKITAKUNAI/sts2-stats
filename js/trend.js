// 第3段階：区間成績・前の区間との差の判定・移動平均。
window.STS = window.STS || {};

STS.trend = (function () {
  const Z = 1.96; // 95%
  const arr = (v) => (Array.isArray(v) ? v : []);
  const mean = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);
  const variance = (xs) => {
    if (xs.length < 2) return null;
    const m = mean(xs);
    return xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1);
  };

  const ordered = (entries) => [...entries].sort((a, b) => (a.run.startTime || 0) - (b.run.startTime || 0));

  // ---- Wilson の信頼区間（勝率の95%区間）
  function wilson(wins, n) {
    if (!n) return null;
    const p = wins / n;
    const d = 1 + (Z * Z) / n;
    const c = (p + (Z * Z) / (2 * n)) / d;
    const h = (Z * Math.sqrt((p * (1 - p)) / n + (Z * Z) / (4 * n * n))) / d;
    return { p, lo: Math.max(0, c - h), hi: Math.min(1, c + h) };
  }

  // 勝率の差（今の区間 − 前の区間）の95%区間：Newcombe 法（Wilson の区間を差に広げたもの）
  function newcombe(w1, n1, w2, n2) {
    const a = wilson(w1, n1), b = wilson(w2, n2);
    if (!a || !b) return null;
    const d = b.p - a.p;
    return {
      diff: d,
      lo: d - Math.sqrt((b.p - b.lo) ** 2 + (a.hi - a.p) ** 2),
      hi: d + Math.sqrt((b.hi - b.p) ** 2 + (a.p - a.lo) ** 2),
    };
  }

  // t分布の97.5%点（自由度 df）。表の値を補間する
  const T_TABLE = [12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262, 2.228, 2.201, 2.179, 2.160, 2.145, 2.131,
    2.120, 2.110, 2.101, 2.093, 2.086, 2.080, 2.074, 2.069, 2.064, 2.060, 2.056, 2.052, 2.048, 2.045, 2.042];
  function t975(df) {
    if (!(df > 0)) return null;
    if (df <= 1) return T_TABLE[0];
    if (df <= 30) {
      const lo = Math.floor(df), hi = Math.ceil(df);
      return T_TABLE[lo - 1] + (T_TABLE[hi - 1] - T_TABLE[lo - 1]) * (df - lo);
    }
    const pts = [[30, 2.042], [40, 2.021], [60, 2.000], [120, 1.980], [1e9, 1.960]];
    for (let i = 1; i < pts.length; i++) {
      if (df <= pts[i][0]) {
        const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
        return y0 + (y1 - y0) * ((df - x0) / (x1 - x0));
      }
    }
    return 1.96;
  }

  // 平均の差（今の区間 − 前の区間）の95%区間：Welch の方法
  function welch(xs1, xs2) {
    if (xs1.length < 2 || xs2.length < 2) return null;
    const m1 = mean(xs1), m2 = mean(xs2), v1 = variance(xs1), v2 = variance(xs2);
    const a = v1 / xs1.length, b = v2 / xs2.length;
    const se = Math.sqrt(a + b);
    const d = m2 - m1;
    if (se === 0) return { diff: d, lo: d, hi: d };
    const df = (a + b) ** 2 / ((a * a) / (xs1.length - 1) + (b * b) / (xs2.length - 1));
    const t = t975(df);
    return { diff: d, lo: d - t * se, hi: d + t * se };
  }

  // 判定：区間が0をまたげば「誤差の範囲」
  const judge = (ci) => (!ci ? 'na' : ci.lo > 0 ? 'up' : ci.hi < 0 ? 'down' : 'noise');

  // ---- 区間成績
  function blocks(entries, size) {
    const list = ordered(entries);
    const out = [];
    for (let i = 0; i < list.length; i += size) {
      const chunk = list.slice(i, i + size);
      const floors = chunk.map((e) => e.run.floorReached).filter((x) => x != null);
      const bosses = chunk.flatMap((e) => STS.combat.records(e).bosses);
      const losses = chunk.filter((e) => !e.run.win && !e.run.abandoned);
      const held = losses.filter((e) => arr(e.run.players[e.pi].raw && e.run.players[e.pi].raw.potions).some((x) => x && x.id)).length;
      const endGold = (win) => mean(chunk.filter((e) => !e.run.abandoned && e.run.win === win).map((e) => {
        const last = e.run.points[e.run.points.length - 1];
        const s = last && last.stats[e.pi];
        return s && typeof s.current_gold === 'number' ? s.current_gold : null;
      }).filter((x) => x != null));
      out.push({
        index: out.length + 1,
        complete: chunk.length === size,
        from: chunk[0].run.date,
        to: chunk[chunk.length - 1].run.date,
        n: chunk.length,
        wins: chunk.filter((e) => e.run.win).length,
        winRate: chunk.filter((e) => e.run.win).length / chunk.length,
        floors,
        avgFloor: mean(floors),
        bossDefeated: bosses.filter((b) => b.defeated).length,
        bossFights: bosses.length,
        bossRate: bosses.length ? bosses.filter((b) => b.defeated).length / bosses.length : null,
        holdRate: losses.length ? held / losses.length : null,
        losses: losses.length,
        goldWin: endGold(true),
        goldLoss: endGold(false),
      });
    }
    // 前の区間との比較
    out.forEach((b, i) => {
      if (i === 0) return;
      const p = out[i - 1];
      b.winCi = newcombe(p.wins, p.n, b.wins, b.n);
      b.floorCi = welch(p.floors, b.floors);
      b.winJudge = judge(b.winCi);
      b.floorJudge = judge(b.floorCi);
    });
    return out;
  }

  // ---- 直近 window 戦の移動平均と、バージョンが変わった位置
  function moving(entries, window) {
    const list = ordered(entries);
    const points = [];
    for (let i = window - 1; i < list.length; i++) {
      const w = list.slice(i - window + 1, i + 1);
      const floors = w.map((e) => e.run.floorReached).filter((x) => x != null);
      points.push({ x: i + 1, winRate: w.filter((e) => e.run.win).length / w.length, avgFloor: mean(floors), date: list[i].run.date });
    }
    const versions = [];
    list.forEach((e, i) => {
      if (i > 0 && e.run.buildId && e.run.buildId !== list[i - 1].run.buildId) versions.push({ x: i + 1, label: e.run.buildId });
    });
    return { total: list.length, points, versions, firstVersion: list[0] ? list[0].run.buildId : null };
  }

  return { wilson, newcombe, welch, t975, judge, blocks, moving, ordered };
})();
