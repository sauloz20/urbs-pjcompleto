document.addEventListener("DOMContentLoaded", () => {
  const element = document.getElementById("home-map");
  if (!element || !window.L || !window.UrbsData) return;
  const center = [-16.7286, -43.8578];
  const colors = {
    Pavimentação: "#b77c43",
    "Iluminação pública": "#799e32",
    Acessibilidade: "#387f79",
    "Descarte irregular de resíduos": "#77619a",
    Drenagem: "#4f7ca3",
    Sinalização: "#bd7b4a",
    Outro: "#637269",
  };
  const map = L.map(element, {
    zoomControl: false,
    scrollWheelZoom: false,
    dragging: false,
    doubleClickZoom: false,
    keyboard: false,
    attributionControl: true,
  }).setView(center, 13);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(map);
  const markers = L.featureGroup().addTo(map);
  window.UrbsData.getAllReports().forEach((report) => {
    const marker = L.circleMarker([report.lat, report.lng], {
      radius: 7,
      color: "#0b1a14",
      weight: 2,
      fillColor: colors[report.category] || colors.Outro,
      fillOpacity: 0.95,
    });
    marker.addTo(markers);
  });
  if (markers.getBounds().isValid()) map.fitBounds(markers.getBounds().pad(0.22), { maxZoom: 13 });
  window.setTimeout(() => map.invalidateSize(), 120);
});
