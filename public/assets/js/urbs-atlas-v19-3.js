/* URBS / ATLAS 19.3 - Vista cartografica 2D real e cidade 3D sob demanda.
 * Nao declara ocorrencias reais nem inventa estatisticas municipais.
 */
(() => {
    'use strict';
    const stage = document.getElementById('city-stage');
    const elMap = document.getElementById('atlas-real-map');
    if (!stage || !elMap)
        return;
    const $ = id => document.getElementById(id);
    const btn2d = $('atlas-view-2d'), btn3d = $('atlas-view-3d');
    const settings = $('atlas-settings'), offline = $('atlas-map-offline');
    const card = $('atlas-map-card');
    const center = [-16.7286, -43.8582];
    let map, markers, satellite, roads, labels, mode = '2d', currentLayer = 'satellite';
    let twinPromise = null;
    const reportData = window.UrbsData && typeof window.UrbsData.getAllReports === 'function'
        ? window.UrbsData.getAllReports() : [];
    function updateButtons() {
        btn2d.classList.toggle('is-active', mode === '2d');
        btn3d.classList.toggle('is-active', mode === '3d');
        btn2d.setAttribute('aria-pressed', String(mode === '2d'));
        btn3d.setAttribute('aria-pressed', String(mode === '3d'));
    }
    function activateMode(next) {
        if (next === mode)
            return;
        mode = next;
        stage.dataset.atlasMode = mode;
        document.querySelector('.atlas-toolbar')?.classList.toggle('is-3d', mode === '3d');
        updateButtons();
        if (mode === '2d') {
            settings.open = false;
            window.setTimeout(() => map?.invalidateSize({ pan: false }), 60);
        }
        else {
            // Carregamento sob demanda reduz o custo grafico no notebook do curso.
            if (!twinPromise) {
                const loading = $('twin-loading');
                if (loading)
                    loading.hidden = false;
                stage.dataset.twinState = 'loading';
                twinPromise = import('./urbs-digital-twin-3d-v19-2.js').catch(err => {
                    console.warn('[URBS] Three.js nao carregou:', err);
                    if (loading) {
                        loading.hidden = false;
                        loading.querySelector('strong').textContent = 'MAQUETE 3D INDISPONÍVEL';
                        loading.querySelector('small').textContent = 'Confira a conexão e o WebGL. O satélite continua disponível.';
                        loading.querySelector('.twin-loading-orbit')?.remove();
                    }
                    stage.dataset.twinState = 'error';
                });
            }
        }
    }
    btn2d.addEventListener('click', () => activateMode('2d'));
    btn3d.addEventListener('click', () => activateMode('3d'));
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && settings.open)
            settings.open = false;
    });
    $('atlas-inspector-close')?.addEventListener('click', () => {
        const aside = $('twin-inspector');
        if (aside)
            aside.hidden = true;
    });
    function showReport(report) {
        if (!report)
            return;
        $('atlas-card-category').textContent = `${report.category || 'INFRAESTRUTURA'} / ${report.demo ? 'EXEMPLO FICTÍCIO' : 'REGISTRO LOCAL'}`;
        $('atlas-card-title').textContent = report.title || 'Registro urbano';
        $('atlas-card-description').textContent = report.description || 'Sem descrição.';
        $('atlas-card-status').textContent = `SITUAÇÃO: ${report.status || 'Novo'} · ${Number(report.lat).toFixed(4)}, ${Number(report.lng).toFixed(4)}`;
        card.hidden = false;
    }
    $('atlas-card-close').addEventListener('click', () => { card.hidden = true; });
    function initMap() {
        if (!window.L) {
            offline.hidden = false;
            return;
        }
        map = L.map(elMap, {
            zoomControl: false, scrollWheelZoom: false, attributionControl: true,
            tap: false, preferCanvas: true
        }).setView(center, 14);
        const attEsri = 'Imagens &copy; Esri, Maxar, Earthstar Geographics';
        satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: attEsri });
        labels = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: 'Rótulos &copy; Esri', opacity: .75 });
        roads = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' });
        satellite.addTo(map);
        labels.addTo(map);
        let satelliteLoaded = false, roadsLoaded = false;
        satellite.on('tileload', () => { satelliteLoaded = true; offline.hidden = true; });
        roads.on('tileload', () => { roadsLoaded = true; offline.hidden = true; });
        window.setTimeout(() => {
            if (!satelliteLoaded && currentLayer === 'satellite')
                setLayer('streets');
            window.setTimeout(() => {
                if (!satelliteLoaded && !roadsLoaded)
                    offline.hidden = false;
            }, 7000);
        }, 8500);
        L.control.zoom({ position: 'topright' }).addTo(map);
        // Um unico fallback: se o provedor de satelite falhar, tente ruas.
        let tileErrors = 0;
        satellite.on('tileerror', () => {
            if (++tileErrors >= 7 && currentLayer === 'satellite')
                setLayer('streets');
        });
        const switchLayer = layer => {
            const isSatellite = layer === 'satellite';
            $('atlas-satellite').classList.toggle('is-active', isSatellite);
            $('atlas-streets').classList.toggle('is-active', !isSatellite);
            $('atlas-satellite').setAttribute('aria-pressed', String(isSatellite));
            $('atlas-streets').setAttribute('aria-pressed', String(!isSatellite));
        };
        function setLayer(layer) {
            currentLayer = layer;
            map.removeLayer(satellite);
            map.removeLayer(labels);
            map.removeLayer(roads);
            if (layer === 'satellite') {
                satellite.addTo(map);
                labels.addTo(map);
            }
            else
                roads.addTo(map);
            switchLayer(layer);
        }
        $('atlas-satellite').addEventListener('click', () => { tileErrors = 0; setLayer('satellite'); });
        $('atlas-streets').addEventListener('click', () => setLayer('streets'));
        $('atlas-center').addEventListener('click', () => { map.flyTo(center, 14, { duration: 1.0 }); card.hidden = true; });
        markers = L.layerGroup().addTo(map);
        reportData.forEach(report => {
            const lat = Number(report.lat), lng = Number(report.lng);
            if (!Number.isFinite(lat) || !Number.isFinite(lng))
                return;
            const marker = L.marker([lat, lng], {
                icon: L.divIcon({ className: 'atlas-map-marker', html: `<span class="atlas-map-pin${report.demo ? '' : ' atlas-map-pin--local'}" aria-hidden="true"></span>`, iconSize: [30, 30], iconAnchor: [15, 15] }),
                title: `${report.category || 'Registro'} · ${report.demo ? 'Exemplo fictício' : 'Registro local'}`
            });
            marker.addTo(markers);
            marker.on('click', () => { showReport(report); map.panTo([lat, lng], { animate: true, duration: .7 }); });
        });
        // A camada 2D deve caber no palco independente da pagina.
        const resizeObserver = ('ResizeObserver' in window) ? new ResizeObserver(() => { if (mode === '2d')
            map.invalidateSize({ pan: false }); }) : null;
        resizeObserver?.observe(elMap);
        window.addEventListener('pagehide', () => resizeObserver?.disconnect(), { once: true });
        setTimeout(() => map.invalidateSize(), 150);
    }
    // Leaflet pode estar bloqueado por rede ou firewall da escola.
    if (document.readyState === 'loading')
        document.addEventListener('DOMContentLoaded', initMap, { once: true });
    else
        initMap();
})();
