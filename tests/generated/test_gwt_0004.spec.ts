// gwt-0004: fork.handler.inherits-settings
// Verifiers:
//   - NoDialog
//   - LocalStorageRead      (getItem('claude-settings') called)
//   - ComposerStatePull     (cwd, projectPath, provider, permissionMode)
//   - ProviderKey           (claude-settings, not cursor/codex/gemini)
//   - DefaultOnMissing      (null from getItem → default defaults)
//   - DefaultOnParseError   (invalid JSON → default defaults, no throw)
//   - StoredOnValid         (valid JSON → parsed fields flow through)

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useChatComposerState } from '../../src/components/chat/hooks/useChatComposerState';
import { useSessionStore } from '../../src/stores/useSessionStore';

function makeArgs(overrides: any = {}) {
  return {
    currentSessionId: 'parent-xyz',
    provider: 'claude',
    selectedProject: { name: 'proj', displayName: 'proj', fullPath: '/work/proj', path: '/work/proj' },
    permissionMode: 'default',
    claudeModel: 'claude-sonnet-4.5',
    cursorModel: '',
    codexModel: '',
    geminiModel: '',
    isLoading: false,
    canAbortSession: false,
    tokenBudget: null,
    sendMessage: vi.fn(),
    cyclePermissionMode: () => {},
    pendingViewSessionRef: { current: null },
    scrollToBottom: () => {},
    addMessage: () => {},
    clearMessages: () => {},
    rewindMessages: () => {},
    setIsLoading: () => {},
    setCanAbortSession: () => {},
    setClaudeStatus: () => {},
    setIsUserScrolledUp: () => {},
    setPendingPermissionRequests: () => {},
    selectedSession: null,
    ...overrides,
  };
}

function seedParent(parentId: string, messageId: string) {
  const { result: storeResult } = renderHook(() => useSessionStore());
  act(() => {
    storeResult.current.appendRealtime(parentId, {
      id: messageId, sessionId: parentId, provider: 'claude', kind: 'text',
      role: 'assistant', content: 'x', timestamp: '',
    } as any);
  });
  return storeResult;
}

describe('gwt-0004 fork.handler.inherits-settings', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('StoredOnValid + ProviderKey + LocalStorageRead + ComposerStatePull + NoDialog', () => {
    const parentId = 'p1';
    const messageId = 'a1';
    localStorage.setItem('claude-settings', JSON.stringify({
      allowedTools: ['Read', 'Grep'],
      disallowedTools: ['Bash'],
      skipPermissions: false,
    }));
    seedParent(parentId, messageId);

    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem');
    const args = makeArgs({ currentSessionId: parentId });
    const { result } = renderHook(() => useChatComposerState(args as any));

    act(() => {
      (result.current as any).handleForkFromMessage(messageId, 0);
    });

    // LocalStorageRead + ProviderKey
    const keysRead = getItemSpy.mock.calls.map((c) => c[0]);
    expect(keysRead).toContain('claude-settings');
    expect(keysRead).not.toContain('cursor-tools-settings');
    expect(keysRead).not.toContain('codex-settings');
    expect(keysRead).not.toContain('gemini-settings');

    // StoredOnValid + ComposerStatePull
    expect(args.sendMessage).toHaveBeenCalledTimes(1);
    const opts = args.sendMessage.mock.calls[0][0].options;
    expect(opts.toolsSettings).toEqual({
      allowedTools: ['Read', 'Grep'],
      disallowedTools: ['Bash'],
      skipPermissions: false,
    });
    expect(opts.cwd).toBe('/work/proj');
    expect(opts.projectPath).toBe('/work/proj');
    expect(opts.permissionMode).toBe('default');
    expect(opts.model).toBe('claude-sonnet-4.5');

    // NoDialog
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it('DefaultOnMissing: getItem returns null → defaults used, fork still proceeds', () => {
    const parentId = 'p2';
    const messageId = 'a2';
    // localStorage is empty — no claude-settings key
    seedParent(parentId, messageId);

    const args = makeArgs({ currentSessionId: parentId });
    const { result } = renderHook(() => useChatComposerState(args as any));

    act(() => {
      (result.current as any).handleForkFromMessage(messageId, 0);
    });

    expect(args.sendMessage).toHaveBeenCalledTimes(1);
    const opts = args.sendMessage.mock.calls[0][0].options;
    expect(opts.toolsSettings).toEqual({
      allowedTools: [],
      disallowedTools: [],
      skipPermissions: false,
    });
  });

  it('DefaultOnParseError: invalid JSON in localStorage → defaults used, no throw', () => {
    const parentId = 'p3';
    const messageId = 'a3';
    localStorage.setItem('claude-settings', '{not-json');
    seedParent(parentId, messageId);

    const args = makeArgs({ currentSessionId: parentId });
    const { result } = renderHook(() => useChatComposerState(args as any));

    expect(() => {
      act(() => {
        (result.current as any).handleForkFromMessage(messageId, 0);
      });
    }).not.toThrow();

    expect(args.sendMessage).toHaveBeenCalledTimes(1);
    const opts = args.sendMessage.mock.calls[0][0].options;
    expect(opts.toolsSettings).toEqual({
      allowedTools: [],
      disallowedTools: [],
      skipPermissions: false,
    });
  });
});
