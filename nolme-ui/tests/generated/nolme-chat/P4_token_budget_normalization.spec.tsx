import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

import { useAiWorkingTokenBudget } from '../../../src/hooks/useAiWorkingTokenBudget';

function binding(provider: 'claude' | 'codex' | 'cursor' | 'gemini') {
  return {
    provider,
    sessionId: 's-1',
    projectName: '-home-demo',
    projectPath: '/home/demo',
  } as const;
}

describe('P4 · useAiWorkingTokenBudget', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    (globalThis as any).fetch = fetchMock;
    localStorage.setItem('auth-token', 'jwt-abc');
  });

  it('normalizes Claude route payloads into the canonical shape', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      used: 120,
      total: 200,
      breakdown: { input: 60, output: 30, cacheRead: 20, cacheCreation: 10 },
    }), { status: 200 }));

    const { result } = renderHook(() => useAiWorkingTokenBudget(binding('claude'), null));

    await waitFor(() => expect(result.current?.source).toBe('route'));
    expect(result.current).toEqual(
      expect.objectContaining({
        provider: 'claude',
        source: 'route',
        supported: true,
        used: 120,
        total: 200,
        remaining: 80,
        usedPercent: 60,
        remainingPercent: 40,
      }),
    );
  });

  it('normalizes unsupported providers without faking zero usage as a real budget', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      unsupported: true,
      message: 'Token usage tracking not available for Cursor sessions',
    }), { status: 200 }));

    const { result } = renderHook(() => useAiWorkingTokenBudget(binding('cursor'), null));

    await waitFor(() => expect(result.current?.source).toBe('route'));
    expect(result.current).toEqual(
      expect.objectContaining({
        provider: 'cursor',
        source: 'route',
        supported: false,
        used: null,
        total: null,
        remaining: null,
        usedPercent: 0,
        remainingPercent: 0,
      }),
    );
  });

  it('prefers live state over the fetched route value', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      used: 40,
      total: 200,
    }), { status: 200 }));

    const { result, rerender } = renderHook(
      ({ raw }) => useAiWorkingTokenBudget(binding('codex'), raw),
      { initialProps: { raw: null as unknown } },
    );

    await waitFor(() => expect(result.current?.usedPercent).toBe(20));

    rerender({
      raw: {
        provider: 'codex',
        source: 'live',
        used: 150,
        total: 200,
      },
    });

    await waitFor(() => expect(result.current?.source).toBe('live'));
    expect(result.current).toEqual(
      expect.objectContaining({
        provider: 'codex',
        source: 'live',
        supported: true,
        used: 150,
        total: 200,
        remaining: 50,
        usedPercent: 75,
        remainingPercent: 25,
      }),
    );
  });
});
