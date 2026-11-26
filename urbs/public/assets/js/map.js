document.addEventListener("DOMContentLoaded", () => {
    const mapElement = document.getElementById("map");
    const mapUnavailable = document.getElementById("map-unavailable");
    const data = window.UrbsData;
    if (!mapElement || !data)
        return;
    const center = [-16.7286, -43.8578];
    const categoryMarkers = new Map([
        ["Pavimentação", { icon: "construction", symbol: "║", color: "#f4a96e", examples: "Buracos, asfalto quebrado e desníveis na via." }],
        ["Iluminação pública", { icon: "lightbulb", symbol: "✦", color: "#f8df75", examples: "Lâmpadas apagadas, intermitentes ou danificadas." }],
        ["Acessibilidade", { icon: "accessibility", symbol: "♿︎", color: "#9ce0a3", examples: "Calçadas obstruídas, rampas danificadas ou ausentes." }],
        ["Descarte irregular de resíduos", { icon: "trash-2", symbol: "▤", color: "#c9b7f4", examples: "Lixo, entulho ou móveis descartados em área pública." }],
        ["Drenagem", { icon: "droplets", symbol: "≋", color: "#8dcdf3", examples: "Bueiros entupidos e acúmulo de água na rua." }],
        ["Sinalização", { icon: "signpost", symbol: "!", color: "#f6a6bf", examples: "Placas danificadas, semáforos com defeito e faixas apagadas." }],
        ["Outro", { icon: "map-pin", symbol: "•", color: "#cbd4ca", examples: "Problemas de infraestrutura fora das demais categorias." }]
    ]);
    const otherCategory = categoryMarkers.get("Outro");
    const statusColors = {
        "Novo": "#b8e954",
        "Em análise": "#e5a94a",
        "Em andamento": "#53c4aa",
        "Solucionado": "#6dae71",
        "Rejeitado": "#d27a76"
    };
    const statusClass = {
        "Novo": "",
        "Em análise": "status-analysis",
        "Em andamento": "status-progress",
        "Solucionado": "status-solved",
        "Rejeitado": "status-rejected"
    };
    const statusFilter = document.getElementById("status-filter");
    const categoryFilter = document.getElementById("category-filter");
    const locationFilter = document.getElementById("location-filter");
    const list = document.getElementById("report-list");
    const emptyState = document.getElementById("empty-state");
    const resultCount = document.getElementById("result-count");
    const categoryTabs = document.getElementById("category-tabs");
    const filterChips = document.getElementById("filter-chips");
    const clearButton = document.getElementById("clear-filters");
    const locateButton = document.getElementById("locate-me");
    const liveRegion = document.getElementById("map-live-region");
    const actionFeedback = document.getElementById("report-action-feedback");
    const explorer = document.getElementById("occurrence-explorer");
    const explorerToggle = document.getElementById("explorer-toggle");
    const isMobile = window.matchMedia("(max-width: 760px)");
    const content = document.getElementById("explorer-content");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    function setSheet(open) {
        explorer.dataset.expanded = String(open);
        explorerToggle.setAttribute("aria-expanded", String(open));
        content.inert = isMobile.matches && !open;
    }
    setSheet(false);
    isMobile.addEventListener("change", () => setSheet(false));
    let dragStart = null;
    let suppressClick = false;
    explorerToggle.addEventListener("pointerdown", event => {
        dragStart = event.clientY;
        suppressClick = false;
        explorerToggle.setPointerCapture(event.pointerId);
    });
    explorerToggle.addEventListener("pointercancel", () => { dragStart = null; });
    explorerToggle.addEventListener("pointerup", event => {
        if (dragStart === null) return;
        const distance = event.clientY - dragStart;
        dragStart = null;
        if (Math.abs(distance) < 24) return;
        suppressClick = true;
        setSheet(distance < 0);
    });
    explorerToggle.addEventListener("click", event => {
        if (!suppressClick || event.detail === 0) setSheet(explorer.dataset.expanded !== "true");
        suppressClick = false;
    });
    window.lucide?.createIcons();
    renderPinGuide();
    if (!window.L) {
        if (mapUnavailable)
            mapUnavailable.hidden = false;
        return;
    }
    for (const option of categoryFilter.options) {
        const label = option.value === "all" ? "Todos" : option.value
            .replace("Iluminação pública", "Iluminação")
            .replace("Descarte irregular de resíduos", "Resíduos");
        const button = makeElement("button", "category-tab", label);
        button.type = "button";
        button.value = option.value;
        button.addEventListener("click", () => {
            categoryFilter.value = option.value;
            render();
        });
        categoryTabs.append(button);
    }
    // O mapa mantém os exemplos visuais e carrega as ocorrências reais pela API PHP.
    const map = L.map(mapElement, { scrollWheelZoom: false, zoomControl: false, preferCanvas: true }).setView(center, 13);
    const streets = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    });
    const satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19, attribution: 'Imagens: Esri, Maxar, Earthstar Geographics e colaboradores'
    });
    const labels = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19, opacity: .88, attribution: 'Rótulos: Esri'
    });
    let selectedLayer = 'light';
    streets.addTo(map);
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    const fullscreenButton = document.getElementById("map-fullscreen");
    const mapPanel = fullscreenButton?.closest(".map-panel");
    if (document.fullscreenEnabled && mapPanel?.requestFullscreen && document.exitFullscreen) {
        fullscreenButton.hidden = false;
        fullscreenButton.addEventListener("click", async () => {
            try {
                if (document.fullscreenElement === mapPanel) {
                    await document.exitFullscreen();
                } else {
                    await mapPanel.requestFullscreen();
                }
            } catch {
                liveRegion.textContent = "Não foi possível alternar a tela cheia.";
            }
        });
        document.addEventListener("fullscreenchange", () => {
            const expanded = document.fullscreenElement === mapPanel;
            fullscreenButton.setAttribute("aria-pressed", String(expanded));
            fullscreenButton.title = expanded ? "Sair da tela cheia" : "Tela cheia";
            fullscreenButton.firstElementChild.textContent = fullscreenButton.title;
            requestAnimationFrame(() => map.invalidateSize({ pan: false }));
        });
    }
    const lightButton = document.getElementById('btnLayerLight');
    const satButton = document.getElementById('btnLayerSat');
    function setMapLayer(mode) {
        if (mode !== 'light' && mode !== 'satellite')
            return;
        selectedLayer = mode;
        map.removeLayer(streets);
        map.removeLayer(satellite);
        map.removeLayer(labels);
        if (mode === 'satellite') {
            satellite.addTo(map);
            labels.addTo(map);
        }
        else {
            streets.addTo(map);
        }
        lightButton?.classList.toggle('is-active', mode === 'light');
        satButton?.classList.toggle('is-active', mode === 'satellite');
        lightButton?.setAttribute('aria-pressed', String(mode === 'light'));
        satButton?.setAttribute('aria-pressed', String(mode === 'satellite'));
        if (liveRegion)
            liveRegion.textContent = mode === 'light' ? 'Mapa de ruas selecionado.' : 'Visualização por satélite selecionada.';
    }
    lightButton?.addEventListener('click', () => setMapLayer('light'));
    satButton?.addEventListener('click', () => setMapLayer('satellite'));
    let failedSatelliteTiles = 0;
    satellite.on('tileerror', () => {
        if (selectedLayer === 'satellite' && ++failedSatelliteTiles >= 5) {
            setMapLayer('light');
            if (liveRegion)
                liveRegion.textContent = 'Imagens de satélite indisponíveis. Alternamos para o mapa de ruas.';
        }
    });
    const markerLayer = L.featureGroup().addTo(map);
    const markersById = new Map();
    const resetCityButton = document.getElementById('map-reset-city');
    const fitReportsButton = document.getElementById('map-fit-reports');
    function centerCity() { map.flyTo(center, 15, { duration: 1.25 }); }
    function showAllPoints() {
        if (markerLayer.getLayers().length && markerLayer.getBounds().isValid()) {
            map.flyToBounds(markerLayer.getBounds().pad(.22), { maxZoom: 14, duration: 1.35 });
        }
        else {
            centerCity();
        }
    }
    resetCityButton?.addEventListener('click', centerCity);
    fitReportsButton?.addEventListener('click', showAllPoints);
    function normalizeText(value) {
        return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
    }
    function makeElement(tag, className, text) {
        const element = document.createElement(tag);
        if (className)
            element.className = className;
        if (text !== undefined)
            element.textContent = text;
        return element;
    }
    function getFilteredReports() {
        const category = categoryFilter?.value || "all";
        const status = statusFilter?.value || "all";
        const term = normalizeText(locationFilter?.value || "").trim();
        return data.getAllReports().filter((report) => {
            const matchesCategory = category === "all" || report.category === category;
            const matchesStatus = status === "all" || report.status === status;
            const haystack = normalizeText(`${report.address} ${report.title} ${report.description}`);
            return matchesCategory && matchesStatus && (!term || haystack.includes(term));
        }).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    }
    function popupContent(report) {
        const wrapper = makeElement("div", "map-popup");
        wrapper.append(makeElement("small", "", report.category));
        wrapper.append(makeElement("strong", "", report.title));
        wrapper.append(makeElement("p", "", report.description));
        wrapper.append(makeElement("span", "popup-meta", `${report.address || "Localização marcada no mapa"} · ${data.formatDate(report.createdAt)} · ${report.status}`));
        if (report.demo)
            wrapper.append(makeElement("span", "demo-badge", "EXEMPLO FICTÍCIO"));
        else if (data.canEdit(report) || data.canDelete(report))
            wrapper.append(makeReportActions(report));
        return wrapper;
    }
    function showActionFeedback(message, error = false) {
        actionFeedback.classList.toggle("is-error", error);
        actionFeedback.textContent = message;
    }
    function makeReportActions(report) {
        const actions = makeElement("div", "report-management");
        const remove = makeElement("button", "report-action report-action-delete", "Excluir");
        if (data.canEdit(report)) {
            const edit = makeElement("a", "report-action", "Editar");
            edit.href = `registro.html?${new URLSearchParams({ editar: report.id })}`;
            edit.setAttribute("aria-label", `Editar ocorrência: ${report.title}`);
            actions.append(edit);
        }
        remove.type = "button";
        remove.setAttribute("aria-label", `Excluir ocorrência: ${report.title}`);
        remove.addEventListener("click", async () => {
            if (!window.confirm(`Excluir “${report.title}”? Esta ação não pode ser desfeita.`))
                return;
            remove.disabled = true;
            const result = await data.deleteReport(report.id);
            if (!result.ok) {
                showActionFeedback(result.message || "Não foi possível excluir a ocorrência.", true);
                remove.disabled = false;
                return;
            }
            render();
            showActionFeedback("Ocorrência excluída do banco de dados.");
            const focusTarget = isMobile.matches && explorer?.dataset.expanded === "false" ? explorerToggle : locationFilter;
            focusTarget?.focus({ preventScroll: true });
        });
        if (data.canDelete(report))
            actions.append(remove);
        return actions;
    }
    function makeStatusSelect(report) {
        const select = document.createElement("select");
        select.className = "status-select";
        select.dataset.statusFor = report.id;
        select.setAttribute("aria-label", `Atualizar situação de ${report.title}`);
        data.STATUSES.forEach((status) => {
            const option = document.createElement("option");
            option.value = status;
            option.textContent = status;
            option.selected = status === report.status;
            select.append(option);
        });
        return select;
    }
    function makeReportCard(report) {
        const card = makeElement("article", "report-card");
        card.dataset.reportId = report.id;
        const topline = makeElement("div", "report-card-topline");
        const category = makeElement("span", "report-card-category");
        const appearance = categoryMarkers.get(report.category) || otherCategory;
        const symbol = makeElement("span", "report-card-symbol");
        symbol.style.setProperty("background-color", appearance.color);
        symbol.setAttribute("aria-hidden", "true");
        category.append(symbol, makeElement("span", "", report.category));

        const badge = makeElement("span", `status-pill ${statusClass[report.status] || ""}`, report.status);
        const reference = report.demo ? "Exemplo" : "#" + String(report.id).padStart(3, "0");
        topline.append(makeElement("span", "report-card-code", reference), badge);
        card.append(topline);
        const titleLine = makeElement("h3");
        const title = report.demo ? report.title.replace(/\s*— exemplo$/i, "") : report.title;
        const focusButton = makeElement("button", "report-card-title", title);
        focusButton.type = "button";
        focusButton.dataset.focusId = report.id;
        focusButton.setAttribute("aria-pressed", "false");
        focusButton.setAttribute("aria-label", `Ver no mapa: ${report.title}`);
        const arrow = makeElement("span", "report-focus-arrow", "↗︎");
        arrow.setAttribute("aria-hidden", "true");
        focusButton.append(arrow);
        titleLine.append(focusButton);
        card.append(titleLine);
        const meta = makeElement("div", "report-card-meta");
        meta.textContent = report.address || "Ponto marcado no mapa";
        card.append(meta, category);
        const details = makeElement("p", "report-description", report.description || "Sem descrição adicional.");
        details.hidden = true;
        card.append(details);
        if (!report.demo && (data.canEdit(report) || data.canDelete(report))) {
            const actions = makeReportActions(report);
            card.append(actions);
        }
        if (!report.demo && data.canManageStatus(report))
            card.append(makeStatusSelect(report));
        return card;
    }
    function makePin(appearance, status, demo) {
        const pin = makeElement("span", demo ? "map-v19-pin map-v19-demo-pin" : "map-v19-pin");
        pin.setAttribute("aria-hidden", "true");
        pin.style.setProperty("--pin-color", appearance.color);
        const icon = makeElement("span", "map-pin-icon");
        const iconNode = makeElement("i", "map-pin-lucide");
        icon.append(iconNode);
        if (window.lucide?.createIcons) {
            iconNode.setAttribute("data-lucide", appearance.icon || "map-pin");
            window.lucide.createIcons({ root: icon, attrs: { "stroke-width": 2.2 } });
        } else {
            icon.classList.add("map-pin-icon-fallback");
            icon.textContent = appearance.symbol || "•";
        }
        pin.append(icon);
        if (status) {
            pin.style.setProperty("--pin-status", statusColors[status] || statusColors.Novo);
            pin.append(makeElement("span", "map-pin-status"));
        }
        return pin;
    }
    function renderPinGuide() {
        const guide = document.getElementById("map-pin-guide-list");
        if (!guide)
            return;
        categoryMarkers.forEach((appearance, category) => {
            const entry = makeElement("li", "map-category-entry");
            const preview = makeElement("span", "map-category-preview");
            preview.setAttribute("aria-hidden", "true");
            preview.append(makePin(appearance));
            const caption = makeElement("span", "category-caption");
            caption.append(makeElement("strong", "", category), makeElement("small", "", appearance.examples));
            entry.append(preview, caption);
            guide.append(entry);
        });
        guide.closest(".map-legend-group").hidden = false;
        const sample = document.getElementById("pin-example");
        sample.append(makePin(categoryMarkers.get("Iluminação pública"), "Em análise"));
        sample.parentElement.hidden = false;
    }
    function makeReportMarker(report) {
        const appearance = categoryMarkers.get(report.category) || otherCategory;
        const pin = makePin(appearance, report.status, report.demo);
        const icon = L.divIcon({
            className: "map-v19-pin-holder",
            html: pin.outerHTML,
            iconSize: [44, 48], iconAnchor: [22, 46], popupAnchor: [8, -45]
        });
        const label = `${report.title} · ${report.category} · ${report.status}`;
        const marker = L.marker([report.lat, report.lng], { icon, keyboard: true, title: label }).addTo(markerLayer);
        marker.getElement()?.setAttribute("aria-label", label);
        return marker;
    }
    function updateFilterChips() {
        filterChips.replaceChildren();
        for (const field of [statusFilter, locationFilter]) {
            const isSearch = field === locationFilter;
            const value = field.value.trim();
            if (!value || (!isSearch && value === "all")) continue;
            const label = isSearch ? "Busca: " + value : field.selectedOptions[0].textContent.trim();
            const chip = makeElement("button", "filter-chip", label);
            chip.type = "button";
            chip.setAttribute("aria-label", "Remover filtro: " + label);
            const remove = makeElement("span", "", "×");
            remove.setAttribute("aria-hidden", "true");
            chip.append(remove);
            chip.addEventListener("click", () => {
                field.value = isSearch ? "" : "all";
                render();
                (filterChips.firstElementChild || locationFilter).focus({ preventScroll: true });
            });
            filterChips.append(chip);
        }
        const count = filterChips.childElementCount;
        filterChips.hidden = count === 0;
        clearButton.hidden = count === 0 && categoryFilter.value === "all";
        for (const button of categoryTabs.children)
            button.setAttribute("aria-pressed", String(button.value === categoryFilter.value));
    }
    function render() {
        const reports = getFilteredReports();
        markerLayer.clearLayers();
        markersById.clear();
        list.replaceChildren();
        reports.forEach((report) => {
            list.append(makeReportCard(report));
            const marker = makeReportMarker(report);
            marker.bindPopup(popupContent(report), { maxWidth: 260 });
            marker.on("popupopen", () => selectReport(report.id));
            marker.on("click", () => {
                window.clearTimeout(pendingPopup);
                selectReport(report.id);
                if (isMobile.matches) setSheet(true);
                requestAnimationFrame(() => {
                    const card = list.querySelector(".is-selected");
                    if (card) list.scrollTop += card.getBoundingClientRect().top - list.getBoundingClientRect().top;
                });
            });
            markersById.set(report.id, marker);
        });
        resultCount.textContent = String(reports.length);
        resultCount.setAttribute("aria-label", `${reports.length} ${reports.length === 1 ? "registro" : "registros"}`);
        updateFilterChips();
        emptyState.hidden = reports.length > 0;
        if (reports.length > 0 && markerLayer.getBounds().isValid()) {
            map.fitBounds(markerLayer.getBounds().pad(.22), { maxZoom: 14, animate: false });
        }
        else {
            map.setView(center, 13);
        }
    }
    let selectedReportId = null;
    let pendingPopup = 0;
    function selectReport(id) {
        selectedReportId = id;
        list.querySelectorAll(".report-card").forEach((card) => {
            card.classList.toggle("is-selected", card.dataset.reportId === id);
            card.querySelector(".report-description").hidden = card.dataset.reportId !== id;
            card.querySelector("[data-focus-id]").setAttribute("aria-pressed", String(card.dataset.reportId === id));
        });
        markersById.forEach((marker, markerId) => {
            const selected = markerId === id;
            marker.getElement()?.classList.toggle("is-selected", selected);
            marker.setZIndexOffset(selected ? 1000 : 0);
        });
    }
    function focusReport(id, animate = true) {
        const marker = markersById.get(id);
        if (!marker)
            return false;
        const position = marker.getLatLng();
        selectReport(id);
        window.clearTimeout(pendingPopup);
        if (animate) {
            map.flyTo(position, 16, { duration: 1.15 });
            pendingPopup = window.setTimeout(() => {
                if (markersById.get(id) === marker && selectedReportId === id)
                    marker.openPopup();
            }, 400);
        }
        else {
            map.setView(position, 16, { animate: false });
            marker.openPopup();
        }
        return true;
    }
    [categoryFilter, statusFilter].forEach((field) => field?.addEventListener("change", render));
    locationFilter?.addEventListener("input", render);
    clearButton?.addEventListener("click", () => {
        categoryFilter.value = "all";
        statusFilter.value = "all";
        locationFilter.value = "";
        render();
        locationFilter.focus();
    });
    let hoverTimer;
    list.addEventListener("pointerover", event => {
        const card = event.target.closest(".report-card");
        if (event.pointerType !== "mouse" || !card || card.contains(event.relatedTarget)) return;
        hoverTimer = setTimeout(() => {
            const marker = markersById.get(card.dataset.reportId);
            if (!marker) return;
            window.clearTimeout(pendingPopup);
            selectReport(card.dataset.reportId);
            map.panTo(marker.getLatLng(), { animate: !reducedMotion.matches, duration: .35 });
        }, 300);
    });
    list.addEventListener("pointerout", event => {
        const card = event.target.closest(".report-card");
        if (card && !card.contains(event.relatedTarget)) clearTimeout(hoverTimer);
    });
    list.addEventListener("click", (event) => {
        clearTimeout(hoverTimer);
        const button = event.target.closest("[data-focus-id]");
        if (button && focusReport(button.dataset.focusId, !isMobile.matches && !reducedMotion.matches) && isMobile.matches) {
            setSheet(false);
            explorerToggle.focus({ preventScroll: true });
            mapElement.scrollIntoView({ block: "nearest", behavior: "instant" });
        }
    });
    list.addEventListener("change", async (event) => {
        const select = event.target.closest("[data-status-for]");
        if (!select)
            return;
        select.disabled = true;
        const updated = await data.updateStatus(select.dataset.statusFor, select.value);
        if (liveRegion)
            liveRegion.textContent = updated.ok
                ? `Situação atualizada para ${select.value}.`
                : updated.message || "Não foi possível atualizar a situação.";
        if (!updated.ok)
            showActionFeedback(updated.message || "Não foi possível atualizar a situação.", true);
        render();
    });
    locateButton?.addEventListener("click", () => {
        if (!navigator.geolocation) {
            if (liveRegion)
                liveRegion.textContent = "A geolocalização não está disponível neste dispositivo.";
            return;
        }
        locateButton.disabled = true;
        navigator.geolocation.getCurrentPosition((position) => {
            map.flyTo([position.coords.latitude, position.coords.longitude], 16, { duration: 1.25 });
            locateButton.disabled = false;
            if (liveRegion)
                liveRegion.textContent = "Mapa centralizado na sua localização.";
        }, () => {
            locateButton.disabled = false;
            if (liveRegion)
                liveRegion.textContent = "Não foi possível obter sua localização. Confira as permissões do dispositivo.";
        }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
    });
    function updateRegistrationLinks() {
        document.querySelectorAll('a[href="registro.html"]').forEach((link) => {
            if (data.currentUser) {
                link.href = "registro.html";
                if (link.classList.contains("occurrence-primary"))
                    link.innerHTML = 'Registrar <span aria-hidden="true">↗</span>';
            } else {
                link.href = "login.html";
                if (link.classList.contains("occurrence-primary"))
                    link.textContent = "Entrar para registrar";
                else
                    link.textContent = "Entrar para registrar ocorrência";
            }
        });
    }

    const initialCategory = new URLSearchParams(window.location.search).get("categoria");
    if (initialCategory && categoryFilter && [...categoryFilter.options].some((o) => o.value === initialCategory)) {
        categoryFilter.value = initialCategory;
    }

    render();
    data.load().then(({ error }) => {
        render();
        updateRegistrationLinks();
        if (error)
            showActionFeedback(error.message, true);
        const params = new URLSearchParams(window.location.search);
        const editedReportId = params.get("editado");
        const requestedReportId = editedReportId || params.get("novo");
        if (requestedReportId && focusReport(requestedReportId, false)) {
            if (editedReportId)
                showActionFeedback("Alterações salvas. Ocorrência selecionada no mapa.");
            else if (liveRegion)
                liveRegion.textContent = "Registro salvo no banco de dados. Ocorrência selecionada no mapa.";
            setSheet(false);
            explorerToggle.focus({ preventScroll: true });
            mapElement.scrollIntoView({ block: "nearest", behavior: "instant" });
        }
    });
    window.addEventListener("pageshow", async (event) => {
        if (event.persisted) {
            await data.load();
            render();
            updateRegistrationLinks();
        }
    });
    window.setTimeout(() => map.invalidateSize(), 120);
});


