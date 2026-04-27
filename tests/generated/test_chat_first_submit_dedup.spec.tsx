import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authenticatedFetchSpy } = vi.hoisted(() => ({
  authenticatedFetchSpy: vi.fn(),
}));

vi.mock('../../src/utils/api', () => ({
  authenticatedFetch: authenticatedFetchSpy,
}));

vi.mock('../../src/components/chat/hooks/useSlashCommands', () => ({
  useSlashCommands: () => ({
    slashCommands: [],
    slashCommandsCount: 0,
    filteredCommands: [],
    frequentCommands: [],
    commandQuery: '',
    showCommandMenu: false,
    selectedCommandIndex: -1,
    resetCommandMenuState: vi.fn(),
    handleCommandSelect: vi.fn(),
    handleToggleCommandMenu: vi.fn(),
    handleCommandInputChange: vi.fn(),
    handleCommandMenuKeyDown: () => false,
  }),
}));

vi.mock('../../src/components/chat/hooks/useFileMentions', () => ({
  useFileMentions: () => ({
    showFileDropdown: false,
    filteredFiles: [],
    selectedFileIndex: -1,
    renderInputWithMentions: (value: string) => value,
    selectFile: vi.fn(),
    setCursorPosition: vi.fn(),
    handleFileMentionsKeyDown: () => false,
  }),
}));

vi.mock('react-dropzone', () => ({
  useDropzone: () => ({
    getRootProps: () => ({}),
    getInputProps: () => ({}),
    isDragActive: false,
    open: vi.fn(),
  }),
}));

import { useChatComposerState } from '../../src/components/chat/hooks/useChatComposerState';

const baseProps = (sendMessage: ReturnType<typeof vi.fn>) => ({
  selectedProject: {
    name: 'demo-project',
    path: '/workspace/demo-project',
    fullPath: '/workspace/demo-project',
    displayName: 'demo-project',
  } as any,
  selectedSession: null,
  currentSessionId: null,
  provider: 'claude' as const,
  permissionMode: 'default',
  cyclePermissionMode: vi.fn(),
  cursorModel: 'cursor',
  claudeModel: 'sonnet',
  codexModel: 'codex-mini-latest',
  geminiModel: 'gemini-2.5-pro',
  isLoading: false,
  canAbortSession: false,
  tokenBudget: null,
  sendMessage,
  sendByCtrlEnter: false,
  onSessionActive: vi.fn(),
  onSessionProcessing: vi.fn(),
  onInputFocusChange: vi.fn(),
  onFileOpen: vi.fn(),
  onShowSettings: vi.fn(),
  pendingViewSessionRef: { current: null },
  scrollToBottom: vi.fn(),
  addMessage: vi.fn(),
  clearMessages: vi.fn(),
  rewindMessages: vi.fn(),
  setIsLoading: vi.fn(),
  setCanAbortSession: vi.fn(),
  setClaudeStatus: vi.fn(),
  setIsUserScrolledUp: vi.fn(),
  setPendingPermissionRequests: vi.fn(),
});

describe('chat first-submit dedupe', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    authenticatedFetchSpy.mockReset();
  });

  it('sends only one claude-command when submit is re-entered before loading state commits', async () => {
    const sendMessage = vi.fn();
    const { result } = renderHook(() => useChatComposerState(baseProps(sendMessage) as any));

    await act(async () => {
      result.current.handleInputChange({
        target: {
          value: "let's research the car wash business",
          selectionStart: 32,
          style: {},
        },
      } as any);
    });

    const makeEvent = () => ({ preventDefault: vi.fn() }) as any;

    await act(async () => {
      await Promise.all([
        result.current.handleSubmit(makeEvent()),
        result.current.handleSubmit(makeEvent()),
      ]);
    });

    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'claude-command',
        command: "let's research the car wash business",
        options: expect.objectContaining({
          resume: false,
          sessionId: null,
          projectPath: '/workspace/demo-project',
        }),
      }),
    );
  });
});
