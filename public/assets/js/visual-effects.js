/** URBS visual layer. Progressive enhancement: core pages work without CDNs. */
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
const mobile = matchMedia("(max-width: 760px)");
const cleanup = [];
const safe = (label, callback) => {
  try {
    callback();
  } catch (error) {
    console.warn(`[URBS visual] ${label}`, error);
  }
};
function init() {
  const active = !reduceMotion.matches;
  if (window.Swiper)
    safe(
      "Swiper",
      () =>
        new Swiper(".urbs-swiper", {
          slidesPerView: 1.1,
          spaceBetween: 14,
          grabCursor: true,
          breakpoints: {
            640: { slidesPerView: 2.1, spaceBetween: 18 },
            1050: { slidesPerView: 3, spaceBetween: 20 },
          },
          navigation: { nextEl: ".showcase-next", prevEl: ".showcase-prev" },
          pagination: {
            el: ".showcase-controls .swiper-pagination",
            type: "bullets",
            clickable: true,
          },
        }),
    );
  if (!active) return;
  // Native page scroll is intentional on the homepage. Lenis can interfere with
  // wheel/touch events or other scroll-driven libraries, especially after CDN failures.
  // We keep the library available but do not intercept vertical scrolling.
  if (window.VanillaTilt && !mobile.matches)
    safe("Tilt", () => {
      VanillaTilt.init(document.querySelectorAll(".category-card"), {
        max: 5,
        speed: 450,
        scale: 1.015,
        glare: false,
        perspective: 1200,
      });
      cleanup.push(() =>
        document.querySelectorAll(".category-card").forEach((el) => el.vanillaTilt?.destroy()),
      );
    });
  // Critical content must be visible without scroll event observers.
  // AOS and scroll-triggered reveal effects remain disabled until verified separately.
  if (window.gsap)
    safe("GSAP", () => {
      gsap.fromTo(
        ".hero-copy > *",
        { y: 15 },
        { y: 0, duration: 0.7, stagger: 0.08, ease: "power2.out", clearProps: "all" },
      );
    });
  // Vanta uses THREE; keep it confined to the showcase, never overlay the Leaflet map.
  if (window.VANTA?.NET && window.THREE && !mobile.matches)
    safe("Vanta", () => {
      const effect = VANTA.NET({
        el: ".visual-lab-network",
        THREE: window.THREE,
        mouseControls: false,
        touchControls: false,
        gyroControls: false,
        minHeight: 200,
        minWidth: 200,
        color: 0x91b87d,
        backgroundColor: 0x0b2119,
        points: 8,
        maxDistance: 19,
        spacing: 21,
        showDots: true,
      });
      cleanup.push(() => effect.destroy());
    });
  if (window.THREE && !mobile.matches)
    safe("Three.js", () => {
      const host = document.querySelector(".hero-atmosphere");
      if (!host) return;
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
      camera.position.z = 11;
      const renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: false,
        powerPreference: "low-power",
      });
      renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
      host.appendChild(renderer.domElement);
      const count = 85,
        coords = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        coords[i * 3] = (Math.random() - 0.5) * 19;
        coords[i * 3 + 1] = (Math.random() - 0.5) * 10;
        coords[i * 3 + 2] = (Math.random() - 0.5) * 7;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(coords, 3));
      const mat = new THREE.PointsMaterial({
        color: 0xa8d589,
        size: 0.035,
        transparent: true,
        opacity: 0.75,
      });
      const points = new THREE.Points(geo, mat);
      scene.add(points);
      const resize = () => {
        const r = host.getBoundingClientRect();
        renderer.setSize(Math.max(r.width, 1), Math.max(r.height, 1));
        camera.aspect = Math.max(r.width, 1) / Math.max(r.height, 1);
        camera.updateProjectionMatrix();
      };
      resize();
      window.addEventListener("resize", resize);
      let id,
        t = 0;
      const draw = () => {
        t += 0.001;
        points.rotation.y = t;
        renderer.render(scene, camera);
        id = requestAnimationFrame(draw);
      };
      draw();
      cleanup.push(() => {
        cancelAnimationFrame(id);
        window.removeEventListener("resize", resize);
        geo.dispose();
        mat.dispose();
        renderer.dispose();
        renderer.domElement.remove();
      });
    });
  // Motion can be re-enabled for hover interactions, but not visibility-critical reveals.
  // Lottie: small vector status indicator, no remote animation asset needed.
  if (window.lottie)
    safe("Lottie", () => {
      const dot = document.querySelector(".hero .status-dot");
      if (!dot) return;
      const host = document.createElement("span");
      host.className = "urbs-lottie-dot";
      dot.replaceWith(host);
      const player = lottie.loadAnimation({
        container: host,
        renderer: "svg",
        loop: true,
        autoplay: true,
        animationData: {
          v: "5.7.4",
          fr: 30,
          ip: 0,
          op: 60,
          w: 40,
          h: 40,
          nm: "pulse",
          ddd: 0,
          assets: [],
          layers: [
            {
              ddd: 0,
              ind: 1,
              ty: 4,
              nm: "dot",
              sr: 1,
              ks: {
                o: { a: 0, k: 100 },
                r: { a: 0, k: 0 },
                p: { a: 0, k: [20, 20, 0] },
                a: { a: 0, k: [0, 0, 0] },
                s: {
                  a: 1,
                  k: [
                    { t: 0, s: [65, 65, 100] },
                    { t: 30, s: [110, 110, 100] },
                    { t: 60, s: [65, 65, 100] },
                  ],
                },
              },
              shapes: [
                { ty: "el", p: { a: 0, k: [0, 0] }, s: { a: 0, k: [18, 18] }, nm: "circle" },
                { ty: "fl", c: { a: 0, k: [0.7, 0.94, 0.42, 1] }, o: { a: 0, k: 100 }, r: 1 },
              ],
              ao: 0,
              ip: 0,
              op: 60,
              st: 0,
              bm: 0,
            },
          ],
        },
      });
      cleanup.push(() => player.destroy());
    });
}
if (document.readyState === "loading")
  document.addEventListener("DOMContentLoaded", init, { once: true });
else init();
window.addEventListener("pagehide", () => cleanup.forEach((fn) => safe("cleanup", fn)), {
  once: true,
});
