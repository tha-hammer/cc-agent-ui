// gwt-0003: fork.handler.sends-claude-command-with-fork-options
// Verifiers:
//   - ChannelReuse       (type === 'claude-command')
//   - ForkMarker         (options.forkSession === true; resume, resumeSessionAt)
//   - FreshSessionId     (new UUID v4, distinct from parent)
//   - EmptyCommand       (command === '')
//   - sendMessage called exactly once

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useChatComposerState } from '../../src/components/chat/hooks/useChatComposerState';
import { useSessionStore } from '../../src/stores/useSessionStore';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('gwt-0003 fork.handler.sends-claude-command-with-fork-options', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('dispatches claude-command with fork options over sendMessage exactly once', () => {
    const parentId = '11111111-1111-4111-8111-111111111111';
    const messageId = 'a-uuid-1234';

    // Seed parent via real hook API
    const { result: storeResult } = renderHook(() => useSessionStore());
    act(() => {
      storeResult.current.appendRealtime(parentId, {
        id: 'u0', sessionId: parentId, provider: 'claude', kind: 'text', role: 'user', content: 'q', timestamp: '',
      } as any);
      storeResult.current.appendRealtime(parentId, {
        id: messageId, sessionId: parentId, provider: 'claude', kind: 'text', role: 'assistant', content: 'r', timestamp: '',
      } as any);
    });

    // Deterministic UUID for FreshSessionId assertion
    const newUUID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(newUUID as any);

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

    act(() => {
      (result.current as any).handleForkFromMessage(messageId, 1);
    });

    // sendMessage-called-once
    expect(sendMessage).toHaveBeenCalledTimes(1);
    const payload = sendMessage.mock.calls[0][0];

    // ChannelReuse
    expect(payload.type).toBe('claude-command');
    // EmptyCommand
    expect(payload.command).toBe('');
    // ForkMarker
    expect(payload.options).toMatchObject({
      forkSession: true,
      resume: parentId,
      resumeSessionAt: messageId,
    });
    // FreshSessionId — UUID v4, distinct from parent
    expect(payload.options.sessionId).toBe(newUUID);
    expect(payload.options.sessionId).toMatch(UUID_V4);
    expect(payload.options.sessionId).not.toBe(parentId);

    vi.restoreAllMocks();
  });
});
