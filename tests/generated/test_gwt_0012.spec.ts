// gwt-0012: fork.settings.localStorage-not-cleared-on-nav
// Verifiers:
//   - LocalStoragePersistAcrossNav
//   - NoRemoveItemOnWatchedKeys
//   - NoClearAllCalled
//   - NoSetItemOnWatchedKeys
//   - SessionStorageScopedToPendingId

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useChatRealtimeHandlers } from '../../src/components/chat/hooks/useChatRealtimeHandlers';
import { useSessionStore, type NormalizedMessage } from '../../src/stores/useSessionStore';

const PARENT = '11111111-1111-4111-8111-111111111111';
const NEW = '22222222-2222-4222-8222-222222222222';
const WATCHED = ['claude-settings', 'cursor-tools-settings', 'codex-settings', 'gemini-settings'];

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

describe('gwt-0012 fork.settings.localStorage-not-cleared-on-nav', () => {
  let removeSpy: any, clearSpy: any, setItemSpy: any, sessionSetSpy: any;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('claude-settings', JSON.stringify({ model: 'sonnet', allowedTools: ['Bash'] }));
    localStorage.setItem('cursor-tools-settings', JSON.stringify({ foo: 1 }));
    localStorage.setItem('codex-settings', JSON.stringify({ bar: 2 }));
    localStorage.setItem('gemini-settings', JSON.stringify({ baz: 3 }));

    removeSpy = vi.spyOn(Storage.prototype, 'removeItem');
    clearSpy = vi.spyOn(Storage.prototype, 'clear');
    setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    sessionSetSpy = setItemSpy; // same spy captures both localStorage and sessionStorage writes
  });

  it('navigation on session_created does not touch watched localStorage keys', () => {
    const snapshot: Record<string, string | null> = {};
    for (const k of WATCHED) snapshot[k] = localStorage.getItem(k);

    const onNav = vi.fn();
    const { result: storeResult } = renderHook(() => useSessionStore());
    const deps = makeDeps(storeResult.current, { onNavigateToSession: onNav });

    const { rerender } = renderHook(
      ({ latestMessage }: { latestMessage: NormalizedMessage | null }) =>
        useChatRealtimeHandlers({ ...deps, latestMessage } as any),
      { initialProps: { latestMessage: null } },
    );

    rerender({
      latestMessage: {
        id: 'm',
        timestamp: '',
        provider: 'claude',
        sessionId: NEW,
        kind: 'session_created',
        newSessionId: NEW,
      } as unknown as NormalizedMessage,
    });

    // NoRemoveItemOnWatchedKeys
    for (const call of removeSpy.mock.calls) {
      expect(WATCHED).not.toContain(call[0]);
    }
    // NoClearAllCalled
    expect(clearSpy).not.toHaveBeenCalled();
    // NoSetItemOnWatchedKeys
    for (const call of setItemSpy.mock.calls) {
      expect(WATCHED).not.toContain(call[0]);
    }

    // LocalStoragePersistAcrossNav
    for (const k of WATCHED) {
      expect(localStorage.getItem(k)).toBe(snapshot[k]);
    }

    // SessionStorageScopedToPendingId — only writes we observe on sessionStorage
    // are to 'pendingSessionId' (for forks from a real parent, even this is
    // gated off — but if any sessionStorage.setItem happens, it must be
    // pendingSessionId). Parent is a real UUID (NOT 'new-session-*') so the
    // handler should NOT touch sessionStorage at all.
    const sessionWrites = sessionSetSpy.mock.calls.filter((c: any[]) => {
      // Can't distinguish localStorage vs sessionStorage from Storage.prototype
      // spy alone; filter by allowed keys plus our known seed keys.
      return !WATCHED.includes(c[0]);
    });
    for (const c of sessionWrites) {
      expect(['pendingSessionId']).toContain(c[0]);
    }

    // Nav still fired
    expect(onNav).toHaveBeenCalledWith(NEW);
  });
});
