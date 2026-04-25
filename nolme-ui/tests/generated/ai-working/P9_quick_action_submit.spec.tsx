import { fireEvent, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { appendMessageSpy, useCopilotChatSuggestionsSpy } = vi.hoisted(() => ({
  appendMessageSpy: vi.fn(),
  useCopilotChatSuggestionsSpy: vi.fn(),
}));

vi.mock('@copilotkit/react-core', () => ({
  useCopilotChat: () => ({ appendMessage: appendMessageSpy }),
  useCopilotChatSuggestions: (...args: unknown[]) => useCopilotChatSuggestionsSpy(...args),
}));

vi.mock('@copilotkit/react-core/v2', () => ({
  CopilotChatMessageView: () => <div data-testid="message-view-stub" />,
}));

vi.mock('../../../src/components/ModelSelectorPill', () => ({
  ModelSelectorPill: () => <div data-testid="model-selector-pill-stub" />,
}));

vi.mock('../../../src/components/bindings/useCopilotKitNolmeAgentState', () => ({
  useCopilotKitNolmeAgentState: () => ({
    phases: [{ id: 'build', label: 'Build', title: 'Build', status: 'active' }],
    currentPhaseIndex: 0,
    quickActions: ['Quick action prompt'],
  }),
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

vi.mock('../../../src/components/bindings/AiResponseQuestionsCardBound', () => ({
  AiResponseQuestionsCardBound: () => null,
}));

import { NolmeChatView } from '../../../src/components/NolmeChatView';

describe('P9 · shared submit seam', () => {
  beforeEach(() => {
    appendMessageSpy.mockReset();
    useCopilotChatSuggestionsSpy.mockReset();
    (globalThis as any).fetch = vi.fn().mockResolvedValue(new Response('{}', { status: 404 }));
  });

  it('routes composer Enter and quick-action click through the same parent submit callback', () => {
    const submitPrompt = vi.fn();
    const onInputChange = vi.fn();
    const { getByPlaceholderText, getByText } = render(
      <NolmeChatView
        messages={[]}
        inputValue="Typed prompt"
        onInputChange={onInputChange}
        onSubmitMessage={submitPrompt}
        isRunning={false}
      />,
    );

    fireEvent.keyDown(getByPlaceholderText('Type your response...'), {
      key: 'Enter',
      code: 'Enter',
    });
    fireEvent.click(getByText('Quick action prompt'));

    expect(submitPrompt).toHaveBeenNthCalledWith(1, 'Typed prompt');
    expect(submitPrompt).toHaveBeenNthCalledWith(2, 'Quick action prompt');
    expect(submitPrompt).toHaveBeenCalledTimes(2);
    expect(appendMessageSpy).not.toHaveBeenCalled();
  });
});
