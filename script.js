/* =============================================
   ROUTflex — script.js
   ============================================= */

/* =============================================
   HERO CANVAS — Neon network + data streams
   =============================================
   Organic drifting nodes linked by neon
   blue→purple gradient lines. Flow particles
   simulate real-time data processing.
   Runs only while the hero is in the viewport.
   ============================================= */
(function initHeroCanvas() {
  const canvas = document.getElementById("heroCanvas");
  if (!canvas) return;
  // desynchronized: true lets the browser schedule compositing independently → smoother
  const ctx = canvas.getContext("2d", { alpha: true, desynchronized: true });

  // ─── Tuning constants ────────────────────────────────────────────────────
  // 36 nodes (was 55): O(n²) link loop drops from ~1 485 to ~630 pairs/frame
  const NODE_COUNT   = 36;
  const LINK_DIST    = 118;
  const LINK_DIST_SQ = LINK_DIST * LINK_DIST;   // pre-computed — skip sqrt on misses
  const PULSE_NODES  = [3, 14, 26];              // was 5 — 3 radial gradients/frame
  const FLOW_COUNT   = 5;                        // was 7
  // ─────────────────────────────────────────────────────────────────────────

  let W, H, nodes, flowParticles, animId, active = true;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    W = canvas.width  = rect.width;
    H = canvas.height = rect.height;
  }

  function mkNode() {
    const x   = Math.random() * W;
    const y   = Math.random() * H;
    const bx  = x * 0.55 + W * 0.28;
    const rnd = Math.random();
    // 0 = slow (35%) | 1 = medium (50%) | 2 = drift (15%)
    const tier       = rnd < 0.35 ? 0 : rnd < 0.85 ? 1 : 2;
    const speedScale = [0.06,  0.12,  0.18][tier];   // calmer than before
    const maxSpeed   = [0.10,  0.16,  0.22][tier];
    const sineAmp    = tier === 0
      ? 0.0014 + Math.random() * 0.0018
      : tier === 1
        ? 0.0032 + Math.random() * 0.0032
        : 0.0024 + Math.random() * 0.0028;
    const sineFreq   = tier === 0
      ? 0.00008 + Math.random() * 0.00010
      : tier === 1
        ? 0.00014 + Math.random() * 0.00014
        : 0.00020 + Math.random() * 0.00012;
    return {
      x: bx < W ? bx : x, y,
      vx: (Math.random() - 0.5) * speedScale,
      vy: (Math.random() - 0.5) * speedScale,
      r:   1.4 + Math.random() * 2.2,
      alpha: 0.35 + Math.random() * 0.50,
      phase: Math.random() * Math.PI * 2,
      sineFreq, sineAmp, maxSpeed,
    };
  }

  function mkFlow() {
    return {
      x: -30, y: H * 0.15 + Math.random() * H * 0.65,
      vx: 0.16 + Math.random() * 0.28,   // 0.16–0.44 (was 0.20–0.56)
      vy: (Math.random() - 0.5) * 0.10,
      r:   0.80 + Math.random() * 0.72,
      life: Math.random() * 180,
      maxLife: 290 + Math.random() * 180,
      isBlue: Math.random() > 0.40,
    };
  }

  function init() {
    resize();
    nodes         = Array.from({ length: NODE_COUNT }, mkNode);
    flowParticles = Array.from({ length: FLOW_COUNT }, mkFlow);
  }

  function draw(ts) {
    if (!active) return;
    ctx.clearRect(0, 0, W, H);

    // ── 1. Node physics ──────────────────────────────────────────────────
    for (let k = 0; k < nodes.length; k++) {
      const n = nodes[k];
      n.vx += Math.sin(ts * n.sineFreq + n.phase)        * n.sineAmp;
      n.vy += Math.cos(ts * n.sineFreq * 1.37 + n.phase) * n.sineAmp;
      const spd = Math.sqrt(n.vx * n.vx + n.vy * n.vy);
      if (spd > n.maxSpeed) { const inv = n.maxSpeed / spd; n.vx *= inv; n.vy *= inv; }
      n.x += n.vx; n.y += n.vy;
      if (n.x < 0 || n.x > W) { n.vx *= -0.9; n.x = n.x < 0 ? 0 : W; }
      if (n.y < 0 || n.y > H) { n.vy *= -0.9; n.y = n.y < 0 ? 0 : H; }
    }

    // ── 2. Links — squared-distance early exit, single computed color ────
    // Replacing createLinearGradient per link with a computed rgba eliminates
    // ~600 gradient object allocations per frame — the biggest CPU saving.
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i];
      for (let j = i + 1; j < nodes.length; j++) {
        const b  = nodes[j];
        const dx = a.x - b.x, dy = a.y - b.y;
        const distSq = dx * dx + dy * dy;
        if (distSq >= LINK_DIST_SQ) continue;       // skip sqrt on ~95% of pairs
        const fade = 1 - Math.sqrt(distSq) / LINK_DIST;
        if (fade < 0.12) continue;                   // skip near-invisible links

        const midX  = (a.x + b.x) * 0.5;
        const bright = midX > W * 0.38 ? 1.0 : 0.42;
        const pF    = Math.max(0, midX / W - 0.22) / 0.78;  // 0→1 blue→purple
        const alpha = fade * 0.27 * bright;

        // Single color per link (no gradient object) — visually imperceptible difference
        const r  = (59  + pF * 97)  | 0;
        const g  = (168 - pF * 90)  | 0;
        const bC = (245 - pF * 10)  | 0;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = `rgba(${r},${g},${bC},${+alpha.toFixed(2)})`;
        ctx.lineWidth   = fade * 1.0;
        ctx.stroke();
      }
    }

    // ── 3. Nodes ─────────────────────────────────────────────────────────
    for (let k = 0; k < nodes.length; k++) {
      const n       = nodes[k];
      const pulse   = PULSE_NODES.includes(k);
      const flicker = pulse ? 0.72 + 0.28 * Math.sin(ts * 0.0014 + n.phase) : 1.0;
      const rBoost  = n.x > W * 0.38 ? 1.45 : 0.72;

      if (pulse) {
        const pF = Math.max(0, n.x / W - 0.22) / 0.78;
        const rC = (29  + pF * 126) | 0;
        const gC = (133 - pF * 120) | 0;
        const bC = (242 - pF * 20)  | 0;
        const grd = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r * 6);
        grd.addColorStop(0, `rgba(${rC},${gC},${bC},${+(0.22 * flicker * rBoost).toFixed(2)})`);
        grd.addColorStop(1, `rgba(${rC},${gC},${bC},0)`);
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r * 6, 0, Math.PI * 2);
        ctx.fillStyle = grd;
        ctx.fill();
      }

      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r * flicker, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(74,184,247,${+(n.alpha * flicker * rBoost * 0.85).toFixed(2)})`;
      ctx.fill();
    }

    // ── 4. Flow particles — data streams ─────────────────────────────────
    for (let i = 0; i < flowParticles.length; i++) {
      const fp = flowParticles[i];
      fp.life++;
      fp.x += fp.vx;
      fp.y += fp.vy;
      if (fp.x > W + 30 || fp.life > fp.maxLife) {
        flowParticles[i] = mkFlow();
        continue;
      }

      const alpha = Math.sin((fp.life / fp.maxLife) * Math.PI) * 0.65;
      if (alpha < 0.02) continue;

      const col      = fp.isBlue ? "59,168,245" : "155,93,229";
      const trailLen = 20 + fp.vx * 18;
      const tg       = ctx.createLinearGradient(fp.x - trailLen, fp.y, fp.x, fp.y);
      tg.addColorStop(0, `rgba(${col},0)`);
      tg.addColorStop(1, `rgba(${col},${+alpha.toFixed(2)})`);
      ctx.beginPath();
      ctx.moveTo(fp.x - trailLen, fp.y);
      ctx.lineTo(fp.x, fp.y);
      ctx.strokeStyle = tg;
      ctx.lineWidth   = fp.r * 0.85;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(fp.x, fp.y, fp.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${col},${+Math.min(alpha * 1.35, 0.85).toFixed(2)})`;
      ctx.fill();
    }

    animId = requestAnimationFrame(draw);
  }

  // Pause when hero scrolls out of view — saves GPU entirely
  const heroSection = canvas.closest(".hero-section");
  if (heroSection && "IntersectionObserver" in window) {
    new IntersectionObserver(entries => {
      active = entries[0].isIntersecting;
      if (active) animId = requestAnimationFrame(draw);
    }, { threshold: 0.05 }).observe(heroSection);
  }

  window.addEventListener("resize", resize, { passive: true });

  init();
  animId = requestAnimationFrame(draw);
})();

/* ---- HERO PARALLAX + PSEUDO-3D ---- */
(function initHeroParallax() {
  const heroSection = document.querySelector(".hero-section");
  const heroVisual  = document.querySelector(".hero-visual");
  const heroBg      = document.querySelector(".hero-bg");
  const mapPanel    = document.querySelector(".hero-map-panel");
  if (!heroSection || !heroVisual) return;

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

    heroVisual.style.transform =
      `translate(${(cX * 14).toFixed(2)}px, ${(cY * 9).toFixed(2)}px)`;

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
      tiltY = (clampX - 0.5) * 8;
      tiltX = (0.5 - clampY) * 8;
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
  { container: ".benefits-grid", item: ".benefit-card", step: 90 },
  { container: ".feature-grid",  item: ".feature-block", step: 70 },
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
