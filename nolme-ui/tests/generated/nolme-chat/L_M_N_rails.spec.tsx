/**
 * @gwt.id    gwt-nolme-rail-rebaseline
 * @rr.reads  rr.nolme.design_token
 * @rr.writes —
 * @rr.raises —
 */
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';

vi.mock('@copilotkit/react-core/v2', () => ({
  useRenderTool: vi.fn(),
  useHumanInTheLoop: vi.fn(),
  CopilotChat: () => <div data-testid="cpk-chat-stub" />,
  useAttachments: () => ({
    attachments: [],
    enabled: true,
    fileInputRef: { current: null },
    handleFileUpload: vi.fn(),
    handleDrop: vi.fn(),
    consumeAttachments: () => [],
  }),
}));

vi.mock('@copilotkit/react-core', () => ({
  useCoAgent: () => ({
    state: {
      schemaVersion: 1,
      phases: [],
      currentPhaseIndex: 0,
      currentReviewLine: '',
      resources: [],
      profile: { name: 'Aria', role: 'Community Lead', skills: [], integrations: [], usageValue: 45 },
      quickActions: [],
      taskNotifications: [],
    },
  }),
  useFrontendTool: vi.fn(),
  useHumanInTheLoop: vi.fn(),
  useRenderToolCall: vi.fn(),
  useCopilotChat: () => ({ appendMessage: vi.fn() }),
  useCopilotChatSuggestions: vi.fn(),
}));

vi.mock('../../../src/hooks/useCcuSession', () => ({
  useCcuSession: () => ({ provider: 'claude', sessionId: 's-1', projectName: 'p', projectPath: '/x' }),
}));

import { NolmeDashboardV2 } from '../../../src/components/NolmeDashboard.v2';
import { AgentNavRailV2 } from '../../../src/components/AgentNavRail.v2';
import { AgentProfileCardV2 } from '../../../src/components/AgentProfileCard.v2';
import { UsageCardV2 } from '../../../src/components/UsageCard.v2';
import { DeliverablesRailV2 } from '../../../src/components/DeliverablesRail.v2';

describe('L1 · NolmeDashboard.v2 grid columns', () => {
  it('uses [88px_minmax(0,1fr)_360px] grid-template-columns', () => {
    const { getByTestId } = render(<NolmeDashboardV2 />);
    const root = getByTestId('nolme-dashboard-v2');
    expect(root.className).toMatch(/grid-cols-\[88px_minmax\(0,1fr\)_360px\]/);
  });
});

describe('L2 · AgentNavRail.v2 full-height dividers', () => {
  it('has border-y nolme-purple-300 and no shadow/rounded-[18px]', () => {
    const { getByTestId } = render(<AgentNavRailV2 />);
    const root = getByTestId('agent-nav-rail-v2');
    expect(root.className).toMatch(/border-y/);
    expect(root.className).toMatch(/border-nolme-purple-300/);
    expect(root.className).toMatch(/bg-white/);
    expect(root.className).not.toMatch(/shadow-\[/);
    expect(root.className).not.toMatch(/rounded-\[18px\]/);
  });
});

describe('M1 · AgentProfileCard.v2 no emerald ring', () => {
  it('avatar image has no ring class', () => {
    const { container } = render(
      <AgentProfileCardV2
        profile={{ name: 'Aria', role: 'Community Lead', avatarUrl: '/aria.png', skills: [], integrations: [] }}
      />,
    );
    const img = container.querySelector('img');
    expect(img).toBeTruthy();
    expect(img!.className).not.toMatch(/ring-/);
    expect(img!.className).not.toMatch(/ring-nolme-emerald/);
  });
});

describe('M2 · UsageCard.v2 progress bar', () => {
  it('renders the compact Figma meter with an 8px rail and inline used label', () => {
    const { getByTestId, getByText } = render(<UsageCardV2 percent={45} />);
    const rail = getByTestId('usage-rail');
    expect(rail.className).toMatch(/bg-\[\#f0f0f5\]/);
    expect(rail.className).toMatch(/h-\[8px\]/);
    const fill = getByTestId('usage-fill');
    expect(fill.className).toMatch(/bg-nolme-purple-500/);
    expect(fill.className).toMatch(/h-\[8px\]/);
    expect(fill.getAttribute('style')).toContain('width: 45%');
    expect(getByText('45% used')).toBeTruthy();
  });
});

describe('M3 · DeliverablesRail.v2 Figma deliverables list', () => {
  it('renders the Deliverables header, phase artifact label, and stacked rows without old badges', () => {
    const items = [
      { id: 'a', phase: 'P1' as const, title: 'Alpha', subtitle: 'One' },
      { id: 'b', phase: 'P2' as const, title: 'Beta', subtitle: 'Two' },
      { id: 'c', phase: 'P2' as const, title: 'Gamma', subtitle: 'Three' },
    ];
    const { getByText, getByTestId, queryByTestId } = render(<DeliverablesRailV2 items={items} />);
    expect(getByText('Deliverables')).toBeTruthy();
    expect(getByTestId('deliverables-phase-P1')).toHaveTextContent('Phase 1 - Artifacts');
    expect(getByTestId('deliverables-phase-P1')).toHaveTextContent('Alpha');
    expect(getByTestId('deliverables-phase-P2')).toHaveTextContent('Phase 2 - Artifacts');
    expect(getByTestId('deliverables-phase-P2')).toHaveTextContent('Beta');
    expect(getByTestId('deliverables-phase-P2')).toHaveTextContent('Gamma');
    expect(queryByTestId('phase-badge-a')).toBeNull();
  });
});

describe('M4 · Right column stack order', () => {
  it('aside contains phases and deliverables, not the input-zone context cards', () => {
    const { container } = render(<NolmeDashboardV2 />);
    const aside = container.querySelector('aside');
    expect(aside).toBeTruthy();
    expect(aside!.querySelector('[data-testid="workflow-phase-bar-v2"]')).toBeTruthy();
    expect(aside!.querySelector('[data-testid="deliverables-rail-v2"]')).toBeTruthy();
    expect(aside!.querySelector('[data-testid="agent-profile-card-v2"]')).toBeNull();
    expect(aside!.querySelector('[data-testid="usage-card-v2"]')).toBeNull();
  });
});

describe('N1 · Outer bg is flat', () => {
  it('root uses bg-nolme-purple-100 and no radial-gradient', () => {
    const { getByTestId } = render(<NolmeDashboardV2 />);
    const root = getByTestId('nolme-dashboard-v2');
    expect(root.className).toMatch(/bg-nolme-purple-100/);
    expect(root.className).not.toMatch(/radial-gradient/);
  });
});
