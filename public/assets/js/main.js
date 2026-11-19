document.addEventListener("DOMContentLoaded", () => {
    const menuButton = document.querySelector(".menu-toggle");
    const nav = document.querySelector(".main-nav");
    const progress = document.querySelector(".scroll-progress span");
    function closeMenu() {
        if (!nav || !menuButton)
            return;
        nav.classList.remove("is-open");
        menuButton.setAttribute("aria-expanded", "false");
        menuButton.setAttribute("aria-label", "Abrir navegação");
    }
    menuButton?.addEventListener("click", () => {
        const open = nav?.classList.toggle("is-open") ?? false;
        menuButton.setAttribute("aria-expanded", String(open));
        menuButton.setAttribute("aria-label", open ? "Fechar navegação" : "Abrir navegação");
    });
    nav?.querySelectorAll("a").forEach((link) => link.addEventListener("click", closeMenu));
    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape")
            closeMenu();
    });
    function updateProgress() {
        if (!progress)
            return;
        const max = document.documentElement.scrollHeight - window.innerHeight;
        progress.style.transform = `scaleX(${max > 0 ? window.scrollY / max : 0})`;
    }
    window.addEventListener("scroll", updateProgress, { passive: true });
    updateProgress();
    const count = document.getElementById("local-record-count");
    if (count && window.UrbsData)
        count.textContent = String(window.UrbsData.getStoredReports().length);
    // Scroll animations are intentionally non-blocking; all content stays visible.
});
