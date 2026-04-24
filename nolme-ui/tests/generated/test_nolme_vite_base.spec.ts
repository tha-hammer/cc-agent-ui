import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const distIndex = path.resolve(here, '..', '..', 'dist', 'index.html');

/**
 * B14 — the Nolme bundle must emit assets under /nolme/assets/*, never /assets/*,
 * or it will collide with the main cc-agent-ui bundle's root namespace and
 * confuse cc-agent-ui/public/sw.js's cache rule.
 *
 * This spec asserts the built index.html references assets at /nolme/assets/*.
 * It assumes `npm run build` has been run at least once; when run in a clean
 * CI the build step happens before `npm test` per package.json scripts.
 */
describe('Nolme Vite workspace — base: "/nolme/" (Phase 3 · B14)', () => {
  const hasBuild = fs.existsSync(distIndex);

  it.skipIf(!hasBuild)('built index.html references /nolme/assets/*.js', () => {
    const html = fs.readFileSync(distIndex, 'utf8');
    expect(html).toMatch(/src="\/nolme\/assets\/[^"']+\.js"/);
  });

  it.skipIf(!hasBuild)('built index.html references /nolme/assets/*.css', () => {
    const html = fs.readFileSync(distIndex, 'utf8');
    expect(html).toMatch(/href="\/nolme\/assets\/[^"']+\.css"/);
  });

  it.skipIf(!hasBuild)('built index.html never emits root-scoped /assets/ (would collide with sw.js cache)', () => {
    const html = fs.readFileSync(distIndex, 'utf8');
    // Match only `"/assets/..."` — the leading slash before assets — not `/nolme/assets/`.
    expect(html).not.toMatch(/["']\/assets\//);
  });

  it('vite.config.ts sets base: "/nolme/"', () => {
    const cfgPath = path.resolve(here, '..', '..', 'vite.config.ts');
    const cfg = fs.readFileSync(cfgPath, 'utf8');
    expect(cfg).toMatch(/base:\s*['"]\/nolme\/['"]/);
  });
});
