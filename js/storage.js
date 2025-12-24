"use strict";

/**
 * Storage: IndexedDB-backed key/value store with localStorage fallback.
 *
 * Public API (must stay the same):
 * - getJson(key, fallback)
 * - setJson(key, value)
 *
 * Notes:
 * - API remains synchronous-looking to callers by serving reads from an in-memory cache.
 * - IndexedDB is hydrated once asynchronously at startup; writes update cache immediately and
 *   are persisted to IndexedDB in the background.
 * - localStorage is used as a best-effort bootstrap + compatibility mirror and as a fallback
 *   when IndexedDB is unavailable or errors.
 */

(() => {
  const MG = (window.MassageGift = window.MassageGift || {});

  const PREFIX = "massageGift.v1.";
  const DB_NAME = "massageGiftDB";
  const DB_VERSION = 1;
  const STORE_NAME = "kv";

  // Internal meta key (stored like any other key/value as a JSON string).
  const MIGRATION_FLAG_KEY = "__storageMigratedToIDB.v1";
  const RELOAD_GUARD_KEY = "massageGift.idbHydrationReloaded.v1";

  const cache = new Map(); // rawKey -> JSON string
  const pendingWrites = new Map(); // rawKey -> JSON string

  let db = null;
  let idbFailed = false;
  let hydrationComplete = false;
  let startupHadPrefixedData = false;

  function safeLocalStorageGetItem(rawKey) {
    try {
      return localStorage.getItem(rawKey);
    } catch {
      return null;
    }
  }

  function safeLocalStorageSetItem(rawKey, value) {
    try {
      localStorage.setItem(rawKey, value);
      return true;
    } catch {
      return false;
    }
  }

  function safeLocalStorageHasItem(rawKey) {
    try {
      return localStorage.getItem(rawKey) != null;
    } catch {
      return false;
    }
  }

  function safeSessionStorageGetItem(rawKey) {
    try {
      return sessionStorage.getItem(rawKey);
    } catch {
      return null;
    }
  }

  function safeSessionStorageSetItem(rawKey, value) {
    try {
      sessionStorage.setItem(rawKey, value);
      return true;
    } catch {
      return false;
    }
  }

  function prefixedKey(key) {
    return PREFIX + key;
  }

  function primeCacheFromLocalStorage() {
    try {
      const len = localStorage.length;
      for (let i = 0; i < len; i += 1) {
        const rawKey = localStorage.key(i);
        if (!rawKey || !rawKey.startsWith(PREFIX)) continue;
        const value = localStorage.getItem(rawKey);
        if (typeof value === "string") cache.set(rawKey, value);
      }
      startupHadPrefixedData = cache.size > 0;
    } catch {
      startupHadPrefixedData = false;
    }
  }

  function openDb() {
    return new Promise((resolve, reject) => {
      if (typeof indexedDB === "undefined") {
        reject(new Error("IndexedDB unavailable"));
        return;
      }

      let request;
      try {
        request = indexedDB.open(DB_NAME, DB_VERSION);
      } catch (error) {
        reject(error);
        return;
      }

      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(STORE_NAME)) {
          database.createObjectStore(STORE_NAME);
        }
      };

      request.onsuccess = () => {
        const database = request.result;
        database.onversionchange = () => database.close();
        resolve(database);
      };

      request.onerror = () => reject(request.error || new Error("IndexedDB open failed"));
      request.onblocked = () => reject(new Error("IndexedDB open blocked"));
    });
  }

  function readAllFromIdb(database) {
    return new Promise((resolve, reject) => {
      try {
        const tx = database.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        const out = new Map();

        const req = store.openCursor();
        req.onsuccess = () => {
          const cursor = req.result;
          if (!cursor) {
            resolve(out);
            return;
          }
          const rawKey = cursor.key;
          const value = cursor.value;
          if (typeof rawKey === "string" && typeof value === "string") {
            out.set(rawKey, value);
          }
          cursor.continue();
        };
        req.onerror = () => reject(req.error || new Error("IndexedDB cursor failed"));
      } catch (error) {
        reject(error);
      }
    });
  }

  function writeManyToIdb(database, entries) {
    return new Promise((resolve, reject) => {
      try {
        const tx = database.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        for (const [rawKey, value] of entries) store.put(value, rawKey);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error || new Error("IndexedDB write failed"));
        tx.onabort = () => reject(tx.error || new Error("IndexedDB write aborted"));
      } catch (error) {
        reject(error);
      }
    });
  }

  function setRawInCacheAndMirrors(key, value) {
    const rawPrefixed = prefixedKey(key);
    cache.set(rawPrefixed, value);

    // Best-effort localStorage mirror (keeps the old behavior + provides sync bootstrap).
    safeLocalStorageSetItem(rawPrefixed, value);

    // Compatibility: if the host app already uses an unprefixed key, keep it in sync.
    if (safeLocalStorageHasItem(key)) {
      cache.set(key, value);
      safeLocalStorageSetItem(key, value);
    }
  }

  function queueIdbWrite(rawKey, value) {
    if (idbFailed) return;
    pendingWrites.set(rawKey, value);
    if (!hydrationComplete) return;
    if (!db) return;
    flushPendingWrites();
  }

  async function flushPendingWrites() {
    if (!db || idbFailed || pendingWrites.size === 0) return;
    const entries = Array.from(pendingWrites.entries());
    pendingWrites.clear();
    try {
      await writeManyToIdb(db, entries);
    } catch {
      // If persistence fails, fall back to localStorage (cache already updated).
      idbFailed = true;
    }
  }

  function didMigrateToIdb() {
    const raw = cache.get(prefixedKey(MIGRATION_FLAG_KEY)) ?? safeLocalStorageGetItem(prefixedKey(MIGRATION_FLAG_KEY));
    if (raw == null) return false;
    try {
      return JSON.parse(raw) === true;
    } catch {
      return false;
    }
  }

  function markMigratedToIdb() {
    const rawKey = prefixedKey(MIGRATION_FLAG_KEY);
    const value = JSON.stringify(true);
    cache.set(rawKey, value);
    safeLocalStorageSetItem(rawKey, value);
    queueIdbWrite(rawKey, value);
  }

  function maybeReloadAfterRestore(idbMap) {
    // If localStorage appears empty (common iOS Home Screen issue) but IndexedDB has data,
    // restore localStorage from IndexedDB and reload once so sync callers (state init) see it.
    if (startupHadPrefixedData) return;
    if (idbMap.size === 0) return;
    if (safeSessionStorageGetItem(RELOAD_GUARD_KEY) === "1") return;

    safeSessionStorageSetItem(RELOAD_GUARD_KEY, "1");
    // Best-effort restore mirror.
    for (const [rawKey, value] of idbMap.entries()) {
      if (typeof rawKey === "string" && typeof value === "string") safeLocalStorageSetItem(rawKey, value);
    }

    try {
      window.location.reload();
    } catch {
      // If reload fails, continue with cache-only reads.
    }
  }

  async function initIdbHydration() {
    try {
      db = await openDb();
      const idbMap = await readAllFromIdb(db);
      const migratedFromIdb = (() => {
        const raw = idbMap.get(prefixedKey(MIGRATION_FLAG_KEY));
        if (raw == null) return false;
        try {
          return JSON.parse(raw) === true;
        } catch {
          return false;
        }
      })();

      // If IndexedDB is empty, migrate any existing localStorage-prefixed values into it.
      if (idbMap.size === 0) {
        if (cache.size > 0) {
          await writeManyToIdb(db, cache.entries());
          markMigratedToIdb();
        }
        hydrationComplete = true;
        await flushPendingWrites();
        return;
      }

      // If we haven't previously migrated, treat localStorage-prefixed values as authoritative
      // and overwrite IndexedDB once (upgrade path from older localStorage-only versions).
      const migrated = migratedFromIdb || didMigrateToIdb();
      if (!migrated && cache.size > 0) {
        await writeManyToIdb(db, cache.entries());
        markMigratedToIdb();
        hydrationComplete = true;
        await flushPendingWrites();
        return;
      }

      // Otherwise, IndexedDB is authoritative: hydrate cache from it and mirror to localStorage.
      cache.clear();
      for (const [rawKey, value] of idbMap.entries()) cache.set(rawKey, value);

      // Best-effort localStorage mirror (keeps sync bootstrap for future loads).
      for (const [rawKey, value] of idbMap.entries()) {
        if (typeof rawKey === "string" && typeof value === "string") safeLocalStorageSetItem(rawKey, value);
      }

      hydrationComplete = true;

      // If localStorage was wiped but IDB has data, restore + reload once.
      maybeReloadAfterRestore(idbMap);

      // Drop any pre-hydration writes if we just triggered a reload to prevent clobbering.
      if (!startupHadPrefixedData && idbMap.size > 0) {
        pendingWrites.clear();
        return;
      }

      await flushPendingWrites();
    } catch {
      idbFailed = true;
      hydrationComplete = true;
      // Fall back to localStorage (cache already primed best-effort).
    }
  }

  function getRaw(key) {
    const rawPrefixed = prefixedKey(key);

    // 1) Cache (hydrated from IDB or localStorage).
    if (cache.has(rawPrefixed)) return cache.get(rawPrefixed);

    // 2) Best-effort localStorage fallback (also acts as bootstrap before IDB hydration).
    const prefixedLs = safeLocalStorageGetItem(rawPrefixed);
    if (prefixedLs != null) {
      cache.set(rawPrefixed, prefixedLs);
      queueIdbWrite(rawPrefixed, prefixedLs);
      return prefixedLs;
    }

    // 3) Compatibility: unprefixed lookup (and migrate into prefixed storage).
    if (cache.has(key)) return cache.get(key);
    const unprefixedLs = safeLocalStorageGetItem(key);
    if (unprefixedLs != null) {
      cache.set(key, unprefixedLs);
      // Migrate into prefixed key to preserve the app's prefix behavior going forward.
      cache.set(rawPrefixed, unprefixedLs);
      safeLocalStorageSetItem(rawPrefixed, unprefixedLs);
      queueIdbWrite(rawPrefixed, unprefixedLs);
      return unprefixedLs;
    }

    return null;
  }

  function setRaw(key, value) {
    if (typeof value !== "string") return false;
    setRawInCacheAndMirrors(key, value);

    const rawPrefixed = prefixedKey(key);
    queueIdbWrite(rawPrefixed, value);

    // If an unprefixed key exists, keep IndexedDB in sync with it too.
    if (safeLocalStorageHasItem(key)) queueIdbWrite(key, value);

    return true;
  }

  function getJson(key, fallback) {
    const raw = getRaw(key);
    if (raw == null) return fallback;
    try {
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  function setJson(key, value) {
    const raw = JSON.stringify(value);
    if (raw === undefined) return false;
    return setRaw(key, raw);
  }

  // Prime cache synchronously so callers can read immediately.
  primeCacheFromLocalStorage();

  // Hydrate from IndexedDB in the background.
  void initIdbHydration();

  MG.Storage = {
    getJson,
    setJson,
  };
})();
