import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';

vi.mock('../../../src/components/AgentNavRail.v2', () => ({
  AgentNavRailV2: () => <div data-testid="nav-rail-stub" />,
}));

vi.mock('../../../src/components/bindings/DeliverablesRailBound.v2', () => ({
  DeliverablesRailBoundV2: () => <div data-testid="deliverables-stub" />,
}));

vi.mock('../../../src/components/bindings/WorkflowPhaseBarBound.v2', () => ({
  WorkflowPhaseBarBoundV2: () => <div data-testid="phases-stub" />,
}));

vi.mock('../../../src/components/bindings/NolmeChatBound', () => ({
  NolmeChatBound: () => <div data-testid="chat-bound-stub" />,
}));

vi.mock('../../../src/components/bindings/useNolmeRegistrations.v2', () => ({
  useNolmeRegistrations: () => undefined,
}));

import { NolmeDashboardV2 } from '../../../src/components/NolmeDashboard.v2';
import { WorkflowPhaseBarV2 } from '../../../src/components/WorkflowPhaseBar.v2';

const phases = [
  { id: 'p1', label: 'P1', title: 'Observe', status: 'complete' as const },
  { id: 'p2', label: 'P2', title: 'Think', status: 'idle' as const },
  { id: 'p3', label: 'P3', title: 'Build', status: 'active' as const },
  { id: 'p4', label: 'P4', title: 'Verify', status: 'idle' as const },
];

describe('P1 · phases right-rail layout', () => {
  it('allocates a 360px right rail so the Figma phases module has room for a 312px content width', () => {
    const { getByTestId } = render(<NolmeDashboardV2 />);

    expect(getByTestId('nolme-dashboard-v2').className).toMatch(/grid-cols-\[88px_minmax\(0,1fr\)_360px\]/);
  });

  it('does not enable horizontal scrolling on the 312px phase chip strip', () => {
    const { getByTestId } = render(
      <WorkflowPhaseBarV2 phases={phases} currentPhaseIndex={0} currentReviewLine="Progress 10/10" />,
    );

    const strip = getByTestId('workflow-phase-tabs-v2');
    expect(strip.className).toMatch(/w-\[312px\]/);
    expect(strip.className).not.toMatch(/overflow-x-auto/);
  });
});
