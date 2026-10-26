/* ROUTflex — scroll drives copy and navigation; the original film plays independently. */
(function initCinematicStage() {
  const stage = document.querySelector('[data-cinematic-stage]');
  if (!stage || stage.classList.contains('rfx-cinematic-stage--ready')) return;
  const sticky = stage.querySelector('.rfx-cinematic-sticky');
  const video = stage.querySelector('video');
  const media = stage.querySelector('.rfx-cinematic-media');
  const status = stage.querySelector('.rfx-cinematic-video-status');
  const nav = stage.querySelector('.rfx-cinematic-nav');
  const counter = stage.querySelector('[data-cinematic-count]');
  const label = stage.querySelector('[data-cinematic-label]');
  const progressBar = stage.querySelector('[role="progressbar"]');
  const fill = stage.querySelector('.rfx-cinematic-progress-fill');
  const previous = stage.querySelector('[data-cinematic-prev]');
  const next = stage.querySelector('[data-cinematic-next]');
  const footer = stage.querySelector('.rfx-cinematic-footer');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const compact = matchMedia('(max-width: 700px)');
  const events = new AbortController();
  const listen = (el, type, fn, options = {}) => el?.addEventListener(type, fn, { ...options, signal: events.signal });
  const clamp = value => Math.max(0, Math.min(1, value));
  const smooth = (start, end, value) => { const t = clamp((value - start) / (end - start)); return t * t * (3 - 2 * t); };

  // Short vertical dissolves leave generous reading plateaus. Native scroll stays in control.
  const scenes = [
    { name: 'planning', label: 'Planning', range: [0, 0, .255, .30], stop: .12 },
    { name: 'sales', label: 'Sales', range: [.30, .345, .465, .51], stop: .39 },
    { name: 'palm', label: 'Palm', range: [.51, .555, .675, .72], stop: .60 },
    { name: 'ops', label: 'Ops', range: [.72, .765, 1, 1], stop: .82 },
  ].map(scene => ({ ...scene, el: stage.querySelector(`[data-cinematic-scene="${scene.name}"]`) }));
  let frame = 0, dirty = true, disposed = false, top = 0, travel = 1, height = 1;
  let lastProgress = -1, activeIndex = -1, lastPercent = -1, lastActive = false;
  let lastEntrance = -1;
  let videoFailed = false;
  let timeline = null, trigger = null, observer = null;

  // VIDEO: the prepared film owns its transitions; keep native autoplay/loop.
  function onVideoReady() {
    if (videoFailed) return;
    if (video.readyState >= 2) status.hidden = true;
  }
  function onVideoError() {
    videoFailed = true;
    stage.dataset.cinematicVideoError = 'true';
    status.textContent = 'A cena está indisponível. Explore as soluções pelo texto.';
    status.hidden = false;
    media.style.opacity = '0';
  }
  function checkMediaState() {
    // NETWORK_NO_SOURCE is also transient before initial resource selection.
    // Only treat it as a failure after load, or when an actual media error exists.
    if (video.error || (document.readyState === 'complete' && video.readyState === 0 && video.networkState === HTMLMediaElement.NETWORK_NO_SOURCE)) onVideoError();
  }

  // TIMELINE: use the landing's GSAP; native math keeps it usable if the CDN fails.
  function buildTimeline() {
    trigger?.kill(); trigger = null;
    timeline?.kill(); timeline = null;
    if (!reduced.matches && window.gsap && window.ScrollTrigger) {
      gsap.registerPlugin(ScrollTrigger);
      timeline = gsap.timeline({ paused: true });
      timeline.to({}, { duration: 1 }); // Includes the final reading/release interval.
      scenes.forEach((scene, i) => {
        const [enter, full, leave, gone] = scene.range;
        const amplitude = compact.matches ? 14 : 28;
        gsap.set(scene.el, { y: i ? amplitude : 0, opacity: i ? 0 : 1 });
        if (i) timeline.to(scene.el, { y: 0, opacity: 1, duration: full - enter, ease: 'power2.out' }, enter);
        if (gone > leave) timeline.to(scene.el, { y: -amplitude * .6, opacity: 0, duration: gone - leave, ease: 'power2.in' }, leave);
      });
      trigger = ScrollTrigger.create({
        trigger: stage, start: () => top, end: () => top + travel,
        animation: timeline, scrub: true,
        onRefreshInit: measure, onUpdate: schedule, onRefresh: schedule,
      });
      stage.dataset.cinematicEngine = 'gsap';
    } else stage.dataset.cinematicEngine = reduced.matches ? 'static' : 'native';
    lastProgress = -1;
    invalidate();
  }
  function renderNative(progress) {
    scenes.forEach((scene, i) => {
      const [enter, full, leave, gone] = scene.range;
      const entrance = i ? 1 - Math.pow(1 - clamp((progress - enter) / (full - enter)), 3) : 1;
      const departure = gone > leave ? Math.pow(clamp((progress - leave) / (gone - leave)), 3) : 0;
      const y = (compact.matches ? 14 : 28) * (1 - entrance - departure * .6);
      scene.el.style.opacity = String(entrance * (1 - departure));
      scene.el.style.transform = `translate3d(0,${y}px,0)`;
    });
  }

  // NAVIGATION: arrows move the real scroll, never an independent module state.
  function updateNavigation(progress) {
    const index = progress < .30 ? 0 : progress < .51 ? 1 : progress < .72 ? 2 : 3;
    if (index !== activeIndex) {
      activeIndex = index;
      counter.textContent = String(index + 1).padStart(2, '0');
      label.textContent = scenes[index].label;
      stage.dataset.cinematicScene = scenes[index].name;
      previous.setAttribute('aria-disabled', String(index === 0));
      next.setAttribute('aria-disabled', String(index === scenes.length - 1));
      scenes.forEach((scene, i) => {
        scene.el.setAttribute('aria-hidden', String(i !== index));
        scene.el.inert = i !== index;
      });
    }
    const percent = Math.round(progress * 100);
    if (percent !== lastPercent) {
      progressBar.setAttribute('aria-valuenow', String(percent));
      lastPercent = percent;
    }
    fill.style.transform = `scaleX(${progress})`;
    const opacity = 1 - smooth(.94, 1, progress);
    nav.style.opacity = String(opacity);
    nav.inert = opacity < .02;
    nav.setAttribute('aria-hidden', String(opacity < .02));
    footer.style.opacity = String(opacity);
    footer.inert = opacity < .02;
    footer.setAttribute('aria-hidden', String(opacity < .02));
  }
  function goToModule(delta) {
    if (reduced.matches) return;
    const index = activeIndex + delta;
    if (index < 0 || index >= scenes.length) return;
    if (dirty) measure();
    window.scrollTo({ top: top + scenes[index].stop * travel, behavior: 'smooth' });
  }

  // GEOMETRY / LIFECYCLE: CSS owns the pin; release never inserts/removes spacers.
  function measure() {
    const inset = parseFloat(getComputedStyle(sticky).top) || 0;
    top = stage.getBoundingClientRect().top + window.scrollY - inset;
    height = sticky.offsetHeight;
    travel = Math.max(1, stage.offsetHeight - height);
    dirty = false;
  }
  function render() {
    frame = 0;
    if (disposed || document.hidden) return;
    if (dirty) { measure(); trigger?.refresh(); }
    // Reveal within the approach to the existing sticky section; no extra pin or scroll distance.
    const entrance = reduced.matches ? 1 : smooth(top - height * .85, top - height * .1, window.scrollY);
    if (entrance !== lastEntrance) {
      stage.style.setProperty('--rfx-intro-reveal', entrance.toFixed(4));
      stage.style.setProperty('--rfx-intro-lift', `${((1 - entrance) * 28).toFixed(2)}px`);
      lastEntrance = entrance;
    }
    // Scroll positions are quantized to device pixels; settle both endpoints exactly.
    const distance = window.scrollY - top;
    const progress = reduced.matches || distance <= 1 ? 0 : distance >= travel - 1 ? 1 : clamp(distance / travel);
    const active = !reduced.matches && window.scrollY > top - height && window.scrollY < top + travel + height;
    if (active !== lastActive) { stage.dataset.cinematicActive = String(active); lastActive = active; }
    if (!reduced.matches && progress !== lastProgress) {
      if (timeline) timeline.progress(progress); else renderNative(progress);
      updateNavigation(progress);
      stage.dataset.cinematicProgress = progress.toFixed(5);
      lastProgress = progress;
    }
  }
  function schedule() { if (!frame && !disposed && !document.hidden) frame = requestAnimationFrame(render); }
  function invalidate() { dirty = true; schedule(); }
  function syncPreferences() {
    stage.classList.toggle('rfx-cinematic-stage--static', reduced.matches);
    activeIndex = -1;
    footer.inert = false;
    footer.removeAttribute('aria-hidden');
    scenes.forEach(scene => {
      scene.el.removeAttribute('style'); scene.el.removeAttribute('aria-hidden'); scene.el.inert = false;
    });
    buildTimeline();
  }
  function cleanup(event) {
    if (event.persisted) return;
    disposed = true;
    cancelAnimationFrame(frame);
    trigger?.kill(); timeline?.kill(); observer?.disconnect();
    events.abort();
  }

  stage.classList.add('rfx-cinematic-stage--ready');
  listen(previous, 'click', () => goToModule(-1));
  listen(next, 'click', () => goToModule(1));
  listen(video, 'loadeddata', onVideoReady);
  listen(video, 'progress', schedule);
  listen(video, 'canplay', schedule);
  listen(video, 'error', onVideoError);
  listen(video.querySelector('source'), 'error', onVideoError);
  listen(window, 'scroll', schedule, { passive: true });
  listen(window, 'resize', invalidate, { passive: true });
  listen(window, 'load', invalidate, { once: true });
  listen(window, 'load', checkMediaState, { once: true });
  listen(window, 'pageshow', invalidate);
  listen(window, 'pagehide', cleanup);
  listen(document, 'visibilitychange', invalidate);
  listen(reduced, 'change', syncPreferences);
  listen(compact, 'change', syncPreferences);
  if ('ResizeObserver' in window) {
    observer = new ResizeObserver(invalidate);
    observer.observe(stage); observer.observe(sticky);
    if (stage.previousElementSibling) observer.observe(stage.previousElementSibling);
  }
  document.fonts?.ready.then(invalidate);
  syncPreferences();
  if (video.readyState >= 2) onVideoReady();
  checkMediaState();
})();
