// .run（中身はJSON）を読む。
// 協力プレイのIDは17桁のSteamIDで、JSON.parse にそのまま渡すと桁落ちする
// （JavaScriptの数値は約16桁までしか正確に表せない）。
// そこで、文字列の外にある16桁以上の整数を "..." で囲んで文字列として読む。
window.STS = window.STS || {};

STS.parse = (function () {
  const BIG_DIGITS = 16;

  function quoteBigIntegers(text) {
    const out = [];
    let last = 0;
    let inString = false;
    const n = text.length;
    for (let i = 0; i < n; i++) {
      const c = text.charCodeAt(i);
      if (inString) {
        if (c === 92) i++; // \ の次の文字は飛ばす
        else if (c === 34) inString = false; // "
        continue;
      }
      if (c === 34) { inString = true; continue; }
      const isDigit = c >= 48 && c <= 57;
      if (!isDigit && c !== 45) continue; // 数字か - 以外は関係ない
      let j = i + (c === 45 ? 1 : 0);
      const start = j;
      while (j < n && text.charCodeAt(j) >= 48 && text.charCodeAt(j) <= 57) j++;
      const next = j < n ? text[j] : '';
      if (j - start >= BIG_DIGITS && next !== '.' && next !== 'e' && next !== 'E') {
        out.push(text.slice(last, i), '"', text.slice(i, j), '"');
        last = j;
      }
      i = j - 1;
    }
    if (last === 0) return text;
    out.push(text.slice(last));
    return out.join('');
  }

  // 戻り値：{ ok: true, run } または { ok: false, error }
  function parseRunText(text) {
    try {
      if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // BOM（先頭の目印の文字）を除く
      const run = JSON.parse(quoteBigIntegers(text));
      if (!run || typeof run !== 'object' || Array.isArray(run)) {
        return { ok: false, error: 'JSONの形が想定と違います' };
      }
      return { ok: true, run };
    } catch (e) {
      return { ok: false, error: `JSONとして読めませんでした（${e && e.message || e}）` };
    }
  }

  // 同一ランの判定に使うキー（seed と start_time が同じなら同じラン）
  function runKey(run) {
    return `${run.seed}_${run.start_time}`;
  }

  return { parseRunText, runKey, quoteBigIntegers };
})();
