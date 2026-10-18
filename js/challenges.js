// 第3段階：縛りチャレンジ。
// 利用者が名前・説明（自由な文章）と、自動判定できる条件（ひな型）を登録する。
// 条件はすべて満たしたら達成。「手動の確認が必要」にしたものは、自分でチェックしたランだけを達成とする。
window.STS = window.STS || {};

STS.challenges = (function () {
  const LIST_KEY = 'challenges';
  const MARK_KEY = 'challengeMarks';
  let list = [];
  let marks = {}; // チャレンジID → [ランのキー]
  const arr = (v) => (Array.isArray(v) ? v : []);
  const raw = (e) => e.run.players[e.pi].raw || {};
  const stats = (e) => e.run.points.map((p) => p.stats[e.pi]).filter(Boolean);
  const num = (v) => (v === '' || v == null || Number.isNaN(Number(v)) ? null : Number(v));

  // ---- 条件のひな型
  // params の種類：number（数値）、char（キャラ）、card（カードID）、relic（レリックID）
  const TEMPLATES = {
    win: { params: [], test: (e) => e.run.win },
    char: { params: [{ key: 'id', kind: 'char' }], test: (e, p) => e.character === p.id },
    ascMin: { params: [{ key: 'n', kind: 'number' }], test: (e, p) => e.run.ascension != null && e.run.ascension >= num(p.n) },
    deckMax: { params: [{ key: 'n', kind: 'number' }], test: (e, p) => arr(raw(e).deck).length <= num(p.n) },
    cardHas: { params: [{ key: 'id', kind: 'card' }], test: (e, p) => arr(raw(e).deck).some((c) => c && c.id === p.id) },
    cardNot: { params: [{ key: 'id', kind: 'card' }], test: (e, p) => !arr(raw(e).deck).some((c) => c && c.id === p.id) },
    relicHas: { params: [{ key: 'id', kind: 'relic' }], test: (e, p) => arr(raw(e).relics).some((x) => x && x.id === p.id) },
    relicNot: { params: [{ key: 'id', kind: 'relic' }], test: (e, p) => !arr(raw(e).relics).some((x) => x && x.id === p.id) },
    removeMax: { params: [{ key: 'n', kind: 'number' }], test: (e, p) => STS.shop.visits(e).reduce((s, v) => s + v.removed.length, 0) <= num(p.n) },
    noHeal: { params: [], test: (e) => !stats(e).some((s) => arr(s.rest_site_choices).includes('HEAL')) },
    noShop: { params: [], test: (e) => !STS.shop.visits(e).some((v) => v.boughtAny) },
    timeMax: { params: [{ key: 'n', kind: 'number' }], test: (e, p) => e.run.runTime != null && e.run.runTime <= num(p.n) * 60 },
    eliteMin: { params: [{ key: 'n', kind: 'number' }], test: (e, p) => STS.combat.records(e).combats.filter((c) => c.kind === 'elite' && !c.lost).length >= num(p.n) },
    upgradedMax: { params: [{ key: 'n', kind: 'number' }], test: (e, p) => arr(raw(e).deck).filter((c) => c && (c.current_upgrade_level || 0) > 0).length <= num(p.n) },
    potionMax: { params: [{ key: 'n', kind: 'number' }], test: (e, p) => stats(e).reduce((s, x) => s + arr(x.potion_used).length, 0) <= num(p.n) },
    curseMin: { params: [{ key: 'n', kind: 'number' }], test: (e, p) => arr(raw(e).deck).filter((c) => c && STS.dict.kind(c.id) === '呪い').length >= num(p.n) },
  };

  async function load() {
    try { list = (await STS.storage.getMeta(LIST_KEY)) || []; } catch (e) { list = []; }
    try { marks = (await STS.storage.getMeta(MARK_KEY)) || {}; } catch (e) { marks = {}; }
  }
  const save = () => Promise.all([STS.storage.setMeta(LIST_KEY, list), STS.storage.setMeta(MARK_KEY, marks)]).catch(() => {});

  function upsert(ch) {
    const i = list.findIndex((x) => x.id === ch.id);
    if (i >= 0) list[i] = ch; else list.push({ ...ch, id: ch.id || `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}` });
    return save();
  }
  function remove(id) {
    list = list.filter((x) => x.id !== id);
    delete marks[id];
    return save();
  }
  function toggleMark(id, runKey, on) {
    const set = new Set(marks[id] || []);
    if (on) set.add(runKey); else set.delete(runKey);
    marks[id] = [...set];
    return save();
  }
  const isMarked = (id, runKey) => (marks[id] || []).includes(runKey);

  // 条件が正しく入力されているか（数値が空、IDが空のものは判定しない）
  function validCond(c) {
    const t = TEMPLATES[c.type];
    if (!t) return false;
    return t.params.every((p) => (p.kind === 'number' ? num(c[p.key]) != null : !!c[p.key]));
  }
  const inScope = (ch, mode) => ch.scope === 'both' || ch.scope === mode;

  // 自動の条件をすべて満たすか
  function autoOk(ch, e) {
    try {
      return arr(ch.conds).filter(validCond).every((c) => TEMPLATES[c.type].test(e, c));
    } catch (err) { return false; }
  }
  function achieved(ch, e) {
    if (!autoOk(ch, e)) return false;
    return ch.manual ? isMarked(ch.id, e.run.key) : true;
  }
  // そのランで達成したチャレンジ
  const achievedBy = (e, mode) => list.filter((ch) => inScope(ch, mode) && achieved(ch, e));

  return { load, upsert, remove, toggleMark, isMarked, autoOk, achieved, achievedBy, inScope, validCond, TEMPLATES, all: () => list };
})();
