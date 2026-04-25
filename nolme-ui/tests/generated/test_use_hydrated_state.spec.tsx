import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { NolmeSessionBinding } from '../../src/lib/types';
import { useHydratedState } from '../../src/hooks/useHydratedState';

function binding(): NolmeSessionBinding {
  return {
    provider: 'claude',
    sessionId: 's-abc',
    projectName: '-home-x',
    projectPath: '/home/x',
  };
}

describe('useHydratedState (Phase 3 · B16)', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    (globalThis as any).fetch = fetchMock;
    localStorage.setItem('auth-token', 'test-token');
  });

  it('starts in loading state when given a binding', () => {
    fetchMock.mockImplementation(() => new Promise(() => { /* never resolves */ }));
    const { result } = renderHook(() => useHydratedState(binding()));
    expect(result.current.status).toBe('loading');
    expect(result.current.messages).toBeUndefined();
    expect(result.current.state).toBeUndefined();
  });

  it('transitions to ready with messages + state on successful hydration', async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes('/api/sessions/')) {
        return Promise.resolve(new Response(
          JSON.stringify({ messages: [{ id: 'm1', role: 'user', content: 'hi' }], total: 1 }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ));
      }
      if (url.includes('/api/nolme/state/')) {
        return Promise.resolve(new Response(
          JSON.stringify({ schemaVersion: 1, phases: [{ id: 'p1' }] }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ));
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    const { result } = renderHook(() => useHydratedState(binding()));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.messages).toEqual([{ id: 'm1', role: 'user', content: 'hi' }]);
    expect(result.current.state).toEqual({
      schemaVersion: 1,
      phases: [{ id: 'p1', label: 'P1', title: 'P1', status: 'idle' }],
      currentPhaseIndex: 0,
      currentReviewLine: '',
      resources: [],
      profile: null,
      quickActions: [],
      taskNotifications: [],
    });
  });

  it('calls /api/sessions with the binding query params', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ messages: [] }), { status: 200 }));
    renderHook(() => useHydratedState(binding()));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const url = fetchMock.mock.calls[0][0];
    expect(url).toContain('/api/sessions/s-abc/messages');
    expect(url).toContain('provider=claude');
    expect(url).toContain('projectName=-home-x');
    expect(url).toContain('projectPath=%2Fhome%2Fx');
  });

  it('attaches Authorization: Bearer header from localStorage', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ messages: [] }), { status: 200 }));
    renderHook(() => useHydratedState(binding()));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const init = fetchMock.mock.calls[0][1];
    const headers = init?.headers as Headers;
    expect(headers.get('Authorization')).toBe('Bearer test-token');
  });

  it('transitions to error when the messages endpoint returns non-200', async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes('/api/sessions/')) {
        return Promise.resolve(new Response('nope', { status: 500 }));
      }
      return Promise.resolve(new Response(JSON.stringify({ schemaVersion: 1 }), { status: 200 }));
    });
    const { result } = renderHook(() => useHydratedState(binding()));
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.error).toBeDefined();
  });

  it('is a no-op when binding is null (status stays idle)', () => {
    const { result } = renderHook(() => useHydratedState(null));
    expect(result.current.status).toBe('idle');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('re-hydrates when the binding sessionId changes', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ messages: [] }), { status: 200 }));
    const { rerender } = renderHook(({ b }) => useHydratedState(b), {
      initialProps: { b: binding() as NolmeSessionBinding | null },
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const firstCalls = fetchMock.mock.calls.length;
    rerender({ b: { ...binding(), sessionId: 's-other' } });
    await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThan(firstCalls));
  });

  it('falls back to DEFAULT state when sidecar returns 404', async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes('/api/sessions/')) {
        return Promise.resolve(new Response(JSON.stringify({ messages: [] }), { status: 200 }));
      }
      return Promise.resolve(new Response('', { status: 404 }));
    });
    const { result } = renderHook(() => useHydratedState(binding()));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.state?.schemaVersion).toBe(1);
  });
});
