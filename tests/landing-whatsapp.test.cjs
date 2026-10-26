const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const script = fs.readFileSync(path.join(__dirname, '..', 'script.js'), 'utf8');
const source = script.slice(script.indexOf('const WHATSAPP_COMMERCIAL_MESSAGE'), script.indexOf('} // end chat block') + '} // end chat block'.length);
const message = 'Olá! Tudo bem? 👋\n\nConheci o ROUTflex e fiquei interessado em saber mais sobre as soluções de roteirização e gestão logística de vocês! 🚀\n\nGostaria de entender como a plataforma pode ajudar a otimizar nossas operações. Podemos conversar?';
const reply = 'Que bom ter você por aqui! 🚀<br><br>Nossa equipe terá prazer em conversar sobre sua operação e mostrar como o ROUTflex pode ajudar no planejamento de rotas e na gestão logística.<br><br>Clique abaixo para iniciar nossa conversa pelo WhatsApp.';

function setup({ widget = true } = {}) {
  const nodes = new Map();
  const timers = [];
  const navigations = [];
  function node(id = '') {
    return {
      id, hidden: true, value: '', dataset: {}, children: [], listeners: {}, attributes: {},
      addEventListener(name, fn) { this.listeners[name] = fn; },
      appendChild(child) { child.parent = this; this.children.push(child); },
      setAttribute(name, value) { this.attributes[name] = value; },
      focus() { this.focused = true; },
      remove() {
        if (this.parent) this.parent.children.splice(this.parent.children.indexOf(this), 1);
      },
      scrollIntoView(options) { navigations.push([id, options]); }
    };
  }
  function get(id) {
    if (!nodes.has(id)) nodes.set(id, node(id));
    return nodes.get(id);
  }
  const footer = node();
  const chips = [...html.matchAll(/<button class="chip"[^>]*data-query="([^"]+)"[^>]*>([^<]+)<\/button>/g)].map((match) => {
    const chip = node();
    chip.dataset.query = match[1];
    chip.textContent = match[2];
    return chip;
  });
  get('chatChips').querySelectorAll = () => chips;
  const document = {
    getElementById: id => {
      if (id === 'typingIndicator') return get('chatMessages').children.find(item => item.id === id) || null;
      return !widget && id.startsWith('chat') ? null : get(id);
    },
    createElement: () => node(),
    querySelectorAll: () => [footer],
    querySelector: selector => get(selector),
    addEventListener: (name, fn) => { get('document').listeners[name] = fn; }
  };
  vm.runInNewContext(source, { document, setTimeout: fn => timers.push(fn) });
  function flush() {
    while (timers.length) timers.shift()();
  }
  return { get, footer, chips, timers, navigations, flush };
}

test('footer: ordem, links existentes, SVG e acessibilidade preservados', () => {
  const social = html.match(/<div class="social-links"[\s\S]*?<\/div>/)[0];
  const anchors = [...social.matchAll(/<a\b([^>]+)>([\s\S]*?)<\/a>/g)];
  assert.equal(anchors.length, 3);
  assert.match(anchors[0][1], /href="https:\/\/www\.instagram\.com\/routflex\/"/);
  assert.match(anchors[1][1], /href="https:\/\/www\.linkedin\.com\/in\/phillips-mijares-a50454176\/"/);
  assert.match(anchors[2][1], /data-whatsapp-commercial/);
  assert.match(anchors[2][1], /aria-label="Falar com ROUTflex pelo WhatsApp"/);
  assert.match(anchors[2][1], /target="_blank" rel="noopener noreferrer"/);
  assert.match(anchors[2][2], /<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">/);
});

test('mensagem oficial: número, encoding, parágrafos, emojis e nenhum dado adicional', () => {
  const { footer } = setup();
  const url = new URL(footer.href);
  assert.equal(url.origin + url.pathname, 'https://wa.me/5565981416177');
  assert.equal(url.searchParams.get('text'), message);
  assert.deepEqual([...url.searchParams.keys()], ['text']);
  assert.equal(footer.href, `https://wa.me/5565981416177?text=${encodeURIComponent(message)}`);
  assert.equal(url.hash, '');
});

test('Routex: ação rápida gera resposta oficial e CTA idêntico, sem navegação automática', () => {
  const p = setup();
  const chip = p.chips.find(item => item.textContent === 'WhatsApp');
  assert.ok(chip);
  chip.listeners.click();
  p.flush();
  const messages = p.get('chatMessages').children.filter(item => item.className === 'msg msg-bot');
  assert.equal(messages.length, 1);
  assert.equal(messages[0].children[0].innerHTML, `${reply}<br><a class="chat-cta-btn" href="${p.footer.href}" target="_blank" rel="noopener noreferrer">Conversar pelo WhatsApp</a>`);
  assert.equal(p.get('chatMessages').children[0].children[0].innerHTML, 'WhatsApp');
  assert.equal(p.get('chatWindow').hidden, true);
  assert.deepEqual(p.navigations, []);
});

test('Routex: texto digitado com WhatsApp também usa o canal oficial', () => {
  const p = setup();
  p.get('chatInput').value = 'Quero falar com a equipe pelo WhatsApp';
  let prevented = false;
  p.get('chatForm').listeners.submit({ preventDefault() { prevented = true; } });
  p.flush();
  assert.equal(prevented, true);
  assert.equal(p.get('chatInput').value, '');
  assert.match(p.get('chatMessages').children.at(-1).children[0].innerHTML, /Conversar pelo WhatsApp/);
  assert.deepEqual(p.navigations, []);
});

test('Routex: histórico persiste ao fechar/reabrir e saudação não se repete', () => {
  const p = setup();
  p.get('chatTrigger').listeners.click();
  p.flush();
  p.chips.find(item => item.textContent === 'WhatsApp').listeners.click();
  p.flush();
  const count = p.get('chatMessages').children.length;
  p.get('chatCloseBtn').listeners.click();
  assert.equal(p.get('chatWindow').hidden, true);
  p.get('chatTrigger').listeners.click();
  assert.equal(p.get('chatWindow').hidden, false);
  assert.equal(p.get('chatMessages').children.length, count);
  assert.equal(p.timers.length, 0);
  p.get('document').listeners.keydown({ key: 'Escape' });
  assert.equal(p.get('chatWindow').hidden, true);
});

test('Routex: fluxos anteriores conservam respostas, CTAs internos e fallback', () => {
  for (const [query, expected] of [
    ['como funciona', 'plataforma SaaS'],
    ['demonstracao', 'Solicitar demonstração →'],
    ['preço', 'Fale com a equipe →'],
    ['funcionalidades', 'Ver funcionalidades ↓'],
    ['contato', 'Ir para o formulário →'],
    ['benefício', 'Ver benefícios ↓'],
    ['xyz', 'Não entendi completamente.']
  ]) {
    const p = setup();
    p.get('chatInput').value = query;
    p.get('chatForm').listeners.submit({ preventDefault() {} });
    p.flush();
    const response = p.get('chatMessages').children.at(-1).children[0].innerHTML;
    assert.ok(response.includes(expected), query);
    assert.ok(!response.includes('target="_blank"'), query);
    assert.ok(!response.includes('wa.me'), query);
  }
});

test('footer funciona independentemente da presença do widget', () => {
  assert.equal(new URL(setup({ widget: false }).footer.href).searchParams.get('text'), message);
});
