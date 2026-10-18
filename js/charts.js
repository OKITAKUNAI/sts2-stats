// 折れ線グラフ（SVG）。外部のライブラリは使わず、ブラウザだけで描く。
window.STS = window.STS || {};

STS.charts = (function () {
  const NS = 'http://www.w3.org/2000/svg';
  function s(tag, attrs, ...children) {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs || {})) if (v != null) e.setAttribute(k, v);
    children.flat().forEach((c) => c != null && e.append(c instanceof Node ? c : document.createTextNode(String(c))));
    return e;
  }

  // opt: {
  //   series: [{ label, cls, points: [{ x, y }] }],  cls は線の色（CSSのクラス）
  //   xMin, xMax, yMin, yMax, yFormat(y), xFormat(x), xLabel, yLabel,
  //   vlines: [{ x, label, cls }],   縦線（バージョンの変わり目、章の区切りなど）
  //   marks: [{ x, y, cls, title }], 点の印（エリート・ボス・死亡など）
  //   height
  // }
  function line(opt) {
    const W = 760, Hh = opt.height || 260;
    const pad = { l: 48, r: 16, t: opt.vlines && opt.vlines.some((v) => v.label) ? 64 : 14, b: 34 };
    const xs = opt.series.flatMap((se) => se.points.map((p) => p.x));
    const ys = opt.series.flatMap((se) => se.points.map((p) => p.y)).filter((y) => y != null);
    const xMin = opt.xMin ?? Math.min(...xs), xMax = opt.xMax ?? Math.max(...xs);
    const yMin = opt.yMin ?? Math.min(0, ...ys), yMax = opt.yMax ?? Math.max(1, ...ys);
    const X = (x) => pad.l + ((x - xMin) / Math.max(1e-9, xMax - xMin)) * (W - pad.l - pad.r);
    const Y = (y) => Hh - pad.b - ((y - yMin) / Math.max(1e-9, yMax - yMin)) * (Hh - pad.t - pad.b);
    const fy = opt.yFormat || ((y) => String(Math.round(y)));
    const fx = opt.xFormat || ((x) => String(x));

    const svg = s('svg', { viewBox: `0 0 ${W} ${Hh}`, class: 'chart', role: 'img', 'aria-label': opt.ariaLabel || '' });
    // 横の目盛り線
    for (let i = 0; i <= 4; i++) {
      const y = yMin + ((yMax - yMin) * i) / 4;
      svg.append(s('line', { x1: pad.l, x2: W - pad.r, y1: Y(y), y2: Y(y), class: 'grid' }),
        s('text', { x: pad.l - 6, y: Y(y) + 4, class: 'tick', 'text-anchor': 'end' }, fy(y)));
    }
    // 縦の目盛り
    const step = Math.max(1, Math.ceil((xMax - xMin) / 10));
    for (let x = Math.ceil(xMin / step) * step; x <= xMax; x += step) {
      svg.append(s('text', { x: X(x), y: Hh - pad.b + 16, class: 'tick', 'text-anchor': 'middle' }, fx(x)));
    }
    if (opt.xLabel) svg.append(s('text', { x: W - pad.r, y: Hh - 4, class: 'axis-label', 'text-anchor': 'end' }, opt.xLabel));
    if (opt.yLabel) svg.append(s('text', { x: 4, y: pad.t - 4, class: 'axis-label' }, opt.yLabel));
    // 縦線（ラベルは上の余白に縦書き風に回転）
    // ラベル同士が近すぎて重なる場合は、後のラベルを省く（線は描く）
    let lastLabelX = -Infinity;
    (opt.vlines || []).forEach((v) => {
      const x = X(v.x);
      svg.append(s('line', { x1: x, x2: x, y1: pad.t, y2: Hh - pad.b, class: `vline ${v.cls || ''}` }, v.label ? s('title', null, v.label) : null));
      if (v.label && x - lastLabelX < 30) return;
      lastLabelX = x;
      if (v.label) svg.append(s('text', { x: x + 3, y: pad.t - 4, class: 'vlabel', transform: `rotate(-45 ${x + 3} ${pad.t - 4})` }, v.label));
    });
    // 線
    opt.series.forEach((se) => {
      let d = '';
      let pen = false;
      se.points.forEach((p) => {
        if (p.y == null) { pen = false; return; }
        d += `${pen ? 'L' : 'M'}${X(p.x).toFixed(1)},${Y(p.y).toFixed(1)}`;
        pen = true;
      });
      svg.append(s('path', { d, class: `series ${se.cls || ''}`, fill: 'none' }));
    });
    // 印
    (opt.marks || []).forEach((m) => {
      svg.append(s('circle', { cx: X(m.x), cy: Y(m.y), r: 4, class: `mark ${m.cls || ''}` }, m.title ? s('title', null, m.title) : null));
    });
    const wrap = document.createElement('div');
    wrap.className = 'chart-wrap';
    wrap.append(svg);
    if (opt.series.length > 1 || opt.legend || opt.series.some((se) => se.label)) {
      const lg = document.createElement('div');
      lg.className = 'legend';
      [...opt.series.map((se) => [se.label, `series ${se.cls || ''}`]), ...(opt.legend || [])].forEach(([label, cls]) => {
        const item = document.createElement('span');
        item.className = 'legend-item';
        const sw = document.createElement('span');
        sw.className = `swatch ${cls}`;
        item.append(sw, label);
        lg.append(item);
      });
      wrap.append(lg);
    }
    return wrap;
  }

  return { line };
})();
