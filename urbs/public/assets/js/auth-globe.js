/* URBS — Globo Terrestre Fotorrealista (Custom GLSL Shader + Texturas Locais) + Autenticação PHP */
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
  const toastEl = document.getElementById('auth-toast');
  const diveVeil = document.getElementById('dive-veil');
  const diveHud = document.getElementById('dive-hud');
  const divePhase = document.getElementById('dive-phase');
  const diveAlt = document.getElementById('dive-alt');
  const cursorDepth = document.getElementById('cursor-depth');
  const srStatus = document.getElementById('sr-status');

  const ROLE_LABELS = { citizen: 'Cidadão', resolver: 'Empresa', master: 'Master' };
  const MOC_LAT = -16.7286;
  const MOC_LON = -43.8582;

  let mode = 'login';
  let switching = false;
  let diving = false;

  // Objetos Three.js
  let scene, camera, renderer, earthGroup, earthMesh, cloudsMesh, cloudsMat, beaconGroup;
  let starLayers = [];
  let raycaster, mouseNDC;
  let autoRotate = true;
  let isDragging = false;
  let prevMouse = { x: 0, y: 0 };
  let velocity = { x: 0, y: 0 };
  let parallax = { x: 0, y: 0 };
  let isHoveringEarth = false;
  let diveWarpSpeed = 0;

  const isDesktop = () => window.innerWidth > 860;
  const earthOffsetX = () => (isDesktop() ? 1.18 : 0);

  // ================= TOAST & CONTAS SALVAS =================
  function showToast(message) {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.hidden = false;
    window.clearTimeout(toastEl._timer);
    toastEl._timer = window.setTimeout(() => {
      toastEl.hidden = true;
    }, 3800);
  }

  function saveAccount(user, emailUsed) {
    if (!user || !user.id) return;
    try {
      const key = 'urbs:saved_accounts';
      const list = JSON.parse(localStorage.getItem(key) || '[]');
      const entry = {
        id: Number(user.id),
        name: user.name || 'Usuário',
        email: emailUsed || user.email || '',
        role: user.role || 'citizen',
        company_name: user.company_name || null
      };
      const idx = list.findIndex(item => item.id === entry.id || (entry.email && item.email === entry.email));
      if (idx >= 0) list[idx] = entry;
      else list.unshift(entry);
      localStorage.setItem(key, JSON.stringify(list.slice(0, 6)));
    } catch (_) {}
  }

  function renderSavedAccounts() {
    const box = document.getElementById('saved-accounts');
    const listEl = document.getElementById('saved-accounts-list');
    if (!box || !listEl) return;

    let accounts = [];
    try { accounts = JSON.parse(localStorage.getItem('urbs:saved_accounts') || '[]'); } catch (_) {}

    if (!accounts.length) {
      box.hidden = true;
      return;
    }

    box.hidden = false;
    listEl.replaceChildren();
    accounts.forEach(acc => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'saved-pill';
      const first = (acc.name || 'Conta').split(' ')[0];
      const tag = acc.role === 'resolver' && acc.company_name ? acc.company_name : (ROLE_LABELS[acc.role] || acc.role);
      btn.textContent = `${first} · ${tag}`;
      btn.title = acc.email;
      btn.addEventListener('click', () => {
        const emailInput = document.getElementById('login-email');
        const passInput = document.getElementById('login-password');
        if (emailInput) emailInput.value = acc.email || '';
        if (passInput) { passInput.value = ''; passInput.focus(); }
        showToast(`Conta ${first} selecionada. Digite sua senha para entrar.`);
      });
      listEl.append(btn);
    });
  }

  // ================= MOTOR 3D PLANETÁRIO (CUSTOM GLSL) =================
  function latLonToVec3(lat, lon, radius) {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lon + 180) * (Math.PI / 180);
    return new THREE.Vector3(
      -(radius * Math.sin(phi) * Math.cos(theta)),
      radius * Math.cos(phi),
      radius * Math.sin(phi) * Math.sin(theta)
    );
  }

  function createStarSprite() {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 64;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255, 255, 255, 1)');
    g.addColorStop(0.2, 'rgba(232, 244, 255, 0.8)');
    g.addColorStop(0.5, 'rgba(170, 205, 255, 0.14)');
    g.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }

  function createStarLayer(count, spread, size, opacity, colorHex, sprite) {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * spread * 2;
      pos[i * 3 + 1] = (Math.random() - 0.5) * spread * 1.4;
      pos[i * 3 + 2] = (Math.random() - 0.5) * spread * 2 - 12;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      color: colorHex,
      size,
      map: sprite,
      transparent: true,
      opacity,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    return new THREE.Points(geo, mat);
  }

  function initEarth3D() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(36, window.innerWidth / window.innerHeight, 0.05, 220);
    camera.position.set(0, 0, 13.5);

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
    renderer.toneMappingExposure = 1.08;

    raycaster = new THREE.Raycaster();
    mouseNDC = new THREE.Vector2();

    // Direção do Sol fixa no espaço (cria terminador realista dia/crepusculo/noite)
    const sunDir = new THREE.Vector3(0.88, 0.24, 0.62).normalize();

    earthGroup = new THREE.Group();
    earthGroup.rotation.order = 'XYZ';
    scene.add(earthGroup);

    const loader = new THREE.TextureLoader();
    const maxAniso = renderer.capabilities.getMaxAnisotropy();

    const dayTex = loader.load('assets/textures/earth-day.jpg');
    dayTex.colorSpace = THREE.SRGBColorSpace;
    dayTex.anisotropy = maxAniso;

    const nightTex = loader.load('assets/textures/earth-night-illustrative.jpg');
    nightTex.colorSpace = THREE.SRGBColorSpace;
    nightTex.anisotropy = maxAniso;

    const reliefTex = loader.load('assets/textures/earth-relief.jpg');
    reliefTex.anisotropy = maxAniso;

    const oceanMaskTex = loader.load('assets/textures/ocean-mask.png');
    oceanMaskTex.anisotropy = maxAniso;

    const cloudsTex = loader.load('assets/textures/earth-clouds.png');
    cloudsTex.anisotropy = maxAniso;

    // 1. SUPERFÍCIE DA TERRA — Shader GLSL fotorrealista (Dia, Noite com cidades, Relevo, Brilho Oceânico, Rayleigh)
    const earthGeo = new THREE.SphereGeometry(1.52, 112, 112);
    const earthMat = new THREE.ShaderMaterial({
      uniforms: {
        uDayMap: { value: dayTex },
        uNightMap: { value: nightTex },
        uReliefMap: { value: reliefTex },
        uOceanMask: { value: oceanMaskTex },
        uSunDir: { value: sunDir }
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vWorldNormal;
        varying vec3 vWorldPos;
        void main() {
          vUv = uv;
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
        uniform vec3 uSunDir;

        varying vec2 vUv;
        varying vec3 vWorldNormal;
        varying vec3 vWorldPos;

        void main() {
          vec3 N = normalize(vWorldNormal);
          vec3 V = normalize(cameraPosition - vWorldPos);
          vec3 L = normalize(uSunDir);

          float ocean = smoothstep(0.2, 0.8, texture2D(uOceanMask, vUv).r);

          // Perturbação sutil de relevo topográfico apenas nos continentes
          float hL = texture2D(uReliefMap, vUv - vec2(0.001, 0.0)).r;
          float hR = texture2D(uReliefMap, vUv + vec2(0.001, 0.0)).r;
          float hD = texture2D(uReliefMap, vUv - vec2(0.0, 0.002)).r;
          float hU = texture2D(uReliefMap, vUv + vec2(0.0, 0.002)).r;

          vec3 upRef = abs(N.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
          vec3 T = normalize(cross(upRef, N));
          vec3 B = normalize(cross(N, T));
          vec3 landN = normalize(N + ((hL - hR) * T + (hD - hU) * B) * 1.65 * (1.0 - ocean));

          float rawDot = dot(N, L);
          float litDot = max(dot(landN, L), 0.0);

          // Curvas suaves de dia, crepúsculo e noite
          float dayMix = smoothstep(-0.14, 0.24, rawDot);
          float nightMix = 1.0 - smoothstep(-0.22, 0.06, rawDot);
          float twilight = exp(-pow((rawDot + 0.015) * 8.5, 2.0));

          vec3 dayColor = texture2D(uDayMap, vUv).rgb;
          vec3 nightLights = texture2D(uNightMap, vUv).rgb;

          // Iluminação difusa natural com leve luz ambiente do espaço
          vec3 litSurface = dayColor * (0.045 + pow(litDot, 0.88) * 1.18);

          // Reflexo solar realista restrito aos oceanos (Fresnel + brilho suave + núcleo solar)
          vec3 H = normalize(L + V);
          float NdotH = max(dot(N, H), 0.0);
          float fresnelWater = 0.04 + 0.96 * pow(1.0 - max(dot(N, V), 0.0), 4.0);
          float sunGlint = (pow(NdotH, 92.0) * 0.62 + pow(NdotH, 16.0) * 0.16) * fresnelWater;
          litSurface += vec3(0.95, 0.97, 1.0) * sunGlint * ocean * smoothstep(0.0, 0.22, rawDot);

          // Luzes urbanas quentes na face noturna + leve tom de crepúsculo no horizonte
          vec3 darkSurface = dayColor * 0.025 + nightLights * vec3(1.35, 0.95, 0.55) * 0.85 * nightMix;
          vec3 color = mix(darkSurface, litSurface, dayMix);
          color += vec3(0.55, 0.22, 0.08) * twilight * 0.16 * (1.0 - ocean * 0.4);

          // Dispersão atmosférica Rayleigh nas bordas iluminadas do planeta
          float limb = pow(1.0 - max(dot(N, V), 0.0), 3.1);
          float sunFacing = smoothstep(-0.28, 0.45, rawDot);
          color += vec3(0.30, 0.62, 0.98) * limb * (0.07 + 0.68 * sunFacing);

          gl_FragColor = vec4(color, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `
    });
    earthMesh = new THREE.Mesh(earthGeo, earthMat);
    earthGroup.add(earthMesh);

    // 2. CAMADA DE NUVENS REAIS — Iluminadas no lado do dia e sombreadas na noite
    const cloudsGeo = new THREE.SphereGeometry(1.544, 80, 80);
    cloudsMat = new THREE.ShaderMaterial({
      uniforms: {
        uCloudsMap: { value: cloudsTex },
        uSunDir: { value: sunDir },
        uOpacity: { value: 0.52 }
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
          float cloud = texture2D(uCloudsMap, vUv).r;
          float sunLit = smoothstep(-0.18, 0.35, dot(normalize(vWorldNormal), normalize(uSunDir)));
          vec3 cloudCol = mix(vec3(0.03, 0.06, 0.11), vec3(0.96, 0.98, 1.0), sunLit);
          float alpha = cloud * uOpacity * (0.14 + 0.86 * sunLit);
          gl_FragColor = vec4(cloudCol, alpha);
        }
      `,
      transparent: true,
      depthWrite: false
    });
    cloudsMesh = new THREE.Mesh(cloudsGeo, cloudsMat);
    earthGroup.add(cloudsMesh);

    // 3. HALO ATMOSFÉRICO CRESCENTE (BackSide — acompanha a luz solar, sem brilho artificial uniforme)
    const atmosGeo = new THREE.SphereGeometry(1.66, 72, 72);
    const atmosMat = new THREE.ShaderMaterial({
      uniforms: { uSunDir: { value: sunDir } },
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
          float edge = pow(clamp(0.58 - dot(vViewNormal, vec3(0.0, 0.0, 1.0)), 0.0, 1.0), 3.4);
          float sunSide = smoothstep(-0.35, 0.55, dot(normalize(vWorldNormal), normalize(uSunDir)));
          vec3 halo = vec3(0.28, 0.62, 1.0) * edge * (0.06 + 0.85 * sunSide);
          gl_FragColor = vec4(halo, 1.0);
        }
      `,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false
    });
    earthGroup.add(new THREE.Mesh(atmosGeo, atmosMat));

    // 4. Ponto discreto de Montes Claros - MG (-16.7286, -43.8582)
    const mocPos = latLonToVec3(MOC_LAT, MOC_LON, 1.532);
    beaconGroup = new THREE.Group();
    beaconGroup.position.copy(mocPos);
    beaconGroup.lookAt(mocPos.clone().multiplyScalar(2));

    const dot = new THREE.Mesh(
      new THREE.CircleGeometry(0.017, 24),
      new THREE.MeshBasicMaterial({ color: 0xc7f36b, side: THREE.DoubleSide })
    );
    const pulseRing = new THREE.Mesh(
      new THREE.RingGeometry(0.025, 0.035, 32),
      new THREE.MeshBasicMaterial({ color: 0xc7f36b, transparent: true, opacity: 0.65, side: THREE.DoubleSide })
    );
    beaconGroup.add(dot, pulseRing);
    beaconGroup.userData.pulse = pulseRing;
    earthGroup.add(beaconGroup);

    // 5. Estrelas em 3 temperaturas e profundidades
    const sprite = createStarSprite();
    const sFar = createStarLayer(1600, 68, 0.22, 0.5, 0xcbd5e1, sprite);
    const sMid = createStarLayer(650, 46, 0.34, 0.78, 0xdbeafe, sprite);
    const sNear = createStarLayer(180, 30, 0.42, 0.88, 0xfef3c7, sprite);
    starLayers = [sFar, sMid, sNear];
    scene.add(sFar, sMid, sNear);

    // Enquadramento inicial elegante com América do Sul / Atlântico em destaque
    earthGroup.rotation.set(-0.22, -1.08, 0);

    bindGlobeInteractions();

    window.addEventListener('resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
      if (!diving && !switching) {
        earthGroup.position.x = mode === 'login' ? -earthOffsetX() : earthOffsetX();
        camera.position.z = isDesktop() ? 4.45 : 5.5;
      }
    });

    const clock = new THREE.Clock();
    function animate() {
      requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.05);
      const t = clock.elapsedTime;

      if (earthGroup) {
        if (autoRotate && !isDragging && !switching && !diving) {
          earthGroup.rotation.y += 0.065 * dt;
        }
        if (!isDragging && !diving) {
          earthGroup.rotation.y += velocity.y;
          earthGroup.rotation.x = Math.max(-0.75, Math.min(0.75, earthGroup.rotation.x + velocity.x));
          velocity.x *= 0.92;
          velocity.y *= 0.92;
        }
      }

      if (cloudsMesh) cloudsMesh.rotation.y += 0.018 * dt;

      if (beaconGroup?.userData.pulse) {
        const s = 1 + 0.75 * ((Math.sin(t * 2.6) + 1) * 0.5);
        beaconGroup.userData.pulse.scale.setScalar(s);
        beaconGroup.userData.pulse.material.opacity = Math.max(0, 0.8 - (s - 1) * 0.95);
      }

      // Movimento contínuo das estrelas + efeito warp durante o mergulho orbital
      starLayers.forEach((layer, idx) => {
        const factor = idx + 1;
        layer.rotation.y -= 0.008 * factor * dt;
        layer.position.x += (parallax.x * 0.25 * factor - layer.position.x) * 0.04;
        layer.position.y += (parallax.y * 0.18 * factor - layer.position.y) * 0.04;

        if (diveWarpSpeed > 0.01) {
          const arr = layer.geometry.attributes.position.array;
          for (let i = 2; i < arr.length; i += 3) {
            arr[i] += diveWarpSpeed * factor * dt;
            if (arr[i] > camera.position.z + 2) arr[i] -= 85;
          }
          layer.geometry.attributes.position.needsUpdate = true;
        }
      });

      renderer.render(scene, camera);
    }
    animate();
  }

  function bindGlobeInteractions() {
    window.addEventListener('pointermove', (e) => {
      if (cursorDepth) {
        cursorDepth.style.left = `${e.clientX}px`;
        cursorDepth.style.top = `${e.clientY}px`;
      }

      mouseNDC.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouseNDC.y = -(e.clientY / window.innerHeight) * 2 + 1;
      parallax.x = mouseNDC.x;
      parallax.y = mouseNDC.y;

      if (isDragging && earthGroup && !diving) {
        const dx = e.clientX - prevMouse.x;
        const dy = e.clientY - prevMouse.y;
        velocity.y = dx * 0.005;
        velocity.x = dy * 0.003;
        earthGroup.rotation.y += velocity.y;
        earthGroup.rotation.x = Math.max(-0.75, Math.min(0.75, earthGroup.rotation.x + velocity.x));
        prevMouse = { x: e.clientX, y: e.clientY };
        return;
      }

      if (!diving && raycaster && earthMesh) {
        raycaster.setFromCamera(mouseNDC, camera);
        const hit = raycaster.intersectObject(earthMesh).length > 0;
        if (hit !== isHoveringEarth) {
          isHoveringEarth = hit;
          canvas.style.cursor = hit ? 'grab' : 'default';
          if (gsap && earthGroup) {
            gsap.to(earthGroup.scale, {
              x: hit ? 1.022 : 1,
              y: hit ? 1.022 : 1,
              z: hit ? 1.022 : 1,
              duration: 0.7,
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
  }

  // ================= COREOGRAFIAS GSAP =================
  function playInitialArrival(openRegisterDirectly = false) {
    const targetZ = isDesktop() ? 4.45 : 5.5;
    const targetX = openRegisterDirectly ? earthOffsetX() : -earthOffsetX();

    if (openRegisterDirectly) {
      mode = 'register';
      stage.dataset.mode = 'register';
      loginSide.inert = true;
      loginSide.setAttribute('aria-hidden', 'true');
      registerSide.inert = false;
      registerSide.removeAttribute('aria-hidden');
    }

    const activePane = openRegisterDirectly ? registerSide : loginSide;
    const inactivePane = openRegisterDirectly ? loginSide : registerSide;

    if (!gsap || reduced) {
      camera.position.z = targetZ;
      earthGroup.position.x = targetX;
      inactivePane.style.visibility = 'hidden';
      inactivePane.style.opacity = '0';
      activePane.style.visibility = 'visible';
      activePane.style.opacity = '1';
      return;
    }

    gsap.set(inactivePane, { autoAlpha: 0 });
    gsap.set(activePane, { autoAlpha: 0, y: 18 });

    const tl = gsap.timeline();
    tl.to(camera.position, { z: targetZ, duration: 2.3, ease: 'power3.out' }, 0)
      .to(earthGroup.rotation, { y: earthGroup.rotation.y + 0.28, duration: 2.3, ease: 'power2.out' }, 0)
      .to(earthGroup.position, { x: targetX, duration: 1.5, ease: 'power3.inOut' }, 0.45)
      .to(activePane, { autoAlpha: 1, y: 0, duration: 0.9, ease: 'power3.out' }, 1.05);
  }

  function switchMode(next) {
    if (diving || switching || next === mode) return;
    const toRegister = next === 'register';
    const outgoing = toRegister ? loginSide : registerSide;
    const incoming = toRegister ? registerSide : loginSide;

    mode = next;
    stage.dataset.mode = next;
    outgoing.inert = true;
    outgoing.setAttribute('aria-hidden', 'true');
    incoming.inert = false;
    incoming.removeAttribute('aria-hidden');

    const destX = toRegister ? earthOffsetX() : -earthOffsetX();
    const spinDelta = toRegister ? Math.PI * 1.25 : -Math.PI * 1.25;

    if (!gsap || reduced) {
      earthGroup.position.x = destX;
      earthGroup.rotation.y += spinDelta;
      outgoing.style.visibility = 'hidden';
      outgoing.style.opacity = '0';
      incoming.style.visibility = 'visible';
      incoming.style.opacity = '1';
      return;
    }

    switching = true;
    gsap.killTweensOf([outgoing, incoming, earthGroup.position, earthGroup.rotation]);

    const tl = gsap.timeline({
      onComplete: () => { switching = false; }
    });

    tl.to(outgoing, { autoAlpha: 0, x: toRegister ? 44 : -44, duration: 0.38, ease: 'power2.in' }, 0)
      .to(earthGroup.position, { x: destX, duration: 1.15, ease: 'power3.inOut' }, 0.08)
      .to(earthGroup.rotation, { y: earthGroup.rotation.y + spinDelta, duration: 1.15, ease: 'power3.inOut' }, 0.08)
      .fromTo(incoming, { autoAlpha: 0, x: toRegister ? -44 : 44 }, { autoAlpha: 1, x: 0, duration: 0.68, ease: 'power3.out' }, 0.56);
  }

  // Mergulho Cinematográfico em 3 estágios: Alinhamento -> Aceleração Orbital + FOV Warp -> Entrada na Atmosfera
  function diveIntoMontesClaros() {
    diving = true;
    autoRotate = false;
    velocity = { x: 0, y: 0 };

    const mocVec = latLonToVec3(MOC_LAT, MOC_LON, 1);
    const targetRotYBase = -Math.atan2(mocVec.x, mocVec.z);
    const zAfterY = Math.hypot(mocVec.x, mocVec.z);
    const targetRotX = Math.atan2(mocVec.y, zAfterY);

    const twoPi = Math.PI * 2;
    let deltaY = ((targetRotYBase - earthGroup.rotation.y) % twoPi + twoPi) % twoPi;
    if (deltaY > Math.PI) deltaY -= twoPi;
    const finalRotY = earthGroup.rotation.y + deltaY;

    const finishToMap = () => {
      try { sessionStorage.setItem('urbs-arrival-v8', String(Date.now())); } catch (_) {}
      window.location.assign('mapa.html');
    };

    if (!gsap || reduced) {
      finishToMap();
      return;
    }

    const uiChrome = ['.auth-header', '.auth-footer', '#login-side', '#register-side'];
    const telemetry = { km: 12400, warp: 0 };
    diveHud.hidden = false;

    const tl = gsap.timeline();

    // Estágio 1: Limpa a tela e alinha Montes Claros no centro exato da lente
    tl.to(uiChrome, { autoAlpha: 0, y: -12, duration: 0.45, stagger: 0.03, ease: 'power2.in' }, 0)
      .fromTo(diveHud, { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.5, ease: 'power2.out' }, 0.25)
      .to(earthGroup.scale, { x: 1, y: 1, z: 1, duration: 0.5 }, 0)
      .to(earthGroup.position, { x: 0, y: 0, duration: 1.05, ease: 'power3.inOut' }, 0.08)
      .to(earthGroup.rotation, { x: targetRotX, y: finalRotY, z: 0.08, duration: 1.15, ease: 'power3.inOut' }, 0.08)

      // Estágio 2: Aproximação com abertura gradual de lente (FOV Warp) e aceleração das estrelas
      .to(camera.position, { z: 2.35, duration: 0.85, ease: 'power2.inOut' }, 0.7)
      .to(telemetry, {
        km: 1800,
        warp: 14,
        duration: 0.85,
        ease: 'power2.in',
        onUpdate: () => {
          diveWarpSpeed = telemetry.warp;
          if (diveAlt) diveAlt.textContent = `ALTITUDE · ${Math.round(telemetry.km).toLocaleString('pt-BR')} KM`;
        }
      }, 0.7)

      // Estágio 3: Mergulho final atravessando a camada de nuvens até Montes Claros
      .add(() => {
        if (divePhase) divePhase.textContent = 'ENTRANDO NA ATMOSFERA';
      }, 1.45)
      .to(camera.position, { z: 1.545, duration: 1.15, ease: 'expo.in' }, 1.45)
      .to(camera, {
        fov: 68,
        duration: 1.15,
        ease: 'expo.in',
        onUpdate: () => camera.updateProjectionMatrix()
      }, 1.45)
      .to(cloudsMat.uniforms.uOpacity, { value: 0.92, duration: 0.85, ease: 'power2.in' }, 1.65)
      .to(telemetry, {
        km: 12,
        warp: 46,
        duration: 1.1,
        ease: 'expo.in',
        onUpdate: () => {
          diveWarpSpeed = telemetry.warp;
          if (diveAlt) diveAlt.textContent = `ALTITUDE · ${Math.round(telemetry.km).toLocaleString('pt-BR')} KM`;
        }
      }, 1.45)
      .to(diveHud, { autoAlpha: 0, duration: 0.3 }, 2.25)
      .add(() => {
        diveVeil.style.opacity = '1';
      }, 2.22)
      .add(finishToMap, 2.75);
  }

  // ================= EVENTOS DE INTERFACE & API PHP =================
  document.querySelectorAll('[data-switch]').forEach(btn => {
    btn.addEventListener('click', () => {
      const next = btn.dataset.switch;
      switchMode(next);
      window.setTimeout(() => {
        document.getElementById(next === 'login' ? 'login-email' : 'register-name')?.focus({ preventScroll: true });
      }, reduced ? 0 : 1100);
    });
  });

  document.getElementById('urbs-brand-link')?.addEventListener('click', (event) => {
    if (mode === 'register') {
      event.preventDefault();
      switchMode('login');
    }
  });

  document.querySelectorAll('.toggle-pass').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = document.getElementById(btn.dataset.target);
      if (!input) return;
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.textContent = show ? 'Ocultar' : (btn.dataset.target === 'login-password' ? 'Mostrar' : 'Ver');
    });
  });

  async function handleSubmit(event) {
    event.preventDefault();
    if (diving) return;

    const form = event.currentTarget;
    const isRegister = form.id === 'register-form';
    const errorEl = form.querySelector('.field-error');
    errorEl.textContent = '';

    if (!form.checkValidity()) {
      const invalid = form.querySelector(':invalid');
      errorEl.textContent = invalid?.validity.typeMismatch
        ? 'Informe um endereço de e-mail válido.'
        : invalid?.validity.tooShort
          ? 'A senha precisa ter o mínimo de caracteres exigido.'
          : 'Preencha todos os campos obrigatórios.';
      invalid?.focus();
      return;
    }

    if (isRegister) {
      const pass = document.getElementById('register-password');
      const confirm = document.getElementById('register-confirm');
      if (pass.value !== confirm.value) {
        errorEl.textContent = 'As senhas digitadas não coincidem.';
        confirm.focus();
        return;
      }
    }

    const submitBtn = form.querySelector('.btn-submit');
    const originalHtml = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span>${isRegister ? 'Criando cadastro…' : 'Entrando…'}</span>`;

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
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalHtml;

        if (result.user) saveAccount(result.user, emailVal);
        renderSavedAccounts();

        const loginEmail = document.getElementById('login-email');
        if (loginEmail) loginEmail.value = emailVal;

        showToast('Cadastro criado com sucesso! Faça login para entrar.');
        switchMode('login');
        window.setTimeout(() => document.getElementById('login-password')?.focus({ preventScroll: true }), reduced ? 0 : 1150);
        return;
      }

      if (result.user) saveAccount(result.user, emailVal);
      if (srStatus) srStatus.textContent = 'Acesso confirmado. Abrindo o mapa de Montes Claros.';
      form.reset();
      diveIntoMontesClaros();
    } catch (apiErr) {
      errorEl.textContent = apiErr.message || 'Não foi possível concluir a operação.';
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalHtml;
    }
  }

  document.getElementById('login-form')?.addEventListener('submit', handleSubmit);
  document.getElementById('register-form')?.addEventListener('submit', handleSubmit);

  // ================= INICIALIZAÇÃO =================
  initEarth3D();
  renderSavedAccounts();

  const params = new URLSearchParams(window.location.search);
  const startInRegister = params.get('modo') === 'cadastro';
  playInitialArrival(startInRegister);

  if (params.get('acesso') === 'restrito') {
    showToast('Entre na sua conta ou cadastre-se para acessar o mapa e registrar ocorrências.');
  } else if (params.get('trocar') === '1') {
    showToast('Selecione uma conta recente ou informe outro e-mail para alternar.');
  }
})();