/* URBS — Navegação Editorial (Cortina Full-Screen + Scroll-Spy), Carrossel Full-Bleed e Tipografia Cinética */
(() => {
  'use strict';

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // 1. Cortina Editorial Full-Screen (Desktop via Pílula + Mobile via Hambúrguer)
  initEditorialCurtain();
  function initEditorialCurtain() {
    const curtain = document.getElementById('urbs-curtain');
    if (!curtain) return;

    const shell = curtain.querySelector('.urbs-curtain__shell');
    const toggles = [...document.querySelectorAll('[data-curtain-toggle]')];
    const closers = [...curtain.querySelectorAll('[data-curtain-close]')];
    const anchorLinks = [...document.querySelectorAll('.nav a[href^="#"], .urbs-curtain__link[href^="#"]')];

    let isOpen = false;
    let lastTrigger = null;
    let closeTimer = 0;

    const syncAria = (open) => {
      toggles.forEach((btn) => {
        btn.setAttribute('aria-expanded', String(open));
        btn.classList.toggle('is-open', open);
      });
    };

    const openCurtain = (trigger) => {
      if (isOpen) return;
      clearTimeout(closeTimer);
      isOpen = true;
      lastTrigger = trigger || null;
      curtain.hidden = false;
      curtain.setAttribute('aria-hidden', 'false');
      document.documentElement.classList.add('urbs-curtain-open');
      syncAria(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          curtain.classList.add('is-open');
          shell?.focus({ preventScroll: true });
        });
      });
    };

    const closeCurtain = ({ restoreFocus = true } = {}) => {
      if (!isOpen) return;
      isOpen = false;
      curtain.classList.remove('is-open');
      curtain.setAttribute('aria-hidden', 'true');
      document.documentElement.classList.remove('urbs-curtain-open');
      syncAria(false);
      closeTimer = window.setTimeout(() => {
        if (!isOpen) curtain.hidden = true;
      }, reduced ? 0 : 620);
      if (restoreFocus && lastTrigger?.isConnected) {
        lastTrigger.focus({ preventScroll: true });
      }
    };

    toggles.forEach((btn) => {
      btn.addEventListener('click', () => {
        if (isOpen) closeCurtain();
        else openCurtain(btn);
      });
    });

    closers.forEach((btn) => {
      btn.addEventListener('click', () => closeCurtain());
    });

    // Chegada limpa nas seções + pulso sutil no cabeçalho da seção escolhida
    const pulseSection = (target) => {
      if (!target || reduced) return;
      target.classList.remove('urbs-section-pulse');
      void target.offsetWidth;
      target.classList.add('urbs-section-pulse');
      window.setTimeout(() => target.classList.remove('urbs-section-pulse'), 1150);
    };

    anchorLinks.forEach((link) => {
      link.addEventListener('click', (event) => {
        const href = link.getAttribute('href');
        if (!href || !href.startsWith('#')) return;
        const target = document.querySelector(href);
        if (!target) return;

        event.preventDefault();
        const fromCurtain = Boolean(link.closest('#urbs-curtain'));
        if (fromCurtain) closeCurtain({ restoreFocus: false });

        const scrollNow = () => {
          target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
          pulseSection(target);
        };

        if (fromCurtain && !reduced) {
          window.setTimeout(scrollNow, 220);
        } else {
          scrollNow();
        }
      });
    });

    // Teclado: ESC fecha + Focus Trap dentro da cortina
    document.addEventListener('keydown', (event) => {
      if (!isOpen) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        closeCurtain();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = [...curtain.querySelectorAll('a[href], button:not([disabled])')].filter(
        (el) => el.getClientRects().length
      );
      if (!focusable.length) return;
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
  }

  // 2. Barra de progresso + Scroll-Spy ao vivo (Navbar, Cortina e Pílula Flutuante)
  initScrollSpy();
  function initScrollSpy() {
    const bar = document.querySelector('.progress span');
    const pillLabel = document.getElementById('urbs-pill-label');
    const trackedLinks = [...document.querySelectorAll('[data-section]')];

    const sections = [
      { id: 'topo', el: document.getElementById('topo'), label: '00 · INÍCIO' },
      { id: 'manifesto', el: document.getElementById('manifesto'), label: '01 · MANIFESTO' },
      { id: 'experiencia', el: document.getElementById('experiencia'), label: '02 · TRANSFORMAÇÕES' },
      { id: 'categorias', el: document.getElementById('categorias'), label: '03 · CATEGORIAS' },
      { id: 'territorio', el: document.getElementById('territorio'), label: '04 · TERRITÓRIO' },
      { id: 'funcionamento', el: document.getElementById('funcionamento'), label: '05 · FLUXO' },
      { id: 'participar', el: document.querySelector('.final-cta'), label: '06 · PARTICIPE' },
    ].filter((item) => item.el);

    let currentId = '';
    let labelSwapTimer = 0;
    let scheduled = false;

    const setActiveSection = (sectionObj) => {
      if (!sectionObj || sectionObj.id === currentId) return;
      currentId = sectionObj.id;

      trackedLinks.forEach((link) => {
        link.classList.toggle('is-active', link.dataset.section === currentId);
      });

      if (pillLabel && pillLabel.textContent !== sectionObj.label) {
        clearTimeout(labelSwapTimer);
        pillLabel.classList.add('is-changing');
        labelSwapTimer = window.setTimeout(() => {
          pillLabel.textContent = sectionObj.label;
          pillLabel.classList.remove('is-changing');
        }, reduced ? 0 : 150);
      }
    };

    const update = () => {
      scheduled = false;
      const max = document.documentElement.scrollHeight - innerHeight;
      if (bar) bar.style.transform = `scaleX(${Math.max(0, Math.min(1, max ? scrollY / max : 0))})`;

      // Linha de leitura em 36% da viewport identifica qual seção domina a tela
      const pivot = innerHeight * 0.36;
      let active = sections[0];
      for (const sec of sections) {
        if (sec.el.getBoundingClientRect().top <= pivot) {
          active = sec;
        }
      }
      setActiveSection(active);
    };

    const onScroll = () => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(update);
    };

    addEventListener('scroll', onScroll, { passive: true });
    addEventListener('resize', onScroll, { passive: true });
    update();
  }

  // 3. Carrossel Infinito Full-Bleed (#story-viewport) com inércia e inclinação física (skew)
  initStoryCarousel();
  function initStoryCarousel() {
    const section = document.getElementById('categorias');
    const viewport = document.getElementById('story-viewport');
    const track = viewport?.querySelector('.story-track');
    const togglePlayBtn = document.getElementById('story-toggle-play');
    if (!viewport || !track) return;

    const originals = [...track.querySelectorAll('.story-card')];
    if (originals.length < 2) return;

    for (let copy = 0; copy < 2; copy++) {
      originals.forEach((card) => {
        const clone = card.cloneNode(true);
        clone.setAttribute('aria-hidden', 'true');
        clone.setAttribute('tabindex', '-1');
        track.appendChild(clone);
      });
    }

    const SPEED = 44;
    let period = 0;
    let offset = 0;
    let previous = 0;
    let frameId = 0;
    let visible = true;
    let manualPaused = false;
    let dragging = false;
    let touching = false;
    let pointerStartX = 0;
    let pointerStartOffset = 0;
    let lastClientX = 0;
    let inertia = 0;
    let currentSkew = 0;
    let moved = false;
    let pauseUntil = 0;

    const keepCentered = (val) => {
      if (!period) return 0;
      let v = val;
      while (v < period) v += period;
      while (v >= period * 2) v -= period;
      return v;
    };

    const measure = () => {
      const first = originals[0];
      const firstDuplicate = track.children[originals.length];
      period = firstDuplicate.offsetLeft - first.offsetLeft;
      if (period > 0) {
        offset = keepCentered(offset || period);
        viewport.scrollLeft = offset;
      }
    };

    const tick = (now) => {
      const dt = previous ? Math.min((now - previous) / 1000, 0.05) : 0;
      previous = now;

      let targetSkew = 0;

      if (period > 0 && visible && !document.hidden) {
        if (dragging) {
          targetSkew = Math.max(-3.6, Math.min(3.6, inertia * -0.14));
        } else if (Math.abs(inertia) > 0.25) {
          offset = keepCentered(offset - inertia);
          viewport.scrollLeft = offset;
          targetSkew = Math.max(-3.2, Math.min(3.2, inertia * -0.11));
          inertia *= 0.92;
        } else {
          inertia = 0;
          const isPaused =
            reduced ||
            manualPaused ||
            touching ||
            now < pauseUntil ||
            viewport.matches(':hover') ||
            viewport.matches(':focus-within');

          if (!isPaused) {
            offset = keepCentered(offset + SPEED * dt);
            viewport.scrollLeft = offset;
          }
        }
      }

      if (!reduced) {
        currentSkew += (targetSkew - currentSkew) * 0.16;
        if (Math.abs(currentSkew) < 0.01) currentSkew = 0;
        viewport.style.setProperty('--drag-skew', `${currentSkew.toFixed(2)}deg`);
      }

      frameId = requestAnimationFrame(tick);
    };

    viewport.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      dragging = true;
      moved = false;
      inertia = 0;
      pointerStartX = e.clientX;
      lastClientX = e.clientX;
      pointerStartOffset = viewport.scrollLeft;
      offset = pointerStartOffset;
      viewport.classList.add('dragging');
    });

    viewport.addEventListener('pointermove', (e) => {
      if (!dragging || !period) return;
      const dx = e.clientX - pointerStartX;
      const stepDelta = e.clientX - lastClientX;
      lastClientX = e.clientX;
      inertia = stepDelta;
      if (Math.abs(dx) > 5) moved = true;
      if (moved) {
        offset = keepCentered(pointerStartOffset - dx);
        viewport.scrollLeft = offset;
      }
    });

    const endDrag = () => {
      if (!dragging) return;
      dragging = false;
      viewport.classList.remove('dragging');
      pauseUntil = performance.now() + 900;
      previous = 0;
    };
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);

    viewport.addEventListener('touchstart', () => {
      touching = true;
      inertia = 0;
      pauseUntil = performance.now() + 2600;
    }, { passive: true });

    viewport.addEventListener('touchend', () => {
      touching = false;
      offset = keepCentered(viewport.scrollLeft);
      viewport.scrollLeft = offset;
      pauseUntil = performance.now() + 2200;
      previous = 0;
    }, { passive: true });

    viewport.addEventListener('scroll', () => {
      if ((touching || performance.now() < pauseUntil) && period > 0) {
        const s = viewport.scrollLeft;
        if (s < period * 0.35 || s > period * 2.4) {
          offset = keepCentered(s);
          viewport.scrollLeft = offset;
        } else {
          offset = s;
        }
      }
    }, { passive: true });

    viewport.addEventListener('click', (e) => {
      if (moved) {
        e.preventDefault();
        e.stopPropagation();
        moved = false;
      }
    }, true);

    togglePlayBtn?.addEventListener('click', () => {
      manualPaused = !manualPaused;
      togglePlayBtn.setAttribute('aria-pressed', String(manualPaused));
      togglePlayBtn.textContent = manualPaused ? 'RETOMAR' : 'PAUSAR';
      togglePlayBtn.setAttribute('aria-label', manualPaused ? 'Retomar movimento automático' : 'Pausar movimento automático');
      section?.classList.toggle('is-paused', manualPaused);
      previous = 0;
    });

    const stepCard = (direction) => {
      if (!period) return;
      const step = originals[0].offsetWidth + 20;
      const target = keepCentered(viewport.scrollLeft + direction * step);
      offset = target;
      viewport.scrollTo({ left: target, behavior: reduced ? 'auto' : 'smooth' });
      pauseUntil = performance.now() + 2400;
    };

    document.getElementById('story-prev')?.addEventListener('click', () => stepCard(-1));
    document.getElementById('story-next')?.addEventListener('click', () => stepCard(1));

    viewport.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        stepCard(e.key === 'ArrowRight' ? 1 : -1);
      }
    });

    const observer = 'IntersectionObserver' in window
      ? new IntersectionObserver((entries) => {
        visible = entries[0].isIntersecting;
        previous = 0;
      }, { threshold: 0.01 })
      : null;
    observer?.observe(viewport);

    const resizer = 'ResizeObserver' in window ? new ResizeObserver(measure) : null;
    resizer?.observe(viewport);
    resizer?.observe(track);
    addEventListener('resize', measure, { passive: true });

    measure();
    frameId = requestAnimationFrame(tick);

    addEventListener('pagehide', () => {
      cancelAnimationFrame(frameId);
      observer?.disconnect();
      resizer?.disconnect();
    }, { once: true });
  }

  // 4. Zoom sutil na foto de Impacto conforme a rolagem
  if (!reduced) {
    const impact = document.querySelector('.impact');
    if (impact) {
      let queued = false;
      const update = () => {
        queued = false;
        const r = impact.getBoundingClientRect();
        const progress = Math.max(0, Math.min(1, (innerHeight - r.top) / (innerHeight + r.height)));
        impact.style.setProperty('--impact-zoom', (1.12 - progress * 0.12).toFixed(3));
      };
      const request = () => {
        if (!queued) {
          queued = true;
          requestAnimationFrame(update);
        }
      };
      addEventListener('scroll', request, { passive: true });
      addEventListener('resize', request, { passive: true });
      request();
    }
  }

  // 5. Entrada do Hero
  if (window.gsap && !reduced) {
    try {
      if (!document.documentElement.classList.contains('urbs-arrival')) {
        gsap.fromTo('.hero-content', { y: 20 }, { y: 0, duration: 1.2, ease: 'power3.out' });
      }
      gsap.to('.hero-photo', { scale: 1.15, duration: 18, repeat: -1, yoyo: true, ease: 'sine.inOut' });
    } catch (e) {
      console.warn('URBS: animação de abertura indisponível', e);
    }
  }

  // 6. Tipografia cinética nos títulos + dica visual sutil no scroll (desktop com mouse)
  if (!reduced && matchMedia('(hover: hover) and (pointer: fine)').matches) {
    const hopLetter = (letter, delay = 0, intensity = 1) => {
      if (window.gsap) {
        gsap.killTweensOf(letter);
        gsap.fromTo(
          letter,
          { y: 0, rotate: 0, scale: 1 },
          {
            y: -13 * intensity,
            rotate: (Math.random() - 0.5) * 11 * intensity,
            scale: 1 + 0.06 * intensity,
            duration: 0.22,
            delay,
            ease: 'power2.out',
            onComplete: () =>
              gsap.to(letter, {
                y: 0,
                rotate: 0,
                scale: 1,
                duration: 0.62,
                ease: 'bounce.out',
                clearProps: 'transform',
              }),
          }
        );
      } else {
        window.setTimeout(() => {
          letter.classList.remove('jump-active');
          void letter.offsetWidth;
          letter.classList.add('jump-active');
        }, delay * 1000);
      }
    };

    const headings = [...document.querySelectorAll('main h1, main h2')];

    headings.forEach((heading) => {
      const label = heading.innerText.replace(/\s+/g, ' ').trim();
      if (!label) return;
      heading.setAttribute('aria-label', label);
      heading.classList.add('title-jump');

      const walker = document.createTreeWalker(heading, NodeFilter.SHOW_TEXT);
      const nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);

      nodes.forEach((node) => {
        const frag = document.createDocumentFragment();
        const tokens = node.textContent.match(/\s+|\S+/g) || [];
        tokens.forEach((token) => {
          if (/^\s+$/.test(token)) {
            frag.appendChild(document.createTextNode(token));
            return;
          }
          const word = document.createElement('span');
          word.className = 'jump-word';
          word.setAttribute('aria-hidden', 'true');
          for (const ch of token) {
            const letter = document.createElement('span');
            letter.className = 'jump-letter';
            letter.textContent = ch;
            word.appendChild(letter);
          }
          frag.appendChild(word);
        });
        node.replaceWith(frag);
      });

      heading.addEventListener('pointerover', (event) => {
        const letter = event.target.closest('.jump-letter');
        if (!letter || !heading.contains(letter) || letter === event.relatedTarget) return;
        hopLetter(letter, 0, 1);
      });
    });

    if ('IntersectionObserver' in window) {
      const teaseObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            const heading = entry.target;
            teaseObserver.unobserve(heading);

            const letters = [...heading.querySelectorAll('.jump-letter')].filter((el) =>
              /[A-Za-zÀ-ÿ0-9]/.test(el.textContent)
            );
            if (letters.length < 3) return;

            const picksCount = letters.length > 14 ? 4 : 3;
            const step = Math.max(2, Math.floor(letters.length / (picksCount + 1)));
            const chosen = [];
            for (let i = 1; i <= picksCount; i++) {
              const idx = Math.min(letters.length - 1, i * step + (i % 2));
              if (!chosen.includes(letters[idx])) chosen.push(letters[idx]);
            }

            chosen.forEach((letter, idx) => {
              const baseDelay = heading.id === 'hero-title' ? 0.95 : 0.22;
              hopLetter(letter, baseDelay + idx * 0.13, 0.85);
            });
          });
        },
        { threshold: 0.45 }
      );

      headings.forEach((h) => teaseObserver.observe(h));
    }
  }

  // 7. Pacote C — Rótulo contextual flutuante no cursor (somente desktop com mouse)
  initContextualCursor();
  function initContextualCursor() {
    if (reduced || !matchMedia('(hover: hover) and (pointer: fine)').matches) return;

    const pill = document.createElement('div');
    pill.id = 'urbs-cursor-pill';
    pill.className = 'urbs-cursor-pill';
    pill.setAttribute('aria-hidden', 'true');
    pill.innerHTML = '<span class="urbs-cursor-dot"></span><span class="urbs-cursor-text"></span>';
    document.body.appendChild(pill);

    const textEl = pill.querySelector('.urbs-cursor-text');

    let targetX = -200;
    let targetY = -200;
    let curX = -200;
    let curY = -200;
    let lastClientX = -200;
    let lastClientY = -200;
    let visible = false;
    let pressing = false;
    let rafId = 0;
    let scrollQueued = false;

    const resolveContext = (el) => {
      if (!el || !(el instanceof Element)) return null;

      // Não compete com a cortina do menu ou modal de história abertos
      if (
        document.documentElement.classList.contains('urbs-curtain-open') ||
        document.documentElement.classList.contains('urbs-modal-open')
      ) {
        return null;
      }

      if (el.closest('#urb-ba-viewer')) {
        return { label: 'COMPARAR ‹ ›', accent: pressing };
      }

      const storyVp = el.closest('#story-viewport');
      if (storyVp) {
        if (storyVp.classList.contains('dragging')) return { label: 'ARRASTANDO', accent: true };
        if (el.closest('.story-card')) return { label: 'REGISTRAR ↗', accent: false };
        return { label: 'ARRASTAR ‹ ›', accent: false };
      }

      const splitPanel = el.closest('.split-panel');
      if (splitPanel) {
        if (el.closest('.split-panel__action, .split-panel__story-button')) return null;
        return splitPanel.classList.contains('is-active')
          ? { label: 'LER DOSSIÊ ↗', accent: false }
          : { label: 'EXPANDIR +', accent: false };
      }

      const journeyReel = el.closest('#journey-reel');
      if (journeyReel) {
        if (journeyReel.classList.contains('is-dragging')) return { label: 'ARRASTANDO', accent: true };
        if (el.closest('.journey-reel-card')) return { label: 'EXPLORAR ↗', accent: false };
        return { label: 'ARRASTAR ‹ ›', accent: false };
      }

      if (el.closest('.ticker')) {
        return { label: 'PAUSADO', accent: false };
      }

      return null;
    };

    const computePosition = (clientX, clientY) => {
      const w = pill.offsetWidth || 126;
      const h = pill.offsetHeight || 28;
      let x = clientX + 18;
      let y = clientY + 18;
      if (x + w + 14 > window.innerWidth) x = clientX - w - 16;
      if (y + h + 14 > window.innerHeight) y = clientY - h - 16;
      return { x: Math.max(8, x), y: Math.max(8, y) };
    };

    const animate = () => {
      curX += (targetX - curX) * 0.24;
      curY += (targetY - curY) * 0.24;
      pill.style.transform = `translate3d(${curX.toFixed(1)}px, ${curY.toFixed(1)}px, 0)`;

      const settled = Math.hypot(targetX - curX, targetY - curY) < 0.35;
      if (!visible && settled) {
        rafId = 0;
        return;
      }
      rafId = requestAnimationFrame(animate);
    };

    const startLoop = () => {
      if (!rafId) rafId = requestAnimationFrame(animate);
    };

    const applyContext = (ctx) => {
      if (!ctx) {
        if (visible) {
          visible = false;
          pill.classList.remove('is-visible', 'is-accent');
        }
        return;
      }

      if (textEl.textContent !== ctx.label) textEl.textContent = ctx.label;
      pill.classList.toggle('is-accent', Boolean(ctx.accent));

      const pos = computePosition(lastClientX, lastClientY);
      if (!visible) {
        curX = pos.x;
        curY = pos.y;
        visible = true;
        pill.classList.add('is-visible');
      }
      targetX = pos.x;
      targetY = pos.y;
      startLoop();
    };

    window.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      lastClientX = e.clientX;
      lastClientY = e.clientY;
      applyContext(resolveContext(e.target));
    }, { passive: true });

    window.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse') return;
      pressing = true;
      applyContext(resolveContext(e.target));
    }, { passive: true });

    window.addEventListener('pointerup', (e) => {
      pressing = false;
      if (e.pointerType === 'mouse') applyContext(resolveContext(e.target));
    }, { passive: true });

    // Reavalia o elemento sob o cursor caso a página role com o mouse parado
    window.addEventListener('scroll', () => {
      if (!visible || scrollQueued) return;
      scrollQueued = true;
      requestAnimationFrame(() => {
        scrollQueued = false;
        const under = document.elementFromPoint(lastClientX, lastClientY);
        applyContext(resolveContext(under));
      });
    }, { passive: true });

    const hideAll = () => {
      pressing = false;
      applyContext(null);
    };
    document.documentElement.addEventListener('mouseleave', hideAll);
    window.addEventListener('blur', hideAll);
  }

  // 8. Pacote C — Botões magnéticos com física suave (usa CSS `translate` sem conflitar com `:hover`)
  initMagneticButtons();
  function initMagneticButtons() {
    if (reduced || !matchMedia('(hover: hover) and (pointer: fine)').matches) return;

    const groups = [
      { selector: '.round-link', strength: 0.28, max: 11 },
      { selector: '.nav-cta', strength: 0.18, max: 7 },
      { selector: '.story-nav-buttons button, .journey-nav-buttons button', strength: 0.26, max: 8 },
      { selector: '.cta-btn-primary, .cta-btn-secondary, .journey-gallery-cta', strength: 0.14, max: 7 },
    ];

    groups.forEach(({ selector, strength, max }) => {
      document.querySelectorAll(selector).forEach((el) => {
        let tx = 0;
        let ty = 0;
        let cx = 0;
        let cy = 0;
        let active = false;
        let rafId = 0;

        const clamp = (val) => Math.max(-max, Math.min(max, val));

        const step = () => {
          const ease = active ? 0.22 : 0.14;
          cx += (tx - cx) * ease;
          cy += (ty - cy) * ease;
          el.style.translate = `${cx.toFixed(2)}px ${cy.toFixed(2)}px`;

          if (!active && Math.hypot(cx, cy) < 0.08) {
            el.style.translate = '';
            rafId = 0;
            return;
          }
          rafId = requestAnimationFrame(step);
        };

        const run = () => {
          if (!rafId) rafId = requestAnimationFrame(step);
        };

        el.addEventListener('pointerenter', (e) => {
          if (e.pointerType !== 'mouse') return;
          active = true;
          run();
        });

        el.addEventListener('pointermove', (e) => {
          if (e.pointerType !== 'mouse') return;
          const r = el.getBoundingClientRect();
          tx = clamp((e.clientX - (r.left + r.width / 2)) * strength);
          ty = clamp((e.clientY - (r.top + r.height / 2)) * strength);
          run();
        }, { passive: true });

        el.addEventListener('pointerleave', () => {
          active = false;
          tx = 0;
          ty = 0;
          run();
        });
      });
    });
  }

  // 9. Pacote C — Coreografia editorial de linhas e blocos no scroll
  initScrollChoreography();
  function initScrollChoreography() {
    if (reduced || !('IntersectionObserver' in window)) return;

    document.documentElement.classList.add('urbs-anim-ready');

    // Linhas horizontais que se desenham da esquerda para a direita
    const lines = [
      ...document.querySelectorAll(
        '.section-header .line, .urb-comparison__rule-line, .urban-split__line, .journey-rule-line, .cta-rule-line'
      ),
    ];

    // Grupos de elementos com entrada escalonada (stagger)
    const revealTargets = [];
    const registerStagger = (selector, stepMs) => {
      document.querySelectorAll(selector).forEach((el, idx) => {
        el.setAttribute('data-urbs-reveal', '');
        el.style.setProperty('--reveal-delay', `${idx * stepMs}ms`);
        revealTargets.push(el);
      });
    };

    registerStagger('.manifesto-right > *', 85);
    registerStagger('.manifesto-pillars article', 110);
    registerStagger('.impact-text p', 0);
    registerStagger('.fineprint-right p', 95);
    registerStagger('.fineprint-specs span', 75);
    registerStagger('.footer-grid > div', 90);

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting || entry.boundingClientRect.top < 0) {
            entry.target.classList.add('is-revealed');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
    );

    lines.forEach((line) => observer.observe(line));
    revealTargets.forEach((el) => observer.observe(el));
  }
  
})();