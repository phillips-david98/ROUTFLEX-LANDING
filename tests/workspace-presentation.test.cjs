'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
const html = read('workspace.html');
const css = read('workspace.css');
const source = read('workspace.js');
const sidebar = source.split('/* ====================================================== SIDEBAR VISUAL */')[1]
  .split('/* ================================================================ NAV */')[0];
const navigation = source.split('/* ================================================================ NAV */')[1]
  .split('/* ============================================================= LOGOUT */')[0];

function sidebarFixture(withControl = true) {
  const classes = new Set();
  const handlers = new Map();
  const attributes = new Map();
  const button = {
    hidden: true,
    addEventListener: (type, listener) => handlers.set(type, listener),
    setAttribute: (key, value) => attributes.set(key, value),
  };
  const shell = {
    classList: {
      toggle(name) {
        if (classes.has(name)) { classes.delete(name); return false; }
        classes.add(name); return true;
      },
    },
  };
  const context = vm.createContext({ $: id => id === 'sidebarToggle' && withControl ? button : null, workspaceShell: shell });
  vm.runInContext(sidebar, context);
  return { button, classes, handlers, attributes, context };
}

test('sidebar visual control is opt-in, reversible and accessible without changing destinations', () => {
  const f = sidebarFixture();
  assert.equal(f.button.hidden, false);
  assert.deepEqual([...f.handlers.keys()], ['click']);
  assert.equal(f.classes.size, 0);
  f.handlers.get('click')();
  assert.ok(f.classes.has('is-sidebar-collapsed'));
  assert.equal(f.attributes.get('aria-expanded'), 'false');
  assert.equal(f.attributes.get('aria-label'), 'Expandir menu lateral');
  assert.equal(f.button.title, 'Expandir menu lateral');
  f.handlers.get('click')();
  assert.equal(f.classes.size, 0);
  assert.equal(f.attributes.get('aria-expanded'), 'true');
  assert.equal(f.attributes.get('aria-label'), 'Recolher menu lateral');
  assert.doesNotMatch(sidebar, /\b(?:api|Core|state|localStorage|sessionStorage|fetch|location|permissions)\b/);
  assert.doesNotThrow(() => sidebarFixture(false));
});

test('collapsed navigation retains original sections and adds Payments with accessible names, icons and tooltips', () => {
  const nav = html.match(/<nav class="workspace-nav"[^>]*>([\s\S]*?)<\/nav>/)[1];
  const links = [...nav.matchAll(/<a ([^>]+)>([\s\S]*?)<\/a>/g)];
  assert.equal(links.length, 8);
  const targets = ['workspace', 'modulos', 'usuarios', 'licenciamento', 'pagamentos', 'seguranca', 'marketplace', 'configuracoes'];
  links.forEach(([_, attrs, content], index) => {
    assert.ok(attrs.includes(`href="#${targets[index]}"`));
    assert.ok(attrs.includes(`data-section="${targets[index]}"`));
    const label = content.match(/<span class="sidebar-item-label">([^<]+)<\/span>/)[1];
    assert.ok(attrs.includes(`aria-label="${label}"`));
    assert.ok(attrs.includes(`title="${label}"`));
    assert.match(content, /<svg[^>]+aria-hidden="true"/);
    assert.match(html, new RegExp(`id="${targets[index]}"`));
  });
  assert.match(html, /id="sidebarToggle"[^>]*aria-controls="workspaceSidebar"[^>]*aria-expanded="true"[^>]*hidden/);
  assert.match(html, /id="workspaceSidebar"/);
  assert.match(html, /id="logoutTrigger"[^>]*aria-label="Encerrar sessão"[^>]*title="Encerrar sessão"/);
});

