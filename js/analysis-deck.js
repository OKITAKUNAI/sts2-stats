// 第4段階：初期カードの削除数、デッキ枚数、呪いと成績。
window.STS = window.STS || {};

STS.deck = (function () {
  const arr = (v) => (Array.isArray(v) ? v : []);
  const metrics = (list) => STS.stats.metrics(list);
  const avg = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);
  const BANE = 'CARD.ASCENDERS_BANE';

  // 初期デッキのカード（実際のラン記録から逆算し、全キャラで一貫していたもの）
  // 知らないキャラは、ストライク・ディフェンドだけを初期カードとみなす
  const STARTERS = {
    'CHARACTER.DEFECT': ['ZAP', 'DUALCAST'],
    'CHARACTER.IRONCLAD': ['BASH'],
    'CHARACTER.SILENT': ['NEUTRALIZE', 'SURVIVOR'],
    'CHARACTER.REGENT': ['FALLING_STAR', 'VENERATE'],
    'CHARACTER.NECROBINDER': ['BODYGUARD', 'UNLEASH'],
  };
  function starterKind(character, id) {
    if (typeof id !== 'string') return null;
    if (id.startsWith('CARD.STRIKE_')) return 'strike';
    if (id.startsWith('CARD.DEFEND_')) return 'defend';
    if ((STARTERS[character] || []).some((x) => id === `CARD.${x}`)) return 'other';
    return null;
  }

  // ---- 初期カードの削除数
  // その章のボスを倒したランを対象に、その章の終わりまでに削除した初期カードの枚数ごとの最終成績
  const REMOVE_BUCKETS = ['0', '1', '2', '3+'];
  function starterRemoval(entries, act) {
    const groups = new Map(REMOVE_BUCKETS.map((b) => [b, []]));
    const parts = { strike: 0, defend: 0, other: 0, transform: 0 };
    for (const e of entries) {
      const a = e.run.acts[act - 1];
      if (!a || !a.cleared) continue;
      let n = 0;
      for (const p of e.run.points) {
        if (p.act > act) break;
        const s = p.stats[e.pi];
        if (!s) continue;
        // 泥棒系の敵に盗まれて取り返したカード（同じマスで入手にも出る）は数えない
        const regained = arr(s.cards_gained).map((c) => c && c.id);
        arr(s.cards_removed).forEach((c) => {
          const k = starterKind(e.character, c && c.id);
          if (!k) return;
          const j = regained.indexOf(c.id);
          if (j >= 0) { regained.splice(j, 1); return; }
          n += 1;
          parts[k] += 1;
        });
        arr(s.cards_transformed).forEach((t) => { if (starterKind(e.character, t && t.original_card && t.original_card.id)) parts.transform += 1; });
      }
      groups.get(n >= 3 ? '3+' : String(n)).push(e);
    }
    return { rows: REMOVE_BUCKETS.map((b) => ({ bucket: b, m: metrics(groups.get(b)) })), parts };
  }

  // ---- ボス戦開始時のデッキ枚数（章ごとに区切りを変える）
  // 区切りは実データ（716件）のボス戦開始時の枚数の四分位を目安にした。章が進むと枚数が大きく増えるため
  const DECK_BINS = { 1: [18, 20, 22], 2: [24, 27, 29], 3: [29, 32, 36] };
  function deckBucket(act, n) {
    const b = DECK_BINS[act];
    if (n == null || !b) return null;
    const L = STS.T.deck;
    if (n <= b[0]) return { key: 0, label: L.binMax(b[0]) };
    if (n <= b[1]) return { key: 1, label: L.binRange(b[0] + 1, b[1]) };
    if (n <= b[2]) return { key: 2, label: L.binRange(b[1] + 1, b[2]) };
    return { key: 3, label: L.binMin(b[2] + 1) };
  }
  // 各章の最初のボス戦（3章の2連戦は1体目）
  const firstBoss = (e, act) => STS.combat.records(e).bosses.find((b) => b.act === act) || null;

  function deckAtBoss(entries, act) {
    const groups = new Map();
    for (const e of entries) {
      const b = firstBoss(e, act);
      const k = b && deckBucket(act, b.deckStart);
      if (!k) continue;
      if (!groups.has(k.key)) groups.set(k.key, { key: k.key, label: k.label, list: [], defeated: 0 });
      const g = groups.get(k.key);
      g.list.push(e);
      if (b.defeated) g.defeated += 1;
    }
    return [...groups.values()].sort((a, b) => a.key - b.key).map((g) => ({
      key: g.key, label: g.label, n: g.list.length, bossRate: g.defeated / g.list.length, m: metrics(g.list),
    }));
  }

  // 勝ったランのラン終了時のデッキ枚数（参考）
  function winnerDecks(entries) {
    const xs = entries.filter((e) => e.run.win).map((e) => STS.records.deckSize(e)).sort((a, b) => a - b);
    return { n: xs.length, min: xs[0] ?? null, median: STS.stats.median(xs), max: xs.length ? xs[xs.length - 1] : null, avg: avg(xs) };
  }

  // ---- 呪い（日本語名辞書の種類「呪い」で判定）
  function curseSet(excludeBane) {
    const all = STS.dict.all();
    return new Set(Object.keys(all).filter((id) => all[id] && all[id].kind === '呪い' && !(excludeBane && id === BANE)));
  }

  // 各マスが終わった時点で持っていた呪いの枚数（ラン終了時のデッキから逆算）
  function cursesAfter(e, curses) {
    const pts = e.run.points;
    const out = new Array(pts.length).fill(0);
    let n = arr(e.run.players[e.pi].raw && e.run.players[e.pi].raw.deck).filter((c) => c && curses.has(c.id)).length;
    for (let i = pts.length - 1; i >= 0; i--) {
      out[i] = n;
      const s = pts[i].stats[e.pi];
      if (!s) continue;
      n -= arr(s.cards_gained).filter((c) => c && curses.has(c.id)).length;
      n += arr(s.cards_removed).filter((c) => c && curses.has(c.id)).length;
      arr(s.cards_transformed).forEach((t) => {
        if (t && t.final_card && curses.has(t.final_card.id)) n -= 1;
        if (t && t.original_card && curses.has(t.original_card.id)) n += 1;
      });
      if (n < 0) n = 0;
    }
    return out;
  }

  // 各章の最初のボス戦開始時の呪いの枚数（0／1／2以上）ごとのボス撃破率
  function curseAtBoss(entries, curses) {
    const out = [];
    for (const act of [1, 2, 3]) {
      const g = new Map(['0', '1', '2+'].map((k) => [k, { n: 0, defeated: 0 }]));
      for (const e of entries) {
        const b = firstBoss(e, act);
        if (!b || b.index < 1) continue;
        const c = cursesAfter(e, curses)[b.index - 1];
        const x = g.get(c >= 2 ? '2+' : String(c));
        x.n += 1;
        if (b.defeated) x.defeated += 1;
      }
      for (const [k, x] of g) out.push({ act, bucket: k, n: x.n, bossRate: x.n ? x.defeated / x.n : null });
    }
    return out;
  }

  // ラン終了時の呪いの枚数ごとの成績（参考）と、呪いのカードごとの成績
  function curseAtEnd(entries, curses) {
    const g = new Map(['0', '1', '2', '3+'].map((k) => [k, []]));
    const per = new Map();
    for (const e of entries) {
      const deck = arr(e.run.players[e.pi].raw && e.run.players[e.pi].raw.deck).filter((c) => c && curses.has(c.id));
      g.get(deck.length >= 3 ? '3+' : String(deck.length)).push(e);
      new Set(deck.map((c) => c.id)).forEach((id) => { if (!per.has(id)) per.set(id, []); per.get(id).push(e); });
    }
    return {
      byCount: [...g].map(([bucket, list]) => ({ bucket, m: metrics(list) })),
      byCard: [...per].map(([key, list]) => ({ key, m: metrics(list) })),
    };
  }

  return { starterRemoval, deckAtBoss, winnerDecks, curseSet, curseAtBoss, curseAtEnd, starterKind, DECK_BINS, BANE };
})();
