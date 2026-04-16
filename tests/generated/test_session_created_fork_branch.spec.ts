// G-4: session_created handler has a fork-aware branch for established sessions
// See thoughts/searchable/shared/research/2026-04-16-session-handling-audit.md

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useChatRealtimeHandlers } from '../../src/components/chat/hooks/useChatRealtimeHandlers';
import { useSessionStore, type NormalizedMessage } from '../../src/stores/useSessionStore';

const PARENT = '11111111-1111-4111-8111-111111111111';
const FORK = '33333333-3333-4333-8333-333333333333';

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
    pendingViewSessionRef: { current: { sessionId: null as string | null } },
    streamBufferRef: { current: '' },
    streamTimerRef: { current: null },
    accumulatedStreamRef: { current: '' },
    sessionStore,
    ...overrides,
  };
}

function rerenderWith(deps: any, msg: NormalizedMessage) {
  const { rerender } = renderHook(
    ({ latestMessage }: { latestMessage: NormalizedMessage | null }) =>
      useChatRealtimeHandlers({ ...deps, latestMessage } as any),
    { initialProps: { latestMessage: null as NormalizedMessage | null } },
  );
  rerender({ latestMessage: msg });
}

describe('session_created — fork branch (G-4)', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('sets pendingViewSessionRef.current.sessionId on fork', () => {
    const { result: storeResult } = renderHook(() => useSessionStore());
    const deps = makeDeps(storeResult.current);

    const msg = {
      id: 'm1',
      timestamp: new Date().toISOString(),
      provider: 'claude',
      sessionId: FORK,
      kind: 'session_created',
      newSessionId: FORK,
      fromFork: true,
    } as unknown as NormalizedMessage;

    rerenderWith(deps, msg);

    expect(deps.pendingViewSessionRef.current.sessionId).toBe(FORK);
  });

  it('calls setCurrentSessionId with the new id on fork', () => {
    const { result: storeResult } = renderHook(() => useSessionStore());
    const deps = makeDeps(storeResult.current);

    const msg = {
      id: 'm1',
      timestamp: new Date().toISOString(),
      provider: 'claude',
      sessionId: FORK,
      kind: 'session_created',
      newSessionId: FORK,
      fromFork: true,
    } as unknown as NormalizedMessage;

    rerenderWith(deps, msg);

    expect(deps.setCurrentSessionId).toHaveBeenCalledWith(FORK);
  });

  it('still navigates on fork', () => {
    const { result: storeResult } = renderHook(() => useSessionStore());
    const deps = makeDeps(storeResult.current);

    const msg = {
      id: 'm1',
      timestamp: new Date().toISOString(),
      provider: 'claude',
      sessionId: FORK,
      kind: 'session_created',
      newSessionId: FORK,
      fromFork: true,
    } as unknown as NormalizedMessage;

    rerenderWith(deps, msg);

    expect(deps.onNavigateToSession).toHaveBeenCalledWith(FORK);
    expect(deps.onReplaceTemporarySession).not.toHaveBeenCalled();
  });

  it('does NOT touch setCurrentSessionId on non-fork echo of current session', () => {
    const { result: storeResult } = renderHook(() => useSessionStore());
    const deps = makeDeps(storeResult.current);

    // No fromFork marker, currentSessionId already matches
    const msg = {
      id: 'm1',
      timestamp: new Date().toISOString(),
      provider: 'claude',
      sessionId: PARENT,
      kind: 'session_created',
      newSessionId: PARENT,
    } as unknown as NormalizedMessage;

    rerenderWith(deps, msg);

    expect(deps.setCurrentSessionId).not.toHaveBeenCalled();
    expect(deps.onNavigateToSession).toHaveBeenCalledWith(PARENT);
  });
});
