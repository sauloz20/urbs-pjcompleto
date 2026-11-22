// 1. Inicializar o mapa (centralizado em Montes Claros - MG)
const map = L.map("map").setView([-16.7286, -43.8582], 13);

// 2. Adicionar a camada visual do OpenStreetMap
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
}).addTo(map);

// 3. Função para buscar os dados na nossa API PHP
async function carregarOcorrencias() {
  try {
    // ATENÇÃO: Ajuste esta URL de acordo com o nome da sua pasta no XAMPP!
    // Exemplo: http://localhost/Urbs/backend/public/api/occurrences/list.php
    const response = await fetch(
      "http://localhost/TCC-Project-main/backend/public/api/occurrences/list.php",
    );
    const result = await response.json();

    if (result.success) {
      const ocorrencias = result.data;

      // 4. Percorrer o array de ocorrências e criar os marcadores
      ocorrencias.forEach((ocorrencia) => {
        const lat = parseFloat(ocorrencia.latitude);
        const lng = parseFloat(ocorrencia.longitude);

        // Criar o marcador no mapa
        const marker = L.marker([lat, lng]).addTo(map);

        // Montar o conteúdo do balãozinho (Popup)
        const popupContent = `
                            <div style="min-width: 200px;">
                                <h3 style="margin: 0 0 8px 0; font-size: 16px; color: #1f2937;">${ocorrencia.title}</h3>
                                <p style="margin: 0 0 8px 0; font-size: 13px; color: #4b5563;">${ocorrencia.description}</p>
                                <p style="margin: 0 0 8px 0; font-size: 12px; color: #6b7280;">
                                    <strong>Categoria:</strong> ${ocorrencia.category_name} <br>
                                    <strong>Registrado por:</strong> ${ocorrencia.user_name}
                                </p>
                                <span class="status-badge status-${ocorrencia.status}">
                                    ${ocorrencia.status.toUpperCase()}
                                </span>
                            </div>
                        `;

        // Vincular o popup ao marcador
        marker.bindPopup(popupContent, { className: "urbs-popup" });
      });
    } else {
      console.error("Erro na API:", result.message);
    }
  } catch (error) {
    console.error("Erro ao conectar com o backend:", error);
  }
}

// Executar a função assim que a página carregar
carregarOcorrencias();
