// Tiny IndexedDB wrapper for persisting the current document.
//
// We use IndexedDB (not localStorage) because plan dataURLs can easily
// exceed the 5 MB localStorage quota per origin.  IDB handles MB-sized
// blobs effortlessly and the API is async/non-blocking.
//
// One DB, one store, one key — we only persist the "current" document.
// Multi-project support is out of scope for v1.

const DB_NAME = "ejot-isobar-eco";
const STORE   = "documents";
const VERSION = 1;
const KEY     = "current";

function isIDBAvailable() {
  try { return typeof indexedDB !== "undefined"; } catch { return false; }
}

function openDb() {
  return new Promise((resolve, reject) => {
    if (!isIDBAvailable()) return reject(new Error("IndexedDB not available"));
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
    req.onblocked = () => reject(new Error("IndexedDB open blocked"));
  });
}

function normalizeRecord(record) {
  if (record && typeof record === "object" && "version" in record && "payload" in record) {
    return record;
  }
  return { version: 0, payload: record || null };
}

export async function loadDocument() {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx  = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(KEY);
      req.onsuccess = () => resolve(normalizeRecord(req.result));
      req.onerror   = () => reject(req.error);
    });
  } catch (e) {
    console.warn("idb load failed:", e);
    return { version: 0, payload: null };
  }
}

export async function saveDocument(payload, expectedVersion) {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      const readReq = store.get(KEY);
      let nextVersion = 0;
      let currentVersion = 0;
      let conflict = false;
      readReq.onsuccess = () => {
        const current = normalizeRecord(readReq.result);
        currentVersion = current.version;
        if (expectedVersion !== undefined && expectedVersion !== null && current.version !== expectedVersion) {
          conflict = true;
          tx.abort();
          return;
        }
        nextVersion = current.version + 1;
        store.put({ version: nextVersion, payload }, KEY);
      };
      tx.oncomplete = () => resolve({ ok: true, version: nextVersion });
      tx.onerror    = () => {
        if (conflict) return;
        reject(tx.error);
      };
      tx.onabort    = () => {
        if (conflict) {
          resolve({ ok: false, conflict: true, version: currentVersion });
          return;
        }
        reject(tx.error || new Error("idb tx aborted"));
      };
    });
  } catch (e) {
    // Quota errors and similar end up here; surface so the caller can warn the user.
    console.warn("idb save failed:", e);
    return { ok: false, version: null };
  }
}

export async function clearDocument() {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      const readReq = store.get(KEY);
      let nextVersion = 1;
      readReq.onsuccess = () => {
        const current = normalizeRecord(readReq.result);
        nextVersion = current.version + 1;
        store.put({ version: nextVersion, payload: null }, KEY);
      };
      tx.oncomplete = () => resolve({ ok: true, version: nextVersion });
      tx.onerror    = () => reject(tx.error);
    });
  } catch (e) {
    console.warn("idb clear failed:", e);
    return { ok: false, version: null };
  }
}
