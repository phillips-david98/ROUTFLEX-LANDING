/* =============================================
   ROUTflex — script.js
   ============================================= */

/* =============================================
   HERO CAROUSEL — slow ambient crossfade
   ============================================= */
(function initHeroCarousel() {
  const carousel = document.querySelector("[data-hero-carousel]");
  if (!carousel) return;

  const slides = Array.from(carousel.querySelectorAll("[data-hero-slide]"));
  const indicators = Array.from(carousel.querySelectorAll("[data-hero-indicator]"));
  const previousButton = carousel.querySelector("[data-hero-prev]");
  const nextButton = carousel.querySelector("[data-hero-next]");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const interval = 7600;
  let activeIndex = 0;
  let timer = null;

  function showSlide(index) {
    activeIndex = (index + slides.length) % slides.length;

    slides.forEach((slide, slideIndex) => {
      slide.classList.toggle("is-active", slideIndex === activeIndex);
    });

    indicators.forEach((indicator, indicatorIndex) => {
      const isActive = indicatorIndex === activeIndex;
      indicator.classList.toggle("is-active", isActive);
      if (isActive) {
        indicator.setAttribute("aria-current", "true");
      } else {
        indicator.removeAttribute("aria-current");
      }
    });
  }

  function stopAutoplay() {
    window.clearInterval(timer);
    timer = null;
  }

  function startAutoplay() {
    stopAutoplay();
    if (reduceMotion || document.hidden) return;
    timer = window.setInterval(() => showSlide(activeIndex + 1), interval);
  }

  function selectSlide(index) {
    showSlide(index);
    startAutoplay();
  }

  previousButton?.addEventListener("click", () => selectSlide(activeIndex - 1));
  nextButton?.addEventListener("click", () => selectSlide(activeIndex + 1));
  indicators.forEach((indicator, index) => {
    indicator.addEventListener("click", () => selectSlide(index));
  });

  carousel.addEventListener("focusin", stopAutoplay);
  carousel.addEventListener("focusout", event => {
    if (!carousel.contains(event.relatedTarget)) startAutoplay();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stopAutoplay();
    else startAutoplay();
  });

  showSlide(0);
  startAutoplay();
})();

/* =============================================
   ECOSYSTEM CAROUSEL — product showcase
   ============================================= */
