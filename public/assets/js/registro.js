document.addEventListener("DOMContentLoaded", async () => {
  const mapElement = document.getElementById("picker-map");
  const form = document.getElementById("report-form");
  const feedback = document.getElementById("form-feedback");
  const latitudeInput = document.getElementById("latitude");
  const longitudeInput = document.getElementById("longitude");
  const coordinates = document.getElementById("coordinates");
  const useLocation = document.getElementById("use-location");
  const description = document.getElementById("description");
  const descriptionCount = document.getElementById("description-count");
  const categorySelect = document.getElementById("category");
  const submitButton = form?.querySelector('button[type="submit"]');
  const data = window.UrbsData;
  if (!mapElement || !form || !data) return;
  const sessionState = await data.load();
  if (!sessionState.user) {
    const signIn = document.createElement("a");
    signIn.href = "login.html";
    signIn.className = "text-link";
    signIn.textContent = "Entrar na conta";
    feedback.replaceChildren(
      document.createTextNode(
        sessionState.error?.message || "Entre na sua conta para registrar uma ocorrência.",
      ),
      document.createTextNode(" "),
      signIn,
    );
    feedback.className = "form-feedback is-error";
    submitButton?.setAttribute("disabled", "");
    return;
  }
  const params = new URLSearchParams(window.location.search);
  const editId = params.get("editar");
  const isEditing = editId !== null;
  const existing = isEditing ? data.getReport(editId) : null;
  if (isEditing) {
    document.title = "Editar ocorrência — URBS";
    document.getElementById("report-page-title").textContent = "Editar ocorrência";
    document.getElementById("report-submit-label").textContent = "Salvar alterações";
    if (!existing || !data.canEdit(existing)) {
      submitButton.disabled = true;
      form.addEventListener("submit", (event) => event.preventDefault());
      feedback.textContent = existing
        ? "Você só pode editar suas próprias ocorrências ainda não analisadas."
        : "Esta ocorrência não está disponível na base de dados. Volte ao mapa para consultar os registros.";
      feedback.className = "form-feedback is-error";
      return;
    }
  }
  const defaultCenter = [-16.7286, -43.8578];
  const map = window.L
    ? L.map(mapElement, { scrollWheelZoom: false, zoomControl: false }).setView(defaultCenter, 13)
    : null;
  if (map) {
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);
    L.control.zoom({ position: "bottomright" }).addTo(map);
  } else {
    coordinates.textContent =
      "O mapa não carregou. Você pode tentar novamente após recarregar a página.";
    if (useLocation) useLocation.disabled = true;
  }
  let marker = null;
  let saved = false;
  window.addEventListener("pageshow", (event) => {
    if (event.persisted && saved) {
      saved = false;
      submitButton.disabled = false;
      feedback.textContent = "";
      feedback.className = "form-feedback";
    }
  });
  function setPoint(latlng) {
    if (map) {
      if (marker) marker.setLatLng(latlng);
      else
        marker = L.marker(latlng, { draggable: true, title: "Localização da ocorrência" }).addTo(
          map,
        );
      marker.off("dragend").on("dragend", () => setPoint(marker.getLatLng()));
    }
    latitudeInput.value = String(latlng.lat);
    longitudeInput.value = String(latlng.lng);
    const label = map ? "Ponto marcado" : "Ponto mantido";
    coordinates.textContent = `${label} · ${Number(latlng.lat).toFixed(6)}, ${Number(latlng.lng).toFixed(6)}`;
    coordinates.classList.add("is-picked");
    feedback.textContent = "";
    feedback.className = "form-feedback";
  }
  map?.on("click", (event) => setPoint(event.latlng));
  if (map) window.setTimeout(() => map.invalidateSize(), 120);
  if (existing) {
    document.getElementById("title").value = existing.title;
    document.getElementById("address").value = existing.address;
    description.value = existing.description;
    descriptionCount.textContent = String(description.value.length);
    if (![...categorySelect.options].some((option) => option.value === existing.category)) {
      const option = document.createElement("option");
      option.value = existing.category;
      option.textContent = existing.category;
      categorySelect.append(option);
    }
    categorySelect.value = existing.category;
    setPoint({ lat: existing.lat, lng: existing.lng });
    map?.setView([existing.lat, existing.lng], 16);
    if (!map)
      feedback.textContent =
        "O mapa não carregou. Você pode salvar as alterações mantendo o ponto atual.";
  } else {
    const requestedCategory = params.get("categoria");
    if (
      requestedCategory &&
      [...categorySelect.options].some((option) => option.value === requestedCategory)
    )
      categorySelect.value = requestedCategory;
  }
  description?.addEventListener("input", () => {
    if (descriptionCount) descriptionCount.textContent = String(description.value.length);
  });
  useLocation?.addEventListener("click", () => {
    if (!map) return;
    if (!navigator.geolocation) {
      feedback.textContent =
        "A geolocalização não está disponível neste dispositivo. Selecione um ponto no mapa.";
      feedback.className = "form-feedback is-error";
      return;
    }
    useLocation.disabled = true;
    useLocation.setAttribute("aria-busy", "true");
    feedback.textContent = "Buscando sua localização…";
    feedback.className = "form-feedback";
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const point = L.latLng(position.coords.latitude, position.coords.longitude);
        map.setView(point, 16);
        setPoint(point);
        feedback.textContent = "Localização selecionada. Confira o ponto no mapa antes de salvar.";
        useLocation.disabled = false;
        useLocation.removeAttribute("aria-busy");
      },
      () => {
        feedback.textContent =
          "Não foi possível acessar sua localização. Confira as permissões do dispositivo ou marque o ponto no mapa.";
        feedback.className = "form-feedback is-error";
        useLocation.disabled = false;
        useLocation.removeAttribute("aria-busy");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (saved || !form.reportValidity()) return;
    if (!latitudeInput.value || !longitudeInput.value) {
      feedback.textContent = map
        ? "Selecione um ponto no mapa antes de salvar."
        : "O mapa não carregou. Recarregue a página para marcar a localização.";
      feedback.className = "form-feedback is-error";
      coordinates.setAttribute("tabindex", "-1");
      coordinates.focus();
      return;
    }
    const formData = new FormData(form);
    const fields = {
      title: String(formData.get("title") || "").trim(),
      category: String(formData.get("category") || "Outro"),
      address: String(formData.get("address") || "").trim(),
      description: String(formData.get("description") || "").trim(),
      lat: Number(formData.get("latitude")),
      lng: Number(formData.get("longitude")),
    };
    if (!fields.title || !fields.description) {
      feedback.textContent = "Preencha o título e a descrição da ocorrência.";
      feedback.className = "form-feedback is-error";
      document.getElementById(fields.title ? "description" : "title").focus();
      return;
    }
    submitButton.disabled = true;
    const result = await (isEditing ? data.updateReport(editId, fields) : data.saveReport(fields));
    if (!result.ok) {
      const messages = {
        missing:
          "Esta ocorrência não está mais disponível. Volte ao mapa para consultar os registros.",
        auth: "Sua sessão expirou. Entre novamente para continuar.",
        server: result.message || "Não foi possível salvar a ocorrência no banco de dados.",
      };
      feedback.textContent =
        messages[result.reason] || result.message || "Não foi possível salvar a ocorrência.";
      feedback.className = "form-feedback is-error";
      submitButton.disabled = false;
      return;
    }
    saved = true;
    feedback.textContent = isEditing
      ? "Alterações salvas no banco de dados. Abrindo a ocorrência no mapa…"
      : "Registro salvo no banco de dados. Abrindo o mapa…";
    feedback.className = "form-feedback is-success";
    const destination = new URLSearchParams({ [isEditing ? "editado" : "novo"]: result.report.id });
    window.setTimeout(() => {
      window.location.href = `mapa.html?${destination}`;
    }, 700);
  });
});
