'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const { setMaxListeners } = require('node:events');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const script = fs.readFileSync(path.join(root, 'script.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const source = name => {
  const start = script.indexOf(`(function ${name}()`);
  assert.ok(start >= 0, name);
  return script.slice(start, script.indexOf('})();', start) + 5);
};

function node(classes = '') {
  const names = new Set(classes.split(' ').filter(Boolean));
  const listeners = new Map(), attributes = new Map();
  return {
    dataset: {}, hidden: false, isConnected: true, style: {}, listeners, attributes,
    classList: {
      contains: key => names.has(key),
      add: key => names.add(key),
      remove: key => names.delete(key),
      toggle(key, value) { if (value) names.add(key); else names.delete(key); }
    },
    setAttribute: (key, value) => attributes.set(key, String(value)),
    getAttribute: key => attributes.get(key),
    removeAttribute: key => attributes.delete(key),
    toggleAttribute(key, value) { if (value) attributes.set(key, ''); else attributes.delete(key); },
    addEventListener(type, handler, options = {}) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(handler);
      options.signal?.addEventListener('abort', () => {
        listeners.set(type, listeners.get(type).filter(item => item !== handler));
      }, { once: true });
    },
    emit(type, event = {}) { for (const handler of listeners.get(type) || []) handler(event); },
    focus(options) { this.focusOptions = options; this.focused = true; },
    scrollIntoView(options) { this.scrollOptions = options; }
  };
}

function hero({ reduced = false } = {}) {
  const carousel = node(), document = node(), panels = [node(), node(), node()];
  const slides = ['hero-slide--original', '', '', '', 'hero-slide--routex'].map(node);
  slides.forEach((slide, index) => { slide.dataset.heroScene = ['logistics', 'operations', 'territorial', 'enterprise', 'routex'][index]; });
  slides[0].dataset.heroDuration = '9100'; slides[4].dataset.heroDuration = '8600';
  const indicators = [node(), node(), node()], prev = node(), next = node();
  carousel.querySelectorAll = selector => selector === '[data-hero-slide]' ? slides : indicators;
  const selectors = {
    '[data-hero-prev]': prev, '[data-hero-next]': next,
    '[data-hero-copy-panel="default"]': panels[0],
    '[data-hero-copy-panel="opening"]': panels[1],
    '[data-hero-copy-panel="routex"]': panels[2]
  };
  carousel.querySelector = selector => selectors[selector];
  carousel.contains = el => Boolean(el?.inHero);
  document.querySelector = selector => selector === '[data-hero-carousel]' ? carousel : document.modalOpen;
  document.hidden = false;
  const timers = new Map();
  let id = 0;
  const window = {
    matchMedia: () => ({ matches: reduced }),
    setTimeout(fn, delay) { timers.set(++id, { fn, delay }); return id; },
    clearTimeout(id) { timers.delete(id); }
  };
  vm.runInNewContext(source('initHeroCarousel'), { document, window });
  return { carousel, document, panels, slides, indicators, prev, next, timers };
}

function presentation({ reduced = false } = {}) {
  const dialog = node(), opener = node(), close = node(), link = node(), target = node(), body = node(), video = node(), videoSource = node(), status = node();
  video.pause = () => { video.paused = true; };
  video.loadCalls = 0; video.playCalls = 0;
  video.load = () => { video.loadCalls++; };
  video.play = () => { video.playCalls++; };
  video.querySelector = () => videoSource;
  videoSource.dataset.src = 'assets/video-hero.mp4';
  Object.defineProperty(videoSource, 'src', {
    set(value) { videoSource.setAttribute('src', value); },
    get() { return videoSource.getAttribute('src'); }
  });
  status.hidden = true;
  dialog.showModal = () => { dialog.open = true; close.focus(); };
  dialog.close = () => { dialog.open = false; dialog.emit('close'); };
  dialog.querySelector = selector => ({
    '[data-presentation-close]': close, '[data-presentation-video]': video, '[data-presentation-status]': status
  })[selector];
  dialog.querySelectorAll = () => [video];
  link.setAttribute('href', '#planning-showcase');
  const nodes = {
    '[data-presentation-dialog]': dialog, '[data-presentation-open]': opener,
    '[data-planning-link]': link, '#planning-showcase': target
  };
  const document = { body, querySelector: selector => nodes[selector] };
  vm.runInNewContext(source('initPlanningPresentation'), { document, window: { matchMedia: () => ({ matches: reduced }) } });
  return { dialog, opener, close, link, target, body, video, videoSource, status, document };
}

