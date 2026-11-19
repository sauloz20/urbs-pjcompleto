/* URBS V10 - Each library owns its own section. Progressive enhancement, no fake external media. */
(() => {
    'use strict';
    const safe = (name, callback) => { try {
        callback();
    }
    catch (error) {
        console.warn('[URBS media] ' + name, error);
    } };
    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const ready = () => {
        safe('Embla', () => {
            const root = document.querySelector('.urbs-stories-embla');
            if (!root || !window.EmblaCarousel)
                return;
            const api = EmblaCarousel(root.querySelector('.embla__viewport'), {
                align: 'start',
                containScroll: 'trimSnaps',
                loop: true,
                dragFree: false,
                duration: reduceMotion ? 0 : 32
            });
            const AUTO_DELAY = 3400;
            let autoTimer = null;
            const stopAuto = () => { if (autoTimer) {
                clearInterval(autoTimer);
                autoTimer = null;
            } };
            const startAuto = () => {
                stopAuto();
                if (reduceMotion)
                    return;
                autoTimer = setInterval(() => { api.scrollNext(); }, AUTO_DELAY);
            };
            const pauseThenResume = () => {
                stopAuto();
                window.clearTimeout(root._urbsResumeTimer);
                root._urbsResumeTimer = window.setTimeout(startAuto, 2200);
            };
            root.addEventListener('mouseenter', stopAuto);
            root.addEventListener('mouseleave', startAuto);
            root.addEventListener('focusin', stopAuto);
            root.addEventListener('focusout', startAuto);
            root.addEventListener('pointerdown', pauseThenResume);
            root.addEventListener('touchstart', pauseThenResume, { passive: true });
            api.on('pointerDown', stopAuto);
            api.on('settle', () => {
                if (!root.matches(':hover') && !root.matches(':focus-within'))
                    startAuto();
            });
            startAuto();
        });
        safe('Splide', () => {
            if (!window.Splide)
                return;
            new Splide('#urbs-highlights-splide', {
                type: 'slide', perPage: 3, perMove: 1, gap: '18px',
                pagination: false, arrows: true, drag: true, speed: reduceMotion ? 0 : 650,
                breakpoints: { 980: { perPage: 2 }, 660: { perPage: 1 } }
            }).mount();
        });
        safe('GLightbox', () => { if (window.GLightbox)
            GLightbox({ selector: '.glightbox', touchNavigation: true, loop: false }); });
        safe('Plyr', () => { if (window.Plyr)
            window.urbsPlyr = new Plyr('#urbs-plyr', { controls: ['play-large', 'play', 'progress', 'current-time', 'mute', 'volume', 'fullscreen'] }); });
        safe('player-switch', () => {
            const button = document.getElementById('change-player');
            if (!button)
                return;
            button.addEventListener('click', () => {
                let video = document.getElementById('urbs-plyr');
                if (!video)
                    return;
                const useVideoJs = button.getAttribute('aria-pressed') !== 'true';
                if (useVideoJs) {
                    if (!window.videojs)
                        return;
                    window.urbsPlyr?.destroy();
                    window.urbsPlyr = null;
                    video = document.getElementById('urbs-plyr') || video;
                    video.classList.add('video-js', 'vjs-big-play-centered');
                    window.urbsVideoJs = videojs(video, { controls: true, fluid: true, preload: 'none' });
                    button.setAttribute('aria-pressed', 'true');
                    button.textContent = 'Voltar ao Plyr ↗';
                }
                else {
                    window.urbsVideoJs?.dispose();
                    window.urbsVideoJs = null;
                    // Video.js dispose() removes the original video node. Recreate it before initializing Plyr.
                    const area = document.querySelector('.media-preview');
                    area.innerHTML = '<video id="urbs-plyr" playsinline controls preload="none" poster="assets/images/urbs-motion-poster.jpg" aria-label="Animação conceitual do URBS"><source src="assets/media/urbs-movimento.mp4" type="video/mp4"></video>';
                    if (window.Plyr)
                        window.urbsPlyr = new Plyr('#urbs-plyr', { controls: ['play-large', 'play', 'progress', 'current-time', 'mute', 'volume', 'fullscreen'] });
                    button.setAttribute('aria-pressed', 'false');
                    button.textContent = 'Usar Video.js neste vídeo ↗';
                }
            });
        });
        // Deliberately no fabricated YouTube ID. Configure only a real, relevant video.
        safe('Lite YouTube', () => {
            const youtubeVideoId = ''; // Put a verified URBS or Montes Claros video ID here.
            if (!/^[\w-]{11}$/.test(youtubeVideoId))
                return;
            const slot = document.querySelector('#urbs-youtube-slot');
            if (!slot)
                return;
            const element = document.createElement('lite-youtube');
            element.setAttribute('videoid', youtubeVideoId);
            element.setAttribute('playlabel', 'Reproduzir vídeo sobre o URBS');
            slot.appendChild(element);
            slot.hidden = false;
        });
    };
    if (document.readyState === 'loading')
        document.addEventListener('DOMContentLoaded', ready, { once: true });
    else
        ready();
})();
