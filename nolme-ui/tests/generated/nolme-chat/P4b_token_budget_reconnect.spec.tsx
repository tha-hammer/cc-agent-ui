import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

import { useAiWorkingTokenBudget } from '../../../src/hooks/useAiWorkingTokenBudget';

describe('P4b · token budget reconnect reconciliation', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    (globalThis as any).fetch = fetchMock;
    localStorage.setItem('auth-token', 'jwt-abc');
  });

  it('renders persisted state immediately and reconciles to the route response', async () => {
    let resolveFetch!: (response: Response) => void;
    fetchMock.mockImplementation(() => new Promise((resolve) => {
      resolveFetch = resolve;
    }));

    const binding = {
      provider: 'claude',
      sessionId: 's-1',
      projectName: '-home-demo',
      projectPath: '/home/demo',
    } as const;

    const { result } = renderHook(() => useAiWorkingTokenBudget(binding, {
      provider: 'claude',
      source: 'persisted',
      used: 60,
      total: 200,
      updatedAt: 1,
    }));

    expect(result.current).toEqual(
      expect.objectContaining({
        source: 'persisted',
        supported: true,
        usedPercent: 30,
      }),
    );

    resolveFetch(new Response(JSON.stringify({
      used: 100,
      total: 200,
    }), { status: 200 }));

    await waitFor(() => expect(result.current?.source).toBe('route'));
    expect(result.current).toEqual(
      expect.objectContaining({
        used: 100,
        total: 200,
        remaining: 100,
        usedPercent: 50,
      }),
    );
  });
});
