/* URBS — Engine Orbital v4.1: Globo 3D + Scanner Óptico + Handoff para Satélite Real até as Ruas de Montes Claros */
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.158.0/build/three.module.js';

(() => {
  'use strict';

  const stage = document.getElementById('app');
  const canvas = document.getElementById('earth-canvas');
  if (!stage || !canvas) return;

  const gsap = window.gsap;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const loginSide = document.getElementById('login-side');
  const registerSide = document.getElementById('register-side');
  const backdropType = document.getElementById('backdrop-type');
  const backdropWord = document.getElementById('backdrop-mode-word');
  const toastEl = document.getElementById('auth-toast');
  const satStage = document.getElementById('sat-stage');
  const satLayer12 = document.getElementById('sat-layer-12');
  const satLayer14 = document.getElementById('sat-layer-14');
  const satLayer16 = document.getElementById('sat-layer-16');
  const diveVeil = document.getElementById('dive-veil');
  const diveHud = document.getElementById('dive-hud');
  const diveScanline = document.getElementById('dive-scanline');
  const diveBrackets = document.getElementById('dive-brackets');
  const diveReticle = document.getElementById('dive-reticle');
  const reticleLockTag = document.getElementById('reticle-lock-tag');
  const diveTopo = document.getElementById('dive-topo');
  const divePhase = document.getElementById('dive-phase');
  const diveTargetTitle = document.getElementById('dive-target-title');
  const diveZoom = document.getElementById('dive-zoom');
  const diveAlt = document.getElementById('dive-alt');
  const diveCoords = document.getElementById('dive-coords');
  const diveProgressFill = document.getElementById('dive-progress-fill');
  const cursorDepth = document.getElementById('cursor-depth');
  const hudLat = document.getElementById('hud-lat');
  const hudLon = document.getElementById('hud-lon');
  const focusMocBtn = document.getElementById('hud-focus-moc');
  const srStatus = document.getElementById('sr-status');

  const ROLE_LABELS = { citizen: 'Cidadão', resolver: 'Empresa', master: 'Master' };
  const ALLOWED_NEXT_PAGES = new Set(['mapa.html', 'registro.html', 'painel.html', 'index.html']);

  // Núcleo urbano central de Montes Claros (Av. Dep. Esteves Rodrigues / Praça Dr. Carlos)
  const MOC_LAT = -16.7248;
  const MOC_LON = -43.8631;

  const ARC_ORIGINS = [
    { lat: -19.9167, lon: -43.9345 }, // Belo Horizonte
    { lat: -15.7939, lon: -47.8828 }, // Brasília
    { lat: -12.9714, lon: -38.5014 }, // Salvador
    { lat: -23.5505, lon: -46.6333 }, // São Paulo
  ];

  let mode = 'login';
  let switching = false;
  let diving = false;
  let satTilesBuilt = false;

  // ================= DESTINO SEGURO (?next=) =================
  function parseSafeNext(rawNext) {
    if (!rawNext || typeof rawNext !== 'string') {
      return { url: 'mapa.html', page: 'mapa.html', category: '' };
    }
    const trimmed = rawNext.trim();
    const cleanPage = /^([a-z]+\.html)(?=[?#]|$)/i.exec(trimmed)?.[1].toLowerCase();
    if (!ALLOWED_NEXT_PAGES.has(cleanPage)) {
      return { url: 'mapa.html', page: 'mapa.html', category: '' };
    }

    const destination = new URL(trimmed, window.location.href);
    const category = (destination.searchParams.get('categoria') || '').trim();
    return { url: `${cleanPage}${destination.search}${destination.hash}`, page: cleanPage, category };
  }

  const params = new URLSearchParams(window.location.search);
  const nextDestination = parseSafeNext(params.get('next'));

  function renderDestinationWhisper() {
    const badge = document.getElementById('auth-dest-badge');
    const text = document.getElementById('auth-dest-text');
    if (!badge || !text || !params.get('next')) return;

    let label = '';
    if (nextDestination.page === 'registro.html') {
      label = nextDestination.category ? `Registro em ${nextDestination.category}` : 'Novo registro';
    } else if (nextDestination.page === 'mapa.html') {
      label = nextDestination.category ? `Mapa · ${nextDestination.category}` : 'Mapa interativo';
    } else if (nextDestination.page === 'painel.html') {
      label = 'Painel de gestão';
    }

    if (label) {
      text.textContent = label;
      badge.hidden = false;
    }
  }

  function buildRestrictedMessage(dest) {
    if (dest.page === 'registro.html') {
      return dest.category
        ? `Entre ou cadastre-se para registrar uma ocorrência em ${dest.category}.`
        : 'Entre ou cadastre-se para registrar uma nova ocorrência em Montes Claros.';
    }
    if (dest.page === 'mapa.html' && dest.category) {
      return `Entre ou cadastre-se para explorar ${dest.category} no mapa.`;
    }
    if (dest.page === 'painel.html') {
      return 'Faça login para acessar o painel de gestão do URBS.';
    }
    return 'Entre na sua conta ou cadastre-se para acessar o mapa e registrar ocorrências.';
  }

  // ================= MONTAGEM DE TILES REAIS DE SATÉLITE (MONTES CLAROS) =================
  function latLonToTileFloat(lat, lon, z) {
    const n = Math.pow(2, z);
    const x = ((lon + 180) / 360) * n;
    const rad = (lat * Math.PI) / 180;
    const y = ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n;
    return { x, y };
  }

  function buildSatelliteLayer(container, z) {
    if (!container) return;
    container.replaceChildren();

    const { x: xf, y: yf } = latLonToTileFloat(MOC_LAT, MOC_LON, z);
    const cx = Math.floor(xf);
    const cy = Math.floor(yf);
    const fx = xf - cx;
    const fy = yf - cy;

    // Grade 5x5 garante 1024x1024px úteis centrados exatamente em Montes Claros
    const half = 2;
    const tileSize = 256;
    const gridPx = (half * 2 + 1) * tileSize;
    const centerPxX = (half + fx) * tileSize;
    const centerPxY = (half + fy) * tileSize;

    const grid = document.createElement('div');
    grid.className = 'sat-tile-grid';
    grid.style.width = `${gridPx}px`;
    grid.style.height = `${gridPx}px`;
    grid.style.left = `calc(50% - ${centerPxX.toFixed(2)}px)`;
    grid.style.top = `calc(50% - ${centerPxY.toFixed(2)}px)`;

    for (let dy = -half; dy <= half; dy++) {
      for (let dx = -half; dx <= half; dx++) {
        const img = document.createElement('img');
        img.alt = '';
        img.decoding = 'async';
        img.loading = 'eager';
        img.style.left = `${(dx + half) * tileSize}px`;
        img.style.top = `${(dy + half) * tileSize}px`;
        img.src = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${cy + dy}/${cx + dx}`;
        img.onerror = () => { img.style.opacity = '0'; };
        grid.appendChild(img);
      }
    }

    container.appendChild(grid);
  }

  function preloadMontesClarosSatellite() {
    if (satTilesBuilt || reduced || !satStage) return;
    satTilesBuilt = true;
    buildSatelliteLayer(satLayer12, 12);
    buildSatelliteLayer(satLayer14, 14);
    buildSatelliteLayer(satLayer16, 16);
  }

  // ================= TOAST, CONTAS RECENTES & FORÇA DA SENHA =================
  function showToast(message) {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.hidden = false;
    window.clearTimeout(toastEl._timer);
    toastEl._timer = window.setTimeout(() => {
      toastEl.hidden = true;
    }, 4500);
  }

  function getSavedAccounts() {
    try {
      return JSON.parse(localStorage.getItem('urbs:saved_accounts') || '[]');
    } catch (_) {
      return [];
    }
  }

  function saveAccount(user, emailUsed) {
    if (!user || !user.id) return;
    try {
      const list = getSavedAccounts();
      const entry = {
        id: Number(user.id),
        name: user.name || 'Usuário',
        email: emailUsed || user.email || '',
        role: user.role || 'citizen',
        company_name: user.company_name || null
      };
      const idx = list.findIndex((i) => i.id === entry.id || (entry.email && i.email === entry.email));
      if (idx >= 0) list[idx] = entry;
      else list.unshift(entry);
      localStorage.setItem('urbs:saved_accounts', JSON.stringify(list.slice(0, 4)));
    } catch (_) {}
  }

  function removeSavedAccount(emailToRemove) {
    try {
      const filtered = getSavedAccounts().filter((a) => a.email !== emailToRemove);
      localStorage.setItem('urbs:saved_accounts', JSON.stringify(filtered));
      renderSavedAccounts();
    } catch (_) {}
  }

  function renderSavedAccounts() {
    const box = document.getElementById('saved-accounts');
    const listEl = document.getElementById('saved-accounts-list');
    if (!box || !listEl) return;

    const accounts = getSavedAccounts();
    if (!accounts.length) {
      box.hidden = true;
      return;
    }

    box.hidden = false;
    listEl.replaceChildren();

    accounts.slice(0, 3).forEach((acc, idx) => {
      const row = document.createElement('div');
      row.className = 'saved-row';

      const pick = document.createElement('button');
      pick.type = 'button';
      pick.className = 'saved-row__pick';
      const first = (acc.name || 'Conta').split(' ')[0];
      const tag = acc.role === 'resolver' && acc.company_name ? acc.company_name : (ROLE_LABELS[acc.role] || acc.role);
      pick.title = acc.email;
      pick.innerHTML = `
        <span class="saved-row__num">${String(idx + 1).padStart(2, '0')}</span>
        <span class="saved-row__name"></span>
        <span class="saved-row__role"></span>
      `;
      pick.querySelector('.saved-row__name').textContent = first;
      pick.querySelector('.saved-row__role').textContent = tag;
      pick.addEventListener('click', () => {
        const emailInput = document.getElementById('login-email');
        const passInput = document.getElementById('login-password');
        if (emailInput) {
          emailInput.value = acc.email || '';
          emailInput.closest('[data-field]')?.classList.add('is-filled');
        }
        if (passInput) {
          passInput.value = '';
          passInput.focus();
        }
        pulseAtmosphere('lime', 0.45);
        triggerLidarScan(MOC_LAT, MOC_LON, 0.55, 1.3);
        showToast(`Conta ${first} selecionada. Digite sua senha para entrar.`);
      });

      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'saved-row__del';
      del.setAttribute('aria-label', `Remover conta recente ${first}`);
      del.textContent = '×';
      del.addEventListener('click', () => removeSavedAccount(acc.email));

      row.append(pick, del);
      listEl.append(row);
    });
  }

  function initPasswordMeter() {
    const passInput = document.getElementById('register-password');
    const confirmInput = document.getElementById('register-confirm');
    const meter = document.getElementById('pass-strength');
    const strengthLabel = document.getElementById('pass-strength-label');
    const matchHint = document.getElementById('pass-match-hint');
    if (!passInput || !meter) return;

    const LEVELS = [
      { text: 'MUITO CURTA', level: 1 },
      { text: 'FRACA · USE NÚMEROS OU MAIÚSCULAS', level: 1 },
      { text: 'MÉDIA', level: 2 },
      { text: 'BOA SENHA', level: 3 },
      { text: 'FORTE', level: 4 }
    ];

    const evaluate = () => {
      const val = passInput.value;
      const conf = confirmInput ? confirmInput.value : '';
      if (!val && !conf) {
        meter.hidden = true;
        return;
      }
      meter.hidden = false;

      let score = 0;
      if (val.length >= 8) score += 1;
      if (val.length >= 10) score += 1;
      if (/[A-Z]/.test(val) && /[a-z]/.test(val)) score += 1;
      if (/[0-9]/.test(val) || /[^A-Za-z0-9]/.test(val)) score += 1;

      const info = val.length < 8 ? LEVELS[0] : LEVELS[Math.min(4, score)];
      meter.dataset.level = String(info.level);
      if (strengthLabel) strengthLabel.textContent = info.text;

      if (matchHint) {
        if (!conf) {
          matchHint.textContent = '';
          matchHint.className = '';
        } else if (val === conf) {
          matchHint.textContent = 'CONFERE ✓';
          matchHint.className = 'is-ok';
        } else {
          matchHint.textContent = 'DIFERENTES';
          matchHint.className = 'is-bad';
        }
      }
    };

    passInput.addEventListener('input', evaluate);
    confirmInput?.addEventListener('input', evaluate);
  }

  // ================= ENGINE 3D PLANETÁRIA (V4.1) =================
  let scene, camera, renderer;
  let skyMat, starMat, starPoints;
  let earthGroup, earthMesh, earthMat, cloudsMesh, cloudsMat, atmosMat, outerHaloMat;
  let graticuleMat, beaconGroup, orbitRig, satelliteMesh;
  let arcPulses = [];
  let raycaster, mouseNDC;

  let autoRotate = true;
  let isDragging = false;
  let prevMouse = { x: 0, y: 0 };
  let velocity = { x: 0, y: 0 };
  let parallax = { x: 0, y: 0 };
  let smoothSunTarget = new THREE.Vector3(0.76, 0.24, 0.58).normalize();
  let currentSun = new THREE.Vector3(0.76, 0.24, 0.58).normalize();
  let isHoveringEarth = false;
  let lastHudTick = 0;
  let lockCoordsToMoc = false;

  const pulseState = { intensity: 0, color: new THREE.Color(0xc7f36b) };
  const scanState = { radius: 0, intensity: 0 };
  const graticuleState = { opacity: 0.055 };

  const isDesktop = () => window.innerWidth > 900;
  const getLayoutMetrics = () => {
    const w = window.innerWidth;
    const h = Math.max(window.innerHeight, 1);
    const aspect = w / h;

    if (!isDesktop()) {
      return {
        x: 0,
        y: aspect < 0.65 ? 1.05 : 0.85,
        z: aspect < 0.6 ? 6.5 : 5.8
      };
    }

    const z = w < 1160 ? 4.95 : w < 1400 ? 4.55 : 4.32;
    const x = Math.max(0.95, Math.min(1.36, aspect * 0.68));
    return { x, y: 0, z };
  };

  function latLonToVec3(lat, lon, radius) {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lon + 180) * (Math.PI / 180);
    return new THREE.Vector3(
      -(radius * Math.sin(phi) * Math.cos(theta)),
      radius * Math.cos(phi),
      radius * Math.sin(phi) * Math.sin(theta)
    );
  }

  function vec3ToLatLon(v) {
    const clampedY = Math.max(-1, Math.min(1, v.y));
    const lat = 90 - Math.acos(clampedY) * (180 / Math.PI);
    let lon = Math.atan2(v.z, -v.x) * (180 / Math.PI) - 180;
    if (lon < -180) lon += 360;
    if (lon > 180) lon -= 360;
    return { lat, lon };
  }

  function formatCoord(value, posHem, negHem) {
    const abs = Math.abs(value);
    const deg = Math.floor(abs);
    const min = Math.floor((abs - deg) * 60);
    return `${String(deg).padStart(2, '0')}°${String(min).padStart(2, '0')}′ ${value >= 0 ? posHem : negHem}`;
  }

  function getRotationForLatLon(lat, lon) {
    const vec = latLonToVec3(lat, lon, 1);
    const targetRotY = -Math.atan2(vec.x, vec.z);
    const targetRotX = Math.atan2(vec.y, Math.hypot(vec.x, vec.z));
    return { x: targetRotX, y: targetRotY };
  }

  function shortestTargetY(currentY, targetY) {
    const twoPi = Math.PI * 2;
    let delta = ((targetY - currentY) % twoPi + twoPi) % twoPi;
    if (delta > Math.PI) delta -= twoPi;
    return currentY + delta;
  }

  function pulseAtmosphere(kind = 'lime', peak = 0.6) {
    if (!atmosMat) return;
    pulseState.color.set(kind === 'error' ? 0xfb7185 : 0xc7f36b);
    atmosMat.uniforms.uPulseColor.value.copy(pulseState.color);

    if (gsap && !reduced) {
      gsap.killTweensOf(pulseState, 'intensity');
      gsap.fromTo(
        pulseState,
        { intensity: 0 },
        {
          intensity: peak,
          duration: 0.24,
          ease: 'power2.out',
          onComplete: () => gsap.to(pulseState, { intensity: 0, duration: 0.9, ease: 'power2.out' })
        }
      );

      if (kind === 'error' && earthGroup && !diving && !switching) {
        const base = earthGroup.position.x;
        gsap.fromTo(
          earthGroup.position,
          { x: base },
          {
            x: base + 0.055,
            duration: 0.07,
            yoyo: true,
            repeat: 3,
            ease: 'power1.inOut',
            onComplete: () => { earthGroup.position.x = base; }
          }
        );
      }
    }
  }

  function triggerLidarScan(lat, lon, strength = 0.9, duration = 1.35, maxRadius = 1.35) {
    if (!earthMat || reduced || !gsap) return;
    earthMat.uniforms.uScanOrigin.value.copy(latLonToVec3(lat, lon, 1).normalize());
    gsap.killTweensOf(scanState);
    scanState.radius = 0.008;
    scanState.intensity = strength;
    gsap.to(scanState, { radius: maxRadius, duration, ease: 'power2.out' });
    gsap.to(scanState, { intensity: 0, duration: duration * 0.9, delay: duration * 0.14, ease: 'power2.in' });
  }

  function createDeepSpaceDome() {
    const geo = new THREE.SphereGeometry(92, 48, 32);
    skyMat = new THREE.ShaderMaterial({
      uniforms: {
        uSunDir: { value: currentSun.clone() },
        uTime: { value: 0 },
        uDiveProgress: { value: 0 }
      },
      vertexShader: `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uSunDir;
        uniform float uTime;
        uniform float uDiveProgress;
        varying vec3 vDir;

        float hash(vec3 p) {
          p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
          p *= 17.0;
          return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
        }

        float noise(vec3 x) {
          vec3 i = floor(x);
          vec3 f = fract(x);
          f = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x),
                mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
            mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
                mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y),
            f.z
          );
        }

        float fbm(vec3 p) {
          float v = 0.0;
          float a = 0.5;
          for (int i = 0; i < 4; i++) {
            v += a * noise(p);
            p = p * 2.04 + vec3(1.7, 9.2, 4.3);
            a *= 0.5;
          }
          return v;
        }

        void main() {
          vec3 d = normalize(vDir);
          float plane = abs(dot(d, normalize(vec3(0.28, 0.88, -0.38))));
          float galaxyBand = exp(-plane * plane * 9.5);

          float n1 = fbm(d * 3.4 + vec3(uTime * 0.008, 0.0, 0.0));
          float n2 = fbm(d * 7.2 - vec3(0.0, uTime * 0.005, 0.0));
          float dust = smoothstep(0.36, 0.82, n1 * 0.72 + n2 * 0.28);

          vec3 voidCol = vec3(0.005, 0.012, 0.010);
          vec3 nebulaDeep = vec3(0.016, 0.062, 0.048);
          vec3 nebulaIce = vec3(0.025, 0.072, 0.125);
          vec3 nebulaLime = vec3(0.09, 0.19, 0.07);

          vec3 col = voidCol;
          col += nebulaDeep * galaxyBand * dust * 0.82;
          col += nebulaIce * galaxyBand * smoothstep(0.45, 0.9, n2) * 0.38;
          col += nebulaLime * smoothstep(0.64, 0.96, n1 * n2 * 1.45) * 0.18;

          float sunAlign = max(dot(d, normalize(uSunDir)), 0.0);
          col += vec3(0.35, 0.62, 0.92) * pow(sunAlign, 18.0) * 0.12;
          col += vec3(0.75, 0.94, 0.48) * pow(sunAlign, 72.0) * 0.14;

          float alpha = clamp(0.56 + galaxyBand * dust * 0.26 + uDiveProgress * 0.4, 0.0, 0.96);
          gl_FragColor = vec4(col, alpha);
        }
      `,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false
    });

    scene.add(new THREE.Mesh(geo, skyMat));
  }

  function createTwinklingStarfield() {
    const count = isDesktop() ? 2200 : 1100;
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const phases = new Float32Array(count);
    const colors = new Float32Array(count * 3);

    const palette = [
      new THREE.Color(0xdbeafe),
      new THREE.Color(0xf8fafc),
      new THREE.Color(0xe2f7e4),
      new THREE.Color(0xfef3c7),
      new THREE.Color(0xc7f36b),
    ];

    for (let i = 0; i < count; i++) {
      const r = 18 + Math.random() * 62;
      const u = Math.random();
      const v = Math.random();
      const theta = 2 * Math.PI * u;
      const phi = Math.acos(2 * v - 1);

      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi) - 10;

      const rareBright = Math.random() > 0.94;
      sizes[i] = rareBright ? 2.3 + Math.random() * 2.0 : 0.7 + Math.random() * 1.3;
      phases[i] = Math.random() * Math.PI * 2;

      const pick = Math.random() > 0.92 ? palette[4] : palette[Math.floor(Math.random() * 4)];
      colors[i * 3] = pick.r;
      colors[i * 3 + 1] = pick.g;
      colors[i * 3 + 2] = pick.b;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    geo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));

    starMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) }
      },
      vertexShader: `
        attribute float aSize;
        attribute float aPhase;
        attribute vec3 aColor;
        uniform float uTime;
        uniform float uPixelRatio;
        varying vec3 vColor;
        varying float vTwinkle;

        void main() {
          vColor = aColor;
          vTwinkle = 0.58 + 0.42 * sin(uTime * (1.2 + fract(aPhase) * 2.4) + aPhase * 6.2831);
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = clamp(aSize * uPixelRatio * (52.0 / max(-mvPos.z, 1.0)), 1.0, 8.5);
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying float vTwinkle;
        void main() {
          vec2 c = gl_PointCoord - vec2(0.5);
          float dist = length(c);
          if (dist > 0.5) discard;
          float core = exp(-dist * dist * 26.0);
          float halo = exp(-dist * dist * 7.5) * 0.42;
          gl_FragColor = vec4(vColor, (core + halo) * vTwinkle);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    starPoints = new THREE.Points(geo, starMat);
    scene.add(starPoints);
  }

  function createCoordinateGraticule(radius) {
    const pts = [];
    for (let lat = -60; lat <= 60; lat += 30) {
      for (let lon = -180; lon < 180; lon += 6) {
        pts.push(latLonToVec3(lat, lon, radius), latLonToVec3(lat, lon + 6, radius));
      }
    }
    for (let lon = -180; lon < 180; lon += 30) {
      for (let lat = -84; lat < 84; lat += 6) {
        pts.push(latLonToVec3(lat, lon, radius), latLonToVec3(lat + 6, lon, radius));
      }
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    graticuleMat = new THREE.LineBasicMaterial({
      color: 0xc7f36b,
      transparent: true,
      opacity: graticuleState.opacity,
      depthWrite: false
    });
    return new THREE.LineSegments(geo, graticuleMat);
  }

  function createGeodesicArcs(earthRadius) {
    const arcsGroup = new THREE.Group();
    const mocSurface = latLonToVec3(MOC_LAT, MOC_LON, earthRadius + 0.008);

    ARC_ORIGINS.forEach((origin, idx) => {
      const start = latLonToVec3(origin.lat, origin.lon, earthRadius + 0.008);
      const mid = start.clone().add(mocSurface).multiplyScalar(0.5);
      const chordDist = start.distanceTo(mocSurface);
      mid.normalize().multiplyScalar(earthRadius + 0.075 + chordDist * 0.24);

      const curve = new THREE.QuadraticBezierCurve3(start, mid, mocSurface);
      const pts = curve.getPoints(36);
      const lineGeo = new THREE.BufferGeometry().setFromPoints(pts);
      const lineMat = new THREE.LineBasicMaterial({
        color: 0xc7f36b,
        transparent: true,
        opacity: 0.34,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      arcsGroup.add(new THREE.Line(lineGeo, lineMat));

      const pulse = new THREE.Mesh(
        new THREE.SphereGeometry(0.011, 10, 10),
        new THREE.MeshBasicMaterial({ color: 0xeaffb3 })
      );
      arcsGroup.add(pulse);
      arcPulses.push({
        mesh: pulse,
        curve,
        speed: 0.26 + idx * 0.06,
        offset: idx * 0.27
      });
    });

    return arcsGroup;
  }

  function createOrbitalRing(radius, segments, opacity) {
    const pts = [];
    for (let i = 0; i < segments; i++) {
      const a = (i / segments) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius));
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({
      color: 0xc7f36b,
      transparent: true,
      opacity,
      depthWrite: false
    });
    return new THREE.LineLoop(geo, mat);
  }

  function initEarth3D() {
    const layout = getLayoutMetrics();

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(35, window.innerWidth / window.innerHeight, 0.04, 240);
    camera.position.set(0, 0, 12.6);

    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.02;

    raycaster = new THREE.Raycaster();
    mouseNDC = new THREE.Vector2();

    createDeepSpaceDome();
    createTwinklingStarfield();

    earthGroup = new THREE.Group();
    earthGroup.rotation.order = 'XYZ';
    earthGroup.position.y = layout.y;
    scene.add(earthGroup);

    const loader = new THREE.TextureLoader();
    const maxAniso = renderer.capabilities.getMaxAnisotropy();

    const loadTex = (path, srgb = false) => {
      const tex = loader.load(path);
      if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
      tex.wrapS = THREE.RepeatWrapping;
      tex.anisotropy = maxAniso;
      return tex;
    };

    const dayTex = loadTex('assets/textures/earth-day.jpg', true);
    const nightTex = loadTex('assets/textures/earth-night-illustrative.jpg', true);
    const reliefTex = loadTex('assets/textures/earth-relief.jpg');
    const oceanMaskTex = loadTex('assets/textures/ocean-mask.png');
    const cloudsTex = loadTex('assets/textures/earth-clouds.png');

    const mocLocalUnit = latLonToVec3(MOC_LAT, MOC_LON, 1).normalize();

    const EARTH_R = 1.56;
    const earthGeo = new THREE.SphereGeometry(EARTH_R, 128, 128);
    earthMat = new THREE.ShaderMaterial({
      uniforms: {
        uDayMap: { value: dayTex },
        uNightMap: { value: nightTex },
        uReliefMap: { value: reliefTex },
        uOceanMask: { value: oceanMaskTex },
        uCloudsMap: { value: cloudsTex },
        uSunDir: { value: currentSun.clone() },
        uCloudsOffset: { value: 0 },
        uScanOrigin: { value: mocLocalUnit },
        uScanRadius: { value: 0 },
        uScanIntensity: { value: 0 },
        uTime: { value: 0 }
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vWorldNormal;
        varying vec3 vWorldPos;
        varying vec3 vLocalDir;
        void main() {
          vUv = uv;
          vLocalDir = normalize(position);
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldPos = worldPos.xyz;
          vWorldNormal = normalize(mat3(modelMatrix) * normal);
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: `
        uniform sampler2D uDayMap;
        uniform sampler2D uNightMap;
        uniform sampler2D uReliefMap;
        uniform sampler2D uOceanMask;
        uniform sampler2D uCloudsMap;
        uniform vec3 uSunDir;
        uniform float uCloudsOffset;
        uniform vec3 uScanOrigin;
        uniform float uScanRadius;
        uniform float uScanIntensity;
        uniform float uTime;

        varying vec2 vUv;
        varying vec3 vWorldNormal;
        varying vec3 vWorldPos;
        varying vec3 vLocalDir;

        void main() {
          vec3 N = normalize(vWorldNormal);
          vec3 V = normalize(cameraPosition - vWorldPos);
          vec3 L = normalize(uSunDir);

          float ocean = smoothstep(0.25, 0.78, texture2D(uOceanMask, vUv).r);

          float hL = texture2D(uReliefMap, vUv - vec2(0.0008, 0.0)).r;
          float hR = texture2D(uReliefMap, vUv + vec2(0.0008, 0.0)).r;
          float hD = texture2D(uReliefMap, vUv - vec2(0.0, 0.0016)).r;
          float hU = texture2D(uReliefMap, vUv + vec2(0.0, 0.0016)).r;

          vec3 upRef = abs(N.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
          vec3 T = normalize(cross(upRef, N));
          vec3 B = normalize(cross(N, T));
          vec3 landN = normalize(N + ((hL - hR) * T + (hD - hU) * B) * 2.35 * (1.0 - ocean));

          float rawDot = dot(N, L);
          float litDot = max(dot(landN, L), 0.0);

          float dayMix = smoothstep(-0.10, 0.20, rawDot);
          float nightMix = 1.0 - smoothstep(-0.20, 0.06, rawDot);
          float twilight = exp(-pow((rawDot + 0.02) * 9.0, 2.0));

          vec3 rawDay = texture2D(uDayMap, vUv).rgb;
          float luma = dot(rawDay, vec3(0.299, 0.587, 0.114));
          vec3 dayColor = mix(vec3(luma), rawDay, 1.42);
          dayColor = pow(max(dayColor, vec3(0.0)), vec3(1.14));

          vec3 deepOceanTint = dayColor * vec3(0.54, 0.78, 1.22);
          vec3 richLandTint = dayColor * vec3(1.08, 1.05, 0.88);
          dayColor = mix(richLandTint, deepOceanTint, ocean);

          vec2 shadowUv = vec2(vUv.x - uCloudsOffset + 0.0024, clamp(vUv.y + 0.0016, 0.001, 0.999));
          float cloudShadow = smoothstep(0.28, 0.86, texture2D(uCloudsMap, shadowUv).r) * smoothstep(0.0, 0.35, rawDot);

          vec3 nightLights = texture2D(uNightMap, vUv).rgb;
          vec3 litSurface = dayColor * (0.025 + pow(litDot, 0.94) * 1.1);
          litSurface *= (1.0 - cloudShadow * 0.45);

          vec3 H = normalize(L + V);
          float NdotH = max(dot(N, H), 0.0);
          float fresnelWater = 0.04 + 0.96 * pow(1.0 - max(dot(N, V), 0.0), 4.6);
          float sunGlint = (pow(NdotH, 130.0) * 0.62 + pow(NdotH, 22.0) * 0.12) * fresnelWater;
          litSurface += vec3(0.92, 0.97, 1.0) * sunGlint * ocean * smoothstep(0.02, 0.25, rawDot) * (1.0 - cloudShadow * 0.8);

          float cityShimmer = 0.94 + 0.06 * sin(uTime * 2.2 + vUv.x * 120.0);
          vec3 darkSurface = dayColor * 0.014 + nightLights * vec3(1.5, 1.04, 0.52) * 1.08 * nightMix * cityShimmer;

          vec3 color = mix(darkSurface, litSurface, dayMix);

          color += vec3(0.70, 0.26, 0.08) * twilight * 0.22 * (1.0 - ocean * 0.35);
          color += vec3(0.09, 0.19, 0.50) * exp(-pow((rawDot + 0.11) * 7.5, 2.0)) * 0.15;

          float viewDot = max(dot(N, V), 0.0);
          float limb = pow(1.0 - viewDot, 4.5);
          float sunFacing = smoothstep(-0.24, 0.48, rawDot);
          vec3 rimColor = mix(vec3(0.16, 0.54, 1.0), vec3(0.55, 0.92, 0.48), 0.18);
          color += rimColor * limb * (0.06 + 0.66 * sunFacing);

          if (uScanIntensity > 0.004) {
            float angDist = acos(clamp(dot(normalize(vLocalDir), uScanOrigin), -1.0, 1.0));
            float ringWave = exp(-pow((angDist - uScanRadius) * 32.0, 2.0));
            float innerLock = exp(-pow((angDist - 0.032) * 85.0, 2.0)) * 0.85;
            float trail = smoothstep(uScanRadius, uScanRadius - 0.16, angDist) * step(angDist, uScanRadius);
            float gridLines = smoothstep(0.93, 0.99, abs(sin(vUv.x * 210.0))) + smoothstep(0.93, 0.99, abs(sin(vUv.y * 105.0)));
            vec3 scanCol = vec3(0.78, 0.96, 0.42);
            color += scanCol * (ringWave * 0.95 + innerLock + trail * (0.11 + gridLines * 0.24)) * uScanIntensity;
          }

          gl_FragColor = vec4(color, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `
    });
    earthMesh = new THREE.Mesh(earthGeo, earthMat);
    earthGroup.add(earthMesh);
    earthGroup.add(createCoordinateGraticule(EARTH_R + 0.011));

    const cloudsGeo = new THREE.SphereGeometry(EARTH_R + 0.025, 96, 96);
    cloudsMat = new THREE.ShaderMaterial({
      uniforms: {
        uCloudsMap: { value: cloudsTex },
        uSunDir: { value: currentSun.clone() },
        uOpacity: { value: 0.32 }
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vWorldNormal;
        void main() {
          vUv = uv;
          vWorldNormal = normalize(mat3(modelMatrix) * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D uCloudsMap;
        uniform vec3 uSunDir;
        uniform float uOpacity;
        varying vec2 vUv;
        varying vec3 vWorldNormal;
        void main() {
          float rawCloud = texture2D(uCloudsMap, vUv).r;
          float cloud = smoothstep(0.28, 0.88, rawCloud);
          if (cloud < 0.01) discard;
          float ndl = dot(normalize(vWorldNormal), normalize(uSunDir));
          float sunLit = smoothstep(-0.15, 0.32, ndl);
          float sunsetTint = exp(-pow((ndl + 0.02) * 9.0, 2.0));
          vec3 cloudCol = mix(vec3(0.02, 0.04, 0.07), vec3(0.96, 0.98, 1.0), sunLit);
          cloudCol += vec3(0.68, 0.30, 0.12) * sunsetTint * 0.26;
          gl_FragColor = vec4(cloudCol, cloud * uOpacity * (0.08 + 0.92 * sunLit));
        }
      `,
      transparent: true,
      depthWrite: false
    });
    cloudsMesh = new THREE.Mesh(cloudsGeo, cloudsMat);
    earthGroup.add(cloudsMesh);

    const atmosGeo = new THREE.SphereGeometry(EARTH_R + 0.135, 72, 72);
    atmosMat = new THREE.ShaderMaterial({
      uniforms: {
        uSunDir: { value: currentSun.clone() },
        uPulseColor: { value: new THREE.Color(0xc7f36b) },
        uPulseIntensity: { value: 0 }
      },
      vertexShader: `
        varying vec3 vWorldNormal;
        varying vec3 vViewNormal;
        void main() {
          vWorldNormal = normalize(mat3(modelMatrix) * normal);
          vViewNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uSunDir;
        uniform vec3 uPulseColor;
        uniform float uPulseIntensity;
        varying vec3 vWorldNormal;
        varying vec3 vViewNormal;
        void main() {
          float edge = pow(clamp(0.55 - dot(vViewNormal, vec3(0.0, 0.0, 1.0)), 0.0, 1.0), 4.0);
          float sunSide = smoothstep(-0.32, 0.55, dot(normalize(vWorldNormal), normalize(uSunDir)));
          vec3 baseHalo = mix(vec3(0.16, 0.54, 1.0), vec3(0.52, 0.90, 0.58), 0.16) * edge * (0.07 + 0.88 * sunSide);
          vec3 pulseHalo = uPulseColor * edge * uPulseIntensity * 1.15;
          gl_FragColor = vec4(baseHalo + pulseHalo, 1.0);
        }
      `,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false
    });
    earthGroup.add(new THREE.Mesh(atmosGeo, atmosMat));

    const outerHaloGeo = new THREE.SphereGeometry(EARTH_R + 0.30, 64, 64);
    outerHaloMat = new THREE.ShaderMaterial({
      uniforms: { uSunDir: { value: currentSun.clone() } },
      vertexShader: `
        varying vec3 vWorldNormal;
        varying vec3 vViewNormal;
        void main() {
          vWorldNormal = normalize(mat3(modelMatrix) * normal);
          vViewNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uSunDir;
        varying vec3 vWorldNormal;
        varying vec3 vViewNormal;
        void main() {
          float edge = pow(clamp(0.45 - dot(vViewNormal, vec3(0.0, 0.0, 1.0)), 0.0, 1.0), 4.8);
          float sunSide = smoothstep(-0.2, 0.65, dot(normalize(vWorldNormal), normalize(uSunDir)));
          gl_FragColor = vec4(vec3(0.18, 0.56, 0.92) * edge * sunSide * 0.32, 1.0);
        }
      `,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false
    });
    earthGroup.add(new THREE.Mesh(outerHaloGeo, outerHaloMat));
    earthGroup.add(createGeodesicArcs(EARTH_R));

    const mocPos = latLonToVec3(MOC_LAT, MOC_LON, EARTH_R + 0.012);
    beaconGroup = new THREE.Group();
    beaconGroup.position.copy(mocPos);
    beaconGroup.lookAt(mocPos.clone().multiplyScalar(2));

    const dot = new THREE.Mesh(
      new THREE.CircleGeometry(0.018, 24),
      new THREE.MeshBasicMaterial({ color: 0xd8ff8f, side: THREE.DoubleSide })
    );
    const pulseRingA = new THREE.Mesh(
      new THREE.RingGeometry(0.025, 0.035, 32),
      new THREE.MeshBasicMaterial({ color: 0xc7f36b, transparent: true, opacity: 0.78, side: THREE.DoubleSide })
    );
    const pulseRingB = new THREE.Mesh(
      new THREE.RingGeometry(0.025, 0.032, 32),
      new THREE.MeshBasicMaterial({ color: 0xc7f36b, transparent: true, opacity: 0.52, side: THREE.DoubleSide })
    );
    const pinGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, 0.13)
    ]);
    const pinLine = new THREE.Line(
      pinGeo,
      new THREE.LineBasicMaterial({ color: 0xc7f36b, transparent: true, opacity: 0.85 })
    );
    const pinTip = new THREE.Mesh(
      new THREE.SphereGeometry(0.011, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0xeaffb3 })
    );
    pinTip.position.z = 0.13;

    beaconGroup.add(dot, pulseRingA, pulseRingB, pinLine, pinTip);
    beaconGroup.userData.rings = [pulseRingA, pulseRingB];
    earthGroup.add(beaconGroup);

    orbitRig = new THREE.Group();
    orbitRig.position.y = layout.y;
    const ringPrimary = createOrbitalRing(1.96, 128, 0.16);
    ringPrimary.rotation.set(0.42, 0.2, 0.28);
    const ringSecondary = createOrbitalRing(2.16, 128, 0.075);
    ringSecondary.rotation.set(-0.52, -0.3, -0.18);

    satelliteMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.021, 14, 14),
      new THREE.MeshBasicMaterial({ color: 0xc7f36b })
    );
    ringPrimary.add(satelliteMesh);
    orbitRig.add(ringPrimary, ringSecondary);
    scene.add(orbitRig);

    const mocRot = getRotationForLatLon(MOC_LAT, MOC_LON);
    earthGroup.rotation.set(mocRot.x + 0.08, mocRot.y - 0.34, 0);

    bindGlobeInteractions();

    window.addEventListener('resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
      if (starMat) starMat.uniforms.uPixelRatio.value = Math.min(window.devicePixelRatio || 1, 2);
      if (!diving && !switching) {
        const m = getLayoutMetrics();
        const destX = mode === 'login' ? -m.x : m.x;
        earthGroup.position.set(destX, m.y, 0);
        orbitRig.position.copy(earthGroup.position);
        camera.position.set(0, 0, m.z);
      }
    });

    const invQuat = new THREE.Quaternion();
    const camDir = new THREE.Vector3();
    const clock = new THREE.Clock();

    function animate() {
      requestAnimationFrame(animate);
      if (document.hidden) return;

      const dt = Math.min(clock.getDelta(), 0.05);
      const t = clock.elapsedTime;

      currentSun.lerp(smoothSunTarget, 0.048).normalize();
      earthMat.uniforms.uSunDir.value.copy(currentSun);
      earthMat.uniforms.uTime.value = t;
      earthMat.uniforms.uScanRadius.value = scanState.radius;
      earthMat.uniforms.uScanIntensity.value = scanState.intensity;
      cloudsMat.uniforms.uSunDir.value.copy(currentSun);
      atmosMat.uniforms.uSunDir.value.copy(currentSun);
      atmosMat.uniforms.uPulseIntensity.value = pulseState.intensity;
      outerHaloMat.uniforms.uSunDir.value.copy(currentSun);
      if (graticuleMat) graticuleMat.opacity = graticuleState.opacity;
      if (skyMat) {
        skyMat.uniforms.uSunDir.value.copy(currentSun);
        skyMat.uniforms.uTime.value = t;
      }
      if (starMat) starMat.uniforms.uTime.value = t;

      if (earthGroup) {
        if (autoRotate && !isDragging && !switching && !diving) {
          earthGroup.rotation.y += 0.044 * dt;
        }
        if (!isDragging && !diving) {
          earthGroup.rotation.y += velocity.y;
          earthGroup.rotation.x = Math.max(-0.82, Math.min(0.82, earthGroup.rotation.x + velocity.x));
          velocity.x *= 0.92;
          velocity.y *= 0.92;
        }
      }

      if (cloudsMesh) {
        cloudsMesh.rotation.y += 0.014 * dt;
        earthMat.uniforms.uCloudsOffset.value = cloudsMesh.rotation.y / (Math.PI * 2);
      }

      if (orbitRig) {
        orbitRig.position.copy(earthGroup.position);
        orbitRig.scale.copy(earthGroup.scale);
        orbitRig.rotation.y += 0.028 * dt;
        if (satelliteMesh) {
          const satAngle = t * 0.42;
          satelliteMesh.position.set(Math.cos(satAngle) * 1.96, 0, Math.sin(satAngle) * 1.96);
        }
      }

      for (let i = 0; i < arcPulses.length; i++) {
        const p = arcPulses[i];
        const u = (t * p.speed + p.offset) % 1;
        p.curve.getPoint(u, p.mesh.position);
        p.mesh.scale.setScalar(0.65 + Math.sin(u * Math.PI) * 0.6);
      }

      if (beaconGroup?.userData.rings) {
        beaconGroup.userData.rings.forEach((ring, i) => {
          const phase = ((t * 0.58) + i * 0.5) % 1;
          ring.scale.setScalar(0.85 + phase * 1.85);
          ring.material.opacity = (1 - phase) * 0.82;
        });
      }

      if (backdropType && !reduced && isDesktop() && !diving) {
        backdropType.style.transform = `translate3d(${(-parallax.x * 22).toFixed(1)}px, ${(parallax.y * 14).toFixed(1)}px, 0)`;
      }

      if (starPoints) {
        starPoints.rotation.y -= 0.005 * dt;
        if (!diving) {
          starPoints.position.x += (parallax.x * 0.42 - starPoints.position.x) * 0.04;
          starPoints.position.y += (parallax.y * 0.30 - starPoints.position.y) * 0.04;
        }
      }

      if (t - lastHudTick > 0.06) {
        lastHudTick = t;
        if (diving && lockCoordsToMoc) {
          if (diveCoords) diveCoords.textContent = '16°43′ S · 43°51′ W';
        } else {
          camDir.copy(camera.position).sub(earthGroup.position).normalize();
          invQuat.copy(earthGroup.quaternion).invert();
          camDir.applyQuaternion(invQuat);
          const { lat, lon } = vec3ToLatLon(camDir);
          const latStr = formatCoord(lat, 'N', 'S');
          const lonStr = formatCoord(lon, 'E', 'W');
          if (!diving && hudLat && hudLon) {
            hudLat.textContent = latStr;
            hudLon.textContent = lonStr;
          }
          if (diving && diveCoords) {
            diveCoords.textContent = `${latStr} · ${lonStr}`;
          }
        }
      }

      renderer.render(scene, camera);
    }
    animate();
  }

  function bindGlobeInteractions() {
    window.addEventListener('pointermove', (e) => {
      if (cursorDepth && isDesktop()) {
        cursorDepth.style.left = `${e.clientX}px`;
        cursorDepth.style.top = `${e.clientY}px`;
      }

      mouseNDC.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouseNDC.y = -(e.clientY / window.innerHeight) * 2 + 1;
      parallax.x = mouseNDC.x;
      parallax.y = mouseNDC.y;

      if (!diving && !reduced) {
        smoothSunTarget.set(
          0.74 + mouseNDC.x * 0.60,
          0.22 + mouseNDC.y * 0.42,
          0.54 - Math.abs(mouseNDC.x) * 0.18
        ).normalize();
      }

      if (isDragging && earthGroup && !diving) {
        const dx = e.clientX - prevMouse.x;
        const dy = e.clientY - prevMouse.y;
        velocity.y = dx * 0.0052;
        velocity.x = dy * 0.0032;
        earthGroup.rotation.y += velocity.y;
        earthGroup.rotation.x = Math.max(-0.82, Math.min(0.82, earthGroup.rotation.x + velocity.x));
        prevMouse = { x: e.clientX, y: e.clientY };
        return;
      }

      if (!diving && raycaster && earthMesh) {
        raycaster.setFromCamera(mouseNDC, camera);
        const hit = raycaster.intersectObject(earthMesh).length > 0;
        if (hit !== isHoveringEarth) {
          isHoveringEarth = hit;
          canvas.style.cursor = hit ? 'grab' : 'default';
          if (gsap && earthGroup && !switching) {
            gsap.to(earthGroup.scale, {
              x: hit ? 1.028 : 1,
              y: hit ? 1.028 : 1,
              z: hit ? 1.028 : 1,
              duration: 0.65,
              ease: 'power2.out'
            });
          }
        }
      }
    }, { passive: true });

    canvas.addEventListener('pointerdown', (e) => {
      if (diving || switching || e.button !== 0) return;
      raycaster.setFromCamera(mouseNDC, camera);
      if (raycaster.intersectObject(earthMesh).length > 0) {
        isDragging = true;
        canvas.style.cursor = 'grabbing';
        prevMouse = { x: e.clientX, y: e.clientY };
      }
    });

    window.addEventListener('pointerup', () => {
      if (isDragging) {
        isDragging = false;
        canvas.style.cursor = isHoveringEarth ? 'grab' : 'default';
      }
    });

    focusMocBtn?.addEventListener('click', () => {
      if (diving || switching || !earthGroup) return;
      velocity = { x: 0, y: 0 };
      const moc = getRotationForLatLon(MOC_LAT, MOC_LON);
      const targetY = shortestTargetY(earthGroup.rotation.y, moc.y);

      pulseAtmosphere('lime', 0.85);
      triggerLidarScan(MOC_LAT, MOC_LON, 0.95, 1.4, 1.45);

      if (gsap && !reduced) {
        gsap.to(earthGroup.rotation, {
          x: moc.x,
          y: targetY,
          duration: 1.25,
          ease: 'power3.inOut'
        });
      } else {
        earthGroup.rotation.set(moc.x, moc.y, 0);
      }
    });
  }

  // ================= COREOGRAFIAS: ENTRADA, ECLIPSE & AQUISIÇÃO ÓPTICA ATÉ AS RUAS =================
  function getRevealItems(pane) {
    return pane.querySelectorAll('.mode-bar, .dest-whisper:not([hidden]), .pane-title-wrap h1, .pane-lead, .saved-index:not([hidden]), .h-field, .btn-submit, .pane-foot');
  }

  function playInitialArrival(openRegisterDirectly = false) {
    const m = getLayoutMetrics();
    const targetX = openRegisterDirectly ? m.x : -m.x;

    if (openRegisterDirectly) {
      mode = 'register';
      stage.dataset.mode = 'register';
      loginSide.classList.remove('is-active');
      loginSide.inert = true;
      loginSide.setAttribute('aria-hidden', 'true');
      registerSide.classList.add('is-active');
      registerSide.inert = false;
      registerSide.removeAttribute('aria-hidden');
      if (backdropWord) backdropWord.textContent = 'CADASTRO';
    }

    const activePane = openRegisterDirectly ? registerSide : loginSide;
    const inactivePane = openRegisterDirectly ? loginSide : registerSide;
    const items = getRevealItems(activePane);

    if (!gsap || reduced) {
      camera.position.z = m.z;
      earthGroup.position.set(targetX, m.y, 0);
      inactivePane.style.visibility = 'hidden';
      inactivePane.style.opacity = '0';
      activePane.style.visibility = 'visible';
      activePane.style.opacity = '1';
      return;
    }

    gsap.set(inactivePane, { autoAlpha: 0 });
    gsap.set(activePane, { autoAlpha: 1 });
    gsap.set(items, { autoAlpha: 0, y: 22 });

    const tl = gsap.timeline();
    tl.to(camera.position, { z: m.z, duration: 2.0, ease: 'power3.out' }, 0)
      .to(earthGroup.rotation, { y: earthGroup.rotation.y + 0.34, duration: 2.0, ease: 'power2.out' }, 0)
      .to(earthGroup.position, { x: targetX, y: m.y, duration: 1.4, ease: 'power3.inOut' }, 0.32)
      .add(() => triggerLidarScan(MOC_LAT, MOC_LON, 0.72, 1.5, 1.4), 1.0)
      .to(items, { autoAlpha: 1, y: 0, duration: 0.7, stagger: 0.048, ease: 'power3.out' }, 0.82);

    // Pré-carrega as 3 camadas de satélite real de Montes Claros discretamente em segundo plano
    window.setTimeout(preloadMontesClarosSatellite, 1100);
  }

  function switchMode(next) {
    if (diving || switching || next === mode) return;
    const toRegister = next === 'register';
    const outgoing = toRegister ? loginSide : registerSide;
    const incoming = toRegister ? registerSide : loginSide;

    mode = next;
    stage.dataset.mode = next;
    outgoing.classList.remove('is-active');
    outgoing.inert = true;
    outgoing.setAttribute('aria-hidden', 'true');
    incoming.classList.add('is-active');
    incoming.inert = false;
    incoming.removeAttribute('aria-hidden');

    const m = getLayoutMetrics();
    const destX = toRegister ? m.x : -m.x;
    const spinDelta = toRegister ? Math.PI * 1.15 : -Math.PI * 1.15;

    if (!gsap || reduced) {
      earthGroup.position.set(destX, m.y, 0);
      earthGroup.rotation.y += spinDelta;
      if (backdropWord) backdropWord.textContent = toRegister ? 'CADASTRO' : 'ACESSO';
      outgoing.style.visibility = 'hidden';
      outgoing.style.opacity = '0';
      incoming.style.visibility = 'visible';
      incoming.style.opacity = '1';
      return;
    }

    switching = true;
    const outItems = getRevealItems(outgoing);
    const inItems = getRevealItems(incoming);

    gsap.killTweensOf([outgoing, incoming, outItems, inItems, earthGroup.position, earthGroup.rotation, earthGroup.scale]);
    gsap.set(incoming, { autoAlpha: 1 });
    gsap.set(inItems, { autoAlpha: 0, y: 24 });

    const tl = gsap.timeline({
      onComplete: () => {
        gsap.set(outgoing, { autoAlpha: 0 });
        switching = false;
      }
    });

    tl.to(outItems, { autoAlpha: 0, y: -14, duration: 0.3, stagger: 0.024, ease: 'power2.in' }, 0)
      .to(earthGroup.position, {
        x: 0,
        z: isDesktop() ? 0.56 : 0.22,
        duration: 0.56,
        ease: 'power2.in'
      }, 0.08)
      .to(earthGroup.scale, { x: 1.07, y: 1.07, z: 1.07, duration: 0.56, ease: 'power2.in' }, 0.08)
      .to(earthGroup.rotation, { y: earthGroup.rotation.y + spinDelta, duration: 1.24, ease: 'power3.inOut' }, 0.08)
      .add(() => {
        pulseAtmosphere('lime', 0.7);
        if (backdropWord) {
          backdropWord.classList.add('is-swapping');
          window.setTimeout(() => {
            backdropWord.textContent = toRegister ? 'CADASTRO' : 'ACESSO';
            backdropWord.classList.remove('is-swapping');
          }, 160);
        }
      }, 0.56)
      .to(earthGroup.position, {
        x: destX,
        y: m.y,
        z: 0,
        duration: 0.68,
        ease: 'power3.out'
      }, 0.64)
      .to(earthGroup.scale, { x: 1, y: 1, z: 1, duration: 0.68, ease: 'power3.out' }, 0.64)
      .to(inItems, { autoAlpha: 1, y: 0, duration: 0.62, stagger: 0.04, ease: 'power3.out' }, 0.74);
  }

  function sweepLaser() {
    if (!diveScanline || !gsap) return;
    gsap.killTweensOf(diveScanline);
    gsap.fromTo(
      diveScanline,
      { y: '8vh', opacity: 0 },
      {
        y: '92vh',
        opacity: 0.9,
        duration: 0.82,
        ease: 'power1.inOut',
        onComplete: () => gsap.to(diveScanline, { opacity: 0, duration: 0.2 })
      }
    );
  }

  // Aquisição Óptica em 4 Estágios: Brasil (3D) -> Norte de Minas (3D) -> Montes Claros (Satélite z=12) -> Ruas do Centro (Satélite z=14 -> z=16)
  // Aquisição Óptica em 4 Estágios -> Handoff Transparente Direto para Mapa / Registro (sem tela de loading)
  function startSatelliteAcquisition() {
    diving = true;
    autoRotate = false;
    lockCoordsToMoc = false;
    velocity = { x: 0, y: 0 };

    preloadMontesClarosSatellite();

    // Pré-aquece o HTML do destino em segundo plano enquanto a animação de zoom roda
    try {
      const prefetch = document.createElement('link');
      prefetch.rel = 'prefetch';
      prefetch.href = nextDestination.url;
      document.head.appendChild(prefetch);
    } catch (_) {}

    const step1 = { lat: -22.5, lon: -48.4 }; // Brasil Sudeste
    const step2 = { lat: -18.8, lon: -45.2 }; // Minas Gerais
    const step3 = { lat: MOC_LAT, lon: MOC_LON }; // Montes Claros exata

    const rot1 = getRotationForLatLon(step1.lat, step1.lon);
    const rot2 = getRotationForLatLon(step2.lat, step2.lon);
    const rot3 = getRotationForLatLon(step3.lat, step3.lon);

    const y1 = shortestTargetY(earthGroup.rotation.y, rot1.y);
    const y2 = shortestTargetY(y1, rot2.y);
    const y3 = shortestTargetY(y2, rot3.y);

    smoothSunTarget.set(0.48, 0.24, 0.85).normalize();

    const finalLabel =
      nextDestination.page === 'registro.html' && nextDestination.category
        ? `CENTRO MOC · ${nextDestination.category.toUpperCase()}`
        : nextDestination.page === 'mapa.html' && nextDestination.category
          ? `CENTRO MOC · ${nextDestination.category.toUpperCase()}`
          : 'CENTRO · AV. DEP. ESTEVES RODRIGUES';

    const baseSatScale = Math.max(window.innerWidth / 860, window.innerHeight / 860, 1.05);
    const finalSatScale = Number((baseSatScale * 1.92).toFixed(4));

    const finishNavigation = () => {
      try {
        sessionStorage.removeItem('urbs-arrival-v8');
        sessionStorage.removeItem('urbs:page_transition');
        if (!reduced) {
          sessionStorage.setItem(
            'urbs:sat_handoff',
            JSON.stringify({
              ts: Date.now(),
              lat: MOC_LAT,
              lon: MOC_LON,
              z: 16,
              scale: finalSatScale
            })
          );
        }
      } catch (_) {}
      window.location.assign(nextDestination.url);
    };

    if (!gsap || reduced) {
      finishNavigation();
      return;
    }

    const uiChrome = ['.auth-header', '.auth-footer', '#login-side', '#register-side', '#backdrop-type', '.space-scrim'];
    const optics = { zoom: 1.0, km: 12400, progress: 0 };
    diveHud.hidden = false;

    if (satStage) {
      satStage.hidden = false;
      gsap.set(satStage, { opacity: 0 });
      gsap.set(satLayer12, { opacity: 1, scale: baseSatScale * 0.92, x: -46, y: 38 });
      gsap.set(satLayer14, { opacity: 0, scale: baseSatScale * 0.96, x: 0, y: 0 });
      gsap.set(satLayer16, { opacity: 0, scale: baseSatScale * 0.94, x: 0, y: 0 });
    }

    const formatAlt = (km) => {
      if (km >= 10) return `ALT · ${Math.round(km).toLocaleString('pt-BR')} KM`;
      if (km >= 1) return `ALT · ${km.toFixed(1).replace('.', ',')} KM`;
      return `ALT · ${Math.max(220, Math.round(km * 1000))} M`;
    };

    const syncOptics = () => {
      const zText = optics.zoom >= 100 ? Math.round(optics.zoom).toLocaleString('pt-BR') : optics.zoom.toFixed(1);
      if (diveZoom) diveZoom.textContent = `ÓPTICA · ${zText}×`;
      if (diveAlt) diveAlt.textContent = formatAlt(optics.km);
      if (diveProgressFill) diveProgressFill.style.transform = `scaleX(${optics.progress.toFixed(3)})`;
    };

    const setLockState = (locked, tagText) => {
      diveReticle?.classList.toggle('is-locked', locked);
      if (reticleLockTag && tagText) reticleLockTag.textContent = tagText;
    };

    const tl = gsap.timeline();

    // ===== ESTÁGIO 1 (0.00s - 1.12s): Localiza o Brasil no Globo 3D =====
    tl.add(() => {
      if (divePhase) divePhase.textContent = '01 / VARREDURA CONTINENTAL';
      if (diveTargetTitle) diveTargetTitle.textContent = 'BRASIL · REGIÃO SUDESTE';
      setLockState(false, 'SCAN 01');
      sweepLaser();
    }, 0.04)
      .to(uiChrome, { autoAlpha: 0, y: -12, duration: 0.42, stagger: 0.02, ease: 'power2.inOut' }, 0)
      .fromTo(diveHud, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.38, ease: 'power2.out' }, 0.14)
      .fromTo(diveBrackets, { opacity: 0, scale: 1.18 }, { opacity: 1, scale: 1, duration: 0.65, ease: 'power3.out' }, 0.16)
      .fromTo(diveReticle, { opacity: 0, scale: 1.45, x: -28, y: 20 }, { opacity: 1, scale: 1.05, x: 0, y: 0, duration: 0.72, ease: 'power3.out' }, 0.16)
      .to(graticuleState, { opacity: 0.15, duration: 0.8, ease: 'power2.out' }, 0.12)
      .to(earthGroup.scale, { x: 1, y: 1, z: 1, duration: 0.42 }, 0)
      .to(earthGroup.position, { x: 0, y: 0, z: 0, duration: 0.85, ease: 'power3.inOut' }, 0.05)
      .to(earthGroup.rotation, { x: rot1.x, y: y1, z: 0, duration: 0.88, ease: 'power3.inOut' }, 0.05)
      .to(camera.position, { z: 3.12, duration: 0.9, ease: 'power2.inOut' }, 0.14)
      .to(camera, { fov: 28, duration: 0.9, ease: 'power2.inOut', onUpdate: () => camera.updateProjectionMatrix() }, 0.14)
      .to(skyMat.uniforms.uDiveProgress, { value: 0.85, duration: 1.0, ease: 'power2.inOut' }, 0.12)
      .to(optics, { zoom: 12.0, km: 3200, progress: 0.24, duration: 0.9, ease: 'power2.inOut', onUpdate: syncOptics }, 0.14)
      .add(() => {
        setLockState(true, 'SETOR OK');
        triggerLidarScan(step1.lat, step1.lon, 0.85, 0.85, 0.5);
      }, 0.92)

      // ===== ESTÁGIO 2 (1.15s - 2.35s): Mira sobe/direita para Minas Gerais e aproxima no 3D =====
      .add(() => {
        if (divePhase) divePhase.textContent = '02 / RECALIBRANDO SETOR SUPERIOR';
        if (diveTargetTitle) diveTargetTitle.textContent = 'MINAS GERAIS · NORTE';
        setLockState(false, 'TRACKING');
      }, 1.15)
      .to(diveReticle, { x: 52, y: -42, scale: 0.84, duration: 0.36, ease: 'power2.inOut' }, 1.16)
      .add(() => {
        setLockState(true, 'ALVO · MG');
        sweepLaser();
        triggerLidarScan(step2.lat, step2.lon, 1.0, 0.85, 0.34);
      }, 1.52)
      .to(earthGroup.rotation, { x: rot3.x, y: y3, duration: 0.84, ease: 'power3.inOut' }, 1.54)
      .to(diveReticle, { x: 0, y: 0, scale: 0.78, duration: 0.84, ease: 'power3.inOut' }, 1.54)
      .to(diveBrackets, { scale: 0.84, duration: 0.84, ease: 'power3.inOut' }, 1.54)
      .to(camera.position, { z: 2.08, duration: 0.86, ease: 'power3.inOut' }, 1.54)
      .to(camera, { fov: 13.5, duration: 0.86, ease: 'power3.inOut', onUpdate: () => camera.updateProjectionMatrix() }, 1.54)
      .to(cloudsMat.uniforms.uOpacity, { value: 0.08, duration: 0.65, ease: 'power2.out' }, 1.65)
      .to(optics, { zoom: 96.0, km: 85, progress: 0.52, duration: 0.86, ease: 'power3.inOut', onUpdate: syncOptics }, 1.54)

      // ===== ESTÁGIO 3 (2.32s - 3.68s): Handoff para Satélite Real de Montes Claros (z=12 -> z=14) =====
      .add(() => {
        lockCoordsToMoc = true;
        if (divePhase) divePhase.textContent = '03 / SATÉLITE DE ALTA RESOLUÇÃO';
        if (diveTargetTitle) diveTargetTitle.textContent = 'MONTES CLAROS · PERÍMETRO URBANO';
        setLockState(false, 'SCAN MOC');
      }, 2.34)
      .to(satStage, { opacity: 1, duration: 0.42, ease: 'power2.inOut' }, 2.26)
      .to(diveReticle, { x: 46, y: -38, scale: 0.68, duration: 0.36, ease: 'power2.inOut' }, 2.42)
      .add(() => {
        setLockState(true, 'LOCK · MOC');
        sweepLaser();
      }, 2.78)
      .to(satLayer12, { x: 0, y: 0, scale: baseSatScale * 4.0, duration: 0.92, ease: 'power3.inOut' }, 2.8)
      .to(diveReticle, { x: 0, y: 0, scale: 0.64, duration: 0.88, ease: 'power3.inOut' }, 2.8)
      .to(diveBrackets, { scale: 0.72, duration: 0.88, ease: 'power3.inOut' }, 2.8)
      .to(optics, { zoom: 380.0, km: 3.4, progress: 0.78, duration: 0.92, ease: 'power3.inOut', onUpdate: syncOptics }, 2.8)
      .to(satLayer14, { opacity: 1, duration: 0.28, ease: 'none' }, 3.44)

      // ===== ESTÁGIO 4 (3.68s - 5.10s): Foco nas Ruas do Centro + Entrega Direta sem Tela de Loading =====
      .add(() => {
        if (divePhase) divePhase.textContent = '04 / FOCO EM MALHA VIÁRIA';
        if (diveTargetTitle) diveTargetTitle.textContent = finalLabel;
        setLockState(false, 'REFINANDO');
      }, 3.68)
      .to(diveReticle, { x: 18, y: -14, scale: 0.54, duration: 0.26, ease: 'power2.inOut' }, 3.7)
      .add(() => {
        setLockState(true, 'LOCK · SOLO');
        sweepLaser();
      }, 3.96)
      .to(diveReticle, { x: 0, y: 0, scale: 0.48, duration: 0.88, ease: 'power3.inOut' }, 3.98)
      .to(diveBrackets, { scale: 0.56, duration: 0.88, ease: 'power3.inOut' }, 3.98)
      .to(satLayer14, { scale: baseSatScale * 3.84, duration: 0.72, ease: 'power2.inOut' }, 3.96)
      .to(satLayer16, { opacity: 1, duration: 0.26, ease: 'none' }, 4.44)
      .to(satLayer16, { scale: finalSatScale, duration: 0.72, ease: 'power2.out' }, 4.5)
      .to(optics, { zoom: 1240.0, km: 0.26, progress: 1, duration: 0.92, ease: 'power3.inOut', onUpdate: syncOptics }, 3.96)
      .to(diveTopo, { opacity: 0.48, scale: 0.98, duration: 0.36, ease: 'power2.out' }, 4.56)
      // Remove o HUD suavemente deixando apenas as ruas reais em tela cheia antes de dissolver no destino
      .to(diveHud, { autoAlpha: 0, duration: 0.34, ease: 'power2.inOut' }, 4.86)
      .add(finishNavigation, 5.18);
  }

  window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
      diving = false;
      lockCoordsToMoc = false;
      diveVeil.style.opacity = '0';
      if (diveHud) diveHud.hidden = true;
      if (satStage) satStage.hidden = true;
    }
  });

  // ================= EVENTOS DE FORMULÁRIO & API =================
  document.querySelectorAll('[data-switch]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const next = btn.dataset.switch;
      switchMode(next);
      window.setTimeout(() => {
        document.getElementById(next === 'login' ? 'login-email' : 'register-name')?.focus({ preventScroll: true });
      }, reduced ? 0 : 1220);
    });
  });

  document.querySelectorAll('[data-field] input').forEach((input) => {
    const field = input.closest('[data-field]');
    const syncFilled = () => {
      field?.classList.toggle('is-filled', Boolean(input.value.trim()));
      field?.classList.remove('is-error');
    };
    input.addEventListener('input', syncFilled);
    input.addEventListener('focus', () => {
      pulseAtmosphere('lime', 0.28);
      preloadMontesClarosSatellite();
    });
    syncFilled();
  });

  const leaveToHome = (event, href) => {
    if (reduced) return;
    event.preventDefault();
    try { sessionStorage.setItem('urbs:page_transition', String(Date.now())); } catch (_) {}
    diveVeil.style.opacity = '1';
    window.setTimeout(() => window.location.assign(href), 420);
  };

  document.getElementById('urbs-brand-link')?.addEventListener('click', (event) => {
    if (mode === 'register') {
      event.preventDefault();
      switchMode('login');
      return;
    }
    leaveToHome(event, 'index.html');
  });

  document.querySelector('.header-back')?.addEventListener('click', (event) => {
    leaveToHome(event, 'index.html');
  });

  document.querySelectorAll('.toggle-pass').forEach((btn) => {
    btn.addEventListener('click', () => {
      const input = document.getElementById(btn.dataset.target);
      if (!input) return;
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.textContent = show ? 'OCULTAR' : (btn.dataset.target === 'login-password' ? 'MOSTRAR' : 'VER');
    });
  });

  async function handleSubmit(event) {
    event.preventDefault();
    if (diving) return;

    const form = event.currentTarget;
    const isRegister = form.id === 'register-form';
    const errorEl = form.querySelector('.field-error');
    errorEl.textContent = '';
    form.querySelectorAll('[data-field]').forEach((f) => f.classList.remove('is-error'));

    if (!form.checkValidity()) {
      const invalid = form.querySelector(':invalid');
      invalid?.closest('[data-field]')?.classList.add('is-error');
      errorEl.textContent = invalid?.validity.typeMismatch
        ? 'Informe um endereço de e-mail válido.'
        : invalid?.validity.tooShort
          ? 'A senha precisa ter o mínimo de caracteres exigido.'
          : 'Preencha todos os campos obrigatórios.';
      pulseAtmosphere('error', 0.85);
      invalid?.focus();
      return;
    }

    if (isRegister) {
      const pass = document.getElementById('register-password');
      const confirm = document.getElementById('register-confirm');
      if (pass.value !== confirm.value) {
        confirm.closest('[data-field]')?.classList.add('is-error');
        errorEl.textContent = 'As senhas digitadas não coincidem.';
        pulseAtmosphere('error', 0.85);
        confirm.focus();
        return;
      }
    }

    const submitBtn = form.querySelector('.btn-submit');
    const labelSpan = submitBtn.querySelector('.btn-submit__label');
    const originalText = labelSpan ? labelSpan.textContent : submitBtn.textContent;
    submitBtn.disabled = true;
    if (labelSpan) labelSpan.textContent = isRegister ? 'CRIANDO CADASTRO…' : 'AUTENTICANDO…';

    try {
      if (!window.UrbsAPI) throw new Error('Conexão com o servidor indisponível.');

      const emailVal = document.getElementById(isRegister ? 'register-email' : 'login-email').value.trim();
      const payload = isRegister
        ? {
            name: document.getElementById('register-name').value.trim(),
            email: emailVal,
            password: document.getElementById('register-password').value
          }
        : {
            email: emailVal,
            password: document.getElementById('login-password').value
          };

      const result = await window.UrbsAPI.request(
        isRegister ? 'auth/register.php' : 'auth/login.php',
        { method: 'POST', body: payload }
      );

      if (isRegister) {
        form.reset();
        form.querySelectorAll('[data-field]').forEach((f) => f.classList.remove('is-filled'));
        submitBtn.disabled = false;
        if (labelSpan) labelSpan.textContent = originalText;

        if (result.user) saveAccount(result.user, emailVal);
        renderSavedAccounts();

        const loginEmail = document.getElementById('login-email');
        if (loginEmail) {
          loginEmail.value = emailVal;
          loginEmail.closest('[data-field]')?.classList.add('is-filled');
        }

        showToast('Cadastro criado com sucesso! Faça login para iniciar a imersão.');
        switchMode('login');
        window.setTimeout(() => document.getElementById('login-password')?.focus({ preventScroll: true }), reduced ? 0 : 1250);
        return;
      }

      if (result.user) saveAccount(result.user, emailVal);
      if (srStatus) srStatus.textContent = 'Acesso confirmado. Localizando ruas centrais de Montes Claros via satélite.';
      form.reset();
      startSatelliteAcquisition();
    } catch (apiErr) {
      errorEl.textContent = apiErr.message || 'Não foi possível concluir a operação.';
      pulseAtmosphere('error', 0.9);
      submitBtn.disabled = false;
      if (labelSpan) labelSpan.textContent = originalText;
    }
  }

  document.getElementById('login-form')?.addEventListener('submit', handleSubmit);
  document.getElementById('register-form')?.addEventListener('submit', handleSubmit);

  // ================= INICIALIZAÇÃO =================
  renderDestinationWhisper();
  initPasswordMeter();
  renderSavedAccounts();
  initEarth3D();

  const startInRegister = params.get('modo') === 'cadastro';
  playInitialArrival(startInRegister);

  if (params.get('acesso') === 'restrito') {
    showToast(buildRestrictedMessage(nextDestination));
  } else if (params.get('trocar') === '1') {
    showToast('Selecione uma conta recente ou informe outro e-mail para alternar.');
  }
})();