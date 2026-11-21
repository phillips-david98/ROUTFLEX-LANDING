'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const editorialBlock = css.split('/* ---- LANDING EDITORIAL TYPOGRAPHY ----')[1];
const editorial = editorialBlock && editorialBlock.slice(editorialBlock.indexOf('*/') + 2);

test('editorial typography is landing-only and reuses the existing licensed Hero font', () => {
  assert.match(html, /<body class="rfx-landing">/);
  assert.ok(editorial);
  assert.match(editorial, /--rfx-font-display: "DM Serif Display", Georgia, "Times New Roman", serif/);
  assert.match(editorial, /--rfx-font-body: "Segoe UI", system-ui, Arial, sans-serif/);
  assert.equal((css.match(/@font-face/g) || []).length, 1);
  assert.equal((html.match(/as="font"/g) || []).length, 1);
  for (const page of ['workspace.html', 'invitation.html', 'control-center/index.html']) {
    assert.doesNotMatch(fs.readFileSync(path.join(root, page), 'utf8'), /class="[^"]*\brfx-landing\b/);
  }
  const rules = editorial.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const rule of rules.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    assert.ok(rule[1].trim().startsWith('.rfx-landing'), rule[1]);
  }
});

test('all current editorial heading surfaces share the display family without changing geometry', () => {
  const headings = editorial.match(/\.rfx-landing :is\(([\s\S]*?)\) \{([^}]+)\}/);
  assert.ok(headings);
  for (const selector of [
    '.hero-copy h1', '.rfx-cinematic-scene h2', '.section-heading h2',
    '.module-detail-copy h2', '.workspace-copy h2', '.benefit-card h3',
    '.cta-copy h2', '.contact-copy h2', '.ecosystem-active-title strong',
    '.footer-dialog-header h2', '.about-dialog-copy h2',
  ]) assert.ok(headings[1].includes(selector), selector);
  assert.match(headings[2], /font-family: var\(--rfx-font-display\)/);
  assert.match(headings[2], /font-weight: 400/);
  const allowed = new Set(['font-family', 'font-weight', 'letter-spacing', 'color', '-webkit-text-stroke', 'text-shadow']);
  for (const declaration of editorial.matchAll(/(?:^|[;{}])\s*([\w-]+)\s*:/g)) {
    assert.ok(declaration[1].startsWith('--rfx-') || allowed.has(declaration[1]), declaration[1]);
  }
});

test('display contours stay subpixel, inherit through wordmarks and prioritize the intro and Hero', () => {
  const base = editorial.match(/\.rfx-landing \{([^}]+)\}/)[1];
  const hero = editorial.match(/\.rfx-landing \.hero-copy h1 \{([^}]+)\}/)[1];
  const intro = editorial.match(/\.rfx-landing \.rfx-brand-intro-logo \{([^}]+)\}/)[1];
  const stroke = rule => Number(rule.match(/--rfx-display-stroke:\s*([\d.]+)px/)[1]);
  assert.equal(stroke(base), 0.18);
  assert.equal(stroke(hero), 0.26);
  assert.equal(stroke(intro), 0.42);
  assert.ok(stroke(base) < stroke(hero) && stroke(hero) < stroke(intro) && stroke(intro) < 0.5);
  const contourRules = [...editorial.matchAll(/([^{}]+)\{[^{}]*-webkit-text-stroke:\s*var\(--rfx-display-stroke\) currentColor;[^{}]*\}/g)];
  assert.equal(contourRules.length, 2);
  assert.match(contourRules[0][1], /\.hero-copy h1/);
  assert.match(contourRules[1][1], /\.rfx-wordmark/);
  for (const rule of contourRules) assert.match(rule[0], /font-weight: 400/);
});

