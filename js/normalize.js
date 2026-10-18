// 読み込んだ1ランを、集計しやすい形に整える。
// 元のデータ（raw）はそのまま残し、よく使う値だけを取り出す。
// 想定外の形の項目があっても止めず、その値は null（画面では「不明」）にする。
window.STS = window.STS || {};

STS.normalize = (function () {
  const NONE = 'NONE.NONE';
  const ROOM_TYPES = ['event', 'monster', 'elite', 'boss', 'shop', 'rest_site', 'treasure'];
  const COMBAT = ['monster', 'elite', 'boss'];

  const safe = (fn, fallback = null) => {
    try { const v = fn(); return v === undefined ? fallback : v; } catch (e) { return fallback; }
  };
  const asArray = (v) => (Array.isArray(v) ? v : []);

  // マスの種類を決める。
  // ancient のマスは rooms[0].room_type が event になるので、先にエンシェントとして扱う。
  // それ以外は map_point_type ではなく rooms[0].room_type で判定する（？マスの中身が分かる）。
  function pointType(m) {
    const mapType = safe(() => m.map_point_type);
    if (mapType === 'ancient') return 'ancient';
    const roomType = safe(() => m.rooms[0].room_type);
    if (ROOM_TYPES.includes(roomType)) return roomType;
    return mapType || null;
  }

  function normalizePoints(raw) {
    const points = [];
    let floor = 0;
    asArray(raw.map_point_history).forEach((act, ai) => {
      asArray(act).forEach((m) => {
        floor += 1;
        const rooms = asArray(m && m.rooms);
        const lastRoomType = safe(() => rooms[rooms.length - 1].room_type);
        points.push({
          floor,                    // 全章を通した通し番号（1始まり）
          act: ai + 1,
          mapType: safe(() => m.map_point_type),
          type: pointType(m),
          modelId: safe(() => rooms[0].model_id),
          combatModelId: COMBAT.includes(lastRoomType) ? safe(() => rooms[rooms.length - 1].model_id) : null,
          // イベントから戦闘に入るマス（rooms が2つ）。被ダメージはイベント分と戦闘分の合計になる
          eventThenCombat: rooms.length > 1 && COMBAT.includes(lastRoomType),
          isCombat: COMBAT.includes(lastRoomType),
          stats: asArray(m && m.player_stats),
          raw: m,
        });
      });
    });
    return points;
  }

  function normalizeActs(raw, points) {
    const actIds = asArray(raw.acts);
    const nActs = Math.max(actIds.length, asArray(raw.map_point_history).length);
    const lastIndex = points.length - 1;
    const acts = [];
    for (let a = 1; a <= nActs; a++) {
      const inAct = points.filter((p) => p.act === a);
      // ボスを倒した＝そのボスのマスの後にまだマスがある、または勝利したラン
      const bosses = inAct
        .filter((p) => p.type === 'boss' || p.mapType === 'boss')
        .map((p) => ({
          floor: p.floor,
          id: p.combatModelId || p.modelId,
          defeated: points.indexOf(p) < lastIndex || raw.win === true,
        }));
      acts.push({
        act: a,
        id: actIds[a - 1] || null,
        entered: inAct.length > 0,
        bosses,
        // その章のボスを全員倒した（3章の2連戦は2体とも）
        cleared: bosses.length > 0 && bosses.every((b) => b.defeated),
      });
    }
    return acts;
  }

  function death(raw) {
    if (raw.win === true) return null;
    const enc = raw.killed_by_encounter;
    const ev = raw.killed_by_event;
    if (typeof enc === 'string' && enc && enc !== NONE) return { kind: 'encounter', id: enc };
    // イベント戦闘で負けた場合は killed_by_encounter が NONE.NONE で、こちらに入る
    if (typeof ev === 'string' && ev && ev !== NONE) return { kind: 'event', id: ev };
    return null;
  }

  function normalizeRun(raw, file) {
    const players = asArray(raw.players).map((pl) => ({
      id: pl && pl.id != null ? String(pl.id) : null,
      character: safe(() => pl.character),
      raw: pl,
    }));
    const points = normalizePoints(raw);
    const startTime = typeof raw.start_time === 'number' ? raw.start_time : null;
    const abandoned = raw.was_abandoned === true;
    return {
      key: STS.parse.runKey(raw),
      file: file || null,
      seed: raw.seed ?? null,
      startTime,
      date: startTime != null ? new Date(startTime * 1000) : null,
      buildId: typeof raw.build_id === 'string' ? raw.build_id : null,
      schema: raw.schema_version ?? null,
      ascension: typeof raw.ascension === 'number' ? raw.ascension : null,
      win: raw.win === true,
      abandoned,
      // ネオー（開始地点）での放棄
      abandonedAtNeow: abandoned && points.length <= 1,
      runTime: typeof raw.run_time === 'number' ? raw.run_time : null,
      // シングルか協力かは players の人数で判定する（3人協力もある）
      mode: players.length > 1 ? 'coop' : 'single',
      playerCount: players.length,
      players,
      points,
      floorReached: points.length ? points[points.length - 1].floor : null,
      acts: normalizeActs(raw, points),
      death: death(raw),
      raw,
    };
  }

  // "v0.111.0" を並べ替えに使える数値の配列にする
  function versionParts(v) {
    const m = typeof v === 'string' && v.match(/(\d+)\.(\d+)(?:\.(\d+))?/);
    return m ? [Number(m[1]), Number(m[2]), Number(m[3] || 0)] : [0, 0, 0];
  }
  function compareVersion(a, b) {
    const x = versionParts(a), y = versionParts(b);
    for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i];
    return 0;
  }

  return { normalizeRun, pointType, compareVersion };
})();
