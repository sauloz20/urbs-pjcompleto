/* URBS V18 — acordeão V17 + relatos em modal editorial acessível e animado. */
(() => {
  "use strict";
  const root = document.getElementById("splitAccordion");
  if (!root) return;
  const panels = [...root.querySelectorAll(".split-panel")];
  const modal = document.getElementById("urbs-story-modal");
  if (!modal || !panels.length) return;
  const dialog = modal.querySelector(".urbs-story-modal__dialog");
  const closeButton = modal.querySelector(".urbs-story-modal__close");
  const pixels = modal.querySelector(".urbs-story-modal__pixels");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;
  let locked = panels[0],
    modalOpen = false,
    returnFocus = null,
    closeTimer = 0;
  function select(panel, { lock = false, focus = false } = {}) {
    if (!panel || !panels.includes(panel)) return;
    if (lock) locked = panel;
    panels.forEach((el) => {
      const active = el === panel;
      el.classList.toggle("is-active", active);
      el.setAttribute("aria-expanded", String(active));
      const body = el.querySelector(".split-panel__content");
      if (body) body.inert = !active;
      el.querySelectorAll(".split-panel__story-button,.split-panel__action").forEach(
        (btn) => (btn.tabIndex = active ? 0 : -1),
      );
    });
    if (focus) panel.focus({ preventScroll: true });
  }
  function fillModal(panel) {
    const get = (s) => panel.querySelector(s)?.textContent.trim() || "";
    modal.querySelector("#urbs-story-number").textContent = get(".split-panel__meta b");
    modal.querySelector("#urbs-story-sector").textContent = get(".split-panel__kicker");
    modal.querySelector("#urbs-story-title").textContent = get("h3");
    modal.querySelector("#urbs-story-description").textContent = get(".split-panel__content p");
    const fields = panel.querySelectorAll(".split-panel__coords small");
    modal.querySelector("#urbs-story-coords").textContent = fields[0]?.textContent.trim() || "—";
    modal.querySelector("#urbs-story-status").textContent = fields[1]?.textContent.trim() || "—";
  }
  function makePixels() {
    pixels.replaceChildren();
    if (reduce) return;
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < 96; i++) {
      const tile = document.createElement("i");
      const col = i % 12,
        row = Math.floor(i / 12);
      const deterministic = ((col * 17 + row * 31) % 29) / 29;
      tile.style.setProperty(
        "--pixel-delay",
        (0.04 + Math.abs(col - 5.5) * 0.026 + deterministic * 0.21).toFixed(3) + "s",
      );
      tile.style.setProperty(
        "--pixel-rotate",
        ((i % 2 ? 1 : -1) * (18 + deterministic * 52)).toFixed(1) + "deg",
      );
      fragment.appendChild(tile);
    }
    pixels.appendChild(fragment);
  }
  function openStory(panel, trigger) {
    clearTimeout(closeTimer);
    fillModal(panel);
    returnFocus = trigger || panel;
    makePixels();
    modal.hidden = false;
    modalOpen = true;
    document.documentElement.classList.add("urbs-modal-open");
    // Ensure a transition from the closed state in all browsers.
    requestAnimationFrame(() => requestAnimationFrame(() => modal.classList.add("is-open")));
    closeButton.focus({ preventScroll: true });
  }
  function closeStory() {
    if (!modalOpen) return;
    modalOpen = false;
    modal.classList.remove("is-open");
    document.documentElement.classList.remove("urbs-modal-open");
    const previous = returnFocus;
    closeTimer = setTimeout(
      () => {
        if (!modalOpen) {
          modal.hidden = true;
          pixels.replaceChildren();
        }
      },
      reduce ? 0 : 460,
    );
    if (previous?.isConnected) previous.focus({ preventScroll: true });
  }
  panels.forEach((panel, index) => {
    if (finePointer)
      panel.addEventListener("pointerenter", () => {
        if (!modalOpen) select(panel);
      });
    panel.addEventListener("click", (event) => {
      if (event.target.closest("a")) return;
      if (event.target.closest(".split-panel__story-button")) {
        openStory(panel, event.target.closest("button"));
        return;
      }
      // Hover opens the panel; clicking the already expanded panel shows its story.
      const wasActive = panel.classList.contains("is-active");
      select(panel, { lock: true });
      if (wasActive) openStory(panel, panel);
    });
    panel.addEventListener("focus", (event) => {
      if (event.target === panel && !modalOpen) select(panel, { lock: true });
    });
    panel.addEventListener("keydown", (event) => {
      if (event.target !== panel || modalOpen) return;
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        const active = panel.classList.contains("is-active");
        select(panel, { lock: true });
        if (active) openStory(panel, panel);
      } else if (
        ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp", "Home", "End"].includes(event.key)
      ) {
        event.preventDefault();
        const n =
          event.key === "Home"
            ? 0
            : event.key === "End"
              ? panels.length - 1
              : (index +
                  (event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1) +
                  panels.length) %
                panels.length;
        select(panels[n], { lock: true, focus: true });
      }
    });
  });
  if (finePointer)
    root.addEventListener("pointerleave", () => {
      if (!modalOpen) select(locked);
    });
  closeButton.addEventListener("click", closeStory);
  modal.querySelector(".urbs-story-modal__backdrop").addEventListener("click", closeStory);
  document.addEventListener("keydown", (event) => {
    if (!modalOpen) return;
    if (event.key === "Escape") {
      event.preventDefault();
      closeStory();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = [...dialog.querySelectorAll("button:not([disabled]),a[href]")].filter(
      (el) => el.getClientRects().length,
    );
    if (!focusable.length) {
      event.preventDefault();
      dialog.focus();
      return;
    }
    const first = focusable[0],
      last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
  select(locked, { lock: true });
})();
