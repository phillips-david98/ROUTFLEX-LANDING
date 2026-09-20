/* Local SVG membrane for the existing ROUTEX hero. No carousel/auth mutations. */
(function initRoutexHero() {
  const hero = document.querySelector('[data-hero-carousel]');
  const slide = hero?.querySelector('.hero-slide--routex');
  const body = slide?.querySelector('.routex-life__body');
  const shape = body?.querySelector('#routex-hero-shape');
  if (!shape) return;

  const light = body.querySelector('.routex-life__body-light');
  const base = body.querySelector('.routex-life__body-base');
  const touch = body.querySelector('.hero-routex-touch');
  const touchGradient = body.querySelector('#routex-hero-touch');
  const filaments = body.querySelector('.hero-routex-filaments');
  const threads = [...filaments.querySelectorAll('path')];
  const tags = [...slide.querySelectorAll('.hero-routex-tag')];
  const login = hero.querySelector('.hero-login-card');
  const copy = hero.querySelector('.hero-copy');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const compact = matchMedia('(max-width: 960px)');
  const events = new AbortController();
  const options = { signal: events.signal, passive: true };
  const count = 40;
  const length = shape.getTotalLength();
  // Sample the existing silhouette, rather than replacing it with a sphere.
  const rest = Array.from({ length: count }, (_, i) => {
    const p = shape.getPointAtLength(i * length / count);
    const r = Math.hypot(p.x - 50, p.y - 50);
    return { x: p.x, y: p.y, nx: (p.x - 50) / r, ny: (p.y - 50) / r };
  });
  const displacement = new Float32Array(count);
  const velocity = new Float32Array(count);
  const presence = document.createElement('span');
  presence.className = 'hero-routex-presence';
  const particles = document.createElement('span');
  particles.className = 'hero-routex-particles';
  // Deterministic, sparse ambient dust: 24 points, only two blurred.
  for (let i = 0; i < 24; i++) {
    const p = document.createElement('i');
    p.style.cssText = `left:${12 + (i * 37 % 79)}%;top:${9 + (i * 23 % 83)}%;animation-delay:-${i * 1.7}s;animation-duration:${27 + i % 9}s`;
    particles.append(p);
  }
  slide.prepend(presence, particles);

  let bounds, heroBounds, tagBounds = [];
  let inView = false, running = false, frame = 0, last = 0, time = 0;
  let pointer = { x: 50, y: 50, active: false, speed: 0, at: 0 };
  let ambient = { x: 0, y: 0, targetX: 0, targetY: 0 };
  let badge = -1, pulse = 0;
  let disposed = false;

  function measure() {
    heroBounds = hero.getBoundingClientRect();
    if (compact.matches && slide.classList.contains('is-active')) {
      const bottom = copy.getBoundingClientRect().bottom;
      const loginTop = hero.querySelector('.hero-login').getBoundingClientRect().top;
      slide.style.setProperty('--hero-routex-top', `${(bottom + loginTop) / 2 - heroBounds.top}px`);
    }
    bounds = body.getBoundingClientRect();
    tagBounds = tags.map(tag => tag.getBoundingClientRect());
  }

  function pathFrom(points) {
    let d = `M${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
    for (let i = 0; i < count; i++) {
      const a = points[(i + count - 1) % count], b = points[i];
      const c = points[(i + 1) % count], e = points[(i + 2) % count];
      d += `C${(b.x + (c.x - a.x) / 6).toFixed(2)} ${(b.y + (c.y - a.y) / 6).toFixed(2)} ${ (c.x - (e.x - b.x) / 6).toFixed(2)} ${(c.y - (e.y - b.y) / 6).toFixed(2)} ${c.x.toFixed(2)} ${c.y.toFixed(2)}`;
    }
    return d + 'Z';
  }

  function render(dt) {
    time += reduced.matches ? 0 : dt;
    pointer.speed *= Math.exp(-dt * 5);
    pulse *= Math.exp(-dt * 3.6);
    const badgePoints = [[24, 20], [79, 30], [22, 75], [73, 82]];
    const source = badge >= 0 ? badgePoints[badge] : [pointer.x, pointer.y];
    const active = !reduced.matches && (badge >= 0 || pointer.active || pulse > .01);
    const sx = pulse > .05 && badge < 0 ? 84 : source[0];
    const sy = pulse > .05 && badge < 0 ? 55 : source[1];
    let energy = 0;
    const points = rest.map((p, i) => {
      const distance = Math.hypot(p.x - sx, p.y - sy);
      const local = active ? Math.exp(-(distance * distance) / 290) : 0;
      const target = local * (badge >= 0 ? 2.5 : 1.7 + pointer.speed * 1.7 + pulse * 2);
      // Underdamped springs + small neighbour coupling: impact, overshoot, rest.
      const neighbours = (displacement[(i + count - 1) % count] + displacement[(i + 1) % count]) / 2;
      velocity[i] += ((target - displacement[i]) * 72 - velocity[i] * 9 + (neighbours - displacement[i]) * 9) * dt;
      displacement[i] = Math.max(-3.2, Math.min(4.8, displacement[i] + velocity[i] * dt));
      const angle = Math.atan2(p.ny, p.nx);
      const idle = reduced.matches ? 0 : .55 * Math.sin(time * .48 + angle * 3) + .33 * Math.sin(time * .31 - angle * 5) + .2 * Math.sin(time * .67);
      const amount = idle + displacement[i];
      energy = Math.max(energy, Math.abs(displacement[i]));
      return { x: p.x + p.nx * amount, y: p.y + p.ny * amount };
    });
    const d = pathFrom(points);
    shape.setAttribute('d', d);
    base.setAttribute('d', d);
    light.setAttribute('d', d);
    touchGradient.setAttribute('cx', sx.toFixed(2));
    touchGradient.setAttribute('cy', sy.toFixed(2));
    touch.setAttribute('opacity', Math.min(.76, energy * .17).toFixed(3));
    filaments.style.opacity = (.23 + Math.min(.4, energy * .09)).toFixed(3);
    threads.forEach((thread, i) => {
      const flow = Math.sin(time * .24 + i * 1.6) * 2;
      thread.setAttribute('transform', `translate(${flow.toFixed(2)} ${(flow * .45).toFixed(2)})`);
    });
    const mix = 1 - Math.exp(-dt * 2.6);
    ambient.x += (ambient.targetX - ambient.x) * mix;
    ambient.y += (ambient.targetY - ambient.y) * mix;
    presence.style.transform = `translate(${ambient.x.toFixed(1)}px, ${ambient.y.toFixed(1)}px)`;
  }

  function tick(now) {
    if (!hero.isConnected) { dispose(); return; }
    const interval = compact.matches ? 1000 / 24 : 1000 / 30;
    if (now - last >= interval) {
      const dt = Math.min((now - last) / 1000 || 1 / 30, .05);
      last = now;
      render(dt);
    }
    frame = requestAnimationFrame(tick);
  }

  function clearPointer() {
    pointer.active = false;
    pointer.speed = 0;
    pointer.at = 0;
    badge = -1;
    tags.forEach(tag => tag.classList.remove('is-near'));
    presence.style.opacity = '0';
  }

  function sync() {
    if (disposed) return;
    const active = slide.classList.contains('is-active');
    const next = active && inView && !document.hidden && !reduced.matches;
    if (!active) clearPointer();
    measure();
    if (next === running) return;
    running = next;
    slide.classList.toggle('is-routex-running', running);
    cancelAnimationFrame(frame);
    frame = 0;
    last = performance.now();
    if (running) frame = requestAnimationFrame(tick);
    else if (reduced.matches) {
      displacement.fill(0);
      velocity.fill(0);
      clearPointer();
      pulse = 0;
      render(0);
    }
  }

  function move(event) {
    if (!running || event.pointerType === 'touch') return;
    // Cached bounds keep pointer events free of repeated layout reads.
    const x = (event.clientX - bounds.left) / bounds.width * 100;
    const y = (event.clientY - bounds.top) / bounds.height * 100;
    const elapsed = Math.max(16, event.timeStamp - pointer.at);
    const speed = pointer.at ? Math.hypot(x - pointer.x, y - pointer.y) / elapsed : 0;
    pointer = { x, y, active: true, at: event.timeStamp, speed: Math.min(1.5, speed * 2) };
    badge = tagBounds.findIndex(r => event.clientX >= r.left - 4 && event.clientX <= r.right + 4 && event.clientY >= r.top - 5 && event.clientY <= r.bottom + 5);
    tags.forEach((tag, i) => tag.classList.toggle('is-near', i === badge));
    ambient.targetX = event.clientX - heroBounds.left;
    ambient.targetY = event.clientY - heroBounds.top;
    presence.style.opacity = '1';
  }

  hero.addEventListener('pointermove', move, options);
  hero.addEventListener('pointerleave', clearPointer, options);
  hero.addEventListener('pointercancel', clearPointer, options);
  hero.addEventListener('transitionend', measure, options);
  login?.addEventListener('focusin', event => {
    if (running && event.target.matches('input')) pulse = .65;
  }, options);
  login?.addEventListener('click', event => {
    if (running && event.target.closest('.hero-login-submit')) pulse = 1;
  }, options);
  // Touch keeps the same calm idle; no capture or preventDefault on scrolling.
  window.addEventListener('scroll', measure, options);
  window.addEventListener('resize', measure, options);
  document.addEventListener('visibilitychange', sync, options);
  reduced.addEventListener('change', sync, options);
  compact.addEventListener('change', sync, options);
  const resize = new ResizeObserver(measure);
  resize.observe(hero);
  const activity = new MutationObserver(sync);
  activity.observe(slide, { attributes: true, attributeFilter: ['class'] });
  const visibility = new IntersectionObserver(entries => {
    inView = entries[0].isIntersecting;
    sync();
  }, { threshold: .05 });
  visibility.observe(hero);
  const removal = new MutationObserver(() => { if (!hero.isConnected) dispose(); });
  removal.observe(document.body, { childList: true, subtree: true });

  function dispose() {
    disposed = true;
    cancelAnimationFrame(frame);
    events.abort();
    resize.disconnect();
    activity.disconnect();
    visibility.disconnect();
    removal.disconnect();
    slide.classList.remove('is-routex-running');
    presence.remove();
    particles.remove();
  }
  window.addEventListener('pagehide', event => {
    if (!event.persisted) dispose();
    else { inView = false; sync(); }
  }, options);
  window.addEventListener('pageshow', () => {
    measure();
    inView = heroBounds.bottom > 0 && heroBounds.top < innerHeight;
    sync();
  }, options);
  measure();
  render(0);
  sync();
})();
