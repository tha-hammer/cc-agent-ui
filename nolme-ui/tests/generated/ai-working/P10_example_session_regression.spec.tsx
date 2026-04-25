import { render } from '@testing-library/react';
import fixtureMessages from '../../fixtures/ai-working/example-session.normalized.json';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { useCoAgentSpy, coAgentStateRef } = vi.hoisted(() => ({
  useCoAgentSpy: vi.fn(),
  coAgentStateRef: { current: undefined as unknown },
}));

vi.mock('@copilotkit/react-core', () => ({
  useCoAgent: (config: unknown) => {
    useCoAgentSpy(config);
    return { state: coAgentStateRef.current };
  },
  useCopilotChat: () => ({ appendMessage: vi.fn() }),
  useCopilotChatSuggestions: vi.fn(),
}));

vi.mock('@copilotkit/react-core/v2', () => ({
  CopilotChat: (props: Record<string, any>) => {
    const ChatView = props.chatView;
    return (
      <ChatView
        messageView={{}}
        messages={[]}
        inputValue=""
        onInputChange={vi.fn()}
        onSubmitMessage={vi.fn()}
        isRunning={false}
      />
    );
  },
  CopilotChatMessageView: () => <div data-testid="message-view-stub" />,
}));

vi.mock('../../../src/hooks/useCcuSession', () => ({
  useCcuSession: () => ({
    provider: 'claude',
    sessionId: 'session-1',
    projectName: 'demo-project',
    projectPath: '/workspace/demo-project',
  }),
}));

vi.mock('../../../src/hooks/useAiWorkingActiveSkill', () => ({
  useAiWorkingActiveSkill: () => null,
}));

vi.mock('../../../src/components/bindings/useNolmeRegistrations.v2', () => ({
  useNolmeRegistrations: () => undefined,
}));

vi.mock('../../../src/components/ModelSelectorPill', () => ({
  ModelSelectorPill: () => <div data-testid="model-selector-pill-stub" />,
}));

import { NolmeDashboardV2 } from '../../../src/components/NolmeDashboard.v2';
import { AiWorkingHydrationProvider } from '../../../src/hooks/useAiWorkingProjection';

const binding = {
  provider: 'claude' as const,
  sessionId: 'session-1',
  projectName: 'demo-project',
  projectPath: '/workspace/demo-project',
};

describe('P10 · example session regression', () => {
  beforeEach(() => {
    useCoAgentSpy.mockReset();
    coAgentStateRef.current = undefined;
    (globalThis as any).fetch = vi.fn().mockResolvedValue(new Response('{}', { status: 404 }));
  });

  it('renders phases, deliverables, token budget, and quick actions from one hydrated example session', () => {
    const hydration = {
      status: 'ready' as const,
      messages: fixtureMessages,
      state: {
        schemaVersion: 1,
        quickActions: ['Summarize deliverables'],
        tokenBudget: {
          provider: 'claude',
          source: 'live',
          supported: true,
          used: 25,
          total: 100,
          remaining: 75,
          usedPercent: 25,
          remainingPercent: 75,
          updatedAt: 1,
        },
      },
    };

    const { getByTestId, getByText } = render(
      <AiWorkingHydrationProvider binding={binding} hydration={hydration as any}>
        <NolmeDashboardV2 />
      </AiWorkingHydrationProvider>,
    );

    expect(useCoAgentSpy).toHaveBeenCalledWith(expect.objectContaining({
      name: 'ccu',
    }));
    expect(getByTestId('workflow-phase-bar-v2')).toHaveTextContent('Build');
    expect(getByTestId('deliverables-rail-v2')).toHaveTextContent(/PRD/i);
    expect(getByTestId('deliverables-rail-v2')).toHaveTextContent(/car wash membership/i);
    expect(getByTestId('usage-card-v2')).toHaveTextContent('25%');
    expect(getByText('Summarize deliverables')).toBeInTheDocument();
  });
});
