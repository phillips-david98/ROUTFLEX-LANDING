'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const { createPublicServer, ROOT, readManifest, checkedManifest } = require('../tools/serve-public.cjs');
const { exportPublic } = require('../tools/export-public.cjs');

async function fixture(t) {
  const base = path.join(ROOT, '.tmp'); fs.mkdirSync(base, { recursive: true });
  const scratch = fs.mkdtempSync(path.join(base, 'public-server-test-'));
  const root = path.join(scratch, 'source'); fs.mkdirSync(root);
  const files = { 'index.html': '<h1>Fixture A</h1>', 'workspace.html': 'Workspace',
    'control-center/index.html': 'Control Center', 'assets/ação.png': 'public image',
    'assets/demo.mp4': 'abcdefghij', 'script.js': 'public script' };
  for (const [name, bytes] of Object.entries(files)) {
    const file = path.join(root, name); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, bytes);
  }
  fs.mkdirSync(path.join(root, '.git')); fs.writeFileSync(path.join(root, '.git', 'config'), 'PRIVATE_FIXTURE');
  fs.writeFileSync(path.join(root, 'unlisted.js'), 'PRIVATE_FIXTURE');
  const server = createPublicServer({ root, entries: Object.keys(files) });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    assert.equal(path.dirname(scratch), base);
    fs.rmSync(scratch, { recursive: true, force: true });
  });
  const request = (url, { method = 'GET', headers = {} } = {}) => new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port: server.address().port, path: url, method, headers }, res => {
      const chunks = []; res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString() }));
    }); req.on('error', reject); req.end();
  });
  return { root, scratch, files, request };
}

test('production manifest is complete, explicit and excludes internal material', () => {
  const entries = readManifest(); assert.equal(checkedManifest(ROOT, entries).size, 65);
  assert.ok(!entries.includes('auth-recovery-demo.js'));
  assert.ok(entries.includes('assets/billing/mercado-pago.svg'));
  assert.ok(entries.includes('assets/billing/paypal.png'));
  assert.ok(entries.includes('workspace-billing.js'));
  assert.ok(entries.includes('auth-config.js'));
  assert.ok(entries.includes('assets/video-hero.mp4'));
  assert.ok(!entries.includes('assets/planning-presentation.mp4'));
  for (const name of ['core-fixtures.js', 'control-center/demo.html', 'control-center/mock-data.js', 'control-center/control-center.js']) assert.ok(!entries.includes(name));
  for (const entry of entries) assert.doesNotMatch(entry, /(^|\/)(\.git|\.tmp|tests|tools|README\.md|\.env)(\/|$)/);
});

test('Landing, Workspace and Control Center keep their paths and UTF-8 assets', async t => {
  const f = await fixture(t);
  for (const [url, body] of [['/', f.files['index.html']], ['/workspace.html', 'Workspace'],
    ['/control-center/', 'Control Center'], ['/control-center/index.html', 'Control Center'],
    ['/assets/a%C3%A7%C3%A3o.png', 'public image'], ['/script.js?v=2', 'public script']]) {
    const result = await f.request(url); assert.equal(result.status, 200); assert.equal(result.body, body);
    assert.match(result.headers['cache-control'], /no-store/); assert.equal(result.headers['x-content-type-options'], 'nosniff');
  }
  const redirect = await f.request('/control-center?view=tenants');
  assert.equal(redirect.status, 308); assert.equal(redirect.headers.location, '/control-center/?view=tenants');
});

test('editing the official file is reflected without copying, restart or stale conditional response', async t => {
  const f = await fixture(t); assert.match((await f.request('/')).body, /Fixture A/);
  fs.writeFileSync(path.join(f.root, 'index.html'), '<h1>Fixture B</h1>');
  const current = await f.request('/', { headers: { 'If-None-Match': 'old-copy', 'If-Modified-Since': new Date().toUTCString() } });
  assert.equal(current.status, 200); assert.equal(current.body, '<h1>Fixture B</h1>');
});

test('private files, traversal, directory listing and ambiguous Windows paths fail closed', async t => {
  const f = await fixture(t);
  for (const url of ['/.git/config', '/%2egit/config', '/.env', '/.tmp/', '/tests/public-serving.test.cjs',
    '/tools/public-files.json', '/unlisted.js', '/assets/', '/missing.html', '/../index.html', '/%2e%2e/index.html',
    '/assets/../index.html', '/assets%5c..%5cindex.html', '/index.html:private', '/index.html%00',
    '/%252e%252e/index.html', '//index.html', '/index.html#fragment', '/%zz', '/Index.html']) {
    const result = await f.request(url); assert.equal(result.status, 404, url); assert.doesNotMatch(result.body, /PRIVATE_FIXTURE/);
  }
});

