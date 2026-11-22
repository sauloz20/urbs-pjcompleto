document.addEventListener("DOMContentLoaded", async () => {
  const nav = document.querySelector(".app-header nav");
  if (!nav || !window.UrbsAPI) return;

  try {
    const session = await window.UrbsAPI.session();
    if (!session.authenticated) return;

    const logout = document.createElement("a");
    logout.href = "#sair";
    logout.textContent = "Sair";
    logout.setAttribute("aria-label", `Sair da conta de ${session.user.name}`);
    logout.addEventListener("click", async (event) => {
      event.preventDefault();
      logout.setAttribute("aria-busy", "true");
      try {
        await window.UrbsAPI.logout();
        window.location.assign("login.html");
      } catch (error) {
        logout.removeAttribute("aria-busy");
        window.alert(error.message);
      }
    });
    nav.append(logout);
  } catch (error) {
    console.warn("Não foi possível consultar a sessão do URBS.", error.message);
  }
});
