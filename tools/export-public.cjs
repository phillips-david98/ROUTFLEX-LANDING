'use strict';

// Explicit release artifact, never a second development source. No deployment.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { ROOT, readManifest, checkedManifest, publicFile } = require('./serve-public.cjs');

function exportPublic(destination, { root = ROOT, entries = readManifest() } = {}) {
  if (!destination || !path.isAbsolute(destination)) throw new Error('Use a new absolute output directory');
  const output = path.resolve(destination);
  const parent = fs.realpathSync(path.dirname(output));
  const relative = path.relative(fs.realpathSync(root), path.join(parent, path.basename(output)));
  if (!relative || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative))) {
    throw new Error('Output must be outside the source directory');
  }
  checkedManifest(root, entries);
  fs.mkdirSync(output); // Fails if it exists; no overwrite or cleanup of earlier artifacts.
  const hashes = {};
  for (const name of entries) {
    const { file } = publicFile(root, name);
    const bytes = fs.readFileSync(file);
    const dest = path.join(output, name);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, bytes, { flag: 'wx' });
    hashes[name] = crypto.createHash('sha256').update(bytes).digest('hex');
  }
  fs.writeFileSync(path.join(output, 'release-manifest.json'), JSON.stringify({ source: 'ROUTflex-landing', files: hashes }, null, 2) + '\n', { flag: 'wx' });
  return hashes;
}

if (require.main === module) {
  try {
    if (process.argv.length !== 3) throw new Error('Use: node tools/export-public.cjs <new-absolute-output-directory>');
    const hashes = exportPublic(process.argv[2]);
    console.log(`Public release prepared: ${Object.keys(hashes).length} files. Verify release-manifest.json before publishing.`);
  } catch { console.error('Export failed. No existing artifact was overwritten. Incomplete new output must not be published.'); process.exitCode = 1; }
}
module.exports = { exportPublic };