test('other methods and untrusted Host headers are rejected', async t => {
  const f = await fixture(t);
  for (const method of ['POST', 'PUT', 'DELETE', 'OPTIONS']) assert.equal((await f.request('/', { method })).status, 405);
  assert.equal((await f.request('/', { headers: { Host: 'attacker.example' } })).status, 403);
});

test('HEAD and video ranges preserve media navigation without loading whole files', async t => {
  const f = await fixture(t);
  const head = await f.request('/assets/demo.mp4', { method: 'HEAD' });
  assert.equal(head.status, 200); assert.equal(head.body, ''); assert.equal(head.headers['content-length'], '10');
  assert.equal(head.headers['content-type'], 'video/mp4');
  for (const [range, body, contentRange] of [['bytes=2-5', 'cdef', 'bytes 2-5/10'],
    ['bytes=7-', 'hij', 'bytes 7-9/10'], ['bytes=-3', 'hij', 'bytes 7-9/10'], ['bytes=8-99', 'ij', 'bytes 8-9/10']]) {
    const res = await f.request('/assets/demo.mp4', { headers: { Range: range } });
    assert.equal(res.status, 206); assert.equal(res.body, body); assert.equal(res.headers['content-range'], contentRange);
  }
  for (const range of ['bytes=10-', 'bytes=5-2', 'bytes=-0', 'bytes=0-1,4-5', 'bytes=99999999999999999999-', 'invalid']) {
    const res = await f.request('/assets/demo.mp4', { headers: { Range: range } }); assert.equal(res.status, 416);
  }
  const partialHead = await f.request('/assets/demo.mp4', { method: 'HEAD', headers: { Range: 'bytes=1-2' } });
  assert.equal(partialHead.status, 206); assert.equal(partialHead.body, ''); assert.equal(partialHead.headers['content-length'], '2');
});

test('invalid, duplicate and missing manifest entries prevent startup', async t => {
  const f = await fixture(t);
  for (const entries of [[], ['index.html', 'index.html'], ['missing.html'], ['../index.html'], ['.env'], ['index.html:secret']]) {
    assert.throws(() => createPublicServer({ root: f.root, entries }));
  }
});

test('junctions cannot expose files outside the public source, including after startup', async t => {
  const f = await fixture(t);
  const outside = path.join(f.scratch, 'outside'); fs.mkdirSync(outside); fs.writeFileSync(path.join(outside, 'private.js'), 'PRIVATE_FIXTURE');
  fs.symlinkSync(outside, path.join(f.root, 'linked'), 'junction');
  assert.throws(() => createPublicServer({ root: f.root, entries: ['linked/private.js'] }));
  fs.renameSync(path.join(f.root, 'assets'), path.join(f.root, 'original-assets'));
  fs.symlinkSync(outside, path.join(f.root, 'assets'), 'junction');
  assert.equal((await f.request('/assets/demo.mp4')).status, 404);
});

test('deleted public files return a generic error and the server stays available', async t => {
  const f = await fixture(t); fs.unlinkSync(path.join(f.root, 'script.js'));
  const res = await f.request('/script.js'); assert.equal(res.status, 404); assert.equal(res.body, 'Not found');
  assert.equal((await f.request('/')).status, 200);
});

test('release exports only approved bytes, records hashes and refuses overwriting or source output', async t => {
  const f = await fixture(t); const destination = path.join(f.scratch, 'release');
  const hashes = exportPublic(destination, { root: f.root, entries: Object.keys(f.files) });
  for (const [name, content] of Object.entries(f.files)) {
    assert.equal(fs.readFileSync(path.join(destination, name), 'utf8'), content);
    assert.equal(hashes[name], crypto.createHash('sha256').update(content).digest('hex'));
  }
  assert.equal(fs.existsSync(path.join(destination, 'unlisted.js')), false);
  assert.equal(fs.existsSync(path.join(destination, '.git')), false);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(destination, 'release-manifest.json'))).files, hashes);
  for (const output of [destination, path.join(f.root, 'release'), 'relative-output']) {
    assert.throws(() => exportPublic(output, { root: f.root, entries: Object.keys(f.files) }));
  }
});
