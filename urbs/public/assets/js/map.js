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
    const activeFilterCount = document.getElementById("active-filter-count");
    const clearButton = document.getElementById("clear-filters");
    const locateButton = document.getElementById("locate-me");
    const liveRegion = document.getElementById("map-live-region");
    const actionFeedback = document.getElementById("report-action-feedback");
    const explorer = document.getElementById("occurrence-explorer");
    const explorerToggle = document.getElementById("explorer-toggle");
    const isMobile = window.matchMedia("(max-width: 760px)");
    if (explorer && explorerToggle) {
        explorer.dataset.expanded = "false";
        explorerToggle.addEventListener("click", () => {
            const expanded = explorer.dataset.expanded === "false";
            explorer.dataset.expanded = String(expanded);
            explorerToggle.setAttribute("aria-expanded", String(expanded));
        });
    }
    renderPinGuide();
    if (!window.L) {
        if (mapUnavailable)
            mapUnavailable.hidden = false;
        return;
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
        const symbol = makeElement("span", "report-card-symbol", appearance.symbol);
        symbol.style.setProperty("background-color", appearance.color);
        symbol.setAttribute("aria-hidden", "true");
        category.append(symbol, makeElement("span", "", report.category));
        card.append(category);
        if (report.demo)
            topline.append(makeElement("span", "demo-badge", "EXEMPLO"));
        const badge = makeElement("span", `status-pill ${statusClass[report.status] || ""}`, report.status);
        topline.append(badge);
        card.append(topline);
        const titleLine = makeElement("h3");
        const focusButton = makeElement("button", "report-card-title", report.title);
        focusButton.type = "button";
        focusButton.dataset.focusId = report.id;
        focusButton.setAttribute("aria-pressed", "false");
        focusButton.setAttribute("aria-label", `Ver no mapa: ${report.title}`);
        titleLine.append(focusButton);
        card.append(titleLine);
        const meta = makeElement("div", "report-card-meta");
        meta.textContent = report.address || "Ponto marcado no mapa";
        card.append(meta);
        if (!report.demo && (data.canEdit(report) || data.canDelete(report))) {
            const actions = makeReportActions(report);
            card.append(actions);
        }
        if (!report.demo && data.canManageStatus(report))
            card.append(makeStatusSelect(report));
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
        const groupNames = {
            "Pavimentação": "MOBILIDADE URBANA",
            "Iluminação pública": "SERVIÇOS URBANOS",
            "Acessibilidade": "ACESSIBILIDADE",
            "Descarte irregular de resíduos": "LIMPEZA URBANA",
            "Drenagem": "INFRAESTRUTURA",
            "Sinalização": "MOBILIDADE URBANA",
            "Outro": "INFRAESTRUTURA URBANA"
        };
        categoryMarkers.forEach((appearance, category, categories) => {
            const card = makeElement("li", "map-pin-guide-card");
            const preview = makeElement("span", "map-pin-preview");
            const top = makeElement("div", "map-pin-guide-top");
            const index = String(guide.children.length + 1).padStart(2, "0");
            const title = makeElement("h3", "map-pin-guide-title");
            const categoryName = makeElement("span", "map-pin-guide-category", category);
            const exampleLabel = makeElement("span", "map-pin-guide-example", "— EXEMPLO");
            const description = makeElement("p", "map-pin-guide-description", appearance.examples);
            const meta = makeElement("div", "map-pin-guide-meta");
            const metaCopy = makeElement("div", "map-pin-guide-meta-copy");
            const metaLabel = makeElement("span", "", "COR DO MARCADOR");
            const metaValue = makeElement("strong", "", appearance.color.toUpperCase());
            const footer = makeElement("div", "map-pin-guide-footer");
            const footerText = makeElement("span", "", "O pino colorido identifica esta categoria no mapa.");
            preview.setAttribute("aria-hidden", "true");
            preview.append(makePin(appearance));
            card.style.setProperty("--guide-pin-color", appearance.color);
            top.append(makeElement("span", "map-pin-guide-index", `${index} / ${String(categories.size).padStart(2, "0")}`));
            top.append(makeElement("span", "map-pin-guide-group", groupNames[category] || "URBANISMO"));
            title.append(categoryName, exampleLabel);
            metaCopy.append(metaLabel, metaValue);
            meta.append(metaCopy);
            footer.append(footerText, preview);
            card.append(top, title, description, meta, footer);
            guide.append(card);
        });
        guide.closest("section").hidden = false;
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
            markersById.set(report.id, marker);
        });
        resultCount.textContent = `${reports.length} ${reports.length === 1 ? "registro" : "registros"}`;
        const active = [categoryFilter, statusFilter].filter((field) => field?.value && field.value !== "all").length;
        activeFilterCount.hidden = active === 0;
        activeFilterCount.textContent = String(active);
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
    list.addEventListener("click", (event) => {
        const button = event.target.closest("[data-focus-id]");
        if (button && focusReport(button.dataset.focusId, !isMobile.matches) && isMobile.matches) {
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
                    link.innerHTML = 'Registrar <span aria-hidden="true">＋</span>';
            } else {
                link.href = "login.html";
                if (link.classList.contains("occurrence-primary"))
                    link.textContent = "Entrar para registrar";
                else
                    link.textContent = "Entrar para registrar ocorrência";
            }
        });
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
    const params = new URLSearchParams(window.location.search);
    window.setTimeout(() => map.invalidateSize(), 120);
});


