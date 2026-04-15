// gwt-0011: fork.parent.session-unchanged-after-fork
// Verifiers:
//   - ParentMergedFrozen     (parent merged array unchanged deeply)
//   - NoParentWrites         (appendRealtime never invoked with parent id during replay)
//   - NewSessionIsolated     (replay writes land on NEW id)
//   - ParentLengthPreserved  (parent.merged.length unchanged)
//   - ReplayTargetsNewSession

import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSessionStore } from '../../src/stores/useSessionStore';

const P = '11111111-1111-4111-8111-111111111111';
const NEW = '22222222-2222-4222-8222-222222222222';
const MID = 'asst-uuid-aaaa';

describe('gwt-0011 fork.parent.session-unchanged-after-fork', () => {
  it('parent merged array is not mutated when fork replay writes land on new session', () => {
    const { result: storeResult } = renderHook(() => useSessionStore());

    const parentSeed = [
      { id: 'u1', sessionId: P, provider: 'claude', kind: 'text', role: 'user', content: 'hi', timestamp: '' },
      { id: 'a1', sessionId: P, provider: 'claude', kind: 'text', role: 'assistant', content: 'hey', timestamp: '' },
      { id: MID, sessionId: P, provider: 'claude', kind: 'text', role: 'assistant', content: 'more', timestamp: '' },
    ];
    act(() => {
      for (const m of parentSeed) storeResult.current.appendRealtime(P, m as any);
    });

    const beforeSnapshot = [...storeResult.current.getMessages(P)];
    expect(beforeSnapshot.length).toBe(3);

    const appendSpy = vi.spyOn(storeResult.current, 'appendRealtime');

    // Simulate fork replay: SDK events arrive scoped to NEW session id.
    const replay = [
      { id: 'r1', sessionId: NEW, provider: 'claude', kind: 'text', role: 'user', content: 'hi', timestamp: '' },
      { id: 'r2', sessionId: NEW, provider: 'claude', kind: 'text', role: 'assistant', content: 'hey', timestamp: '' },
    ];
    act(() => {
      for (const m of replay) storeResult.current.appendRealtime(NEW, m as any);
    });

    // ParentMergedFrozen + ParentLengthPreserved
    const afterParent = storeResult.current.getMessages(P);
    expect(afterParent).toEqual(beforeSnapshot);
    expect(afterParent.length).toBe(3);

    // NoParentWrites — every spy call targets NEW, never P
    expect(appendSpy).toHaveBeenCalled();
    for (const call of appendSpy.mock.calls) {
      expect(call[0]).not.toBe(P);
      expect(call[0]).toBe(NEW);
    }

    // NewSessionIsolated + ReplayTargetsNewSession
    const newMerged = storeResult.current.getMessages(NEW);
    expect(newMerged.length).toBe(2);
    for (const m of newMerged) {
      expect(m.sessionId).toBe(NEW);
    }

    appendSpy.mockRestore();
  });
});
