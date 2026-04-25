import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  authenticatedFetchSpy,
  setCursorPositionSpy,
  broadcastMessages,
} = vi.hoisted(() => ({
  authenticatedFetchSpy: vi.fn(),
  setCursorPositionSpy: vi.fn(),
  broadcastMessages: [] as Array<{ channel: string; payload: unknown }>,
}));

class FakeBroadcastChannel {
  name: string;

  constructor(name: string) {
    this.name = name;
  }

  postMessage(payload: unknown) {
    broadcastMessages.push({ channel: this.name, payload });
  }

  close() {}
}

vi.mock('../../src/utils/api', () => ({
  authenticatedFetch: authenticatedFetchSpy,
}));

vi.mock('../../src/components/chat/hooks/useSlashCommands', () => ({
  useSlashCommands: () => ({
    slashCommands: [
      { name: '/cs', path: '/home/maceo/.claude/commands/cs.md', type: 'custom' },
      { name: '/help', type: 'built-in' },
    ],
    slashCommandsCount: 2,
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
    setCursorPosition: setCursorPositionSpy,
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

import {
  ACTIVE_SKILL_STORAGE_KEY,
  makeActiveSkillIdentityKey,
  parseActiveSkillStore,
} from '../../src/hooks/useActiveSkillBroadcast';
import { useChatComposerState } from '../../src/components/chat/hooks/useChatComposerState';

const baseProps = (sendMessage: ReturnType<typeof vi.fn>) => ({
  selectedProject: {
    name: 'demo-project',
    path: '/workspace/demo-project',
    fullPath: '/workspace/demo-project',
    displayName: 'demo-project',
  } as any,
  selectedSession: {
    id: 'session-1',
    summary: 'Demo session',
    title: 'Demo session',
  } as any,
  currentSessionId: 'session-1',
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

async function submitSlashCommand(result: ReturnType<typeof renderHook<typeof useChatComposerState>>['result'], text: string) {
  await act(async () => {
    result.current.handleInputChange({
      target: {
        value: text,
        selectionStart: text.length,
        style: {},
      },
    } as any);
  });

  await act(async () => {
    await result.current.handleSubmit({ preventDefault: () => undefined } as any);
    await vi.runAllTimersAsync();
  });
}

describe('active skill transport (Phase 3 · cam-n1v)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('BroadcastChannel', FakeBroadcastChannel as unknown as typeof BroadcastChannel);
    localStorage.clear();
    sessionStorage.clear();
    authenticatedFetchSpy.mockReset();
    setCursorPositionSpy.mockReset();
    broadcastMessages.length = 0;
  });

  it('publishes a session-scoped active skill for custom slash commands', async () => {
    authenticatedFetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({
        type: 'custom',
        command: '/cs',
        content: 'Expanded command template',
        metadata: {
          name: 'cs',
          description: 'Search prior work to add context to a request.',
        },
        hasBashCommands: false,
      }),
    });

    const sendMessage = vi.fn();
    const { result } = renderHook(() => useChatComposerState(baseProps(sendMessage) as any));

    await submitSlashCommand(result, '/cs token budget drift');

    const store = parseActiveSkillStore(localStorage.getItem(ACTIVE_SKILL_STORAGE_KEY));
    const key = makeActiveSkillIdentityKey({
      provider: 'claude',
      sessionId: 'session-1',
      projectPath: '/workspace/demo-project',
    });

    expect(store[key]).toEqual(
      expect.objectContaining({
        provider: 'claude',
        sessionId: 'session-1',
        projectPath: '/workspace/demo-project',
        commandName: '/cs',
        argsText: 'token budget drift',
        metadata: expect.objectContaining({
          name: 'cs',
          description: 'Search prior work to add context to a request.',
        }),
      }),
    );
    expect(typeof store[key]?.updatedAt).toBe('number');
    expect(broadcastMessages).toContainEqual({
      channel: 'nolme-active-skill',
      payload: expect.objectContaining({
        type: 'active-skill-update',
        context: expect.objectContaining({
          commandName: '/cs',
          argsText: 'token budget drift',
        }),
      }),
    });

    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'claude-command',
        command: 'token budget drift',
        options: expect.objectContaining({
          appendSystemPrompt: 'Expanded command template',
        }),
      }),
    );
  });

  it('does not overwrite the active skill store for built-in commands', async () => {
    localStorage.setItem(
      ACTIVE_SKILL_STORAGE_KEY,
      JSON.stringify({
        seeded: {
          provider: 'claude',
          sessionId: 'session-1',
          projectPath: '/workspace/demo-project',
          commandName: '/cs',
          argsText: 'existing topic',
          metadata: { description: 'Existing skill' },
          updatedAt: 123,
        },
      }),
    );

    authenticatedFetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({
        type: 'builtin',
        command: '/help',
        action: 'help',
        data: { content: 'help text' },
      }),
    });

    const sendMessage = vi.fn();
    const { result } = renderHook(() => useChatComposerState(baseProps(sendMessage) as any));

    await submitSlashCommand(result, '/help');

    const store = parseActiveSkillStore(localStorage.getItem(ACTIVE_SKILL_STORAGE_KEY));
    const key = makeActiveSkillIdentityKey({
      provider: 'claude',
      sessionId: 'session-1',
      projectPath: '/workspace/demo-project',
    });

    expect(store[key]).toEqual(
      expect.objectContaining({
        commandName: '/cs',
        argsText: 'existing topic',
        updatedAt: 123,
      }),
    );
    expect(broadcastMessages).toHaveLength(0);
    expect(sendMessage).not.toHaveBeenCalled();
  });
});
