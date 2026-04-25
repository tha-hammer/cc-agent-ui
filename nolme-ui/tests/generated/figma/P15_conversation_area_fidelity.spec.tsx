import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';

vi.mock('@copilotkit/react-core/v2', () => ({
  CopilotChatMessageView: () => <div data-testid="message-view-stub" />,
}));

vi.mock('../../../src/components/NolmeComposer', () => ({
  NolmeComposer: () => <div data-testid="composer-stub" />,
}));

vi.mock('../../../src/components/bindings/AiWorkingInputContextClusterBound', () => ({
  AiWorkingInputContextClusterBound: () => <div data-testid="input-context-stub" />,
}));

vi.mock('../../../src/components/bindings/QuickActionChipRowBound', () => ({
  QuickActionChipRowBound: () => <div data-testid="quick-actions-stub" />,
}));

vi.mock('../../../src/components/bindings/AiResponseQuestionsCardBound', () => ({
  AiResponseQuestionsCardBound: () => <div data-testid="question-card-stub" />,
}));

import { NolmeChatView } from '../../../src/components/NolmeChatView';

describe('P15 · conversation area Figma fidelity', () => {
  it('renders the muted conversation canvas and a dedicated chat-messages wrapper with the Figma insets', () => {
    const { getByTestId } = render(
      <NolmeChatView
        messages={[]}
        inputValue=""
        onInputChange={vi.fn()}
        onSubmitMessage={vi.fn()}
        isRunning={false}
      />,
    );

    const chatView = getByTestId('nolme-chat-view');
    const historyScroll = getByTestId('nolme-history-scroll');
    const chatMessages = getByTestId('nolme-chat-messages');

    expect(chatView.className).toMatch(/bg-nolme-neutral-200/);
    expect(historyScroll).toContainElement(chatMessages);
    expect(chatMessages).toContainElement(getByTestId('message-view-stub'));
    expect(chatMessages.className).toMatch(/w-full/);
    expect(chatMessages.className).toMatch(/px-\[96px\]/);
    expect(chatMessages.className).toMatch(/pb-\[40px\]/);
    expect(chatMessages.className).toMatch(/gap-\[40px\]/);
    expect(chatMessages.className).toMatch(/justify-end/);
  });
});
