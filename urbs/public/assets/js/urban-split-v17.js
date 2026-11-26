/* URBS — Seção 4: Acordeão editorial + Modal com dossiê completo, checklist e links de categoria */
(() => {
  'use strict';

  const root = document.getElementById('splitAccordion');
  const modal = document.getElementById('urbs-story-modal');
  if (!root || !modal) return;

  const panels = [...root.querySelectorAll('.split-panel')];
  if (!panels.length) return;

  const dialog = modal.querySelector('.urbs-story-modal__dialog');
  const closeButton = modal.querySelector('.urbs-story-modal__close');
  const pixels = modal.querySelector('.urbs-story-modal__pixels');
  const checklistEl = modal.querySelector('#urbs-story-checklist');
  const mapLinkEl = modal.querySelector('#urbs-story-map-link');
  const registerLinkEl = modal.querySelector('#urbs-story-register-link');

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;

  // Relatos aprofundados (não repetem o parágrafo curto da faixa)
  const DOSSIERS = {
    'demo-pavimento': {
      story:
        'Falhas no pavimento em avenidas de ligação provocam frenagens bruscas, danos a veículos e desvios perigosos próximos a pedestres. Quando moradores marcam a posição exata no URBS, pontos críticos recorrentes passam a compor um mapa claro de prioridade para manutenção.',
      team: 'Obras e Pavimentação',
      checklist: [
        'Indique se o buraco ou desnível ocupa faixa de rolamento ou cruzamento.',
        'Informe um ponto de referência próximo (comércio, esquina ou número).',
        'Descreva se há acúmulo de água ou risco direto para motos e bicicletas.'
      ]
    },
    'demo-iluminacao': {
      story:
        'Trechos escuros em torno de parques, pontos de ônibus e travessias afastam pedestres no período noturno. O registro georreferenciado permite identificar rapidamente quais postes estão apagados ou oscilando e acompanhar a reposição pelo histórico da ocorrência.',
      team: 'Iluminação Pública',
      checklist: [
        'Aponte se o problema é em um poste isolado ou em uma sequência da rua.',
        'Informe se a lâmpada está totalmente apagada ou piscando.',
        'Marque no mapa o lado exato da via ou praça afetada.'
      ]
    },
    'demo-acessibilidade': {
      story:
        'A mobilidade urbana começa na calçada. Rampas ausentes, degraus irregulares e pisos táteis quebrados em áreas comerciais obrigam pessoas com mobilidade reduzida a dividirem o asfalto com carros. Mapear essas barreiras dá visibilidade real a quem mais precisa.',
      team: 'Mobilidade e Acessibilidade',
      checklist: [
        'Informe se falta rampa de acesso, se o piso está solto ou se há obstáculo fixo.',
        'Sinalize se o trecho fica próximo a escolas, hospitais ou faixa de pedestres.',
        'Posicione o marcador exatamente na esquina ou calçada afetada.'
      ]
    },
    'demo-residuos': {
      story:
        'O descarte irregular de entulho e móveis em calçadas e terrenos baldios favorece focos de insetos, mau cheiro e entupimento de bueiros nas chuvas. Acompanhar esses pontos no mapa ajuda a registrar reincidências e validar quando a limpeza é concluída.',
      team: 'Limpeza e Zeladoria Urbana',
      checklist: [
        'Descreva o tipo de resíduo (entulho de obra, lixo doméstico, galhos ou móveis).',
        'Informe se o material está bloqueando a passagem na calçada ou na via.',
        'Relate se o descarte acontece de forma recorrente naquele mesmo ponto.'
      ]
    },
    'demo-drenagem': {
      story:
        'Bueiros obstruídos e grades quebradas transformam chuvas comuns em pontos de alagamento que isolam vias e danificam o pavimento. O mapeamento colaborativo antecipa áreas críticas antes que os prejuízos se repitam a cada temporada chuvosa.',
      team: 'Drenagem e Saneamento',
      checklist: [
        'Informe se a boca de lobo está entupida, sem grade ou com tampa quebrada.',
        'Descreva se há alagamento recorrente ou água parada mesmo após a chuva.',
        'Marque o cruzamento ou ponto mais baixo da rua onde a água se concentra.'
      ]
    }
  };

  let locked = panels[0];
  let modalOpen = false;
  let returnFocus = null;
  let closeTimer = 0;

  function select(panel, { lock = false, focus = false } = {}) {
    if (!panel || !panels.includes(panel)) return;
    if (lock) locked = panel;

    panels.forEach((el) => {
      const active = el === panel;
      const trigger = el.querySelector('.split-panel__collapsed');
      el.classList.toggle('is-active', active);
      trigger?.setAttribute('aria-expanded', String(active));

      const body = el.querySelector('.split-panel__content');
      if (body) body.inert = !active;
      el.querySelectorAll('.split-panel__story-button, .split-panel__action').forEach((btn) => {
        btn.tabIndex = active ? 0 : -1;
      });
    });

    if (focus) {
      panel.querySelector('.split-panel__collapsed')?.focus({ preventScroll: true });
    }
  }

  function fillModal(panel) {
    const id = panel.dataset.demoId;
    const category = panel.dataset.category || 'Outro';
    const dossier = DOSSIERS[id];
    const get = (sel) => panel.querySelector(sel)?.textContent.trim() || '';
    const coordsFields = panel.querySelectorAll('.split-panel__coords small');

    modal.querySelector('#urbs-story-number').textContent = get('.split-panel__meta b');
    modal.querySelector('#urbs-story-sector').textContent = get('.split-panel__sector-pill');
    modal.querySelector('#urbs-story-title').textContent = get('h3');
    modal.querySelector('#urbs-story-description').textContent =
      dossier?.story || get('.split-panel__content p');

    modal.querySelector('#urbs-story-ref').textContent = coordsFields[0]?.textContent.trim() || 'Montes Claros, MG';
    modal.querySelector('#urbs-story-team').textContent = dossier?.team || 'Infraestrutura Urbana';
    modal.querySelector('#urbs-story-coords').textContent = coordsFields[1]?.textContent.trim() || '—';

    if (checklistEl) {
      checklistEl.replaceChildren();
      (dossier?.checklist || []).forEach((item) => {
        const li = document.createElement('li');
        li.textContent = item;
        checklistEl.appendChild(li);
      });
    }

    const encodedCat = encodeURIComponent(category);
    if (mapLinkEl) mapLinkEl.href = `mapa.html?categoria=${encodedCat}`;
    if (registerLinkEl) registerLinkEl.href = `registro.html?categoria=${encodedCat}`;
  }

  function makePixels() {
    pixels.replaceChildren();
    if (reduce) return;
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < 96; i++) {
      const tile = document.createElement('i');
      const col = i % 12;
      const row = Math.floor(i / 12);
      const deterministic = ((col * 17 + row * 31) % 29) / 29;
      tile.style.setProperty('--pixel-delay', (0.04 + Math.abs(col - 5.5) * 0.025 + deterministic * 0.2).toFixed(3) + 's');
      tile.style.setProperty('--pixel-rotate', ((i % 2 ? 1 : -1) * (18 + deterministic * 48)).toFixed(1) + 'deg');
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
    document.documentElement.classList.add('urbs-modal-open');
    requestAnimationFrame(() => requestAnimationFrame(() => modal.classList.add('is-open')));
    closeButton.focus({ preventScroll: true });
  }

  function closeStory() {
    if (!modalOpen) return;
    modalOpen = false;
    modal.classList.remove('is-open');
    document.documentElement.classList.remove('urbs-modal-open');
    const previous = returnFocus;
    closeTimer = setTimeout(() => {
      if (!modalOpen) {
        modal.hidden = true;
        pixels.replaceChildren();
      }
    }, reduce ? 0 : 440);
    if (previous?.isConnected) previous.focus({ preventScroll: true });
  }

  panels.forEach((panel, index) => {
    const trigger = panel.querySelector('.split-panel__collapsed');

    if (finePointer) {
      panel.addEventListener('pointerenter', () => {
        if (!modalOpen) select(panel);
      });
    }

    panel.addEventListener('click', (event) => {
      if (event.target.closest('a')) return;
      const storyBtn = event.target.closest('.split-panel__story-button');
      if (storyBtn) {
        openStory(panel, storyBtn);
        return;
      }
      const clickedTrigger = Boolean(event.target.closest('.split-panel__collapsed'));
      const wasActive = panel.classList.contains('is-active');
      select(panel, { lock: true });
      if (wasActive && finePointer && !clickedTrigger) {
        openStory(panel, panel.querySelector('.split-panel__story-button'));
      }
    });

    trigger?.addEventListener('focus', () => {
      if (!modalOpen) select(panel, { lock: true });
    });

    trigger?.addEventListener('keydown', (event) => {
      if (modalOpen) return;
      if (['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
        event.preventDefault();
        const nextIdx =
          event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? panels.length - 1
              : (index + (event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1) + panels.length) %
                panels.length;
        select(panels[nextIdx], { lock: true, focus: true });
      }
    });
  });

  if (finePointer) {
    root.addEventListener('pointerleave', () => {
      if (!modalOpen) select(locked);
    });
  }

  closeButton.addEventListener('click', closeStory);
  modal.querySelector('.urbs-story-modal__backdrop').addEventListener('click', closeStory);

  document.addEventListener('keydown', (event) => {
    if (!modalOpen) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      closeStory();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = [...dialog.querySelectorAll('button:not([disabled]), a[href]')].filter(
      (el) => el.getClientRects().length
    );
    if (!focusable.length) {
      event.preventDefault();
      dialog.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
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