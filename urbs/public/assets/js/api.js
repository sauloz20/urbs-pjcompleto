(() => {
  "use strict";

  const apiBase = new URL("../backend/public/api/", document.baseURI);

  async function request(path, options = {}) {
    const headers = new Headers(options.headers || {});
    const init = {
      method: options.method || "GET",
      credentials: "same-origin",
      headers,
    };

    if (options.body !== undefined) {
      headers.set("Content-Type", "application/json; charset=utf-8");
      init.body = JSON.stringify(options.body);
    }

    let response;
    try {
      response = await fetch(new URL(path, apiBase), init);
    } catch (error) {
      throw new Error("Não foi possível conectar ao backend. Confira se o Apache e o MySQL estão ativos no XAMPP.");
    }

    let payload;
    try {
      payload = await response.json();
    } catch (error) {
      throw new Error("O backend retornou uma resposta inválida.");
    }

    if (!response.ok || payload.success === false) {
      const error = new Error(payload.message || "Não foi possível concluir a solicitação.");
      error.status = response.status;
      error.payload = payload;
      throw error;
    }

    return payload;
  }

  window.UrbsAPI = Object.freeze({
    base: apiBase,
    request,
    session: () => request("auth/session.php"),
    logout: () => request("auth/logout.php", { method: "POST" }),
  });
})();
