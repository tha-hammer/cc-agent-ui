import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';

vi.mock('../../../src/components/bindings/useCopilotKitNolmeAgentState', () => ({
  useCopilotKitNolmeAgentState: () => ({
    phases: [
      { id: 'p1', label: 'P1', title: 'Audience & venue', status: 'idle' as const },
      { id: 'p2', label: 'P2', title: 'Promotion plan', status: 'idle' as const },
      { id: 'p3', label: 'P3', title: 'Budget review', status: 'active' as const },
      { id: 'p4', label: 'P4', title: 'Launch checklist', status: 'idle' as const },
    ],
    currentPhaseIndex: 2,
    currentReviewLine: 'Validate budget assumptions before launch.',
  }),
}));

import { WorkflowPhaseBarV2 } from '../../../src/components/WorkflowPhaseBar.v2';
import { WorkflowPhaseBarBoundV2 } from '../../../src/components/bindings/WorkflowPhaseBarBound.v2';

const phases = [
  { id: 'p1', label: 'P1', title: 'Audience & venue', status: 'idle' as const },
  { id: 'p2', label: 'P2', title: 'Promotion plan', status: 'idle' as const },
  { id: 'p3', label: 'P3', title: 'Budget review', status: 'active' as const },
  { id: 'p4', label: 'P4', title: 'Launch checklist', status: 'complete' as const },
];

describe('P0 · phases figma fidelity', () => {
  it('renders the Figma hierarchy with a chip strip and one focused detail card', () => {
    const { getByRole, getByTestId, getByText, queryAllByTestId } = render(
      <WorkflowPhaseBarV2
        phases={phases}
        currentPhaseIndex={0}
        currentReviewLine="Create a venue list that fits the criteria of the audience and venue."
        onEdit={vi.fn()}
      />,
    );

    const section = getByTestId('workflow-phase-bar-v2');
    const strip = getByTestId('workflow-phase-tabs-v2');
    const detailCard = getByTestId('workflow-phase-detail-v2');

    expect(getByRole('heading', { name: 'Phases' })).toBeInTheDocument();
    expect(getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    expect(strip.className).toMatch(/w-\[312px\]/);
    expect(strip.className).toMatch(/gap-\[8px\]/);
    expect(queryAllByTestId(/^workflow-phase-tab-/)).toHaveLength(4);
    expect(getByText('P1: Audience & venue')).toBeInTheDocument();
    expect(detailCard).toHaveTextContent('Audience & venue');
    expect(detailCard).toHaveTextContent('Task 1 of 4');
    expect(detailCard).toHaveTextContent('Create a venue list that fits the criteria of the audience and venue.');
    expect(detailCard).toHaveTextContent('View tasks');
    expect(section.className).toMatch(/border-b/);
    expect(section.className).toMatch(/border-nolme-border-input/);
  });

  it('applies the Figma-selected tab, detail card, and waiting badge tokens', () => {
    const { getByTestId } = render(
      <WorkflowPhaseBarV2
        phases={phases}
        currentPhaseIndex={0}
        currentReviewLine="Create a venue list that fits the criteria of the audience and venue."
      />,
    );

    const selectedTab = getByTestId('workflow-phase-tab-p1');
    const detailCard = getByTestId('workflow-phase-detail-v2');
    const waitingBadge = getByTestId('workflow-phase-status-v2');

    expect(selectedTab.getAttribute('aria-current')).toBe('step');
    expect(selectedTab.className).toMatch(/bg-nolme-purple-200/);
    expect(selectedTab.className).toMatch(/text-nolme-purple-900/);
    expect(selectedTab.className).toMatch(/rounded-\[999px\]/);

    expect(detailCard.className).toMatch(/w-\[312px\]/);
    expect(detailCard.className).toMatch(/min-h-\[116px\]/);
    expect(detailCard.className).toMatch(/bg-nolme-purple-100/);
    expect(detailCard.className).toMatch(/border-\[1\.5px\]/);
    expect(detailCard.className).toMatch(/border-nolme-purple-400/);
    expect(detailCard.className).toMatch(/rounded-\[8px\]/);
    expect(detailCard.className).toMatch(/p-\[16px\]/);

    expect(waitingBadge).toHaveTextContent('Waiting');
    expect(waitingBadge.className).toMatch(/bg-nolme-yellow-50/);
    expect(waitingBadge.className).toMatch(/text-nolme-yellow-600/);
    expect(waitingBadge.className).toMatch(/rounded-\[4px\]/);
  });

  it('uses currentPhaseIndex from bound state to decide which detail card is focused', () => {
    const { getByRole, getByTestId } = render(<WorkflowPhaseBarBoundV2 />);
    const detailCard = getByTestId('workflow-phase-detail-v2');

    expect(getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    expect(detailCard).toHaveTextContent('Budget review');
    expect(detailCard).toHaveTextContent('Task 3 of 4');
    expect(detailCard).toHaveTextContent('Validate budget assumptions before launch.');
  });
});
