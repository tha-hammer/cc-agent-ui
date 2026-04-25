import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, within } from '@testing-library/react';

vi.mock('@copilotkit/react-core', () => ({
  useCoAgent: () => ({ state: undefined }),
  useCopilotChat: () => ({ appendMessage: vi.fn() }),
  useCopilotChatSuggestions: vi.fn(),
}));

vi.mock('@copilotkit/react-core/v2', () => ({
  CopilotChatMessageView: () => <div data-testid="message-view-stub" />,
}));

vi.mock('../../../src/hooks/useCcuSession', () => ({
  useCcuSession: () => ({
    provider: 'claude',
    sessionId: 's-1',
    projectName: 'demo',
    projectPath: '/home/demo',
  }),
}));

vi.mock('../../../src/hooks/useAiWorkingActiveSkill', () => ({
  useAiWorkingActiveSkill: () => null,
}));

vi.mock('../../../src/components/bindings/NolmeChatBound', () => ({
  NolmeChatBound: () => <div data-testid="chat-bound-stub" />,
}));

vi.mock('../../../src/components/bindings/useNolmeRegistrations.v2', () => ({
  useNolmeRegistrations: () => undefined,
}));

import { AiWorkingHydrationProvider } from '../../../src/hooks/useAiWorkingProjection';
import { NolmeDashboardV2 } from '../../../src/components/NolmeDashboard.v2';
import { NolmeChatView } from '../../../src/components/NolmeChatView';

describe('P8 · hydrated ai-working view', () => {
  beforeEach(() => {
    (globalThis as any).fetch = vi.fn(() => new Promise(() => {}));
    localStorage.setItem('auth-token', 'jwt-abc');
  });

  it('renders projected rails and input-zone context from hydrated state before a new run starts', () => {
    const binding = {
      provider: 'claude',
      sessionId: 's-1',
      projectName: 'demo',
      projectPath: '/home/demo',
    } as const;

    const hydration = {
      status: 'ready' as const,
      messages: [],
      state: {
        schemaVersion: 1 as const,
        phases: [
          { id: 'observe', label: 'P1', title: 'Observe', status: 'complete' as const },
          { id: 'plan', label: 'P2', title: 'Plan', status: 'active' as const },
        ],
        currentPhaseIndex: 1,
        currentReviewLine: 'Review PRD edits',
        resources: [
          {
            id: 'doc-1',
            badge: 'P2' as const,
            title: 'Architecture doc',
            subtitle: 'systems/architecture.md',
            tone: 'iris' as const,
            action: 'link' as const,
          },
        ],
        profile: {
          name: 'Aria',
          role: 'Community Lead',
          skills: ['Research', 'Writing'],
          integrations: ['linear', 'slack'],
        },
        quickActions: ['Draft review'],
        taskNotifications: [],
        tokenBudget: {
          provider: 'claude',
          source: 'persisted',
          supported: true,
          used: 120,
          total: 200,
          remaining: 80,
          usedPercent: 60,
          remainingPercent: 40,
          updatedAt: 1,
        },
      },
    };

    const { container, getByTestId, getByText } = render(
      <AiWorkingHydrationProvider binding={binding} hydration={hydration}>
        <>
          <NolmeDashboardV2 />
          <NolmeChatView
            messages={[]}
            inputValue=""
            onInputChange={vi.fn()}
            onSubmitMessage={vi.fn()}
            isRunning={false}
          />
        </>
      </AiWorkingHydrationProvider>,
    );

    const aside = container.querySelector('aside');
    expect(aside).toContainElement(getByTestId('workflow-phase-bar-v2'));
    expect(aside).toContainElement(getByTestId('deliverables-rail-v2'));
    expect(within(aside as HTMLElement).getByText('Architecture doc')).toBeTruthy();

    const inputZone = getByTestId('nolme-input-zone');
    expect(within(inputZone).getByTestId('agent-profile-card-v2')).toBeTruthy();
    expect(within(inputZone).getByTestId('usage-card-v2')).toBeTruthy();
    expect(within(inputZone).getByText(/Aria/)).toBeTruthy();
    expect(within(inputZone).getByText('60% used')).toBeTruthy();
    expect(getByText('Draft review')).toBeTruthy();
  });
});