(function initEcosystemCarousel() {
  const carousel = document.querySelector("[data-ecosystem-carousel]");
  if (!carousel) return;

  const cards = Array.from(carousel.querySelectorAll("[data-ecosystem-card]"));
  if (!cards.length) return;

  const indicators = Array.from(carousel.querySelectorAll("[data-ecosystem-indicator]"));
  const previousButton = carousel.querySelector("[data-ecosystem-prev]");
  const nextButton = carousel.querySelector("[data-ecosystem-next]");
  const grid = carousel.querySelector(".ecosystem-grid");
  const title = carousel.querySelector("[data-ecosystem-title]");
  const moduleName = carousel.querySelector("[data-ecosystem-name]");
  const moduleSubtitle = carousel.querySelector("[data-ecosystem-subtitle]");
  const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const mobileQuery = window.matchMedia("(max-width: 640px)");
  const tabletQuery = window.matchMedia("(max-width: 960px)");

  const autoSpeed = 1 / 6600;
  let trackProgress = 0;
  let targetProgress = null;
  let activeIndex = -1;
  let pointerStart = null;
  let titleTimer = null;
  let lastFrame = 0;
  let isHovered = false;
  let isFocused = false;
  let stageWidth = 0;
  let cardWidth = 0;

  function wrapIndex(index) {
    return (index + cards.length) % cards.length;
  }

  function wrapProgress(value) {
    return ((value % cards.length) + cards.length) % cards.length;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function measureTrack() {
    stageWidth = grid?.clientWidth || carousel.clientWidth || window.innerWidth || 0;
    cardWidth = cards[0]?.offsetWidth || Math.min(900, stageWidth * 0.68);
  }

  function getTrackOffset(cardIndex, base = trackProgress) {
    let offset = cardIndex - wrapProgress(base);
    const half = cards.length / 2;

    if (offset > half) offset -= cards.length;
    if (offset < -half) offset += cards.length;

    return offset;
  }

  function getCenterIndex(base = trackProgress) {
    return wrapIndex(Math.round(wrapProgress(base)));
  }

  function getTargetProgress(index) {
    const nextIndex = wrapIndex(index);
    const current = wrapProgress(trackProgress);
    const half = cards.length / 2;
    let delta = nextIndex - current;

    if (delta > half) delta -= cards.length;
    if (delta < -half) delta += cards.length;

    return trackProgress + delta;
  }

  function updateActiveState(index, immediate = false) {
    if (!immediate && index === activeIndex) return;
    activeIndex = index;
    const activeCard = cards[activeIndex];

    cards.forEach((card, cardIndex) => {
      const isActive = cardIndex === activeIndex;
      const position = getTrackOffset(cardIndex, activeIndex);
      card.classList.toggle("is-active", isActive);
      card.classList.toggle("is-prev", position === -1);
      card.classList.toggle("is-next", position === 1);
      card.classList.toggle("is-far-prev", position < -1);
      card.classList.toggle("is-far-next", position > 1);
      card.setAttribute("aria-hidden", isActive ? "false" : "true");
      card.tabIndex = isActive ? 0 : -1;
    });

    indicators.forEach((indicator, indicatorIndex) => {
      const isActive = indicatorIndex === activeIndex;
      indicator.classList.toggle("is-active", isActive);
      if (isActive) indicator.setAttribute("aria-current", "true");
      else indicator.removeAttribute("aria-current");
    });

    window.clearTimeout(titleTimer);
    if (!immediate) title?.classList.add("is-changing");
    titleTimer = window.setTimeout(() => {
      if (moduleName) moduleName.textContent = activeCard.dataset.moduleName || "";
      if (moduleSubtitle) moduleSubtitle.textContent = activeCard.dataset.moduleTitle || "";
      title?.classList.remove("is-changing");
    }, immediate ? 0 : 120);
  }

  function getTrackLayout(offset) {
    const mobile = mobileQuery.matches;
    const tablet = tabletQuery.matches;
    const activeScale = mobile ? 1 : tablet ? 1.025 : 1.06;
    const phase = (offset / (cards.length / 2)) * Math.PI;
    const sinPhase = Math.sin(phase);
    const cosPhase = Math.cos(phase);
    const frontFactor = (cosPhase + 1) / 2;
    const sideShift = mobile
      ? Math.min(cardWidth * 0.48, stageWidth * 0.34)
      : tablet
        ? Math.min(cardWidth * 0.56, stageWidth * 0.30)
        : Math.min(cardWidth * 0.60, stageWidth * 0.29);
    const lift = mobile ? 0 : tablet ? 34 : 80;
    const depth = mobile ? 92 : tablet ? 154 : 210;
    const backScale = mobile ? 0.84 : tablet ? 0.79 : 0.80;
    const backOpacity = mobile ? 0 : tablet ? 0.22 : 0.20;
    const maxRotation = mobile ? 0 : tablet ? 11 : 12;
    const scaleDepth = Math.pow(frontFactor, mobile ? 1.45 : 1.12);
    const opacityDepth = Math.pow(frontFactor, mobile ? 0.70 : 0.32);
    const x = sinPhase * sideShift;
    const z = lift - depth * (1 - frontFactor);
    const scale = backScale + (activeScale - backScale) * scaleDepth;
    const opacity = mobile && frontFactor < 0.22
      ? 0
      : backOpacity + (1 - backOpacity) * opacityDepth;
    const rotation = -sinPhase * maxRotation;
    const zIndex = Math.round(1000 + frontFactor * 500);
    const shadowStrength = frontFactor * frontFactor;
    const shadowBlur = 30 + shadowStrength * 42;
    const shadowAlpha = 0.08 + shadowStrength * 0.14;

    return { x, z, scale, opacity, rotation, zIndex, shadowBlur, shadowAlpha };
  }

  function renderTrack() {
    if (!stageWidth || !cardWidth) measureTrack();

    const centerIndex = getCenterIndex();
    updateActiveState(centerIndex);

    cards.forEach((card, cardIndex) => {
      const offset = getTrackOffset(cardIndex);
      const distance = Math.abs(offset);
      const layout = getTrackLayout(offset);

      card.style.transform = `translate3d(calc(-50% + ${layout.x.toFixed(2)}px), 0, ${layout.z.toFixed(2)}px) rotateY(${layout.rotation.toFixed(3)}deg) scale(${layout.scale.toFixed(3)})`;
      card.style.opacity = layout.opacity.toFixed(3);
      card.style.zIndex = String(layout.zIndex);
      card.style.boxShadow = `0 24px ${layout.shadowBlur.toFixed(1)}px rgba(15, 23, 42, ${layout.shadowAlpha.toFixed(3)}), 0 4px 14px rgba(15, 23, 42, 0.08)`;
      card.style.pointerEvents = layout.opacity > 0.05 && distance <= 2.05 ? "auto" : "none";
    });
  }

  function selectCard(index) {
    targetProgress = getTargetProgress(index);
    if (reduceMotionQuery.matches) {
      trackProgress = wrapProgress(targetProgress);
      targetProgress = null;
      renderTrack();
    }
  }

  function animate(timestamp) {
    if (!lastFrame) lastFrame = timestamp;
    const delta = Math.min(timestamp - lastFrame, 48);
    lastFrame = timestamp;

    if (targetProgress !== null) {
      const distance = targetProgress - trackProgress;
      const easing = 1 - Math.pow(0.001, delta / 950);
      trackProgress += distance * easing;

      if (Math.abs(distance) < 0.0015) {
        trackProgress = targetProgress;
        targetProgress = null;
      }
    } else if (!reduceMotionQuery.matches && !isHovered && !isFocused && !document.hidden) {
      trackProgress += delta * autoSpeed;
    }

    if (targetProgress === null) trackProgress = wrapProgress(trackProgress);
    renderTrack();
    window.requestAnimationFrame(animate);
  }

  previousButton?.addEventListener("click", () => selectCard(activeIndex - 1));
  nextButton?.addEventListener("click", () => selectCard(activeIndex + 1));

  indicators.forEach((indicator, index) => {
    indicator.addEventListener("click", () => selectCard(index));
  });

  cards.forEach((card, index) => {
    card.addEventListener("click", () => {
      if (index !== activeIndex) selectCard(index);
    });
  });

  carousel.addEventListener("keydown", event => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      selectCard(activeIndex - 1);
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      selectCard(activeIndex + 1);
    }
  });

  carousel.addEventListener("pointerdown", event => {
    if (event.pointerType === "mouse") return;
    pointerStart = { x: event.clientX, y: event.clientY };
  }, { passive: true });

  carousel.addEventListener("pointerup", event => {
    if (!pointerStart) return;
    const distanceX = event.clientX - pointerStart.x;
    const distanceY = event.clientY - pointerStart.y;
    pointerStart = null;
    if (Math.abs(distanceX) < 44 || Math.abs(distanceX) <= Math.abs(distanceY)) return;
    selectCard(activeIndex + (distanceX < 0 ? 1 : -1));
  }, { passive: true });

  carousel.addEventListener("pointercancel", () => {
    pointerStart = null;
  }, { passive: true });

  carousel.addEventListener("pointerenter", () => { isHovered = true; });
  carousel.addEventListener("pointerleave", () => { isHovered = false; });
  carousel.addEventListener("focusin", () => { isFocused = true; });
  carousel.addEventListener("focusout", event => {
    if (!carousel.contains(event.relatedTarget)) isFocused = false;
  });
  document.addEventListener("visibilitychange", () => {
    lastFrame = 0;
  });
  window.addEventListener("resize", () => {
    measureTrack();
    renderTrack();
  }, { passive: true });

  measureTrack();
  updateActiveState(0, true);
  renderTrack();
  window.requestAnimationFrame(animate);
})();

/* =============================================
   HERO CANVAS — Operational route layer
   =============================================
   Minimal route mesh inspired by ROUTflex Planning:
   planned stops, field execution paths and subtle
   operational movement. Runs only while visible.
   ============================================= */
