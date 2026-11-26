/* URBS — Sessão, controle de acesso, direcionamento inteligente (?next=) e transição suave entre páginas */
(() => {
  'use strict';

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const TRANSITION_KEY = 'urbs:page_transition';
  const INTERNAL_PAGES = /^(index|mapa|registro|login|painel)\.html(?:[?#].*)?$/i;
  const PROTECTED_PAGES = /^(mapa|registro|painel)\.html(?:[?#].*)?$/i;

  // ================= CORTINA DE TRANSIÇÃO ENTRE PÁGINAS =================
  function ensureVeilStyles() {
    if (document.getElementById('urbs-veil-styles')) return;
    const style = document.createElement('style');
    style.id = 'urbs-veil-styles';
    style.textContent = `
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
    `;
    document.head.appendChild(style);
  }

  function getPageVeil() {
    ensureVeilStyles();
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
    if (reduced) return;
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

  // Garante que o botão "Voltar" do navegador (bfcache) nunca trave a cortina na tela
  window.addEventListener('pageshow', (event) => {
    const veil = document.getElementById('urbs-page-veil');
    if (veil && (event.persisted || veil.classList.contains('is-visible'))) {
      veil.classList.remove('is-visible');
    }
  });

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

    // 1. Logo "urbs." fixo e translúcido no scroll do index.html
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

    // 2. Bloqueio de acesso preservando o destino completo (?next=mapa.html?categoria=...)
    if (isProtectedPage && !isLoggedIn) {
      const intended = `${currentFile}${window.location.search}${window.location.hash}`;
      window.location.replace(`login.html?acesso=restrito&next=${encodeURIComponent(intended)}`);
      return;
    }

    // 3. Interceptação delegada para 100% dos links e cards (originais, clones, modal e cortina)
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

      // Visitante deslogado clicando em qualquer card/botão de área protegida -> preserva intenção no ?next=
      if (!isLoggedIn && PROTECTED_PAGES.test(rawHref)) {
        const loginTarget = `login.html?acesso=restrito&next=${encodeURIComponent(rawHref)}`;
        navigateSmoothly(loginTarget);
        return;
      }

      // Navegação interna com transição suave
      navigateSmoothly(rawHref);
    });

    const header = document.querySelector('.app-header, .header');
    const nav = header?.querySelector('nav');
    if (!header || !nav || !isLoggedIn) return;

    // 4. Usuário LOGADO:
    const user = session.user;
    rememberAccount(user);

    nav.querySelectorAll('a[href="login.html"]').forEach((link) => link.remove());
    if (!isHomePage) {
      nav.querySelectorAll('a[href^="registro.html"]').forEach((link) => link.remove());
    }

    // Atualiza o cartão de acesso dentro da cortina full-screen para "Alternar Usuário"
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

    if (isHomePage) {
      const mobileToggle = header.querySelector('.menu-toggle');
      if (mobileToggle) header.insertBefore(menuWrap, mobileToggle);
      else header.append(menuWrap);
    } else {
      nav.append(menuWrap);
    }
  });
})();