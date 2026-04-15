// gwt-0003: fork.handler.arms-then-dispatches-on-next-submit (lazy dispatch / Option B)
// Verifiers:
//   - ArmOnClick         (fork click does NOT dispatch sendMessage)
//   - ChannelReuse       (type === 'claude-command' on subsequent submit)
//   - ForkMarker         (options.forkSession === true; resume, resumeSessionAt)
//   - FreshSessionId     (new UUID v4, distinct from parent)
//   - UserPromptConsumed (command === user input, not empty)
//   - sendMessage called exactly once (on submit, not on fork)

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useChatComposerState } from '../../src/components/chat/hooks/useChatComposerState';
import { useSessionStore } from '../../src/stores/useSessionStore';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('gwt-0003 fork.handler.arms-then-dispatches-on-next-submit', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('fork click arms pending state; next submit dispatches claude-command with fork options', async () => {
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

    // ArmOnClick: Fork click stashes pending fork; does NOT dispatch.
    act(() => {
      (result.current as any).handleForkFromMessage(messageId, 1);
    });
    expect(sendMessage).not.toHaveBeenCalled();
    expect((result.current as any).isForkPending).toBe(true);

    // Simulate user typing a prompt + submitting.
    act(() => {
      (result.current as any).setInput('forked prompt');
    });
    act(() => {
      void (result.current as any).handleSubmit({ preventDefault: () => {} } as any);
    });

    // sendMessage-called-once on submit.
    expect(sendMessage).toHaveBeenCalledTimes(1);
    const payload = sendMessage.mock.calls[0][0];

    // ChannelReuse
    expect(payload.type).toBe('claude-command');
    // UserPromptConsumed — command is user text, not empty
    expect(payload.command).toBe('forked prompt');
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

    // Pending state cleared after dispatch.
    expect((result.current as any).isForkPending).toBe(false);

    vi.restoreAllMocks();
  });
});
