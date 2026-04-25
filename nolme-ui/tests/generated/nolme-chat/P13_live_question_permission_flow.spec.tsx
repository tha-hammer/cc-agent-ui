import { fireEvent, render, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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
  sessionId: 'session-live-questions',
  projectName: 'demo-project',
  projectPath: '/workspace/demo-project',
};

describe('P13 · live AskUserQuestion permission flow', () => {
  beforeEach(() => {
    useAiWorkingActiveSkillSpy.mockReturnValue(null);
    coAgentStateRef.current = undefined;
    localStorage.setItem('auth-token', 'jwt-test');
  });

  it('accumulates answers across multiple AskUserQuestion steps, posts once, and dismisses after the final answer', async () => {
    let pendingActive = true;
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes('/api/nolme/pending-permissions/session-live-questions') && (!init?.method || init.method === 'GET')) {
        return new Response(
          JSON.stringify({
            requests: pendingActive
              ? [
                  {
                    requestId: 'req-ask-1',
                    toolName: 'AskUserQuestion',
                    input: {
                      questions: [
                        {
                          header: 'BUSINESS TYPE',
                          question: 'Which business are you actively evaluating?',
                          options: [
                            { label: 'Car wash' },
                            { label: 'Laundromat' },
                            { label: 'Both / comparing' },
                          ],
                        },
                        {
                          header: 'ROLE / ANGLE',
                          question: "What's your role in this?",
                          options: [
                            { label: 'Owner-operator' },
                            { label: 'Passive investor' },
                          ],
                        },
                      ],
                    },
                    sessionId: 'session-live-questions',
                  },
                ]
              : [],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }

      if (url.includes('/api/nolme/pending-permissions/session-live-questions/req-ask-1/decision') && init?.method === 'POST') {
        pendingActive = false;
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    (globalThis as { fetch?: typeof fetch }).fetch = fetchMock as typeof fetch;

    const hydration = {
      status: 'ready' as const,
      messages: [],
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

    const wrapper = ({ children }: { children: ReactNode }) => (
      <AiWorkingHydrationProvider binding={binding} hydration={hydration}>
        {children}
      </AiWorkingHydrationProvider>
    );

    const { getByTestId, getByText, queryByTestId } = render(
      <AiResponseQuestionsCardBound onSubmitPrompt={vi.fn()} />,
      { wrapper },
    );

    await waitFor(() => expect(getByTestId('ai-response-questions-card')).toBeTruthy());
    expect(getByTestId('ai-response-questions-card')).toHaveTextContent('BUSINESS TYPE');
    expect(getByTestId('ai-response-questions-card')).toHaveTextContent('Which business are you actively evaluating?');

    fireEvent.click(getByText('Car wash'));
    fireEvent.click(getByText('Continue'));

    expect(queryByTestId('ai-response-questions-card')).toBeTruthy();
    expect(getByTestId('ai-response-questions-card')).toHaveTextContent('ROLE / ANGLE');
    expect(getByTestId('ai-response-questions-card')).toHaveTextContent("What's your role in this?");
    expect(fetchMock).not.toHaveBeenCalledWith(
      expect.stringContaining('/decision'),
      expect.objectContaining({ method: 'POST' }),
    );

    fireEvent.click(getByText('Owner-operator'));
    fireEvent.click(getByText('Continue'));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/nolme/pending-permissions/session-live-questions/req-ask-1/decision'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            allow: true,
            updatedInput: {
              questions: [
                {
                  header: 'BUSINESS TYPE',
                  question: 'Which business are you actively evaluating?',
                  options: [
                    { label: 'Car wash' },
                    { label: 'Laundromat' },
                    { label: 'Both / comparing' },
                  ],
                },
                {
                  header: 'ROLE / ANGLE',
                  question: "What's your role in this?",
                  options: [
                    { label: 'Owner-operator' },
                    { label: 'Passive investor' },
                  ],
                },
              ],
              answers: {
                'Which business are you actively evaluating?': 'Car wash',
                "What's your role in this?": 'Owner-operator',
              },
            },
          }),
        }),
      ),
    );

    await waitFor(() => expect(queryByTestId('ai-response-questions-card')).toBeNull());
  });
});
