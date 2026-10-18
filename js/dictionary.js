// 日本語名辞書。内部ID（例：CARD.BASH）→ { name: 日本語名, kind: 種類 }。
// ゲームのデータは同梱せず、利用者が入力した内容だけを使う。
window.STS = window.STS || {};

STS.dict = (function () {
  const META_KEY = 'dictionary';
  const FORMAT = 'sts2-stats-dictionary';
  let entries = {};
  let saveTimer = null;

  async function load() {
    try { entries = (await STS.storage.getMeta(META_KEY)) || {}; } catch (e) { entries = {}; }
  }
  function saveSoon() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => STS.storage.setMeta(META_KEY, entries).catch(() => {}), 300);
  }

  const shortId = (id) => (typeof id === 'string' && id.includes('.') ? id.slice(id.indexOf('.') + 1) : String(id ?? ''));
  function name(id) {
    if (id == null) return STS.T.unknown;
    const e = entries[id];
    return e && e.name ? e.name : shortId(id);
  }
  const get = (id) => entries[id] || null;
  const kind = (id) => (entries[id] && entries[id].kind) || '';

  function set(id, patch) {
    const cur = entries[id] || {};
    const next = { ...cur, ...patch };
    if (!next.name && !next.kind) delete entries[id];
    else entries[id] = next;
    saveSoon();
  }

  function category(id) {
    const p = typeof id === 'string' ? id.split('.')[0] : '';
    return STS.T.dict.cats[p] ? p : 'OTHER';
  }

  // ---- 書き出し・読み込み（他の利用者と共有できる形。SteamIDなどは含まない）
  function exportJson() {
    return JSON.stringify({ format: FORMAT, version: 1, exportedAt: new Date().toISOString(), entries }, null, 2);
  }
  function importJson(text) {
    const data = JSON.parse(text);
    const src = data && data.format === FORMAT && data.entries && typeof data.entries === 'object' ? data.entries : null;
    if (!src) throw new Error('format');
    let n = 0;
    for (const [id, e] of Object.entries(src)) {
      if (typeof id !== 'string' || !e || typeof e !== 'object') continue;
      const v = {};
      if (typeof e.name === 'string' && e.name.trim()) v.name = e.name.trim().slice(0, 100);
      if (typeof e.kind === 'string' && STS.T.dict.kinds.includes(e.kind)) v.kind = e.kind;
      if (!v.name && !v.kind) continue;
      entries[id] = { ...(entries[id] || {}), ...v };
      n += 1;
    }
    saveSoon();
    return n;
  }

  // ---- 記録に出てくるIDをすべて集める（ID → 出現数）
  function collectIds(runs) {
    const counts = new Map();
    const add = (id) => { if (typeof id === 'string' && id && id !== 'NONE.NONE') counts.set(id, (counts.get(id) || 0) + 1); };
    const each = (arr, f) => Array.isArray(arr) && arr.forEach((x) => { try { f(x); } catch (e) { /* 想定外の形は飛ばす */ } });
    for (const r of runs) {
      add(r.raw.killed_by_encounter); add(r.raw.killed_by_event);
      each(r.raw.acts, add);
      each(r.raw.players, (pl) => {
        add(pl.character);
        each(pl.deck, (c) => { add(c.id); c.enchantment && add(c.enchantment.id); });
        each(pl.relics, (x) => add(x.id));
        each(pl.potions, (x) => add(x.id));
      });
      for (const p of r.points) {
        each(p.raw && p.raw.rooms, (rm) => { add(rm.model_id); each(rm.monster_ids, add); });
        each(p.stats, (ps) => {
          each(ps.card_choices, (c) => add(c.card.id));
          each(ps.cards_gained, (c) => add(c.id));
          each(ps.relic_choices, (c) => add(c.choice));
          each(ps.potion_choices, (c) => add(c.choice));
          each(ps.cards_enchanted, (c) => add(c.enchantment));
          each(ps.bought_colorless, add); each(ps.bought_relics, add); each(ps.bought_potions, add);
          each(ps.potion_used, add);
          each(ps.rest_site_choices, (x) => add(`REST.${x}`)); // 休憩所の選択肢（HEAL など）
          each(ps.event_choices, (ec) => { if (ec.title && ec.title.table === 'events') add(STS.events.optionId(ec)); });
        });
      }
    }
    return counts;
  }

  // ---- 自動候補：イベント記録の variables にある日本語名と、同じマスで手に入れた物を組み合わせる
  function varCategory(key) {
    if (/^Relic\d*$/.test(key)) return 'RELIC';
    if (/^(Card\d*|RandomCard|Curse|ResistCurse)$/.test(key)) return 'CARD';
    if (/^Enchantment\d*$/.test(key)) return 'ENCHANTMENT';
    if (/^Potion\d*$/.test(key)) return 'POTION';
    return null;
  }
  function candidates(runs) {
    const votes = new Map(); // id → Map(name → 回数)
    for (const r of runs) {
      for (const p of r.points) {
        p.stats.forEach((ps, pi) => {
          try {
            const names = { CARD: new Set(), RELIC: new Set(), ENCHANTMENT: new Set(), POTION: new Set() };
            (ps.event_choices || []).forEach((ec) => {
              Object.entries(ec.variables || {}).forEach(([k, v]) => {
                const cat = varCategory(k);
                if (cat && v && typeof v.string_value === 'string' && v.string_value.trim()) names[cat].add(v.string_value.trim());
              });
            });
            if (!Object.values(names).some((s) => s.size)) return;
            const got = { CARD: new Set(), RELIC: new Set(), ENCHANTMENT: new Set(), POTION: new Set() };
            (ps.cards_gained || []).forEach((c) => got.CARD.add(c.id));
            (ps.cards_transformed || []).forEach((t) => got.CARD.add(t.final_card.id));
            (ps.relic_choices || []).forEach((c) => c.was_picked && got.RELIC.add(c.choice));
            const pl = r.raw.players[pi];
            (pl && pl.relics || []).forEach((x) => x.floor_added_to_deck === p.floor && got.RELIC.add(x.id));
            (ps.potion_choices || []).forEach((c) => c.was_picked && got.POTION.add(c.choice));
            (ps.cards_enchanted || []).forEach((c) => got.ENCHANTMENT.add(c.enchantment));
            for (const cat of Object.keys(names)) {
              if (names[cat].size !== 1 || got[cat].size !== 1) continue;
              const id = [...got[cat]][0];
              const nm = [...names[cat]][0];
              if (!votes.has(id)) votes.set(id, new Map());
              votes.get(id).set(nm, (votes.get(id).get(nm) || 0) + 1);
            }
          } catch (e) { /* 想定外の形は飛ばす */ }
        });
      }
    }
    const out = new Map(); // id → { name, agree, total }
    for (const [id, m] of votes) {
      const sorted = [...m].sort((a, b) => b[1] - a[1]);
      const total = sorted.reduce((s, x) => s + x[1], 0);
      out.set(id, { name: sorted[0][0], agree: sorted[0][1], total });
    }
    return out;
  }

  return { load, name, shortId, get, kind, set, category, exportJson, importJson, collectIds, candidates, all: () => entries };
})();
