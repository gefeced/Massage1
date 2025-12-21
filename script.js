"use strict";

/**
 * App entrypoint (glue code):
 * - Hash-based routing
 * - DOM synchronization (sidebar, topbar, transitions)
 * - Session timer + interaction wiring
 *
 * The heavy “chunks” live in `/js/*` to keep this file easy to follow.
 */

(() => {
  const MG = window.MassageGift;
  if (!MG?.Data || !MG?.Storage || !MG?.Utils || !MG?.UI || !MG?.State || !MG?.Views) {
    console.error("MassageGift modules failed to load. Check script order in index.html.");
    return;
  }

  const { ROUTES, findMassageById } = MG.Data;
  const { formatCredits, formatTimeMmSs } = MG.Utils;
  const { showToast, confirmModal } = MG.UI;
  const Music = MG.Music || null;
  const AppState = MG.State;
  const Views = MG.Views;

  // =========================
  // Router + UI synchronization
  // =========================

  function parseHash() {
    const raw = window.location.hash || "#/home";
    const path = raw.replace(/^#/, "");
    const parts = path.split("/").filter(Boolean);

    if (parts.length === 0) return { name: "home", massageId: null };
    if (parts[0] === "massage" && parts[1]) return { name: "massage", massageId: parts[1] };
    if (ROUTES[parts[0]]) return { name: parts[0], massageId: null };
    return { name: "home", massageId: null };
  }

  function setTheme(theme) {
    const html = document.documentElement;
    html.setAttribute("data-theme-switching", "true");
    html.setAttribute("data-theme", theme);
    requestAnimationFrame(() => {
      html.removeAttribute("data-theme-switching");
    });
  }

  function syncNavActive(routeName) {
    const buttons = document.querySelectorAll(".nav__item[data-route]");
    for (const button of buttons) {
      const isActive = button.getAttribute("data-route") === routeName;
      button.classList.toggle("is-active", isActive);
      if (isActive) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    }
  }

  function syncTopbar(routeName, credits) {
    const crumb = document.getElementById("crumb");
    if (crumb) crumb.textContent = ROUTES[routeName]?.title || "Home";
    const creditsValue = document.getElementById("creditsValue");
    if (creditsValue) creditsValue.textContent = formatCredits(credits);
  }

  const MOBILE_NAV_MQ = window.matchMedia("(max-width: 768px)");

  function isMobileNav() {
    return MOBILE_NAV_MQ.matches;
  }

  function setMobileNavOpen(open) {
    const app = document.getElementById("app");
    if (!app) return;
    if (open) app.setAttribute("data-mobile-nav", "open");
    else app.removeAttribute("data-mobile-nav");

    const btn = document.getElementById("mobileMenuBtn");
    if (btn) {
      btn.setAttribute("aria-expanded", open ? "true" : "false");
      btn.setAttribute("aria-label", open ? "Close menu" : "Open menu");
      btn.textContent = open ? "Close" : "Menu";
    }
  }

  function isMobileNavOpen() {
    const app = document.getElementById("app");
    return app?.getAttribute("data-mobile-nav") === "open";
  }

  function transitionRender(renderFn, state) {
    const view = document.getElementById("view");
    if (!view) return;

    if (state.isTransitioning) {
      renderFn();
      return;
    }

    state.isTransitioning = true;
    view.classList.add("is-hidden");

    window.setTimeout(() => {
      renderFn();
      view.focus?.();
      requestAnimationFrame(() => {
        view.classList.remove("is-hidden");
        state.isTransitioning = false;
      });
    }, 160);
  }

  let lastRenderedRouteKey = null;

  function routeKey(route) {
    return `${route.name}:${route.massageId || ""}`;
  }

  function postRenderSync(state) {
    if (state.route.name === "massages") Views.syncMassageList(state);
    if (Music && (state.route.name === "music" || state.route.name === "settings")) Views.syncMusicUI();
  }

  function renderRoute(state, { transition } = {}) {
    const view = document.getElementById("view");
    if (!view) return;

    const { name, massageId } = state.route;

    const renderFn = () => {
      if (name === "home") view.innerHTML = Views.renderHome(state);
      else if (name === "massages") view.innerHTML = Views.renderMassages(state);
      else if (name === "massage") view.innerHTML = Views.renderMassageDetail(state, massageId);
      else if (name === "credits") view.innerHTML = Views.renderCredits(state);
      else if (name === "music") view.innerHTML = Views.renderMusic(state);
      else if (name === "settings") view.innerHTML = Views.renderSettings(state);
      else view.innerHTML = Views.renderHome(state);

      postRenderSync(state);
    };

    const key = routeKey(state.route);
    const routeChanged = key !== lastRenderedRouteKey;
    const shouldTransition = typeof transition === "boolean" ? transition : routeChanged;

    if (shouldTransition) transitionRender(renderFn, state);
    else renderFn();

    lastRenderedRouteKey = key;

    syncNavActive(name === "massage" ? "massages" : name);
    syncTopbar(name === "massage" ? "massages" : name, state.credits);
  }

  function goTo(hash) {
    window.location.hash = hash;
  }

  // =========================
  // Session timer (massage)
  // =========================

  let sessionInterval = null;

  function startSessionTimer(state) {
    stopSessionTimer();

    sessionInterval = window.setInterval(() => {
      const session = AppState.normalizeActiveSession(state);
      if (!session) {
        stopSessionTimer();
        return;
      }

      const progress = AppState.getSessionProgress(session);
      if (!progress) return;

      // Live-update the detail page (if it's visible).
      const timerValue = document.getElementById("sessionTimerValue");
      if (timerValue) timerValue.textContent = formatTimeMmSs(progress.remainingStepMs / 1000);

      const stepIndexEl = document.getElementById("sessionStepIndex");
      if (stepIndexEl) stepIndexEl.textContent = String(progress.stepIndex + 1);

      const stepNameEl = document.getElementById("sessionStepName");
      if (stepNameEl) stepNameEl.textContent = progress.currentStep?.name || "";

      const stepEls = document.querySelectorAll(".step[data-step-index]");
      for (const stepEl of stepEls) {
        const rawIndex = stepEl.getAttribute("data-step-index");
        const idx = rawIndex == null ? NaN : Number(rawIndex);
        if (!Number.isFinite(idx)) continue;
        stepEl.classList.toggle("is-done", idx < progress.stepIndex);
        stepEl.classList.toggle("is-current", idx === progress.stepIndex);
      }

      if (progress.isComplete) {
        stopSessionTimer();
        const completedItemId = session.itemId;
        state.activeSession = null;
        state.justCompletedItemId = completedItemId;
        AppState.persist();

        if (state.route.name === "massage" && state.route.massageId === completedItemId) {
          renderRoute(state);
        } else {
          if (state.route.name === "home") renderRoute(state);
          showToast({
            title: "Session complete",
            message: "All done. Come back whenever you want another cozy moment.",
          });
        }
      }
    }, 250);
  }

  function stopSessionTimer() {
    if (!sessionInterval) return;
    clearInterval(sessionInterval);
    sessionInterval = null;
  }

  // =========================
  // Event wiring (UI interactions)
  // =========================

  function wireEvents(state) {
    const sidebar = document.querySelector(".sidebar");
    const view = document.getElementById("view");
    const mobileMenuBtn = document.getElementById("mobileMenuBtn");

    sidebar?.addEventListener("click", (event) => {
      const target = event.target instanceof Element ? event.target : null;
      const navButton = target?.closest(".nav__item[data-route]");
      if (!navButton) return;
      const route = navButton.getAttribute("data-route");
      if (!route) return;
      goTo(`#/${route}`);
      if (isMobileNav()) setMobileNavOpen(false);
    });

    mobileMenuBtn?.addEventListener("click", () => {
      if (!isMobileNav()) return;
      setMobileNavOpen(!isMobileNavOpen());
    });

    document.addEventListener("click", (event) => {
      if (!isMobileNav() || !isMobileNavOpen()) return;
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;
      if (target.closest(".sidebar")) return;
      if (target.closest("#mobileMenuBtn")) return;
      setMobileNavOpen(false);
    });

    view?.addEventListener("click", async (event) => {
      const target = event.target instanceof Element ? event.target : null;
      const actionEl = target?.closest("[data-action]");
      const action = actionEl?.getAttribute("data-action");
      if (!action) return;

      if (action === "go") {
        const href = actionEl.getAttribute("data-href");
        if (href) goTo(href);
        return;
      }

      if (action === "open-massage") {
        const id = actionEl.getAttribute("data-id");
        if (!id) return;
        goTo(`#/massage/${id}`);
        return;
      }

      if (action === "dismiss-complete") {
        state.justCompletedItemId = null;
        renderRoute(state);
        return;
      }

      if (action === "music-toggle") {
        if (!Music) return;
        Music.toggle();
        Views.syncMusicUI();
        return;
      }

      if (action === "music-restart") {
        if (!Music) return;
        Music.next();
        Views.syncMusicUI();
        return;
      }

      if (action === "redeem-coupon") {
        const input = document.getElementById("couponInput");
        const code = (input?.value || "").trim().toUpperCase();
        if (!code) {
          showToast({ title: "Coupon", message: "Please enter a coupon code." });
          return;
        }

        const creditsToAdd = getCouponCredits(code);
        if (creditsToAdd <= 0) {
          showToast({ title: "Coupon", message: "This coupon code is not valid." });
          return;
        }

        if (isCouponRedeemed(code)) {
          showToast({ title: "Coupon", message: "This coupon has already been redeemed." });
          return;
        }

        state.credits += creditsToAdd;
        markCouponRedeemed(code);
        AppState.persist();
        renderRoute(state);
        showToast({
          title: "Coupon applied!",
          message: `Coupon applied! You received ${creditsToAdd} credits.`,
        });
        if (input) input.value = "";
        return;
      }

      if (action === "set-theme") {
        const theme = actionEl.getAttribute("data-theme");
        if (theme !== "normal" && theme !== "christmas") return;
        state.theme = theme;
        AppState.persist();
        setTheme(state.theme);
        renderRoute(state);
        return;
      }

      if (action === "start-session") {
        const itemId = actionEl.getAttribute("data-id");
        if (!itemId) return;

        const item = findMassageById(itemId);
        if (!item) return;

        const existing = AppState.normalizeActiveSession(state);
        if (existing) {
          showToast({
            title: "Session in progress",
            message: "Finish the current session before starting a new one.",
          });
          return;
        }

        if (state.credits < item.costCredits) {
          showToast({
            title: "Not enough credits",
            message: "You don't have enough credits for this session.",
          });
          return;
        }

        const ok = await confirmModal({
          title: "Begin session?",
          message: `This session will use ${item.costCredits} credits. Would you like to begin?`,
          confirmText: "Yes",
          cancelText: "No",
        });

        if (!ok) return;

        // Subtract credits only after confirmation.
        state.credits -= item.costCredits;
        state.lastUsedMassageId = item.id;
        state.justCompletedItemId = null;

        const nowMs = Date.now();
        state.activeSession = {
          startedAtMs: nowMs,
          itemId: item.id,
          steps: MG.Data.getSessionSteps(item).map((step) => ({
            name: step.name,
            durationMin: step.durationMin,
          })),
        };

        AppState.persist();
        renderRoute(state);
        startSessionTimer(state);
        return;
      }

      if (action === "end-session") {
        const session = AppState.normalizeActiveSession(state);
        if (!session) return;

        const ok = await confirmModal({
          title: "End session early?",
          message: "If you end now, the timer stops. (Credits already used.)",
          confirmText: "End session",
          cancelText: "Keep going",
        });
        if (!ok) return;

        state.activeSession = null;
        AppState.persist();
        stopSessionTimer();
        renderRoute(state);
        showToast({ title: "Session ended", message: "All good. Start again anytime." });
        return;
      }
    });

    view?.addEventListener("input", (event) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      const action = target?.getAttribute("data-action");

      if (action === "search" && target instanceof HTMLInputElement) {
        state.massagesQuery = target.value;
        Views.syncMassageList(state);
        return;
      }

      if (action === "music-seek" && target instanceof HTMLInputElement) {
        if (!Music) return;
        Music.seek(Number(target.value || 0));
        return;
      }

      if (action === "music-volume" && target instanceof HTMLInputElement) {
        if (!Music) return;
        Music.setVolume(Number(target.value || 0) / 100);
        return;
      }
    });

    window.addEventListener("hashchange", () => {
      state.route = parseHash();
      renderRoute(state);
      if (isMobileNav()) setMobileNavOpen(false);
    });

    // Keep the Music + Settings pages reactive while playing (if music exists).
    Music?.onChange?.(() => {
      if (state.route.name === "music" || state.route.name === "settings") Views.syncMusicUI();
    });
  }

  const COUPONS = new Map([
    ["TEST1", 1],
    ["TEST2", 2],
    ["NEWYEAR26", 5],
    ["PEACENJOY", 6],
    ["WINTERCALM", 4],
    ["MERRYCHRISTMAS", 10],
    ["THANKYOU", 3],
    ["YOUDESERVEIT", 2],
    ["LOVEYOU", 5],
    ["ULTIMATERELAX", 15],
    ["BREATHE", 3],
    ["APPLAUNCH", 1],
    ["GOODDAY", 2],
    ["GINGERBREAD", 3],
    ["SAPIN", 2],
    ["ORNAMENT", 2],
    ["ELF", 1],
    ["LOGIC", 1],
    ["LITHIUM", 2],
  ]);

  const REDEEMED_COUPONS_KEY = "redeemedCoupons";

  function getRedeemedCoupons() {
    const raw = MG.Storage.getJson(REDEEMED_COUPONS_KEY, {});
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
    return raw;
  }

  function isCouponRedeemed(code) {
    const redeemed = getRedeemedCoupons();
    return redeemed[code] === true;
  }

  function markCouponRedeemed(code) {
    const redeemed = getRedeemedCoupons();
    redeemed[code] = true;
    MG.Storage.setJson(REDEEMED_COUPONS_KEY, redeemed);
  }

  function getCouponCredits(code) {
    return COUPONS.get(code) || 0;
  }

  // =========================
  // Init
  // =========================

  function init() {
    const { state } = AppState;

    // Gift reset: ensure we start from a fresh credit balance.
    const didResetCredits = MG.Storage.getJson("creditsResetToZero.v1", false) === true;
    if (!didResetCredits) {
      state.credits = 0;
      MG.Storage.setJson("creditsResetToZero.v1", true);
      AppState.persist();
    }

    // Apply persisted UI state.
    setTheme(state.theme);

    // Mobile: keep sidebar from crushing content.
    setMobileNavOpen(false);
    MOBILE_NAV_MQ.addEventListener?.("change", () => {
      if (!isMobileNav()) setMobileNavOpen(false);
    });

    // Clean up stale session (if it ended while the tab was closed).
    const session = AppState.normalizeActiveSession(state);
    if (!session && state.activeSession) {
      state.activeSession = null;
      AppState.persist();
    }

    // Route + render.
    state.route = parseHash();
    const view = document.getElementById("view");
    if (view) view.classList.add("is-hidden");
    renderRoute(state, { transition: false });
    requestAnimationFrame(() => view?.classList.remove("is-hidden"));

    // Wire interactions.
    wireEvents(state);

    // Resume ticking if a session is active (even if you're not on the detail page).
    const active = AppState.normalizeActiveSession(state);
    if (active) startSessionTimer(state);
  }

  document.addEventListener("DOMContentLoaded", init);
})();
