'use strict';

// Development serves the source itself. Only reviewed, explicitly public files
// are reachable; never expose the repository with a generic directory server.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { pipeline } = require('node:stream');
const ROOT = path.resolve(__dirname, '..');
const MIME = Object.freeze({
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.md': 'text/plain; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.mp4': 'video/mp4', '.woff2': 'font/woff2'
});

function validPublicPath(name) {
  return typeof name === 'string' && name.length > 0 &&
    !/[\\:%\x00-\x1f\x7f?#]/.test(name) &&
    name.split('/').every(part => part && !part.startsWith('.')) &&
    Object.hasOwn(MIME, path.posix.extname(name));
}

function readManifest() {
  return JSON.parse(fs.readFileSync(path.join(__dirname, 'public-files.json'), 'utf8').replace(/^\uFEFF/, ''));
}

function publicFile(root, name) {
  if (!validPublicPath(name)) throw new Error('Invalid public path');
  let current = path.resolve(root);
  // Reject junctions/symlinks in the root as well as in each public path.
  for (let ancestor = current; ; ancestor = path.dirname(ancestor)) {
    if (fs.lstatSync(ancestor).isSymbolicLink()) throw new Error('Linked root');
    if (path.dirname(ancestor) === ancestor) break;
  }
  for (const segment of name.split('/')) {
    current = path.join(current, segment);
    if (fs.lstatSync(current).isSymbolicLink()) throw new Error('Linked public path');
  }
  const real = fs.realpathSync(current);
  const relative = path.relative(fs.realpathSync(root), real);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Outside public root');
  const stat = fs.statSync(real);
  if (!stat.isFile()) throw new Error('Not a public file');
  return { file: real, size: stat.size };
}

function checkedManifest(root, entries) {
  if (!Array.isArray(entries) || !entries.length || new Set(entries).size !== entries.length) {
    throw new Error('Invalid public manifest');
  }
  for (const name of entries) publicFile(root, name);
  return new Set(entries);
}

function requestPath(raw) {
  if (!raw.startsWith('/') || raw.startsWith('//')) throw new Error('Invalid request target');
  const decoded = decodeURIComponent(raw.split('?')[0]);
  if (decoded === '/') return 'index.html';
  if (decoded === '/control-center/') return 'control-center/index.html';
  const name = decoded.slice(1);
  if (!validPublicPath(name)) throw new Error('Invalid request path');
  return name;
}

function byteRange(value, size) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(value);
  if (!match || (!match[1] && !match[2]) || !size) return null;
  let start, end;
  if (!match[1]) {
    const suffix = Number(match[2]);
    if (!Number.isSafeInteger(suffix) || suffix <= 0) return null;
    start = Math.max(0, size - suffix); end = size - 1;
  } else {
    start = Number(match[1]); end = match[2] ? Number(match[2]) : size - 1;
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start >= size || end < start) return null;
    end = Math.min(end, size - 1);
  }
  return { start, end };
}

function createPublicServer({ root = ROOT, entries = readManifest() } = {}) {
  const allowed = checkedManifest(root, entries);
  return http.createServer((req, res) => {
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    const finish = (status, message) => { res.statusCode = status; res.end(req.method === 'HEAD' ? undefined : message); };
    if (!/^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(req.headers.host || '')) return finish(403, 'Forbidden');
    if (!['GET', 'HEAD'].includes(req.method)) { res.setHeader('Allow', 'GET, HEAD'); return finish(405, 'Method not allowed'); }
    if (req.url.split('?')[0] === '/control-center') {
      res.setHeader('Location', '/control-center/' + (req.url.includes('?') ? '?' + req.url.split('?').slice(1).join('?') : ''));
      return finish(308, '');
    }
    let name, target;
    try { name = requestPath(req.url); if (!allowed.has(name)) return finish(404, 'Not found'); target = publicFile(root, name); }
    catch { return finish(404, 'Not found'); }
    let start = 0, end = target.size - 1;
    res.setHeader('Content-Type', MIME[path.posix.extname(name)]);
    res.setHeader('Accept-Ranges', 'bytes');
    if (req.headers.range) {
      const range = byteRange(req.headers.range, target.size);
      if (!range) { res.setHeader('Content-Range', `bytes */${target.size}`); return finish(416, 'Invalid range'); }
      ({ start, end } = range);
      res.statusCode = 206;
      res.setHeader('Content-Range', `bytes ${start}-${end}/${target.size}`);
    }
    res.setHeader('Content-Length', target.size ? end - start + 1 : 0);
    if (req.method === 'HEAD' || !target.size) return res.end();
    pipeline(fs.createReadStream(target.file, { start, end }), res, () => {});
  });
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const port = args.length ? Number(args[1]) : 5500;
  if ((args.length && (args.length !== 2 || args[0] !== '--port')) || !Number.isInteger(port) || port < 1024 || port > 65535) {
    console.error('Usage: node tools/serve-public.cjs [--port 5500]'); process.exitCode = 1;
  } else {
    try {
      const server = createPublicServer();
      server.on('error', error => { console.error(`Public server failed: ${error.code || 'STARTUP_ERROR'}`); process.exitCode = 1; });
      server.listen(port, '127.0.0.1', () => console.log(`Landing source: ${ROOT}\nURL: http://localhost:${port}/\nPID: ${process.pid}`));
    } catch { console.error('Public manifest validation failed; server not started.'); process.exitCode = 1; }
  }
}

module.exports = { ROOT, readManifest, checkedManifest, publicFile, createPublicServer, byteRange };
