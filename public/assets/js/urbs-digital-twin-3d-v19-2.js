/**
 * URBS V19.2 — LIVING CITY / DIGITAL TWIN 360°
 * Cena urbana procedural, dados 100% conceituais. Navegação 360° com OrbitControls,
 * arquitetura modelada com Three.js, raycasting, panorâmica, zoom e tour.
 * Não usa API, não representa edifícios ou ocorrências reais de Montes Claros.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
const stage = document.getElementById('city-stage');
const host = document.getElementById('urban-canvas');
if (stage && host) {
    try {
        initTwin();
    }
    catch (error) {
        showFailure(error);
    }
}
function showFailure(error) {
    console.warn('[URBS Digital Twin] Visualização 3D indisponível.', error);
    const loading = document.getElementById('twin-loading');
    if (loading) {
        loading.querySelector('strong').textContent = 'VISUALIZAÇÃO 3D INDISPONÍVEL';
        loading.querySelector('small').textContent = 'Verifique o WebGL e a conexão com as bibliotecas. O mapa de ocorrências continua acessível.';
        loading.querySelector('.twin-loading-orbit')?.remove();
    }
    stage.dataset.twinState = 'error';
}
function initTwin() {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const mobile = window.matchMedia('(max-width: 700px)').matches;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x07150f);
    scene.fog = new THREE.FogExp2(0x081d15, 0.0085);
    const camera = new THREE.PerspectiveCamera(mobile ? 41 : 39, 1, 0.1, 220);
    const homePos = new THREE.Vector3(mobile ? 61 : 49, mobile ? 59 : 42, mobile ? 64 : 54);
    const homeTarget = new THREE.Vector3(0, 1.6, 0);
    camera.position.copy(homePos);
    const renderer = new THREE.WebGLRenderer({ alpha: false, antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.1 : 1.6));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.85;
    renderer.shadowMap.enabled = !mobile;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(0x07150f, 1);
    renderer.domElement.setAttribute('aria-hidden', 'true');
    host.appendChild(renderer.domElement);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(homeTarget);
    controls.enableDamping = !reducedMotion;
    controls.dampingFactor = .065;
    controls.enablePan = false;
    controls.rotateSpeed = .57;
    controls.zoomSpeed = .78;
    controls.minDistance = mobile ? 18 : 13;
    controls.maxDistance = 110;
    controls.minPolarAngle = .13;
    controls.maxPolarAngle = Math.PI / 2.04; // 88°: permite perspectiva de rua sem atravessar o piso
    controls.enableRotate = true;
    controls.enableZoom = true;
    controls.autoRotate = !reducedMotion;
    controls.autoRotateSpeed = .18;
    controls.screenSpacePanning = false;
    controls.update();
    const hemisphere = new THREE.HemisphereLight(0xc7e1dd, 0x17271c, 2.25);
    scene.add(hemisphere);
    const ambient = new THREE.AmbientLight(0x7ba88b, .45);
    scene.add(ambient);
    const sunlight = new THREE.DirectionalLight(0xf7e9c9, 3.15);
    sunlight.position.set(36, 69, 28);
    sunlight.castShadow = !mobile;
    sunlight.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
    sunlight.shadow.camera.left = -45;
    sunlight.shadow.camera.right = 45;
    sunlight.shadow.camera.top = 45;
    sunlight.shadow.camera.bottom = -45;
    sunlight.shadow.camera.near = 1;
    sunlight.shadow.camera.far = 145;
    sunlight.shadow.bias = -.0004;
    sunlight.shadow.normalBias = .035;
    scene.add(sunlight);
    const edgeLight = new THREE.DirectionalLight(0xb8e954, .68);
    edgeLight.position.set(-29, 23, -32);
    scene.add(edgeLight);
    const moonLight = new THREE.DirectionalLight(0x93b9ca, 0);
    moonLight.position.set(-28, 42, -19);
    scene.add(moonLight);
    // Luz configurável: dia, entardecer e noite, com transição contínua no render.
    const lightingPresets = {
        day: { bg: 0x07150f, fog: 0x081d15, hemi: 2.25, ambient: .45, sun: 3.15, sunHex: 0xf7e9c9, hemiHex: 0xc7e1dd, sunPos: [36, 69, 28], moon: 0, edge: .68, exposure: 1.85, lamp: .18, pool: .07, window: .08, x: .15, label: 'SOL / 09:30' },
        dusk: { bg: 0x191b20, fog: 0x292921, hemi: 1.12, ambient: .31, sun: 1.52, sunHex: 0xffac72, hemiHex: 0xb3afa8, sunPos: [53, 15, -22], moon: .18, edge: .9, exposure: 1.48, lamp: 2.2, pool: .28, window: .7, x: .24, label: 'ENTARDECER / 18:15' },
        night: { bg: 0x060f1b, fog: 0x091b24, hemi: .52, ambient: .15, sun: .10, sunHex: 0x6d849c, hemiHex: 0x758ca6, sunPos: [-35, 15, -40], moon: 1.45, edge: .34, exposure: 1.30, lamp: 4.9, pool: .62, window: 1, x: .43, label: 'NOITE / 21:00' }
    };
    let timeMode = 'day';
    let xrayMode = 'all';
    let streetMode = false;
    const fogTarget = new THREE.Color(lightingPresets.day.fog);
    const skyTarget = new THREE.Color(lightingPresets.day.bg);
    const sunColorTarget = new THREE.Color(lightingPresets.day.sunHex);
    const hemiColorTarget = new THREE.Color(lightingPresets.day.hemiHex);
    const sunPosTarget = new THREE.Vector3(...lightingPresets.day.sunPos);
    const bulbDay = new THREE.Color(0x566c56), bulbNight = new THREE.Color(0xffe6a0);
    const daylightWindow = new THREE.Color(0x466b6a);
    const darkWindow = new THREE.Color(0x172c37);
    const warmWindow = new THREE.Color(0xffcc87);
    const headlightNight = new THREE.Color(0xfff4c0), headlightDay = new THREE.Color(0x756d57);
    const taillightNight = new THREE.Color(0xff6453), taillightDay = new THREE.Color(0x80392d);
    let targetTime = lightingPresets.day;
    // Paleta construída para combinar com a linguagem verde-escuro/lima do URBS,
    // mas sem voltar à maquete anterior feita apenas de contornos transparentes.
    const material = (color, extras = {}) => new THREE.MeshStandardMaterial({ color, roughness: .78, metalness: .09, ...extras });
    const asphalt = material(0x151d1b, { roughness: .97 });
    const darkAsphalt = material(0x1b2723, { roughness: .96 });
    const concrete = material(0x4b6053, { roughness: .95 });
    const pavement = material(0x809184, { roughness: .95 });
    const cream = material(0xc0c0a8, { roughness: .89 });
    const whiteLine = new THREE.MeshBasicMaterial({ color: 0xabb8a4, transparent: true, opacity: .65 });
    const crossing = new THREE.MeshBasicMaterial({ color: 0xe9e7d7, transparent: true, opacity: .94 });
    const grass = material(0x37583d, { roughness: 1 });
    const treeGreen = material(0x355d42, { roughness: 1, flatShading: true });
    const treeLime = material(0x6f9248, { roughness: 1, flatShading: true });
    const treeDark = material(0x284735, { roughness: 1, flatShading: true });
    const trunkMat = material(0x4d4931, { roughness: 1 });
    const darkMetal = material(0x2d3935, { metalness: .55, roughness: .52 });
    const glassBlue = material(0x678b89, { metalness: .42, roughness: .26 });
    const lightMetal = material(0xb2bcad, { metalness: .44, roughness: .38 });
    const neon = new THREE.MeshBasicMaterial({ color: 0xb8e954 });
    const roadGlow = new THREE.MeshBasicMaterial({ color: 0xb8e954, transparent: true, opacity: .16, depthWrite: false });
    const bulb = new THREE.MeshBasicMaterial({ color: 0xeaffc6 });
    const bulbSoft = new THREE.MeshBasicMaterial({ color: 0xeaffbd, transparent: true, opacity: .18, depthWrite: false });
    const towerMaterials = [
        material(0x748a7f, { roughness: .64, metalness: .17 }),
        material(0x9caa9b, { roughness: .84, metalness: .05 }),
        material(0x5b726d, { roughness: .57, metalness: .23 }),
        material(0x6d806d, { roughness: .92, metalness: .07 }),
        material(0xa0a38f, { roughness: .85, metalness: .03 }),
        material(0x4e645e, { roughness: .48, metalness: .23 })
    ];
    const windowLit = new THREE.MeshBasicMaterial({ color: 0xc9edaa });
    const windowCool = new THREE.MeshBasicMaterial({ color: 0x466b6a });
    const windowWarm = new THREE.MeshBasicMaterial({ color: 0xe0bb79 });
    const roofTop = material(0x384b43, { roughness: .91 });
    const city = new THREE.Group();
    scene.add(city);
    const box = new THREE.BoxGeometry(1, 1, 1);
    const plane = new THREE.PlaneGeometry(1, 1);
    const addBox = (parent, x, y, z, w, h, d, mat, cast = false) => {
        const mesh = new THREE.Mesh(box, mat);
        mesh.position.set(x, y, z);
        mesh.scale.set(w, h, d);
        mesh.castShadow = cast;
        mesh.receiveShadow = true;
        parent.add(mesh);
        return mesh;
    };
    let randomSeed = 27711;
    const rand = () => ((randomSeed = Math.imul(randomSeed, 1664525) + 1013904223 | 0) >>> 0) / 4294967296;
    // Plinto do bairro com espessura e contornos luminosos.
    addBox(city, 0, -1.2, 0, 68, 2.1, 68, material(0x122820, { roughness: 1 }), true);
    addBox(city, 0, -.11, 0, 66, .12, 66, darkAsphalt);
    addBox(city, 0, -2.28, 0, 68, .04, 68, new THREE.MeshBasicMaterial({ color: 0x9abf58 }));
    addBox(city, 0, -2.47, 0, 70, .12, 70, material(0x152c20));
    const foundationRing = new THREE.Mesh(new THREE.RingGeometry(37.7, 37.83, 112), new THREE.MeshBasicMaterial({ color: 0x99bd5e, transparent: true, opacity: .3, side: THREE.DoubleSide }));
    foundationRing.rotation.x = -Math.PI / 2;
    foundationRing.position.y = -2.45;
    city.add(foundationRing);
    // Vias e faixas: 4 x 4 quadras, com cruzamentos reconhecíveis.
    const roads = [-16, 0, 16];
    roads.forEach(c => {
        addBox(city, c, .033, 0, 4.9, .09, 64, asphalt);
        addBox(city, 0, .037, c, 64, .09, 4.9, asphalt);
    });
    // Pequenas faixas de divisão das pistas.
    const lineDashes = [];
    for (const c of roads) {
        for (let p = -30; p < 31; p += 4.7) {
            if (roads.some(k => Math.abs(p - k) < 3.7))
                continue;
            lineDashes.push({ x: c, z: p, rot: 0 }, { x: p, z: c, rot: 1 });
        }
    }
    const dashGeo = new THREE.BoxGeometry(.095, .014, 1.55);
    const dashMesh = new THREE.InstancedMesh(dashGeo, whiteLine, lineDashes.length);
    const temp = new THREE.Object3D();
    lineDashes.forEach((p, i) => { temp.position.set(p.x, .099, p.z); temp.rotation.set(0, p.rot ? Math.PI / 2 : 0, 0); temp.scale.set(1, 1, 1); temp.updateMatrix(); dashMesh.setMatrixAt(i, temp.matrix); });
    dashMesh.instanceMatrix.needsUpdate = true;
    city.add(dashMesh);
    // Travessias, ciclovias e quadrados de acessibilidade nos cruzamentos.
    const crossings = [];
    for (const x of roads)
        for (const z of roads) {
            for (let j = 0; j < 6; j++) {
                const p = -1.7 + j * .66;
                crossings.push({ x: x + p, z: z + 4.35, rot: 0 });
                crossings.push({ x: x + 4.35, z: z + p, rot: 1 });
            }
        }
    const stripeGeo = new THREE.BoxGeometry(.42, .018, 1.10);
    const stripeMesh = new THREE.InstancedMesh(stripeGeo, crossing, crossings.length);
    crossings.forEach((p, i) => { temp.position.set(p.x, .112, p.z); temp.rotation.set(0, p.rot ? Math.PI / 2 : 0, 0); temp.updateMatrix(); stripeMesh.setMatrixAt(i, temp.matrix); });
    stripeMesh.instanceMatrix.needsUpdate = true;
    city.add(stripeMesh);
    // Bairros: fachadas sólidas, telhados, lojas, rampas e áreas verdes.
    const blocks = [-24, -8, 8, 24];
    const buildings = [];
    const windowInstances = [[], [], []];
    const hits = [];
    const destinations = {
        mobility: { number: '01', name: 'MOBILIDADE URBANA', tag: 'RUAS E CONEXÕES', desc: 'Vias, cruzamentos e veículos em movimento revelam como a circulação conecta pessoas e oportunidades.', point: new THREE.Vector3(0, 1.3, 0), camera: [15, 19, 21], category: 'MOBILIDADE' },
        lighting: { number: '02', name: 'ILUMINAÇÃO PÚBLICA', tag: 'SEGURANÇA E VISIBILIDADE', desc: 'Postes e pontos luminosos mostram a importância da visibilidade para o uso noturno dos espaços.', point: new THREE.Vector3(16, 1.6, -16), camera: [31, 20, -2], category: 'ILUMINAÇÃO' },
        access: { number: '03', name: 'ACESSIBILIDADE', tag: 'ESPAÇOS PARA TODOS', desc: 'Calçadas, rampas e travessias demonstram como o desenho das ruas influencia o deslocamento de todos.', point: new THREE.Vector3(-16, 1.1, 0), camera: [-30, 17, 16], category: 'ACESSIBILIDADE' },
        green: { number: '04', name: 'ZELADORIA URBANA', tag: 'ÁREAS VERDES E CUIDADO', desc: 'Praças, arborização e espaços compartilhados representam a relação entre infraestrutura e bem-estar.', point: new THREE.Vector3(-8, 1.6, 8), camera: [4, 24, 25], category: 'ZELADORIA' }
    };
    const highlightLight = material(0xb8e954, { emissive: 0x7db922, emissiveIntensity: .2, roughness: .6 });
    const highlightLines = [];
    function addWindow(x, y, z, rotation = 0, tone = 0, w = .36, h = .55) {
        windowInstances[tone].push({ x, y, z, rotation, w, h });
    }
    const categoryFor = (x, z) => {
        if (x < -12)
            return 'access';
        if (z < -10 && x > 8)
            return 'lighting';
        if (x < 0 && z > 0)
            return 'green';
        return 'mobility';
    };
    function addBuilding(x, z, w, d, height, index) {
        const group = new THREE.Group();
        group.position.set(x, 0, z);
        city.add(group);
        const baseMat = towerMaterials[Math.floor(rand() * towerMaterials.length)];
        const body = addBox(group, 0, .32 + height / 2, 0, w, height, d, baseMat, true);
        body.userData.focus = categoryFor(x, z);
        body.userData.building = true;
        hits.push(body);
        // Pavimento térreo, laje e linhas construtivas reais, não só wireframe.
        addBox(group, 0, .62, 0, w + .22, .22, d + .20, concrete, true);
        addBox(group, 0, height + .42, 0, w + .26, .32, d + .26, roofTop, true);
        if (height > 10) {
            addBox(group, -w * .24, height + .79, 0, w * .21, .38, d * .24, darkMetal);
            addBox(group, w * .19, height + .57, -d * .23, w * .28, .06, d * .18, glassBlue);
        }
        else {
            addBox(group, 0, height + .62, 0, w * .84, .12, d * .80, material(0x526c5a));
        }
        // Cintas horizontais do edifício para escala e detalhe arquitetônico.
        const floors = Math.max(2, Math.floor(height / 1.45));
        for (let f = 1; f < floors; f += 2) {
            const level = f * height / floors + .34;
            addBox(group, 0, level, d / 2 + .025, w + .07, .055, .065, roofTop);
        }
        const columns = Math.max(2, Math.floor(w / .87));
        const rows = Math.max(2, Math.floor(height / 1.15));
        for (let floor = 1; floor < rows; floor++) {
            const y = .55 + floor * (height - .7) / rows;
            for (let col = 0; col < columns; col++) {
                const pos = -w / 2 + (col + .5) * w / columns;
                const tone = rand() > .72 ? 2 : rand() > .53 ? 0 : 1;
                addWindow(x + pos, y, z + d / 2 + .036, 0, tone, Math.min(.43, w / columns * .55), .48);
                addWindow(x + pos, y, z - d / 2 - .036, 0, rand() > .8 ? 2 : 1, Math.min(.43, w / columns * .55), .48);
            }
            const sideCols = Math.max(2, Math.floor(d / .95));
            for (let col = 0; col < sideCols; col++) {
                const pos = -d / 2 + (col + .5) * d / sideCols;
                addWindow(x + w / 2 + .036, y, z + pos, Math.PI / 2, rand() > .5 ? 1 : 0, .38, .48);
                addWindow(x - w / 2 - .036, y, z + pos, Math.PI / 2, rand() > .78 ? 2 : 1, .38, .48);
            }
        }
        // Fachadas térreas: vitrines e marquises, reforçam o aspecto de bairro vivo.
        if (height > 6 && rand() > .4) {
            addBox(group, 0, 1.24, d / 2 + .13, w * .85, 1.42, .12, glassBlue);
            addBox(group, 0, 2.02, d / 2 + .42, w * .94, .17, .9, darkMetal);
            addBox(group, 0, 2.07, d / 2 + .44, w * .82, .025, .15, neon);
        }
        buildings.push({ mesh: body, group, category: body.userData.focus, index });
    }
    const shadeTreeMeshes = [];
    const treeSites = [];
    function addTree(x, z, scale = 1) {
        addBox(city, x, .8 * scale, z, .23 * scale, 1.6 * scale, .23 * scale, trunkMat);
        const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 0), [treeGreen, treeLime, treeDark][Math.floor(rand() * 3)]);
        crown.position.set(x, 2.15 * scale, z);
        crown.scale.set(1.03 * scale, 1.22 * scale, 1.03 * scale);
        crown.castShadow = true;
        city.add(crown);
        shadeTreeMeshes.push(crown);
        treeSites.push({ x, z, scale });
    }
    function buildPark(x, z) {
        addBox(city, x, .24, z, 11.9, .42, 11.9, concrete, true);
        addBox(city, x, .49, z, 10.7, .085, 10.7, grass);
        // Passeios formando uma cruz no parque.
        addBox(city, x, .57, z, 1.15, .045, 10.4, pavement);
        addBox(city, x, .57, z, 10.4, .045, 1.15, pavement);
        const pond = new THREE.Mesh(new THREE.CircleGeometry(1.48, 48), new THREE.MeshStandardMaterial({ color: 0x3e776c, metalness: .5, roughness: .14 }));
        pond.rotation.x = -Math.PI / 2;
        pond.position.set(x + 3, .579, z - 3);
        city.add(pond);
        for (const a of [[-3.4, -3.5], [3.3, 3.6], [-3.8, 3.5], [3.8, -.2], [-1.7, 3.4], [-3.2, 1.2]])
            addTree(x + a[0], z + a[1], .7 + rand() * .18);
        // Bancos e pequenos elementos de mobiliário.
        for (const a of [[-1.9, -2.3], [2.2, 2.3]]) {
            addBox(city, x + a[0], .78, z + a[1], 1.35, .16, .43, cream);
            addBox(city, x + a[0] - .48, .53, z + a[1], .12, .45, .12, darkMetal);
            addBox(city, x + a[0] + .48, .53, z + a[1], .12, .45, .12, darkMetal);
        }
    }
    blocks.forEach((bx, col) => blocks.forEach((bz, row) => {
        // Bordas contínuas de passeio definem a separação entre vias e quadras.
        if (col === 1 && row === 2) {
            buildPark(bx, bz);
            return;
        }
        addBox(city, bx, .25, bz, 11.9, .42, 11.9, concrete, true);
        addBox(city, bx, .48, bz, 11.35, .075, 11.35, pavement);
        if ((row + col) % 4 === 0) {
            const w = 5.2 + rand() * .8, d = 5 + rand() * .8;
            const h = 12 + rand() * 13;
            addBuilding(bx - 2.25, bz - .3, w, d, h, buildings.length);
            addBuilding(bx + 3.0, bz + 2.9, 2.9, 2.7, 4.3 + rand() * 2.3, buildings.length);
            addTree(bx + 3.4, bz - 3.4, .75);
        }
        else {
            for (const [dx, dz] of [[-2.6, -2.5], [2.8, -2.3], [-2.4, 2.9], [2.8, 2.9]]) {
                if (rand() > .78) {
                    addTree(bx + dx, bz + dz, .7);
                    continue;
                }
                const h = 3.2 + rand() * 6 + ((col === 1 || col === 2) && (row === 1 || row === 2) ? rand() * 5 : 0);
                addBuilding(bx + dx, bz + dz, 3.7 + rand() * .45, 3.75 + rand() * .48, h, buildings.length);
            }
        }
    }));
    // Instancing de fachadas: milhares de janelas com apenas três draw calls.
    const windowGeo = new THREE.BoxGeometry(1, 1, .04);
    windowInstances.forEach((items, index) => {
        if (!items.length)
            return;
        const mesh = new THREE.InstancedMesh(windowGeo, [windowLit, windowCool, windowWarm][index], items.length);
        items.forEach((p, i) => {
            temp.position.set(p.x, p.y, p.z);
            temp.rotation.set(0, p.rotation, 0);
            temp.scale.set(p.w, p.h, 1);
            temp.updateMatrix();
            mesh.setMatrixAt(i, temp.matrix);
        });
        mesh.instanceMatrix.needsUpdate = true;
        mesh.frustumCulled = false;
        city.add(mesh);
    });
    // Guias de ciclovia e pontos destacados próximos aos principais cruzamentos.
    for (const side of [-1, 1]) {
        addBox(city, side * 3.1, .11, 0, .055, .018, 62, roadGlow);
    }
    const lamps = [];
    const lampPoints = [];
    const lampPositions = [];
    [-28, -20, -12, -4, 4, 12, 20, 28].forEach(p => {
        lampPositions.push({ x: -13, z: p }, { x: 13, z: p });
        if (p % 8 !== 4)
            lampPositions.push({ x: p, z: -13 }, { x: p, z: 13 });
    });
    const poleGeo = new THREE.CylinderGeometry(.06, .09, 3.35, 7);
    const headGeo = new THREE.BoxGeometry(.76, .10, .24);
    const bulbGeo = new THREE.SphereGeometry(.15, 8, 6);
    lampPositions.forEach((p, index) => {
        const pole = new THREE.Mesh(poleGeo, darkMetal);
        pole.position.set(p.x, 1.86, p.z);
        pole.castShadow = true;
        city.add(pole);
        const head = new THREE.Mesh(headGeo, darkMetal);
        head.position.set(p.x + .31, 3.49, p.z);
        city.add(head);
        const light = new THREE.Mesh(bulbGeo, bulb);
        light.position.set(p.x + .48, 3.39, p.z);
        city.add(light);
        const pool = new THREE.Mesh(new THREE.CircleGeometry(1.6, 18), bulbSoft);
        pool.rotation.x = -Math.PI / 2;
        pool.position.set(p.x, .12, p.z);
        city.add(pool);
        lamps.push(light);
        if (index % 9 === 0) {
            const point = new THREE.PointLight(0xd8f4c1, 3.2, 13, 2);
            point.position.set(p.x, 3.2, p.z);
            city.add(point);
            lampPoints.push(point);
        }
    });
    // Veículos modelados proceduralmente, seguindo rotas regulares.
    const headlightMat = new THREE.MeshBasicMaterial({ color: 0x756d57 });
    const taillightMat = new THREE.MeshBasicMaterial({ color: 0x80392d });
    const vehicles = [];
    const carMaterials = [material(0xb8e954, { metalness: .32, roughness: .4 }), material(0xd9d9c3, { metalness: .22, roughness: .42 }), material(0x718f8e, { metalness: .35, roughness: .45 }), material(0x8f6e5c, { metalness: .28, roughness: .58 })];
    function addCar(index, axis, line, dir, initial, speed) {
        const group = new THREE.Group();
        city.add(group);
        const isBus = index % 8 === 5;
        const vehicleLength = isBus ? 3.38 : 2.18;
        addBox(group, 0, .56, 0, isBus ? 1.33 : 1.23, isBus ? .82 : .52, vehicleLength, carMaterials[index % carMaterials.length], true);
        addBox(group, 0, isBus ? 1.28 : 1.0, -.22, isBus ? 1.2 : 1.08, isBus ? .67 : .49, isBus ? 2.55 : 1.13, glassBlue, true);
        if (isBus) {
            addBox(group, 0, 1.73, -.22, 1.22, .1, 2.5, lightMetal);
            addBox(group, 0, .92, .5, 1.37, .08, .09, neon);
        }
        for (const wheelZ of [-.68, .70])
            for (const wheelX of [-.62, .62]) {
                const wheel = new THREE.Mesh(new THREE.CylinderGeometry(.23, .23, .14, 10), darkMetal);
                wheel.rotation.z = Math.PI / 2;
                wheel.position.set(wheelX, .31, wheelZ);
                group.add(wheel);
            }
        for (const x of [-.38, .38]) {
            addBox(group, x, .56, -vehicleLength / 2 - .006, .22, .16, .06, headlightMat);
            addBox(group, x, .56, vehicleLength / 2 + .006, .20, .13, .04, taillightMat);
        }
        group.position.set(0, .11, 0);
        vehicles.push({ group, axis, line, dir, progress: initial, speed });
    }
    for (let i = 0; i < (mobile ? 10 : 16); i++) {
        const axis = i % 2 ? 'x' : 'z';
        const line = roads[Math.floor((i / 2) % 3)] + (i % 3 === 0 ? 1.21 : -1.21);
        addCar(i, axis, line, i % 4 < 2 ? 1 : -1, (i * 13.7) % 63, 2.0 + rand() * 1.6);
    }
    // V19.2 — a maquete ganha mobiliário urbano, pontos de ônibus, pedestres e semáforos.
    function addStop(x, z, rotation = 0) {
        const stop = new THREE.Group();
        stop.position.set(x, 0, z);
        stop.rotation.y = rotation;
        city.add(stop);
        addBox(stop, 0, 2.55, 0, 3.2, .15, 1.4, darkMetal);
        for (const sx of [-1.42, 1.42])
            for (const sz of [-.52, .52])
                addBox(stop, sx, 1.36, sz, .08, 2.5, .08, lightMetal);
        const glassPanel = material(0x4b7774, { transparent: true, opacity: .36, metalness: .25, roughness: .3, depthWrite: false });
        addBox(stop, 0, 1.43, .62, 2.86, 1.8, .06, glassPanel);
        addBox(stop, 0, .72, -.18, 1.65, .15, .43, cream);
        addBox(stop, -.65, .45, -.18, .12, .55, .12, darkMetal);
        addBox(stop, .65, .45, -.18, .12, .55, .12, darkMetal);
        addBox(stop, 0, 2.7, 0, 1.14, .065, .58, neon);
        return stop;
    }
    addStop(-13.0, 8.15, Math.PI / 2);
    addStop(12.9, -24.0, -Math.PI / 2);
    for (const [x, z] of [[-13, 24], [-3.3, -7], [19.2, 8], [3.3, -24.4]]) {
        addBox(city, x, .67, z, .7, 1.05, .65, darkMetal);
        addBox(city, x, 1.21, z, .74, .10, .69, grass);
    }
    const pedestrians = [];
    const clothing = [material(0x789d80), material(0xc3b18f), material(0x6f879a), material(0xb8e954), material(0x9d7779)];
    const skin = [material(0xd2a783), material(0x7c513c), material(0xb78266), material(0xe0bca0)];
    function addPerson(i) {
        const figure = new THREE.Group();
        city.add(figure);
        const clothes = clothing[i % clothing.length], skinMat = skin[Math.floor(rand() * skin.length)];
        addBox(figure, 0, 1.16, 0, .36, .76, .22, clothes);
        const head = new THREE.Mesh(new THREE.SphereGeometry(.19, 8, 6), skinMat);
        head.position.y = 1.79;
        figure.add(head);
        const leftLeg = addBox(figure, -.105, .46, 0, .12, .76, .14, darkMetal);
        const rightLeg = addBox(figure, .105, .46, 0, .12, .76, .14, darkMetal);
        const armL = addBox(figure, -.265, 1.13, 0, .11, .58, .14, skinMat);
        const armR = addBox(figure, .265, 1.13, 0, .11, .58, .14, skinMat);
        const road = roads[i % roads.length];
        const offset = i % 2 ? 3.55 : -3.55;
        const axis = i % 3 === 0 ? 'x' : 'z';
        const dir = i % 4 < 2 ? 1 : -1;
        pedestrians.push({ figure, leftLeg, rightLeg, armL, armR, axis, dir, line: road + offset, progress: rand() * 60, speed: .52 + rand() * .32, phase: rand() * 6.28 });
    }
    for (let i = 0; i < (mobile ? 10 : 20); i++)
        addPerson(i);
    const trafficSignals = [];
    function addTrafficSignal(x, z, axis) {
        const g = new THREE.Group();
        g.position.set(x, 0, z);
        city.add(g);
        addBox(g, 0, 1.77, 0, .105, 3.45, .105, darkMetal);
        addBox(g, 0, 3.26, 0, .45, .89, .34, darkMetal);
        const lights = [];
        for (let k = 0; k < 3; k++) {
            const materialSignal = new THREE.MeshBasicMaterial({ color: 0x17221b });
            const lamp = new THREE.Mesh(new THREE.SphereGeometry(.105, 10, 8), materialSignal);
            lamp.position.set(0, 3.55 - k * .28, .2);
            g.add(lamp);
            lights.push(lamp);
        }
        trafficSignals.push({ axis, lights });
    }
    for (const x of roads)
        for (const z of roads) {
            addTrafficSignal(x + 3.45, z + 3.45, 'x');
            addTrafficSignal(x - 3.45, z - 3.45, 'z');
        }
    function trafficPhase(now) {
        const p = (now / 1000) % 18;
        if (p < 7.5)
            return 'x';
        if (p < 9)
            return 'amber';
        if (p < 16.5)
            return 'z';
        return 'amber';
    }
    let lastSignalPhase = '';
    function updateSignalLights(phase) {
        if (phase === lastSignalPhase)
            return;
        lastSignalPhase = phase;
        trafficSignals.forEach(signal => {
            const green = signal.axis === phase;
            const yellow = phase === 'amber';
            const values = [green ? 0x223428 : yellow ? 0xffc857 : 0xff6348, yellow ? 0xffc857 : 0x3c3624, green ? 0xb8e954 : 0x203d2b];
            signal.lights.forEach((m, i) => m.material.color.setHex(values[i]));
        });
    }
    // Lentes 3D flutuantes: cada categoria destaca elementos concretos da cidade.
    const xrayLayers = {};
    for (const key of ['mobility', 'lighting', 'access', 'green']) {
        const group = new THREE.Group();
        group.visible = false;
        group.name = `URBS-XRAY-${key}`;
        city.add(group);
        xrayLayers[key] = group;
    }
    const overlayMat = (opacity = .72) => new THREE.MeshBasicMaterial({ color: 0xb8e954, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
    const overlayThin = overlayMat(.35), overlayStrong = overlayMat(.83);
    for (const r of roads) {
        addBox(xrayLayers.mobility, r, .154, 0, .19, .012, 61, overlayStrong);
        addBox(xrayLayers.mobility, 0, .155, r, 61, .012, .19, overlayStrong);
    }
    for (const x of roads)
        for (const z of roads) {
            const ring = new THREE.Mesh(new THREE.RingGeometry(1.7, 1.79, 48), overlayStrong);
            ring.rotation.x = -Math.PI / 2;
            ring.position.set(x, .17, z);
            xrayLayers.mobility.add(ring);
            for (const [sx, sz] of [[3.4, 0], [0, 3.4], [-3.4, 0], [0, -3.4]]) {
                const cross = new THREE.Mesh(new THREE.RingGeometry(.55, .7, 32), overlayMat(.62));
                cross.rotation.x = -Math.PI / 2;
                cross.position.set(x + sx, .64, z + sz);
                xrayLayers.access.add(cross);
            }
        }
    for (const p of lampPositions) {
        const beam = new THREE.Mesh(new THREE.CylinderGeometry(.11, .36, 2.8, 10, 1, true), overlayMat(.34));
        beam.position.set(p.x, 1.72, p.z);
        xrayLayers.lighting.add(beam);
        const circle = new THREE.Mesh(new THREE.RingGeometry(1.7, 1.79, 24), overlayStrong);
        circle.rotation.x = -Math.PI / 2;
        circle.position.set(p.x, .14, p.z);
        xrayLayers.lighting.add(circle);
    }
    const parkFrame = new THREE.Mesh(new THREE.RingGeometry(5.1, 5.3, 4), overlayStrong);
    parkFrame.rotation.x = -Math.PI / 2;
    parkFrame.rotation.z = Math.PI / 4;
    parkFrame.position.set(-8, .64, 8);
    xrayLayers.green.add(parkFrame);
    treeSites.forEach(p => {
        const ring = new THREE.Mesh(new THREE.RingGeometry(.5, .65, 24), overlayThin);
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(p.x, .63, p.z);
        xrayLayers.green.add(ring);
    });
    // Guias de mobilidade e sombras de dados são visíveis somente ao selecionar uma camada.
    function setXrayLayer(layer) {
        if (!['all', 'mobility', 'lighting', 'access', 'green'].includes(layer))
            return;
        xrayMode = layer;
        Object.entries(xrayLayers).forEach(([key, mesh]) => mesh.visible = key === layer);
        stage.dataset.twinXray = layer;
        document.querySelectorAll('[data-twin-layer]').forEach(btn => btn.setAttribute('aria-pressed', String(btn.dataset.twinLayer === layer)));
        if (layer !== 'all')
            chooseFocus(layer, false);
        else
            clearFocus();
    }
    // Chão de atmosfera visual, estrelas/partículas mantidas bem discretas.
    const dustPositions = [];
    for (let i = 0; i < 90; i++) {
        const x = (rand() - .5) * 125, z = (rand() - .5) * 125;
        dustPositions.push(x, 9 + rand() * 32, z);
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.Float32BufferAttribute(dustPositions, 3));
    const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: 0xa6c795, size: .14, transparent: true, opacity: .25, depthWrite: false }));
    scene.add(dust);
    // Marcação 3D dos pontos de interesse, pulsando sobre o território.
    const haloGroup = new THREE.Group();
    city.add(haloGroup);
    const haloObjects = [];
    const haloMat = new THREE.MeshBasicMaterial({ color: 0xb8e954, transparent: true, opacity: .57, side: THREE.DoubleSide, depthWrite: false });
    Object.entries(destinations).forEach(([key, item]) => {
        const disc = new THREE.Mesh(new THREE.RingGeometry(1.25, 1.34, 64), haloMat.clone());
        disc.rotation.x = -Math.PI / 2;
        disc.position.set(item.point.x, .29, item.point.z);
        haloGroup.add(disc);
        haloObjects.push({ key, mesh: disc });
        const stem = addBox(haloGroup, item.point.x, .81, item.point.z, .035, 1.1, .035, neon);
        stem.material = roadGlow;
    });
    const environmentLabel = document.getElementById('twin-environment-label');
    const modeLabel = document.getElementById('twin-camera-label');
    function setTimeOfDay(mode) {
        if (!lightingPresets[mode])
            return;
        timeMode = mode;
        targetTime = lightingPresets[mode];
        skyTarget.setHex(targetTime.bg);
        fogTarget.setHex(targetTime.fog);
        sunColorTarget.setHex(targetTime.sunHex);
        hemiColorTarget.setHex(targetTime.hemiHex);
        sunPosTarget.set(...targetTime.sunPos);
        stage.dataset.twinTime = mode;
        document.querySelectorAll('[data-twin-time]').forEach(btn => btn.setAttribute('aria-pressed', String(btn.dataset.twinTime === mode)));
        if (environmentLabel)
            environmentLabel.textContent = targetTime.label + ' · ILUMINAÇÃO SIMULADA';
    }
    document.querySelectorAll('[data-twin-time]').forEach(btn => btn.addEventListener('click', () => setTimeOfDay(btn.dataset.twinTime)));
    document.querySelectorAll('[data-twin-layer]').forEach(btn => btn.addEventListener('click', () => { setTour(false); setXrayLayer(btn.dataset.twinLayer); }));
    // O modo de rua não usa câmera FPS para evitar bloquear a rolagem vertical da homepage.
    // Mantemos OrbitControls e enquadramos a via na altura do pedestre.
    function toggleStreetMode(force) {
        streetMode = typeof force === 'boolean' ? force : !streetMode;
        const btn = document.getElementById('twin-street-mode');
        btn?.setAttribute('aria-pressed', String(streetMode));
        if (btn)
            btn.textContent = streetMode ? '↗ VOLTAR À VISÃO GERAL' : '↘ EXPLORAR AO NÍVEL DA RUA';
        if (modeLabel)
            modeLabel.textContent = streetMode ? 'CÂMERA DE PEDESTRE / 360°' : 'CÂMERA ORBITAL / 360°';
        stage.dataset.twinCamera = streetMode ? 'street' : 'orbit';
        controls.autoRotate = false;
        if (streetMode) {
            setTour(false);
            startFlight(new THREE.Vector3(1.1, 2.65, 23), new THREE.Vector3(1.1, 1.68, 7.6), 1.85);
        }
        else
            startFlight(homePos, homeTarget, 1.6);
    }
    document.getElementById('twin-street-mode')?.addEventListener('click', () => toggleStreetMode());
    const infoNumber = document.getElementById('twin-info-number');
    const infoTitle = document.getElementById('twin-info-title');
    const infoDesc = document.getElementById('twin-info-desc');
    const infoTag = document.getElementById('twin-info-tag');
    const infoState = document.getElementById('twin-info-state');
    const pinButtons = Array.from(stage.querySelectorAll('.twin-pin'));
    let currentFocus = null;
    let lastInteraction = performance.now();
    let flight = null;
    let dragging = false;
    let tourRunning = false;
    let tourIndex = 0;
    let nextTourAt = 0;
    const focusOrder = ['mobility', 'lighting', 'access', 'green'];
    const posTmp = new THREE.Vector3();
    function announce(info) {
        infoNumber.innerHTML = `${info.number} <span>/ 04</span>`;
        infoTitle.textContent = info.name;
        infoDesc.textContent = info.desc;
        infoTag.textContent = info.tag;
        infoState.textContent = 'CENA ILUSTRATIVA';
    }
    function startFlight(position, target, duration = 1.45) {
        flight = { start: camera.position.clone(), targetStart: controls.target.clone(), end: position.clone(), targetEnd: target.clone(), startTime: performance.now(), duration: reducedMotion ? 0 : duration * 1000 };
        if (reducedMotion) {
            camera.position.copy(position);
            controls.target.copy(target);
            controls.update();
            flight = null;
        }
    }
    function chooseFocus(key, fly = true) {
        const info = destinations[key];
        if (!info)
            return;
        const inspector = document.getElementById('twin-inspector');
        if (inspector)
            inspector.hidden = false;
        currentFocus = key;
        announce(info);
        pinButtons.forEach(b => { const active = b.dataset.twinFocus === key; b.classList.toggle('is-active', active); b.setAttribute('aria-pressed', String(active)); });
        if (fly)
            startFlight(new THREE.Vector3(...info.camera), info.point, 1.65);
    }
    function clearFocus() {
        const inspector = document.getElementById('twin-inspector');
        if (inspector)
            inspector.hidden = true;
        currentFocus = null;
        infoNumber.innerHTML = '00 <span>/ 04</span>';
        infoTitle.textContent = 'A CIDADE EM DETALHES.';
        infoDesc.textContent = 'Selecione um dos quatro pontos luminosos na maquete para descobrir diferentes camadas da infraestrutura urbana.';
        infoTag.textContent = 'EXPLORAÇÃO LIVRE';
        infoState.textContent = 'SIMULAÇÃO CONCEITUAL';
        pinButtons.forEach(b => { b.classList.remove('is-active'); b.setAttribute('aria-pressed', 'false'); });
    }
    function setTour(running) {
        tourRunning = running;
        const button = document.getElementById('twin-tour');
        if (button) {
            button.setAttribute('aria-pressed', String(running));
            button.innerHTML = running ? '<span aria-hidden="true">Ⅱ</span> PAUSAR TOUR' : '<span aria-hidden="true">▷</span> INICIAR TOUR';
        }
        if (running) {
            tourIndex = 0;
            chooseFocus(focusOrder[tourIndex], true);
            nextTourAt = performance.now() + 5200;
        }
    }
    pinButtons.forEach(button => button.addEventListener('click', () => { setTour(false); chooseFocus(button.dataset.twinFocus, true); }));
    document.getElementById('twin-reset')?.addEventListener('click', () => {
        setTour(false);
        clearFocus();
        streetMode = false;
        const streetBtn = document.getElementById('twin-street-mode');
        streetBtn?.setAttribute('aria-pressed', 'false');
        if (streetBtn)
            streetBtn.textContent = '↘ EXPLORAR AO NÍVEL DA RUA';
        if (modeLabel)
            modeLabel.textContent = 'CÂMERA ORBITAL / 360°';
        stage.dataset.twinCamera = 'orbit';
        setXrayLayer('all');
        startFlight(homePos, homeTarget, 1.5);
    });
    document.getElementById('twin-topview')?.addEventListener('click', () => {
        setTour(false);
        streetMode = false;
        stage.dataset.twinCamera = 'orbit';
        const streetBtn = document.getElementById('twin-street-mode');
        streetBtn?.setAttribute('aria-pressed', 'false');
        if (streetBtn)
            streetBtn.textContent = '↘ EXPLORAR AO NÍVEL DA RUA';
        if (modeLabel)
            modeLabel.textContent = 'CÂMERA ORBITAL / 360°';
        startFlight(new THREE.Vector3(.1, 75, .13), new THREE.Vector3(0, 1, 0), 1.6);
    });
    document.getElementById('twin-tour')?.addEventListener('click', () => setTour(!tourRunning));
    controls.addEventListener('start', () => { dragging = true; flight = null; lastInteraction = performance.now(); controls.autoRotate = false; if (tourRunning)
        setTour(false); });
    controls.addEventListener('end', () => { dragging = false; });
    // Raycaster: clicar em um edifício também explora a camada correspondente.
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const hoverOutline = new THREE.BoxHelper(hits[0], 0xb8e954);
    hoverOutline.visible = false;
    hoverOutline.material.transparent = true;
    hoverOutline.material.opacity = .89;
    hoverOutline.material.depthTest = false;
    city.add(hoverOutline);
    let lastHover = null;
    function findBuildingAt(event) {
        const rect = host.getBoundingClientRect();
        pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
        raycaster.setFromCamera(pointer, camera);
        return raycaster.intersectObjects(hits, false)[0]?.object || null;
    }
    host.addEventListener('pointermove', event => {
        if (dragging || pointerDown || event.pointerType === 'touch')
            return;
        const hit = findBuildingAt(event);
        if (hit === lastHover)
            return;
        lastHover = hit;
        hoverOutline.visible = Boolean(hit);
        host.style.cursor = hit ? 'pointer' : 'grab';
        if (hit) {
            hoverOutline.setFromObject(hit);
            if (!currentFocus)
                announce(destinations[hit.userData.focus]);
        }
        else if (!currentFocus) {
            clearFocus();
        }
    }, { passive: true });
    host.addEventListener('pointerleave', () => { lastHover = null; hoverOutline.visible = false; host.style.cursor = 'grab'; if (!currentFocus)
        clearFocus(); });
    let pointerDown = null;
    host.addEventListener('pointerdown', event => { pointerDown = { x: event.clientX, y: event.clientY }; });
    host.addEventListener('pointerup', event => {
        if (!pointerDown)
            return;
        const dist = Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y);
        pointerDown = null;
        if (dist > 7)
            return;
        const hit = findBuildingAt(event);
        if (hit) {
            setTour(false);
            chooseFocus(hit.userData.focus, true);
        }
    });
    // Estado inicial dos controles e luzes.
    setTimeOfDay('day');
    setXrayLayer('all');
    updateSignalLights(trafficPhase(performance.now()));
    // Toda a cena é observada sob qualquer azimute; nenhum evento bloqueia a rolagem da página.
    function updatePins() {
        const width = host.clientWidth, height = host.clientHeight;
        pinButtons.forEach(button => {
            const item = destinations[button.dataset.twinFocus];
            if (!item)
                return;
            posTmp.copy(item.point).add(new THREE.Vector3(0, 2.0, 0)).project(camera);
            const visible = posTmp.z < 1 && posTmp.z > -1 && Math.abs(posTmp.x) < .94 && Math.abs(posTmp.y) < .86;
            if (!visible) {
                button.style.opacity = '0';
                button.style.pointerEvents = 'none';
                return;
            }
            button.style.left = `${((posTmp.x + 1) / 2) * width}px`;
            button.style.top = `${((1 - posTmp.y) / 2) * height}px`;
            button.style.opacity = '1';
            button.style.pointerEvents = 'auto';
        });
    }
    const resize = () => {
        const w = Math.max(1, host.clientWidth), h = Math.max(1, host.clientHeight);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h, false);
        updatePins();
    };
    const resizer = new ResizeObserver(resize);
    resizer.observe(host);
    resize();
    let onScreen = true;
    let raf = 0;
    let lastTime = performance.now();
    let frames = 0;
    const observer = new IntersectionObserver(entries => { onScreen = entries.some(x => x.isIntersecting); }, { threshold: .01 });
    observer.observe(stage);
    const loading = document.getElementById('twin-loading');
    function frame(now) {
        raf = requestAnimationFrame(frame);
        if (!onScreen || document.hidden) {
            lastTime = now;
            return;
        }
        const dt = Math.min((now - lastTime) / 1000, .07);
        lastTime = now;
        const easeEnv = 1 - Math.exp(-dt * 2.3);
        const dim = xrayMode === 'all' ? 1 : .65;
        scene.background.lerp(skyTarget, easeEnv);
        scene.fog.color.lerp(fogTarget, easeEnv);
        sunlight.color.lerp(sunColorTarget, easeEnv);
        sunlight.position.lerp(sunPosTarget, easeEnv);
        hemisphere.color.lerp(hemiColorTarget, easeEnv);
        hemisphere.intensity += ((targetTime.hemi * dim) - hemisphere.intensity) * easeEnv;
        ambient.intensity += ((targetTime.ambient * dim) - ambient.intensity) * easeEnv;
        sunlight.intensity += ((targetTime.sun * dim) - sunlight.intensity) * easeEnv;
        moonLight.intensity += ((targetTime.moon * dim) - moonLight.intensity) * easeEnv;
        edgeLight.intensity += ((targetTime.edge * (xrayMode === 'all' ? 1 : 2.7)) - edgeLight.intensity) * easeEnv;
        const targetExposure = targetTime.exposure * (xrayMode === 'all' ? 1 : .82);
        renderer.toneMappingExposure += (targetExposure - renderer.toneMappingExposure) * easeEnv;
        bulbSoft.opacity += (targetTime.pool - bulbSoft.opacity) * easeEnv;
        bulb.color.lerp(timeMode === 'day' ? bulbDay : bulbNight, easeEnv);
        lampPoints.forEach(point => point.intensity += (targetTime.lamp - point.intensity) * easeEnv);
        windowWarm.color.lerp(warmWindow, easeEnv * .42);
        windowCool.color.lerp(timeMode === 'night' ? darkWindow : daylightWindow, easeEnv);
        headlightMat.color.lerp(timeMode === 'night' ? headlightNight : headlightDay, easeEnv);
        taillightMat.color.lerp(timeMode === 'night' ? taillightNight : taillightDay, easeEnv);
        dust.material.opacity += ((timeMode === 'night' ? .48 : .23) - dust.material.opacity) * easeEnv;
        if (flight) {
            const t = flight.duration === 0 ? 1 : Math.min(1, (now - flight.startTime) / flight.duration);
            const eased = t * t * (3 - 2 * t);
            camera.position.lerpVectors(flight.start, flight.end, eased);
            controls.target.lerpVectors(flight.targetStart, flight.targetEnd, eased);
            if (t === 1)
                flight = null;
        }
        if (tourRunning && now >= nextTourAt) {
            tourIndex = (tourIndex + 1) % focusOrder.length;
            chooseFocus(focusOrder[tourIndex], true);
            nextTourAt = now + 5500;
        }
        if (!reducedMotion) {
            // Semáforos alternam o fluxo entre eixos, com uma curta transição amarela.
            const phase = trafficPhase(now);
            updateSignalLights(phase);
            vehicles.forEach(vehicle => {
                let distance = dt * vehicle.speed;
                const t = (vehicle.progress - 32) * vehicle.dir;
                if (phase !== vehicle.axis) {
                    const upcoming = roads.map(c => (c - t) * vehicle.dir).filter(d => d > 0).sort((a, b) => a - b)[0];
                    if (upcoming !== undefined && upcoming < 3.6)
                        distance = Math.min(distance, Math.max(0, upcoming - 2.9));
                }
                vehicle.progress = (vehicle.progress + distance) % 64;
                const next = (vehicle.progress - 32) * vehicle.dir;
                if (vehicle.axis === 'z') {
                    vehicle.group.position.set(vehicle.line, .11, next);
                    vehicle.group.rotation.y = vehicle.dir === 1 ? Math.PI : 0;
                }
                else {
                    vehicle.group.position.set(next, .11, vehicle.line);
                    vehicle.group.rotation.y = vehicle.dir === 1 ? Math.PI / 2 : -Math.PI / 2;
                }
            });
            pedestrians.forEach(person => {
                person.progress = (person.progress + dt * person.speed) % 60;
                const t = (person.progress - 30) * person.dir;
                if (person.axis === 'z') {
                    person.figure.position.set(person.line, .56, t);
                    person.figure.rotation.y = person.dir === 1 ? Math.PI : 0;
                }
                else {
                    person.figure.position.set(t, .56, person.line);
                    person.figure.rotation.y = person.dir === 1 ? Math.PI / 2 : -Math.PI / 2;
                }
                const step = Math.sin(now * .005 + person.phase);
                person.leftLeg.rotation.x = step * .30;
                person.rightLeg.rotation.x = -step * .30;
                person.armL.rotation.x = -step * .23;
                person.armR.rotation.x = step * .23;
            });
            haloObjects.forEach((item, i) => { item.mesh.material.opacity = (item.key === currentFocus ? .78 : .30) + .15 * Math.sin(now * .0017 + i * 1.7); item.mesh.scale.setScalar(1 + .06 * Math.sin(now * .002 + i)); });
        }
        if (!tourRunning && !dragging && !flight && !currentFocus && !reducedMotion && now - lastInteraction > 6500)
            controls.autoRotate = true;
        if (flight || currentFocus || tourRunning)
            controls.autoRotate = false;
        controls.update();
        if (++frames % 2 === 0)
            updatePins();
        if (frames % 8 === 0) {
            const az = (controls.getAzimuthalAngle() * 180 / Math.PI + 360) % 360;
            const readout = document.getElementById('twin-azimuth');
            if (readout)
                readout.textContent = `AZIMUTE ${String(Math.round(az)).padStart(3, '0')}° / ÓRBITA 360°`;
        }
        renderer.render(scene, camera);
        if (frames === 2) {
            stage.dataset.twinState = 'ready';
            if (loading)
                loading.hidden = true;
        }
    }
    raf = requestAnimationFrame(frame);
    window.addEventListener('pagehide', () => {
        cancelAnimationFrame(raf);
        observer.disconnect();
        resizer.disconnect();
        controls.dispose();
        renderer.dispose();
        scene.traverse(object => {
            if (object.geometry && object.geometry !== box)
                object.geometry.dispose();
            if (object.material) {
                const mats = Array.isArray(object.material) ? object.material : [object.material];
                mats.forEach(mat => mat.dispose?.());
            }
        });
        box.dispose();
    }, { once: true });
}
