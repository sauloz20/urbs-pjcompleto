/* URBS — Comparador Antes / Depois com dissolve real em camada dupla e pré-decodificação */
(() => {
  'use strict';

  const curitibaFrames = { before: [0.055, 0.495], after: [0.555, 0.995] };
  const cases = [
    {
      title: 'Pavimentação de vias locais',
      thumbnail: 'ASFALTO',
      category: 'PAVIMENTAÇÃO',
      urbsCategory: 'Pavimentação',
      location: 'CURITIBA / PR · TATUQUARA',
      description: 'Substituição de piso irregular por asfalto definitivo, meio-fio e sinalização horizontal na Rua Clothilde Hachenberg Monastier.',
      photo: 'https://mid-noticias.curitiba.pr.gov.br/2024/00441623.jpg',
      frames: curitibaFrames,
      source: 'https://www.curitiba.pr.gov.br/noticias/antes-e-depois-veja-como-ficou-rua-de-curitiba-transformada-por-obra-da-prefeitura/73095',
      metrics: [
        ['EXTENSÃO', '90 m'],
        ['GANHO DIRETO', 'Mobilidade'],
        ['SOLUÇÃO', 'Pavimento']
      ]
    },
    {
      title: 'Escoamento da água da chuva',
      thumbnail: 'DRENAGEM',
      category: 'DRENAGEM E VIAS',
      urbsCategory: 'Drenagem',
      location: 'CURITIBA / PR · LAMENHA PEQUENA',
      description: 'Implantação de galerias pluviais e novo pavimento na Rua Lionidetti Sovinski Pacheco, eliminando lama e pontos de alagamento.',
      photo: 'https://mid-noticias.curitiba.pr.gov.br/2024/00433866.jpg',
      frames: curitibaFrames,
      source: 'https://www.curitiba.pr.gov.br/noticias/antes-e-depois-rua-de-curitiba-e-transformada-com-asfalto-e-sistema-de-drenagem/72588',
      metrics: [
        ['ANTES', 'Saibro'],
        ['GANHO DIRETO', 'Escoamento'],
        ['SOLUÇÃO', 'Galerias']
      ]
    },
    {
      title: 'Calçadas e saneamento',
      thumbnail: 'CALÇADAS',
      category: 'ACESSIBILIDADE',
      urbsCategory: 'Acessibilidade',
      location: 'FORTALEZA / CE · CANINDEZINHO',
      description: 'Requalificação da Rua Expedito Madruga Monte reunindo calçadas niveladas, drenagem superficial e circulação segura para pedestres.',
      photo: 'assets/images/comparacoes/expedito-madruga-monte.jpg',
      frames: { before: [0.04, 0.44], after: [0.60, 1], width: 0.72 },
      source: 'https://www.fortaleza.ce.gov.br/noticias/obras-de-drenagem-e-saneamento-vao-beneficiar-65-ruas-no-canindezinho',
      metrics: [
        ['FOCO', 'Pedestres'],
        ['GANHO DIRETO', 'Segurança'],
        ['SOLUÇÃO', 'Urbanização']
      ]
    },
    {
      title: 'Pavimentação e drenagem integradas',
      thumbnail: 'CORREDOR',
      category: 'PAVIMENTAÇÃO E DRENAGEM',
      urbsCategory: 'Pavimentação',
      location: 'CURITIBA / PR · UMBARÁ',
      description: 'Mais de 740 metros da Rua Manoel Miguel Alves Filho requalificados com drenagem profunda, meio-fio e revestimento asfáltico.',
      photo: 'https://mid-noticias.curitiba.pr.gov.br/2024/capa/00440018.jpg',
      frames: curitibaFrames,
      source: 'https://www.curitiba.pr.gov.br/noticias/prefeitura-de-curitiba-troca-saibro-pelo-asfalto-e-melhora-a-vida-de-moradores-do-umbara/72945',
      metrics: [
        ['EXTENSÃO', '742 m'],
        ['GANHO DIRETO', 'Fluidez'],
        ['SOLUÇÃO', 'Obra completa']
      ]
    }
  ];

  const byId = (id) => document.getElementById(id);
  const viewer = byId('urb-ba-viewer');
  if (!viewer) return;

  const range = byId('urb-ba-slider');
  const before = byId('urb-ba-before');
  const after = byId('urb-ba-after');
  const thumbs = byId('urb-ba-thumbnails');
  const error = byId('urb-ba-image-error');
  const info = byId('urb-ba-details') || document.querySelector('.urb-comparison__info');
  const reportCta = byId('urb-ba-report-cta');
  const dialog = byId('urb-ba-dialog');
  const host = byId('urb-ba-viewer-host');
  const stage = byId('urb-ba-dialog-stage');
  const openFullscreen = byId('urb-ba-open-fullscreen');
  const presetButtons = [...document.querySelectorAll('[data-urb-ba-preset]')];
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let active = 0;
  let loadToken = 0;
  let animationTimeout = 0;
  let presetAnimTimeout = 0;
  let ghostCleanupTimer = 0;
  let initialized = false;

  const updateSplit = () => {
    viewer.style.setProperty('--urb-ba-split', `${Number(range.value)}%`);
  };

  const syncPresets = () => {
    const current = Math.round(Number(range.value));
    presetButtons.forEach((button) => {
      const pressed = current === Number(button.dataset.urbBaPreset);
      button.classList.toggle('is-active', pressed);
      button.setAttribute('aria-pressed', String(pressed));
    });
  };

  const setSplit = (position, animate = false) => {
    window.clearTimeout(presetAnimTimeout);
    viewer.classList.toggle('is-preset-animating', animate && !reducedMotion);
    range.value = String(position);
    updateSplit();
    syncPresets();
    if (animate && !reducedMotion) {
      presetAnimTimeout = window.setTimeout(() => {
        viewer.classList.remove('is-preset-animating');
      }, 540);
    }
  };

  // Arrastar manualmente desliga a animação de preset para resposta instantânea
  range.addEventListener('pointerdown', () => {
    viewer.classList.remove('is-preset-animating');
  });
  range.addEventListener('input', () => {
    viewer.classList.remove('is-preset-animating');
    updateSplit();
    syncPresets();
  });

  presetButtons.forEach((button) => {
    button.addEventListener('click', () => {
      setSplit(Number(button.dataset.urbBaPreset), true);
    });
  });

  function setPhoto(element, item, side) {
    const [start, end] = item.frames[side];
    const height = end - start;
    const width = item.frames.width ?? 1;
    element.style.backgroundImage = `url("${item.photo.replaceAll('"', '%22')}")`;
    element.style.backgroundSize = `${100 / width}% ${100 / height}%`;
    element.style.backgroundPosition = `center ${(start / (1 - height) * 100).toFixed(6)}%`;
  }

  // Pré-carrega e decodifica na GPU para o crossfade começar sem engasgo
  const preloadCache = new Map();
  function preloadPhoto(url) {
    if (preloadCache.has(url)) return preloadCache.get(url);
    const promise = new Promise((resolve) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => {
        if (typeof img.decode === 'function') {
          img.decode().catch(() => {}).finally(() => resolve(true));
        } else {
          resolve(true);
        }
      };
      img.onerror = () => resolve(false);
      img.src = url;
    });
    preloadCache.set(url, promise);
    return promise;
  }
  cases.forEach((item) => preloadPhoto(item.photo));

  function clearGhosts() {
    window.clearTimeout(ghostCleanupTimer);
    viewer.querySelectorAll('.urb-comparison__photo--ghost').forEach((el) => el.remove());
  }

  function spawnCrossfadeGhost(element) {
    if (!element.style.backgroundImage) return null;
    const ghost = document.createElement('div');
    ghost.className = `${element.className} urb-comparison__photo--ghost`;
    ghost.setAttribute('aria-hidden', 'true');
    ghost.style.backgroundImage = element.style.backgroundImage;
    ghost.style.backgroundSize = element.style.backgroundSize;
    ghost.style.backgroundPosition = element.style.backgroundPosition;
    element.insertAdjacentElement('afterend', ghost);
    return ghost;
  }

  async function setCase(index) {
    const nextIndex = (index + cases.length) % cases.length;
    if (initialized && nextIndex === active) return;

    active = nextIndex;
    const item = cases[active];
    const token = ++loadToken;
    const isFirstLoad = !initialized;
    initialized = true;

    // Resposta visual imediata nas miniaturas e barra de progresso
    [...thumbs.children].forEach((thumb, i) => {
      thumb.classList.toggle('is-active', i === active);
      thumb.setAttribute('aria-pressed', String(i === active));
    });
    byId('urb-ba-counter').textContent = `${String(active + 1).padStart(2, '0')} / ${String(cases.length).padStart(2, '0')}`;
    byId('urb-ba-progress-fill').style.width = `${((active + 1) / cases.length) * 100}%`;

    const ok = await preloadPhoto(item.photo);
    if (token !== loadToken) return;

    error.hidden = ok;

    // Captura a foto anterior em camadas-fantasma para dissolver direto na nova (sem piscar)
    clearGhosts();
    let ghostAfter = null;
    let ghostBefore = null;
    if (!isFirstLoad && !reducedMotion) {
      ghostAfter = spawnCrossfadeGhost(after);
      ghostBefore = spawnCrossfadeGhost(before);
    }

    byId('urb-ba-title').textContent = item.title;
    byId('urb-ba-category').textContent = item.category;
    byId('urb-ba-description').textContent = item.description;
    byId('urb-ba-location').textContent = item.location;
    byId('urb-ba-source').href = item.source;
    byId('urb-ba-dialog-counter').textContent = byId('urb-ba-counter').textContent;
    byId('urb-ba-dialog-title').textContent = item.title;

    if (reportCta) {
      reportCta.href = `registro.html?categoria=${encodeURIComponent(item.urbsCategory)}`;
    }

    item.metrics.forEach(([label, value], i) => {
      byId(`urb-ba-metric-label-${i + 1}`).textContent = label;
      byId(`urb-ba-metric-${i + 1}`).textContent = value;
    });

    setPhoto(before, item, 'before');
    setPhoto(after, item, 'after');
    after.setAttribute('aria-label', `Imagem posterior: ${item.title}.`);

    // Retorna o divisor suavemente ao centro ao trocar de exemplo
    setSplit(50, !isFirstLoad);

    if (!isFirstLoad && !reducedMotion) {
      window.clearTimeout(animationTimeout);
      viewer.classList.remove('is-transitioning');
      info?.classList.remove('is-transitioning');
      void viewer.offsetWidth;
      viewer.classList.add('is-transitioning');
      info?.classList.add('is-transitioning');

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          ghostAfter?.classList.add('is-fading-out');
          ghostBefore?.classList.add('is-fading-out');
        });
      });

      ghostCleanupTimer = window.setTimeout(clearGhosts, 620);
      animationTimeout = window.setTimeout(() => {
        viewer.classList.remove('is-transitioning');
        info?.classList.remove('is-transitioning');
      }, 660);
    }
  }

  // Monta as 4 miniaturas antes da carga inicial
  cases.forEach((item, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'urb-comparison__thumb';
    button.setAttribute('aria-label', `Visualizar ${item.title}`);

    const photo = document.createElement('span');
    photo.className = 'urb-comparison__thumb-photo';
    setPhoto(photo, item, 'after');
    button.appendChild(photo);

    const label = document.createElement('span');
    label.className = 'urb-comparison__thumb-label';
    label.textContent = `${String(index + 1).padStart(2, '0')} · ${item.thumbnail}`;
    button.appendChild(label);

    button.addEventListener('click', () => setCase(index));
    thumbs.appendChild(button);
  });

  byId('urb-ba-prev')?.addEventListener('click', () => setCase(active - 1));
  byId('urb-ba-next')?.addEventListener('click', () => setCase(active + 1));

  const closeFullscreen = () => {
    if (dialog?.open) dialog.close();
  };

  const restoreViewer = () => {
    host.appendChild(viewer);
    openFullscreen?.focus({ preventScroll: true });
  };

  openFullscreen?.addEventListener('click', () => {
    if (!dialog?.showModal) return;
    stage.appendChild(viewer);
    try {
      dialog.showModal();
      byId('urb-ba-dialog-close')?.focus({ preventScroll: true });
    } catch (err) {
      host.appendChild(viewer);
      console.warn('Não foi possível ampliar o comparador.', err);
    }
  });

  dialog?.addEventListener('close', restoreViewer);
  byId('urb-ba-dialog-close')?.addEventListener('click', closeFullscreen);
  byId('urb-ba-dialog-prev')?.addEventListener('click', () => setCase(active - 1));
  byId('urb-ba-dialog-next')?.addEventListener('click', () => setCase(active + 1));

  dialog?.addEventListener('click', (event) => {
    if (event.target === dialog) closeFullscreen();
  });

  dialog?.addEventListener('keydown', (event) => {
    if (event.target === range) return;
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      setCase(active - 1);
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      setCase(active + 1);
    }
  });

  setCase(0);
})();