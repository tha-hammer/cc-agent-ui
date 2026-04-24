import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const pkgPath = path.resolve(here, '..', '..', 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

function isExact(v: unknown): boolean {
  return typeof v === 'string' && /^\d+\.\d+\.\d+$/.test(v);
}

describe('CopilotKit version pin (Phase 1 · B12)', () => {
  it('pins @copilotkit/runtime to an exact version (no ^, no ~)', () => {
    const v = pkg.dependencies?.['@copilotkit/runtime'];
    expect(v).toBeDefined();
    expect(isExact(v)).toBe(true);
  });

  it('pins @ag-ui/client to an exact version', () => {
    const v = pkg.dependencies?.['@ag-ui/client'];
    expect(v).toBeDefined();
    expect(isExact(v)).toBe(true);
  });

  it('lockfile exists alongside package.json', () => {
    const lockPath = path.resolve(here, '..', '..', 'package-lock.json');
    expect(fs.existsSync(lockPath)).toBe(true);
  });
});
