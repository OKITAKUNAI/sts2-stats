// CSV書き出し。
// ・Excel で文字化けしないよう、先頭に BOM を付けた UTF-8 で保存する
// ・「=」「+」「-」「@」で始まる値は、Excel が計算式として扱わないよう先頭に ' を付ける
// ・SteamID とニックネームは一切含めない（呼び出し側で列を除く）
window.STS = window.STS || {};

STS.csv = (function () {
  function cell(v) {
    let s = v == null ? '' : String(v);
    if (/^[=+\-@]/.test(s)) s = `'${s}`;
    if (/[",\r\n]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
    return s;
  }
  const toText = (rows) => `﻿${rows.map((r) => r.map(cell).join(',')).join('\r\n')}\r\n`;

  function download(filename, rows) {
    const url = URL.createObjectURL(new Blob([toText(rows)], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const today = () => {
    const d = new Date();
    return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  };

  // 画面の表示（要素）を文字にする。入力欄は値を使う
  function textOf(v) {
    if (v == null || v === false) return '';
    if (!(v instanceof Node)) return String(v);
    if (v instanceof HTMLInputElement) return v.type === 'checkbox' ? (v.checked ? '✓' : '') : v.value;
    if (v instanceof HTMLSelectElement) return v.value;
    return (v.textContent || '').trim();
  }

  // ラン一覧（1行1ラン。協力は「自分」の分。相方はキャラ名だけ）
  function runRows(runs, selfId) {
    const T = STS.T;
    const name = (id) => (id ? STS.dict.name(id) : '');
    const fmt = (d) => (d ? `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : '');
    const C = T.csvCols;
    const rows = [[C.date, C.mode, C.char, C.asc, C.result, C.floor, C.death, C.time, C.version, C.deck, C.relics, C.partners, C.seed]];
    [...runs].sort((a, b) => (a.startTime || 0) - (b.startTime || 0)).forEach((r) => {
      let pi = 0;
      if (r.mode === 'coop') { const i = r.players.findIndex((p) => p.id === selfId); pi = i >= 0 ? i : 0; }
      const pl = r.players[pi] || {};
      const raw = pl.raw || {};
      rows.push([
        fmt(r.date), r.mode === 'coop' ? T.tabs.coop : T.tabs.single, name(pl.character), r.ascension ?? '',
        r.win ? T.runs.win : r.abandoned ? T.runs.abandoned : T.runs.loss,
        r.floorReached ?? '', r.win ? '' : r.death ? name(r.death.id) : T.unknown,
        r.runTime ?? '', r.buildId || '',
        Array.isArray(raw.deck) ? raw.deck.length : '', Array.isArray(raw.relics) ? raw.relics.length : '',
        r.players.filter((_, i) => i !== pi).map((p) => name(p.character)).join('・'),
        r.seed ?? '',
      ]);
    });
    return rows;
  }

  return { download, today, textOf, runRows, cell };
})();
