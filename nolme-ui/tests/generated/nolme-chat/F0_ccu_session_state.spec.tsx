/**
 * @gwt.id    gwt-nolme-binding-mutator
 * @rr.reads  rr.nolme.session_binding_store
 * @rr.writes rr.nolme.session_binding_mutator
 * @rr.raises —
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const { bcPostSpy } = vi.hoisted(() => ({ bcPostSpy: vi.fn() }));

class MockBC {
  constructor(public name: string) {}
  postMessage(msg: unknown) {
    bcPostSpy(this.name, msg);
  }
  close() {}
  addEventListener() {}
  removeEventListener() {}
}
vi.stubGlobal('BroadcastChannel', MockBC as unknown as typeof BroadcastChannel);

const baseBinding = {
  provider: 'claude' as const,
  sessionId: 's-1',
  projectName: 'p',
  projectPath: '/x',
  model: 'opus-4-7',
};

vi.mock('../../../src/hooks/useCcuSession', () => ({
  useCcuSession: () => baseBinding,
}));

import { useCcuSessionState } from '../../../src/hooks/useCcuSessionState';

describe('F0 · useCcuSessionState', () => {
  beforeEach(() => {
    localStorage.clear();
    bcPostSpy.mockReset();
  });

  it('exposes the read-only binding', () => {
    const { result } = renderHook(() => useCcuSessionState());
    expect(result.current.binding).toEqual(baseBinding);
  });

  it('updateBinding merges, writes localStorage, and broadcasts', () => {
    const { result } = renderHook(() => useCcuSessionState());
    act(() => {
      result.current.updateBinding({ model: 'sonnet-4-6' });
    });

    const stored = JSON.parse(localStorage.getItem('nolme-current-binding') ?? '{}');
    expect(stored.model).toBe('sonnet-4-6');
    expect(stored.provider).toBe('claude');
    expect(stored.sessionId).toBe('s-1');

    expect(bcPostSpy).toHaveBeenCalledWith(
      'ccu-session',
      expect.objectContaining({
        type: 'update',
        binding: expect.objectContaining({ model: 'sonnet-4-6', provider: 'claude' }),
      }),
    );
  });
});
