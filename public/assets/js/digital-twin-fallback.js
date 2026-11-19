// A CDN pode estar bloqueada em redes escolares. Mostre um aviso claro sem travar a página.
document.addEventListener('DOMContentLoaded', () => {
    const stage = document.getElementById('city-stage');
    if (!stage)
        return;
    window.setTimeout(() => {
        if (stage.dataset.twinState === 'ready' || stage.dataset.twinState === 'error')
            return;
        const box = document.getElementById('twin-loading');
        if (box) {
            box.querySelector('strong').textContent = 'RECURSO 3D NÃO CARREGOU';
            box.querySelector('small').textContent = 'Verifique o acesso ao Three.js e o suporte WebGL. O mapa e o restante do site continuam disponíveis.';
            box.querySelector('.twin-loading-orbit')?.remove();
        }
    }, 10000);
});
