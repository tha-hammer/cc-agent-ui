import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSessionBroadcast } from '../../src/hooks/useSessionBroadcast';

class FakeBroadcastChannel {
  static lastInstance: FakeBroadcastChannel | null = null;
  name: string;
  messages: unknown[] = [];
  closed = false;

  constructor(name: string) {
    this.name = name;
    FakeBroadcastChannel.lastInstance = this;
  }
  postMessage(msg: unknown) {
    this.messages.push(msg);
  }
  close() {
    this.closed = true;
  }
  addEventListener() {}
  removeEventListener() {}
}

const claudeProject = { name: '-home-tmp-proj', fullPath: '/home/tmp/proj', displayName: 'proj' } as any;
const claudeSession = { id: 's-claude', __provider: 'claude' as const } as any;
const codexProject = { name: '-home-code', fullPath: '/home/code', displayName: 'c' } as any;
const codexSession = { id: 's-codex', __provider: 'codex' as const } as any;
const toolsSettings = { allowedTools: ['Read'], disallowedTools: [], skipPermissions: false };

describe('useSessionBroadcast (Phase 2 · B13)', () => {
  beforeEach(() => {
    FakeBroadcastChannel.lastInstance = null;
    (globalThis as any).BroadcastChannel = FakeBroadcastChannel;
  });
  afterEach(() => {
    delete (globalThis as any).BroadcastChannel;
  });

  it('posts full NolmeSessionBinding on mount when a session is selected', () => {
    renderHook(() =>
      useSessionBroadcast(claudeProject, claudeSession, 'claude', 'claude-sonnet-4-6', 'default', toolsSettings),
    );
    const ch = FakeBroadcastChannel.lastInstance!;
    expect(ch).not.toBeNull();
    expect(ch.name).toBe('ccu-session');
    expect(ch.messages).toHaveLength(1);
    const msg = ch.messages[0] as any;
    expect(msg).toMatchObject({
      provider: 'claude',
      sessionId: 's-claude',
      projectName: '-home-tmp-proj',
      projectPath: '/home/tmp/proj',
      model: 'claude-sonnet-4-6',
      permissionMode: 'default',
      toolsSettings,
    });
    expect(typeof msg.timestamp).toBe('number');
  });

  it('reads provider from selectedSession.__provider when present (overrides prop)', () => {
    renderHook(() =>
      useSessionBroadcast(codexProject, codexSession, 'claude' /* prop ignored */, 'm', 'default', toolsSettings),
    );
    const msg = FakeBroadcastChannel.lastInstance!.messages[0] as any;
    expect(msg.provider).toBe('codex');
  });

  it('is a no-op when selectedSession is null (no channel created)', () => {
    renderHook(() =>
      useSessionBroadcast(claudeProject, null, 'claude', 'm', 'default', toolsSettings),
    );
    expect(FakeBroadcastChannel.lastInstance).toBeNull();
  });

  it('is a no-op when selectedProject is null', () => {
    renderHook(() =>
      useSessionBroadcast(null, claudeSession, 'claude', 'm', 'default', toolsSettings),
    );
    expect(FakeBroadcastChannel.lastInstance).toBeNull();
  });

  it('is a no-op when BroadcastChannel is undefined (old browser)', () => {
    delete (globalThis as any).BroadcastChannel;
    expect(() =>
      renderHook(() =>
        useSessionBroadcast(claudeProject, claudeSession, 'claude', 'm', 'default', toolsSettings),
      ),
    ).not.toThrow();
  });

  it('closes the channel on unmount', () => {
    const { unmount } = renderHook(() =>
      useSessionBroadcast(claudeProject, claudeSession, 'claude', 'm', 'default', toolsSettings),
    );
    const ch = FakeBroadcastChannel.lastInstance!;
    expect(ch.closed).toBe(false);
    unmount();
    expect(ch.closed).toBe(true);
  });

  it('falls back to projectPath="" when project has no fullPath or path', () => {
    const sparseProject = { name: '-x', displayName: 'x' } as any;
    renderHook(() =>
      useSessionBroadcast(sparseProject, claudeSession, 'claude', 'm', 'default', toolsSettings),
    );
    const msg = FakeBroadcastChannel.lastInstance!.messages[0] as any;
    expect(msg.projectPath).toBe('');
  });

  it('prefers project.fullPath over project.path when both are set', () => {
    const dualPath = { name: '-x', fullPath: '/abs/from/fullPath', path: '/abs/from/path', displayName: 'x' } as any;
    renderHook(() =>
      useSessionBroadcast(dualPath, claudeSession, 'claude', 'm', 'default', toolsSettings),
    );
    const msg = FakeBroadcastChannel.lastInstance!.messages[0] as any;
    expect(msg.projectPath).toBe('/abs/from/fullPath');
  });
});
