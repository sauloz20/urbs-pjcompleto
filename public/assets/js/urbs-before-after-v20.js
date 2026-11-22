/* URBS V20 — comparador com quatro intervenções reais documentadas.
   As fontes fornecem composições de duas fotografias empilhadas verticalmente.
   O recorte em CSS permite sobrepor os dois estados sem produzir imagens fictícias.
*/
(() => {
  "use strict";
  // Frações verticais da montagem que excluem as legendas impressas.
  const curitibaFrames = { before: [0.055, 0.495], after: [0.555, 0.995] };
  const cases = [
    {
      title: "Pavimentação de vias locais",
      thumbnail: "ASFALTO",
      category: "PAVIMENTAÇÃO",
      location: "CURITIBA / PR · TATUQUARA",
      description:
        "Observe as mudanças no piso, no meio-fio e na sinalização. As fotos documentam a pavimentação da Rua Clothilde Hachenberg Monastier.",
      photo: "https://mid-noticias.curitiba.pr.gov.br/2024/00441623.jpg",
      frames: curitibaFrames,
      source:
        "https://www.curitiba.pr.gov.br/noticias/antes-e-depois-veja-como-ficou-rua-de-curitiba-transformada-por-obra-da-prefeitura/73095",
      metrics: [
        ["EXTENSÃO", "90 m"],
        ["INTERVENÇÃO", "Asfalto"],
        ["STATUS", "Concluída"],
      ],
    },
    {
      title: "Escoamento da água da chuva",
      thumbnail: "DRENAGEM",
      category: "DRENAGEM E PAVIMENTAÇÃO",
      location: "CURITIBA / PR · LAMENHA PEQUENA",
      description:
        "A Rua Lionidetti Sovinski Pacheco passou de saibro a asfalto. A obra incluiu galerias pluviais para escoar a água da chuva.",
      photo: "https://mid-noticias.curitiba.pr.gov.br/2024/00433866.jpg",
      frames: curitibaFrames,
      source:
        "https://www.curitiba.pr.gov.br/noticias/antes-e-depois-rua-de-curitiba-e-transformada-com-asfalto-e-sistema-de-drenagem/72588",
      metrics: [
        ["ANTES", "Saibro"],
        ["DEPOIS", "Asfalto"],
        ["STATUS", "Concluída"],
      ],
    },
    {
      title: "Calçadas e saneamento",
      thumbnail: "CALÇADAS",
      category: "URBANIZAÇÃO",
      location: "FORTALEZA / CE",
      description:
        "Na Rua Expedito Madruga Monte, a urbanização reuniu pavimentação, calçadas e obras de saneamento.",
      photo: "assets/images/comparacoes/expedito-madruga-monte.jpg",
      frames: { before: [0.04, 0.44], after: [0.6, 1], width: 0.72 },
      source:
        "https://www.fortaleza.ce.gov.br/noticias/obras-de-drenagem-e-saneamento-vao-beneficiar-65-ruas-no-canindezinho",
      metrics: [
        ["TIPO", "Urbanização"],
        ["REGIÃO", "Fortaleza"],
        ["FONTE", "Prefeitura"],
      ],
    },
    {
      title: "Pavimentação e drenagem integradas",
      thumbnail: "PAVIMENTAÇÃO",
      category: "PAVIMENTAÇÃO E DRENAGEM",
      location: "CURITIBA / PR · UMBARÁ",
      description:
        "Na Rua Manoel Miguel Alves Filho, 742 metros receberam pavimentação, meio-fio e galerias pluviais.",
      photo: "https://mid-noticias.curitiba.pr.gov.br/2024/capa/00440018.jpg",
      frames: curitibaFrames,
      source:
        "https://www.curitiba.pr.gov.br/noticias/prefeitura-de-curitiba-troca-saibro-pelo-asfalto-e-melhora-a-vida-de-moradores-do-umbara/72945",
      metrics: [
        ["EXTENSÃO", "742 m"],
        ["INTERVENÇÃO", "Drenagem"],
        ["STATUS", "Concluída"],
      ],
    },
  ];
  const byId = (id) => document.getElementById(id);
  const viewer = byId("urb-ba-viewer");
  if (!viewer) return;
  const range = byId("urb-ba-slider");
  const before = byId("urb-ba-before");
  const after = byId("urb-ba-after");
  const thumbs = byId("urb-ba-thumbnails");
  const error = byId("urb-ba-image-error");
  let active = 0;
  let loadToken = 0;
  let animationTimeout = 0;
  const info = byId("urb-ba-details") || document.querySelector(".urb-comparison__info");
  const dialog = byId("urb-ba-dialog");
  const host = byId("urb-ba-viewer-host");
  const stage = byId("urb-ba-dialog-stage");
  const openFullscreen = byId("urb-ba-open-fullscreen");
  const updateSplit = () => viewer.style.setProperty("--urb-ba-split", `${Number(range.value)}%`);
  const presetButtons = [...document.querySelectorAll("[data-urb-ba-preset]")];
  const syncPresets = () => {
    const current = Math.round(Number(range.value));
    presetButtons.forEach((button) => {
      const pressed = current === Number(button.dataset.urbBaPreset);
      button.classList.toggle("is-active", pressed);
      button.setAttribute("aria-pressed", String(pressed));
    });
  };
  const setSplit = (position) => {
    range.value = String(position);
    updateSplit();
    syncPresets();
  };
  range.addEventListener("input", () => {
    updateSplit();
    syncPresets();
  });
  presetButtons.forEach((button) =>
    button.addEventListener("click", () => {
      setSplit(Number(button.dataset.urbBaPreset));
      range.focus({ preventScroll: true });
    }),
  );
  function setPhoto(element, item, side) {
    const [start, end] = item.frames[side];
    const height = end - start;
    const width = item.frames.width ?? 1;
    element.style.backgroundImage = `url("${item.photo.replaceAll('"', "%22")}")`;
    element.style.backgroundSize = `${100 / width}% ${100 / height}%`;
    element.style.backgroundPosition = `center ${((start / (1 - height)) * 100).toFixed(6)}%`;
  }
  function setCase(index) {
    active = (index + cases.length) % cases.length;
    const item = cases[active];
    byId("urb-ba-title").textContent = item.title;
    byId("urb-ba-category").textContent = item.category;
    byId("urb-ba-description").textContent = item.description;
    byId("urb-ba-location").textContent = `FOTOS: ${item.location}`;
    byId("urb-ba-source").href = item.source;
    byId("urb-ba-counter").textContent =
      `${String(active + 1).padStart(2, "0")} / ${String(cases.length).padStart(2, "0")}`;
    item.metrics.forEach(([label, value], i) => {
      byId(`urb-ba-metric-label-${i + 1}`).textContent = label;
      byId(`urb-ba-metric-${i + 1}`).textContent = value;
    });
    setPhoto(before, item, "before");
    setPhoto(after, item, "after");
    clearTimeout(animationTimeout);
    viewer.classList.remove("is-transitioning");
    info?.classList.remove("is-transitioning");
    // Reinicia as animações sem afetar os demais elementos da homepage.
    void viewer.offsetWidth;
    viewer.classList.add("is-transitioning");
    info?.classList.add("is-transitioning");
    animationTimeout = window.setTimeout(() => {
      viewer.classList.remove("is-transitioning");
      info?.classList.remove("is-transitioning");
    }, 520);
    after.setAttribute("aria-label", `Imagem da condição posterior: ${item.title}.`);
    error.hidden = true;
    setSplit(50);
    byId("urb-ba-progress-fill").style.width = `${((active + 1) / cases.length) * 100}%`;
    byId("urb-ba-dialog-counter").textContent = byId("urb-ba-counter").textContent;
    byId("urb-ba-dialog-title").textContent = item.title;
    [...thumbs.children].forEach((thumb, i) => {
      thumb.classList.toggle("is-active", i === active);
      thumb.setAttribute("aria-pressed", String(i === active));
    });
    const token = ++loadToken;
    const check = new Image();
    check.onerror = () => {
      if (token === loadToken) error.hidden = false;
    };
    check.src = item.photo;
  }
  cases.forEach((item, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "urb-comparison__thumb";
    button.setAttribute("aria-label", `Visualizar ${item.title}`);
    const photo = document.createElement("span");
    photo.className = "urb-comparison__thumb-photo";
    setPhoto(photo, item, "after");
    button.appendChild(photo);
    const label = document.createElement("span");
    label.className = "urb-comparison__thumb-label";
    label.textContent = `${String(index + 1).padStart(2, "0")} / ${item.thumbnail}`;
    button.appendChild(label);
    button.addEventListener("click", () => setCase(index));
    thumbs.appendChild(button);
  });
  byId("urb-ba-prev").addEventListener("click", () => setCase(active - 1));
  byId("urb-ba-next").addEventListener("click", () => setCase(active + 1));
  const closeFullscreen = () => {
    if (dialog.open) dialog.close();
  };
  const restoreViewer = () => {
    host.appendChild(viewer);
    openFullscreen.focus({ preventScroll: true });
  };
  openFullscreen.addEventListener("click", () => {
    if (!dialog.showModal) return;
    stage.appendChild(viewer);
    try {
      dialog.showModal();
      byId("urb-ba-dialog-close").focus({ preventScroll: true });
    } catch (error) {
      host.appendChild(viewer);
      console.warn("Não foi possível ampliar o comparador.", error);
    }
  });
  dialog.addEventListener("close", restoreViewer);
  byId("urb-ba-dialog-close").addEventListener("click", closeFullscreen);
  byId("urb-ba-dialog-prev").addEventListener("click", () => setCase(active - 1));
  byId("urb-ba-dialog-next").addEventListener("click", () => setCase(active + 1));
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) closeFullscreen();
  });
  dialog.addEventListener("keydown", (event) => {
    if (event.target === range) return; // Setas do teclado movem o divisor.
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      setCase(active - 1);
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      setCase(active + 1);
    }
  });
  // Troca de slides apenas por botões e miniaturas — sem swipe horizontal.
  setCase(0);
})();
