import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
(() => {
  const stage = document.getElementById("holo-stage");
  const canvasHost = document.getElementById("holo-canvas");
  if (!stage || !canvasHost) return;
  const points = [
    {
      id: "mobility",
      category: "MOBILIDADE",
      title: "Avenida Deputado Esteves Rodrigues",
      description:
        "Corredor viário demonstrativo onde o URBS pode cruzar fluxo, travessias e qualidade do pavimento em uma leitura territorial mais clara.",
      street: "Av. Dep. Esteves Rodrigues · Centro",
      coords: "-16.7286, -43.8582",
      status: "Monitoramento ativo",
      position: new THREE.Vector3(-3.8, 0.24, 2.6),
      roadPath: [
        new THREE.Vector3(-7.5, 0.03, 2.8),
        new THREE.Vector3(-5.1, 0.03, 2.5),
        new THREE.Vector3(-3.8, 0.03, 2.6),
        new THREE.Vector3(-1.4, 0.03, 2.9),
        new THREE.Vector3(1.8, 0.03, 3.15),
      ],
    },
    {
      id: "lighting",
      category: "ILUMINAÇÃO",
      title: "Parque Sagarana",
      description:
        "Ponto demonstrativo com foco na leitura noturna: iluminação pública, sensação de segurança e uso do espaço ao longo da noite.",
      street: "Entorno do Parque Sagarana",
      coords: "-16.7039, -43.8650",
      status: "Luz urbana / observação",
      position: new THREE.Vector3(2.6, 0.24, -1.6),
      roadPath: [
        new THREE.Vector3(1.1, 0.03, -3.8),
        new THREE.Vector3(2.2, 0.03, -2.7),
        new THREE.Vector3(2.6, 0.03, -1.6),
        new THREE.Vector3(3.0, 0.03, -0.3),
        new THREE.Vector3(3.4, 0.03, 1.4),
      ],
    },
    {
      id: "access",
      category: "ACESSIBILIDADE",
      title: "Rua Doutor Veloso",
      description:
        "Trecho usado para demonstrar leitura de calçadas, travessias e barreiras físicas com foco em acessibilidade urbana.",
      street: "Rua Dr. Veloso · Centro",
      coords: "-16.7268, -43.8617",
      status: "Calçadas / rota acessível",
      position: new THREE.Vector3(-0.7, 0.24, -3.4),
      roadPath: [
        new THREE.Vector3(-3.4, 0.03, -5.6),
        new THREE.Vector3(-2.0, 0.03, -4.7),
        new THREE.Vector3(-0.7, 0.03, -3.4),
        new THREE.Vector3(0.6, 0.03, -2.3),
        new THREE.Vector3(2.1, 0.03, -1.0),
      ],
    },
    {
      id: "care",
      category: "ZELADORIA",
      title: "Avenida Mestra Fininha",
      description:
        "Ponto demonstrativo para leitura de limpeza urbana, drenagem e manutenção do espaço público em um eixo de conexão importante.",
      street: "Av. Mestra Fininha · Melo",
      coords: "-16.7329, -43.8501",
      status: "Zeladoria / acompanhamento",
      position: new THREE.Vector3(4.3, 0.24, 3.8),
      roadPath: [
        new THREE.Vector3(2.2, 0.03, 1.4),
        new THREE.Vector3(3.1, 0.03, 2.4),
        new THREE.Vector3(4.3, 0.03, 3.8),
        new THREE.Vector3(5.2, 0.03, 5.3),
      ],
    },
  ];
  const buttonTime = Array.from(document.querySelectorAll("[data-holo-time]"));
  const btnAerial = document.getElementById("holo-aerial");
  const btnStreet = document.getElementById("holo-street");
  const btnStreetAction = document.getElementById("holo-card-street-action");
  const card = document.getElementById("holo-card");
  const labelMode = document.getElementById("holo-mode-label");
  const labelSelection = document.getElementById("holo-selection-label");
  const cardFields = {
    category: document.getElementById("holo-card-category"),
    title: document.getElementById("holo-card-title"),
    description: document.getElementById("holo-card-description"),
    street: document.getElementById("holo-card-street"),
    coords: document.getElementById("holo-card-coords"),
    status: document.getElementById("holo-card-status"),
  };
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x07110d, 0.04);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  canvasHost.appendChild(renderer.domElement);
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 120);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.maxDistance = 24;
  controls.minDistance = 5;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.35;
  controls.target.set(0, 0.25, 0);
  const aerialPose = {
    position: new THREE.Vector3(0, 11.5, 11.8),
    target: new THREE.Vector3(0, 0.25, 0),
    polar: 1.02,
  };
  camera.position.copy(aerialPose.position);
  controls.target.copy(aerialPose.target);
  controls.update();
  const root = new THREE.Group();
  scene.add(root);
  // Base / grid
  const base = new THREE.Mesh(
    new THREE.PlaneGeometry(22, 22),
    new THREE.MeshBasicMaterial({ color: 0x0b1c17, transparent: true, opacity: 0.88 }),
  );
  base.rotation.x = -Math.PI / 2;
  base.position.y = -0.02;
  root.add(base);
  const district = new THREE.Mesh(
    new THREE.CircleGeometry(11.2, 9),
    new THREE.MeshBasicMaterial({ color: 0x0e2019, transparent: true, opacity: 0.6 }),
  );
  district.rotation.x = -Math.PI / 2;
  district.position.y = -0.08;
  root.add(district);
  const grid = new THREE.GridHelper(22, 22, 0x71fbc5, 0x1f4e43);
  grid.position.y = 0;
  grid.material.opacity = 0.22;
  grid.material.transparent = true;
  root.add(grid);
  // Lights
  const ambient = new THREE.AmbientLight(0xc9fff0, 1.1);
  scene.add(ambient);
  const hemi = new THREE.HemisphereLight(0x9ee7ff, 0x062018, 0.9);
  scene.add(hemi);
  const dir = new THREE.DirectionalLight(0xdffff5, 1.4);
  dir.position.set(8, 10, 6);
  dir.castShadow = true;
  dir.shadow.mapSize.set(1024, 1024);
  dir.shadow.camera.near = 1;
  dir.shadow.camera.far = 35;
  dir.shadow.camera.left = -12;
  dir.shadow.camera.right = 12;
  dir.shadow.camera.top = 12;
  dir.shadow.camera.bottom = -12;
  scene.add(dir);
  const roadsGroup = new THREE.Group();
  const roadMats = [];
  const roadHighlightMats = [];
  root.add(roadsGroup);
  function addRoad(pointsArray, width = 0.1, color = 0x76f6c9, opacity = 0.82) {
    const curve = new THREE.CatmullRomCurve3(pointsArray, false, "catmullrom", 0.08);
    const geometry = new THREE.TubeGeometry(curve, 64, width, 8, false);
    const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.y = 0.01;
    roadsGroup.add(mesh);
    roadMats.push(material);
    return mesh;
  }
  // Main roads
  addRoad(
    [
      new THREE.Vector3(-8, 0.02, 2.9),
      new THREE.Vector3(-5, 0.02, 2.5),
      new THREE.Vector3(-1.4, 0.02, 2.8),
      new THREE.Vector3(2.2, 0.02, 3.1),
      new THREE.Vector3(5.8, 0.02, 3.9),
    ],
    0.09,
    0x7dffd6,
    0.82,
  );
  addRoad(
    [
      new THREE.Vector3(-5.4, 0.02, -4.6),
      new THREE.Vector3(-2.5, 0.02, -3.9),
      new THREE.Vector3(0.2, 0.02, -2.6),
      new THREE.Vector3(2.3, 0.02, -0.8),
      new THREE.Vector3(3.7, 0.02, 1.7),
    ],
    0.075,
    0x68f1da,
    0.76,
  );
  addRoad(
    [
      new THREE.Vector3(-4.9, 0.02, 6.0),
      new THREE.Vector3(-4.2, 0.02, 2.6),
      new THREE.Vector3(-3.3, 0.02, -0.6),
      new THREE.Vector3(-1.2, 0.02, -5.2),
    ],
    0.07,
    0x68f1da,
    0.68,
  );
  addRoad(
    [
      new THREE.Vector3(1.4, 0.02, -6.1),
      new THREE.Vector3(2.4, 0.02, -3.2),
      new THREE.Vector3(2.7, 0.02, -1.6),
      new THREE.Vector3(3.4, 0.02, 1.1),
      new THREE.Vector3(4.9, 0.02, 5.6),
    ],
    0.075,
    0x78ffd0,
    0.68,
  );
  addRoad(
    [
      new THREE.Vector3(-7.0, 0.02, 0.0),
      new THREE.Vector3(-3.8, 0.02, 0.1),
      new THREE.Vector3(-0.5, 0.02, 0.0),
      new THREE.Vector3(3.3, 0.02, -0.2),
      new THREE.Vector3(6.2, 0.02, -0.1),
    ],
    0.06,
    0x66e6c5,
    0.56,
  );
  const roadHighlights = [];
  points.forEach((point) => {
    const curve = new THREE.CatmullRomCurve3(point.roadPath, false, "catmullrom", 0.1);
    const geometry = new THREE.TubeGeometry(curve, 48, 0.12, 10, false);
    const material = new THREE.MeshBasicMaterial({
      color: 0xb8e954,
      transparent: true,
      opacity: 0,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.y = 0.025;
    roadsGroup.add(mesh);
    roadHighlights.push({ id: point.id, mesh, material });
    roadHighlightMats.push(material);
  });
  // City blocks
  const blockGroup = new THREE.Group();
  root.add(blockGroup);
  const blockBlueprint = [
    [-5.8, 4.8, 1.2, 1.4, 0.44],
    [-4.2, 4.7, 1.8, 1.5, 0.72],
    [-2.1, 4.8, 1.3, 1.2, 0.4],
    [0.0, 4.8, 1.4, 1.5, 0.54],
    [2.0, 4.9, 1.8, 1.5, 0.88],
    [4.4, 4.8, 1.4, 1.4, 0.48],
    [-6.2, 1.7, 1.5, 1.2, 0.7],
    [-4.2, 1.6, 1.4, 1.2, 0.88],
    [-2.2, 1.7, 1.2, 1.2, 0.52],
    [0.0, 1.7, 1.6, 1.4, 1.0],
    [2.4, 1.8, 1.2, 1.5, 0.64],
    [4.7, 1.8, 1.2, 1.3, 0.94],
    [-5.5, -1.2, 1.4, 1.4, 0.68],
    [-3.2, -1.2, 1.7, 1.2, 0.52],
    [-1.1, -1.0, 1.4, 1.7, 0.82],
    [1.4, -1.0, 1.2, 1.4, 0.42],
    [3.7, -1.2, 1.6, 1.6, 1.12],
    [-4.8, -4.2, 1.9, 1.4, 0.78],
    [-2.2, -4.0, 1.4, 1.2, 0.42],
    [0.1, -4.2, 1.5, 1.5, 0.68],
    [2.9, -4.2, 1.8, 1.5, 0.94],
    [5.1, -3.7, 1.2, 1.2, 0.54],
    [5.5, 0.4, 1.1, 1.4, 0.66],
    [-6.3, -3.4, 1.2, 1.2, 0.46],
  ];
  const buildingMats = [];
  const edgeMats = [];
  blockBlueprint.forEach(([x, z, w, d, h], idx) => {
    const height = h * 1.7;
    const geometry = new THREE.BoxGeometry(w, height, d);
    const material = new THREE.MeshPhysicalMaterial({
      color: 0x0e392d,
      transmission: 0.08,
      transparent: true,
      opacity: 0.3,
      roughness: 0.22,
      metalness: 0.08,
      emissive: 0x4de6bb,
      emissiveIntensity: 0.22,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, height / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    blockGroup.add(mesh);
    buildingMats.push(material);
    const edgeGeometry = new THREE.EdgesGeometry(geometry);
    const edgeMaterial = new THREE.LineBasicMaterial({
      color: idx % 4 === 0 ? 0xb8e954 : 0x72ffd1,
      transparent: true,
      opacity: 0.85,
    });
    const edges = new THREE.LineSegments(edgeGeometry, edgeMaterial);
    edges.position.copy(mesh.position);
    blockGroup.add(edges);
    edgeMats.push(edgeMaterial);
  });
  // Exact street props
  const streetPropsGroup = new THREE.Group();
  streetPropsGroup.visible = false;
  root.add(streetPropsGroup);
  const roadStrip = new THREE.Mesh(
    new THREE.PlaneGeometry(6.2, 1.5),
    new THREE.MeshStandardMaterial({
      color: 0x102821,
      metalness: 0.12,
      roughness: 0.78,
      transparent: true,
      opacity: 0.86,
    }),
  );
  roadStrip.rotation.x = -Math.PI / 2;
  roadStrip.position.set(0, 0.02, 0);
  streetPropsGroup.add(roadStrip);
  const laneMat = new THREE.MeshBasicMaterial({
    color: 0xb8e954,
    transparent: true,
    opacity: 0.82,
  });
  for (let i = -2; i <= 2; i++) {
    const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.06), laneMat);
    dash.rotation.x = -Math.PI / 2;
    dash.position.set(i * 1.05, 0.03, 0);
    streetPropsGroup.add(dash);
  }
  const curbLeft = new THREE.Mesh(
    new THREE.BoxGeometry(6.2, 0.08, 0.2),
    new THREE.MeshBasicMaterial({ color: 0x2a6650, transparent: true, opacity: 0.5 }),
  );
  curbLeft.position.set(0, 0.04, 0.88);
  streetPropsGroup.add(curbLeft);
  const curbRight = curbLeft.clone();
  curbRight.position.z = -0.88;
  streetPropsGroup.add(curbRight);
  for (let i = 0; i < 4; i++) {
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.03, 1.1, 8),
      new THREE.MeshStandardMaterial({
        color: 0xc8fff2,
        emissive: 0x88ffd8,
        emissiveIntensity: 0.48,
      }),
    );
    pole.position.set(-2.3 + i * 1.6, 0.56, i % 2 === 0 ? 1.15 : -1.15);
    streetPropsGroup.add(pole);
    const lamp = new THREE.Mesh(
      new THREE.SphereGeometry(0.07, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0xb8e954 }),
    );
    lamp.position.set(pole.position.x, 1.15, pole.position.z);
    streetPropsGroup.add(lamp);
  }
  // Markers
  const markerGroup = new THREE.Group();
  root.add(markerGroup);
  const pickables = [];
  function makeMarker(point) {
    const marker = new THREE.Group();
    marker.position.copy(point.position);
    marker.userData.point = point;
    const line = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.03, 1.4, 10),
      new THREE.MeshBasicMaterial({ color: 0x94ffd9, transparent: true, opacity: 0.95 }),
    );
    line.position.y = 0.7;
    marker.add(line);
    const pulseRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.3, 0.035, 10, 24),
      new THREE.MeshBasicMaterial({ color: 0xb8e954, transparent: true, opacity: 0.78 }),
    );
    pulseRing.rotation.x = Math.PI / 2;
    pulseRing.position.y = 0.05;
    marker.add(pulseRing);
    const orb = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 20, 20),
      new THREE.MeshBasicMaterial({ color: 0xb8e954 }),
    );
    orb.position.y = 1.45;
    marker.add(orb);
    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(0.26, 20, 20),
      new THREE.MeshBasicMaterial({ color: 0x87ffd3, transparent: true, opacity: 0.24 }),
    );
    glow.position.copy(orb.position);
    marker.add(glow);
    marker.userData.orb = orb;
    marker.userData.glow = glow;
    marker.userData.ring = pulseRing;
    markerGroup.add(marker);
    pickables.push(marker);
  }
  points.forEach(makeMarker);
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  renderer.domElement.style.cursor = "grab";
  let hoverMarker = null;
  let activePoint = points[0];
  let timeMode = "day";
  let viewMode = "aerial";
  function setActiveButtons(buttons, activeValue, key) {
    buttons.forEach((button) => {
      const active = button.dataset[key] === activeValue;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }
  function updateModeLabels() {
    const timeText = timeMode === "day" ? "DIA" : timeMode === "dusk" ? "TARDE" : "NOITE";
    const viewText = viewMode === "street" ? "RUA EXATA" : "VISÃO AÉREA";
    labelMode.textContent = `${timeText} · ${viewText}`;
    stage.dataset.time = timeMode;
    stage.dataset.view = viewMode;
    btnAerial.classList.toggle("is-active", viewMode === "aerial");
    btnStreet.classList.toggle("is-active", viewMode === "street");
    btnAerial.setAttribute("aria-pressed", String(viewMode === "aerial"));
    btnStreet.setAttribute("aria-pressed", String(viewMode === "street"));
  }
  function applyTimeTheme(next) {
    timeMode = next;
    const themes = {
      day: {
        fog: 0x0a1a14,
        ambient: 1.14,
        hemi: 0.95,
        dir: 1.5,
        road: 0x7effd7,
        edge: 0xbefb67,
        build: 0x50eac0,
        clear: 0x0b1e18,
      },
      dusk: {
        fog: 0x19130f,
        ambient: 0.92,
        hemi: 0.82,
        dir: 1.2,
        road: 0xffcf7f,
        edge: 0xb8e954,
        build: 0xe0c16b,
        clear: 0x221911,
      },
      night: {
        fog: 0x06101b,
        ambient: 0.78,
        hemi: 0.7,
        dir: 0.95,
        road: 0x6cd8ff,
        edge: 0x8cffea,
        build: 0x5dd7ff,
        clear: 0x06101b,
      },
    };
    const t = themes[next] || themes.day;
    scene.fog.color.setHex(t.fog);
    ambient.intensity = t.ambient;
    hemi.intensity = t.hemi;
    dir.intensity = t.dir;
    base.material.color.setHex(t.clear);
    roadMats.forEach((m) => m.color.setHex(t.road));
    roadHighlightMats.forEach((m) => m.color.setHex(next === "night" ? 0xb8e954 : 0xd4ff6b));
    edgeMats.forEach((m, idx) => m.color.setHex(idx % 4 === 0 ? t.edge : t.road));
    buildingMats.forEach((m) => {
      m.emissive.setHex(t.build);
      m.emissiveIntensity = next === "night" ? 0.34 : next === "dusk" ? 0.26 : 0.22;
      m.opacity = next === "night" ? 0.34 : 0.28;
      m.color.setHex(next === "night" ? 0x0d2440 : next === "dusk" ? 0x2d2d23 : 0x0e392d);
    });
    setActiveButtons(buttonTime, next, "holoTime");
    updateModeLabels();
  }
  function setMarkerState() {
    markerGroup.children.forEach((marker) => {
      const isActive = activePoint && marker.userData.point.id === activePoint.id;
      marker.userData.orb.material.color.setHex(isActive ? 0xf6ff88 : 0xb8e954);
      marker.userData.glow.material.opacity = isActive ? 0.36 : 0.24;
      marker.scale.setScalar(isActive ? 1.08 : 1);
    });
    roadHighlights.forEach((item) => {
      item.material.opacity = activePoint && item.id === activePoint.id ? 0.85 : 0;
    });
  }
  function fillCard(point) {
    activePoint = point;
    cardFields.category.textContent = point.category;
    cardFields.title.textContent = point.title;
    cardFields.description.textContent = point.description;
    cardFields.street.textContent = `Via: ${point.street}`;
    cardFields.coords.textContent = `Coordenadas: ${point.coords}`;
    cardFields.status.textContent = `Status: ${point.status}`;
    labelSelection.textContent = `${point.category} · ${point.street}`;
    card.hidden = false;
    setMarkerState();
  }
  const tempTarget = new THREE.Vector3();
  function moveCamera(position, target, onComplete) {
    const g = window.gsap;
    if (!g) {
      camera.position.copy(position);
      controls.target.copy(target);
      controls.update();
      onComplete?.();
      return;
    }
    g.killTweensOf(camera.position);
    g.killTweensOf(controls.target);
    g.to(camera.position, {
      x: position.x,
      y: position.y,
      z: position.z,
      duration: 1.55,
      ease: "power3.inOut",
      onUpdate: () => controls.update(),
      onComplete,
    });
    g.to(controls.target, {
      x: target.x,
      y: target.y,
      z: target.z,
      duration: 1.55,
      ease: "power3.inOut",
      onUpdate: () => controls.update(),
    });
  }
  function goAerial() {
    viewMode = "aerial";
    controls.autoRotate = true;
    controls.maxPolarAngle = 1.28;
    controls.minPolarAngle = 0.75;
    streetPropsGroup.visible = false;
    moveCamera(aerialPose.position, aerialPose.target);
    updateModeLabels();
  }
  function goStreet(point = activePoint || points[0]) {
    if (!point) return;
    activePoint = point;
    fillCard(point);
    viewMode = "street";
    controls.autoRotate = false;
    controls.maxPolarAngle = 1.5;
    controls.minPolarAngle = 0.7;
    streetPropsGroup.visible = true;
    streetPropsGroup.position.set(point.position.x, 0, point.position.z);
    streetPropsGroup.rotation.y = Math.atan2(
      point.roadPath.at(-1).z - point.roadPath[0].z,
      point.roadPath.at(-1).x - point.roadPath[0].x,
    );
    const focus = point.position.clone().add(new THREE.Vector3(0, 0.55, 0));
    const direction = point.roadPath.at(-1).clone().sub(point.roadPath[0]).normalize();
    const side = new THREE.Vector3(-direction.z, 0, direction.x).multiplyScalar(1.4);
    const camPos = focus
      .clone()
      .add(side)
      .add(direction.clone().multiplyScalar(-2.0))
      .add(new THREE.Vector3(0, 1.55, 0));
    moveCamera(camPos, focus);
    updateModeLabels();
  }
  buttonTime.forEach((button) =>
    button.addEventListener("click", () => applyTimeTheme(button.dataset.holoTime)),
  );
  btnAerial?.addEventListener("click", goAerial);
  btnStreet?.addEventListener("click", () => goStreet(activePoint || points[0]));
  btnStreetAction?.addEventListener("click", () => goStreet(activePoint || points[0]));
  // Interaction
  function updatePointerPosition(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }
  renderer.domElement.addEventListener("pointermove", (event) => {
    updatePointerPosition(event);
    raycaster.setFromCamera(pointer, camera);
    const intersects = raycaster.intersectObjects(pickables, true);
    const marker = intersects[0]?.object?.parent?.userData?.point
      ? intersects[0].object.parent
      : intersects[0]?.object?.parent?.parent;
    if (marker && marker.userData && marker.userData.point) {
      hoverMarker = marker;
      renderer.domElement.style.cursor = "pointer";
    } else {
      hoverMarker = null;
      renderer.domElement.style.cursor = "grab";
    }
  });
  renderer.domElement.addEventListener("pointerdown", (event) => {
    updatePointerPosition(event);
    raycaster.setFromCamera(pointer, camera);
    const intersects = raycaster.intersectObjects(pickables, true);
    const found = intersects.find(
      (item) => item.object.parent?.userData?.point || item.object.parent?.parent?.userData?.point,
    );
    if (!found) return;
    const marker = found.object.parent?.userData?.point
      ? found.object.parent
      : found.object.parent?.parent;
    if (marker?.userData?.point) {
      fillCard(marker.userData.point);
      if (viewMode === "street") goStreet(marker.userData.point);
    }
  });
  renderer.domElement.addEventListener("pointerleave", () => {
    hoverMarker = null;
    renderer.domElement.style.cursor = "grab";
  });
  function resize() {
    const bounds = canvasHost.getBoundingClientRect();
    const width = Math.max(1, Math.round(bounds.width));
    const height = Math.max(1, Math.round(bounds.height));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(canvasHost);
  resize();
  // Default state
  applyTimeTheme("day");
  fillCard(points[0]);
  goAerial();
  const clock = new THREE.Clock();
  let raf = 0;
  function render() {
    raf = requestAnimationFrame(render);
    const t = clock.getElapsedTime();
    controls.update();
    markerGroup.children.forEach((marker, index) => {
      const baseScale = activePoint && marker.userData.point.id === activePoint.id ? 1.08 : 1;
      const pulse = 1 + Math.sin(t * 2.3 + index * 0.7) * 0.06;
      marker.userData.ring.scale.setScalar(pulse);
      marker.userData.ring.material.opacity = 0.36 + (Math.sin(t * 2.3 + index * 0.7) + 1) * 0.18;
      marker.userData.glow.scale.setScalar(1 + Math.sin(t * 1.8 + index) * 0.08);
      marker.scale.setScalar(baseScale * (hoverMarker === marker ? 1.08 : 1));
    });
    blockGroup.rotation.y = Math.sin(t * 0.16) * 0.02;
    roadMats.forEach((material, idx) => {
      material.opacity = 0.64 + Math.sin(t * 1.4 + idx) * 0.05;
    });
    renderer.render(scene, camera);
  }
  render();
  window.addEventListener(
    "pagehide",
    () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      renderer.dispose();
    },
    { once: true },
  );
})();
