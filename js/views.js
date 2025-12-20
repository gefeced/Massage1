"use strict";

/**
 * Views: pure-ish render functions that return HTML strings for the main panel.
 * Also includes a couple of small DOM sync helpers for search + music controls.
 */

(() => {
  const MG = (window.MassageGift = window.MassageGift || {});
  const { DISPLAY_NAME, MASSAGES, findMassageById, getSessionSteps } = MG.Data;
  const {
    escapeHtml,
    formatCredits,
    formatDuration,
    formatTimeMmSs,
    getGreeting,
  } = MG.Utils;
  const { normalizeActiveSession, getSessionProgress } = MG.State;
  const Music = MG.Music;

  function renderHome(state) {
    const greeting = getGreeting();
    const lastMassage = state.lastUsedMassageId ? findMassageById(state.lastUsedMassageId) : null;
    const session = normalizeActiveSession(state);

    const sessionCard = session
      ? `
        <div class="panel">
          <div class="panel__header">
            <h2 class="page__title" style="font-size: 22px; margin:0;">Session in progress</h2>
            <p class="page__subtitle">A warm little reminder: you're mid-session. Want to jump back in?</p>
            <div class="panel__header-line"></div>
          </div>
          <div class="panel__inner">
            <div class="btn-row">
              <button class="btn btn--primary" type="button" data-action="go" data-href="#/massage/${escapeHtml(
                session.itemId,
              )}">Return to session</button>
              <button class="btn btn--ghost" type="button" data-action="end-session">End session</button>
            </div>
          </div>
        </div>
      `
      : "";

    const lastUsedCard = lastMassage
      ? `
        <div class="card">
          <button class="card__btn" type="button" data-action="open-massage" data-id="${escapeHtml(
            lastMassage.id,
          )}">
            <div class="card__top">
              <div>
                <p class="card__title">Continue where you left off</p>
                <div class="meta">
                  <span>Last used: ${escapeHtml(lastMassage.name)}</span>
                  <span>•</span>
                  <span>${escapeHtml(formatDuration(lastMassage.durationMin))}</span>
                </div>
              </div>
              <div class="card__right">
                ${
                  lastMassage.type === "bundle"
                    ? '<span class="tag tag--bundle">Bundle</span>'
                    : ""
                }
              </div>
            </div>
            ${
              lastMassage.description
                ? `<div class="meta"><span>${escapeHtml(lastMassage.description)}</span></div>`
                : ""
            }
          </button>
        </div>
      `
      : `
        <div class="card">
          <div class="card__btn" style="cursor: default;">
            <div class="card__top">
              <div>
                <p class="card__title">Your next cozy moment</p>
                <div class="meta">
                  <span>No sessions yet—pick something gentle to start.</span>
                </div>
              </div>
            </div>
            <div class="btn-row">
              <button class="btn btn--primary" type="button" data-action="go" data-href="#/massages">Browse massages</button>
            </div>
          </div>
        </div>
      `;

    return `
      <div class="page">
        <div>
          <h1 class="page__title">${escapeHtml(greeting)}</h1>
          <p class="page__subtitle" style="font-size: 22px; margin-top: 10px;">
            <span style="font-weight: 750; letter-spacing: -0.02em;">${escapeHtml(
              DISPLAY_NAME,
            )}</span>
          </p>
        </div>

        <div class="grid-2">
          <div class="panel">
            <div class="panel__header">
              <h2 class="page__title" style="font-size: 22px; margin:0;">Credit balance</h2>
              <p class="page__subtitle">Use credits to begin a session. Redeem coupons anytime.</p>
              <div class="panel__header-line"></div>
            </div>
            <div class="panel__inner">
              <div style="display:flex; align-items:baseline; justify-content:space-between; gap: 14px;">
                <div style="font-size: 44px; font-weight: 760; letter-spacing: -0.04em;">
                  ${escapeHtml(formatCredits(state.credits))}
                </div>
                <div class="tag">Credits</div>
              </div>
              <div class="btn-row" style="margin-top: 14px;">
                <button class="btn btn--primary" type="button" data-action="go" data-href="#/massages">Start a massage</button>
                <button class="btn btn--ghost" type="button" data-action="go" data-href="#/credits">Redeem coupon</button>
              </div>
            </div>
          </div>

          <div class="panel">
            <div class="panel__header">
              <h2 class="page__title" style="font-size: 22px; margin:0;">Quick actions</h2>
              <p class="page__subtitle">Shortcuts for the cozy essentials.</p>
              <div class="panel__header-line"></div>
            </div>
            <div class="panel__inner">
              <div class="btn-row">
                <button class="btn" type="button" data-action="go" data-href="#/massages">Browse massages</button>
                <button class="btn" type="button" data-action="go" data-href="#/music">Open music</button>
                <button class="btn" type="button" data-action="go" data-href="#/settings">Theme & settings</button>
              </div>
              <p class="page__subtitle" style="margin-top: 14px;">
                Tip: music keeps playing while you explore the app.
              </p>
            </div>
          </div>
        </div>

        ${sessionCard}

        <div class="panel">
          <div class="panel__header">
            <h2 class="page__title" style="font-size: 22px; margin:0;">Last used massage</h2>
            <p class="page__subtitle">Continue, repeat, or discover something new.</p>
            <div class="panel__header-line"></div>
          </div>
          <div class="panel__inner">
            ${lastUsedCard}
          </div>
        </div>
      </div>
    `;
  }

  function renderMassages(state) {
    const list = renderMassageListHtml(state.massagesQuery);
    return `
      <div class="page">
        <div>
          <h1 class="page__title">Massages</h1>
          <p class="page__subtitle">Search, browse, then tap to see details.</p>
        </div>

        <div class="panel">
          <div class="panel__header">
            <input
              class="input"
              type="search"
              placeholder="Search massages & bundles…"
              value="${escapeHtml(state.massagesQuery)}"
              aria-label="Search massages"
              data-action="search"
              id="massageSearch"
            />
            <div class="meta" id="massageCount" style="margin-top: 10px;"></div>
            <div class="panel__header-line"></div>
          </div>
          <div class="panel__inner">
            <div class="list" id="massageList">
              ${list}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function renderMassageListHtml(queryText) {
    const query = queryText.trim().toLowerCase();
    const filtered = MASSAGES.filter((massage) => {
      if (!query) return true;
      return (
        massage.name.toLowerCase().includes(query) ||
        String(massage.category || "").toLowerCase().includes(query)
      );
    });

    const cards = filtered
      .map((massage) => {
        const tag =
          massage.type === "bundle" ? '<span class="tag tag--bundle">Bundle</span>' : "";
        const costLabel = `${massage.costCredits} ${massage.costCredits === 1 ? "credit" : "credits"}`;
        return `
          <div class="card">
            <button class="card__btn" type="button" data-action="open-massage" data-id="${escapeHtml(
              massage.id,
            )}">
              <div class="card__top">
                <div>
                  <p class="card__title">${escapeHtml(massage.name)}</p>
                  <div class="meta">
                    <span>${escapeHtml(formatDuration(massage.durationMin))}</span>
                    ${
                      massage.category
                        ? `<span>•</span><span>${escapeHtml(massage.category)}</span>`
                        : ""
                    }
                  </div>
                </div>
                <div class="card__right">
                  <span class="cost-pill">${escapeHtml(costLabel)}</span>
                  ${tag}
                </div>
              </div>
            </button>
          </div>
        `;
      })
      .join("");

    return cards || `<div class="page__subtitle">No matches. Try a different search.</div>`;
  }

  function syncMassageCount(queryText) {
    const query = queryText.trim().toLowerCase();
    const filteredCount = MASSAGES.filter((massage) => {
      if (!query) return true;
      return (
        massage.name.toLowerCase().includes(query) ||
        String(massage.category || "").toLowerCase().includes(query)
      );
    }).length;

    const el = document.getElementById("massageCount");
    if (!el) return;
    el.innerHTML = `
      <span>Showing ${filteredCount} of ${MASSAGES.length}</span>
      ${query ? `<span>•</span><span>Filtered</span>` : ""}
    `;
  }

  function syncMassageList(state) {
    const listEl = document.getElementById("massageList");
    if (!listEl) return;
    listEl.innerHTML = renderMassageListHtml(state.massagesQuery);
    syncMassageCount(state.massagesQuery);
  }

  function renderMassageDetail(state, massageId) {
    const item = findMassageById(massageId);
    if (!item) {
      return `
        <div class="page">
          <div class="panel">
            <div class="panel__inner">
              <h1 class="page__title">Not found</h1>
              <p class="page__subtitle">That massage doesn't exist. Head back to the list.</p>
              <div class="btn-row">
                <button class="btn btn--primary" type="button" data-action="go" data-href="#/massages">Back to Massages</button>
              </div>
            </div>
          </div>
        </div>
      `;
    }

    const session = normalizeActiveSession(state);
    const isThisSessionActive = session?.itemId === massageId;
    const isAnySessionActive = !!session;
    const steps = getSessionSteps(item);

    const progress = isThisSessionActive ? getSessionProgress(session) : null;
    const currentStepIndex = progress?.stepIndex ?? 0;
    const remainingSeconds = progress ? Math.max(0, progress.remainingStepMs / 1000) : 0;

    const tag =
      item.type === "bundle" ? '<span class="tag tag--bundle">Bundle</span>' : "";
    const costLabel = `${item.costCredits} ${item.costCredits === 1 ? "credit" : "credits"}`;

    const startButtonDisabled = isAnySessionActive && !isThisSessionActive;
    const startButtonLabel = isThisSessionActive
      ? "In session"
      : startButtonDisabled
        ? "Another session is running"
        : "Start";

    const timerBlock = isThisSessionActive
      ? `
        <div class="timer" data-timer="active" style="align-items: stretch;">
          <div style="display:grid; gap: 6px;">
            <div class="page__subtitle" style="margin: 0;">
              Step <span id="sessionStepIndex">${escapeHtml(currentStepIndex + 1)}</span> of
              <span id="sessionStepTotal">${escapeHtml(steps.length)}</span>
            </div>
            <div class="session-step" id="sessionStepName">${escapeHtml(
              progress?.currentStep?.name || "",
            )}</div>
          </div>
          <div style="display:grid; gap: 6px; justify-items: end;">
            <div class="page__subtitle" style="margin: 0;">Remaining (this step)</div>
            <div class="timer__time" id="sessionTimerValue">${escapeHtml(formatTimeMmSs(remainingSeconds))}</div>
          </div>
        </div>
      `
      : "";

    const completedBlock =
      state.justCompletedItemId === massageId
        ? `
          <div class="panel" style="border-color: rgba(47, 123, 85, 0.25);">
            <div class="panel__inner">
              <h2 class="page__title" style="font-size: 22px; margin:0;">Session complete</h2>
              <p class="page__subtitle">All done. Breathe in, breathe out—softly.</p>
              <div class="btn-row">
                <button class="btn btn--primary" type="button" data-action="go" data-href="#/massages">Back to Massages</button>
                <button class="btn btn--ghost" type="button" data-action="dismiss-complete">Close</button>
              </div>
            </div>
          </div>
        `
        : "";

    const stepsBlock =
      item.type === "bundle"
        ? `
          <div class="panel">
            <div class="panel__header">
              <h2 class="page__title" style="font-size: 22px; margin:0;">Steps</h2>
              <p class="page__subtitle">A multi-step session that flows automatically.</p>
              <div class="panel__header-line"></div>
            </div>
            <div class="panel__inner">
              <div class="steps" id="stepsList">
                ${steps
                  .map((step, idx) => {
                    const className = isThisSessionActive
                      ? idx < currentStepIndex
                        ? "step is-done"
                        : idx === currentStepIndex
                          ? "step is-current"
                          : "step"
                      : "step";
                    return `
                      <div class="${className}" data-step-index="${escapeHtml(idx)}">
                        <div class="step__row">
                          <div class="step__title">Step ${escapeHtml(idx + 1)}: ${escapeHtml(step.name)}</div>
                          <div class="step__time">${escapeHtml(formatDuration(step.durationMin))}</div>
                        </div>
                      </div>
                    `;
                  })
                  .join("")}
              </div>
            </div>
          </div>
        `
        : "";

    return `
      <div class="page">
        <div class="detail-hero">
          <div class="detail-hero__left">
            <h1 class="page__title" style="margin:0;">${escapeHtml(item.name)}</h1>
            <div class="meta" style="margin-top: 10px;">
              <span>${escapeHtml(formatDuration(item.durationMin))}</span>
              ${
                item.category
                  ? `<span>•</span><span>${escapeHtml(item.category)}</span>`
                  : ""
              }
            </div>
          </div>
          <div class="detail-hero__right">
            <span class="cost-pill">${escapeHtml(costLabel)}</span>
            ${tag}
          </div>
        </div>

        <div class="panel">
          <div class="panel__inner" style="display:grid; gap: 12px;">
            ${timerBlock}
            <div class="btn-row">
              <button
                class="btn btn--primary"
                type="button"
                data-action="start-session"
                data-id="${escapeHtml(item.id)}"
                ${startButtonDisabled || isThisSessionActive ? "disabled" : ""}
              >
                ${escapeHtml(startButtonLabel)}
              </button>
              ${
                isThisSessionActive
                  ? `<button class="btn btn--ghost" type="button" data-action="end-session">End session</button>`
                  : ""
              }
              <button class="btn btn--ghost" type="button" data-action="go" data-href="#/massages">Back</button>
            </div>
            <p class="page__subtitle" style="margin: 0;">
              Credits are only used after you confirm.
            </p>
          </div>
        </div>

        ${stepsBlock}

        ${completedBlock}
      </div>
    `;
  }

  function renderCredits(state) {
    return `
      <div class="page">
        <div>
          <h1 class="page__title">Credits</h1>
          <p class="page__subtitle">Balance on the left, coupons on the right.</p>
        </div>

        <div class="grid-2">
          <div class="panel">
            <div class="panel__header">
              <h2 class="page__title" style="font-size: 22px; margin:0;">Current balance</h2>
              <p class="page__subtitle">A cozy little currency for cozy little sessions.</p>
              <div class="panel__header-line"></div>
            </div>
            <div class="panel__inner">
              <div style="font-size: 44px; font-weight: 760; letter-spacing: -0.04em;">
                ${escapeHtml(formatCredits(state.credits))}
              </div>
              <div class="meta" style="margin-top: 8px;">
                <span>Credits</span>
                <span>•</span>
                <span>Stored on this device</span>
              </div>
            </div>
          </div>

          <div class="panel">
            <div class="panel__header">
              <h2 class="page__title" style="font-size: 22px; margin:0;">Redeem coupon</h2>
              <p class="page__subtitle">Redeem a Coupon!</p>
              <div class="panel__header-line"></div>
            </div>
            <div class="panel__inner" style="display:grid; gap: 12px;">
              <input class="input" id="couponInput" type="text" placeholder="Enter coupon code…" autocomplete="off" />
              <div class="btn-row">
                <button class="btn btn--primary" type="button" data-action="redeem-coupon">Redeem</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function renderMusic(state) {
    const snapshot = Music.getSnapshot();
    const playLabel = snapshot.isPlaying ? "Pause" : "Play";
    const positionLabel = formatTimeMmSs(snapshot.positionSec);
    const durationLabel = formatTimeMmSs(snapshot.durationSec);
    const maxSeek = Math.max(1, Math.floor(snapshot.durationSec || 0));
    const seekValue = Math.min(maxSeek, Math.floor(snapshot.positionSec || 0));

    return `
      <div class="page">
        <div>
          <h1 class="page__title">Music</h1>
          <p class="page__subtitle">A simple, Spotify-like player (your local tracks).</p>
        </div>

        <div class="panel">
          <div class="panel__inner" style="display:grid; gap: 14px;">
          <div>
            <div class="tag">Now playing</div>
            <h2 class="page__title" id="musicTitle" style="font-size: 24px; margin: 10px 0 0;">${escapeHtml(
              snapshot.track.title,
            )}</h2>
            <p class="page__subtitle" id="musicArtist" style="margin-top: 6px;">${escapeHtml(
              snapshot.track.artist,
            )}</p>
          </div>

            <div class="btn-row">
              <button class="btn btn--ghost" type="button" data-action="music-restart">Skip</button>
              <button class="btn btn--primary" id="musicToggleBtn" type="button" data-action="music-toggle">${escapeHtml(
                playLabel,
              )}</button>
            </div>

            <div style="display:grid; gap: 8px;">
              <input
                class="input"
                style="padding: 10px 12px;"
                type="range"
                min="0"
                max="${escapeHtml(maxSeek)}"
                value="${escapeHtml(seekValue)}"
                step="1"
                aria-label="Seek"
                data-action="music-seek"
                id="musicSeek"
              />
              <div class="meta" style="justify-content: space-between;">
                <span id="musicPos">${escapeHtml(positionLabel)}</span>
                <span id="musicDur">${escapeHtml(durationLabel)}</span>
              </div>
            </div>

            <div class="meta">
              <span>Music keeps playing during massages.</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function renderSettings(state) {
    const snapshot = Music.getSnapshot();
    const normalChecked = state.theme === "normal";
    const christmasChecked = state.theme === "christmas";

    return `
      <div class="page">
        <div>
          <h1 class="page__title">Settings</h1>
          <p class="page__subtitle">Make it feel exactly right.</p>
        </div>

        <div class="grid-2">
          <div class="panel">
            <div class="panel__header">
              <h2 class="page__title" style="font-size: 22px; margin:0;">Music volume</h2>
              <p class="page__subtitle">A little softer can feel extra premium.</p>
              <div class="panel__header-line"></div>
            </div>
            <div class="panel__inner" style="display:grid; gap: 10px;">
              <input
                class="input"
                style="padding: 10px 12px;"
                type="range"
                min="0"
                max="100"
                value="${escapeHtml(Math.round(snapshot.volume * 100))}"
                aria-label="Music volume"
                data-action="music-volume"
                id="musicVolume"
              />
              <div class="meta" style="justify-content: space-between;">
                <span>Quiet</span>
                <span id="musicVolumeLabel">${escapeHtml(Math.round(snapshot.volume * 100))}%</span>
                <span>Louder</span>
              </div>
            </div>
          </div>

          <div class="panel">
            <div class="panel__header">
              <h2 class="page__title" style="font-size: 22px; margin:0;">Theme</h2>
              <p class="page__subtitle">Switches instantly. Choice is saved.</p>
              <div class="panel__header-line"></div>
            </div>
            <div class="panel__inner" style="display:grid; gap: 12px;">
              <div class="btn-row">
                <button class="btn ${normalChecked ? "btn--primary" : ""}" type="button" data-action="set-theme" data-theme="normal">Normal</button>
                <button class="btn ${christmasChecked ? "btn--primary" : ""}" type="button" data-action="set-theme" data-theme="christmas">Christmas</button>
              </div>
              <div class="panel" style="box-shadow: none;">
                <div class="panel__inner">
                  <p class="page__subtitle" style="margin:0;">Merry Christmas from Ayden!</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function syncMusicUI() {
    const snapshot = Music.getSnapshot();

    const title = document.getElementById("musicTitle");
    if (title) title.textContent = snapshot.track?.title || "";

    const artist = document.getElementById("musicArtist");
    if (artist) artist.textContent = snapshot.track?.artist || "";

    const toggle = document.getElementById("musicToggleBtn");
    if (toggle) toggle.textContent = snapshot.isPlaying ? "Pause" : "Play";

    const seek = document.getElementById("musicSeek");
    if (seek instanceof HTMLInputElement) {
      const max = Math.max(1, Math.floor(snapshot.durationSec || 0));
      seek.max = String(max);
      if (document.activeElement !== seek) seek.value = String(Math.min(max, Math.floor(snapshot.positionSec || 0)));
    }

    const pos = document.getElementById("musicPos");
    if (pos) pos.textContent = formatTimeMmSs(snapshot.positionSec);

    const dur = document.getElementById("musicDur");
    if (dur) dur.textContent = formatTimeMmSs(snapshot.durationSec);

    const volume = document.getElementById("musicVolume");
    if (volume instanceof HTMLInputElement) {
      const pct = Math.round(snapshot.volume * 100);
      if (document.activeElement !== volume) volume.value = String(pct);
      const label = document.getElementById("musicVolumeLabel");
      if (label) label.textContent = `${pct}%`;
    }
  }

  MG.Views = {
    renderHome,
    renderMassages,
    renderMassageDetail,
    renderCredits,
    renderMusic,
    renderSettings,
    syncMassageList,
    syncMusicUI,
  };
})();