test('Hero uses real bounded product captures, commercial copy and two local CTAs', () => {
  const opening = html.slice(html.indexOf('<div class="hero-copy-panel hero-copy-panel--opening'), html.indexOf('<div class="hero-copy-panel hero-copy-panel--routex'));
  const devices = html.match(/<figure class="rfx-premium-devices">[\s\S]*?<\/figure>/)[0];
  assert.match(opening, /Planning<\/h1>/);
  assert.match(opening, /Roteirização inteligente, integrada à sua operação/);
  assert.match(opening, /href="#planning-showcase" data-planning-link>Conheça o Planning/);
  assert.match(opening, /data-presentation-open[^>]+>Assistir apresentação/);
  for (const [file, width, height, budget] of [
    ['planning-real-preview.jpg', 1024, 652, 230000],
    ['palm-real-preview.png', 372, 820, 60000]
  ]) {
    assert.ok(fs.statSync(path.join(root, 'assets', file)).size <= budget);
    assert.match(devices, new RegExp(`src="assets/${file}"[^>]+width="${width}" height="${height}"`));
  }
  assert.match(devices, /clientes fictícios/);
  assert.doesNotMatch(devices, /assets\/(?:planning|palm)\.png/);
  assert.equal((html.match(/<figure class="rfx-premium-devices">/g) || []).length, 1);
  assert.ok(html.indexOf(devices) > html.indexOf('<div class="hero-copy-panel hero-copy-panel--routex'));
});

test('original login markup is unchanged apart from the isolated recovery link', () => {
  const card = html.slice(html.indexOf('          <div class="hero-login">'), html.indexOf('        <div class="hero-carousel-controls">'))
    .replace(/                <div class="inline-password-label">[\s\S]*?                <\/div>/, '                <label for="inlinePassword">Senha</label>');
  assert.equal(crypto.createHash('sha256').update(card).digest('hex'), '6520a5f8b5c764c189475a27a0852261cfabbcff3a398be6c910e24beeef310b');
});

