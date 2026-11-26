/* URBS — Seção 5: Carrossel infinito full-bleed + WebGL Full-Edge + Distorção de Letras + Borda Elástica */
(() => {
  'use strict';

  const viewport = document.getElementById('journey-reel');
  const track = viewport?.querySelector('.journey-reel-track');
  const section = document.getElementById('funcionamento');
  const togglePlayBtn = document.getElementById('journey-toggle-play');
  if (!viewport || !track) return;

  const originals = [...track.querySelectorAll('.journey-reel-card')];
  if (originals.length < 2) return;

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const SPEED = 38;

  // Clona 2 conjuntos extras para atravessar telas largas de ponta a ponta
  for (let copy = 0; copy < 2; copy++) {
    originals.forEach((card) => {
      const clone = card.cloneNode(true);
      clone.setAttribute('aria-hidden', 'true');
      clone.setAttribute('tabindex', '-1');
      track.appendChild(clone);
    });
  }

  let period = 0;
  let offset = 0;
  let oldTime = 0;
  let raf = 0;
  let isVisible = true;
  let manualPaused = false;
  let dragging = false;
  let touching = false;
  let pauseUntil = 0;
  let dragOrigin = 0;
  let dragOffset = 0;
  let dragMoved = false;

  const keepCentered = (val) => {
    if (!period) return 0;
    let v = val;
    while (v < period) v += period;
    while (v >= period * 2) v -= period;
    return v;
  };

  const measure = () => {
    const duplicate = track.children[originals.length];
    period = duplicate.offsetLeft - originals[0].offsetLeft;
    if (period > 0) {
      offset = keepCentered(offset || period);
      viewport.scrollLeft = offset;
    }
  };

  const tick = (time) => {
    raf = requestAnimationFrame(tick);
    const dt = oldTime ? Math.min(0.05, (time - oldTime) / 1000) : 0;
    oldTime = time;

    const paused =
      reduce ||
      manualPaused ||
      !isVisible ||
      document.hidden ||
      dragging ||
      touching ||
      time < pauseUntil ||
      viewport.matches(':hover') ||
      viewport.matches(':focus-within');

    if (!paused && period > 0) {
      offset = keepCentered(offset + dt * SPEED);
      viewport.scrollLeft = offset;
    }
  };

  viewport.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    dragging = true;
    dragMoved = false;
    dragOrigin = e.clientX;
    dragOffset = viewport.scrollLeft;
    offset = dragOffset;
    viewport.classList.add('is-dragging');
  });

  viewport.addEventListener('pointermove', (e) => {
    if (!dragging || !period) return;
    const dx = e.clientX - dragOrigin;
    if (Math.abs(dx) > 5) dragMoved = true;
    if (dragMoved) {
      offset = keepCentered(dragOffset - dx);
      viewport.scrollLeft = offset;
    }
  });

  const endDrag = () => {
    if (!dragging) return;
    dragging = false;
    viewport.classList.remove('is-dragging');
    pauseUntil = performance.now() + 1100;
    oldTime = 0;
  };
  window.addEventListener('pointerup', endDrag);
  window.addEventListener('pointercancel', endDrag);

  viewport.addEventListener('touchstart', () => {
    touching = true;
    pauseUntil = performance.now() + 2600;
  }, { passive: true });

  viewport.addEventListener('touchend', () => {
    touching = false;
    offset = keepCentered(viewport.scrollLeft);
    viewport.scrollLeft = offset;
    pauseUntil = performance.now() + 2200;
    oldTime = 0;
  }, { passive: true });

  viewport.addEventListener('scroll', () => {
    if ((touching || performance.now() < pauseUntil) && period > 0) {
      const s = viewport.scrollLeft;
      if (s < period * 0.35 || s > period * 2.4) {
        offset = keepCentered(s);
        viewport.scrollLeft = offset;
      } else {
        offset = s;
      }
    }
  }, { passive: true });

  viewport.addEventListener('click', (e) => {
    if (dragMoved) {
      e.preventDefault();
      e.stopPropagation();
      dragMoved = false;
    }
  }, true);

  const stepCard = (direction) => {
    if (!period) return;
    const step = originals[0].offsetWidth + 28;
    const target = keepCentered(viewport.scrollLeft + direction * step);
    offset = target;
    viewport.scrollTo({ left: target, behavior: reduce ? 'auto' : 'smooth' });
    pauseUntil = performance.now() + 2400;
  };

  togglePlayBtn?.addEventListener('click', () => {
    manualPaused = !manualPaused;
    togglePlayBtn.setAttribute('aria-pressed', String(manualPaused));
    togglePlayBtn.textContent = manualPaused ? 'RETOMAR' : 'PAUSAR';
    togglePlayBtn.setAttribute(
      'aria-label',
      manualPaused ? 'Retomar movimento automático' : 'Pausar movimento automático'
    );
    section?.classList.toggle('is-paused', manualPaused);
    oldTime = 0;
  });

  document.getElementById('journey-prev')?.addEventListener('click', () => stepCard(-1));
  document.getElementById('journey-next')?.addEventListener('click', () => stepCard(1));

  viewport.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      stepCard(e.key === 'ArrowRight' ? 1 : -1);
    }
  });

  const observer = 'IntersectionObserver' in window
    ? new IntersectionObserver((entries) => {
        isVisible = entries[0].isIntersecting;
        oldTime = 0;
      }, { threshold: 0.01 })
    : null;
  observer?.observe(viewport);

  const resizer = 'ResizeObserver' in window ? new ResizeObserver(measure) : null;
  resizer?.observe(viewport);
  resizer?.observe(track);
  window.addEventListener('resize', measure, { passive: true });

  measure();
  raf = requestAnimationFrame(tick);

  window.addEventListener('pagehide', () => {
    cancelAnimationFrame(raf);
    observer?.disconnect();
    resizer?.disconnect();
  }, { once: true });

  // ================= BORDA ELÁSTICA + DISTORÇÃO DE LETRAS + WEBGL FULL-EDGE =================
  if (reduce || !finePointer) return;

  // Container SVG oculto para os filtros ópticos de distorção de texto
  const svgNS = 'http://www.w3.org/2000/svg';
  const filterBank = document.createElementNS(svgNS, 'svg');
  filterBank.setAttribute('aria-hidden', 'true');
  filterBank.style.cssText = 'position:fixed;width:0;height:0;pointer-events:none;overflow:hidden;';
  const filterDefs = document.createElementNS(svgNS, 'defs');
  filterBank.appendChild(filterDefs);
  document.body.appendChild(filterBank);

  // Fragment shader corrigido usando outputFrame + inputClamp: alcança 100% das bordas e cantos
  const fragment = `
    precision highp float;
    varying vec2 vTextureCoord;
    uniform sampler2D uSampler;
    uniform vec4 inputSize;
    uniform vec4 outputFrame;
    uniform vec4 inputClamp;
    uniform vec2 uMouse;
    uniform vec2 uPrevious;
    uniform vec2 uVelocity;
    uniform float uStrength;
    uniform float uTime;
    uniform float uRatio;

    void main() {
      vec2 uv = (vTextureCoord * inputSize.xy) / max(outputFrame.zw, vec2(1.0));
      vec2 ratio = vec2(uRatio, 1.0);
      vec2 delta = (uv - uMouse) * ratio;
      float dist = length(delta);
      vec2 prevDelta = (uv - uPrevious) * ratio;
      float prevDist = length(prevDelta);

      // Raio amplo: propaga a onda elástica até as bordas e os 4 cantos do card
      float core = exp(-dist * dist * 10.5);
      float wake = exp(-prevDist * prevDist * 5.8) * 0.56;
      float outer = exp(-dist * dist * 2.8) * 0.34;

      float rings = sin(dist * 32.0 - uTime * 8.2);
      float slowWave = sin(dist * 14.0 - uTime * 4.8);
      vec2 normal = normalize(delta + vec2(0.0001));
      vec2 movement = clamp(uVelocity, vec2(-0.35), vec2(0.35));

      vec2 directional = movement * (core * 0.50 + wake * 0.36);
      vec2 wave = normal * (rings * 0.012 + slowWave * 0.007) * (core + wake + outer);

      vec2 uvOffset = (directional + wave) * uStrength;
      vec2 texScale = outputFrame.zw / max(inputSize.xy, vec2(1.0));
      vec2 at = clamp(vTextureCoord - uvOffset * texScale, inputClamp.xy, inputClamp.zw);

      vec2 chroma = normal * (0.0024 * (core + outer * 0.65) * uStrength) * texScale;
      vec4 original = texture2D(uSampler, at);
      float r = texture2D(uSampler, clamp(at + chroma, inputClamp.xy, inputClamp.zw)).r;
      float b = texture2D(uSampler, clamp(at - chroma, inputClamp.xy, inputClamp.zw)).b;

      vec3 color = mix(original.rgb, vec3(r, original.g, b), 0.60 * uStrength);
      color += 0.042 * core * uStrength;
      gl_FragColor = vec4(color, original.a);
    }
  `;

  const MAX_WEBGL_INSTANCES = 4;
  const activeWebGL = [];
  const cardCleanups = [];

  const destroyWebGL = (state) => {
    const idx = activeWebGL.indexOf(state);
    if (idx >= 0) activeWebGL.splice(idx, 1);
    state.observer?.disconnect();
    state.media.classList.remove('liquid-ready');
    state.app.destroy(true, { children: true, texture: true, baseTexture: true });
    state.onDispose?.();
  };

  const evictOldestWebGL = () => {
    while (activeWebGL.length >= MAX_WEBGL_INSTANCES) {
      const idle = activeWebGL.find((st) => !st.hovered) || activeWebGL[0];
      if (!idle) break;
      destroyWebGL(idle);
    }
  };

  // Calcula posição do caractere relativa ao card (sem sofrer interferência de CSS transform)
  const getCenterInCard = (el, card) => {
    let x = el.offsetWidth / 2;
    let y = el.offsetHeight / 2;
    let cur = el;
    while (cur && cur !== card) {
      x += cur.offsetLeft;
      y += cur.offsetTop;
      cur = cur.offsetParent;
    }
    return { x, y };
  };

  // Quebra as letras do título h3 em spans para distorção elástica localizada
  const splitHeadingChars = (heading) => {
    if (!heading) return [];
    const label = heading.textContent.trim();
    if (label) heading.setAttribute('aria-label', label);
    const chars = [];
    const nodes = [...heading.childNodes];
    nodes.forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const frag = document.createDocumentFragment();
        for (const ch of node.textContent) {
          const span = document.createElement('span');
          span.className = 'j-char';
          span.setAttribute('aria-hidden', 'true');
          span.textContent = ch === ' ' ? '\u00A0' : ch;
          frag.appendChild(span);
          chars.push(span);
        }
        node.replaceWith(frag);
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        node.classList.add('j-char', 'j-char-dot');
        node.setAttribute('aria-hidden', 'true');
        chars.push(node);
      }
    });
    return chars;
  };

  // Mola simples (stiffness + damping) para o salto elástico da linha limite
  const stepSpring = (s, target, stiffness, damping) => {
    s.v += (target - s.p) * stiffness;
    s.v *= damping;
    s.p += s.v;
    return s.p;
  };

  const setupCard = (card, index) => {
    const media = card.querySelector('.journey-reel-media');
    const body = card.querySelector('.journey-reel-body');
    const heading = card.querySelector('.journey-reel-copy h3');
    const paragraph = card.querySelector('.journey-reel-copy p');
    const topBar = card.querySelector('.journey-reel-top');
    const footBar = card.querySelector('.journey-reel-foot');
    const url = media?.dataset.image;
    if (!media || !body) return;

    // 1. Cria a linha fina elástica SVG ao redor do card
    const frameSvg = document.createElementNS(svgNS, 'svg');
    frameSvg.setAttribute('class', 'journey-elastic-frame');
    frameSvg.setAttribute('aria-hidden', 'true');
    const framePath = document.createElementNS(svgNS, 'path');
    framePath.setAttribute('class', 'journey-elastic-path');
    frameSvg.appendChild(framePath);
    card.appendChild(frameSvg);

    // 2. Cria filtro SVG individual para a distorção líquida das letras
    const filterId = `urbs-journey-text-${index}`;
    const filterEl = document.createElementNS(svgNS, 'filter');
    filterEl.setAttribute('id', filterId);
    filterEl.setAttribute('x', '-12%');
    filterEl.setAttribute('y', '-12%');
    filterEl.setAttribute('width', '124%');
    filterEl.setAttribute('height', '124%');
    filterEl.setAttribute('color-interpolation-filters', 'sRGB');

    const turbEl = document.createElementNS(svgNS, 'feTurbulence');
    turbEl.setAttribute('type', 'fractalNoise');
    turbEl.setAttribute('baseFrequency', '0.018 0.032');
    turbEl.setAttribute('numOctaves', '1');
    turbEl.setAttribute('seed', String(index + 3));
    turbEl.setAttribute('result', 'noise');

    const dispEl = document.createElementNS(svgNS, 'feDisplacementMap');
    dispEl.setAttribute('in', 'SourceGraphic');
    dispEl.setAttribute('in2', 'noise');
    dispEl.setAttribute('scale', '0');
    dispEl.setAttribute('xChannelSelector', 'R');
    dispEl.setAttribute('yChannelSelector', 'G');

    filterEl.appendChild(turbEl);
    filterEl.appendChild(dispEl);
    filterDefs.appendChild(filterEl);

    // 3. Letras individuais do título
    const chars = splitHeadingChars(heading);
    let charCenters = [];
    let cardW = card.clientWidth || 400;
    let cardH = card.clientHeight || 500;

    const measureCard = () => {
      cardW = card.clientWidth || 400;
      cardH = card.clientHeight || 500;
      frameSvg.setAttribute('viewBox', `0 0 ${cardW} ${cardH}`);
      charCenters = chars.map((el) => getCenterInCard(el, card));
      if (!hovered && !fxRaf) drawBorderPath(0, 0, 0, 0, 0, cardW / 2, cardW / 2, cardH / 2, cardH / 2);
    };

    const drawBorderPath = (outset, topB, rightB, bottomB, leftB, topX, bottomX, leftY, rightY) => {
      const x0 = -outset;
      const y0 = -outset;
      const x1 = cardW + outset;
      const y1 = cardH + outset;
      const d =
        `M ${x0.toFixed(1)} ${y0.toFixed(1)} ` +
        `Q ${topX.toFixed(1)} ${(y0 - topB).toFixed(1)} ${x1.toFixed(1)} ${y0.toFixed(1)} ` +
        `Q ${(x1 + rightB).toFixed(1)} ${rightY.toFixed(1)} ${x1.toFixed(1)} ${y1.toFixed(1)} ` +
        `Q ${bottomX.toFixed(1)} ${(y1 + bottomB).toFixed(1)} ${x0.toFixed(1)} ${y1.toFixed(1)} ` +
        `Q ${(x0 - leftB).toFixed(1)} ${leftY.toFixed(1)} ${x0.toFixed(1)} ${y0.toFixed(1)} Z`;
      framePath.setAttribute('d', d);
    };

    // Estado da física elástica (borda + letras)
    let hovered = false;
    let fxRaf = 0;
    let fxTime = 0;
    let energy = 0;
    let mx = cardW / 2;
    let my = cardH / 2;
    let smx = cardW / 2;
    let smy = cardH / 2;
    let vx = 0;
    let vy = 0;

    const spOutset = { p: 0, v: 0 };
    const spTop = { p: 0, v: 0 };
    const spRight = { p: 0, v: 0 };
    const spBottom = { p: 0, v: 0 };
    const spLeft = { p: 0, v: 0 };
    let topX = cardW / 2;
    let bottomX = cardW / 2;
    let leftY = cardH / 2;
    let rightY = cardH / 2;

    const MAX_BULGE = 22;

    const resetTextVisuals = () => {
      body.style.filter = '';
      dispEl.setAttribute('scale', '0');
      chars.forEach((ch) => { ch.style.transform = ''; });
      if (paragraph) paragraph.style.transform = '';
      if (topBar) topBar.style.transform = '';
      if (footBar) footBar.style.transform = '';
    };

    const runFxLoop = () => {
      if (document.hidden || !card.isConnected) {
        fxRaf = 0;
        return;
      }

      fxTime += 0.016;
      const follow = hovered ? 0.24 : 0.14;
      const nextMx = smx + (mx - smx) * follow;
      const nextMy = smy + (my - smy) * follow;
      vx += (nextMx - smx - vx) * 0.35;
      vy += (nextMy - smy - vy) * 0.35;
      smx = nextMx;
      smy = nextMy;

      const speed = Math.hypot(vx, vy);
      const targetEnergy = hovered && !dragging ? 1 : 0;
      energy += (targetEnergy - energy) * 0.12;

      // ---- 1. Física da linha fina elástica (salta e dobra até o limite sem quebrar) ----
      const nx = Math.max(0, Math.min(1, smx / Math.max(1, cardW)));
      const ny = Math.max(0, Math.min(1, smy / Math.max(1, cardH)));

      const active = hovered && !dragging;
      const targetOutset = active ? 8 : 0;

      // Quanto mais perto de cada borda (ou empurrando contra ela), mais a linha enverga para fora
      const proxTop = Math.pow(Math.max(0, 1 - ny / 0.52), 1.8);
      const proxBottom = Math.pow(Math.max(0, 1 - (1 - ny) / 0.52), 1.8);
      const proxLeft = Math.pow(Math.max(0, 1 - nx / 0.52), 1.8);
      const proxRight = Math.pow(Math.max(0, 1 - (1 - nx) / 0.52), 1.8);

      const targetTop = active ? Math.min(MAX_BULGE, proxTop * 15 + Math.max(0, -vy) * 0.65 * (1 - ny * 0.5)) : 0;
      const targetBottom = active ? Math.min(MAX_BULGE, proxBottom * 15 + Math.max(0, vy) * 0.65 * (0.5 + ny * 0.5)) : 0;
      const targetLeft = active ? Math.min(MAX_BULGE, proxLeft * 15 + Math.max(0, -vx) * 0.65 * (1 - nx * 0.5)) : 0;
      const targetRight = active ? Math.min(MAX_BULGE, proxRight * 15 + Math.max(0, vx) * 0.65 * (0.5 + nx * 0.5)) : 0;

      const outset = stepSpring(spOutset, targetOutset, 0.22, 0.72);
      const topB = Math.max(-4, stepSpring(spTop, targetTop, 0.2, 0.72));
      const rightB = Math.max(-4, stepSpring(spRight, targetRight, 0.2, 0.72));
      const bottomB = Math.max(-4, stepSpring(spBottom, targetBottom, 0.2, 0.72));
      const leftB = Math.max(-4, stepSpring(spLeft, targetLeft, 0.2, 0.72));

      const clampX = Math.max(28, Math.min(cardW - 28, smx));
      const clampY = Math.max(28, Math.min(cardH - 28, smy));
      topX += ((active ? clampX : cardW / 2) - topX) * 0.22;
      bottomX += ((active ? clampX : cardW / 2) - bottomX) * 0.22;
      leftY += ((active ? clampY : cardH / 2) - leftY) * 0.22;
      rightY += ((active ? clampY : cardH / 2) - rightY) * 0.22;

      drawBorderPath(outset, topB, rightB, bottomB, leftB, topX, bottomX, leftY, rightY);

      // ---- 2. Distorção das letras (onda localizada nas letras do título + filtro líquido SVG) ----
      if (energy > 0.015) {
        const opticalScale = Math.min(18, (speed * 0.95 + 1.8) * energy);
        if (opticalScale > 0.25) {
          body.style.filter = `url(#${filterId})`;
          dispEl.setAttribute('scale', opticalScale.toFixed(2));
          const bfX = (0.016 + Math.sin(fxTime * 3.2) * 0.004).toFixed(4);
          const bfY = (0.028 + Math.cos(fxTime * 2.7) * 0.005).toFixed(4);
          turbEl.setAttribute('baseFrequency', `${bfX} ${bfY}`);
        } else {
          body.style.filter = '';
        }

        const influenceRadius = Math.max(cardW, cardH) * 0.62;
        for (let i = 0; i < chars.length; i++) {
          const c = charCenters[i];
          if (!c) continue;
          const dx = c.x - smx;
          const dy = c.y - smy;
          const dist = Math.hypot(dx, dy);
          const falloff = Math.exp(-(dist * dist) / (influenceRadius * influenceRadius * 0.34));
          const wave = Math.sin(dist * 0.055 - fxTime * 7.5) * 4.5 * falloff * energy;
          const pushX = (vx * 0.85 + (dx / (dist + 18)) * wave) * falloff * energy;
          const pushY = (vy * 0.75 + (dy / (dist + 18)) * wave) * falloff * energy;
          const skew = Math.max(-18, Math.min(18, vx * 1.15 * falloff * energy));
          const stretchY = 1 + Math.max(-0.14, Math.min(0.18, (speed * 0.012 + Math.sin(fxTime * 6 - i * 0.6) * 0.03) * falloff * energy));
          const stretchX = 1 / Math.sqrt(stretchY);

          chars[i].style.transform =
            `translate3d(${pushX.toFixed(2)}px, ${pushY.toFixed(2)}px, 0) skewX(${skew.toFixed(1)}deg) scale(${stretchX.toFixed(3)}, ${stretchY.toFixed(3)})`;
        }

        const textSkew = Math.max(-6, Math.min(6, vx * 0.32 * energy));
        const shiftX = Math.max(-10, Math.min(10, vx * 0.35 * energy));
        const shiftY = Math.max(-8, Math.min(8, vy * 0.28 * energy));
        if (paragraph) paragraph.style.transform = `translate3d(${shiftX.toFixed(2)}px, ${shiftY.toFixed(2)}px, 0) skewX(${textSkew.toFixed(2)}deg)`;
        if (topBar) topBar.style.transform = `translate3d(${(shiftX * 0.55).toFixed(2)}px, ${(shiftY * 0.55).toFixed(2)}px, 0)`;
        if (footBar) footBar.style.transform = `translate3d(${(shiftX * 0.7).toFixed(2)}px, ${(shiftY * 0.5).toFixed(2)}px, 0)`;
      } else {
        resetTextVisuals();
      }

      const settled =
        !hovered &&
        energy < 0.01 &&
        Math.abs(spOutset.p) < 0.08 && Math.abs(spOutset.v) < 0.08 &&
        Math.abs(spTop.p) < 0.08 && Math.abs(spBottom.p) < 0.08 &&
        Math.abs(spLeft.p) < 0.08 && Math.abs(spRight.p) < 0.08;

      if (settled) {
        fxRaf = 0;
        card.classList.remove('is-elastic-active');
        drawBorderPath(0, 0, 0, 0, 0, cardW / 2, cardW / 2, cardH / 2, cardH / 2);
        resetTextVisuals();
        return;
      }

      fxRaf = requestAnimationFrame(runFxLoop);
    };

    const startFxLoop = () => {
      if (!fxRaf) fxRaf = requestAnimationFrame(runFxLoop);
    };

    // 4. WebGL Liquid Distortion (PixiJS) full-edge
    let webgl = null;
    let webglLoading = false;

    const loadWebGL = () => {
      if (webgl || webglLoading || !window.PIXI || !url) return;
      webglLoading = true;
      const image = new Image();
      image.crossOrigin = 'anonymous';
      image.decoding = 'async';

      image.onload = () => {
        try {
          evictOldestWebGL();
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
          const container = new PIXI.Container();
          container.addChild(sprite);

          const filter = new PIXI.Filter(undefined, fragment, {
            uMouse: new Float32Array([0.5, 0.5]),
            uPrevious: new Float32Array([0.5, 0.5]),
            uVelocity: new Float32Array([0, 0]),
            uStrength: 0,
            uTime: 0,
            uRatio: 1
          });
          container.filters = [filter];
          app.stage.addChild(container);

          const state = {
            app,
            media,
            container,
            sprite,
            filter,
            mouse: [mx / Math.max(1, cardW), my / Math.max(1, cardH)],
            smooth: [mx / Math.max(1, cardW), my / Math.max(1, cardH)],
            last: [mx / Math.max(1, cardW), my / Math.max(1, cardH)],
            strength: 0,
            target: 0,
            velocity: [0, 0],
            time: 0,
            hovered: false,
            observer: null,
            onDispose: () => {
              webgl = null;
              webglLoading = false;
            }
          };

          const fit = () => {
            const w = media.clientWidth;
            const h = media.clientHeight;
            if (!w || !h) return;
            const iw = texture.width || 1;
            const ih = texture.height || 1;
            const scale = Math.max(w / iw, h / ih);
            sprite.width = iw * scale;
            sprite.height = ih * scale;
            sprite.x = (w - sprite.width) / 2;
            sprite.y = (h - sprite.height) / 2;
            app.renderer.resize(w, h);
            // filterArea exato do card garante distorção limpa até todas as bordas e cantos
            container.filterArea = new PIXI.Rectangle(0, 0, w, h);
            filter.uniforms.uRatio = w / h;
            app.render();
          };

          state.observer = new ResizeObserver(fit);
          state.observer.observe(media);
          webgl = state;
          webglLoading = false;
          activeWebGL.push(state);
          fit();

          media.appendChild(app.view);
          media.classList.add('liquid-ready');

          app.ticker.add((delta) => {
            if (document.hidden || !card.isConnected) return;
            state.time += Math.min(delta, 3) / 60;
            const follow = state.hovered ? 0.2 : 0.12;
            state.smooth[0] += (state.mouse[0] - state.smooth[0]) * follow;
            state.smooth[1] += (state.mouse[1] - state.smooth[1]) * follow;
            const dvx = state.smooth[0] - state.last[0];
            const dvy = state.smooth[1] - state.last[1];
            state.velocity[0] += (dvx - state.velocity[0]) * 0.24;
            state.velocity[1] += (dvy - state.velocity[1]) * 0.24;
            state.last[0] = state.smooth[0];
            state.last[1] = state.smooth[1];
            state.strength += (state.target - state.strength) * 0.1;

            const u = filter.uniforms;
            u.uMouse = state.smooth;
            u.uPrevious = [state.smooth[0] - state.velocity[0] * 10, state.smooth[1] - state.velocity[1] * 10];
            u.uVelocity = state.velocity;
            u.uStrength = state.strength;
            u.uTime = state.time;

            if (!state.hovered && state.strength < 0.006) {
              state.strength = 0;
              u.uStrength = 0;
              app.ticker.stop();
              app.render();
            }
          });

          if (hovered) {
            state.hovered = true;
            state.target = 1.25;
            app.ticker.start();
          } else {
            app.render();
          }
        } catch (err) {
          console.warn('[URBS liquid] WebGL indisponível; mantendo foto original.', err);
          webglLoading = false;
        }
      };

      image.onerror = () => { webglLoading = false; };
      image.src = url;
    };

    const updatePointer = (e) => {
      const r = card.getBoundingClientRect();
      mx = Math.max(0, Math.min(r.width, e.clientX - r.left));
      my = Math.max(0, Math.min(r.height, e.clientY - r.top));
      if (webgl) {
        webgl.mouse[0] = mx / Math.max(1, r.width);
        webgl.mouse[1] = my / Math.max(1, r.height);
      }
    };

    card.addEventListener('pointerenter', (e) => {
      measureCard();
      hovered = true;
      card.classList.add('is-elastic-active');
      updatePointer(e);
      smx = mx;
      smy = my;
      // Impulso inicial para a linha fina "saltar" com resposta elástica imediata
      spOutset.v += 3.2;
      startFxLoop();
      loadWebGL();
      if (webgl) {
        webgl.hovered = true;
        webgl.target = 1.25;
        webgl.app.ticker.start();
      }
    });

    card.addEventListener('pointermove', (e) => {
      if (!dragging) updatePointer(e);
    }, { passive: true });

    card.addEventListener('pointerleave', () => {
      hovered = false;
      startFxLoop();
      if (webgl) {
        webgl.hovered = false;
        webgl.target = 0;
        webgl.app.ticker.start();
      }
    });

    const cardRo = new ResizeObserver(measureCard);
    cardRo.observe(card);
    measureCard();

    cardCleanups.push(() => {
      cancelAnimationFrame(fxRaf);
      cardRo.disconnect();
    });
  };

  track.querySelectorAll('.journey-reel-card').forEach(setupCard);

  window.addEventListener('pagehide', () => {
    cardCleanups.forEach((fn) => fn());
    [...activeWebGL].forEach(destroyWebGL);
  }, { once: true });
})();