test('actual navigation handlers activate every section with the sidebar both expanded and collapsed', () => {
  const f = sidebarFixture();
  const ids = ['workspace', 'modulos', 'usuarios', 'licenciamento', 'pagamentos', 'seguranca', 'marketplace', 'configuracoes'];
  const nodes = new Map(ids.map(id => {
    const classes = new Set();
    return [id, { id, classes, classList: { add: name => classes.add(name), remove: name => classes.delete(name) } }];
  }));
  const links = ids.map(id => {
    const handlers = new Map(), classes = new Set(), attributes = new Map();
    return {
      dataset: { section: id }, handlers, classes, attributes,
      classList: { toggle: (name, active) => active ? classes.add(name) : classes.delete(name) },
      addEventListener: (type, listener) => handlers.set(type, listener),
      setAttribute: (key, value) => attributes.set(key, value),
      removeAttribute: key => attributes.delete(key),
    };
  });
  f.context.document = { getElementById: id => nodes.get(id), querySelectorAll: () => links };
  const windowHandlers = new Map();
  let observe;
  f.context.window = { requestAnimationFrame: callback => callback(), location: { hash: '#pagamentos' },
    addEventListener: (type, listener) => windowHandlers.set(type, listener), IntersectionObserver: true };
  f.context.IntersectionObserver = class { constructor(callback) { observe = callback; } observe() {} };
  vm.runInContext(navigation, f.context);
  const active = () => links.find(link => link.classes.has('is-active'));
  assert.equal(active().dataset.section, 'pagamentos', 'direct URL and F5 select Payments');
  observe([{ isIntersecting: true, intersectionRatio: 1, target: nodes.get('workspace') }]);
  assert.equal(active().dataset.section, 'pagamentos', 'late layout observation cannot replace the anchor');
  f.context.window.location.hash = '#usuarios'; windowHandlers.get('hashchange')();
  assert.equal(active().dataset.section, 'usuarios');
  assert.equal(active().attributes.get('aria-current'), 'location');
  for (const collapsed of [false, true]) {
    if (collapsed) f.handlers.get('click')();
    for (const link of links) {
      link.handlers.get('click')();
      assert.ok(link.classes.has('is-active'), link.dataset.section);
      assert.equal(links.filter(item => item.classes.has('is-active')).length, 1);
      assert.ok(nodes.get(link.dataset.section).classes.has('is-section-focus'));
      assert.equal(f.classes.has('is-sidebar-collapsed'), collapsed);
    }
  }
});

