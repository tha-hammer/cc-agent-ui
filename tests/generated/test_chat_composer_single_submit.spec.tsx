import { createRef } from 'react';
import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('../../src/components/mic-button/view/MicButton', () => ({
  default: () => null,
}));

vi.mock('../../src/components/chat/view/subcomponents/CommandMenu', () => ({
  default: () => null,
}));

vi.mock('../../src/components/chat/view/subcomponents/ClaudeStatus', () => ({
  default: () => null,
}));

vi.mock('../../src/components/chat/view/subcomponents/ImageAttachment', () => ({
  default: () => null,
}));

vi.mock('../../src/components/chat/view/subcomponents/PermissionRequestsBanner', () => ({
  default: () => null,
}));

vi.mock('../../src/components/chat/view/subcomponents/ChatInputControls', () => ({
  default: () => null,
}));

import ChatComposer from '../../src/components/chat/view/subcomponents/ChatComposer';

describe('ChatComposer submit button', () => {
  it('does not invoke submit twice for the same pointer submit path', () => {
    const onSubmit = vi.fn();
    const { container } = render(
      <ChatComposer
        pendingPermissionRequests={[]}
        handlePermissionDecision={vi.fn()}
        handleGrantToolPermission={vi.fn(() => ({ success: false }))}
        claudeStatus={null}
        isLoading={false}
        onAbortSession={vi.fn()}
        provider="claude"
        permissionMode="default"
        onModeSwitch={vi.fn()}
        thinkingMode="none"
        setThinkingMode={vi.fn()}
        tokenBudget={null}
        slashCommandsCount={0}
        onToggleCommandMenu={vi.fn()}
        hasInput
        onClearInput={vi.fn()}
        isUserScrolledUp={false}
        hasMessages={false}
        onScrollToBottom={vi.fn()}
        onSubmit={onSubmit}
        isDragActive={false}
        attachedImages={[]}
        onRemoveImage={vi.fn()}
        uploadingImages={new Map()}
        imageErrors={new Map()}
        showFileDropdown={false}
        filteredFiles={[]}
        selectedFileIndex={-1}
        onSelectFile={vi.fn()}
        filteredCommands={[]}
        selectedCommandIndex={-1}
        onCommandSelect={vi.fn()}
        onCloseCommandMenu={vi.fn()}
        isCommandMenuOpen={false}
        frequentCommands={[]}
        getRootProps={() => ({})}
        getInputProps={() => ({})}
        openImagePicker={vi.fn()}
        inputHighlightRef={createRef<HTMLDivElement>()}
        renderInputWithMentions={(value: string) => value}
        textareaRef={createRef<HTMLTextAreaElement>()}
        input="let's research the car wash business"
        onInputChange={vi.fn()}
        onTextareaClick={vi.fn()}
        onTextareaKeyDown={vi.fn()}
        onTextareaPaste={vi.fn()}
        onTextareaScrollSync={vi.fn()}
        onTextareaInput={vi.fn()}
        onInputFocusChange={vi.fn()}
        isInputFocused={false}
        placeholder="Type your message"
        isTextareaExpanded={false}
        sendByCtrlEnter={false}
        onTranscript={vi.fn()}
      />,
    );

    const form = container.querySelector('form');
    const submitButton = container.querySelector('button[type="submit"]');

    expect(form).not.toBeNull();
    expect(submitButton).not.toBeNull();

    fireEvent.mouseDown(submitButton as HTMLButtonElement);
    fireEvent.submit(form as HTMLFormElement);

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
