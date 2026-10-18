// 画面全体の組み立てと切り替え。
window.STS = window.STS || {};

(function () {
  const T = STS.T;
  const SELF_KEY = 'selfId';

  // 画面全体で使う状態
  const state = (STS.state = {
    runs: [],          // 整えたラン（normalizeRun の結果）
    selfId: null,      // 協力プレイでの「自分」のID（文字列）
    selfAuto: [],      // 自動判定の候補
    lastImport: null,
    folder: null,
  });

  // ---- 小さな道具
  function el(tag, attrs, ...children) {
    const e = document.createElement(tag);
    if (attrs) for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') e.className = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else if (v === true) e.setAttribute(k, '');
      else if (v !== false && v != null) e.setAttribute(k, v);
    }
    for (const c of children.flat(Infinity)) if (c != null && c !== false) e.append(c instanceof Node ? c : String(c));
    return e;
  }
  // SteamIDは画面では伏せ字にする（末尾4桁だけ表示）
  const maskId = (id) => (id && id.length > 4 ? `ID ••••${id.slice(-4)}` : `ID ${id || T.unknown}`);
  STS.maskId = maskId;
  const fmtDate = (d) => (d ? `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}` : T.unknown);

  // ---- データ
  async function loadFromStorage() {
    const records = await STS.storage.getAllRuns();
    state.runs = records.map((r) => {
      try { const n = STS.normalize.normalizeRun(r.raw, r.file); n.fakeIds = !!r.fakeIds; return n; } catch (e) { return null; }
    }).filter(Boolean).sort((a, b) => (a.startTime || 0) - (b.startTime || 0));
    detectSelf();
    const saved = await STS.storage.getMeta(SELF_KEY).catch(() => null);
    if (saved) state.selfId = saved;
    else state.selfId = state.selfAuto.length === 1 ? state.selfAuto[0] : null;
    state.folder = STS.loader.folderSupported() ? await STS.loader.getSavedFolder() : null;
  }

  // 協力ランのすべてに登場するIDを「自分」の候補にする
  function detectSelf() {
    const coop = state.runs.filter((r) => r.mode === 'coop');
    const counts = new Map();
    coop.forEach((r) => new Set(r.players.map((p) => p.id)).forEach((id) => counts.set(id, (counts.get(id) || 0) + 1)));
    state.coopIdCounts = counts;
    state.coopTotal = coop.length;
    state.selfAuto = coop.length ? [...counts].filter(([, n]) => n === coop.length).map(([id]) => id) : [];
  }

  function knownSets() {
    return {
      // 架空のIDで保存しているランは、同じファイルでも読み直して本物のIDに置き換える
      files: new Set(state.runs.filter((r) => !r.fakeIds).map((r) => r.file).filter(Boolean)),
      keys: new Set(state.runs.map((r) => r.key)),
      fakeKeys: new Set(state.runs.filter((r) => r.fakeIds).map((r) => r.key)),
    };
  }

  function summary() {
    const runs = state.runs;
    const versions = runs.map((r) => r.buildId).filter(Boolean).sort(STS.normalize.compareVersion);
    return {
      total: runs.length,
      single: runs.filter((r) => r.mode === 'single').length,
      coop: runs.filter((r) => r.mode === 'coop').length,
      coop2: runs.filter((r) => r.playerCount === 2).length,
      coop3: runs.filter((r) => r.playerCount >= 3).length,
      wins: runs.filter((r) => r.win).length,
      abandoned: runs.filter((r) => r.abandoned).length,
      from: fmtDate(runs[0] && runs[0].date),
      to: fmtDate(runs.length && runs[runs.length - 1].date),
      vFrom: versions[0] || T.unknown,
      vTo: versions[versions.length - 1] || T.unknown,
    };
  }

  // ---- 読み込み画面
  const msgBox = el('p', { class: 'msg', 'aria-live': 'polite' });

  function setMsg(text, kind) {
    msgBox.className = `msg ${kind || ''}`;
    msgBox.textContent = text || '';
  }

  async function runImport(getEntries) {
    setMsg(T.load.working);
    try {
      const entries = await getEntries();
      const r = await STS.loader.importEntries(entries, knownSets(), (i, n) => setMsg(`${T.load.working} ${i} / ${n}`));
      state.lastImport = r;
      await loadFromStorage();
      render();
      if (r.runFiles === 0) setMsg(T.load.noRunFound, 'warn');
      else setMsg(T.load.result(r), r.errors.length ? 'warn' : 'ok');
    } catch (e) {
      if (e && e.name === 'AbortError') { setMsg(''); return; } // 選択画面で「キャンセル」した
      if (e && e.name === 'Permission') { setMsg(e.message, 'error'); return; }
      setMsg(`${T.load.pickFailed}（${e && e.message || e}）`, 'error');
    }
  }

  function renderLoad() {
    const L = T.load;
    const panel = document.getElementById('panel-load');
    panel.replaceChildren();

    // 場所の説明
    panel.append(el('div', { class: 'card' },
      el('h2', null, L.heading),
      el('p', null, L.where),
      el('p', { class: 'path' }, L.path),
      el('p', null, L.whyCopy),
      el('ol', null, L.steps.map((s) => el('li', null, s))),
      el('p', { class: 'note' }, L.oneDrive),
      el('details', { class: 'how' }, el('summary', null, L.mac.heading),
        el('p', null, L.mac.where), el('p', { class: 'path' }, L.mac.path),
        el('p', { class: 'note' }, L.mac.finder), el('p', { class: 'note' }, L.mac.why),
        el('ol', null, L.mac.steps.map((s) => el('li', null, s))),
        el('p', { class: 'note' }, L.mac.oneLiner), el('pre', { class: 'path cmd' }, L.mac.command),
        el('p', { class: 'note' }, L.mac.safari)),
      el('p', { class: 'note' }, L.noAuto),
    ));

    // フォルダ記憶（Chrome / Edge）
    const folderCard = el('div', { class: 'card' }, el('h3', null, L.folderHeading));
    if (STS.loader.folderSupported()) {
      folderCard.append(
        el('p', { class: 'note' }, state.folder ? L.rememberedFolder(state.folder.name) : L.noFolder),
        el('div', { class: 'btn-row' },
          el('button', {
            type: 'button', class: 'btn primary', disabled: !state.folder,
            onclick: () => runImport(async () => {
              if (!(await STS.loader.ensurePermission(state.folder))) {
                const err = new Error(T.load.permissionDenied); err.name = 'Permission'; throw err;
              }
              return STS.loader.entriesFromFolder(state.folder);
            }),
          }, L.readNew),
          el('button', {
            type: 'button', class: state.folder ? 'btn' : 'btn primary',
            onclick: () => runImport(async () => {
              const h = await STS.loader.pickFolder();
              state.folder = h;
              return STS.loader.entriesFromFolder(h);
            }),
          }, L.pickFolder),
          state.folder && el('button', {
            type: 'button', class: 'btn',
            onclick: async () => { await STS.loader.forgetFolder(); state.folder = null; render(); },
          }, L.forgetFolder),
        ),
        el('p', { class: 'note' }, L.permissionHelp),
      );
    } else {
      folderCard.append(el('p', { class: 'msg warn' }, L.folderUnsupported));
    }
    folderCard.append(msgBox);
    if (state.lastImport && state.lastImport.errors.length) {
      folderCard.append(el('h3', null, L.errorsHeading),
        el('ul', { class: 'compact' }, state.lastImport.errors.slice(0, 50).map((e) => el('li', null, `${e.name}：${e.error}`))));
    }
    panel.append(folderCard);

    // 別の方法
    const fileInput = el('input', { type: 'file', multiple: true, accept: '.run', hidden: true,
      onchange: (ev) => { const fs = ev.target.files; runImport(async () => STS.loader.entriesFromFiles(fs)); ev.target.value = ''; } });
    const drop = el('div', { class: 'dropzone' }, L.drop);
    drop.addEventListener('dragover', (ev) => { ev.preventDefault(); drop.classList.add('over'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('over'));
    drop.addEventListener('drop', (ev) => {
      ev.preventDefault(); drop.classList.remove('over');
      const dt = ev.dataTransfer;
      const pending = STS.loader.entriesFromDrop(dt); // 読み取りはイベント中に始める必要がある
      runImport(() => pending);
    });
    panel.append(el('div', { class: 'card' },
      el('h3', null, L.fallbackHeading),
      el('p', { class: 'note' }, L.fallbackWhy),
      el('div', { class: 'btn-row' },
        el('button', { type: 'button', class: 'btn', onclick: () => fileInput.click() }, L.pickFiles),
      ),
      el('p', { class: 'note' }, L.pickFilesHelp),
      fileInput, drop,
    ));

    // 保存しているデータ
    const s = summary();
    panel.append(el('div', { class: 'card' },
      el('h3', null, L.storedHeading),
      s.total ? [el('p', null, L.stored(s)), el('p', { class: 'note' }, L.storedDetail(s))] : el('p', null, L.storedNone),
      el('div', { class: 'btn-row' },
        el('button', {
          type: 'button', class: 'btn danger', disabled: !s.total && !state.folder,
          onclick: async () => {
            if (!confirm(L.clearConfirm)) return;
            await STS.storage.clearAll(['dictionary', 'challenges', 'challengeMarks', 'nicknames']);
            state.lastImport = null;
            await loadFromStorage();
            render();
          },
        }, L.clearAll),
      ),
    ));

    panel.append(renderSelf());
    panel.append(renderSave());
  }

  // ---- データの保存（書き出し・読み込み・CSV）
  const saveUi = { purpose: 'self', scope: 'all' };
  function renderSave() {
    const B = T.backup;
    const msg = el('p', { class: 'msg', 'aria-live': 'polite' });
    const say = (text, kind) => { msg.className = `msg ${kind || ''}`; msg.textContent = text; };
    const radios = (name, key, opts) => el('div', { class: 'options' }, opts.map(([v, label]) => el('label', { class: 'check' },
      el('input', { type: 'radio', name, checked: saveUi[key] === v, onchange: () => { saveUi[key] = v; render(); } }), ' ', label)));
    const fileInput = el('input', { type: 'file', accept: '.json,application/json', hidden: true, onchange: async (ev) => {
      const file = ev.target.files[0]; ev.target.value = '';
      if (!file) return;
      let data;
      try { data = STS.backup.parse(await file.text()); } catch (e) { say(B.importBad, 'error'); return; }
      const s = STS.backup.summarize(data);
      if (!confirm(B.importConfirm(s))) return;
      say(B.working);
      try {
        const r = await STS.backup.apply(data);
        await STS.dict.load(); await STS.challenges.load(); await STS.coop.load();
        await loadFromStorage();
        render();
        STS.renderAll();
        setTimeout(() => { const m = document.querySelector('#panel-load .save-msg'); if (m) { m.className = 'msg ok save-msg'; m.textContent = B.imported(r); } }, 0);
      } catch (e) { say(`${B.importFailed}（${e && e.message || e}）`, 'error'); }
    } });
    msg.classList.add('save-msg');
    return el('div', { class: 'card' },
      el('h3', null, B.heading),
      el('p', null, el('strong', null, B.purpose)),
      radios('save-purpose', 'purpose', [['self', B.purposeSelf], ['share', B.purposeShare]]),
      el('p', { class: saveUi.purpose === 'self' ? 'msg warn' : 'note' }, saveUi.purpose === 'self' ? B.selfWarn : B.shareNote),
      el('p', null, el('strong', null, B.scope)),
      radios('save-scope', 'scope', [['all', B.scopeAll], ['settings', B.scopeSettings]]),
      el('p', { class: 'note' }, saveUi.scope === 'all' ? B.scopeAllNote : B.scopeSettingsNote),
      el('div', { class: 'btn-row' },
        el('button', { type: 'button', class: 'btn primary', onclick: async () => {
          say(B.working);
          try {
            const text = await STS.backup.build(saveUi.purpose, saveUi.scope);
            const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
            const a = el('a', { href: url, download: STS.backup.fileName(saveUi.purpose, saveUi.scope) });
            document.body.append(a); a.click(); a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 2000);
            say(B.exported((text.length / 1024 / 1024).toFixed(1)), 'ok');
          } catch (e) { say(`${B.exportFailed}（${e && e.message || e}）`, 'error'); }
        } }, B.exportBtn),
        el('button', { type: 'button', class: 'btn', onclick: () => fileInput.click() }, B.importBtn),
        fileInput),
      el('p', { class: 'note' }, B.importNote),
      msg,
      el('h3', null, T.csv.heading),
      el('p', { class: 'note' }, T.csv.note),
      el('div', { class: 'btn-row' }, el('button', { type: 'button', class: 'btn', disabled: !state.runs.length,
        onclick: () => STS.csv.download(`sts2-runs-${STS.csv.today()}.csv`, STS.csv.runRows(state.runs, state.selfId)) }, T.csv.runsButton)));
  }

  // 協力プレイの「自分」の確認
  function renderSelf() {
    const S = T.self;
    const card = el('div', { class: 'card' }, el('h3', null, S.heading));
    if (!state.coopTotal) { card.append(el('p', { class: 'note' }, S.none)); return card; }
    card.append(el('p', { class: 'note' }, S.help));
    if (state.selfAuto.length !== 1) card.append(el('p', { class: 'msg warn' }, S.ambiguous));
    const ids = [...state.coopIdCounts].sort((a, b) => b[1] - a[1]);
    const form = el('div');
    ids.forEach(([id, n]) => {
      const input = el('input', { type: 'radio', name: 'self-id', value: id, checked: id === state.selfId });
      form.append(el('label', { class: 'choice' }, input, ' ', S.row(maskId(id), n, state.coopTotal),
        state.selfAuto.length === 1 && state.selfAuto[0] === id ? `　［${S.auto}］` : ''));
    });
    const note = el('span', { class: 'msg ok' });
    card.append(form, el('div', { class: 'btn-row' },
      el('button', {
        type: 'button', class: 'btn',
        onclick: async () => {
          const chosen = form.querySelector('input[name="self-id"]:checked');
          if (!chosen) return;
          state.selfId = chosen.value;
          await STS.storage.setMeta(SELF_KEY, chosen.value);
          await STS.storage.deleteMeta('selfIdFake'); // 自分で選び直したので、架空のIDの印は外す
          note.textContent = S.saved;
          STS.renderAll();
        },
      }, S.save), note));
    return card;
  }

  // 集計画面は表示中のタブだけ作り直す（他のタブは開いたときに作る）
  let currentTab = 'load';
  const dirty = new Set();
  function renderPanel(name) {
    if (name === 'load') renderLoad();
    else if (name === 'dict') STS.views.renderDict();
    else STS.views.renderTab(name);
    dirty.delete(name);
  }
  function render() {
    ['load', 'single', 'coop', 'dict'].forEach((n) => dirty.add(n));
    renderPanel(currentTab);
  }
  // 辞書の変更などで集計画面の表示名が変わったとき
  STS.renderAll = () => {
    ['single', 'coop'].forEach((n) => dirty.add(n));
    if (currentTab === 'single' || currentTab === 'coop') renderPanel(currentTab);
  };

  // ---- タブ
  function selectTab(name) {
    currentTab = name;
    document.querySelectorAll('.tabs button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === name)));
    document.querySelectorAll('.panel').forEach((p) => { p.hidden = p.dataset.panel !== name; });
    if (dirty.has(name)) renderPanel(name);
  }

  async function init() {
    document.getElementById('app-title').textContent = T.appTitle;
    document.getElementById('app-note').textContent = T.appNote;
    document.querySelectorAll('.tabs button').forEach((b) => {
      b.textContent = T.tabs[b.dataset.tab];
      b.addEventListener('click', () => selectTab(b.dataset.tab));
    });
    // 保存データの読み込み中（件数が多いと数秒かかる）は、その旨を表示しておく
    document.querySelector('.tabs button[data-tab="load"]').setAttribute('aria-selected', 'true');
    document.getElementById('panel-load').replaceChildren(el('div', { class: 'card' }, el('p', null, T.startup)));
    try { await STS.dict.load(); await STS.challenges.load(); await STS.coop.load(); await loadFromStorage(); } catch (e) { setMsg(String(e && e.message || e), 'error'); }
    render();
    selectTab('load');
  }

  init();
})();
