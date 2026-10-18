// 第3段階：協力プレイ専用の集計と、相方のニックネーム。
// ニックネームはこのブラウザ内だけに保存し、書き出しには含めない。
window.STS = window.STS || {};

STS.coop = (function () {
  const NICK_KEY = 'nicknames';
  let nick = {};
  const metrics = (list) => STS.stats.metrics(list);

  async function load() {
    try { nick = (await STS.storage.getMeta(NICK_KEY)) || {}; } catch (e) { nick = {}; }
  }
  function setNickname(id, name) {
    const v = String(name || '').trim().slice(0, 40);
    if (v) nick[id] = v; else delete nick[id];
    return STS.storage.setMeta(NICK_KEY, nick).catch(() => {});
  }
  const nickname = (id) => nick[id] || '';
  // 画面での表示：ニックネームがあれば「ニックネーム（ID ••••1234）」
  const label = (id) => (nick[id] ? `${nick[id]}（${STS.maskId(id)}）` : STS.maskId(id));

  const partners = (e) => e.run.players.filter((_, i) => i !== e.pi);

  // 人数別の成績
  function bySize(entries) {
    const m = new Map();
    entries.forEach((e) => { const k = e.run.playerCount; if (!m.has(k)) m.set(k, []); m.get(k).push(e); });
    return [...m].map(([size, list]) => ({ size, m: metrics(list) }));
  }

  // 自分のキャラ × 相方のキャラ
  function combos(entries) {
    const m = new Map();
    entries.forEach((e) => {
      const others = partners(e).map((p) => p.character || '').sort();
      const k = `${e.character}\u0000${others.join('\u0001')}`;
      if (!m.has(k)) m.set(k, { mine: e.character, others, list: [] });
      m.get(k).list.push(e);
    });
    return [...m.values()].map((r) => ({ mine: r.mine, others: r.others, m: metrics(r.list) }));
  }

  // 相方ごと
  function byPartner(entries) {
    const m = new Map();
    entries.forEach((e) => partners(e).forEach((p) => {
      if (!p.id) return;
      if (!m.has(p.id)) m.set(p.id, []);
      m.get(p.id).push(e);
    }));
    return [...m].map(([id, list]) => ({
      id, m: metrics(list),
      last: list.reduce((a, e) => (e.run.date && (!a || e.run.date > a) ? e.run.date : a), null),
      chars: [...new Set(list.map((e) => (e.run.players.find((p) => p.id === id) || {}).character).filter(Boolean))],
    }));
  }

  return { load, setNickname, nickname, label, bySize, combos, byPartner };
})();
