// データの保存：復元用・共有用のJSON書き出しと読み込み。
// ・自分用（復元用）：SteamIDとニックネームを本物のまま含める（他の人に渡さない）
// ・共有用：SteamIDを架空の値に置き換え、ニックネームは含めない
// ・全部（ランを含む）／設定だけ（辞書・チャレンジ・ニックネーム・自分の設定）
window.STS = window.STS || {};

STS.backup = (function () {
  const FORMAT = 'sts2-stats-backup';
  const FAKE_BASE = 76500000000000000n; // 架空のSteamID（17桁）。001, 002 … と順に割り当てる
  const SELF_FAKE_KEY = 'selfIdFake';  // 保存している「自分」のIDが架空のものか
  const isBigId = (v) => typeof v === 'string' && /^\d{16,}$/.test(v);

  // ---- 書き出し
  async function build(purpose, scope) {
    const share = purpose === 'share';
    const [records, dictionary, challenges, challengeMarks, nicknames, selfId] = await Promise.all([
      scope === 'all' ? STS.storage.getAllRuns() : Promise.resolve([]),
      STS.storage.getMeta('dictionary'), STS.storage.getMeta('challenges'), STS.storage.getMeta('challengeMarks'),
      STS.storage.getMeta('nicknames'), STS.storage.getMeta('selfId'),
    ]);

    // 共有用：本物のIDを集め、登場回数の多い順に架空のIDを割り当てる
    let map = null;
    if (share) {
      const counts = new Map();
      const add = (id) => { if (isBigId(id)) counts.set(id, (counts.get(id) || 0) + 1); };
      records.forEach((r) => (r.raw.players || []).forEach((p) => add(String(p.id))));
      if (isBigId(selfId)) add(selfId);
      map = new Map([...counts].sort((a, b) => b[1] - a[1]).map(([id], i) => [id, String(FAKE_BASE + BigInt(i + 1))]));
    }
    const swap = (v) => (map && isBigId(String(v)) && map.has(String(v)) ? map.get(String(v)) : v);
    const runs = records.map((r) => {
      if (!share) return { key: r.key, file: r.file, raw: r.raw, fakeIds: !!r.fakeIds };
      const raw = JSON.parse(JSON.stringify(r.raw));
      (raw.players || []).forEach((p) => { p.id = swap(p.id); });
      (raw.map_point_history || []).forEach((act) => (act || []).forEach((m) => (m.player_stats || []).forEach((ps) => { ps.player_id = swap(ps.player_id); })));
      return { key: r.key, file: r.file, raw, fakeIds: true };
    });
    const data = {
      format: FORMAT, version: 1, exportedAt: new Date().toISOString(),
      purpose, scope, realIds: !share,
      runs,
      dictionary: dictionary || {},
      challenges: challenges || [],
      challengeMarks: challengeMarks || {},
      selfId: selfId ? swap(selfId) : null,
      nicknames: share ? {} : (nicknames || {}),
    };
    const text = JSON.stringify(data);
    // 念のため：共有用に本物のIDが残っていないか確かめる
    if (share && map) for (const real of map.keys()) if (text.includes(real)) throw new Error('real-id-left');
    return text;
  }

  const fileName = (purpose, scope) => {
    const d = new Date();
    const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    return `sts2-stats-${purpose === 'share' ? 'share' : 'backup'}-${scope === 'all' ? 'all' : 'settings'}-${ymd}.json`;
  };

  // ---- 読み込み（復元）
  function parse(text) {
    const data = JSON.parse(text);
    if (!data || data.format !== FORMAT || !Array.isArray(data.runs)) throw new Error('format');
    return data;
  }
  function summarize(data) {
    return {
      purpose: data.purpose, scope: data.scope, realIds: !!data.realIds,
      runs: data.runs.length,
      dictionary: Object.keys(data.dictionary || {}).length,
      challenges: (data.challenges || []).length,
      nicknames: Object.keys(data.nicknames || {}).length,
      exportedAt: data.exportedAt,
    };
  }

  // 今のデータに足し合わせる。同じランがあって、保存側が架空のID・読み込む側が本物のIDなら置き換える
  async function apply(data) {
    const existing = new Map((await STS.storage.getAllRuns()).map((r) => [r.key, r]));
    const put = [];
    let added = 0, replaced = 0, skipped = 0;
    for (const r of data.runs) {
      if (!r || !r.raw || !r.key) continue;
      const fake = !data.realIds || !!r.fakeIds;
      const cur = existing.get(r.key);
      if (!cur) { put.push({ key: r.key, file: r.file || null, addedAt: Date.now(), raw: r.raw, fakeIds: fake }); added += 1; }
      else if (cur.fakeIds && !fake) { put.push({ ...cur, raw: r.raw, fakeIds: false }); replaced += 1; }
      else skipped += 1;
    }
    if (put.length) await STS.storage.putRuns(put);

    const merge = async (key, incoming, how) => {
      if (!incoming) return;
      const cur = (await STS.storage.getMeta(key)) || (Array.isArray(incoming) ? [] : {});
      await STS.storage.setMeta(key, how(cur, incoming));
    };
    await merge('dictionary', data.dictionary, (a, b) => ({ ...a, ...b }));
    await merge('nicknames', data.nicknames, (a, b) => ({ ...a, ...b }));
    await merge('challenges', data.challenges, (a, b) => {
      const m = new Map(a.map((c) => [c.id, c]));
      b.forEach((c) => c && c.id && m.set(c.id, c));
      return [...m.values()];
    });
    await merge('challengeMarks', data.challengeMarks, (a, b) => {
      const out = { ...a };
      Object.entries(b).forEach(([id, keys]) => { out[id] = [...new Set([...(out[id] || []), ...(keys || [])])]; });
      return out;
    });
    // 「自分」の設定：まだ決めていない場合だけ使う
    if (data.selfId && !(await STS.storage.getMeta('selfId'))) {
      await STS.storage.setMeta('selfId', data.selfId);
      await STS.storage.setMeta(SELF_FAKE_KEY, !data.realIds);
    }
    if (replaced) await onRealReplaced();
    return { added, replaced, skipped };
  }

  // 架空のIDのランが本物のIDに置き換わったら、架空の「自分」の設定は外して自動判定に戻す
  async function onRealReplaced() {
    if (await STS.storage.getMeta(SELF_FAKE_KEY)) {
      await STS.storage.deleteMeta('selfId');
      await STS.storage.deleteMeta(SELF_FAKE_KEY);
    }
  }

  return { build, fileName, parse, summarize, apply, onRealReplaced };
})();
