"use strict";

/**
 * Storage: localStorage wrapper (single prefix + JSON helpers).
 * Everything stored by the app flows through this module.
 */

(() => {
  const MG = (window.MassageGift = window.MassageGift || {});

  const PREFIX = "massageGift.v1.";

  function getRaw(key) {
    try {
      const prefixed = localStorage.getItem(PREFIX + key);
      if (prefixed != null) return prefixed;
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  function setRaw(key, value) {
    try {
      localStorage.setItem(PREFIX + key, value);
      // Compatibility: if the host app already uses an unprefixed key, keep it in sync.
      if (localStorage.getItem(key) != null) localStorage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
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
    return setRaw(key, JSON.stringify(value));
  }

  MG.Storage = {
    getJson,
    setJson,
  };
})();
