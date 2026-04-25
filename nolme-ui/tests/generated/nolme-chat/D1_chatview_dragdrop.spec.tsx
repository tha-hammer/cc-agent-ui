/**
 * @gwt.id    gwt-nolme-chatview-dragdrop
 * @rr.reads  —
 * @rr.writes —
 * @rr.raises —
 *
 * NolmeChatView forwards drag-drop events to the framework so attachments
 * land on `useAttachments`. The chatView wrapper subscribes to onDragOver,
 * onDragLeave, and onDrop — all of which CopilotChat hands us via
 * mergedProps when we replace the chatView slot.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';

vi.mock('@copilotkit/react-core/v2', () => ({
  CopilotChatMessageView: () => <div data-testid="message-view-stub" />,
}));

vi.mock('../../../src/components/NolmeComposer', () => ({
  NolmeComposer: () => <div data-testid="composer-stub" />,
}));

vi.mock('../../../src/components/bindings/QuickActionChipRowBound', () => ({
  QuickActionChipRowBound: () => <div data-testid="quick-actions-stub" />,
}));

vi.mock('../../../src/components/bindings/AiResponseQuestionsCardBound', () => ({
  AiResponseQuestionsCardBound: () => <div data-testid="question-card-stub" />,
}));

vi.mock('../../../src/components/bindings/AiWorkingInputContextClusterBound', () => ({
  AiWorkingInputContextClusterBound: () => <div data-testid="input-context-stub" />,
}));

import { NolmeChatView } from '../../../src/components/NolmeChatView';

describe('D1 · NolmeChatView forwards drag-drop to framework handlers', () => {
  it('drop on the chat area fires the framework onDrop', () => {
    const onDrop = vi.fn();
    const onDragOver = vi.fn();
    const onDragLeave = vi.fn();
    const { getByTestId } = render(
      <NolmeChatView
        messages={[]}
        onSubmitMessage={vi.fn()}
        inputValue=""
        onInputChange={vi.fn()}
        isRunning={false}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
      />,
    );
    const view = getByTestId('nolme-chat-view');
    fireEvent.dragOver(view);
    fireEvent.dragLeave(view);
    fireEvent.drop(view);
    expect(onDragOver).toHaveBeenCalled();
    expect(onDragLeave).toHaveBeenCalled();
    expect(onDrop).toHaveBeenCalled();
  });
});
