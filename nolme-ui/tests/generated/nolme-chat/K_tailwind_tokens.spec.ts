/**
 * @gwt.id    gwt-nolme-design-token
 * @rr.reads  rr.nolme.design_token
 * @rr.writes rr.nolme.design_token
 * @rr.raises —
 */
import { describe, it, expect } from 'vitest';
import tailwindConfig from '../../../tailwind.config.js';

describe('K · Tailwind color tokens', () => {
  it('K1 · nolme-border-input resolves to #c8c8d6', () => {
    const colors = (tailwindConfig as any).theme.extend.colors;
    expect(colors['nolme-border-input']).toBe('#c8c8d6');
  });

  it('K2 · nolme-purple 550 resolves to #6550f0', () => {
    const colors = (tailwindConfig as any).theme.extend.colors;
    expect(colors['nolme-purple']['550']).toBe('#6550f0');
  });
});
