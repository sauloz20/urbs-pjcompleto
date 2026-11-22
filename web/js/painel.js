// Ajuste este caminho base (URL) conforme o nome da sua pasta no XAMPP!
const BASE_URL = "http://localhost/TCC-Project-main/backend/public/api";

// Função de Login
async function logar() {
  const email = document.getElementById("loginEmail").value;
  const password = document.getElementById("loginSenha").value;

  const res = await fetch(`${BASE_URL}/auth/login.php`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();

  if (data.success) {
    document.getElementById("msgLogin").innerText = "Login realizado! O navegador salvou a sessão.";
    // Libera a área de criar ocorrência
    document.getElementById("areaOcorrencia").style.opacity = "1";
    document.getElementById("areaOcorrencia").style.pointerEvents = "auto";
  } else {
    alert("Erro: " + data.message);
  }
}

// Função para Registrar Ocorrência
async function criarOcorrencia() {
  const payload = {
    title: document.getElementById("titulo").value,
    description: document.getElementById("descricao").value,
    category_id: parseInt(document.getElementById("categoria").value),
    latitude: parseFloat(document.getElementById("lat").value),
    longitude: parseFloat(document.getElementById("lng").value),
  };

  const res = await fetch(`${BASE_URL}/occurrences/create.php`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();

  if (data.success) {
    document.getElementById("msgOcorrencia").innerText = "Salvo com sucesso no banco!";
  } else {
    alert("Erro: " + data.message);
  }
}
