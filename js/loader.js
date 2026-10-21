// ファイルの読み込み。
// ・Chrome / Edge：history フォルダを選ばせて記憶し、次回からは未読の .run だけを読む
// ・それ以外：ファイル選択・フォルダ選択・ドラッグ＆ドロップ
// .run.backup は .run の完全なコピーなので読まず、件数だけ数える。
window.STS = window.STS || {};

STS.loader = (function () {
  const FOLDER_KEY = 'historyFolder';

  const folderSupported = () => typeof window.showDirectoryPicker === 'function';

  // entries: [{ name, read: () => Promise<string> }]
  // known: { files: Set(ファイル名), keys: Set(ランのキー), fakeKeys: Set(架空のIDで保存しているランのキー) }
  // 同じランが架空のID（共有用バックアップから復元したもの）で保存されていれば、本物のIDで置き換える
  async function importEntries(entries, known, onProgress) {
    const r = { added: 0, replaced: 0, known: 0, dup: 0, backup: 0, other: 0, otherNames: [], errors: [], runFiles: 0, records: [] };
    // OSが自動で作る隠しファイルは、飛ばしたファイル名の例に出さない（件数には数える）
    const SYSTEM_FILES = ['desktop.ini', 'thumbs.db', '.ds_store'];
    let i = 0;
    for (const e of entries) {
      i += 1;
      const name = e.name;
      const lower = name.toLowerCase();
      if (lower.endsWith('.run.backup')) { r.backup += 1; continue; }
      if (!lower.endsWith('.run')) {
        r.other += 1;
        // 名前が違うファイルに気づけるよう、例として最大5件まで名前を残す
        if (r.otherNames.length < 5 && !SYSTEM_FILES.includes(lower) && !name.startsWith('.')) r.otherNames.push(name);
        continue;
      }
      r.runFiles += 1;
      if (known.files.has(name)) { r.known += 1; continue; }
      let text;
      try { text = await e.read(); } catch (err) { r.errors.push({ name, error: String(err && err.message || err) }); continue; }
      const p = STS.parse.parseRunText(text);
      if (!p.ok) { r.errors.push({ name, error: p.error }); continue; }
      const key = STS.parse.runKey(p.run);
      if (known.keys.has(key)) {
        if (known.fakeKeys && known.fakeKeys.has(key)) {
          known.fakeKeys.delete(key);
          known.files.add(name);
          r.records.push({ key, file: name, addedAt: Date.now(), raw: p.run, fakeIds: false });
          r.replaced += 1;
          continue;
        }
        r.dup += 1; known.files.add(name); continue;
      }
      known.keys.add(key);
      known.files.add(name);
      r.records.push({ key, file: name, addedAt: Date.now(), raw: p.run });
      r.added += 1;
      if (onProgress && i % 25 === 0) onProgress(i, entries.length);
    }
    if (r.records.length) await STS.storage.putRuns(r.records);
    if (r.replaced) await STS.backup.onRealReplaced();
    return r;
  }

  // <input type=file> やドラッグ＆ドロップで得た File の一覧
  function entriesFromFiles(files) {
    return Array.from(files).map((f) => ({ name: f.name, read: () => f.text() }));
  }

  // ドラッグ＆ドロップ：フォルダが落とされた場合は中身もたどる
  async function entriesFromDrop(dataTransfer) {
    const items = Array.from(dataTransfer.items || []);
    const fsEntries = items.map((it) => it.webkitGetAsEntry && it.webkitGetAsEntry()).filter(Boolean);
    if (!fsEntries.length) return entriesFromFiles(dataTransfer.files || []);
    const files = [];
    async function walk(entry) {
      if (entry.isFile) {
        files.push(await new Promise((res, rej) => entry.file(res, rej)));
      } else if (entry.isDirectory) {
        const reader = entry.createReader();
        // readEntries は一度に全部返さないことがあるので、空になるまで繰り返す
        for (;;) {
          const batch = await new Promise((res, rej) => reader.readEntries(res, rej));
          if (!batch.length) break;
          for (const child of batch) await walk(child);
        }
      }
    }
    for (const e of fsEntries) await walk(e);
    return entriesFromFiles(files);
  }

  // ---- フォルダ記憶（File System Access API：Chrome / Edge の機能）
  async function getSavedFolder() {
    try { return (await STS.storage.getMeta(FOLDER_KEY)) || null; } catch (e) { return null; }
  }

  async function pickFolder() {
    const handle = await window.showDirectoryPicker({ id: 'sts2-history', mode: 'read' });
    await STS.storage.setMeta(FOLDER_KEY, handle);
    return handle;
  }

  async function forgetFolder() {
    await STS.storage.deleteMeta(FOLDER_KEY);
  }

  // 読む許可を確認し、必要ならブラウザの確認画面を出す（ボタンを押した直後に呼ぶ必要がある）
  // 許可があるかを尋ねるだけ（確認画面は出さない）。ページを開いたときの自動読み込みに使う
  // 戻り値：'granted'（許可済み）／'prompt'（尋ねる必要がある）／'denied'（拒否）
  async function checkPermission(handle) {
    try {
      return handle && handle.queryPermission ? await handle.queryPermission({ mode: 'read' }) : 'prompt';
    } catch (e) { return 'prompt'; }
  }

  async function ensurePermission(handle) {
    const opts = { mode: 'read' };
    if (handle.queryPermission && (await handle.queryPermission(opts)) === 'granted') return true;
    if (handle.requestPermission && (await handle.requestPermission(opts)) === 'granted') return true;
    return false;
  }

  async function entriesFromFolder(handle) {
    const entries = [];
    for await (const item of handle.values()) {
      if (item.kind !== 'file') continue;
      entries.push({ name: item.name, read: async () => (await item.getFile()).text() });
    }
    return entries;
  }

  return {
    folderSupported, importEntries, entriesFromFiles, entriesFromDrop,
    getSavedFolder, pickFolder, forgetFolder, checkPermission, ensurePermission, entriesFromFolder,
  };
})();
