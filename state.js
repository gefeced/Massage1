"use strict";

/**
 * State: in-memory UI state + the small subset persisted to localStorage.
 * Persisted keys: credits, theme, lastUsedMassageId, activeSession
 */

(() => {
  const MG = (window.MassageGift = window.MassageGift || {});
  const Storage = MG.Storage;
  const { clamp, toFiniteNumber } = MG.Utils;

  const DEFAULT_CREDITS = 0;

  const state = {
    route: { name: "home", massageId: null },
    credits: clamp(toFiniteNumber(Storage.getJson("credits", DEFAULT_CREDITS), DEFAULT_CREDITS), 0, 999999),
    theme: Storage.getJson("theme", "normal") === "christmas" ? "christmas" : "normal",
    lastUsedMassageId: Storage.getJson("lastUsedMassageId", null),

    // Optional persistence: keep a running session if the tab reloads.
    activeSession: Storage.getJson("activeSession", null),
    justCompletedItemId: null,

    massagesQuery: "",
    isTransitioning: false,
  };

  function persist() {
    Storage.setJson("credits", state.credits);
    Storage.setJson("theme", state.theme);
    Storage.setJson("lastUsedMassageId", state.lastUsedMassageId);
    Storage.setJson("activeSession", state.activeSession);
  }

  function normalizeActiveSession(stateRef) {
    const session = stateRef.activeSession;
    if (!session) return null;

    const itemId = typeof session.itemId === "string" ? session.itemId : null;
    const startedAtMs = toFiniteNumber(session.startedAtMs, null);
    const rawSteps = Array.isArray(session.steps) ? session.steps : null;

    if (!itemId || startedAtMs == null || !rawSteps?.length) return null;

    const steps = rawSteps
      .map((step) => ({
        name: String(step?.name || ""),
        durationMin: clamp(toFiniteNumber(step?.durationMin, 0), 0, 24 * 60),
      }))
      .filter((step) => step.name && step.durationMin > 0);

    if (!steps.length) return null;

    const totalMs = steps.reduce((sum, step) => sum + step.durationMin * 60 * 1000, 0);
    if (!Number.isFinite(totalMs) || totalMs <= 0) return null;

    return { itemId, startedAtMs, steps };
  }

  function getSessionProgress(session, nowMs = Date.now()) {
    if (!session) return null;

    const elapsedMs = Math.max(0, nowMs - session.startedAtMs);
    const totalMs = session.steps.reduce((sum, step) => sum + step.durationMin * 60 * 1000, 0);

    if (elapsedMs >= totalMs) {
      return {
        isComplete: true,
        stepIndex: session.steps.length - 1,
        stepCount: session.steps.length,
        currentStep: session.steps[session.steps.length - 1],
        remainingStepMs: 0,
        remainingTotalMs: 0,
      };
    }

    let remainingForIndexMs = elapsedMs;
    for (let stepIndex = 0; stepIndex < session.steps.length; stepIndex += 1) {
      const step = session.steps[stepIndex];
      const stepMs = step.durationMin * 60 * 1000;
      if (remainingForIndexMs < stepMs) {
        return {
          isComplete: false,
          stepIndex,
          stepCount: session.steps.length,
          currentStep: step,
          remainingStepMs: stepMs - remainingForIndexMs,
          remainingTotalMs: totalMs - elapsedMs,
        };
      }
      remainingForIndexMs -= stepMs;
    }

    // Should never happen, but fail safe.
    return {
      isComplete: true,
      stepIndex: session.steps.length - 1,
      stepCount: session.steps.length,
      currentStep: session.steps[session.steps.length - 1],
      remainingStepMs: 0,
      remainingTotalMs: 0,
    };
  }

  MG.State = {
    state,
    persist,
    normalizeActiveSession,
    getSessionProgress,
  };
})();
