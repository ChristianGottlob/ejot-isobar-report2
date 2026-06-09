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

export async function loadDocument() {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx  = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(KEY);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror   = () => reject(req.error);
    });
  } catch (e) {
    console.warn("idb load failed:", e);
    return null;
  }
}

export async function saveDocument(payload) {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(payload, KEY);
      tx.oncomplete = () => resolve(true);
      tx.onerror    = () => reject(tx.error);
      tx.onabort    = () => reject(tx.error || new Error("idb tx aborted"));
    });
  } catch (e) {
    // Quota errors and similar end up here; surface so the caller can warn the user.
    console.warn("idb save failed:", e);
    return false;
  }
}

export async function clearDocument() {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(KEY);
      tx.oncomplete = () => resolve(true);
      tx.onerror    = () => reject(tx.error);
    });
  } catch (e) {
    console.warn("idb clear failed:", e);
    return false;
  }
}
