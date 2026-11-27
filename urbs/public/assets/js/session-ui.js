/* URBS — Sessão, controle de acesso, direcionamento inteligente (?next=) e Handoff Transparente do Satélite */
(() => {
  'use strict';

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const TRANSITION_KEY = 'urbs:page_transition';
  const SAT_HANDOFF_KEY = 'urbs:sat_handoff';
  const INTERNAL_PAGES = /^(index|mapa|registro|login|painel)\.html(?:[?#].*)?$/i;
  const PROTECTED_PAGES = /^(mapa|registro|painel)\.html(?:[?#].*)?$/i;

  // ================= PONTE ÓPTICA TRANSPARENTE (SATÉLITE -> PÁGINA REAL ATRÁS) =================
  let activeSatHandoff = null;

  function ensureTransitionStyles() {
    if (document.getElementById('urbs-veil-styles')) return;
    const style = document.createElement('style');
    style.id = 'urbs-veil-styles';
    style.textContent = `
      @view-transition {
        navigation: auto;
      }
      ::view-transition-old(root),
      ::view-transition-new(root) {
        animation-duration: 0.22s;
      }

      /* Cortina padrão (urbs. + barrinha verde) usada na navegação comum entre telas */
      #urbs-page-veil {
        position: fixed;
        inset: 0;
        z-index: 99999;
        display: grid;
        place-items: center;
        background: radial-gradient(circle at 50% 45%, #0c2217 0%, #030a07 72%);
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.34s cubic-bezier(0.22, 1, 0.36, 1);
      }
      #urbs-page-veil.is-visible {
        opacity: 1;
        pointer-events: auto;
      }
      #urbs-page-veil .urbs-veil-mark {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 14px;
        transform: translateY(6px);
        transition: transform 0.34s cubic-bezier(0.22, 1, 0.36, 1);
      }
      #urbs-page-veil.is-visible .urbs-veil-mark {
        transform: translateY(0);
      }
      #urbs-page-veil strong {
        font: 700 32px/1 'Space Grotesk', system-ui, sans-serif;
        letter-spacing: -0.08em;
        color: #f4f8f0;
      }
      #urbs-page-veil strong span {
        color: #c7f36b;
      }
      #urbs-page-veil i {
        display: block;
        width: 56px;
        height: 2px;
        border-radius: 99px;
        background: linear-gradient(90deg, transparent, #c7f36b, transparent);
      }

      /* Handoff transparente do satélite: dissolve a opacidade revelando o Mapa / Registro atrás */
      #urbs-sat-handoff {
        position: fixed;
        inset: 0;
        z-index: 99998;
        overflow: hidden;
        background: #040d09;
        opacity: 1;
        pointer-events: auto;
        transition:
          opacity 1.18s cubic-bezier(0.22, 1, 0.36, 1),
          filter 1.18s cubic-bezier(0.22, 1, 0.36, 1);
        will-change: opacity, filter;
      }
      #urbs-sat-handoff.is-revealing {
        opacity: 0;
        filter: blur(2px) brightness(1.06);
        pointer-events: none;
      }
      #urbs-sat-handoff .urbs-sat-layer {
        position: absolute;
        inset: 0;
        transform-origin: center center;
        filter: contrast(1.06) saturate(0.96) brightness(0.90);
        transition: transform 1.25s cubic-bezier(0.16, 1, 0.3, 1);
        will-change: transform;
        background-image:
          linear-gradient(rgba(199, 243, 107, 0.08) 1px, transparent 1px),
          linear-gradient(90deg, rgba(199, 243, 107, 0.08) 1px, transparent 1px);
        background-size: 64px 64px;
      }
      #urbs-sat-handoff .urbs-sat-grid {
        position: absolute;
        pointer-events: none;
        user-select: none;
      }
      #urbs-sat-handoff .urbs-sat-grid img {
        position: absolute;
        width: 256px;
        height: 256px;
        display: block;
        object-fit: cover;
        transform: scale(1.004);
      }
      #urbs-sat-handoff .urbs-sat-vignette {
        position: absolute;
        inset: 0;
        z-index: 2;
        pointer-events: none;
        background:
          radial-gradient(circle at 50% 50%, transparent 32%, rgba(2, 8, 5, 0.58) 76%, rgba(2, 6, 4, 0.92) 100%),
          linear-gradient(180deg, rgba(2, 7, 5, 0.45) 0%, transparent 18%, transparent 72%, rgba(2, 7, 5, 0.82) 100%);
      }
    `;
    document.head.appendChild(style);
  }

  function latLonToTileFloat(lat, lon, z) {
    const n = Math.pow(2, z);
    const x = ((lon + 180) / 360) * n;
    const rad = (lat * Math.PI) / 180;
    const y = ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n;
    return { x, y };
  }

  // Monta o frame exato das ruas de Montes Claros (em cache) imediatamente antes do primeiro fade
  function mountSatelliteHandoffIfPending() {
    if (reduced || !document.body) return null;

    let raw = null;
    try {
      raw = sessionStorage.getItem(SAT_HANDOFF_KEY);
      sessionStorage.removeItem(SAT_HANDOFF_KEY);
    } catch (_) {}

    if (!raw) return null;

    let data = null;
    try {
      data = JSON.parse(raw);
    } catch (_) {
      return null;
    }

    if (!data || !data.ts || Date.now() - Number(data.ts) > 10000) return null;

    ensureTransitionStyles();

    const lat = Number(data.lat ?? -16.7248);
    const lon = Number(data.lon ?? -43.8631);
    const z = Number(data.z ?? 16);
    const fallbackScale = Math.max(window.innerWidth / 860, window.innerHeight / 860, 1.05) * 1.92;
    const scale = Number(data.scale || fallbackScale);

    const wrap = document.createElement('div');
    wrap.id = 'urbs-sat-handoff';
    wrap.setAttribute('aria-hidden', 'true');

    const layer = document.createElement('div');
    layer.className = 'urbs-sat-layer';
    layer.style.transform = `scale(${scale})`;

    const { x: xf, y: yf } = latLonToTileFloat(lat, lon, z);
    const cx = Math.floor(xf);
    const cy = Math.floor(yf);
    const fx = xf - cx;
    const fy = yf - cy;

    const half = 2;
    const tileSize = 256;
    const gridPx = (half * 2 + 1) * tileSize;
    const centerPxX = (half + fx) * tileSize;
    const centerPxY = (half + fy) * tileSize;

    const grid = document.createElement('div');
    grid.className = 'urbs-sat-grid';
    grid.style.width = `${gridPx}px`;
    grid.style.height = `${gridPx}px`;
    grid.style.left = `calc(50% - ${centerPxX.toFixed(2)}px)`;
    grid.style.top = `calc(50% - ${centerPxY.toFixed(2)}px)`;

    for (let dy = -half; dy <= half; dy++) {
      for (let dx = -half; dx <= half; dx++) {
        const img = document.createElement('img');
        img.alt = '';
        img.decoding = 'sync';
        img.loading = 'eager';
        img.style.left = `${(dx + half) * tileSize}px`;
        img.style.top = `${(dy + half) * tileSize}px`;
        img.src = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${cy + dy}/${cx + dx}`;
        img.onerror = () => { img.style.opacity = '0'; };
        grid.appendChild(img);
      }
    }

    const vignette = document.createElement('div');
    vignette.className = 'urbs-sat-vignette';

    layer.appendChild(grid);
    wrap.append(layer, vignette);
    document.body.appendChild(wrap);

    let revealed = false;
    const reveal = () => {
      if (revealed) return;
      revealed = true;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          layer.style.transform = `scale(${(scale * 1.08).toFixed(4)})`;
          wrap.classList.add('is-revealing');
          window.setTimeout(() => wrap.remove(), 1280);
        });
      });
    };

    // Segurança: garante que a camada sempre revele mesmo se algum recurso externo demorar
    const fallbackTimer = window.setTimeout(reveal, 1650);

    return {
      revealNow(delayMs = 360) {
        window.clearTimeout(fallbackTimer);
        window.setTimeout(reveal, delayMs);
      },
      destroy() {
        window.clearTimeout(fallbackTimer);
        wrap.remove();
      }
    };
  }

  // Executa IMEDIATAMENTE (antes do DOMContentLoaded) para segurar o frame sem flash
  ensureTransitionStyles();
  activeSatHandoff = mountSatelliteHandoffIfPending();

  // ================= CORTINA PADRÃO DE TRANSIÇÃO ENTRE PÁGINAS =================
  function getPageVeil() {
    ensureTransitionStyles();
    let veil = document.getElementById('urbs-page-veil');
    if (!veil) {
      veil = document.createElement('div');
      veil.id = 'urbs-page-veil';
      veil.setAttribute('aria-hidden', 'true');
      veil.innerHTML = '<div class="urbs-veil-mark"><strong>urbs<span>.</span></strong><i></i></div>';
      document.body.appendChild(veil);
    }
    return veil;
  }

  function playArrivalFade() {
    if (reduced || activeSatHandoff) return;
    let ts = 0;
    try {
      ts = Number(sessionStorage.getItem(TRANSITION_KEY) || 0);
      sessionStorage.removeItem(TRANSITION_KEY);
    } catch (_) {}

    if (!ts || Date.now() - ts > 8000) return;

    const veil = getPageVeil();
    veil.style.transition = 'none';
    veil.classList.add('is-visible');
    void veil.offsetWidth;
    veil.style.transition = '';

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        veil.classList.remove('is-visible');
      });
    });
  }

  function navigateSmoothly(url, { replace = false } = {}) {
    if (reduced) {
      if (replace) window.location.replace(url);
      else window.location.assign(url);
      return;
    }

    try {
      sessionStorage.setItem(TRANSITION_KEY, String(Date.now()));
    } catch (_) {}

    const veil = getPageVeil();
    requestAnimationFrame(() => {
      veil.classList.add('is-visible');
    });

    window.setTimeout(() => {
      if (replace) window.location.replace(url);
      else window.location.assign(url);
    }, 320);
  }

  window.addEventListener('pageshow', (event) => {
    const veil = document.getElementById('urbs-page-veil');
    if (veil && (event.persisted || veil.classList.contains('is-visible'))) {
      veil.classList.remove('is-visible');
    }
    if (event.persisted) {
      document.getElementById('urbs-sat-handoff')?.remove();
    }
  });

  // ================= NORMALIZAÇÃO E PRÉ-SELEÇÃO DE CATEGORIA =================
  function normalizeText(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();
  }

  function preselectCategoryFromUrl() {
    const requested = new URLSearchParams(window.location.search).get('categoria');
    if (!requested) return;

    const targetNorm = normalizeText(requested);
    const select =
      document.querySelector('select[name="category_id"], select[name="category"], select#category, select#categoria') ||
      null;
    if (!select) return;

    const tryApply = () => {
      const options = [...select.options];
      const match = options.find((opt) => {
        const val = normalizeText(opt.value);
        const text = normalizeText(opt.textContent);
        return (
          val === targetNorm ||
          text === targetNorm ||
          (targetNorm.length >= 4 && (text.includes(targetNorm) || targetNorm.includes(text)))
        );
      });

      if (!match) return false;
      if (select.value !== match.value) {
        select.value = match.value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
      return true;
    };

    if (tryApply()) return;

    const observer = new MutationObserver(() => {
      if (tryApply()) observer.disconnect();
    });
    observer.observe(select, { childList: true, subtree: true });
    window.setTimeout(() => observer.disconnect(), 6000);
  }

  // ================= FLUXO PRINCIPAL =================
  document.addEventListener('DOMContentLoaded', async () => {
    playArrivalFade();

    const path = window.location.pathname.toLowerCase();
    const currentFile = (window.location.pathname.split('/').pop() || 'index.html').toLowerCase();
    const isMapPage = path.endsWith('/mapa.html') || path.endsWith('mapa.html');
    const isRegisterPage = path.endsWith('/registro.html') || path.endsWith('registro.html');
    const isPanelPage = path.endsWith('/painel.html') || path.endsWith('painel.html');
    const isHomePage = !isMapPage && !isRegisterPage && !isPanelPage && !path.endsWith('login.html');
    const isProtectedPage = isMapPage || isRegisterPage || isPanelPage;

    const ROLE_LABELS = {
      citizen: 'Cidadão',
      resolver: 'Solucionador',
      master: 'Admin Master',
    };

    if (isRegisterPage) {
      preselectCategoryFromUrl();
    }

    if (isHomePage) {
      const logo = document.querySelector('.header .logo');
      const updateFloatingLogo = () => {
        document.documentElement.classList.toggle('urbs-logo-floating', window.scrollY > 110);
      };
      window.addEventListener('scroll', updateFloatingLogo, { passive: true });
      updateFloatingLogo();

      logo?.addEventListener('click', (event) => {
        if (window.scrollY > 20) {
          event.preventDefault();
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      });
    }

    function rememberAccount(user) {
      if (!user || !user.id) return;
      try {
        const key = 'urbs:saved_accounts';
        const list = JSON.parse(localStorage.getItem(key) || '[]');
        const entry = {
          id: Number(user.id),
          name: user.name || 'Usuário',
          email: user.email || '',
          role: user.role || 'citizen',
          company_name: user.company_name || null,
        };
        const idx = list.findIndex(
          (item) => item.id === entry.id || (entry.email && item.email === entry.email)
        );
        if (idx >= 0) list[idx] = entry;
        else list.unshift(entry);
        localStorage.setItem(key, JSON.stringify(list.slice(0, 6)));
      } catch (_) {}
    }

    let session = { authenticated: false, user: null };
    if (window.UrbsAPI) {
      try {
        session = await window.UrbsAPI.session();
      } catch (error) {
        console.warn('Não foi possível consultar a sessão do URBS.', error.message);
      }
    }

    const isLoggedIn = Boolean(session.authenticated && session.user);

    if (isProtectedPage && !isLoggedIn) {
      activeSatHandoff?.destroy();
      const intended = `${currentFile}${window.location.search}${window.location.hash}`;
      window.location.replace(`login.html?acesso=restrito&next=${encodeURIComponent(intended)}`);
      return;
    }

    // Dissolve a camada do satélite revelando o mapa ou registro já montado atrás dela
    if (activeSatHandoff) {
      const triggerReveal = () => activeSatHandoff.revealNow(isMapPage ? 420 : 280);
      if (document.readyState === 'complete') {
        triggerReveal();
      } else {
        window.addEventListener('load', triggerReveal, { once: true });
      }
    }

    // Interceptação delegada para 100% dos links e cards internos
    document.addEventListener('click', (event) => {
      if (event.defaultPrevented) return;
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const link = event.target.closest('a[href]');
      if (!link) return;
      if (link.target && link.target !== '_self') return;
      if (link.hasAttribute('download')) return;

      const rawHref = (link.getAttribute('href') || '').trim();
      if (!rawHref || rawHref.startsWith('#') || rawHref.startsWith('mailto:') || rawHref.startsWith('tel:')) return;
      if (!INTERNAL_PAGES.test(rawHref)) return;

      event.preventDefault();

      if (!isLoggedIn && PROTECTED_PAGES.test(rawHref)) {
        const loginTarget = `login.html?acesso=restrito&next=${encodeURIComponent(rawHref)}`;
        navigateSmoothly(loginTarget);
        return;
      }

      navigateSmoothly(rawHref);
    });

    const header = document.querySelector('.app-header, .header');
    const nav = header?.querySelector('nav');
    if (!header || !nav || !isLoggedIn) return;

    const user = session.user;
    rememberAccount(user);

    nav.querySelectorAll('a[href="login.html"]').forEach((link) => link.remove());
    if (!isHomePage) {
      nav.querySelectorAll('a[href^="registro.html"]').forEach((link) => link.remove());
    }

    const curtainLoginCard = document.querySelector('.urbs-curtain__card[href="login.html"]');
    if (curtainLoginCard) {
      curtainLoginCard.href = 'login.html?trocar=1';
    }

    const firstName = (user.name || 'Conta').trim().split(/\s+/)[0];
    const initial = firstName.charAt(0).toUpperCase();
    const roleLabel =
      user.role === 'resolver' && user.company_name
        ? user.company_name
        : ROLE_LABELS[user.role] || 'Cidadão';

    const menuWrap = document.createElement('div');
    menuWrap.className = 'urbs-user-menu';
    menuWrap.innerHTML = `
      <button type="button" class="urbs-user-trigger" aria-expanded="false" aria-haspopup="menu">
        <span class="urbs-user-avatar" aria-hidden="true"></span>
        <span class="urbs-user-name"></span>
        <span class="urbs-user-caret" aria-hidden="true">▾</span>
      </button>
      <div class="urbs-user-dropdown" role="menu" hidden>
        <div class="urbs-user-summary">
          <strong></strong>
          <span></span>
        </div>
        <div class="urbs-user-divider"></div>
        <a href="mapa.html" class="urbs-user-item" role="menuitem">Mapa de ocorrências</a>
        <a href="registro.html" class="urbs-user-item" role="menuitem">Nova ocorrência</a>
        <a href="login.html?trocar=1" class="urbs-user-item" role="menuitem">Alterar usuário</a>
        <div class="urbs-user-divider"></div>
        <button type="button" class="urbs-user-item is-danger" data-urbs-logout="1" role="menuitem">Sair da conta</button>
      </div>
    `;

    menuWrap.querySelector('.urbs-user-avatar').textContent = initial;
    menuWrap.querySelector('.urbs-user-name').textContent = firstName;
    menuWrap.querySelector('.urbs-user-summary strong').textContent = user.name || firstName;
    menuWrap.querySelector('.urbs-user-summary span').textContent = roleLabel;
    const trigger = menuWrap.querySelector('.urbs-user-trigger');
    const dropdown = menuWrap.querySelector('.urbs-user-dropdown');
    const logoutBtn = menuWrap.querySelector('[data-urbs-logout]');

    const closeMenu = () => {
      dropdown.hidden = true;
      trigger.setAttribute('aria-expanded', 'false');
      menuWrap.classList.remove('is-open');
    };

    trigger.addEventListener('click', (event) => {
      event.stopPropagation();
      const willOpen = dropdown.hidden;
      dropdown.hidden = !willOpen;
      trigger.setAttribute('aria-expanded', String(willOpen));
      menuWrap.classList.toggle('is-open', willOpen);
    });

    document.addEventListener('click', (event) => {
      if (!menuWrap.contains(event.target)) closeMenu();
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeMenu();
    });

    logoutBtn.addEventListener('click', async () => {
      logoutBtn.disabled = true;
      logoutBtn.textContent = 'Saindo…';
      try {
        await window.UrbsAPI.logout();
        navigateSmoothly('login.html');
      } catch (error) {
        logoutBtn.disabled = false;
        logoutBtn.textContent = 'Sair da conta';
        window.alert(error.message);
      }
    });

    if (isHomePage || header.classList.contains('urbs-platform-header')) {
      const mobileToggle = header.querySelector('.menu-toggle');
      if (mobileToggle) header.insertBefore(menuWrap, mobileToggle);
      else header.append(menuWrap);
    } else {
      nav.append(menuWrap);
    }
  });
})();