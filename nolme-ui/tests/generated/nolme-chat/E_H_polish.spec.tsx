/**
 * @gwt.id    gwt-nolme-thinking-pill, gwt-nolme-polish
 * @rr.reads  rr.nolme.design_token
 * @rr.writes —
 * @rr.raises —
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { ThinkingPillV2 } from '../../../src/components/ThinkingPill.v2';
import { OutputCardV2 } from '../../../src/components/OutputCard.v2';
import { QuickActionChipRowV2 } from '../../../src/components/QuickActionChipRow.v2';

describe('E2 · ThinkingPill.v2 typography', () => {
  it('label is Satoshi Medium 16/26 and outer is rounded-[100px] bg-amber-400 content-sized', () => {
    const { getByTestId } = render(<ThinkingPillV2 label="Browsing..." />);
    const label = getByTestId('thinking-pill-v2-label');
    expect(label.className).toMatch(/font-\[Satoshi:Medium\]/);
    expect(label.className).toMatch(/text-\[16px\]/);
    expect(label.className).toMatch(/leading-\[26px\]/);
    const pill = getByTestId('thinking-pill-v2');
    expect(pill.className).toMatch(/rounded-\[100px\]/);
    expect(pill.className).toMatch(/bg-nolme-amber-400/);
    expect(pill.className).toMatch(/px-\[16px\]/);
    expect(pill.className).toMatch(/py-\[8px\]/);
    expect(pill.className).toMatch(/w-fit/);
    expect(pill.className).not.toMatch(/h-\[42px\]/);
  });
});

describe('H2 · OutputCard.v2 flat variant', () => {
  it('is bg-white rounded-[8px] p-[10px] with no border or shadow', () => {
    const { getByTestId } = render(
      <OutputCardV2 title="Common Space" subtitle="Co-working venue" rating={4.9} />,
    );
    const card = getByTestId('output-card-v2');
    expect(card.className).toMatch(/bg-white/);
    expect(card.className).toMatch(/rounded-\[8px\]/);
    expect(card.className).toMatch(/p-\[10px\]/);
    expect(card.className).not.toMatch(/\bborder\b/);
    expect(card.className).not.toMatch(/shadow-/);
  });
});

describe('H3 · QuickActionChipRow.v2 solid chips + amber variant', () => {
  it('renders 3 primary chips (purple, 14/18) and 1 amber chip (amber, 12/16)', () => {
    const { container } = render(
      <QuickActionChipRowV2
        actions={[
          { label: 'Confirm Phase 3 👍', tone: 'primary' },
          { label: 'Make changes', tone: 'primary' },
          { label: 'Look for issues', tone: 'primary' },
          { label: 'Ask question while working', tone: 'amber' },
        ]}
      />,
    );
    const primaries = container.querySelectorAll('[data-tone="primary"]');
    const ambers = container.querySelectorAll('[data-tone="amber"]');
    expect(primaries.length).toBe(3);
    expect(ambers.length).toBe(1);

    primaries.forEach((p) => {
      expect(p.className).toMatch(/bg-nolme-purple-200/);
      expect(p.className).toMatch(/text-nolme-purple-500/);
      expect(p.className).toMatch(/text-\[14px\]/);
      expect(p.className).toMatch(/rounded-\[999px\]/);
    });
    ambers.forEach((a) => {
      expect(a.className).toMatch(/bg-nolme-amber-200/);
      expect(a.className).toMatch(/text-nolme-amber-500/);
      expect(a.className).toMatch(/text-\[12px\]/);
      expect(a.className).toMatch(/rounded-\[999px\]/);
    });
  });
});

describe('E1 + H4 · useNolmeRegistrations.v2 imports from @copilotkit/react-core/v2', () => {
  it('imports useRenderTool and useHumanInTheLoop from /v2 subpath', () => {
    const src = readFileSync(
      resolve(process.cwd(), 'src/components/bindings/useNolmeRegistrations.v2.tsx'),
      'utf8',
    );
    expect(src).toMatch(/from\s+['"]@copilotkit\/react-core\/v2['"]/);
    expect(src).toMatch(/useRenderTool/);
    expect(src).toMatch(/useHumanInTheLoop/);
  });
});
