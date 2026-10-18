// ブラウザ内への保存（IndexedDB：ブラウザに内蔵された保存場所）。
// ここに保存したデータは、このブラウザの中だけにあり、外部には送られない。
window.STS = window.STS || {};

STS.storage = (function () {
  const DB_NAME = 'sts2-stats';
  const DB_VERSION = 1;
  let dbPromise = null;

  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        // runs：読み込んだラン（key = seed_start_time）
        if (!db.objectStoreNames.contains('runs')) db.createObjectStore('runs', { keyPath: 'key' });
        // meta：設定や記憶したフォルダなど（名前 → 値）
        if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta');
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  function done(tx) {
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }
  function result(req) {
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  // records: [{ key, file, addedAt, raw }]
  async function putRuns(records) {
    if (!records.length) return;
    const db = await open();
    const tx = db.transaction('runs', 'readwrite');
    const store = tx.objectStore('runs');
    records.forEach((r) => store.put(r));
    await done(tx);
  }

  async function getAllRuns() {
    const db = await open();
    return result(db.transaction('runs').objectStore('runs').getAll());
  }

  async function getMeta(name) {
    const db = await open();
    return result(db.transaction('meta').objectStore('meta').get(name));
  }

  async function setMeta(name, value) {
    const db = await open();
    const tx = db.transaction('meta', 'readwrite');
    tx.objectStore('meta').put(value, name);
    await done(tx);
  }

  async function deleteMeta(name) {
    const db = await open();
    const tx = db.transaction('meta', 'readwrite');
    tx.objectStore('meta').delete(name);
    await done(tx);
  }

  // ラン・設定・記憶したフォルダを消す。keep に挙げた設定（日本語名辞書など）は残す
  async function clearAll(keep = []) {
    const db = await open();
    const kept = [];
    for (const k of keep) kept.push([k, await getMeta(k)]);
    const tx = db.transaction(['runs', 'meta'], 'readwrite');
    tx.objectStore('runs').clear();
    const meta = tx.objectStore('meta');
    meta.clear();
    kept.forEach(([k, v]) => { if (v !== undefined) meta.put(v, k); });
    await done(tx);
  }

  return { putRuns, getAllRuns, getMeta, setMeta, deleteMeta, clearAll };
})();
