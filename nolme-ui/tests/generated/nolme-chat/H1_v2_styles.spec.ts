/**
 * @gwt.id    gwt-nolme-v2-styles
 * @rr.reads  rr.nolme.v2_style_custom_props
 * @rr.writes —
 * @rr.raises —
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('H1 · v2 stylesheet import + --cpk-* overrides', () => {
  it('main.tsx imports @copilotkit/react-core/v2/styles.css', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/main.tsx'), 'utf8');
    expect(src).toMatch(/import\s+['"]@copilotkit\/react-core\/v2\/styles\.css['"]/);
  });

  it('vite.config.ts strips Tailwind v4 @layer directives from the v2 stylesheet', () => {
    const src = readFileSync(resolve(process.cwd(), 'vite.config.ts'), 'utf8');
    expect(src).toMatch(/@copilotkit\/react-core\/dist\/v2\/index\.css/);
    expect(src).toMatch(/strip(?:CopilotKit|-copilotkit)/);
  });

  it('styles/index.css sets --cpk-primary, --cpk-accent, --cpk-font-sans on .nolme-root', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/styles/index.css'), 'utf8');
    expect(src).toMatch(/\.nolme-root\s*\{[^}]*--cpk-primary:\s*#4f3ed6/s);
    expect(src).toMatch(/--cpk-accent:\s*#f9a832/);
    expect(src).toMatch(/--cpk-font-sans:/);
    expect(src).toMatch(/--cpk-background:/);
    expect(src).toMatch(/--cpk-border:/);
  });
});
