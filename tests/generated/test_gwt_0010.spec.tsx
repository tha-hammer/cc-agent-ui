// gwt-0010: fork.nav.navigates-on-session-created
// Verifiers:
//   - PARENT_ID, NEW_ID fixture distinctness
//   - NavigateAlways          (onNavigateToSession invoked on session_created)
//   - NoParentReplaceOnFork   (parent is real UUID → onReplaceTemporarySession NOT called)
//   - DistinctFromParent      (newSessionId !== parentSessionId)
//   - NavigateCalledAtMostOnce

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useChatRealtimeHandlers } from '../../src/components/chat/hooks/useChatRealtimeHandlers';
import { useSessionStore, type NormalizedMessage } from '../../src/stores/useSessionStore';

const PARENT = '11111111-1111-4111-8111-111111111111';
const NEW = '22222222-2222-4222-8222-222222222222';

function makeDeps(sessionStore: ReturnType<typeof useSessionStore>, overrides: any = {}) {
  return {
    latestMessage: null,
    provider: 'claude',
    currentSessionId: PARENT,
    selectedSession: null,
    selectedProject: null,
    setCurrentSessionId: vi.fn(),
    setIsLoading: vi.fn(),
    setCanAbortSession: vi.fn(),
    setClaudeStatus: vi.fn(),
    setTokenBudget: vi.fn(),
    setPendingPermissionRequests: vi.fn(),
    onNavigateToSession: vi.fn(),
    onReplaceTemporarySession: vi.fn(),
    onSessionInactive: vi.fn(),
    onSessionProcessing: vi.fn(),
    onSessionNotProcessing: vi.fn(),
    onWebSocketReconnect: vi.fn(),
    pendingViewSessionRef: { current: null as any },
    streamBufferRef: { current: '' },
    streamTimerRef: { current: null },
    accumulatedStreamRef: { current: '' },
    sessionStore,
    ...overrides,
  };
}

describe('gwt-0010 fork.nav.navigates-on-session-created', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('onNavigateToSession(NEW) fires once; onReplaceTemporarySession NOT called for real parent', () => {
    // DistinctFromParent
    expect(NEW).not.toBe(PARENT);

    const { result: storeResult } = renderHook(() => useSessionStore());
    const deps = makeDeps(storeResult.current);

    const { rerender } = renderHook(
      ({ latestMessage }: { latestMessage: NormalizedMessage | null }) =>
        useChatRealtimeHandlers({ ...deps, latestMessage } as any),
      { initialProps: { latestMessage: null } },
    );

    const msg = {
      id: 'm1',
      timestamp: new Date().toISOString(),
      provider: 'claude',
      sessionId: NEW,
      kind: 'session_created',
      newSessionId: NEW,
    } as unknown as NormalizedMessage;

    rerender({ latestMessage: msg });

    // NavigateAlways + NavigateCalledAtMostOnce
    expect(deps.onNavigateToSession).toHaveBeenCalledTimes(1);
    expect(deps.onNavigateToSession).toHaveBeenCalledWith(NEW);

    // NoParentReplaceOnFork — parent is a real UUID, not 'new-session-*'
    expect(deps.onReplaceTemporarySession).not.toHaveBeenCalled();
  });
});
