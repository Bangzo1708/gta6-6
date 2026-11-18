// Solmar Bay / Neon Harbor / Palma Verde — a make.fun gta6-01 entry (Node 22,
// standard library only). The game is this directory's game/ folder: plain
// static files a desktop browser loads offline (game/index.html and its ES
// modules, no library, no network request). This program hands the entry in:
// it validates the tree, copies game/ and screenshots/ from beside this file
// to /output, and writes /output/dossier.json with the vendored make.fun
// library (vendor/makefun-game.ts, the kit's copy, unchanged). The copy is
// byte-for-byte deterministic: the same repository always writes the same
// /output, so the grader's two runs agree.
//
// Run it locally with:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Serve game/ locally with any static server, e.g. `python3 -m http.server`
// from inside game/, then open http://localhost:8000.

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const gameDir = join(here, 'game');
const shotsDir = join(here, 'screenshots');

// The gate's own caps (reference/gate.json): refuse here what the scorer
// would refuse there, so a bad tree fails loudly on the builder's machine.
const CAPS = {
  textMaxBytes: 163840,
  screenshotsMax: 4,
  screenshotMaxBytes: 262144,
  gameMaxFiles: 993,
  gameMaxBytes: 50331648,
  gamePathMaxBytes: 1000,
};

function fail(message) {
  throw new Error('main.ts: ' + message);
}

// Minimal image header reader: PNG IHDR (bytes 16-24) or the first JPEG
// start-of-frame marker. Returns null when the header cannot be read, so a
// corrupt file still fails later at the scorer instead of here.
function imageDimensions(buf, name) {
  if (buf.length >= 24 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  }
  if (buf.length >= 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let off = 2;
    while (off + 9 < buf.length) {
      if (buf[off] !== 0xff) break;
      const marker = buf[off + 1];
      const len = buf.readUInt16BE(off + 2);
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { h: buf.readUInt16BE(off + 5), w: buf.readUInt16BE(off + 7) };
      }
      off += 2 + len;
    }
    fail('screenshots/' + name + ' has no JPEG frame header');
  }
  return null;
}

function countEntries(dir) {
  let n = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    n += 1;
    if (entry.isDirectory()) n += countEntries(join(dir, entry.name));
    else if (!entry.isFile()) fail('game/ holds a non-file entry: ' + entry.name);
  }
  return n;
}

function totalBytes(dir) {
  let bytes = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) bytes += totalBytes(p);
    else bytes += statSync(p).size;
  }
  return bytes;
}

// ---- validate the tree before anything is written --------------------------
if (!existsSync(join(gameDir, 'index.html'))) fail('game/index.html is missing');
if (!existsSync(shotsDir)) fail('screenshots/ is missing');
const shotNames = readdirSync(shotsDir)
  .filter((n) => !n.startsWith('.'))
  .sort();
if (shotNames.length < 3 || shotNames.length > CAPS.screenshotsMax) {
  fail('screenshots/ must hold 3 or 4 images, found ' + shotNames.length);
}
for (const name of shotNames) {
  const st = statSync(join(shotsDir, name));
  if (!st.isFile()) fail('screenshots/' + name + ' is not a file');
  if (st.size > CAPS.screenshotMaxBytes) {
    fail('screenshots/' + name + ' is ' + st.size + ' bytes, over the 256 KiB cap');
  }
  if (!/\.(png|jpe?g)$/i.test(name)) fail('screenshots/' + name + ' is not a PNG or JPEG');
  // Gate caps: long side at most 1280, short side at least 480. Read the
  // dimensions from the image headers (PNG IHDR, JPEG SOF) — no decoder needed.
  const buf = readFileSync(join(shotsDir, name));
  const dims = imageDimensions(buf, name);
  if (dims) {
    const long = Math.max(dims.w, dims.h);
    const short = Math.min(dims.w, dims.h);
    if (long > 1280) fail('screenshots/' + name + ' is ' + dims.w + 'x' + dims.h + ', long side over 1280');
    if (short < 480) fail('screenshots/' + name + ' is ' + dims.w + 'x' + dims.h + ', short side under 480');
  }
}
if (countEntries(gameDir) > CAPS.gameMaxFiles) fail('game/ holds more than 993 entries');
if (totalBytes(gameDir) > CAPS.gameMaxBytes) fail('game/ is over the 48 MiB cap');

// ---- copy game/ + screenshots/ ----------------------------------------------
mkdirSync(out, { recursive: true });
cpSync(gameDir, join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
cpSync(shotsDir, join(out, 'screenshots'), { recursive: true });

// ---- write the dossier the judge reads ---------------------------------------
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: CAPS.textMaxBytes,
    screenshots: { max: CAPS.screenshotsMax, max_bytes: CAPS.screenshotMaxBytes },
    game_max_files: CAPS.gameMaxFiles,
    game_max_bytes: CAPS.gameMaxBytes,
    game_path_max_bytes: CAPS.gamePathMaxBytes,
  }),
);

console.log(
  'entry written to ' + out + ': ' + countEntries(join(out, 'game')) + ' game files, ' +
  shotNames.length + ' screenshots (' + shotNames.join(', ') + '), dossier.json',
);
