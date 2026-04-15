// fork.lazy.cancel: armed fork can be cancelled before submit; subsequent
// submit behaves as a normal resume (no forkSession, no resumeSessionAt).

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useChatComposerState } from '../../src/components/chat/hooks/useChatComposerState';
import { useSessionStore } from '../../src/stores/useSessionStore';

describe('fork.lazy.cancel cancels armed fork so next submit is a plain message', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('arm → cancelPendingFork → submit has no fork options', () => {
    const parentId = '22222222-2222-4222-8222-222222222222';
    const messageId = 'assistant-msg-uuid';

    const { result: storeResult } = renderHook(() => useSessionStore());
    act(() => {
      storeResult.current.appendRealtime(parentId, {
        id: messageId, sessionId: parentId, provider: 'claude',
        kind: 'text', role: 'assistant', content: 'r', timestamp: '',
      } as any);
    });

    const sendMessage = vi.fn();

    const { result } = renderHook(() =>
      useChatComposerState({
        currentSessionId: parentId,
        provider: 'claude',
        selectedProject: { name: 'proj', displayName: 'proj', fullPath: '/proj', path: '/proj' },
        permissionMode: 'default',
        claudeModel: 'claude-sonnet-4.5',
        cursorModel: '',
        codexModel: '',
        geminiModel: '',
        isLoading: false,
        canAbortSession: false,
        tokenBudget: null,
        sendMessage,
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
      } as any)
    );

    // Arm the fork.
    act(() => {
      (result.current as any).handleForkFromMessage(messageId, 0);
    });
    expect((result.current as any).isForkPending).toBe(true);

    // Cancel before typing/submitting.
    act(() => {
      (result.current as any).cancelPendingFork();
    });
    expect((result.current as any).isForkPending).toBe(false);

    // Now send a normal message.
    act(() => {
      (result.current as any).setInput('just a regular follow-up');
    });
    act(() => {
      void (result.current as any).handleSubmit({ preventDefault: () => {} } as any);
    });

    expect(sendMessage).toHaveBeenCalledTimes(1);
    const payload = sendMessage.mock.calls[0][0];
    expect(payload.type).toBe('claude-command');
    expect(payload.command).toBe('just a regular follow-up');
    // No fork markers.
    expect(payload.options.forkSession).toBeUndefined();
    expect(payload.options.resumeSessionAt).toBeUndefined();
    // Resume falls back to the normal (boolean) resume behavior against the
    // current session id.
    expect(payload.options.sessionId).toBe(parentId);
    expect(payload.options.resume).toBe(true);
  });
});
