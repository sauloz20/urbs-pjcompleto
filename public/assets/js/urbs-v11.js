/* URBS V11 — safe, progressive enhancements. No scroll locking, no hidden sections. */
(() => {
    'use strict';
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const menu = document.querySelector('.menu-toggle'), nav = document.querySelector('.nav');
    menu?.addEventListener('click', () => { const open = nav.classList.toggle('is-open'); menu.setAttribute('aria-expanded', String(open)); menu.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu'); });
    nav?.querySelectorAll('a').forEach(a => a.addEventListener('click', () => { nav.classList.remove('is-open'); menu?.setAttribute('aria-expanded', 'false'); }));
    const bar = document.querySelector('.progress span');
    let scheduled = false;
    const onScroll = () => { if (scheduled)
        return; scheduled = true; requestAnimationFrame(() => { const max = document.documentElement.scrollHeight - innerHeight; if (bar)
        bar.style.transform = `scaleX(${Math.max(0, Math.min(1, max ? scrollY / max : 0))})`; scheduled = false; }); };
    addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    const counter = document.getElementById('local-record-count');
    if (counter && window.UrbsData) {
        try {
            counter.textContent = String(UrbsData.getStoredReports().length);
        }
        catch {
            counter.textContent = '0';
        }
    }
    // Galeria "ONDE VOCÊ OLHA": faixa automática com rolagem contínua.
    // A rolagem vertical da página permanece nativa.
    initStoryCarousel();
    function initStoryCarousel() {
        const viewport = document.getElementById('story-viewport');
        const track = viewport?.querySelector('.story-track');
        if (!viewport || !track)
            return;
        const originals = [...track.querySelectorAll('.story-card')];
        if (originals.length < 2)
            return;
        viewport.classList.add('is-carousel');
        const prefersLessMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
        const SPEED = 42; // pixels/segundo: moderado, sem saltar de card em card.
        let offset = 0, period = 0, previous = 0, frameId = 0, visible = true, dragging = false;
        let pointerStartX = 0, pointerStartOffset = 0, moved = false, pauseUntil = 0;
        const limit = () => Math.max(0, viewport.scrollWidth - viewport.clientWidth);
        const clamp = value => Math.max(0, Math.min(limit(), value));
        const addVisualCopies = () => {
            originals.forEach(card => {
                const copy = card.cloneNode(true);
                copy.setAttribute('aria-hidden', 'true');
                copy.tabIndex = -1;
                track.appendChild(copy);
            });
        };
        const moveTo = value => {
            const position = period ? ((value % period) + period) % period : clamp(value);
            offset = position;
            viewport.scrollLeft = position;
        };
        const measure = () => {
            if (!prefersLessMotion && viewport.clientWidth > 0) {
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
        const tick = now => {
            const delta = previous ? Math.min((now - previous) / 1000, .05) : 0;
            previous = now;
            if (!prefersLessMotion && visible && !document.hidden && !dragging && now > pauseUntil && period > 0) {
                moveTo(offset + SPEED * delta);
            }
            frameId = requestAnimationFrame(tick);
        };
        // Arraste com mouse sem interromper definitivamente o movimento automático.
        viewport.addEventListener('pointerdown', e => {
            if (e.pointerType !== 'mouse' || e.button !== 0)
                return;
            dragging = true;
            moved = false;
            pointerStartX = e.clientX;
            pointerStartOffset = viewport.scrollLeft;
            viewport.classList.add('dragging');
        });
        viewport.addEventListener('pointermove', e => {
            if (!dragging || !limit())
                return;
            const dx = e.clientX - pointerStartX;
            if (Math.abs(dx) > 5)
                moved = true;
            if (moved) {
                moveTo(pointerStartOffset - dx);
            }
        });
        const endDrag = () => {
            if (!dragging)
                return;
            dragging = false;
            viewport.classList.remove('dragging');
            pauseUntil = performance.now() + 850;
            previous = 0;
        };
        window.addEventListener('pointerup', endDrag);
        window.addEventListener('pointercancel', endDrag);
        viewport.addEventListener('click', e => {
            if (moved) {
                e.preventDefault();
                e.stopPropagation();
                moved = false;
            }
        }, true);
        viewport.addEventListener('focusin', () => { pauseUntil = Number.POSITIVE_INFINITY; });
        viewport.addEventListener('focusout', e => {
            if (!viewport.contains(e.relatedTarget)) {
                pauseUntil = performance.now() + 1200;
                previous = 0;
            }
        });
        // Teclado continua navegável mesmo sem setas visíveis.
        viewport.addEventListener('keydown', e => {
            if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                e.preventDefault();
                if (!limit())
                    return;
                const step = e.key === 'ArrowRight' ? 1 : -1;
                moveTo(viewport.scrollLeft + step * (originals[0].offsetWidth + 20));
                pauseUntil = performance.now() + 1800;
            }
        });
        const observer = ('IntersectionObserver' in window) ? new IntersectionObserver(entries => {
            visible = entries[0].isIntersecting;
            previous = 0;
        }, { threshold: .01 }) : null;
        observer?.observe(viewport);
        const resizer = ('ResizeObserver' in window) ? new ResizeObserver(measure) : null;
        resizer?.observe(viewport);
        resizer?.observe(track);
        addEventListener('resize', measure, { passive: true });
        measure();
        frameId = requestAnimationFrame(tick);
        addEventListener('pagehide', () => {
            cancelAnimationFrame(frameId);
            observer?.disconnect();
            resizer?.disconnect();
        }, { once: true });
    }
    // V12.1: hero without cursor-reactive effect. Keep atmosphere static and clean.
    const hero = document.querySelector('.hero');
    if (hero) {
        hero.style.setProperty('--hero-x', '50%');
        hero.style.setProperty('--hero-y', '34%');
    }
    if (!reduced) {
        const impact = document.querySelector('.impact');
        if (impact) {
            let queued = false;
            const update = () => {
                queued = false;
                const r = impact.getBoundingClientRect();
                const progress = Math.max(0, Math.min(1, (innerHeight - r.top) / (innerHeight + r.height)));
                impact.style.setProperty('--impact-zoom', (1.12 - progress * .12).toFixed(3));
            };
            const request = () => { if (!queued) {
                queued = true;
                requestAnimationFrame(update);
            } };
            addEventListener('scroll', request, { passive: true });
            addEventListener('resize', request, { passive: true });
            request();
        }
    }
    // GSAP is optional; never set opacity:0 or position:fixed on sections.
    if (window.gsap && !reduced) {
        try {
            if (!document.documentElement.classList.contains('urbs-arrival')) {
                gsap.fromTo('.hero-content', { y: 20 }, { y: 0, duration: 1.25, ease: 'power3.out' });
            }
            gsap.to('.hero-photo', { scale: 1.17, scrollTrigger: undefined, duration: 18, repeat: -1, yoyo: true, ease: 'sine.inOut' });
        }
        catch (e) {
            console.warn('URBS: animação de abertura indisponível', e);
        }
    }
    // Hover animado nos títulos, acessível e sem bloquear a rolagem vertical.
    // Manter o texto semântico no aria-label e caracteres decorativos aria-hidden.
    if (!reduced && matchMedia('(hover: hover) and (pointer: fine)').matches) {
        document.querySelectorAll('main h1, main h2').forEach(heading => {
            const label = heading.innerText.replace(/\s+/g, ' ').trim();
            if (!label)
                return;
            heading.setAttribute('aria-label', label);
            heading.classList.add('title-jump');
            const walker = document.createTreeWalker(heading, NodeFilter.SHOW_TEXT);
            const nodes = [];
            while (walker.nextNode())
                nodes.push(walker.currentNode);
            nodes.forEach(node => {
                const frag = document.createDocumentFragment();
                // Palavras inteiras evitam quebrar títulos no meio de uma palavra.
                const tokens = node.textContent.match(/\s+|\S+/g) || [];
                tokens.forEach(token => {
                    if (/^\s+$/.test(token)) {
                        frag.appendChild(document.createTextNode(token));
                        return;
                    }
                    const word = document.createElement('span');
                    word.className = 'jump-word';
                    word.setAttribute('aria-hidden', 'true');
                    for (const ch of token) {
                        const letter = document.createElement('span');
                        letter.className = 'jump-letter';
                        letter.textContent = ch;
                        word.appendChild(letter);
                    }
                    frag.appendChild(word);
                });
                node.replaceWith(frag);
            });
            heading.addEventListener('pointerover', event => {
                const letter = event.target.closest('.jump-letter');
                if (!letter || !heading.contains(letter) || letter === event.relatedTarget)
                    return;
                if (window.gsap) {
                    gsap.killTweensOf(letter);
                    gsap.fromTo(letter, { y: 0, rotate: 0, scale: 1 }, { y: -13, rotate: (Math.random() - .5) * 12, scale: 1.07, duration: .22, ease: 'power2.out', onComplete: () => gsap.to(letter, { y: 0, rotate: 0, scale: 1, duration: .65, ease: 'bounce.out', clearProps: 'transform' }) });
                }
                else {
                    letter.classList.remove('jump-active');
                    void letter.offsetWidth;
                    letter.classList.add('jump-active');
                }
            });
        });
    }
})();
