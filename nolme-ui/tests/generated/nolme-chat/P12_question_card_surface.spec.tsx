import { fireEvent, render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

const {
  useCoAgentSpy,
  useAiWorkingActiveSkillSpy,
  coAgentStateRef,
} = vi.hoisted(() => ({
  useCoAgentSpy: vi.fn(),
  useAiWorkingActiveSkillSpy: vi.fn(),
  coAgentStateRef: { current: undefined as unknown },
}));

vi.mock('@copilotkit/react-core', () => ({
  useCoAgent: (config: unknown) => {
    useCoAgentSpy(config);
    return { state: coAgentStateRef.current };
  },
}));

vi.mock('../../../src/hooks/useAiWorkingActiveSkill', () => ({
  useAiWorkingActiveSkill: (binding: unknown) => useAiWorkingActiveSkillSpy(binding),
}));

import { AiWorkingHydrationProvider } from '../../../src/hooks/useAiWorkingProjection';
import { AiResponseQuestionsCardBound } from '../../../src/components/bindings/AiResponseQuestionsCardBound';

const binding = {
  provider: 'claude' as const,
  sessionId: 'session-questions',
  projectName: 'demo-project',
  projectPath: '/workspace/demo-project',
};

describe('P12 · question card surface', () => {
  it('renders the projected question card and submits the selected answer', () => {
    useAiWorkingActiveSkillSpy.mockReturnValue(null);
    coAgentStateRef.current = undefined;

    const hydration = {
      status: 'ready' as const,
      messages: [
        {
          id: 'assistant-question-block',
          kind: 'text',
          role: 'assistant',
          content: [
            '<ask-user-question>',
            "intro: Before I proceed, I'd like to clarify a few things:",
            'prompt: How much distance outside the Bay Area did you want to apply?',
            'mode: single',
            'option: 5 mile radius',
            'option: 10 mile radius',
            'option: 20 mile radius',
            'option_other: Other (describe below)',
            'placeholder: 15 miles radius outside the Bay Area',
            '</ask-user-question>',
          ].join('\n'),
        },
      ],
      state: {
        schemaVersion: 1 as const,
        phases: [],
        currentPhaseIndex: 0,
        currentReviewLine: '',
        resources: [],
        profile: null,
        quickActions: [],
        taskNotifications: [],
      },
    };

    const submitPrompt = vi.fn();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <AiWorkingHydrationProvider binding={binding} hydration={hydration}>
        {children}
      </AiWorkingHydrationProvider>
    );

    const { getByTestId, getByText } = render(
      <AiResponseQuestionsCardBound onSubmitPrompt={submitPrompt} />,
      { wrapper },
    );

    const card = getByTestId('ai-response-questions-card');
    expect(card).toHaveTextContent("Before I proceed, I'd like to clarify a few things:");
    expect(card).toHaveTextContent('How much distance outside the Bay Area did you want to apply?');
    expect(card).toHaveTextContent('5 mile radius');
    expect(card).toHaveTextContent('Other (describe below)');

    fireEvent.click(getByText('10 mile radius'));
    fireEvent.click(getByText('Continue'));

    expect(submitPrompt).toHaveBeenCalledWith('10 mile radius');
  });
});
