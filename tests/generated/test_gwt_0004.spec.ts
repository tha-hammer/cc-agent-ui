// gwt-0004: fork.handler.inherits-settings (lazy dispatch variant)
// Under Option B, settings inheritance happens at SUBMIT time (via the shared
// getToolsSettings path) rather than on Fork click. Fork click only arms the
// pending fork ref. The submit that follows reads claude-settings and builds
// the options payload.
//
// Verifiers:
//   - NoDialog
//   - LocalStorageRead      (getItem('claude-settings') called on submit)
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

function armForkAndSubmit(result: any, messageId: string, prompt = 'forked prompt') {
  act(() => {
    result.current.handleForkFromMessage(messageId, 0);
  });
  act(() => {
    result.current.setInput(prompt);
  });
  act(() => {
    void result.current.handleSubmit({ preventDefault: () => {} } as any);
  });
}

describe('gwt-0004 fork.handler.inherits-settings (lazy dispatch)', () => {
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

    armForkAndSubmit(result, messageId);

    // LocalStorageRead + ProviderKey — claude-settings read at submit time.
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
    // Fork markers are present because submit consumed the armed ref.
    expect(opts.forkSession).toBe(true);
    expect(opts.resume).toBe(parentId);
    expect(opts.resumeSessionAt).toBe(messageId);

    // NoDialog
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it('DefaultOnMissing: getItem returns null → defaults used, fork still dispatches', () => {
    const parentId = 'p2';
    const messageId = 'a2';
    // localStorage is empty — no claude-settings key
    seedParent(parentId, messageId);

    const args = makeArgs({ currentSessionId: parentId });
    const { result } = renderHook(() => useChatComposerState(args as any));

    armForkAndSubmit(result, messageId);

    expect(args.sendMessage).toHaveBeenCalledTimes(1);
    const opts = args.sendMessage.mock.calls[0][0].options;
    expect(opts.toolsSettings).toEqual({
      allowedTools: [],
      disallowedTools: [],
      skipPermissions: false,
    });
    expect(opts.forkSession).toBe(true);
  });

  it('DefaultOnParseError: invalid JSON in localStorage → defaults used, no throw', () => {
    const parentId = 'p3';
    const messageId = 'a3';
    localStorage.setItem('claude-settings', '{not-json');
    seedParent(parentId, messageId);

    const args = makeArgs({ currentSessionId: parentId });
    const { result } = renderHook(() => useChatComposerState(args as any));

    expect(() => armForkAndSubmit(result, messageId)).not.toThrow();

    expect(args.sendMessage).toHaveBeenCalledTimes(1);
    const opts = args.sendMessage.mock.calls[0][0].options;
    expect(opts.toolsSettings).toEqual({
      allowedTools: [],
      disallowedTools: [],
      skipPermissions: false,
    });
  });
});
