// gwt-0002: fork.handler.slices-parent-messages
// Verifiers:
//   - SliceUpToAndIncluding
//   - ParentImmutable
//   - ReadOnlyAccess

import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useChatComposerState } from '../../src/components/chat/hooks/useChatComposerState';
import { useSessionStore } from '../../src/stores/useSessionStore';

describe('gwt-0002 fork.handler.slices-parent-messages', () => {
  it('handler slices parent messages with (0, index+1) and does not mutate parent', () => {
    const parentId = 'parent-abc';
    const seedMessages = [
      { id: 'u0', sessionId: parentId, provider: 'claude', kind: 'text', role: 'user', content: 'q1', timestamp: '' },
      { id: 'a1', sessionId: parentId, provider: 'claude', kind: 'text', role: 'assistant', content: 'r1', timestamp: '' },
      { id: 'u2', sessionId: parentId, provider: 'claude', kind: 'text', role: 'user', content: 'q2', timestamp: '' },
      { id: 'a3', sessionId: parentId, provider: 'claude', kind: 'text', role: 'assistant', content: 'r3', timestamp: '' },
    ];

    // Seed parent via real hook API (Pattern A)
    const { result: storeResult } = renderHook(() => useSessionStore());
    act(() => {
      for (const m of seedMessages) storeResult.current.appendRealtime(parentId, m as any);
    });
    const beforeSnapshot = [...storeResult.current.getMessages(parentId)];

    const sendMessage = vi.fn();

    const { result } = renderHook(() =>
      useChatComposerState({
        currentSessionId: parentId,
        provider: 'claude',
        selectedProject: { name: 'p', displayName: 'p', fullPath: '/p', path: '/p' },
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

    const sliceSpy = vi.spyOn(Array.prototype, 'slice');

    act(() => {
      (result.current as any).handleForkFromMessage('a1', 1);
    });

    // SliceUpToAndIncluding — slice called with (0, 2)
    const sliceCall = sliceSpy.mock.calls.find(([a, b]) => a === 0 && b === 2);
    expect(sliceCall).toBeDefined();

    sliceSpy.mockRestore();

    // ParentImmutable + ReadOnlyAccess: parent content unchanged
    const afterSnapshot = storeResult.current.getMessages(parentId);
    expect(afterSnapshot.length).toBe(4);
    expect(afterSnapshot).toEqual(beforeSnapshot);
    expect(afterSnapshot[3].id).toBe('a3');
  });
});