test('sidebar widths, bounded transition, small screens and reduced motion have explicit rules', () => {
  assert.match(css, /--ws-sidebar-width: 232px/);
  assert.match(css, /\.workspace-shell\.is-sidebar-collapsed \{\s*--ws-sidebar-width: 72px/);
  assert.match(css, /grid-template-columns: calc\(var\(--ws-sidebar-width\) \+ var\(--ws-sidebar-gutter\) \* 2\) minmax\(0, 1fr\)/);
  assert.match(css, /transition: grid-template-columns 220ms ease/);
  assert.match(css, /@media \(max-width: 1120px\)[\s\S]*?\.workspace-shell \{ grid-template-columns: 1fr; \}/);
  assert.match(css, /@media \(max-width: 720px\)[\s\S]*?\.is-sidebar-collapsed \.workspace-nav \{ grid-template-columns: repeat\(4, minmax\(0, 1fr\)\); \}/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.workspace-shell,[\s\S]*?transition: none/);
  assert.match(css, /\[hidden\] \{\s*display: none !important/);
});

test('Workspace shares the actual landing font resource and contour without styling administrative microcopy as display', () => {
  const font = css.match(/@font-face \{[\s\S]*?\}/)[0];
  const landingFont = read('styles.css').match(/@font-face \{[\s\S]*?\}/)[0];
  assert.equal(font, landingFont);
  assert.match(html, /as="font" type="font\/woff2" crossorigin/);
  assert.match(css, /--ws-font-display: "DM Serif Display", Georgia, "Times New Roman", serif/);
  const display = css.match(/\.workspace-brand strong,\s*\.workspace-topbar h1,[\s\S]*?\{[\s\S]*?\}/)[0];
  assert.match(display, /font-weight: 400/);
  assert.match(display, /-webkit-text-stroke: 0\.18px currentColor/);
  assert.doesNotMatch(display, /\b(?:th|td|input|button|select|textarea|metric-card|ws-subtitle)\b|font-size:/);
});

test('premium surfaces and administrative controls are isolated from invitation and keep states data-driven', () => {
  assert.match(html, /<body class="workspace-premium">/);
  assert.doesNotMatch(read('invitation.html'), /workspace-premium/);
  assert.match(css, /\.workspace-premium \{[\s\S]*?--radius: 14px/);
  assert.match(css, /\.module-card\.module-active \{ border-color:/);
  assert.match(css, /\.workspace-premium :is\(\.workspace-main, \.logout-modal\) :is\(button, \.ws-btn-link\):not\(\.secondary\)/);
  assert.match(css, /\.workspace-premium :is\(a, button, input, select, textarea\):focus-visible/);
  assert.match(css, /\.table-card \{\s*overflow: auto/);
  assert.match(css, /font-variant-numeric: tabular-nums/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.workspace-premium :is\([\s\S]*?transition: none;\s*animation: none/);
  assert.doesNotMatch(css, /@keyframes (?:premium|sidebar|glass|glow)/);
});

test('premium administrative text, buttons and module initials meet 4.5:1 contrast', () => {
  const rgb = hex => hex.match(/[a-f\d]{2}/gi).map(value => parseInt(value, 16));
  const luminance = hex => rgb(hex).map(value => value / 255)
    .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
    .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
  const contrast = (a, b) => {
    const x = luminance(a), y = luminance(b);
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  };
  const theme = css.match(/\.workspace-premium \{([^}]+)\}/)[1];
  const pageBackground = theme.match(/--bg: (#[a-f\d]{6})/i)[1];
  for (const token of ['muted', 'accent']) {
    const color = theme.match(new RegExp(`--${token}: (#[a-f\\d]{6})`, 'i'))[1];
    assert.ok(contrast(color, pageBackground) >= 4.5, token);
  }
  const controls = css.match(/\.workspace-premium :is\(\.workspace-main, \.logout-modal\) :is\(button, \.ws-btn-link\):not\(\.secondary\) \{([^}]+)\}/)[1];
  assert.match(controls, /color: #ffffff/);
  const gradient = controls.match(/linear-gradient\(135deg, (#[a-f\d]{6}), (#[a-f\d]{6})\)/i);
  for (const color of gradient.slice(1)) assert.ok(contrast('#ffffff', color) >= 4.5, color);
  for (const key of ['planning', 'ops', 'palm', 'sales']) {
    const color = css.match(new RegExp(`\\.ws-seat-pill\\)\\.${key} \\{ background: (#[a-f\\d]{6})`, 'i'))[1];
    assert.ok(contrast('#ffffff', color) >= 4.5, key);
  }
  const sidebarTheme = css.match(/\.workspace-sidebar \{([^}]+)\}/)[1];
  const rgba = value => [...value.matchAll(/rgba\((\d+), (\d+), (\d+), ([\d.]+)\)/g)]
    .map(match => match.slice(1).map(Number));
  const composite = (foreground, background) => foreground.slice(0, 3)
    .map((channel, index) => channel * foreground[3] + background[index] * (1 - foreground[3]));
  const hex = channels => '#' + channels.map(channel => Math.round(channel).toString(16).padStart(2, '0')).join('');
  const backgroundLayers = rgba(sidebarTheme.match(/background: ([^;]+);/)[1]);
  assert.equal(backgroundLayers.length, 2);
  const sidebarBackgrounds = [];
  for (const layer of backgroundLayers) {
    const background = composite(layer, [255, 255, 255]);
    sidebarBackgrounds.push(background);
    assert.ok(layer[3] >= 0.97 && layer[3] < 1, 'sidebar retains slight, controlled transparency');
    assert.ok(luminance(hex(background)) < 0.006, 'sidebar stays black-blue, not washed blue, even over white');
    const text = sidebarTheme.match(/--ws-nav-text: (#[a-f\d]{6})/i)[1];
    assert.ok(contrast(text, hex(background)) >= 4.5, 'navigation text on near-black glass');
  }
  const sheen = css.match(/\.workspace-nav a::after \{([^}]+)\}/)[1];
  const reflections = rgba(sheen.match(/background:\s*([^;]+);/)[1]).reverse();
  assert.equal(reflections.length, 2);
  const hover = css.match(/\.workspace-nav a:hover \{([^}]+)\}/)[1];
  const fills = ['active-start', 'active-end'].map(token => {
    const fill = rgba(sidebarTheme.match(new RegExp(`--ws-nav-${token}: ([^;]+);`))[1])[0];
    assert.ok(fill[3] > 0 && fill[3] < 1, `${token} is translucent glass`);
    return fill;
  });
  fills.push(rgba(hover.match(/background: ([^;]+);/)[1])[0]);
  for (const background of sidebarBackgrounds) {
    for (const fill of fills) {
      let brightest = composite(fill, background);
      // Stack both reflection peaks at full opacity to bound every interaction state.
      for (const reflection of reflections) brightest = composite(reflection, brightest);
      assert.ok(contrast('#ffffff', hex(brightest)) >= 4.5, 'white text on brightest liquid-glass fill');
    }
  }
  const profile = css.match(/\.session-copy small \{[^}]*color: (#[a-f\d]{6})/i)[1];
  assert.ok(contrast(profile, '#1c405e') >= 4.5, 'profile email on brightest profile gradient');
});

test('reference-driven sidebar is a rounded floating near-black panel with unboxed navigation', () => {
  const sidebarRule = css.match(/\.workspace-sidebar \{([^}]+)\}/)[1];
  assert.match(sidebarRule, /margin: var\(--ws-sidebar-gutter\)/);
  assert.match(sidebarRule, /height: calc\(100dvh - var\(--ws-sidebar-gutter\) \* 2\)/);
  assert.match(sidebarRule, /border-radius: 24px/);
  assert.match(sidebarRule, /backdrop-filter: blur\(8px\)/);
  assert.match(sidebarRule, /overflow-y: auto/);
  assert.doesNotMatch(sidebarRule, /radial-gradient/);
  const brand = css.match(/\.workspace-sidebar-heading \{([^}]+)\}/)[1];
  assert.match(brand, /border-bottom: 1px solid/);
  assert.doesNotMatch(brand, /background:|box-shadow:|border-radius:/);
  const nav = css.match(/\.workspace-nav a \{([^}]+)\}/)[1];
  assert.match(nav, /min-height: 44px/);
  assert.match(nav, /border-radius: 14px/);
  assert.match(nav, /background: transparent/);
  assert.match(nav, /border: 1px solid transparent/);
  assert.match(nav, /box-shadow: none/);
  const icon = css.match(/\.workspace-nav svg \{([^}]+)\}/)[1];
  assert.match(icon, /width: 20px/);
  assert.doesNotMatch(icon, /padding:|border:|background:|box-shadow:/);
  const active = css.match(/\.workspace-nav a\.is-active \{([^}]+)\}/)[1];
  assert.match(active, /var\(--ws-nav-active-start\), var\(--ws-nav-active-end\)/);
  assert.match(active, /font-weight: 650/);
  assert.match(css, /\.workspace-nav a::before \{[^}]*width: 3px/);
  const profile = css.match(/^\.session-identity \{([^}]+)\}/m)[1];
  assert.match(profile, /border-radius: 12px/);
  assert.match(profile, /margin-bottom: 12px/);
  assert.doesNotMatch(profile, /box-shadow:|linear-gradient/);
  assert.match(css, /@media \(max-width: 1120px\)[\s\S]*?\.workspace-sidebar \{[^}]*top: auto;[^}]*height: auto/);
});

test('liquid selection has smooth, non-intercepting reflections behind labels and no layout movement', () => {
  const nav = css.match(/\.workspace-nav a \{([^}]+)\}/)[1];
  assert.match(nav, /isolation: isolate/);
  assert.doesNotMatch(nav, /overflow:|transform:|animation:/);
  const sheen = css.match(/\.workspace-nav a::after \{([^}]+)\}/)[1];
  assert.match(sheen, /pointer-events: none/);
  assert.match(sheen, /z-index: -1/);
  assert.match(sheen, /inset: 0/);
  assert.match(sheen, /border-radius: inherit/);
  assert.match(sheen, /radial-gradient/);
  assert.match(sheen, /linear-gradient/);
  assert.match(sheen, /transition: opacity 180ms ease/);
  const active = css.match(/\.workspace-nav a\.is-active \{([^}]+)\}/)[1];
  assert.match(active, /backdrop-filter: blur\(6px\)/);
  assert.match(active, /box-shadow: inset/);
  assert.doesNotMatch(active, /(?:^|;)\s*(?:padding|min-height|width|height|transform|overflow|font-size):/);
  assert.match(css, /\.workspace-nav a\.is-active::after \{ opacity: 0\.8; \}/);
  assert.match(css, /\.workspace-nav a\.is-active:hover::after,\s*\.workspace-nav a\.is-active:focus-visible::after \{\s*opacity: 1/);
  assert.match(css, /\.workspace-nav a:active::after,\s*\.workspace-nav a\.is-active:active::after \{\s*opacity: 0\.6/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.workspace-nav a::before,\s*\.workspace-nav a::after \{\s*transition: none/);
});

test('floating rail reserves its gutters and fits the icons, brand and controls when collapsed', () => {
  const sidebarRule = css.match(/\.workspace-sidebar \{([^}]+)\}/)[1];
  const collapsed = Number(css.match(/\.workspace-shell\.is-sidebar-collapsed \{\s*--ws-sidebar-width: (\d+)px/)[1]);
  const gutter = Number(css.match(/--ws-sidebar-gutter: (\d+)px/)[1]);
  const sidePadding = Number(sidebarRule.match(/padding: \d+px (\d+)px/)[1]);
  const sidebarBorder = Number(sidebarRule.match(/border: (\d+)px/)[1]);
  const icon = css.match(/\.workspace-nav svg \{([^}]+)\}/)[1];
  const iconWidth = Number(icon.match(/width: (\d+)px/)[1]);
  const navBorder = Number(css.match(/\.workspace-nav a \{[^}]*border: (\d+)px/)[1]);
  const innerWidth = collapsed - 2 * (sidePadding + sidebarBorder);
  assert.equal(collapsed + 2 * gutter, 104);
  assert.ok(iconWidth + 2 * navBorder <= innerWidth);
  assert.ok(36 <= innerWidth, 'official logo fits the rail');
  assert.ok(30 <= innerWidth, 'explicit toggle fits the rail');
  assert.match(css, /\.is-sidebar-collapsed \.workspace-sidebar-heading \{\s*padding: 0 0 16px/);
  assert.match(html, /class="workspace-brand"[^>]*>\s*<img src="assets\/logo\.png"/);
  assert.match(css, /\.workspace-brand strong span \{ color: #fff; \}/);
  assert.match(css, /\.workspace-brand strong \{ color: var\(--accent-2\); \}/);
});

test('active indicator stays inside rounded rows and clear of icons in both sidebar widths', () => {
  const indicator = css.match(/\.workspace-nav a::before \{([^}]+)\}/)[1];
  assert.match(indicator, /pointer-events: none/);
  const left = Number(indicator.match(/left: (\d+)px/)[1]);
  const width = Number(indicator.match(/width: (\d+)px/)[1]);
  const top = Number(indicator.match(/top: (\d+)px/)[1]);
  const bottom = Number(indicator.match(/bottom: (\d+)px/)[1]);
  const nav = css.match(/\.workspace-nav a \{([^}]+)\}/)[1];
  const height = Number(nav.match(/min-height: (\d+)px/)[1]);
  const radius = Number(nav.match(/border-radius: (\d+)px/)[1]);
  const border = Number(nav.match(/border: (\d+)px/)[1]);
  const padding = Number(nav.match(/padding: \d+ (\d+)px/)[1]);
  const iconWidth = Number(css.match(/\.workspace-nav svg \{[^}]*width: (\d+)px/)[1]);
  const sidebarRule = css.match(/\.workspace-sidebar \{([^}]+)\}/)[1];
  const sidePadding = Number(sidebarRule.match(/padding: \d+px (\d+)px/)[1]);
  const sideBorder = Number(sidebarRule.match(/border: (\d+)px/)[1]);
  const widths = [...css.matchAll(/--ws-sidebar-width: (\d+)px/g)].map(match => Number(match[1]));
  assert.equal(widths.length, 2);
  assert.ok(left > 0 && top >= radius / 2 && bottom >= radius / 2);
  assert.ok(top + bottom < height - 2 * border, 'indicator fits vertically');
  for (const sidebarWidth of widths) {
    const innerWidth = sidebarWidth - 2 * (sidePadding + sideBorder);
    const iconLeft = sidebarWidth === 72 ? (innerWidth - iconWidth) / 2 : padding + border;
    assert.ok(left + width + border < iconLeft, `indicator cannot overlap the icon at ${sidebarWidth}px`);
  }
});

test('organization and user identity reuse the authorized initial fallbacks without upload or image fetching', () => {
  assert.match(html, /class="company-identity-mark" aria-hidden="true">\s*<span class="company-avatar" id="tenantAvatar">/);
  assert.match(html, /class="company-profile-heading"/);
  for (const id of ['tenantName', 'tenantAvatar', 'sessionAvatar', 'sessionUserName', 'sessionUserEmail']) {
    assert.equal((html.match(new RegExp(`id="${id}"`, 'g')) || []).length, 1);
  }
  assert.match(source, /\$\("tenantAvatar"\)\.textContent = initials\(displayName\)/);
  assert.match(source, /\$\("sessionAvatar"\)\.textContent = initials\(me\.user\.fullName\)/);
  const organization = html.match(/class="company-profile-card"[\s\S]*?<\/section>/)[0];
  assert.doesNotMatch(organization, /<img|type="file"|upload|logoUrl/i);
  assert.match(css, /\.routex-sr-only,\s*\.is-sidebar-collapsed \.session-copy \{[^}]*clip:/);
  assert.doesNotMatch(css, /:is\([^)]*\.session-copy[^)]*\) \{ display: none/);
  assert.match(css, /\.company-profile-heading :is\(h2, p\),\s*\.company-profile-facts strong \{ overflow-wrap: anywhere/);
});