test('intro light is a static diffuse layer behind the lettering, without changing its timing', () => {
  const shadowRules = [...editorial.matchAll(/([^{}]+)\{([^{}]*text-shadow:[^{}]*)\}/g)];
  assert.equal(shadowRules.length, 1);
  assert.equal(shadowRules[0][1].trim(), '.rfx-landing .rfx-brand-intro-logo');
  assert.match(shadowRules[0][2], /text-shadow: none/);
  const halo = css.match(/\.rfx-landing \.rfx-brand-intro-mark::before \{([^}]+)\}/)[1];
  assert.match(halo, /z-index: -1/);
  assert.match(halo, /background: radial-gradient\(ellipse, rgba\(38, 119, 195, \.22\)/);
  assert.match(halo, /pointer-events: none/);
  assert.doesNotMatch(halo, /animation|filter|text-shadow/);
  assert.match(html, /is-leaving[^;]*; \}, 1500\)/);
  assert.match(html, /introEl.hidden = true; \}, 2150\)/);
  assert.doesNotMatch(editorial, /(?:^|[;{}])\s*(?:animation[\w-]*|transition[\w-]*|filter|opacity)\s*:/);
});

test('HTML wordmarks preserve ROUTflex spelling and have dark and light color variants', () => {
  const marks = [...html.matchAll(/<span class="rfx-wordmark">([\s\S]*?)<\/span><\/span>/g)];
  assert.equal(marks.length, 5);
  for (const mark of marks) assert.equal(mark[1].replace(/<[^>]*>/g, ''), 'ROUTflex');
  assert.match(editorial, /--rfx-brand-rout: #ffffff/);
  assert.match(editorial, /--rfx-brand-flex: var\(--c-accent\)/);
  assert.match(editorial, /\.section--light, \.rfx-cinematic-stage, \.login-card/);
  assert.match(editorial, /\.rfx-site-header:is\(\.is-scrolled, \.menu-open\)/);
  assert.match(editorial, /--rfx-brand-flex: #086fb1/);
  assert.match(editorial, /\.brand-rout \{\s*color: var\(--rfx-brand-rout\)/);
  assert.match(editorial, /\.brand-flex \{\s*color: var\(--rfx-brand-flex\)/);
});

test('Workspace presentation card keeps nested wordmarks at the original title size', () => {
  assert.match(css, /\.login-card-brand > span \{/);
  assert.doesNotMatch(css, /\.login-card-brand span \{/);
});

test('wordmark colors meet 4.5:1 contrast on dark, light and translucent header surfaces', () => {
  const rgb = hex => hex.match(/[a-f\d]{2}/gi).map(value => parseInt(value, 16));
  const luminance = channels => channels.map(value => value / 255)
    .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
    .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
  const contrast = (a, b) => {
    const x = luminance(a), y = luminance(b);
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  };
  const accent = css.match(/--c-accent:\s*(#[a-f\d]{6})/i)[1];
  const lightRules = editorial.match(/\.section--light[^{}]+\{([^}]+)\}/)[1];
  const lightBlue = lightRules.match(/--rfx-brand-flex:\s*(#[a-f\d]{6})/i)[1];
  const headerRules = editorial.match(/\.rfx-site-header:is\([^{}]+\{([^}]+)\}/)[1];
  const headerColors = [...headerRules.matchAll(/--rfx-brand-\w+:\s*(#[a-f\d]{6})/gi)].map(match => match[1]);
  for (const bg of ['#07111d', '#04090f']) {
    for (const fg of ['#ffffff', accent]) assert.ok(contrast(rgb(fg), rgb(bg)) >= 4.5, `${fg} on ${bg}`);
  }
  for (const bg of ['#ffffff', '#f7f9fc']) {
    for (const fg of ['#0f172a', lightBlue]) assert.ok(contrast(rgb(fg), rgb(bg)) >= 4.5, `${fg} on ${bg}`);
  }
  // Black behind the translucent header is the darkest possible composite.
  for (const opacity of [0.70, 0.88]) {
    const background = rgb('#dfeef6').map(channel => channel * opacity);
    for (const fg of headerColors) assert.ok(contrast(rgb(fg), background) >= 4.5, `${fg} on header ${opacity}`);
  }
});
