(() => {
  "use strict";

  const STATUSES = ["Novo", "Em análise", "Em andamento", "Solucionado", "Rejeitado"];
  const STATUS_TO_API = {
    Novo: "pending",
    "Em análise": "in_analysis",
    "Em andamento": "in_progress",
    Solucionado: "resolved",
    Rejeitado: "rejected",
  };
  const STATUS_FROM_API = Object.fromEntries(
    Object.entries(STATUS_TO_API).map(([label, value]) => [value, label]),
  );
  const DEMO_REPORTS = [
    {
      id: "demo-pavimento",
      title: "Pavimentação — exemplo",
      category: "Pavimentação",
      address: "Área central · ponto demonstrativo",
      description: "Registro fictício usado apenas para apresentar o mapa.",
      lat: -16.7248,
      lng: -43.8631,
      status: "Em análise",
      createdAt: "2026-11-10T12:00:00.000Z",
      demo: true,
    },
    {
      id: "demo-iluminacao",
      title: "Iluminação pública — exemplo",
      category: "Iluminação pública",
      address: "Setor urbano · ponto demonstrativo",
      description: "Exemplo fictício. Não representa uma ocorrência real.",
      lat: -16.7315,
      lng: -43.8483,
      status: "Em andamento",
      createdAt: "2026-11-08T12:00:00.000Z",
      demo: true,
    },
    {
      id: "demo-acessibilidade",
      title: "Calçada e acessibilidade — exemplo",
      category: "Acessibilidade",
      address: "Setor urbano · ponto demonstrativo",
      description: "Ponto ilustrativo para mostrar categoria e acompanhamento.",
      lat: -16.7169,
      lng: -43.8736,
      status: "Novo",
      createdAt: "2026-11-06T12:00:00.000Z",
      demo: true,
    },
    {
      id: "demo-residuos",
      title: "Descarte de resíduos — exemplo",
      category: "Descarte irregular de resíduos",
      address: "Setor urbano · ponto demonstrativo",
      description: "Ponto ilustrativo; os dados não correspondem a um chamado real.",
      lat: -16.7392,
      lng: -43.8674,
      status: "Solucionado",
      createdAt: "2026-11-03T12:00:00.000Z",
      demo: true,
    },
    {
      id: "demo-drenagem",
      title: "Drenagem urbana — exemplo",
      category: "Drenagem",
      address: "Setor urbano · ponto demonstrativo",
      description: "Exemplo de demonstração para filtros e marcadores.",
      lat: -16.7203,
      lng: -43.8408,
      status: "Novo",
      createdAt: "2026-10-30T12:00:00.000Z",
      demo: true,
    },
  ];

  let currentUser = null;
  let reports = [];
  let categories = [];

  function fromApi(row) {
    return {
      id: String(row.id),
      userId: Number(row.user_id),
      title: String(row.title || "Ocorrência sem título"),
      category: String(row.category_name || "Outro"),
      address: String(row.address || ""),
      description: String(row.description || ""),
      lat: Number(row.latitude),
      lng: Number(row.longitude),
      status: STATUS_FROM_API[row.status] || "Novo",
      createdAt: row.created_at || new Date().toISOString(),
      demo: false,
    };
  }

  async function loadOccurrences() {
    const result = await window.UrbsAPI.request("occurrences/list.php");
    reports = (result.data || []).map(fromApi);
    return reports;
  }

  async function load() {
    try {
      const session = await window.UrbsAPI.session();
      currentUser = session.authenticated ? session.user : null;
      if (!currentUser) {
        reports = [];
        return { user: null, error: null };
      }
      const [categoryResult] = await Promise.all([
        window.UrbsAPI.request("categories/list.php"),
        loadOccurrences(),
      ]);
      categories = categoryResult.data || [];
      return { user: currentUser, error: null };
    } catch (error) {
      currentUser = null;
      reports = [];
      return { user: null, error };
    }
  }

  async function categoryIdFor(categoryName) {
    if (!categories.length) {
      const result = await window.UrbsAPI.request("categories/list.php");
      categories = result.data || [];
    }
    const category = categories.find((item) => item.name === categoryName);
    if (!category)
      throw new Error(
        "A categoria selecionada não está configurada no banco de dados. Importe database/urbs.sql.",
      );
    return Number(category.id);
  }

  function canEdit(report) {
    return Boolean(
      currentUser &&
        !report.demo &&
        (currentUser.role === "master" ||
          (Number(currentUser.id) === report.userId && report.status === "Novo")),
    );
  }

  function canManageStatus() {
    return Boolean(currentUser && ["resolver", "master"].includes(currentUser.role));
  }

  function getAllReports() {
    return [...DEMO_REPORTS, ...reports];
  }

  function getReport(id) {
    return reports.find((report) => report.id === String(id)) || null;
  }

  function getResultError(error) {
    return { ok: false, reason: error.status === 401 ? "auth" : "server", message: error.message };
  }

  async function saveReport(fields) {
    try {
      const category_id = await categoryIdFor(fields.category);
      const result = await window.UrbsAPI.request("occurrences/create.php", {
        method: "POST",
        body: {
          title: fields.title,
          description: fields.description,
          address: fields.address || "",
          category_id,
          latitude: fields.lat,
          longitude: fields.lng,
        },
      });
      await loadOccurrences();
      return {
        ok: true,
        report: getReport(result.occurrence_id) || { id: String(result.occurrence_id) },
      };
    } catch (error) {
      return getResultError(error);
    }
  }

  async function updateReport(id, fields) {
    try {
      const category_id = await categoryIdFor(fields.category);
      await window.UrbsAPI.request("occurrences/update.php", {
        method: "POST",
        body: {
          occurrence_id: Number(id),
          title: fields.title,
          description: fields.description,
          address: fields.address || "",
          category_id,
          latitude: fields.lat,
          longitude: fields.lng,
        },
      });
      await loadOccurrences();
      return { ok: true, report: getReport(id) };
    } catch (error) {
      return getResultError(error);
    }
  }

  async function deleteReport(id) {
    try {
      await window.UrbsAPI.request("occurrences/delete.php", {
        method: "POST",
        body: { occurrence_id: Number(id) },
      });
      await loadOccurrences();
      return { ok: true };
    } catch (error) {
      return getResultError(error);
    }
  }

  async function updateStatus(id, label) {
    try {
      const status = STATUS_TO_API[label];
      if (!status) throw new Error("A situação selecionada não é válida.");
      await window.UrbsAPI.request("occurrences/update_status.php", {
        method: "POST",
        body: { occurrence_id: Number(id), status },
      });
      await loadOccurrences();
      return { ok: true };
    } catch (error) {
      return getResultError(error);
    }
  }

  window.UrbsData = Object.freeze({
    STATUSES,
    DEMO_REPORTS,
    load,
    loadOccurrences,
    getAllReports,
    getReport,
    saveReport,
    updateReport,
    deleteReport,
    updateStatus,
    canEdit,
    canManageStatus,
    formatDate(value) {
      return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(new Date(value));
    },
    get currentUser() {
      return currentUser;
    },
  });
})();
