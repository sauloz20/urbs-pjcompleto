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
      if (event.shiftKey && (document.activeElement === first || document.activeElement === shell)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });
  }



  // Mesmo limiar de rolagem da home; sem interferir no arraste ou zoom do Leaflet.
  const floatLogo = document.querySelector('.urbs-platform-float-logo');
  const updateFloating = () => {
    document.documentElement.classList.toggle('urbs-logo-floating', window.scrollY > 110);
  };
  window.addEventListener('scroll', updateFloating, { passive: true });
  window.addEventListener('resize', updateFloating, { passive: true });
  window.addEventListener('pageshow', updateFloating);
  updateFloating();
  floatLogo?.addEventListener('click', (event) => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
  });

})();