(function initHeroCanvas() {
  const canvas = document.getElementById("heroCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d", { alpha: true, desynchronized: true });

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
  const nodeModel = [
    { id: "A", x: 0.12, y: 0.30, pulse: 0.2, tier: "primary", color: "82, 196, 255" },
    { id: "B", x: 0.28, y: 0.22, pulse: 1.7, tier: "secondary" },
    { id: "C", x: 0.43, y: 0.39, pulse: 2.9, tier: "primary", color: "154, 226, 255" },
    { id: "D", x: 0.62, y: 0.27, pulse: 4.2, tier: "secondary", color: "112, 181, 224" },
    { id: "E", x: 0.78, y: 0.46, pulse: 5.6, tier: "secondary" },
    { id: "F", x: 0.56, y: 0.66, pulse: 6.8, tier: "primary", color: "99, 205, 255" },
    { id: "G", x: 0.34, y: 0.73, pulse: 8.1, tier: "secondary" },
    { id: "H", x: 0.84, y: 0.72, pulse: 9.3, tier: "secondary", color: "132, 172, 202" },
  ];
  const routeModel = [
    { from: 0, to: 1 },
    { from: 1, to: 2 },
    { from: 2, to: 3 },
    { from: 3, to: 4 },
    { from: 2, to: 5 },
    { from: 5, to: 6 },
    { from: 5, to: 7 },
  ];
  const particles = [
    { route: 0, t: 0.12, speed: 0.000045, delay: 0 },
    { route: 1, t: 0.68, speed: 0.000035, delay: 260 },
    { route: 2, t: 0.56, speed: 0.000037, delay: 520 },
    { route: 3, t: 0.18, speed: 0.000030, delay: 820 },
    { route: 4, t: 0.24, speed: 0.000041, delay: 1080 },
    { route: 5, t: 0.40, speed: 0.000032, delay: 1320 },
    { route: 6, t: 0.70, speed: 0.000033, delay: 1600 },
  ];
  const ambientParticles = [
    { x: 0.18, y: 0.18, driftX: 0.000006, driftY: 0.000004, size: 1.0, phase: 0.3 },
    { x: 0.36, y: 0.16, driftX: -0.000004, driftY: 0.000005, size: 0.9, phase: 1.8 },
    { x: 0.52, y: 0.21, driftX: 0.000005, driftY: -0.000003, size: 1.1, phase: 2.6 },
    { x: 0.72, y: 0.19, driftX: -0.000006, driftY: 0.000004, size: 0.95, phase: 4.1 },
    { x: 0.88, y: 0.34, driftX: -0.000004, driftY: -0.000004, size: 1.0, phase: 5.2 },
    { x: 0.20, y: 0.56, driftX: 0.000005, driftY: -0.000005, size: 0.85, phase: 3.4 },
    { x: 0.46, y: 0.58, driftX: -0.000005, driftY: 0.000003, size: 0.95, phase: 0.9 },
    { x: 0.68, y: 0.62, driftX: 0.000004, driftY: 0.000005, size: 1.05, phase: 2.1 },
    { x: 0.81, y: 0.82, driftX: -0.000005, driftY: -0.000003, size: 0.9, phase: 4.7 },
    { x: 0.30, y: 0.86, driftX: 0.000004, driftY: -0.000004, size: 1.0, phase: 5.9 },
    { x: 0.08, y: 0.42, driftX: 0.000003, driftY: 0.000005, size: 0.72, phase: 1.2 },
    { x: 0.13, y: 0.76, driftX: -0.000004, driftY: -0.000002, size: 0.82, phase: 2.8 },
    { x: 0.25, y: 0.38, driftX: 0.000005, driftY: 0.000002, size: 0.78, phase: 4.5 },
    { x: 0.33, y: 0.52, driftX: -0.000003, driftY: 0.000004, size: 0.70, phase: 0.5 },
    { x: 0.40, y: 0.29, driftX: 0.000004, driftY: -0.000003, size: 0.86, phase: 3.7 },
    { x: 0.49, y: 0.78, driftX: -0.000005, driftY: 0.000002, size: 0.76, phase: 5.5 },
    { x: 0.58, y: 0.12, driftX: 0.000003, driftY: 0.000004, size: 0.74, phase: 1.5 },
    { x: 0.61, y: 0.47, driftX: -0.000004, driftY: -0.000003, size: 0.84, phase: 2.3 },
    { x: 0.66, y: 0.86, driftX: 0.000004, driftY: -0.000002, size: 0.68, phase: 4.9 },
    { x: 0.74, y: 0.36, driftX: -0.000003, driftY: 0.000005, size: 0.80, phase: 0.1 },
    { x: 0.79, y: 0.56, driftX: 0.000005, driftY: 0.000002, size: 0.72, phase: 3.2 },
    { x: 0.87, y: 0.14, driftX: -0.000004, driftY: 0.000003, size: 0.78, phase: 5.0 },
    { x: 0.91, y: 0.64, driftX: -0.000003, driftY: -0.000004, size: 0.88, phase: 2.0 },
    { x: 0.44, y: 0.91, driftX: 0.000003, driftY: -0.000005, size: 0.74, phase: 1.0 },
    { x: 0.54, y: 0.35, driftX: -0.000005, driftY: 0.000003, size: 0.70, phase: 4.0 },
    { x: 0.70, y: 0.73, driftX: 0.000004, driftY: -0.000003, size: 0.82, phase: 5.8 },
    { x: 0.94, y: 0.45, driftX: -0.000005, driftY: 0.000002, size: 0.76, phase: 3.9 },
  ];
  const softBursts = [
    { x: 0.22, y: 0.30, delay: 700, period: 7600, phase: 0 },
    { x: 0.49, y: 0.48, delay: 3200, period: 9800, phase: 0 },
    { x: 0.76, y: 0.60, delay: 5400, period: 11200, phase: 0 },
    { x: 0.62, y: 0.24, delay: 8200, period: 12400, phase: 0 },
  ];

  let cssW = 0, cssH = 0, nodes = [], routes = [], animId, lastTs = 0, active = true;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    cssW = rect.width;
    cssH = rect.height;
    canvas.width = Math.max(1, Math.round(cssW * dpr));
    canvas.height = Math.max(1, Math.round(cssH * dpr));
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    buildRoutes();
  }

  function buildRoutes() {
    if (cssW < 2 || cssH < 2) {
      nodes = [];
      routes = [];
      return;
    }

    nodes = nodeModel.map(node => ({
      ...node,
      x: node.x * cssW,
      y: node.y * cssH,
    }));
    routes = routeModel.map(route => {
      const a = nodes[route.from];
      const b = nodes[route.to];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const length = Math.hypot(dx, dy);
      const bend = Math.min(42, length * 0.18);
      const normal = { x: -dy / length, y: dx / length };
      const sign = route.from % 2 === 0 ? 1 : -1;
      return {
        a,
        b,
        c: {
          x: (a.x + b.x) * 0.5 + normal.x * bend * sign,
          y: (a.y + b.y) * 0.5 + normal.y * bend * sign,
        },
      };
    });
  }

  function pointOnRoute(route, t) {
    const inv = 1 - t;
    return {
      x: inv * inv * route.a.x + 2 * inv * t * route.c.x + t * t * route.b.x,
      y: inv * inv * route.a.y + 2 * inv * t * route.c.y + t * t * route.b.y,
    };
  }

  function drawRoute(route, alpha, width) {
    ctx.beginPath();
    ctx.moveTo(route.a.x, route.a.y);
    ctx.quadraticCurveTo(route.c.x, route.c.y, route.b.x, route.b.y);
    ctx.strokeStyle = `rgba(94, 188, 246, ${alpha})`;
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    ctx.stroke();
  }

  function draw(ts = 0) {
    if (!active) return;
    ctx.clearRect(0, 0, cssW, cssH);
    if (!routes.length) {
      animId = requestAnimationFrame(draw);
      return;
    }

    for (let i = 0; i < routes.length; i++) {
      drawRoute(routes[i], i === 5 ? 0.17 : 0.22, i === 5 ? 1.0 : 1.25);
    }

    if (!reduceMotion) {
      const delta = lastTs ? Math.min(40, ts - lastTs) : 16;
      lastTs = ts;

      for (const ambient of ambientParticles) {
        ambient.x += ambient.driftX * delta;
        ambient.y += ambient.driftY * delta;
        if (ambient.x < 0.06) ambient.x = 0.94;
        if (ambient.x > 0.94) ambient.x = 0.06;
        if (ambient.y < 0.10) ambient.y = 0.88;
        if (ambient.y > 0.88) ambient.y = 0.10;

        const shimmer = 0.55 + 0.45 * Math.sin(ts * 0.0008 + ambient.phase);
        const x = ambient.x * cssW;
        const y = ambient.y * cssH;
        ctx.beginPath();
        ctx.arc(x, y, ambient.size * (1.4 + shimmer * 0.5), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(154, 222, 255, ${(0.07 + shimmer * 0.10).toFixed(3)})`;
        ctx.shadowColor = "rgba(59, 168, 245, 0.24)";
        ctx.shadowBlur = 6;
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      let visibleBursts = 0;
      for (const burst of softBursts) {
        const local = (ts - burst.delay) % burst.period;
        if (local < 0 || local > 1450) continue;
        if (visibleBursts >= 3) break;
        visibleBursts++;
        const progress = local / 1450;
        const alpha = Math.sin(progress * Math.PI) * 0.12;
        const x = burst.x * cssW;
        const y = burst.y * cssH;
        ctx.beginPath();
        ctx.arc(x, y, 4 + progress * 22, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(138, 218, 255, ${alpha.toFixed(3)})`;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x, y, 1.6 + progress * 2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(190, 238, 255, ${(alpha * 0.9).toFixed(3)})`;
        ctx.fill();
      }

      for (const particle of particles) {
        if (ts < particle.delay) continue;
        particle.t += particle.speed * delta;
        if (particle.t > 1) particle.t = 0;

        const route = routes[particle.route];
        const head = pointOnRoute(route, particle.t);
        const tail = pointOnRoute(route, Math.max(0, particle.t - 0.085));
        const glow = ctx.createLinearGradient(tail.x, tail.y, head.x, head.y);
        glow.addColorStop(0, "rgba(107, 206, 255, 0)");
        glow.addColorStop(1, "rgba(190, 238, 255, 0.72)");

        ctx.beginPath();
        ctx.moveTo(tail.x, tail.y);
        ctx.lineTo(head.x, head.y);
        ctx.strokeStyle = glow;
        ctx.lineWidth = 1.75;
        ctx.lineCap = "round";
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(head.x, head.y, 2.35, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(222, 248, 255, 0.86)";
        ctx.shadowColor = "rgba(59, 168, 245, 0.62)";
        ctx.shadowBlur = 9;
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }

    for (const node of nodes) {
      const primary = node.tier === "primary";
      const color = node.color || "126, 205, 245";
      const nodeRadius = primary ? 12.0 : 10.6;
      const coreRadius = primary ? 3.6 : 3.05;
      const glowRadius = primary ? 31 : 24;
      const labelOffset = primary ? 22 : 20;
      const pulse = reduceMotion ? 0 : (Math.sin(ts * 0.0012 + node.pulse) + 1) * 0.5;
      const glow = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, glowRadius);
      glow.addColorStop(0, `rgba(${color}, ${primary ? 0.23 : 0.16})`);
      glow.addColorStop(0.45, `rgba(${color}, ${primary ? 0.105 : 0.065})`);
      glow.addColorStop(1, "rgba(59, 168, 245, 0)");
      ctx.beginPath();
      ctx.arc(node.x, node.y, glowRadius, 0, Math.PI * 2);
      ctx.fillStyle = glow;
      ctx.fill();

      if (pulse > (primary ? 0.64 : 0.76)) {
        const alpha = (pulse - (primary ? 0.64 : 0.76)) * (primary ? 0.16 : 0.13);
        ctx.beginPath();
        ctx.arc(node.x, node.y, (primary ? 23 : 19) + pulse * (primary ? 13 : 10), 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${color}, ${alpha.toFixed(3)})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      ctx.beginPath();
      ctx.arc(node.x, node.y, nodeRadius, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(7, 17, 29, 0.74)";
      ctx.strokeStyle = `rgba(${color}, ${primary ? 0.68 : 0.55})`;
      ctx.lineWidth = primary ? 1.25 : 1.05;
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(node.x, node.y, coreRadius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${color}, ${primary ? 0.90 : 0.78})`;
      ctx.shadowColor = `rgba(${color}, 0.42)`;
      ctx.shadowBlur = primary ? 10 : 6;
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.font = `${primary ? "800" : "700"} ${primary ? "10px" : "9px"} Segoe UI, system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = `rgba(232, 248, 255, ${primary ? 0.84 : 0.72})`;
      ctx.fillText(node.id, node.x, node.y - labelOffset);
    }

    animId = requestAnimationFrame(draw);
  }

  const heroSection = canvas.closest(".hero-section");
  if (heroSection && "IntersectionObserver" in window) {
    new IntersectionObserver(entries => {
      active = entries[0].isIntersecting;
      if (active && !animId) animId = requestAnimationFrame(draw);
      if (!active && animId) {
        cancelAnimationFrame(animId);
        animId = null;
      }
    }, { threshold: 0.05 }).observe(heroSection);
  }

  window.addEventListener("resize", resize, { passive: true });

  resize();
  animId = requestAnimationFrame(draw);
})();

/* ---- HERO PARALLAX + PSEUDO-3D ---- */
(function initHeroParallax() {
  const heroSection = document.querySelector(".hero-section");
  const heroBg      = document.querySelector(".hero-bg");
  const mapPanel    = document.querySelector(".hero-map-panel");
  if (!heroSection || !heroBg) return;  // orb parallax only

  let tX = 0, tY = 0, cX = 0, cY = 0;

  heroSection.addEventListener("mousemove", e => {
    const r = heroSection.getBoundingClientRect();
    tX = (e.clientX - r.left  - r.width  * 0.5) / r.width;
    tY = (e.clientY - r.top   - r.height * 0.5) / r.height;
  }, { passive: true });

  heroSection.addEventListener("mouseleave", () => {
    tX = 0; tY = 0;
  }, { passive: true });

  (function tick() {
    cX += (tX - cX) * 0.07;
    cY += (tY - cY) * 0.07;

    if (heroBg) {
      heroBg.style.transform =
        `translate(${(-cX * 7).toFixed(2)}px, ${(-cY * 5).toFixed(2)}px)`;
    }
    if (mapPanel) {
      mapPanel.style.transform =
        `perspective(900px) rotateX(${(-cY * 6).toFixed(2)}deg) rotateY(${(cX * 8).toFixed(2)}deg) scale3d(1.01,1.01,1)`;
    }
    requestAnimationFrame(tick);
  })();
})();

/* ---- PREMIUM DEPTH INTERACTIONS ---- */
(function initPremiumDepth() {
  if (window.matchMedia("(hover: none), (pointer: coarse)").matches) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const targets = document.querySelectorAll(
    ".benefit-card, .feature-block, .cta-panel, .contact-point"
  );

  targets.forEach(target => {
    let frameId = 0;
    let nextX = 50;
    let nextY = 50;
    let tiltX = 0;
    let tiltY = 0;

    const commit = () => {
      frameId = 0;
      target.style.setProperty("--pointer-x", `${nextX.toFixed(2)}%`);
      target.style.setProperty("--pointer-y", `${nextY.toFixed(2)}%`);
      target.style.setProperty("--tilt-x", `${tiltX.toFixed(2)}deg`);
      target.style.setProperty("--tilt-y", `${tiltY.toFixed(2)}deg`);
    };

    const queueCommit = () => {
      if (!frameId) frameId = requestAnimationFrame(commit);
    };

    target.addEventListener("pointermove", event => {
      const rect = target.getBoundingClientRect();
      const relX = (event.clientX - rect.left) / rect.width;
      const relY = (event.clientY - rect.top) / rect.height;
      const clampX = Math.max(0, Math.min(1, relX));
      const clampY = Math.max(0, Math.min(1, relY));

      nextX = clampX * 100;
      nextY = clampY * 100;
      tiltY = (clampX - 0.5) * 5;
      tiltX = (0.5 - clampY) * 5;
      queueCommit();
    }, { passive: true });

    target.addEventListener("pointerleave", () => {
      nextX = 50;
      nextY = 50;
      tiltX = 0;
      tiltY = 0;
      queueCommit();
    }, { passive: true });
  });
})();

/* ---- HEADER: scroll shadow + mobile menu ---- */
const header    = document.querySelector(".site-header");
const navToggle = document.querySelector(".nav-toggle");
const mainNav   = document.querySelector(".main-nav");

if (header) {
  window.addEventListener("scroll", () => {
    header.classList.toggle("is-scrolled", window.scrollY > 8);
  }, { passive: true });
}

if (navToggle && header) {
  navToggle.addEventListener("click", () => {
    const open = header.classList.toggle("menu-open");
    navToggle.setAttribute("aria-expanded", String(open));
  });

  // Close menu on any nav link click
  document.querySelectorAll(".main-nav a, .header-cta").forEach(link => {
    link.addEventListener("click", () => {
      header.classList.remove("menu-open");
      navToggle.setAttribute("aria-expanded", "false");
    });
  });
}

if (mainNav) {
  const navLinks = Array.from(mainNav.querySelectorAll("a"));
  const desktopNavQuery = window.matchMedia("(min-width: 961px)");
  let activeLink = mainNav.querySelector("a.is-active") || navLinks[0];

  function moveLiquidIndicator(link) {
    if (!link || !desktopNavQuery.matches) return;

    const navRect = mainNav.getBoundingClientRect();
    const linkRect = link.getBoundingClientRect();

    mainNav.style.setProperty("--liquid-x", `${linkRect.left - navRect.left}px`);
    mainNav.style.setProperty("--liquid-y", `${linkRect.top - navRect.top}px`);
    mainNav.style.setProperty("--liquid-w", `${linkRect.width}px`);
    mainNav.style.setProperty("--liquid-h", `${linkRect.height}px`);
  }

  function setActiveLink(link) {
    activeLink = link;
    navLinks.forEach(item => {
      const isActive = item === activeLink;
      item.classList.toggle("is-active", isActive);
      if (isActive) {
        item.setAttribute("aria-current", "page");
      } else {
        item.removeAttribute("aria-current");
      }
    });
    moveLiquidIndicator(activeLink);
  }

  navLinks.forEach(link => {
    link.addEventListener("pointerenter", () => moveLiquidIndicator(link));
    link.addEventListener("focus", () => moveLiquidIndicator(link));
    link.addEventListener("click", () => setActiveLink(link));
  });

  mainNav.addEventListener("pointerleave", () => moveLiquidIndicator(activeLink));
  window.addEventListener("resize", () => moveLiquidIndicator(activeLink), { passive: true });
  window.addEventListener("load", () => moveLiquidIndicator(activeLink), { once: true });
  requestAnimationFrame(() => moveLiquidIndicator(activeLink));
}

/* ---- OPMODE MOCK — day/cycle/route animation ---- */
(function initOpModeMock() {
  const mock = document.getElementById("opmodeMock");
  if (!mock) return;

  const dayBtns    = mock.querySelectorAll(".opmode-day-btn");
  const cycleBtns  = mock.querySelectorAll(".opmode-cycle-btn");
  const covEl      = document.getElementById("opmodeCovPct");
  const tag        = document.getElementById("opmodeTag");
  const routeSvg   = mock.querySelector(".opmode-route-svg");
  const tracerAnim = document.getElementById("opTracerAnim");

  // Day sequence Seg(1)→Ter(2)→Qua(3)→Qui(4)→Sex(5)
  const DAY_SEQ  = [1, 2, 3, 4, 5];
  const COV_DAY  = [87, 91, 85, 93, 78];    // base coverage per day
  const COV_BIAS = [0, 2, -2, 4, -4, 1, 3, -1]; // delta per cycle

  // Must match the path `d` attributes of #opR0–opR4 in the SVG
  const ROUTE_PATHS = [
    "M20,42 C50,42 50,22 80,22 C110,22 110,38 150,38 C190,38 190,18 218,18 C236,18 252,24 260,30",
    "M20,42 C50,42 50,54 80,54 C110,54 110,28 150,28 C190,28 190,50 218,50 C238,50 252,38 260,20",
    "M20,42 C48,42 56,18 80,18 C104,18 116,48 150,48 C184,48 188,22 218,22 C238,22 254,30 260,36",
    "M20,42 C52,42 52,36 80,36 C108,36 112,14 150,14 C188,14 190,40 218,40 C238,40 254,26 260,24",
    "M20,42 C50,42 56,48 80,48 C104,48 116,24 150,24 C184,24 190,46 218,46 C240,46 255,30 260,16"
  ];

  let daySeqIdx = 0;
  let cycleIdx  = 1;
  let routeIdx  = 0;

  function activate(btns, newIdx, oldIdx, cls) {
    if (btns[oldIdx]) btns[oldIdx].classList.remove(cls);
    const el = btns[newIdx];
    if (!el) return;
    el.classList.add(cls, "opmode-switch-anim");
    setTimeout(() => el.classList.remove("opmode-switch-anim"), 420);
  }

  function flashTag() {
    if (!tag) return;
    tag.classList.add("is-flashing");
    setTimeout(() => tag.classList.remove("is-flashing"), 660);
  }

  function switchRoute(from, to) {
    const fromEl = document.getElementById("opR" + from);
    const toEl   = document.getElementById("opR" + to);

    if (fromEl) {
      fromEl.classList.remove("op-active");
      fromEl.classList.add("op-leaving");
      setTimeout(() => fromEl.classList.remove("op-leaving"), 300);
    }
    if (toEl) {
      toEl.classList.remove("op-active");
      void toEl.getBoundingClientRect(); // force reflow → restart CSS animation
      toEl.classList.add("op-active");
    }
    if (tracerAnim) {
      tracerAnim.setAttribute("path", ROUTE_PATHS[to]);
      try { tracerAnim.beginElement(); } catch (_) {}
    }
    if (routeSvg) {
      routeSvg.classList.remove("route-flash");
      void routeSvg.getBoundingClientRect();
      routeSvg.classList.add("route-flash");
      setTimeout(() => routeSvg.classList.remove("route-flash"), 520);
    }
  }

  function updateCoverage() {
    if (!covEl) return;
    covEl.textContent = (COV_DAY[daySeqIdx] + COV_BIAS[cycleIdx]) + "%";
  }

  // Set initial state
  if (dayBtns[DAY_SEQ[0]]) dayBtns[DAY_SEQ[0]].classList.add("opmode-day-active");
  if (cycleBtns[cycleIdx])  cycleBtns[cycleIdx].classList.add("opmode-cycle-active");
  const firstRoute = document.getElementById("opR0");
  if (firstRoute) firstRoute.classList.add("op-active");

  // Cycle active day every 2.2 s
  setInterval(() => {
    const prevDay = DAY_SEQ[daySeqIdx];
    daySeqIdx = (daySeqIdx + 1) % DAY_SEQ.length;
    const nextDay = DAY_SEQ[daySeqIdx];
    activate(dayBtns, nextDay, prevDay, "opmode-day-active");
    const prevRoute = routeIdx;
    routeIdx = daySeqIdx;
    switchRoute(prevRoute, routeIdx);
    flashTag();
    updateCoverage();
  }, 2200);

  // Cycle active cycle every 8 s
  setInterval(() => {
    const prev = cycleIdx;
    cycleIdx = (cycleIdx + 1) % cycleBtns.length;
    activate(cycleBtns, cycleIdx, prev, "opmode-cycle-active");
    flashTag();
    updateCoverage();
  }, 8000);
})();

/* ---- REVEAL ON SCROLL ---- */

// Stagger grid children so they cascade in with coordinated delays
const STAGGER_MAP = [
  { container: ".benefits-grid",    item: ".benefit-card", step: 90 },
  { container: ".feature-grid",     item: ".feature-block", step: 70 },
];
const staggeredEls = new Set();

STAGGER_MAP.forEach(({ container: cSel, item: iSel, step }) => {
  const container = document.querySelector(cSel);
  if (!container) return;
  const items = Array.from(container.querySelectorAll(iSel));
  items.forEach(el => staggeredEls.add(el));
  new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting) return;
    items.forEach((el, i) => setTimeout(() => el.classList.add("is-visible"), i * step));
  }, { threshold: 0.08 }).observe(container);
});

// All other .reveal elements fire individually
const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        revealObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.10 }
);
document.querySelectorAll(".reveal").forEach(el => {
  if (!staggeredEls.has(el)) revealObserver.observe(el);
});

/* ---- METRICS COUNTER ---- */
(function initMetricsCounter() {
  const strip = document.querySelector(".metrics-strip");
  if (!strip) return;

  function easeOutQuart(t) { return 1 - Math.pow(1 - t, 4); }

  function formatValue(raw, format) {
    if (format === "grouped") {
      return raw.toLocaleString("pt-BR").replace(",", ".");
    }
    if (format === "decimal") {
      return raw.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return String(raw);
  }

  function animateCounter(el) {
    const target  = parseFloat(el.dataset.target) || 0;
    const format  = el.dataset.format || "";
    const suffix  = el.dataset.suffix || "";
    const prefix  = el.dataset.prefix || "";
    const dur     = 1800;
    const start   = performance.now();

    function step(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / dur, 1);
      const eased = easeOutQuart(progress);
      const current = Math.round(eased * target);
      el.textContent = prefix + formatValue(current, format) + suffix;
      if (progress < 1) requestAnimationFrame(step);
      else el.textContent = prefix + formatValue(target, format) + suffix;
    }
    requestAnimationFrame(step);
  }

  new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting) return;
    strip.querySelectorAll(".js-counter").forEach(animateCounter);
  }, { threshold: 0.35 }).observe(strip);
})();

/* ---- WORKSPACE LOGIN MOCK ---- */
(function initWorkspaceLoginMock() {
  const loginForms = document.querySelectorAll(".hero-login-form, .login-form");
  if (!loginForms.length) return;

  function showWorkspaceToast(message, type = "info") {
    let toast = document.querySelector(".workspace-login-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.className = "workspace-login-toast";
      toast.setAttribute("role", "status");
      toast.setAttribute("aria-live", "polite");
      document.body.appendChild(toast);
    }

    toast.textContent = message;
    toast.dataset.type = type;
    toast.classList.add("is-visible");
    window.clearTimeout(toast._hideTimer);
    toast._hideTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 2600);
  }

  function simulateWorkspaceAccess(form) {
    const email = form.querySelector('input[type="email"]');
    const password = form.querySelector('input[type="password"]');
    const submit = form.querySelector('button[type="submit"]');
    const emailValue = email ? email.value.trim() : "empresa@demo.com";
    const passwordValue = password ? password.value.trim() : "123456";

    if (!emailValue || !passwordValue) {
      showWorkspaceToast("Use empresa@demo.com e 123456 para acessar o mock.", "error");
      if (email && !emailValue) email.focus();
      return;
    }

    if (!emailValue.includes("@") || passwordValue.length < 4) {
      showWorkspaceToast("Credenciais demo: empresa@demo.com / 123456.", "error");
      return;
    }

    if (submit) {
      submit.dataset.originalText = submit.textContent;
      submit.textContent = "Autenticando...";
      submit.classList.add("is-loading");
      submit.disabled = true;
    }

    showWorkspaceToast("Validando acesso ao ROUTflex Workspace...", "info");
    window.setTimeout(() => {
      sessionStorage.setItem("routflexWorkspaceMock", JSON.stringify({
        company: "Distribuidora Alfa LTDA",
        plan: "Enterprise",
        environment: "Produção",
        user: emailValue,
        authenticatedAt: new Date().toISOString(),
      }));
      window.location.href = "workspace.html";
    }, 950);
  }

  loginForms.forEach(form => {
    form.addEventListener("submit", event => {
      event.preventDefault();
      simulateWorkspaceAccess(form);
    });
  });
})();

/* ---- CONTACT FORM ---- */
const form      = document.querySelector(".contact-form");
const feedback  = document.querySelector(".form-feedback");

if (form && feedback) {
  const required = form.querySelectorAll("[required]");

  const validate = field => {
    const ok = field.checkValidity();
    field.classList.toggle("is-invalid", !ok);
    return ok;
  };

  required.forEach(field => {
    field.addEventListener("input", () => {
      if (field.classList.contains("is-invalid")) validate(field);
    });
  });

  form.addEventListener("submit", e => {
    e.preventDefault();
    const valid = Array.from(required).every(validate);
    feedback.classList.remove("is-success", "is-error");

    if (!valid) {
      feedback.textContent = "Preencha os campos obrigatórios antes de enviar.";
      feedback.classList.add("is-error");
      return;
    }

    feedback.textContent = "Mensagem enviada! Nossa equipe entrará em contato em breve.";
    feedback.classList.add("is-success");
    form.reset();
  });
}

/* =============================================
   ASSISTENTE VIRTUAL — ROUTflex IA (simulada)
   ============================================= */

const chatWidget  = document.getElementById("chatWidget");
const chatTrigger = document.getElementById("chatTrigger");
const chatWindow  = document.getElementById("chatWindow");
const chatCloseBtn= document.getElementById("chatCloseBtn");
const chatMessages= document.getElementById("chatMessages");
const chatForm    = document.getElementById("chatForm");
const chatInput   = document.getElementById("chatInput");
const chatChips   = document.getElementById("chatChips");

if (chatTrigger && chatWindow) { // ---- Chat block ----

// ---- Knowledge base ----
const KB = [
  {
    keys: ["como funciona", "o que é", "o que faz", "me explica", "explicar"],
    reply: "O ROUTflex é uma plataforma SaaS para organização de operações externas. Com ele você distribui territórios, balanceia clientes entre vendedores, acompanha desempenho e elimina o retrabalho de planilhas.",
    cta: null
  },
  {
    keys: ["demonstração", "demo", "testar", "ver na prática", "agendar"],
    reply: "Podemos agendar uma demonstração personalizada com a sua equipe. Basta preencher o formulário com seus dados:",
    cta: { label: "Solicitar demonstração →", href: "#contato" }
  },
  {
    keys: ["preço", "valor", "custo", "plano", "quanto custa", "investimento"],
    reply: "O ROUTflex é comercializado sob consulta, de acordo com o tamanho da sua operação e número de usuários. Para receber uma proposta:",
    cta: { label: "Fale com a equipe →", href: "#contato" }
  },
  {
    keys: ["funcionalidades", "recursos", "features", "o que tem", "balanceamento", "território", "mapa", "crm", "dashboard"],
    reply: "As principais funcionalidades são: balanceamento automático de territórios com IA, CRM e dashboards operacionais, divisão e correção de sobreposições territoriais, e a Torre de Controle para decisões estratégicas.",
    cta: { label: "Ver funcionalidades ↓", href: "#funcionalidades" }
  },
  {
    keys: ["contato", "falar", "equipe", "comercial", "atendimento", "whatsapp", "email", "e-mail"],
    reply: "Nossa equipe está disponível para conversar sobre a sua operação. Preencha o formulário de contato que retornamos rapidamente:",
    cta: { label: "Ir para o formulário →", href: "#contato" }
  },
  {
    keys: ["benefício", "vantagem", "por que", "vale a pena", "ajuda"],
    reply: "O ROUTflex reduz horas de planejamento manual, dá visibilidade operacional em tempo real e conecta estratégia com execução de campo — tudo em um sistema integrado.",
    cta: { label: "Ver benefícios ↓", href: "#beneficios" }
  }
];

const FALLBACK = "Não entendi completamente. Posso te ajudar com: como o sistema funciona, funcionalidades, demonstração ou contato com a equipe.";

function findReply(text) {
  const t = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  for (const item of KB) {
    if (item.keys.some(k => t.includes(k.normalize("NFD").replace(/[\u0300-\u036f]/g, "")))) {
      return item;
    }
  }
  return null;
}

// ---- DOM helpers ----
function scrollToBottom() {
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function appendMessage(html, side) {
  const wrap = document.createElement("div");
  wrap.className = `msg msg-${side}`;
  const bubble = document.createElement("div");
  bubble.className = "msg-bubble";
  bubble.innerHTML = html;
  wrap.appendChild(bubble);
  chatMessages.appendChild(wrap);
  scrollToBottom();
  return bubble;
}

function showTyping() {
  const wrap = document.createElement("div");
  wrap.className = "msg msg-bot";
  wrap.id = "typingIndicator";
  wrap.innerHTML = `<div class="typing-bubble"><span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span></div>`;
  chatMessages.appendChild(wrap);
  scrollToBottom();
}

function hideTyping() {
  const el = document.getElementById("typingIndicator");
  if (el) el.remove();
}

function botRespond(text) {
  const match = findReply(text);
  showTyping();

  setTimeout(() => {
    hideTyping();
    const item = match || { reply: FALLBACK, cta: null };
    let html = item.reply;
    if (item.cta) {
      html += `<br><a class="chat-cta-btn" href="${item.cta.href}">${item.cta.label}</a>`;
    }
    appendMessage(html, "bot");

    // If CTA has href with #, close chat and scroll after delay
    if (item.cta && item.cta.href.startsWith("#")) {
      setTimeout(() => {
        chatWindow.hidden = true;
        chatTrigger.setAttribute("aria-expanded", "false");
        const target = document.querySelector(item.cta.href);
        if (target) target.scrollIntoView({ behavior: "smooth" });
      }, 1800);
    }
  }, 900 + Math.random() * 400);
}

// ---- Open / Close ----
function openChat() {
  chatWindow.hidden = false;
  chatTrigger.setAttribute("aria-expanded", "true");
  chatInput.focus();

  // Greet on first open — AI analysis sequence
  if (!chatMessages.dataset.greeted) {
    chatMessages.dataset.greeted = "1";
    const aiSeq = [
      { delay:  300, typing: true },
      { delay: 1300, typing: false, text: "Inicializando análise operacional..." },
      { delay: 1600, typing: true },
      { delay: 2900, typing: false, text: "Analisei sua operação. Posso reduzir <strong>18%</strong> do custo logístico." },
      { delay: 3200, typing: true },
      { delay: 4300, typing: false, text: "Identifiquei <strong>3 zonas</strong> com sobreposição territorial. Posso otimizá-las." },
      { delay: 5100, typing: false, text: "Como posso ajudar sua equipe hoje?" },
    ];
    aiSeq.forEach(step => {
      setTimeout(() => {
        if (step.typing) { showTyping(); }
        else { hideTyping(); appendMessage(step.text, "bot"); }
      }, step.delay);
    });
  }
}

function closeChat() {
  chatWindow.hidden = true;
  chatTrigger.setAttribute("aria-expanded", "false");
  chatTrigger.focus();
}

chatTrigger.addEventListener("click", () => {
  if (chatWindow.hidden) openChat();
  else closeChat();
});

chatCloseBtn.addEventListener("click", closeChat);

// Close on Escape
document.addEventListener("keydown", e => {
  if (e.key === "Escape" && !chatWindow.hidden) closeChat();
});

// ---- Chip buttons ----
chatChips.querySelectorAll(".chip").forEach(chip => {
  chip.addEventListener("click", () => {
    const query = chip.dataset.query;
    appendMessage(chip.textContent, "user");
    botRespond(query);
  });
});

// ---- Form submit ----
chatForm.addEventListener("submit", e => {
  e.preventDefault();
  const text = chatInput.value.trim();
  if (!text) return;
  appendMessage(text, "user");
  chatInput.value = "";
  botRespond(text);
});

} // end chat block

/* ====================================================
   CUSTOM CURSOR — futuristic neon dot + trailing ring
   ==================================================== */
(function initCustomCursor() {
  // Skip on touch/coarse-pointer devices and reduced-motion preference
  if (window.matchMedia("(hover: none), (pointer: coarse)").matches) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const dot  = document.getElementById("rfxCursorDot");
  const ring = document.getElementById("rfxCursorRing");
  if (!dot || !ring) return;

  // Half-sizes for centering via JS transform offset
  const DOT_HALF   = 4;   // 8px  / 2
  const RING_BASE  = 14;  // 28px / 2
  const RING_HOVER = 21;  // 42px / 2
  const LERP       = 0.14;

  let mx = -200, my = -200;  // raw mouse — exact, no lag
  let rx = -200, ry = -200;  // ring position — lerp-smoothed
  let isHovering = false;
  let rafId;

  // ── Raw mouse position — stored on every move, no processing ─────────
  document.addEventListener("mousemove", e => {
    mx = e.clientX;
    my = e.clientY;
  }, { passive: true });

  // Activate class only after the first real mouse move confirms a pointer device
  document.addEventListener("mousemove", () => {
    document.body.classList.add("has-custom-cursor");
  }, { passive: true, once: true });

  // ── Hover detection — interactive elements trigger purple ring ────────
  const HOVER_SEL = "a, button, [role='button'], input, textarea, select, label, " +
    ".benefit-card, .feature-block, .contact-point, .cta-panel, .chip, .opmode-btn";

  document.addEventListener("mouseover", e => {
    if (e.target.closest(HOVER_SEL)) {
      isHovering = true;
      document.body.classList.add("cursor-hover");
    }
  }, { passive: true });

  document.addEventListener("mouseout", e => {
    if (e.target.closest(HOVER_SEL)) {
      isHovering = false;
      document.body.classList.remove("cursor-hover");
    }
  }, { passive: true });

  // ── Hide/show when mouse leaves/enters viewport ───────────────────────
  document.documentElement.addEventListener("mouseleave", () => {
    dot.style.opacity  = "0";
    ring.style.opacity = "0";
  });
  document.documentElement.addEventListener("mouseenter", () => {
    if (document.body.classList.contains("has-custom-cursor")) {
      dot.style.opacity  = "";
      ring.style.opacity = "";
    }
  });

  // ── Single rAF loop — both elements updated together ─────────────────
  function tick() {
    // Dot: exact position, no interpolation → zero perceived lag
    dot.style.transform =
      `translate(${mx - DOT_HALF}px,${my - DOT_HALF}px)`;

    // Ring: lerp toward mouse; offset by current half-size for centering
    rx += (mx - rx) * LERP;
    ry += (my - ry) * LERP;
    const rHalf = isHovering ? RING_HOVER : RING_BASE;
    ring.style.transform =
      `translate(${rx - rHalf}px,${ry - rHalf}px)`;

    rafId = requestAnimationFrame(tick);
  }

  // Pause loop when tab is hidden; snap ring on return to avoid long sweep
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      cancelAnimationFrame(rafId);
    } else {
      rx = mx; ry = my;
      rafId = requestAnimationFrame(tick);
    }
  });

  rafId = requestAnimationFrame(tick);
})();
