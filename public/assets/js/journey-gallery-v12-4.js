/* URBS V12.6 — horizontal editorial reel + WebGL liquid distortion hover.
   Keeps the same horizontal carousel language already used in the site. */
(() => {
    'use strict';
    const viewport = document.getElementById('journey-reel');
    const track = viewport?.querySelector('.journey-reel-track');
    if (!viewport || !track)
        return;
    const originals = [...track.querySelectorAll('.journey-reel-card')];
    if (originals.length !== 3)
        return;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const speed = 43;
    let offset = 0, period = 0, oldTime = 0, raf = 0, isVisible = true, dragging = false;
    let pauseUntil = 0, dragOrigin = 0, dragOffset = 0, dragMoved = false;
    const limit = () => Math.max(0, viewport.scrollWidth - viewport.clientWidth);
    const clamp = value => Math.max(0, Math.min(limit(), value));
    const addVisualCopies = () => {
        originals.forEach(card => {
            const copy = card.cloneNode(true);
            copy.setAttribute('aria-hidden', 'true');
            copy.tabIndex = -1;
            copy.inert = true;
            track.appendChild(copy);
        });
    };
    const moveTo = value => {
        const position = period ? ((value % period) + period) % period : clamp(value);
        offset = position;
        viewport.scrollLeft = position;
    };
    const measure = () => {
        if (!reduce && viewport.clientWidth > 0) {
            if (track.children.length === originals.length)
                addVisualCopies();
            const firstCopy = track.children[originals.length];
            period = firstCopy.offsetLeft - originals[0].offsetLeft;
            if (period > 0 && limit() < period) {
                const extraSets = Math.ceil((period - limit()) / period) + 1;
                for (let index = 0; index < extraSets; index++)
                    addVisualCopies();
            }
        }
        offset = viewport.scrollLeft;
    };
    viewport.addEventListener('scroll', () => {
        if (Math.abs(viewport.scrollLeft - offset) > 1)
            offset = viewport.scrollLeft;
    }, { passive: true });
    const tick = time => {
        raf = requestAnimationFrame(tick);
        const dt = oldTime ? Math.min(.05, (time - oldTime) / 1000) : 0;
        oldTime = time;
        if (reduce || !isVisible || document.hidden || dragging || time < pauseUntil || viewport.matches(':hover') || viewport.matches(':focus-within'))
            return;
        if (period > 0)
            moveTo(offset + dt * speed);
    };
    viewport.addEventListener('pointerdown', e => {
        if (e.pointerType !== 'mouse' || e.button !== 0)
            return;
        dragging = true;
        dragMoved = false;
        dragOrigin = e.clientX;
        dragOffset = viewport.scrollLeft;
    });
    viewport.addEventListener('pointermove', e => {
        if (!dragging || !limit())
            return;
        const dx = e.clientX - dragOrigin;
        if (Math.abs(dx) > 5)
            dragMoved = true;
        if (dragMoved) {
            moveTo(dragOffset - dx);
        }
    });
    const endDrag = () => { if (!dragging)
        return; dragging = false; pauseUntil = performance.now() + 1000; oldTime = 0; };
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);
    viewport.addEventListener('click', e => { if (dragMoved) {
        e.preventDefault();
        e.stopPropagation();
        dragMoved = false;
    } }, true);
    viewport.addEventListener('keydown', e => {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
            e.preventDefault();
            moveTo(viewport.scrollLeft + (e.key === 'ArrowRight' ? 1 : -1) * (originals[0].offsetWidth + 22));
            pauseUntil = performance.now() + 1800;
        }
    });
    const observer = ('IntersectionObserver' in window) ? new IntersectionObserver(entries => { isVisible = entries[0].isIntersecting; oldTime = 0; }, { threshold: .01 }) : null;
    observer?.observe(viewport);
    const resizer = ('ResizeObserver' in window) ? new ResizeObserver(measure) : null;
    resizer?.observe(viewport);
    resizer?.observe(track);
    window.addEventListener('resize', measure, { passive: true });
    measure();
    raf = requestAnimationFrame(tick);
    window.addEventListener('pagehide', () => { cancelAnimationFrame(raf); observer?.disconnect(); resizer?.disconnect(); }, { once: true });
    // V12.7 — Elastic liquid / wave displacement, localized beneath the cursor.
    // Keep images visible as CSS backgrounds until a WebGL canvas has loaded correctly.
    // Pixi is optional: broken CDN, blocked image CORS, reduced motion or unavailable WebGL
    // must not cause an empty carousel.
    if (reduce || !window.PIXI || !matchMedia('(hover:hover) and (pointer:fine)').matches)
        return;
    const fragment = `
 precision mediump float;
 varying vec2 vTextureCoord;
 uniform sampler2D uSampler;
 uniform vec2 uMouse;
 uniform vec2 uPrevious;
 uniform vec2 uVelocity;
 uniform float uStrength;
 uniform float uTime;
 uniform float uRatio;

 void main() {
   vec2 uv = vTextureCoord;
   vec2 ratio = vec2(uRatio, 1.0);
   vec2 delta = (uv - uMouse) * ratio;
   float distanceToMouse = length(delta);
   vec2 previousDelta = (uv - uPrevious) * ratio;
   float distanceToPrev = length(previousDelta);
   // Gaussian local brush + a broad soft wake pulled by the mouse velocity.
   float core = exp(-distanceToMouse * distanceToMouse * 32.0);
   float wake = exp(-distanceToPrev * distanceToPrev * 16.0) * 0.45;
   float rings = sin(distanceToMouse * 44.0 - uTime * 8.5);
   float slowWave = sin(distanceToMouse * 18.0 - uTime * 5.0);
   vec2 normal = normalize(delta + vec2(0.0001));
   vec2 movement = clamp(uVelocity, vec2(-0.25), vec2(0.25));
   vec2 directional = movement * (core * 0.32 + wake * 0.24);
   vec2 wave = normal * (rings * 0.009 + slowWave * 0.005) * (core + wake);
   // Fine gel-like refraction and light chromatic separation at the moving edge.
   vec2 offset = (directional + wave) * uStrength;
   vec2 at = clamp(uv - offset, 0.001, 0.999);
   float separation = 0.0016 * core * uStrength;
   vec2 chromatic = normal * separation;
   vec4 original = texture2D(uSampler, at);
   float r = texture2D(uSampler, clamp(at + chromatic, 0.001, 0.999)).r;
   float b = texture2D(uSampler, clamp(at - chromatic, 0.001, 0.999)).b;
   vec3 color = mix(original.rgb, vec3(r, original.g, b), 0.52 * uStrength);
   color += 0.037 * core * uStrength;
   gl_FragColor = vec4(color, original.a);
 }
 `;
    const activeInstances = new Set();
    let activeCount = 0;
    const addLiquid = card => {
        // Each instance is created only when hovered, saving GPU memory on initial page load.
        const media = card.querySelector('.journey-reel-media');
        const url = media?.dataset.image;
        if (!media || !url)
            return;
        let instance = null, loading = false, mounted = false;
        let wantsHover = false;
        const load = () => {
            if (instance || loading || !window.PIXI)
                return;
            loading = true;
            const image = new Image();
            image.crossOrigin = 'anonymous';
            image.decoding = 'async';
            image.onload = () => {
                try {
                    const app = new PIXI.Application({
                        resizeTo: media,
                        backgroundAlpha: 0,
                        antialias: true,
                        resolution: Math.min(devicePixelRatio || 1, 1.5),
                        autoDensity: true,
                        autoStart: false,
                        powerPreference: 'high-performance'
                    });
                    const texture = PIXI.Texture.from(image);
                    const sprite = new PIXI.Sprite(texture);
                    const filter = new PIXI.Filter(undefined, fragment, {
                        uMouse: new Float32Array([.5, .5]),
                        uPrevious: new Float32Array([.5, .5]),
                        uVelocity: new Float32Array([0, 0]),
                        uStrength: 0,
                        uTime: 0,
                        uRatio: 1
                    });
                    sprite.filters = [filter];
                    app.stage.addChild(sprite);
                    const state = { app, sprite, filter, mouse: [.5, .5], smooth: [.5, .5], last: [.5, .5],
                        strength: 0, target: 0, velocity: [0, 0], time: 0, hovered: false,
                        width: 0, height: 0, observer: null };
                    const fit = () => {
                        const w = media.clientWidth, h = media.clientHeight;
                        if (!w || !h)
                            return;
                        const iw = texture.width || 1, ih = texture.height || 1;
                        const scale = Math.max(w / iw, h / ih);
                        sprite.width = iw * scale;
                        sprite.height = ih * scale;
                        sprite.x = (w - sprite.width) / 2;
                        sprite.y = (h - sprite.height) / 2;
                        filter.uniforms.uRatio = sprite.width / sprite.height;
                        state.width = w;
                        state.height = h;
                        // Keep WebGL canvas precisely aligned with the CSS background.
                        app.renderer.resize(w, h);
                        app.render();
                    };
                    state.observer = new ResizeObserver(fit);
                    state.observer.observe(media);
                    instance = state;
                    activeInstances.add(state);
                    fit();
                    // The original CSS image remains underneath if WebGL cannot render.
                    media.appendChild(app.view);
                    media.classList.add('liquid-ready');
                    media.dataset.liquidReady = '1';
                    const update = delta => {
                        if (document.hidden || !card.isConnected)
                            return;
                        state.time += Math.min(delta, 3) / 60;
                        const follow = state.hovered ? 0.18 : 0.11;
                        state.smooth[0] += (state.mouse[0] - state.smooth[0]) * follow;
                        state.smooth[1] += (state.mouse[1] - state.smooth[1]) * follow;
                        const vx = state.smooth[0] - state.last[0];
                        const vy = state.smooth[1] - state.last[1];
                        state.velocity[0] += (vx - state.velocity[0]) * .22;
                        state.velocity[1] += (vy - state.velocity[1]) * .22;
                        state.last[0] = state.smooth[0];
                        state.last[1] = state.smooth[1];
                        state.strength += (state.target - state.strength) * 0.09;
                        const u = filter.uniforms;
                        u.uMouse = state.smooth;
                        u.uPrevious = [state.smooth[0] - state.velocity[0] * 9, state.smooth[1] - state.velocity[1] * 9];
                        u.uVelocity = state.velocity;
                        u.uStrength = state.strength;
                        u.uTime = state.time;
                        if (!state.hovered && state.strength < .007) {
                            state.strength = 0;
                            u.uStrength = 0;
                            app.ticker.stop();
                            app.render();
                        }
                    };
                    app.ticker.add(update);
                    if (wantsHover)
                        enter();
                    else
                        app.render();
                }
                catch (error) {
                    console.warn('[URBS liquid] WebGL unavailable; keeping original image.', error);
                    loading = false;
                }
            };
            image.onerror = () => { loading = false; console.warn('[URBS liquid] Image could not be loaded for WebGL; CSS image kept.'); };
            image.src = url;
        };
        const position = (e) => {
            if (!instance)
                return;
            const r = media.getBoundingClientRect();
            const x = Math.max(0, Math.min(r.width, e.clientX - r.left));
            const y = Math.max(0, Math.min(r.height, e.clientY - r.top));
            const sprite = instance.sprite;
            instance.mouse[0] = Math.max(0, Math.min(1, (x - sprite.x) / sprite.width));
            instance.mouse[1] = Math.max(0, Math.min(1, (y - sprite.y) / sprite.height));
        };
        const enter = () => {
            if (!instance)
                return;
            instance.hovered = true;
            instance.target = 1.15;
            instance.app.ticker.start();
        };
        card.addEventListener('pointerenter', e => { wantsHover = true; load(); if (instance) {
            position(e);
            enter();
        } });
        card.addEventListener('pointermove', e => { if (instance && !dragging)
            position(e); }, { passive: true });
        card.addEventListener('pointerleave', () => {
            wantsHover = false;
            if (instance) {
                instance.hovered = false;
                instance.target = 0;
                instance.app.ticker.start();
            }
        });
    };
    track.querySelectorAll('.journey-reel-card').forEach(addLiquid);
    window.addEventListener('pagehide', () => {
        for (const state of activeInstances) {
            state.observer?.disconnect();
            state.app.destroy(true, { children: true, texture: false, baseTexture: false });
        }
        activeInstances.clear();
    }, { once: true });
})();
