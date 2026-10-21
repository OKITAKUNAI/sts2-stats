// ファイルの読み込み。
// ・Chrome / Edge：history フォルダを選ばせて記憶し、次回からは未読の .run だけを読む
// ・それ以外：ファイル選択・フォルダ選択・ドラッグ＆ドロップ
// .run.backup は .run の完全なコピーなので読まず、件数だけ数える。
window.STS = window.STS || {};

STS.loader = (function () {
  const FOLDER_KEY = 'historyFolder';

  const folderSupported = () => typeof window.showDirectoryPicker === 'function';

  // entries: [{ name, size, mtime, read: () => Promise<string> }]（size・mtime はファイルの大きさと更新日時。分からなければ省略）
  // known: { files: Map(ファイル名 → { key, size, mtime }), keys: Set(ランのキー), fakeKeys: Set(架空のIDで保存しているランのキー) }
  // ・読み込み済みのファイルは、大きさも更新日時も前回と同じなら読み直さない。変わっていれば読み直し、同じランなら中身を更新する
  // ・読み込みに失敗したファイルは覚えないので、次の読み込みでもう一度読む
  // ・同じランかどうかは seed と start_time で判定し、二重には数えない
  // ・同じランが架空のID（共有用バックアップから復元したもの）で保存されていれば、本物のIDで置き換える
  async function importEntries(entries, known, onProgress) {
    const r = { added: 0, replaced: 0, updated: 0, known: 0, dup: 0, backup: 0, other: 0, otherNames: [], errors: [], runFiles: 0, records: [] };
    const metaFixes = []; // 前の版で読み込んだため大きさ・更新日時を覚えていないファイル（読み直さずに記録だけ足す）
    const meta = (e) => ({ fileSize: typeof e.size === 'number' ? e.size : null, fileMtime: typeof e.mtime === 'number' ? e.mtime : null });
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
      const m = meta(e);
      const prev = known.files.get(name);
      if (prev) {
        const noInfo = m.fileSize == null || m.fileMtime == null;
        if (prev.size == null || prev.mtime == null) {
          // 前の版で読み込んだファイル：読み直さず、今の大きさ・更新日時を覚えるだけ
          if (!noInfo && prev.key) metaFixes.push({ key: prev.key, ...m });
          r.known += 1;
          continue;
        }
        if (noInfo || (prev.size === m.fileSize && prev.mtime === m.fileMtime)) { r.known += 1; continue; }
        // 大きさか更新日時が変わった：読み直す（下へ）
      }
      let text;
      try { text = await e.read(); } catch (err) { r.errors.push({ name, error: String(err && err.message || err) }); continue; }
      const p = STS.parse.parseRunText(text);
      if (!p.ok) { r.errors.push({ name, error: p.error }); continue; }
      const key = STS.parse.runKey(p.run);
      if (prev && prev.key === key) {
        // 同じファイル・同じラン：中身を新しくする（二重には数えない）
        r.records.push({ key, file: name, addedAt: Date.now(), raw: p.run, fakeIds: false, ...m });
        known.files.set(name, { key, size: m.fileSize, mtime: m.fileMtime });
        r.updated += 1;
        continue;
      }
      if (known.keys.has(key)) {
        if (known.fakeKeys && known.fakeKeys.has(key)) {
          known.fakeKeys.delete(key);
          known.files.set(name, { key, size: m.fileSize, mtime: m.fileMtime });
          r.records.push({ key, file: name, addedAt: Date.now(), raw: p.run, fakeIds: false, ...m });
          r.replaced += 1;
          continue;
        }
        // 別の名前のファイルに同じランが入っている：二重に数えない
        r.dup += 1;
        continue;
      }
      known.keys.add(key);
      known.files.set(name, { key, size: m.fileSize, mtime: m.fileMtime });
      r.records.push({ key, file: name, addedAt: Date.now(), raw: p.run, ...m });
      r.added += 1;
      if (onProgress && i % 25 === 0) onProgress(i, entries.length);
    }
    if (r.records.length) await STS.storage.putRuns(r.records);
    if (metaFixes.length) await STS.storage.updateRunMeta(metaFixes);
    if (r.replaced) await STS.backup.onRealReplaced();
    return r;
  }

  // <input type=file> やドラッグ＆ドロップで得た File の一覧
  function entriesFromFiles(files) {
    return Array.from(files).map((f) => ({ name: f.name, size: f.size, mtime: f.lastModified, read: () => f.text() }));
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
      // 大きさと更新日時を知るために File を取り出す（中身はまだ読まない）
      let file = null;
      try { file = await item.getFile(); } catch (e) { /* 読めないファイルは read のときにエラーとして数える */ }
      entries.push({
        name: item.name,
        size: file ? file.size : undefined,
        mtime: file ? file.lastModified : undefined,
        read: async () => (file || await item.getFile()).text(),
      });
    }
    return entries;
  }

  return {
    folderSupported, importEntries, entriesFromFiles, entriesFromDrop,
    getSavedFolder, pickFolder, forgetFolder, checkPermission, ensurePermission, entriesFromFolder,
  };
})();
