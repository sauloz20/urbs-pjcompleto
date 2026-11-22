/* URBS — V9: transição de entrada e refinamentos de conteúdo. */
(() => {
  "use strict";
  const root = document.documentElement;
  if (root.classList.contains("urbs-home-arriving")) {
    const reveal = () => {
      root.classList.add("urbs-home-revealed");
      setTimeout(() => root.classList.remove("urbs-home-arriving", "urbs-home-revealed"), 1200);
    };
    if (document.readyState === "complete") setTimeout(reveal, 450);
    else window.addEventListener("load", () => setTimeout(reveal, 450), { once: true });
    setTimeout(reveal, 2300); // rede lenta nunca bloqueia a navegação
  }
  // Do not animate whole sections from opacity: 0. A failed trigger must never
  // hide the manifesto, territory information, or FAQ.
})();
