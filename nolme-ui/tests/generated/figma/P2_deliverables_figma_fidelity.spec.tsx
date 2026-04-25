import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';

vi.mock('../../../src/components/bindings/useCopilotKitNolmeAgentState', () => ({
  useCopilotKitNolmeAgentState: () => ({
    resources: [
      {
        id: 'doc',
        badge: 'P1' as const,
        title: 'Outline document',
        subtitle: 'last edited: 5/15/2026',
        tone: 'emerald' as const,
        action: 'download' as const,
      },
      {
        id: 'sheet',
        badge: 'P1' as const,
        title: 'Audience spreadsheet',
        subtitle: 'last edited: 5/16/2026',
        tone: 'gold' as const,
        action: 'download' as const,
      },
      {
        id: 'db',
        badge: 'P2' as const,
        title: 'Venue database',
        subtitle: 'last edited: 5/16/2026',
        tone: 'gold' as const,
        action: 'download' as const,
      },
    ],
  }),
}));

import { DeliverablesRailV2 } from '../../../src/components/DeliverablesRail.v2';
import { DeliverablesRailBoundV2 } from '../../../src/components/bindings/DeliverablesRailBound.v2';

const items = [
  {
    id: 'doc',
    phase: 'P1' as const,
    title: 'Outline document',
    subtitle: 'last edited: 5/15/2026',
    action: 'download' as const,
  },
  {
    id: 'sheet',
    phase: 'P1' as const,
    title: 'Audience spreadsheet',
    subtitle: 'last edited: 5/16/2026',
    action: 'download' as const,
  },
  {
    id: 'db',
    phase: 'P1' as const,
    title: 'Venue database',
    subtitle: 'last edited: 5/16/2026',
    action: 'download' as const,
  },
];

describe('P2 · deliverables figma fidelity', () => {
  it('renders the Figma hierarchy with a header, one phase section, divider, and stacked rows', () => {
    const { getByRole, getByTestId, getByText, queryAllByTestId } = render(<DeliverablesRailV2 items={items} />);

    const section = getByTestId('deliverables-rail-v2');
    const phaseSection = getByTestId('deliverables-phase-P1');
    const divider = getByTestId('deliverables-divider-P1');

    expect(getByRole('heading', { name: 'Deliverables' })).toBeInTheDocument();
    expect(getByTestId('deliverables-header-icon')).toBeInTheDocument();
    expect(getByText('Phase 1 - Artifacts')).toBeInTheDocument();
    expect(phaseSection).toContainElement(divider);
    expect(queryAllByTestId(/^deliverable-row-/)).toHaveLength(3);
    expect(section).toHaveTextContent('Outline document');
    expect(section).toHaveTextContent('Audience spreadsheet');
    expect(section).toHaveTextContent('Venue database');
  });

  it('uses the Figma section sizing and token classes instead of the old bordered card and P-badges', () => {
    const { getByRole, getByTestId, queryByTestId, queryByLabelText } = render(<DeliverablesRailV2 items={items} />);

    const section = getByTestId('deliverables-rail-v2');
    const header = getByTestId('deliverables-header');
    const phaseLabel = getByTestId('deliverables-phase-label-P1');
    const firstRow = getByTestId('deliverable-row-doc');
    const firstTitle = getByTestId('deliverable-title-doc');
    const firstSubtitle = getByTestId('deliverable-subtitle-doc');
    const firstIcon = getByTestId('deliverable-icon-doc');

    expect(section.className).toMatch(/mx-\[-24px\]/);
    expect(section.className).toMatch(/w-\[calc\(100%\+48px\)\]/);
    expect(section.className).toMatch(/flex-1/);
    expect(section.className).toMatch(/bg-white/);
    expect(section.className).toMatch(/px-\[24px\]/);
    expect(section.className).toMatch(/py-\[24px\]/);
    expect(section.className).toMatch(/gap-\[16px\]/);
    expect(section.className).not.toMatch(/rounded-\[16px\]/);
    expect(section.className).not.toMatch(/\bborder\b/);

    expect(header.className).toMatch(/gap-\[8px\]/);
    expect(getByRole('heading', { name: 'Deliverables' }).className).toMatch(/text-\[22px\]/);
    expect(getByRole('heading', { name: 'Deliverables' }).className).toMatch(/tracking-\[-0\.5px\]/);
    expect(getByRole('heading', { name: 'Deliverables' }).className).toMatch(/text-nolme-neutral-600/);

    expect(phaseLabel.className).toMatch(/text-\[12px\]/);
    expect(phaseLabel.className).toMatch(/tracking-\[0\.5px\]/);
    expect(phaseLabel.className).toMatch(/text-nolme-neutral-900/);

    expect(firstRow.className).toMatch(/gap-\[10px\]/);
    expect(firstIcon.className).toMatch(/h-\[32px\]/);
    expect(firstIcon.className).toMatch(/w-\[32px\]/);
    expect(firstTitle.className).toMatch(/text-\[16px\]/);
    expect(firstTitle.className).toMatch(/tracking-\[1px\]/);
    expect(firstSubtitle.className).toMatch(/text-\[11px\]/);
    expect(firstSubtitle.className).toMatch(/tracking-\[0\.25px\]/);
    expect(firstSubtitle.className).toMatch(/text-nolme-neutral-500/);

    expect(queryByTestId('phase-badge-doc')).not.toBeInTheDocument();
    expect(queryByLabelText(/download/i)).not.toBeInTheDocument();
    expect(queryByLabelText(/link/i)).not.toBeInTheDocument();
  });

  it('groups bound resources by phase badge into separate artifact sections', () => {
    const { getByText, getByTestId } = render(<DeliverablesRailBoundV2 />);

    expect(getByText('Phase 1 - Artifacts')).toBeInTheDocument();
    expect(getByText('Phase 2 - Artifacts')).toBeInTheDocument();
    expect(getByTestId('deliverables-phase-P1')).toHaveTextContent('Outline document');
    expect(getByTestId('deliverables-phase-P1')).toHaveTextContent('Audience spreadsheet');
    expect(getByTestId('deliverables-phase-P2')).toHaveTextContent('Venue database');
  });
});
