/** URBS — configuração opcional de imagens/terreno 3D.
 * Mantendo as chaves vazias, usa CesiumJS + imagem de satélite Esri, com fallback de ruas.
 * Uma API key usada no navegador é pública: RESTRINJA por domínio e API no provedor.
 * Nunca coloque credenciais secretas ou tokens de servidor neste arquivo.
 * Google Photorealistic requer faturamento habilitado e cumprimento das atribuições.
 */
window.URBS_GEO_CONFIG = Object.freeze({
    googleMapsApiKey: '', // Opcional: Map Tiles API / Photorealistic 3D Tiles
    cesiumIonToken: '', // Opcional: Cesium World Terrain
    flightDurationSeconds: 6, // V8: duração do movimento de câmera, em segundos
    destination: { longitude: -43.8578, latitude: -16.7286, label: 'Montes Claros, MG' }
});
