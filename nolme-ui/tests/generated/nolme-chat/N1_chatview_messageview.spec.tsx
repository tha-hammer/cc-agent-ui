/**
 * @gwt.id    gwt-nolme-chatview-messageview, gwt-nolme-chatview-composer-props
 * @rr.reads  rr.nolme.session_binding
 * @rr.writes —
 * @rr.raises —
 *
 * NolmeChatView replaces CopilotKit's default chat layout. It owns:
 *   - the scrollable message list (via CopilotChatMessageView)
 *   - the visible composer (NolmeComposer) with Figma chrome
 *
 * Framework still owns submission, run lifecycle, attachments, and message
 * rendering (slot overrides flow through messageView prop).
 */
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';

const { messageViewSpy, composerSpy } = vi.hoisted(() => ({
  messageViewSpy: vi.fn(),
  composerSpy: vi.fn(),
}));

vi.mock('@copilotkit/react-core/v2', () => ({
  CopilotChatMessageView: (props: any) => {
    messageViewSpy(props);
    return <div data-testid="message-view-stub" />;
  },
}));

vi.mock('../../../src/components/NolmeComposer', () => ({
  NolmeComposer: (props: any) => {
    composerSpy(props);
    return <div data-testid="composer-stub" />;
  },
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

describe('C2 · NolmeChatView renders messageView with framework messages', () => {
  it('mounts CopilotChatMessageView and forwards messages + slot overrides', () => {
    messageViewSpy.mockReset();
    composerSpy.mockReset();
    const messages = [{ id: 'm1', role: 'user', content: 'hi' }];
    const assistantMessage = () => null;
    const userMessage = () => null;
    const reasoningMessage = () => null;
    render(
      <NolmeChatView
        messages={messages as any}
        onSubmitMessage={vi.fn()}
        inputValue=""
        onInputChange={vi.fn()}
        isRunning={false}
        messageView={{ assistantMessage, userMessage, reasoningMessage }}
      />,
    );
    expect(messageViewSpy).toHaveBeenCalled();
    const props = messageViewSpy.mock.calls[0][0];
    expect(props.messages).toBe(messages);
    expect(props.assistantMessage).toBe(assistantMessage);
    expect(props.userMessage).toBe(userMessage);
    expect(props.reasoningMessage).toBe(reasoningMessage);
  });
});

describe('C3 · NolmeChatView forwards framework props to NolmeComposer', () => {
  it('passes inputValue, onInputChange, onSubmitMessage, onStop, onAddFile, isRunning to composer', () => {
    messageViewSpy.mockReset();
    composerSpy.mockReset();
    const onSubmitMessage = vi.fn();
    const onInputChange = vi.fn();
    const onStop = vi.fn();
    const onAddFile = vi.fn();
    render(
      <NolmeChatView
        messages={[]}
        inputValue="draft"
        onInputChange={onInputChange}
        onSubmitMessage={onSubmitMessage}
        onStop={onStop}
        onAddFile={onAddFile}
        isRunning={true}
      />,
    );
    expect(composerSpy).toHaveBeenCalled();
    const props = composerSpy.mock.calls[0][0];
    expect(props.inputValue).toBe('draft');
    expect(props.onInputChange).toBe(onInputChange);
    expect(props.onSubmitMessage).toBe(onSubmitMessage);
    expect(props.onStop).toBe(onStop);
    expect(props.onAddFile).toBe(onAddFile);
    expect(props.isRunning).toBe(true);
  });
});
