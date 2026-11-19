/* URBS — aproximação geográfica de Montes Claros com CesiumJS e GSAP. */
(() => {
  'use strict';

  const C = window.Cesium;
  const gsap = window.gsap;
  const config = window.URBS_GEO_CONFIG || {};
  const destination = config.destination || { longitude: -43.8578, latitude: -16.7286, label: 'Montes Claros, MG' };
  const root = document.getElementById('geo-flight');
  const sceneHost = document.getElementById('cesium-flight');
  const details = root.querySelector('.geo-details');
  const phase = document.getElementById('geo-phase');
  const place = document.getElementById('geo-place');
  const progress = document.getElementById('geo-progress-bar');
  const status = document.querySelector('.screen-reader-status');
  const route = [
    { t: 0, lon: -24, lat: 0, height: 18800000 },
    { t: .27, lon: -46, lat: -13, height: 8600000 },
    { t: .50, lon: -50, lat: -15, height: 3200000 },
    { t: .72, lon: -45.4, lat: -17.9, height: 520000 },
    { t: .89, lon: -43.96, lat: -16.92, height: 61000 },
    { t: 1, lon: destination.longitude, lat: destination.latitude, height: 10500 }
  ];
  const chapters = [
    { at: .14, name: 'América do Sul' },
    { at: .37, name: 'Brasil' },
    { at: .64, name: 'Minas Gerais' },
    { at: .88, name: destination.label.split(',')[0], caption: 'ÁREA PILOTO · MINAS GERAIS' }
  ];
  const wait = ms => new Promise(resolve => window.setTimeout(resolve, ms));

  let viewer;
  let running = false;
  let ended = false;
  let journey;
  let caption;
  let stopWaitingForTiles;
  let hasSatellite = false;
  let hasPhotorealisticTiles = false;

  function sample(values, u) {
    let index = 0;
    while (index < route.length - 2 && u > route[index + 1].t) {
      index++;
    }

    const duration = route[index + 1].t - route[index].t;
    const q = (u - route[index].t) / duration;
    const slope = i => (values[i + 1] - values[i]) / (route[i + 1].t - route[i].t);
    const tangent = i => {
      if (i === 0) return slope(0);
      if (i === route.length - 1) return slope(i - 1);
      const before = slope(i - 1);
      const after = slope(i);
      return before * after > 0 ? 2 * before * after / (before + after) : 0;
    };

    return (2 * q ** 3 - 3 * q ** 2 + 1) * values[index]
      + (q ** 3 - 2 * q ** 2 + q) * duration * tangent(index)
      + (-2 * q ** 3 + 3 * q ** 2) * values[index + 1]
      + (q ** 3 - q ** 2) * duration * tangent(index + 1);
  }

  const longitudes = route.map(point => point.lon);
  const latitudes = route.map(point => point.lat);
  const logHeights = route.map(point => Math.log(point.height));

  function positionCamera(u) {
    const tilt = Math.max(0, (u - .76) / .24);
    viewer.camera.setView({
      destination: C.Cartesian3.fromDegrees(
        sample(longitudes, u),
        sample(latitudes, u),
        Math.exp(sample(logHeights, u))
      ),
      orientation: { heading: 0, pitch: -C.Math.PI_OVER_TWO + .13 * tilt ** 2, roll: 0 }
    });
  }

  function finish() {
    if (ended) return;
    ended = true;
    try {
      sessionStorage.setItem('urbs-home-arrival-v9', String(Date.now()));
    } catch (_) { }
    window.location.assign('index.html');
  }

  function setCaption(name, label) {
    place.textContent = name;
    phase.textContent = label;
  }

  function changeChapter(chapter) {
    caption?.kill();
    caption = gsap.timeline()
      .to(details, { opacity: 0, y: -5, duration: .13, ease: 'power1.in' })
      .call(() => setCaption(chapter.name, chapter.caption || 'DO ESPAÇO À CIDADE'))
      .set(details, { y: 8 })
      .to(details, { opacity: 1, y: 0, duration: .31, ease: 'power2.out' });
  }

  async function prepareImagery() {
    const local = C.SingleTileImageryProvider.fromUrl('assets/textures/earth-day.jpg', {
      credit: 'NASA / Earth Observatory · Blue Marble'
    })
      .then(provider => {
        if (ended || hasPhotorealisticTiles) return false;
        viewer.imageryLayers.addImageryProvider(provider, 0);
        return true;
      })
      .catch(() => false);

    const satellite = C.ArcGisMapServerImageryProvider.fromUrl(
      'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer',
      { enablePickFeatures: false }
    ).then(provider => {
      if (ended || hasPhotorealisticTiles) return false;
      viewer.imageryLayers.addImageryProvider(provider);
      hasSatellite = true;
      return true;
    }).catch(async () => {
      if (await local) return false;
      if (ended || hasPhotorealisticTiles) return false;
      const provider = new C.OpenStreetMapImageryProvider({ url: 'https://tile.openstreetmap.org/' });
      viewer.imageryLayers.addImageryProvider(provider);
      return true;
    }).catch(() => false);

    // Prepara dados opcionais em paralelo com as imagens da superfície.
    if (config.cesiumIonToken) {
      C.Ion.defaultAccessToken = config.cesiumIonToken;
      C.createWorldTerrainAsync().then(terrain => {
        if (!ended) viewer.terrainProvider = terrain;
      }).catch(() => {});
    }

    if (config.googleMapsApiKey) {
      const tileUrl = 'https://tile.googleapis.com/v1/3dtiles/root.json?key=' + encodeURIComponent(config.googleMapsApiKey);
      C.Cesium3DTileset.fromUrl(tileUrl, { showCreditsOnScreen: true, maximumScreenSpaceError: 16 })
        .then(tileset => {
          if (ended) {
            tileset.destroy();
            return;
          }
          viewer.scene.primitives.add(tileset);
          viewer.scene.globe.show = false;
          hasPhotorealisticTiles = true;
        }).catch(() => {});
    }

    await Promise.race([satellite, wait(1000)]);
    if (ended || hasSatellite || hasPhotorealisticTiles) return;
    if (!await Promise.race([local, wait(500)]) && viewer.imageryLayers.length === 0) {
      throw new Error('Imagem geográfica indisponível.');
    }
  }

  function waitForInitialTiles() {
    return new Promise(resolve => {
      let renderedFrames = 0;
      function done() {
        window.clearTimeout(timeout);
        removeListener();
        stopWaitingForTiles = undefined;
        resolve();
      }
      const removeListener = viewer.scene.postRender.addEventListener(() => {
        renderedFrames++;
        if (renderedFrames >= 2 && (viewer.scene.globe.tilesLoaded || hasPhotorealisticTiles)) {
          done();
        }
      });
      const timeout = window.setTimeout(done, 850);
      stopWaitingForTiles = done;
    });
  }

  function runJourney() {
    const duration = Math.max(4, Number(config.flightDurationSeconds) || 6);
    const customEase = window.CustomEase;
    let cameraEase = 'sine.inOut';
    if (customEase) {
      gsap.registerPlugin(customEase);
      cameraEase = customEase.create(
        'urbs-orbital',
        'M0,0 C.09,0 .18,.09 .28,.27 C.37,.432 .42,.555 .51,.62 C.61,.692 .67,.728 .76,.795 C.87,.877 .90,1 1,1'
      );
    }
    const camera = { position: 0 };
    let nextChapter = 0;
    journey = gsap.timeline({ onComplete: finish });
    journey
      .to(sceneHost, { opacity: 1, duration: .7, ease: 'power2.out' })
      .to(camera, {
        position: 1,
        duration,
        ease: cameraEase,
        onUpdate() {
          positionCamera(camera.position);
          let chapter;
          while (nextChapter < chapters.length && camera.position >= chapters[nextChapter].at) {
            chapter = chapters[nextChapter++];
          }
          if (chapter) changeChapter(chapter);
        }
      }, .15)
      .to(progress, { scaleX: 1, duration, ease: 'none' }, .15)
      .call(() => {
        status.textContent = 'Chegada a ' + destination.label + '.';
      })
      .addLabel('arrival', '+=.28')
      .to(root, { '--geo-dissolve': 1, duration: .42, ease: 'sine.in' }, 'arrival');
  }

  async function start() {
    if (running) return;
    running = true;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      finish();
      return;
    }

    root.classList.add('geo-active');
    root.setAttribute('aria-hidden', 'false');
    document.querySelectorAll('.form-side').forEach(form => { form.inert = true; });
    status.textContent = 'Aproximação geográfica de ' + destination.label + '.';

    try {
      if (!C || !gsap) throw new Error('Bibliotecas da abertura indisponíveis.');
      const touchDevice = window.matchMedia('(pointer: coarse)').matches;
      viewer = new C.Viewer(sceneHost, {
        animation: false, timeline: false, fullscreenButton: false, homeButton: false,
        navigationHelpButton: false, sceneModePicker: false, baseLayerPicker: false,
        geocoder: false, infoBox: false, selectionIndicator: false, baseLayer: false,
        terrainProvider: new C.EllipsoidTerrainProvider(),
        useBrowserRecommendedResolution: false,
        msaaSamples: touchDevice ? 2 : 4
      });
      const framePixels = window.innerWidth * window.innerHeight;
      const ratio = window.devicePixelRatio || 1;
      const pixelBudget = touchDevice ? 2800000 : 4500000;
      const maxRatio = touchDevice ? 1.5 : 1.8;
      viewer.resolutionScale = Math.min(1, maxRatio / ratio, Math.sqrt(pixelBudget / framePixels) / ratio);
      viewer.scene.globe.enableLighting = false;
      viewer.scene.globe.maximumScreenSpaceError = touchDevice ? 1.8 : 1.45;
      viewer.scene.screenSpaceCameraController.enableInputs = false;
      positionCamera(0);
      await prepareImagery();
      if (ended) return;
      await waitForInitialTiles();
      if (!ended) runJourney();
    } catch (error) {
      if (ended) return;
      console.warn('URBS: abertura geográfica indisponível:', error);
      setCaption(destination.label.split(',')[0], 'ÁREA PILOTO · MINAS GERAIS');
      await wait(650);
      finish();
    }
  }

  window.URBSGeoDescent = { start };
  window.addEventListener('pagehide', () => {
    if (!running) return;
    ended = true;
    stopWaitingForTiles?.();
    journey?.kill();
    caption?.kill();
    viewer?.destroy();
  });
  window.addEventListener('pageshow', event => {
    if (event.persisted && running) window.location.reload();
  });
})();