test('opening dwell is 1.5 seconds longer without delaying initialization; all five slides remain navigable', () => {
  const p = hero();
  assert.match(html, /hero-slide--original is-active" data-hero-slide data-hero-scene="logistics" data-hero-duration="9100"/);
  assert.equal((html.match(/\bdata-hero-slide(?=[\s>])/g) || []).length, 5);
  assert.equal(p.slides[0].classList.contains('is-active'), true);
  assert.equal(p.carousel.dataset.heroScene, 'logistics');
  assert.equal([...p.timers.values()][0].delay - 7600, 1500);
  const timer = [...p.timers.values()][0]; p.timers.clear(); timer.fn();
  assert.equal(p.slides[1].classList.contains('is-active'), true);
  assert.equal(p.carousel.dataset.heroScene, 'operations');
  assert.equal([...p.timers.values()][0].delay, 7600);
  p.prev.emit('click'); p.prev.emit('click');
  assert.equal(p.slides[4].classList.contains('is-active'), true);
  assert.equal(p.carousel.dataset.heroScene, 'routex');
  assert.equal([...p.timers.values()][0].delay, 8600);
  assert.equal(p.panels[1].getAttribute('aria-hidden'), 'true');
  assert.equal(p.panels[1].attributes.has('inert'), true);
  assert.equal(p.panels[2].getAttribute('aria-hidden'), 'false');
});

test('carousel pauses for login focus, hidden document, reduced motion and presentation dialog', () => {
  assert.equal(hero({ reduced: true }).timers.size, 0);
  const p = hero();
  p.carousel.emit('focusin'); assert.equal(p.timers.size, 0);
  p.document.activeElement = { inHero: true };
  p.document.emit('visibilitychange'); assert.equal(p.timers.size, 0);
  p.document.activeElement = null; p.document.modalOpen = true;
  p.carousel.emit('focusout', { relatedTarget: null }); assert.equal(p.timers.size, 0);
  p.document.modalOpen = false;
  p.carousel.emit('focusout', { relatedTarget: null }); assert.equal(p.timers.size, 1);
  p.document.hidden = true; p.document.emit('visibilitychange'); assert.equal(p.timers.size, 0);
});

test('presentation uses the confirmed local video in the native modal, loaded only on interaction', () => {
  assert.match(html, /<dialog[^>]+data-presentation-dialog[^>]+aria-labelledby="planning-presentation-title"/);
  assert.match(html, /data-presentation-close autofocus aria-label="Fechar apresentação"/);
  const markup = html.match(/<dialog class="rfx-presentation-dialog"[\s\S]*?<\/dialog>/)[0];
  assert.match(markup, /<video data-presentation-video controls playsinline preload="none"/);
  assert.match(markup, /data-src="assets\/video-hero\.mp4"/);
  assert.doesNotMatch(markup, /<iframe|https?:\/\/|\sautoplay|\ssrc=/);
  assert.ok(fs.existsSync(path.join(root, 'assets', 'video-hero.mp4')));
  const p = presentation();
  assert.equal(p.videoSource.src, undefined); assert.equal(p.video.loadCalls, 0);
  p.opener.emit('click');
  assert.equal(p.videoSource.src, 'assets/video-hero.mp4');
  assert.equal(p.video.loadCalls, 1); assert.equal(p.video.playCalls, 0);
  assert.equal(p.dialog.open, true); assert.equal(p.close.focused, true);
  assert.equal(p.body.classList.contains('rfx-presentation-open'), true);
  p.close.emit('click');
  assert.equal(p.dialog.open, false); assert.equal(p.opener.focused, true);
  assert.equal(p.body.classList.contains('rfx-presentation-open'), false);
  assert.equal(p.video.paused, true);
  p.opener.emit('click'); p.dialog.close();
  assert.equal(p.video.loadCalls, 1);
  assert.equal(p.opener.focused, true);
  assert.equal(p.opener.listeners.get('click').length, 1);
});

test('presentation keeps the native cursor visible above the custom cursor in the modal', () => {
  assert.match(css, /body\.has-custom-cursor \.rfx-presentation-dialog,\s*body\.has-custom-cursor \.rfx-presentation-dialog \* \{ cursor: auto !important; \}/);
  assert.match(css, /body\.has-custom-cursor \.rfx-presentation-dialog :is\(a, button\) \{ cursor: pointer !important; \}/);
  assert.match(css, /body\.has-custom-cursor \* \{ cursor: none !important; \}/);
});

test('presentation reports media and source failures explicitly and clears the message on successful play', () => {
  const p = presentation();
  p.videoSource.emit('error');
  assert.equal(p.status.hidden, true);
  p.opener.emit('click');
  for (const source of [p.video, p.videoSource]) {
    source.emit('error');
    assert.equal(p.status.hidden, false);
    assert.match(p.status.textContent, /Não foi possível carregar a apresentação/);
    p.video.emit('playing'); assert.equal(p.status.hidden, true);
  }
});

test('Escape closes the presentation and pauses playback but lets fullscreen handle its own exit', () => {
  const p = presentation(); let prevented = false;
  p.opener.emit('click');
  p.dialog.emit('keydown', { key: 'Escape', preventDefault() { prevented = true; } });
  assert.equal(prevented, true); assert.equal(p.dialog.open, false);
  assert.equal(p.video.paused, true); assert.equal(p.opener.focused, true);
  p.opener.emit('click'); p.document.fullscreenElement = p.video;
  p.dialog.emit('keydown', { key: 'Escape', preventDefault() { assert.fail('fullscreen owns Escape'); } });
  assert.equal(p.dialog.open, true);
  p.dialog.emit('keydown', { key: 'Tab', preventDefault() { assert.fail('Tab is native'); } });
  assert.equal(p.dialog.open, true);
});

test('Planning CTA scrolls and focuses the local section, respects reduced motion and modified clicks', () => {
  for (const reduced of [false, true]) {
    const p = presentation({ reduced }); let prevented = false;
    p.link.emit('click', { button: 0, preventDefault() { prevented = true; } });
    assert.equal(prevented, true); assert.equal(p.target.focused, true);
    assert.equal(p.target.scrollOptions.behavior, reduced ? 'instant' : 'smooth');
    p.target.scrollOptions = null;
    p.link.emit('click', { button: 0, ctrlKey: true });
    assert.equal(p.target.scrollOptions, null);
  }
  assert.match(html, /id="planning-showcase"[^>]+tabindex="-1"/);
  assert.match(css, /\.rfx-landing #planning-showcase \{ scroll-margin-top: 110px/);
});

test('Hero geometry reserves separate product/access columns and stable copy slots at responsive breakpoints', () => {
  const block = css.split('/* ATT04-D HERO:')[1].split('/* ---- LANDING EDITORIAL')[0];
  assert.match(block, /grid-template-columns: minmax\(0, 1fr\) 320px/);
  assert.match(block, /hero-copy-panel \{\s*grid-area: 1 \/ 1 \/ 4 \/ 2; position: relative/);
  assert.match(block, /grid-template-rows: subgrid/);
  assert.match(block, /hero-copy-footer \{ grid-row: 3/);
  assert.match(block, /rfx-premium-devices \{ grid-area: 2 \/ 1; position: relative/);
  assert.match(block, /hero-login \{ align-self: center; margin-top: 0; left: 0/);
  assert.match(block, /@media \(max-width: 960px\)/);
  assert.match(block, /grid-template-columns: minmax\(0, 1fr\); row-gap: 320px/);
  assert.doesNotMatch(block, /rfx-premium-devices \{ position: absolute/);
  for (const scene of ['operations', 'territorial', 'enterprise', 'routex']) {
    assert.match(block, new RegExp(`\\[data-hero-scene="${scene}"\\] \\{ --hero-laptop-width:`));
  }
  assert.doesNotMatch(block, /@import|@font-face|canvas|setInterval/);
});

test('ROUTEX palette is active-slide-only and changes no geometry or behavior', () => {
  const block = css.split('/* ROUTEX HERO PALETTE:')[1].split('.rfx-landing .hero-routex-stage')[0];
  for (const rule of block.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    assert.ok(rule[1].includes('.hero-section[data-hero-scene="routex"]'), rule[1]);
    assert.doesNotMatch(rule[2], /(?:^|;)\s*(?:width|height|padding|margin|position|display|transform|animation|transition|font[\w-]*)\s*:/);
  }
  for (const selector of ['.hero-actions .button-primary', '.hero-actions .button-ghost',
    '.inline-auth .hero-login-submit', '.inline-auth #inlineRetry',
    '.inline-access-modes button[aria-pressed="true"]', '.inline-password-toggle', '.hero-carousel-arrow',
    '.hero-carousel-indicator', '.rfx-site-header .brand-flex']) assert.ok(block.includes(selector), selector);
  assert.match(block, /--rfx-brand-flex: var\(--rfx-hero-accent\)/);
  assert.match(block, /\.inline-auth button[\s\S]*outline-color: var\(--rfx-hero-accent\)/);
  assert.match(block, /\.hero-carousel-indicator::before \{ background:/);
  assert.doesNotMatch(block, /\.hero-carousel-indicator(?:\.is-active)? \{ background:/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{[^}]*\.rfx-landing \.hero-section \.inline-auth button,[^}]*transition: none/);
  const p = hero({ reduced: true });
  p.prev.emit('click'); assert.equal(p.carousel.dataset.heroScene, 'routex');
  p.next.emit('click'); assert.equal(p.carousel.dataset.heroScene, 'logistics');
});

test('ROUTEX buttons and wordmarks retain accessible contrast', () => {
  const block = css.split('/* ROUTEX HERO PALETTE:')[1].split('.rfx-landing .hero-routex-stage')[0];
  const luminance = hex => hex.match(/[a-f\d]{2}/gi).map(value => parseInt(value, 16) / 255)
    .map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4)
    .reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
  const contrast = (a, b) => (Math.max(luminance(a), luminance(b)) + .05) / (Math.min(luminance(a), luminance(b)) + .05);
  const token = name => block.match(new RegExp(`--rfx-hero-${name}: (#[a-f\\d]{6})`))[1];
  for (const color of [token('primary'), token('depth'), '#8b36b9']) assert.ok(contrast('#ffffff', color) >= 4.5);
  assert.ok(contrast(token('accent'), '#07111d') >= 4.5);
  assert.ok(contrast('#4b1c68', '#9ca7ac') >= 4.5);
});

function showcase({ reduced = false, observer = true } = {}) {
  const stage = node(), image = node(), video = node(), videoSource = node(), play = node(), title = node();
  const description = node(), note = node(), status = node(), document = node(), window = node(), motion = node();
  motion.matches = reduced; window.matchMedia = () => motion; window.innerHeight = 900;
  const keys = ['geral', 'territorial', 'operacional', 'ins', 'manifesto', 'ciclos'];
  const buttons = keys.map(key => { const button = node(); button.dataset.planningFeature = key; return button; });
  const selectors = {
    '[data-planning-image]': image, '[data-planning-video]': video, '[data-planning-play]': play,
    '[data-planning-title]': title, '[data-planning-description]': description,
    '[data-planning-note]': note, '[data-planning-status]': status
  };
  stage.querySelector = selector => selectors[selector]; stage.querySelectorAll = () => buttons;
  stage.getBoundingClientRect = () => ({ top: 100, bottom: 800 });
  document.querySelector = () => stage; document.hidden = false;
  videoSource.dataset.src = 'assets/balancear.mp4';
  Object.defineProperty(videoSource, 'src', {
    set(value) { videoSource.setAttribute('src', value); },
    get() { return videoSource.getAttribute('src'); }
  });
  video.querySelector = () => videoSource; video.playCalls = 0; video.loadCalls = 0; video.pauseCalls = 0;
  video.pause = () => { video.paused = true; video.pauseCalls++; };
  video.load = () => { video.loadCalls++; };
  video.play = () => { video.playCalls++; video.paused = false; video.emit('play'); return Promise.resolve(); };
  let visibility;
  class Observer {
    constructor(callback) { visibility = callback; }
    observe() {}
    disconnect() { stage.disconnected = true; }
  }
  if (observer) window.IntersectionObserver = Observer;
  class Controller extends AbortController {
    constructor() { super(); setMaxListeners(0, this.signal); }
  }
  const context = { document, window, IntersectionObserver: Observer, AbortController: Controller };
  vm.runInNewContext(source('initPlanningShowcase'), context);
  return {
    stage, image, video, videoSource, play, title, description, note, status, document, window, motion, buttons,
    show(value) { visibility([{ isIntersecting: value }]); },
    reinitialize() { vm.runInNewContext(source('initPlanningShowcase'), context); }
  };
}
const settle = () => new Promise(resolve => setImmediate(resolve));

test('showcase has six accessible selections, only generic connections and honest integration wording', () => {
  const markup = html.slice(html.indexOf('      <!-- MODULE DETAIL — PLANNING -->'), html.indexOf('      <!-- MODULE DETAIL — SALES -->'));
  const controls = [...markup.matchAll(/<button[^>]+data-planning-feature="([^"]+)"[^>]+>/g)];
  assert.deepEqual(controls.map(match => match[1]), ['geral', 'territorial', 'operacional', 'ins', 'manifesto', 'ciclos']);
  for (const control of controls) assert.match(control[0], /aria-pressed="(?:true|false)" aria-controls="planning-demo-panel"/);
  assert.match(markup, /Conexões ilustrativas\. Integrações externas sujeitas à avaliação técnica/);
  for (const category of ['ERP', 'CRM', 'APIs', 'Dados e arquivos', 'ROUTflex OPS']) assert.ok(markup.includes(category));
  assert.match(markup, /class="rfx-planning-hub"[\s\S]*?<strong>ROUTflex Planning<\/strong>/);
  assert.doesNotMatch(markup, /\bOracle\b|\bSAP\b|\bSenior\b|certificad|parceria/i);
  assert.equal((markup.match(/<video\b/g) || []).length, 1);
  assert.match(markup, /aria-live="polite" aria-atomic="true"/);
});

test('showcase selects real feature-specific captures and identifies the historic cycle illustration', () => {
  const p = showcase();
  for (const [index, title, file] of [
    [1, 'Territórios com visão de conjunto', 'planning-real-preview.jpg'],
    [2, 'Da carteira à rota', 'planning-operational-preview.jpg'],
    [3, 'INS: contexto para planejar', 'planning-ins-preview.png'],
    [4, 'A rota em detalhe', 'planning-manifest-preview.jpg'],
    [5, 'Ciclos de planejamento', 'planning-real-preview.jpg']
  ]) {
    p.buttons[index].emit('click');
    assert.equal(p.title.textContent, title);
    assert.equal(p.image.src, `assets/${file}`);
    assert.ok(fs.existsSync(path.join(root, 'assets', file)));
    assert.equal(p.buttons.filter(button => button.getAttribute('aria-pressed') === 'true').length, 1);
    assert.equal(p.buttons[index].getAttribute('aria-pressed'), 'true');
    assert.equal(p.play.hidden, true); assert.equal(p.video.hidden, true);
    assert.equal(p.video.playCalls, 0); assert.equal(p.videoSource.src, undefined);
  }
  assert.match(p.note.textContent, /captura ilustra quatro semanas/);
  assert.match(p.note.textContent, /4 a 8 semanas em preparação/);
  p.buttons[0].emit('click'); assert.equal(p.play.hidden, false);
  p.buttons[0].dataset.planningFeature = 'missing'; p.buttons[0].emit('click');
  assert.match(p.status.textContent, /não está disponível/);
});

test('feature controls support arrows, Home, End and native button keyboard/touch activation', () => {
  const p = showcase(); let prevented = 0;
  p.buttons[0].emit('keydown', { key: 'End', preventDefault() { prevented++; } });
  assert.equal(p.buttons[5].focused, true);
  assert.equal(p.buttons[5].getAttribute('aria-pressed'), 'true');
  p.buttons[5].emit('keydown', { key: 'ArrowRight', preventDefault() { prevented++; } });
  assert.equal(p.buttons[0].getAttribute('aria-pressed'), 'true');
  p.buttons[0].emit('keydown', { key: 'ArrowUp', preventDefault() { prevented++; } });
  assert.equal(p.buttons[5].getAttribute('aria-pressed'), 'true');
  p.buttons[5].emit('keydown', { key: 'Home', preventDefault() { prevented++; } });
  assert.equal(p.buttons[0].getAttribute('aria-pressed'), 'true');
  p.buttons[0].emit('keydown', { key: 'Tab' });
  assert.equal(prevented, 4);
});

test('video stays unloaded even on viewport entry; explicit play hydrates one source only once', async () => {
  const markup = html.match(/<video data-planning-video[\s\S]*?<\/video>/)[0];
  assert.match(markup, /preload="none"/); assert.doesNotMatch(markup, /\sautoplay|\sloop|\ssrc=/);
  assert.match(markup, /data-src="assets\/balancear\.mp4"/);
  const p = showcase();
  assert.equal(p.video.loadCalls, 0); assert.equal(p.videoSource.src, undefined);
  p.show(true);
  assert.equal(p.video.loadCalls, 0); assert.equal(p.video.playCalls, 0);
  p.play.emit('click'); await settle();
  assert.equal(p.videoSource.src, 'assets/balancear.mp4');
  assert.equal(p.video.loadCalls, 1); assert.equal(p.video.playCalls, 1);
  assert.equal(p.image.hidden, true); assert.equal(p.video.hidden, false);
  p.play.emit('click'); await settle(); assert.equal(p.video.loadCalls, 1);
});

test('playback pauses on selection, viewport exit, hidden tab and pagehide; BFCache restore never autoplays', async () => {
  const p = showcase(); p.show(true); p.play.emit('click'); await settle();
  p.show(false); assert.equal(p.video.paused, true);
  p.play.emit('click'); assert.match(p.status.textContent, /visível/);
  p.show(true); p.play.emit('click'); await settle();
  p.document.hidden = true; p.document.emit('visibilitychange'); assert.equal(p.video.paused, true);
  assert.equal(p.stage.classList.contains('is-in-view'), false);
  p.document.hidden = false; p.document.emit('visibilitychange');
  p.buttons[1].emit('click'); assert.equal(p.video.hidden, true); assert.equal(p.video.paused, true);
  p.buttons[0].emit('click'); p.play.emit('click'); await settle();
  p.window.emit('pagehide', { persisted: true }); assert.equal(p.video.paused, true);
  const count = p.video.playCalls;
  p.window.emit('pageshow'); assert.equal(p.video.playCalls, count);
  p.buttons[2].emit('click'); assert.equal(p.buttons[2].getAttribute('aria-pressed'), 'true');
  p.window.emit('pagehide', { persisted: false });
  assert.equal(p.stage.disconnected, true);
  assert.equal(p.buttons[0].listeners.get('click').length, 0);
});

test('media failures are visible and interrupted play promises cannot overwrite a newer selection', async () => {
  const p = showcase(); p.show(true);
  p.video.play = () => Promise.reject(new Error('decode failed'));
  p.play.emit('click'); await settle();
  assert.match(p.status.textContent, /Não foi possível reproduzir/);
  assert.equal(p.image.hidden, false); assert.equal(p.video.hidden, true);
  p.image.emit('error'); assert.match(p.status.textContent, /Captura indisponível/);
  let reject;
  p.video.play = () => new Promise((resolve, fail) => { reject = fail; });
  p.play.emit('click'); p.buttons[3].emit('click'); reject(new Error('selection interrupted'));
  await settle();
  assert.equal(p.title.textContent, 'INS: contexto para planejar');
  assert.equal(p.status.textContent, '');
  assert.equal(p.image.hidden, false); assert.equal(p.video.hidden, true);
  p.video.emit('error'); assert.equal(p.status.textContent, '');
  p.buttons[0].emit('click'); p.play.emit('click');
  p.videoSource.emit('error'); assert.match(p.status.textContent, /Não foi possível reproduzir/);
  assert.equal(p.video.hidden, true); assert.equal(p.image.hidden, false);
});

test('showcase listeners initialize once; motion is disabled offscreen and in reduced-motion mode', () => {
  const p = showcase(); p.reinitialize();
  assert.equal(p.buttons[0].listeners.get('click').length, 1);
  assert.equal(p.stage.classList.contains('is-in-view'), false);
  p.show(true); assert.equal(p.stage.classList.contains('is-in-view'), true);
  p.motion.matches = true; p.motion.emit('change');
  assert.equal(p.stage.classList.contains('is-in-view'), false);
  const reduced = showcase({ reduced: true }); reduced.show(true);
  assert.equal(reduced.stage.classList.contains('is-in-view'), false);
  const fallback = showcase({ observer: false });
  assert.equal(fallback.stage.classList.contains('is-in-view'), true);
  fallback.stage.getBoundingClientRect = () => ({ top: 1200, bottom: 1800 });
  fallback.window.emit('scroll');
  assert.equal(fallback.stage.classList.contains('is-in-view'), false);
});

test('showcase fits complete captures without empty height reservations and simplifies motion on small screens', () => {
  const block = css.split('/* ATT04-D SHOWCASE:')[1].split('/* ---- LANDING EDITORIAL')[0];
  assert.match(block, /position: relative; width: 100%; height: auto; max-height: none; aspect-ratio: auto; object-fit: contain/);
  assert.doesNotMatch(block, /aspect-ratio: 16 \/ 10|rfx-planning-summary \{ min-height/);
  assert.match(block, /object-fit: contain/);
  assert.match(block, /rfx-planning-status:empty \{ display: none/);
  assert.match(block, /@media \(max-width: 600px\)/);
  assert.match(block, /rfx-planning-lines \{ display: none/);
  assert.match(block, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(block, /rfx-planning-packets path \{ animation: none/);
  assert.doesNotMatch(source('initPlanningShowcase'), /setInterval|requestAnimationFrame|fetch\(|localStorage|sessionStorage/);
});
