/* URBS V6 — Globo satélite real, inspirado na experiência de navegação Earth.
 * CesiumJS + Esri World Imagery, sem copiar imagens/código do Google Earth.
 * Mantenha as atribuições do provedor visíveis na cena.
 * Login e cadastro usam a API PHP do projeto.
 */
(() => {
    'use strict';
    const root = document.querySelector('.auth-experience');
    if (!root)
        return;
    const C = window.Cesium;
    const gsap = window.gsap;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const host = document.getElementById('planet-canvas');
    const status = document.querySelector('.screen-reader-status');
    const planetZone = document.querySelector('.planet-zone');
    const loginSide = document.getElementById('login-side');
    const registerSide = document.getElementById('register-side');
    const WORLD_IMAGERY = 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer';
    let mode = 'login', entering = false, viewer = null, raf = 0, lastTime = 0;
    let pointerX = 0, pointerY = 0, panX = 0, panY = 0, switching = false;
    let dragging = false, dragX = 0, dragY = 0, lastDrag = 0;
    const globe = { rotation: { y: 0 } }; // Proxy animável pelo GSAP; vira longitude da câmera Cesium.
    const initialCenter = { lon: 23, lat: 15 }; // África e Oriente Médio.
    function fallback(message) {
        host?.classList.add('globe-fallback');
        if (status)
            status.textContent = message || 'Globo de satélite indisponível; formulários disponíveis.';
    }
    function resizeGlobe() {
        if (!viewer)
            return;
        const touch = matchMedia('(pointer: coarse)').matches;
        const pixels = Math.max(1, host.clientWidth * host.clientHeight);
        const ratio = window.devicePixelRatio || 1;
        const pixelBudget = touch ? 1800000 : 3800000;
        const targetRatio = touch ? Math.min(ratio, 1.7) : Math.min(ratio * 1.3, 2);
        viewer.resolutionScale = Math.min(targetRatio, Math.sqrt(pixelBudget / pixels)) / ratio;
        globeCamera();
    }
    function globeCamera() {
        if (!viewer || viewer.isDestroyed() || entering)
            return;
        const mobile = innerWidth <= 760;
        const lon = initialCenter.lon + C.Math.toDegrees(globe.rotation.y) + panX * 2.0;
        const lat = initialCenter.lat + panY * 1.3;
        // Câmera acima do centro geográfico da Terra. O movimento da longitude
        // equivale à rotação do planeta, preservando relevo e geografia reais.
        const height = mobile ? 15200000 : 13100000;
        viewer.camera.setView({
            destination: C.Cartesian3.fromDegrees(lon, lat, height),
            orientation: { heading: 0, pitch: -C.Math.PI_OVER_TWO, roll: 0 }
        });
    }
    async function loadGlobeImagery(currentViewer) {
        const addLayer = (provider, index) => {
            if (!currentViewer.isDestroyed())
                currentViewer.imageryLayers.addImageryProvider(provider, index);
        };
        // O mosaico local aparece enquanto o satélite carrega e cobre falhas de rede.
        const results = await Promise.allSettled([
            C.SingleTileImageryProvider.fromUrl('assets/textures/earth-day.jpg', {
                credit: 'NASA / Earth Observatory · Blue Marble'
            }).then(provider => addLayer(provider, 0)),
            C.ArcGisMapServerImageryProvider.fromUrl(WORLD_IMAGERY, {
                enablePickFeatures: false
            }).then(provider => addLayer(provider))
        ]);
        if (results.every(result => result.status === 'rejected') && viewer === currentViewer) {
            currentViewer.destroy();
            viewer = null;
            fallback();
        }
    }
    async function addOceanReflection(currentViewer) {
        const mask = new Image();
        mask.src = 'assets/textures/ocean-mask.png';
        try {
            await mask.decode();
        }
        catch {
            return;
        }
        if (currentViewer.isDestroyed())
            return;

        // A direção da luz acompanha a câmera, inclusive no lado oposto do globo.
        const material = new C.Material({
            fabric: {
                uniforms: { oceanMask: mask, reflectionStrength: 0 },
                source: `
                    czm_material czm_getMaterial(czm_materialInput inputData) {
                        czm_material material = czm_getDefaultMaterial(inputData);
                        vec3 worldPosition = (czm_inverseView3D * vec4(-inputData.positionToEyeEC, 1.0)).xyz;
                        vec3 surface = normalize(worldPosition * vec3(1.0, 1.0, 1.0067395));
                        vec2 uv = vec2(atan(surface.y, surface.x) / czm_twoPi + .5, asin(clamp(surface.z, -1.0, 1.0)) / czm_pi + .5);
                        float water = smoothstep(.2, .8, texture(oceanMask, uv).r);

                        vec3 sun = normalize(czm_inverseViewRotation3D * vec3(-.99, -.12, .045));
                        vec3 eye = normalize(czm_inverseViewRotation3D * inputData.positionToEyeEC);
                        vec3 halfAngle = normalize(sun + eye);
                        float alignment = max(dot(surface, halfAngle), 0.0);
                        float facing = max(dot(surface, eye), 0.0);
                        float daylight = smoothstep(0.0, .22, dot(surface, sun));

                        vec3 east = normalize(vec3(-surface.y, surface.x, .0001));
                        vec3 north = normalize(cross(surface, east));
                        float eastOffset = dot(east, halfAngle);
                        float crossSpread = eastOffset * eastOffset;
                        float body = pow(alignment, 53.0) * exp(-12.0 * crossSpread);
                        float halo = pow(alignment, 12.0) * exp(-4.0 * crossSpread);

                        // As ondas alteram a orientação da água. Suavize o detalhe subpixel.
                        vec3 waves = vec3(
                            dot(surface, vec3(122.0, -78.0, 248.0)),
                            dot(surface, vec3(68.0, 123.0, 171.0)),
                            dot(surface, vec3(181.0, 61.0, -94.0))
                        );
                        vec3 footprint = fwidth(waves);
                        float detail = 1.0 - smoothstep(.5, 1.55, max(footprint.x, max(footprint.y, footprint.z)));
                        float eastWave = .023 * sin(waves.x + .8 * sin(waves.y)) + .012 * cos(waves.z);
                        float northWave = .018 * sin(waves.y + .7 * cos(waves.z)) + .010 * cos(waves.x);
                        vec3 waveNormal = normalize(surface + detail * (eastWave * east + northWave * north));
                        float sparkle = pow(max(dot(waveNormal, halfAngle), 0.0), 158.0);

                        // Fresnel da água e compressão gradual dos brilhos mais intensos.
                        float fresnel = .02 + .98 * pow(1.0 - clamp(dot(eye, halfAngle), 0.0, 1.0), 5.0);
                        float fresnelGain = min(1.3, .9 + 2.4 * fresnel);
                        float sheen = .12 * pow(facing, .85);
                        float energy = sheen + daylight * fresnelGain * (1.20 * sparkle + .62 * body + .28 * halo);
                        float visible = smoothstep(0.0, .18, facing);
                        float tint = smoothstep(.03, .65, body + .3 * halo);
                        material.diffuse = mix(vec3(.48, .66, .85), vec3(1.0, .97, .88), tint);
                        material.alpha = water * .94 * (1.0 - exp(-reflectionStrength * energy)) * visible;
                        return material;
                    }
                `
            }
        });
        currentViewer.scene.globe.material = material;

        // A textura é enviada à GPU pelo Cesium após o material entrar em uso.
        let frames = 0;
        const removeListener = currentViewer.scene.postRender.addEventListener(() => {
            if (++frames === 2) {
                material.uniforms.reflectionStrength = 1.0;
                removeListener();
            }
        });
    }
    function initGlobe() {
        if (!C || !host) {
            fallback();
            return;
        }
        try {
            // CesiumJS é usado apenas como renderizador. Sem controles ou interface de mapa.
            // O usuário vê um planeta limpo, preservando créditos de imagem obrigatórios.
            viewer = new C.Viewer(host, {
                animation: false, timeline: false, fullscreenButton: false,
                homeButton: false, navigationHelpButton: false, sceneModePicker: false,
                baseLayerPicker: false, geocoder: false, infoBox: false,
                selectionIndicator: false, baseLayer: false,
                terrainProvider: new C.EllipsoidTerrainProvider(),
                skyBox: false, sun: false, moon: false,
                contextOptions: { webgl: { alpha: true } },
                useBrowserRecommendedResolution: false,
                msaaSamples: matchMedia('(pointer: coarse)').matches ? 2 : 4,
                requestRenderMode: false, shouldAnimate: true
            });
            viewer.scene.globe.enableLighting = false;
            viewer.scene.globe.show = true;
            viewer.scene.globe.baseColor = C.Color.fromCssColorString('#123049');
            viewer.scene.globe.maximumScreenSpaceError = matchMedia('(pointer: coarse)').matches ? 1.6 : 1.15;
            viewer.scene.backgroundColor = C.Color.TRANSPARENT;
            viewer.scene.skyAtmosphere.show = true;
            viewer.scene.fog.enabled = false;
            viewer.scene.screenSpaceCameraController.enableInputs = false;
            viewer.scene.globe.showGroundAtmosphere = true;
            resizeGlobe();
            window.addEventListener('resize', resizeGlobe);
            void loadGlobeImagery(viewer);
            void addOceanReflection(viewer);
            lastTime = performance.now();
            function animate(now) {
                if (!viewer || entering) {
                    raf = 0;
                    return;
                }
                raf = requestAnimationFrame(animate);
                const dt = Math.min(.06, (now - lastTime) / 1000 || 0);
                lastTime = now;
                if (!switching && !dragging && !reduced && now - lastDrag > 2200)
                    globe.rotation.y += .014 * dt; // Reinicia ao soltar / ficar inativo.
                panX += (pointerX - panX) * Math.min(1, dt * 1.6);
                panY += (pointerY - panY) * Math.min(1, dt * 1.6);
                globeCamera();
            }
            raf = requestAnimationFrame(animate);
            document.addEventListener('visibilitychange', () => {
                if (document.hidden) {
                    cancelAnimationFrame(raf);
                    raf = 0;
                }
                else if (!raf && viewer && !entering) {
                    lastTime = performance.now();
                    raf = requestAnimationFrame(animate);
                }
            });
            window.addEventListener('pagehide', event => {
                if (event.persisted)
                    return;
                cancelAnimationFrame(raf);
                window.removeEventListener('resize', resizeGlobe);
                if (viewer && !viewer.isDestroyed())
                    viewer.destroy();
                viewer = null;
            });
        }
        catch (err) {
            console.warn('URBS: CesiumJS indisponível.', err);
            fallback();
        }
    }
    // Arrastar no globo altera a longitude e latitude em tempo real. O globo
    // retoma sua rotação lenta após 2,2 s sem interação; nenhum controle Cesium interfere.
    planetZone.addEventListener('pointerdown', e => {
        if (entering || switching || e.button !== 0 || e.target.closest('.cesium-viewer-bottom'))
            return;
        dragging = true;
        dragX = e.clientX;
        dragY = e.clientY;
        lastDrag = performance.now();
        planetZone.classList.add('is-dragging');
        try {
            planetZone.setPointerCapture(e.pointerId);
        }
        catch (_) { }
    });
    planetZone.addEventListener('pointermove', e => {
        if (!dragging || entering)
            return;
        const dx = e.clientX - dragX, dy = e.clientY - dragY;
        globe.rotation.y -= dx * .006;
        panY = Math.max(-26, Math.min(26, panY + dy * .12));
        pointerY = panY;
        dragX = e.clientX;
        dragY = e.clientY;
        lastDrag = performance.now();
        globeCamera();
    });
    const stopDrag = () => { dragging = false; lastDrag = performance.now(); planetZone.classList.remove('is-dragging'); };
    planetZone.addEventListener('pointerup', stopDrag);
    planetZone.addEventListener('pointercancel', stopDrag);
    planetZone.addEventListener('lostpointercapture', stopDrag);
    document.addEventListener('pointermove', event => {
        if (reduced || entering || event.pointerType === 'touch')
            return;
        pointerX = (event.clientX / innerWidth - .5) * 2;
        if (!dragging)
            pointerY = (event.clientY / innerHeight - .5) * 2;
    }, { passive: true });
    // Alternância exatamente em 1,2 s: globo muda de metade + longitude da câmera.
    function switchMode(next) {
        if (entering || next === mode || switching)
            return;
        const toRegister = next === 'register';
        const outgoing = toRegister ? loginSide : registerSide;
        const incoming = toRegister ? registerSide : loginSide;
        const mobile = matchMedia('(max-width:760px)').matches;
        mode = next;
        root.dataset.mode = next;
        outgoing.inert = true;
        outgoing.setAttribute('aria-hidden', 'true');
        incoming.inert = false;
        incoming.removeAttribute('aria-hidden');
        incoming.style.pointerEvents = 'auto';
        outgoing.style.pointerEvents = 'none';
        const done = () => {
            incoming.style.visibility = 'visible';
            incoming.style.opacity = '1';
            incoming.style.transform = 'translateX(0px)';
            outgoing.style.visibility = 'hidden';
            switching = false;
        };
        if (!gsap || reduced) {
            planetZone.style.left = mobile ? '0%' : toRegister ? '0%' : '50%';
            globe.rotation.y += toRegister ? -1.7 : 1.7;
            outgoing.style.visibility = 'hidden';
            outgoing.style.opacity = '0';
            incoming.style.visibility = 'visible';
            done();
            globeCamera();
        }
        else {
            gsap.killTweensOf([planetZone, outgoing, incoming, globe.rotation]);
            switching = true;
            const tl = gsap.timeline({ onComplete: done });
            tl.to(outgoing, { autoAlpha: 0, x: toRegister ? -85 : 85, duration: .48, ease: 'power2.in' }, 0)
                .set(incoming, { visibility: 'visible', opacity: 0, x: toRegister ? 85 : -85 }, .35)
                .to(incoming, { autoAlpha: 1, x: 0, duration: .75, ease: 'power3.out' }, .45);
            if (!mobile)
                tl.to(planetZone, { left: toRegister ? '0%' : '50%', duration: 1.2, ease: 'power3.inOut' }, 0);
            tl.to(globe.rotation, { y: globe.rotation.y + (toRegister ? -1.7 : 1.7), duration: 1.2, ease: 'power2.inOut', onUpdate: globeCamera }, 0);
        }
        if (status)
            status.textContent = toRegister ? 'Cadastro à direita. Terra à esquerda.' : 'Login à esquerda. Terra à direita.';
    }
    document.querySelectorAll('[data-switch]').forEach(btn => btn.addEventListener('click', () => {
        const next = btn.dataset.switch;
        switchMode(next);
        setTimeout(() => document.getElementById(next === 'login' ? 'login-email' : 'register-name')?.focus({ preventScroll: true }), reduced ? 0 : 1250);
    }));
    document.querySelectorAll('.show-password').forEach(btn => btn.addEventListener('click', () => {
        const field = document.getElementById(btn.dataset.target);
        const show = field.type === 'password';
        field.type = show ? 'text' : 'password';
        btn.textContent = show ? 'OCULTAR' : 'MOSTRAR';
        btn.setAttribute('aria-label', show ? 'Ocultar senha' : 'Mostrar senha');
    }));
    async function enterExperience(event) {
        event.preventDefault();
        if (entering)
            return;
        const form = event.currentTarget, error = form.querySelector('.field-error');
        error.textContent = '';
        if (!form.checkValidity()) {
            const field = form.querySelector(':invalid');
            error.textContent = field?.validity.typeMismatch ? 'Digite um e-mail válido.' : field?.validity.tooShort ? 'Campo com menos caracteres do que o mínimo exigido.' : 'Preencha todos os campos obrigatórios.';
            field?.focus();
            return;
        }
        if (form.id === 'register-form') {
            const pass = document.getElementById('register-password');
            const confirm = document.getElementById('register-confirm');
            if (pass.value !== confirm.value) {
                error.textContent = 'As senhas não coincidem.';
                confirm.focus();
                return;
            }
        }
        const button = form.querySelector('.submit-button');
        const originalLabel = button?.textContent;
        if (button) {
            button.disabled = true;
            button.textContent = 'CONECTANDO…';
        }
        document.querySelectorAll('.switch-link').forEach(item => item.disabled = true);
        try {
            if (!window.UrbsAPI)
                throw new Error('A conexão com a API não foi iniciada. Atualize a página.');
            const register = form.id === 'register-form';
            const payload = register
                ? {
                    name: document.getElementById('register-name').value.trim(),
                    email: document.getElementById('register-email').value.trim(),
                    password: document.getElementById('register-password').value
                }
                : {
                    email: document.getElementById('login-email').value.trim(),
                    password: document.getElementById('login-password').value
                };
            const result = await window.UrbsAPI.request(
                register ? 'auth/register.php' : 'auth/login.php',
                { method: 'POST', body: payload }
            );
            entering = true;
            form.reset();
            if (status)
                status.textContent = `Acesso confirmado. Iniciando a experiência URBS${result.user?.name ? ` para ${result.user.name}` : ''}.`;
        } catch (apiError) {
            error.textContent = apiError.message || 'Não foi possível entrar. Tente novamente.';
            if (button) {
                button.disabled = false;
                button.textContent = originalLabel;
            }
            document.querySelectorAll('.switch-link').forEach(item => item.disabled = false);
            return;
        }
        root.classList.add('is-departing');
        document.querySelectorAll('.submit-button,.switch-link').forEach(btn => btn.disabled = true);
        const beginFlight = () => {
            if (window.URBSGeoDescent)
                window.URBSGeoDescent.start();
            else {
                const overlay = document.querySelector('.arrival-overlay');
                overlay.style.display = 'flex';
                overlay.style.opacity = '1';
                setTimeout(() => location.assign('index.html'), 1500);
            }
        };
        // Primeiro desaparecem formulário e cabeçalho; só então aparece o Cesium.
        const elements = [...document.querySelectorAll('.form-side:not([aria-hidden="true"]),.topline,.bottomline')];
        if (gsap && !reduced) {
            gsap.to(elements, { autoAlpha: 0, y: -20, duration: .55, stagger: .035, ease: 'power2.inOut', onComplete: beginFlight });
        }
        else {
            elements.forEach(el => el.style.visibility = 'hidden');
            beginFlight();
        }
    }
    document.getElementById('login-form')?.addEventListener('submit', enterExperience);
    document.getElementById('register-form')?.addEventListener('submit', enterExperience);
    initGlobe();
})();
