"use strict";

/**
 * UI primitives: toast + custom confirmation modal.
 * These are small building blocks used by app logic (no page rendering here).
 */

(() => {
  const MG = (window.MassageGift = window.MassageGift || {});
  const { escapeHtml } = MG.Utils;

  function showToast({ title, message, timeoutMs = 3200 }) {
    const toastRoot = document.getElementById("toastRoot");
    if (!toastRoot) return;

    const toast = document.createElement("div");
    toast.className = "toast";

    toast.innerHTML = `
      <p class="toast__title">${escapeHtml(title)}</p>
      <p class="toast__body">${escapeHtml(message)}</p>
    `;

    toastRoot.appendChild(toast);

    window.setTimeout(() => {
      toast.remove();
    }, timeoutMs);
  }

  function confirmModal({
    title,
    message,
    confirmText = "Yes",
    cancelText = "No",
  }) {
    const modalRoot = document.getElementById("modalRoot");
    if (!modalRoot) return Promise.resolve(false);

    return new Promise((resolve) => {
      let isClosed = false;
      modalRoot.classList.add("is-open");
      modalRoot.innerHTML = `
        <div class="modal-overlay" data-action="modal-cancel"></div>
        <div class="modal" role="dialog" aria-modal="true" aria-label="${escapeHtml(
          title,
        )}">
          <div class="modal__inner">
            <h2 class="modal__title">${escapeHtml(title)}</h2>
            <p class="modal__body">${escapeHtml(message)}</p>
            <div class="modal__actions">
              <button class="btn btn--ghost" type="button" data-action="modal-cancel">${escapeHtml(
                cancelText,
              )}</button>
              <button class="btn btn--primary" type="button" data-action="modal-confirm">${escapeHtml(
                confirmText,
              )}</button>
            </div>
          </div>
        </div>
      `;

      const previousActive = document.activeElement;
      const confirmButton = modalRoot.querySelector('[data-action="modal-confirm"]');
      if (confirmButton instanceof HTMLElement) confirmButton.focus();

      function close(result) {
        if (isClosed) return;
        isClosed = true;
        modalRoot.classList.remove("is-open");
        modalRoot.innerHTML = "";
        document.removeEventListener("keydown", onKeyDown);
        modalRoot.removeEventListener("click", onClick);
        if (previousActive instanceof HTMLElement) previousActive.focus();
        resolve(result);
      }

      function onKeyDown(event) {
        if (event.key === "Escape") close(false);
      }

      function onClick(event) {
        const target = event.target instanceof Element ? event.target : null;
        const action = target?.closest("[data-action]")?.getAttribute("data-action");
        if (action === "modal-confirm") close(true);
        if (action === "modal-cancel") close(false);
      }

      document.addEventListener("keydown", onKeyDown);
      modalRoot.addEventListener("click", onClick);
    });
  }

  MG.UI = {
    showToast,
    confirmModal,
  };
})();

