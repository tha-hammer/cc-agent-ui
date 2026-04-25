import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

class FakeBroadcastChannel {
  static lastInstance: FakeBroadcastChannel | null = null;
  name: string;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  closed = false;

  constructor(name: string) {
    this.name = name;
    FakeBroadcastChannel.lastInstance = this;
  }

  close() {
    this.closed = true;
  }
}

import { ACTIVE_SKILL_STORAGE_KEY } from '../../../../src/hooks/useActiveSkillBroadcast';
import { useAiWorkingActiveSkill } from '../../../src/hooks/useAiWorkingActiveSkill';

const boundSkill = {
  provider: 'claude' as const,
  sessionId: 'session-1',
  projectPath: '/workspace/demo-project',
  commandName: '/cs',
  argsText: 'token budget drift',
  metadata: { description: 'Search prior work to add context.' },
  updatedAt: 100,
};

describe('P5 · useAiWorkingActiveSkill', () => {
  beforeEach(() => {
    localStorage.clear();
    FakeBroadcastChannel.lastInstance = null;
    vi.stubGlobal('BroadcastChannel', FakeBroadcastChannel as unknown as typeof BroadcastChannel);
  });

  it('hydrates the matching active skill from persisted storage and isolates by identity', () => {
    localStorage.setItem(
      ACTIVE_SKILL_STORAGE_KEY,
      JSON.stringify({
        first: boundSkill,
        second: {
          ...boundSkill,
          sessionId: 'session-2',
          argsText: 'other session',
        },
      }),
    );

    const { result, rerender } = renderHook(
      ({ binding }: { binding: any }) => useAiWorkingActiveSkill(binding),
      {
        initialProps: {
          binding: {
            provider: 'claude',
            sessionId: 'session-1',
            projectName: 'demo-project',
            projectPath: '/workspace/demo-project',
          },
        },
      },
    );

    expect(result.current).toEqual(boundSkill);

    rerender({
      binding: {
        provider: 'claude',
        sessionId: 'session-3',
        projectName: 'demo-project',
        projectPath: '/workspace/demo-project',
      },
    });

    expect(result.current).toBeNull();
  });

  it('accepts matching broadcast updates and ignores other-session payloads', async () => {
    const binding = {
      provider: 'claude' as const,
      sessionId: 'session-1',
      projectName: 'demo-project',
      projectPath: '/workspace/demo-project',
    };

    const { result, unmount } = renderHook(() => useAiWorkingActiveSkill(binding));
    expect(result.current).toBeNull();

    const channel = FakeBroadcastChannel.lastInstance!;
    await act(async () => {
      channel.onmessage?.({
        data: {
          type: 'active-skill-update',
          context: {
            ...boundSkill,
            sessionId: 'session-2',
          },
        },
      });
    });
    expect(result.current).toBeNull();

    await act(async () => {
      channel.onmessage?.({
        data: {
          type: 'active-skill-update',
          context: boundSkill,
        },
      });
    });
    expect(result.current).toEqual(boundSkill);

    unmount();
    expect(channel.closed).toBe(true);
  });
});
