document.addEventListener("DOMContentLoaded", async () => {
  const path = window.location.pathname.toLowerCase();
  const isMapPage = path.endsWith("/mapa.html") || path.endsWith("mapa.html");
  const isRegisterPage = path.endsWith("/registro.html") || path.endsWith("registro.html");
  const isHomePage = !isMapPage && !isRegisterPage && !path.endsWith("login.html");
  const isProtectedPage = isMapPage || isRegisterPage;

  const ROLE_LABELS = {
    citizen: "Cidadão",
    resolver: "Solucionador",
    master: "Admin Master",
  };

  // 1. Logo "urbs." fixo e translúcido no scroll do index.html
  if (isHomePage) {
    const logo = document.querySelector(".header .logo");
    const updateFloatingLogo = () => {
      document.documentElement.classList.toggle("urbs-logo-floating", window.scrollY > 110);
    };
    window.addEventListener("scroll", updateFloatingLogo, { passive: true });
    updateFloatingLogo();

    logo?.addEventListener("click", (event) => {
      if (window.scrollY > 20) {
        event.preventDefault();
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });
  }

  if (!window.UrbsAPI) return;

  function rememberAccount(user) {
    if (!user || !user.id) return;
    try {
      const key = "urbs:saved_accounts";
      const list = JSON.parse(localStorage.getItem(key) || "[]");
      const entry = {
        id: Number(user.id),
        name: user.name || "Usuário",
        email: user.email || "",
        role: user.role || "citizen",
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

  function transitionToLogin(url) {
    let veil = document.getElementById("urbs-logout-veil");
    if (!veil) {
      veil = document.createElement("div");
      veil.id = "urbs-logout-veil";
      veil.style.cssText =
        "position:fixed;inset:0;z-index:99999;background:#020509;opacity:0;pointer-events:none;transition:opacity .45s ease;";
      document.body.append(veil);
    }
    requestAnimationFrame(() => {
      veil.style.opacity = "1";
    });
    window.setTimeout(() => window.location.assign(url), 440);
  }

  let session = { authenticated: false, user: null };
  try {
    session = await window.UrbsAPI.session();
  } catch (error) {
    console.warn("Não foi possível consultar a sessão do URBS.", error.message);
  }

  // 2. Bloqueio de acesso: só usuários cadastrados/logados entram no mapa e registro
  if (isProtectedPage && (!session.authenticated || !session.user)) {
    window.location.replace("login.html?acesso=restrito");
    return;
  }

  const header = document.querySelector(".app-header, .header");
  const nav = header?.querySelector("nav");
  if (!header || !nav) return;

  // 3. Visitante NÃO logado na Home: mantém o botão "REGISTRAR", mas exige login ao clicar em áreas restritas
  if (!session.authenticated || !session.user) {
    if (isHomePage) {
      document.querySelectorAll('a[href="mapa.html"], a[href^="registro.html"]').forEach((link) => {
        link.addEventListener("click", (event) => {
          event.preventDefault();
          transitionToLogin("login.html?acesso=restrito");
        });
      });
    }
    return;
  }

  // 4. Usuário LOGADO:
  // - No index.html: remove apenas o link "Entrar", mantendo o botão "REGISTRAR ↗"
  // - No mapa.html e registro.html: remove "Entrar" e "Registrar" da barra superior
  const user = session.user;
  rememberAccount(user);

  nav.querySelectorAll('a[href="login.html"]').forEach((link) => link.remove());
  if (!isHomePage) {
    nav.querySelectorAll('a[href^="registro.html"]').forEach((link) => link.remove());
  }

  const firstName = (user.name || "Conta").trim().split(/\s+/)[0];
  const initial = firstName.charAt(0).toUpperCase();
  const roleLabel =
    user.role === "resolver" && user.company_name
      ? user.company_name
      : ROLE_LABELS[user.role] || "Cidadão";

  const menuWrap = document.createElement("div");
  menuWrap.className = "urbs-user-menu";
  menuWrap.innerHTML = `
    <button type="button" class="urbs-user-trigger" aria-expanded="false" aria-haspopup="menu">
      <span class="urbs-user-avatar" aria-hidden="true">${initial}</span>
      <span class="urbs-user-name">${firstName}</span>
      <span class="urbs-user-caret" aria-hidden="true">▾</span>
    </button>
    <div class="urbs-user-dropdown" role="menu" hidden>
      <div class="urbs-user-summary">
        <strong>${user.name}</strong>
        <span>${roleLabel}</span>
      </div>
      <div class="urbs-user-divider"></div>
      <a href="mapa.html" class="urbs-user-item" role="menuitem">Mapa de ocorrências</a>
      <a href="registro.html" class="urbs-user-item" role="menuitem">Nova ocorrência</a>
      <a href="login.html?trocar=1" class="urbs-user-item" role="menuitem">Alterar usuário</a>
      <div class="urbs-user-divider"></div>
      <button type="button" class="urbs-user-item is-danger" data-urbs-logout="1" role="menuitem">Sair da conta</button>
    </div>
  `;

  const trigger = menuWrap.querySelector(".urbs-user-trigger");
  const dropdown = menuWrap.querySelector(".urbs-user-dropdown");
  const logoutBtn = menuWrap.querySelector("[data-urbs-logout]");

  const closeMenu = () => {
    dropdown.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
    menuWrap.classList.remove("is-open");
  };

  trigger.addEventListener("click", (event) => {
    event.stopPropagation();
    const willOpen = dropdown.hidden;
    dropdown.hidden = !willOpen;
    trigger.setAttribute("aria-expanded", String(willOpen));
    menuWrap.classList.toggle("is-open", willOpen);
  });

  document.addEventListener("click", (event) => {
    if (!menuWrap.contains(event.target)) closeMenu();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeMenu();
  });

  logoutBtn.addEventListener("click", async () => {
    logoutBtn.disabled = true;
    logoutBtn.textContent = "Saindo…";
    try {
      await window.UrbsAPI.logout();
      transitionToLogin("login.html");
    } catch (error) {
      logoutBtn.disabled = false;
      logoutBtn.textContent = "Sair da conta";
      window.alert(error.message);
    }
  });

  if (isHomePage) {
    const mobileToggle = header.querySelector(".menu-toggle");
    if (mobileToggle) header.insertBefore(menuWrap, mobileToggle);
    else header.append(menuWrap);
  } else {
    nav.append(menuWrap);
  }
});