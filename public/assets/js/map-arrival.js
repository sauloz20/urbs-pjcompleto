/* URBS V8 — chegada ao mapa. Sem autenticação, sem persistir dados pessoais. */
(() => {
  "use strict";
  if (!document.documentElement.classList.contains("urbs-is-arriving")) return;
  let released = false;
  function reveal() {
    if (released) return;
    released = true;
    document.documentElement.classList.add("urbs-arrival-reveal");
    // A transição da interface pode começar mesmo sem carregar as tiles.
    setTimeout(
      () => document.documentElement.classList.remove("urbs-is-arriving", "urbs-arrival-reveal"),
      1150,
    );
  }
  // Não segurar o usuário à espera da rede. Máximo de 900 ms após DOM pronto.
  document.addEventListener("DOMContentLoaded", () => {
    const map = document.getElementById("map");
    let started = false;
    const show = () => {
      if (started) return;
      started = true;
      setTimeout(reveal, 180);
    };
    if (map) {
      const observer = new MutationObserver(() => {
        if (map.querySelector(".leaflet-tile-loaded")) {
          observer.disconnect();
          show();
        }
      });
      observer.observe(map, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["class"],
      });
      setTimeout(() => {
        observer.disconnect();
        show();
      }, 750);
    } else show();
  });
  setTimeout(reveal, 2000); // fail-safe para erro de conexão / arquivos.
})();
