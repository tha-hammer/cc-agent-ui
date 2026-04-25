import { beforeEach, describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSessionBroadcast } from '../../src/hooks/useSessionBroadcast';
import {
  makeActiveSkillIdentityKey,
  normalizeActiveSkillContext,
} from '../../src/hooks/useActiveSkillBroadcast';

class FakeBroadcastChannel {
  static lastInstance: FakeBroadcastChannel | null = null;
  name: string;
  messages: unknown[] = [];

  constructor(name: string) {
    this.name = name;
    FakeBroadcastChannel.lastInstance = this;
  }

  postMessage(message: unknown) {
    this.messages.push(message);
  }

  close() {}
}

describe('ai-working identity binding (cam-at7)', () => {
  beforeEach(() => {
    FakeBroadcastChannel.lastInstance = null;
    (globalThis as any).BroadcastChannel = FakeBroadcastChannel;
  });

  it('broadcasts a session binding with projectPath even when the project only exposes path', () => {
    renderHook(() =>
      useSessionBroadcast(
        {
          name: '-workspace-demo-project',
          path: '/workspace/demo-project',
          displayName: 'demo-project',
        } as any,
        {
          id: 'session-1',
          __provider: 'claude',
        } as any,
        'claude',
        'claude-sonnet-4-6',
        'default',
        { allowedTools: [], disallowedTools: [], skipPermissions: false },
      ),
    );

    expect(FakeBroadcastChannel.lastInstance?.messages[0]).toMatchObject({
      provider: 'claude',
      sessionId: 'session-1',
      projectPath: '/workspace/demo-project',
    });
  });

  it('requires projectPath for active skill payloads and keys identities by the full tuple', () => {
    expect(
      normalizeActiveSkillContext({
        provider: 'claude',
        sessionId: 'session-1',
        commandName: '/cs',
        argsText: 'token budget drift',
        updatedAt: 99,
      }),
    ).toBeNull();

    expect(
      makeActiveSkillIdentityKey({
        provider: 'claude',
        sessionId: 'session-1',
        projectPath: '/workspace/demo-a',
      }),
    ).not.toBe(
      makeActiveSkillIdentityKey({
        provider: 'claude',
        sessionId: 'session-1',
        projectPath: '/workspace/demo-b',
      }),
    );
  });
});
