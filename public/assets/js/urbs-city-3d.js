/* URBS V12 — Cidade conceitual, percurso de câmera por rolagem e fluxos de luz.
   Dados exibidos nos tooltips são fictícios e existem apenas para demonstrar a interface.
   WebGL e módulos externos são opcionais: a imagem alternativa permanece se falharem. */
import * as THREE from "three";
const host = document.getElementById("urban-canvas");
if (host && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
  startCity().catch((error) =>
    console.warn("[URBS 3D] Cena indisponível; alternativa visual preservada.", error),
  );
}
async function startCity() {
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x092116, 0.023);
  const camera = new THREE.PerspectiveCamera(39, 1, 0.1, 220);
  camera.position.set(30, 27, 42);
  camera.lookAt(0, 7, 0);
  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.45;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0x071b12, 0);
  host.appendChild(renderer.domElement);
  const city = new THREE.Group();
  scene.add(city);
  // Grade sem base sólida: suaviza o alpha das extremidades via cor de vértice.
  const grid = new THREE.GridHelper(120, 72, 0x9bdc6f, 0x284d39);
  grid.position.y = -0.08;
  grid.material.transparent = true;
  grid.material.opacity = 0.22;
  grid.material.depthWrite = false;
  // A névoa exponencial do cenário oculta naturalmente o horizonte da grade.
  city.add(grid);
  const ambient = new THREE.HemisphereLight(0xd6ffd8, 0x0b2015, 1.95);
  scene.add(ambient);
  const baseGlow = new THREE.Mesh(
    new THREE.CircleGeometry(24, 48),
    new THREE.MeshBasicMaterial({
      color: 0x8bff5b,
      transparent: true,
      opacity: 0.06,
      depthWrite: false,
    }),
  );
  baseGlow.rotation.x = -Math.PI / 2;
  baseGlow.position.y = 0.02;
  city.add(baseGlow);
  const sun = new THREE.DirectionalLight(0xecffe0, 3.9);
  sun.position.set(22, 48, 18);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -40;
  sun.shadow.camera.right = 40;
  sun.shadow.camera.top = 40;
  sun.shadow.camera.bottom = -40;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 120;
  sun.shadow.bias = -0.0008;
  sun.shadow.radius = 3;
  scene.add(sun);
  const rim = new THREE.PointLight(0xa3e635, 82, 92);
  rim.position.set(-15, 24, -18);
  scene.add(rim);
  const accent = new THREE.PointLight(0x7ef6d4, 28, 60);
  accent.position.set(12, 16, 18);
  scene.add(accent);
  const buildings = [];
  let seed = 24167;
  const rand = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  const sectors = ["Norte", "Sul", "Leste", "Oeste", "Central"];
  const lineMaterial = new THREE.LineBasicMaterial({
    color: 0xa3e635,
    transparent: true,
    opacity: 0.94,
    depthWrite: false,
  });
  const glassMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x7cbf8b,
    metalness: 0.04,
    roughness: 0.16,
    transparent: true,
    opacity: 0.13,
    transmission: 0.58,
    ior: 1.08,
    thickness: 0.9,
    clearcoat: 0.7,
    clearcoatRoughness: 0.12,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const rooftopMaterial = new THREE.MeshBasicMaterial({
    color: 0xd7ff85,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
  });
  const hitMaterial = new THREE.MeshBasicMaterial({ visible: false });
  const rayHits = [];
  for (let x = -20; x <= 20; x += 4) {
    for (let z = -20; z <= 20; z += 4) {
      if (x % 12 === 0 || z % 12 === 0 || rand() < 0.18) continue;
      const h = 4 + rand() * 13 + (Math.abs(x) < 9 && Math.abs(z) < 9 ? rand() * 10 : 0);
      const w = 2.1 + rand() * 1.2,
        d = 2.1 + rand() * 1.2;
      const bgroup = new THREE.Group();
      bgroup.position.set(x, 0, z);
      const geo = new THREE.BoxGeometry(w, h, d);
      const glass = new THREE.Mesh(geo, glassMaterial);
      glass.position.y = h / 2;
      glass.castShadow = true;
      glass.receiveShadow = true;
      bgroup.add(glass);
      const outline = new THREE.LineSegments(new THREE.EdgesGeometry(geo), lineMaterial);
      outline.position.y = h / 2;
      bgroup.add(outline);
      // LEDs de topo — somente nas torres mais altas.
      if (h > 16) {
        const led = new THREE.Mesh(
          new THREE.BoxGeometry(w * 0.77, 0.09, d * 0.77),
          rooftopMaterial,
        );
        led.position.y = h + 0.08;
        bgroup.add(led);
      }
      // Geometria invisível para seleção via raycasting.
      const hit = new THREE.Mesh(geo, hitMaterial);
      hit.position.y = h / 2;
      hit.userData.building = bgroup;
      bgroup.add(hit);
      rayHits.push(hit);
      const sector = sectors[Math.min(4, Math.floor(rand() * sectors.length))];
      bgroup.userData = {
        sector,
        density: Math.round(55 + rand() * 37),
        baseY: 0,
        hover: false,
        floatOffset: rand() * Math.PI * 2,
      };
      city.add(bgroup);
      buildings.push(bgroup);
    }
  }
  // Fluxos conceituais: linhas de circulação animadas com pontos luminosos.
  // Não representam ruas ou dados reais de Montes Claros.
  const animatedFlows = [];
  const flowLineMaterial = new THREE.LineBasicMaterial({
    color: 0xb9ff75,
    transparent: true,
    opacity: 0.44,
    depthWrite: false,
  });
  const flowDotMaterial = new THREE.MeshBasicMaterial({
    color: 0xd5ff88,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
  });
  const routes = [
    [
      [-23, 0.14, -12],
      [-12, 0.14, -12],
      [1, 0.14, -12],
      [21, 0.14, -12],
    ],
    [
      [-24, 0.15, 12],
      [-12, 0.15, 12],
      [0, 0.15, 12],
      [24, 0.15, 12],
    ],
    [
      [-12, 0.18, -23],
      [-12, 0.18, -5],
      [-12, 0.18, 10],
      [-12, 0.18, 23],
    ],
    [
      [12, 0.18, -23],
      [12, 0.18, -8],
      [12, 0.18, 8],
      [12, 0.18, 23],
    ],
    [
      [-22, 0.22, 0],
      [-8, 0.22, 0],
      [7, 0.22, 0],
      [22, 0.22, 0],
    ],
  ];
  routes.forEach((route, index) => {
    const curve = new THREE.CatmullRomCurve3(route.map((v) => new THREE.Vector3(...v)));
    const points = curve.getPoints(90);
    city.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), flowLineMaterial));
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 8), flowDotMaterial);
    city.add(glow);
    animatedFlows.push({ curve, glow, phase: index / routes.length });
  });
  // Aros luminosos discretos em pontos altos, cada um em um grupo existente.
  const beacons = [];
  buildings
    .filter((b) =>
      b.children.some((obj) => obj.geometry?.type === "BoxGeometry" && obj.position.y > 10),
    )
    .slice(0, 12)
    .forEach((building, i) => {
      const height = building.children[0].geometry.parameters.height;
      if (height < 15) return;
      const beacon = new THREE.Mesh(
        new THREE.RingGeometry(0.43, 0.51, 32),
        new THREE.MeshBasicMaterial({
          color: 0xb6ff63,
          transparent: true,
          opacity: 0.38,
          side: THREE.DoubleSide,
          depthWrite: false,
        }),
      );
      beacon.rotation.x = -Math.PI / 2;
      beacon.position.y = height + 0.2;
      building.add(beacon);
      beacons.push({ beacon, index: i });
    });
  const selectPulse = new THREE.Mesh(
    new THREE.RingGeometry(0.88, 1.08, 48),
    new THREE.MeshBasicMaterial({
      color: 0xd8ff8d,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  selectPulse.rotation.x = -Math.PI / 2;
  selectPulse.position.y = 0.18;
  city.add(selectPulse);
  // Partículas técnicas sutis no espaço, sem obstruir os edifícios.
  const positions = [];
  for (let i = 0; i < 175; i++)
    positions.push((rand() - 0.5) * 85, rand() * 35 + 2, (rand() - 0.5) * 85);
  const pointsGeom = new THREE.BufferGeometry();
  pointsGeom.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  const points = new THREE.Points(
    pointsGeom,
    new THREE.PointsMaterial({
      color: 0xc0ff9d,
      size: 0.08,
      transparent: true,
      opacity: 0.52,
      depthWrite: false,
    }),
  );
  scene.add(points);
  // UnrealBloomPass em intensidade baixa; se o módulo falhar, o renderer permanece funcional.
  let composer = null;
  try {
    const [{ EffectComposer }, { RenderPass }, { UnrealBloomPass }, { OutputPass }] =
      await Promise.all([
        import("three/addons/postprocessing/EffectComposer.js"),
        import("three/addons/postprocessing/RenderPass.js"),
        import("three/addons/postprocessing/UnrealBloomPass.js"),
        import("three/addons/postprocessing/OutputPass.js"),
      ]);
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.58, 0.34, 0.82);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
  } catch (e) {
    console.info("[URBS 3D] Bloom opcional indisponível.", e);
  }
  const tooltip = document.getElementById("city-tooltip");
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2(4, 4);
  let selected = null,
    drag = false,
    lastX = 0,
    yaw = -0.18,
    px = 0,
    py = 0,
    visible = true,
    lastFrame = performance.now(),
    raf = 0;
  let selectedPulse = null;
  const stage = document.getElementById("city-stage");
  const immersive = document.querySelector(".immersive");
  const runway = document.querySelector(".city-scroll-runway");
  const progressBar = document.getElementById("city-progress-bar");
  const caption = document.getElementById("journey-caption");
  const title = document.getElementById("journey-title");
  const detail = document.getElementById("journey-detail");
  const route = [
    { at: 0, position: [34, 31, 49], look: [0, 7, 0], yaw: -0.2 },
    { at: 0.31, position: [19, 17, 25], look: [0, 9, -3], yaw: 0.05 },
    { at: 0.66, position: [7, 11, 16], look: [0, 11, -11], yaw: 0.24 },
    { at: 1, position: [32, 34, 45], look: [0, 7, 0], yaw: 0.46 },
  ];
  const labels = [
    ["VISÃO DO TERRITÓRIO", "OLHE DE CIMA.", "A cidade revela suas conexões."],
    ["EXPLORANDO AS CAMADAS", "ATRAVESSE.", "Fluxos, estruturas e movimento."],
    ["INTELIGÊNCIA URBANA", "APROXIME-SE.", "Cada estrutura contém uma história."],
    ["UMA NOVA PERSPECTIVA", "VEJA O TODO.", "O território se conecta novamente."],
  ];
  let scrollProgress = 0,
    scrollLastLabel = -1,
    lastManualTime = 0;
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const frameRoute = (t) => {
    let k = 0;
    while (k < route.length - 2 && t > route[k + 1].at) k++;
    const a = route[k],
      b = route[k + 1],
      raw = clamp((t - a.at) / (b.at - a.at), 0, 1);
    const f = raw * raw * (3 - 2 * raw); // smooth motion through narrative camera phases
    const lerpArray = (x, y) => x.map((v, i) => THREE.MathUtils.lerp(v, y[i], f));
    return {
      pos: lerpArray(a.position, b.position),
      look: lerpArray(a.look, b.look),
      yaw: THREE.MathUtils.lerp(a.yaw, b.yaw, f),
    };
  };
  const updateScroll = () => {
    if (!stage || !runway || !immersive) return;
    const start = immersive.getBoundingClientRect().top + window.scrollY + stage.offsetTop;
    scrollProgress = clamp((window.scrollY - start) / Math.max(1, runway.offsetHeight), 0, 1);
    if (progressBar) progressBar.style.transform = `scaleX(${scrollProgress.toFixed(4)})`;
    const index =
      scrollProgress < 0.26 ? 0 : scrollProgress < 0.54 ? 1 : scrollProgress < 0.82 ? 2 : 3;
    if (index !== scrollLastLabel) {
      scrollLastLabel = index;
      caption.textContent = labels[index][0];
      title.textContent = labels[index][1];
      detail.textContent = labels[index][2];
    }
  };
  window.addEventListener("scroll", updateScroll, { passive: true });
  window.addEventListener("resize", updateScroll, { passive: true });
  const resetTooltip = () => {
    selected = null;
    if (tooltip) tooltip.hidden = true;
  };
  const mousePoint = (event) => {
    const rect = host.getBoundingClientRect();
    px = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
    py = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
    pointer.set(px, -py);
    if (tooltip) {
      tooltip.style.left =
        Math.min(rect.width - 210, Math.max(12, event.clientX - rect.left)) + "px";
      tooltip.style.top = Math.max(92, event.clientY - rect.top) + "px";
    }
  };
  host.addEventListener("pointermove", (event) => {
    mousePoint(event);
    if (drag) {
      yaw += (event.clientX - lastX) * 0.007;
      lastX = event.clientX;
      resetTooltip();
    }
  });
  host.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    drag = true;
    lastManualTime = performance.now();
    lastX = event.clientX;
    host.classList.add("dragging");
    try {
      host.setPointerCapture(event.pointerId);
    } catch {}
  });
  const release = () => {
    drag = false;
    lastManualTime = performance.now();
    host.classList.remove("dragging");
  };
  host.addEventListener("pointerup", release);
  host.addEventListener("pointercancel", release);
  host.addEventListener("pointerleave", () => {
    pointer.set(4, 4);
    resetTooltip();
  });
  const resize = () => {
    const w = host.clientWidth,
      h = host.clientHeight;
    if (!w || !h) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    composer?.setSize(w, h);
    updateScroll();
  };
  resize();
  camera.position.set(34, 31, 49);
  camera.lookAt(0, 7, 0);
  const lookTarget = new THREE.Vector3(0, 7, 0);
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(host);
  const observer = new IntersectionObserver(
    (entries) => {
      visible = entries[0].isIntersecting;
    },
    { threshold: 0.02 },
  );
  observer.observe(host);
  function loop(now) {
    raf = requestAnimationFrame(loop);
    if (!visible || document.hidden) {
      lastFrame = now;
      return;
    }
    const dt = Math.min((now - lastFrame) / 1000, 0.05);
    lastFrame = now;
    if (!drag) yaw += dt * 0.018;
    const path = frameRoute(scrollProgress);
    const narrow = host.clientWidth < 700;
    const cameraScale = narrow ? 1.25 : 1;
    const targetPosition = new THREE.Vector3(...path.pos).multiplyScalar(cameraScale);
    camera.position.lerp(targetPosition, Math.min(1, dt * 2.3));
    lookTarget.lerp(new THREE.Vector3(...path.look), Math.min(1, dt * 2.8));
    camera.lookAt(lookTarget);
    const manual = drag || now - lastManualTime < 2500;
    const desiredYaw = (manual ? yaw : path.yaw) + px * 0.025;
    city.rotation.y += (desiredYaw - city.rotation.y) * Math.min(1, dt * 2.5);
    city.rotation.x += (-0.08 + py * 0.025 - city.rotation.x) * Math.min(1, dt * 3);
    animatedFlows.forEach((flow) => {
      flow.phase = (flow.phase + dt * 0.075) % 1;
      flow.glow.position.copy(flow.curve.getPointAt(flow.phase));
    });
    beacons.forEach(({ beacon, index }) => {
      beacon.material.opacity = 0.25 + 0.2 * Math.sin(now * 0.0012 + index);
    });
    if (selected) {
      selectPulse.material.opacity += (0.42 - selectPulse.material.opacity) * 0.14;
      selectPulse.position.x += (selected.position.x - selectPulse.position.x) * 0.16;
      selectPulse.position.z += (selected.position.z - selectPulse.position.z) * 0.16;
      const pulseScale = 1 + 0.12 * Math.sin(now * 0.005);
      selectPulse.scale.setScalar(pulseScale);
    } else {
      selectPulse.material.opacity += (0 - selectPulse.material.opacity) * 0.18;
    }
    if (!drag) {
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(rayHits, false)[0]?.object?.userData.building || null;
      if (hit !== selected) {
        selected = hit;
        if (tooltip) {
          tooltip.hidden = !hit;
          if (hit) {
            tooltip.querySelector(".city-tooltip-title").textContent =
              "Setor " + hit.userData.sector;
            tooltip.querySelector(".city-tooltip-value").textContent =
              "Densidade ilustrativa: " + hit.userData.density + "%";
          }
        }
      }
    }
    for (const building of buildings) {
      const floatBase = Math.sin(now * 0.0007 + building.userData.floatOffset) * 0.07;
      const aim = (building === selected ? 1.18 : 0) + floatBase;
      building.position.y += (aim - building.position.y) * 0.11;
    }
    if (composer) composer.render();
    else renderer.render(scene, camera);
  }
  updateScroll();
  raf = requestAnimationFrame(loop);
  host.parentElement.classList.add("has-3d");
  addEventListener(
    "pagehide",
    () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      resizeObserver.disconnect();
      composer?.dispose();
      renderer.dispose();
      for (const hit of rayHits) hit.geometry.dispose();
      pointsGeom.dispose();
      window.removeEventListener("scroll", updateScroll);
      window.removeEventListener("resize", updateScroll);
      for (const flow of animatedFlows) {
        flow.glow.geometry.dispose();
      }
    },
    { once: true },
  );
}
