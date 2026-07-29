/**
 * scripts/build.js
 *
 * Build pipeline for public/widget.js:
 *   1. Read src:  public/widget.js
 *   2. Minify:    strip comments + collapse whitespace (no extra deps — uses
 *                 Node built-ins only so the project stays zero-devDep for build).
 *   3. Hash:      SHA-256 first 8 hex chars of the minified content (content
 *                 addressing — safe for long-lived CDN cache).
 *   4. Write:     public/widget.<hash>.min.js
 *   5. Manifest:  public/widget.manifest.json  { "widget.js": "widget.<hash>.min.js" }
 *
 * Usage:
 *   node scripts/build.js          # build once
 *   npm run build                  # same via package.json script
 *
 * Output example:
 *   ✔ public/widget.js → public/widget.a1b2c3d4.min.js  (1.82 KB)
 *   ✔ Manifest written to public/widget.manifest.json
 */

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = join(__dirname, '..');
const PUBLIC    = join(ROOT, 'public');

// ─── Minifier ──────────────────────────────────────────────────────────────────
//
// Regex-based; handles the common cases in widget.js without an AST parser:
//   • Strip block comments  /* ... */ (not inside strings — heuristic is fine
//     for our controlled source file)
//   • Strip line comments   // ... (same caveat)
//   • Collapse runs of whitespace / newlines to a single space
//   • Trim leading / trailing whitespace
//
// This is intentionally simple. For production-grade minification, swap this
// for `esbuild` (add as a devDependency) or `terser`.
//

/**
 * Lightweight regex-based JS minifier.
 * @param {string} source Raw JS source
 * @returns {string} Minified output
 */
function minify(source) {
  return source
    // 1. Remove block comments (non-greedy)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    // 2. Remove single-line comments
    //    Exclude protocol URLs like https:// by requiring the // to follow
    //    whitespace, a semicolon, or start-of-line.
    .replace(/(^|[^:])\/\/[^\n]*/gm, '$1')
    // 3. Collapse newlines and consecutive whitespace to a single space
    .replace(/\s+/g, ' ')
    // 4. Tighten up around operators / punctuation where safe to do so
    .replace(/\s*([\{\}\(\)\[\]=,;:!+\-*/<>&|?])\s*/g, '$1')
    .trim();
}

// ─── Main ──────────────────────────────────────────────────────────────────────

function build() {
  const srcPath = join(PUBLIC, 'widget.js');

  let source;
  try {
    source = readFileSync(srcPath, 'utf8');
  } catch {
    console.error(`✗ Could not read ${srcPath}`);
    console.error('  Make sure public/widget.js exists before running build.');
    process.exit(1);
  }

  // Minify
  const minified = minify(source);

  // Content hash (first 8 hex chars of SHA-256)
  const hash = createHash('sha256').update(minified).digest('hex').slice(0, 8);

  // Output filename
  const outName = `widget.${hash}.min.js`;
  const outPath = join(PUBLIC, outName);

  // Write minified file
  writeFileSync(outPath, minified, 'utf8');

  // Write manifest
  const manifest = { 'widget.js': outName };
  const manifestPath = join(PUBLIC, 'widget.manifest.json');
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');

  // Stats
  const srcKB  = (Buffer.byteLength(source,   'utf8') / 1024).toFixed(2);
  const outKB  = (Buffer.byteLength(minified, 'utf8') / 1024).toFixed(2);
  const saving = (((source.length - minified.length) / source.length) * 100).toFixed(1);

  console.log(`✔  public/widget.js → public/${outName}`);
  console.log(`   ${srcKB} KB → ${outKB} KB  (${saving}% smaller)`);
  console.log(`   Hash: ${hash}`);
  console.log(`✔  Manifest written to public/widget.manifest.json`);
}

build();
