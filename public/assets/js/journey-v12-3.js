/* URBS V12.3 — rail feedback only, no scroll interception. */
(() => {
  "use strict";
  const root = document.querySelector(".journey-v123");
  if (!root) return;
  const cards = [...root.querySelectorAll(".journey-card")];
  const activate = (step) => {
    root.dataset.active = String(step);
    root.style.setProperty("--step-progress", step === 1 ? "0" : step === 2 ? "0.5" : "1");
  };
  cards.forEach((card, index) => {
    card.addEventListener("pointerenter", () => activate(index + 1));
    card.addEventListener("focusin", () => activate(index + 1));
  });
  root.querySelector(".journey-grid")?.addEventListener("pointerleave", () => {
    root.removeAttribute("data-active");
    root.style.setProperty("--step-progress", "0");
  });
  root.addEventListener("focusout", (e) => {
    if (!root.contains(e.relatedTarget)) {
      root.removeAttribute("data-active");
      root.style.setProperty("--step-progress", "0");
    }
  });
})();
