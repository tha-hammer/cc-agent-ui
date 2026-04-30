import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

describe('Nolme app composer input contrast CSS', () => {
  it('overrides global dark-mode textarea text and placeholder colors', () => {
    const css = readFileSync(path.join(ROOT, 'src/index.css'), 'utf8');

    expect(css).toContain('@layer base');
    expect(css).toContain('.dark .nolme-app .nolme-app__input-field textarea');
    expect(css).toContain('-webkit-text-fill-color: var(--nolme-text-primary) !important');
    expect(css).toContain('caret-color: var(--nolme-text-primary) !important');
    expect(css).toContain('.dark .nolme-app .nolme-app__input-field textarea::placeholder');
    expect(css).toContain('-webkit-text-fill-color: var(--nolme-text-tertiary) !important');
  });
});
