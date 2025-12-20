"use strict";

/**
 * Utilities: small pure helpers for formatting and safety.
 * Keep these dependency-free so they can be reused anywhere.
 */

(() => {
  const MG = (window.MassageGift = window.MassageGift || {});

  function clamp(number, min, max) {
    return Math.min(max, Math.max(min, number));
  }

  function toFiniteNumber(value, fallback) {
    const number = typeof value === "number" ? value : Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function formatCredits(credits) {
    return `${credits}`;
  }

  function formatDuration(minutes) {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (!mins) return `${hours} hr`;
    return `${hours} hr ${mins} min`;
  }

  function formatTimeMmSs(totalSeconds) {
    const seconds = Math.max(0, Math.floor(totalSeconds));
    const mm = Math.floor(seconds / 60);
    const ss = seconds % 60;
    return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  }

  function getGreeting(now = new Date()) {
    const hour = now.getHours();
    if (hour >= 5 && hour < 12) return "Good morning";
    if (hour >= 12 && hour < 17) return "Good afternoon";
    return "Good evening";
  }

  function escapeHtml(text) {
    return String(text)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  MG.Utils = {
    clamp,
    toFiniteNumber,
    formatCredits,
    formatDuration,
    formatTimeMmSs,
    getGreeting,
    escapeHtml,
  };
})();

