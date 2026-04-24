import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

class FakeBroadcastChannel {
  static lastInstance: FakeBroadcastChannel | null = null;
  name: string;
  onmessage: ((ev: { data: unknown }) => void) | null = null;
  closed = false;
  constructor(name: string) {
    this.name = name;
    FakeBroadcastChannel.lastInstance = this;
  }
  postMessage() {}
  close() { this.closed = true; }
  addEventListener() {}
  removeEventListener() {}
}

function setUrl(search: string) {
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: new URL(`http://localhost/nolme/${search ? '?' + search : ''}`),
  });
}

import { useCcuSession } from '../../src/hooks/useCcuSession';

describe('useCcuSession (Phase 3 · B17)', () => {
  let originalLocation: Location;

  beforeEach(() => {
    originalLocation = window.location;
    FakeBroadcastChannel.lastInstance = null;
    (globalThis as any).BroadcastChannel = FakeBroadcastChannel;
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
    delete (globalThis as any).BroadcastChannel;
  });

  it('parses full binding from URL query params on mount', () => {
    setUrl('provider=claude&sessionId=s-1&projectName=-home-x&projectPath=/home/x&model=opus-4');
    const { result } = renderHook(() => useCcuSession());
    expect(result.current).toEqual({
      provider: 'claude',
      sessionId: 's-1',
      projectName: '-home-x',
      projectPath: '/home/x',
      model: 'opus-4',
    });
  });

  it('parses optional permissionMode and toolsSettings fields when present', () => {
    setUrl(
      'provider=codex&sessionId=s-2&projectName=-p&projectPath=/p&permissionMode=acceptEdits&skipPermissions=1',
    );
    const { result } = renderHook(() => useCcuSession());
    expect(result.current?.permissionMode).toBe('acceptEdits');
    expect(result.current?.toolsSettings?.skipPermissions).toBe(true);
  });

  it('returns null when sessionId is missing from URL', () => {
    setUrl('provider=claude&projectName=-x&projectPath=/x');
    const { result } = renderHook(() => useCcuSession());
    expect(result.current).toBeNull();
  });

  it('returns null when provider is invalid', () => {
    setUrl('provider=novel&sessionId=s&projectName=-x&projectPath=/x');
    const { result } = renderHook(() => useCcuSession());
    expect(result.current).toBeNull();
  });

  it('returns null when projectPath is missing', () => {
    setUrl('provider=claude&sessionId=s&projectName=-x');
    const { result } = renderHook(() => useCcuSession());
    expect(result.current).toBeNull();
  });

  it('replaces the binding when BroadcastChannel posts a new NolmeSessionBinding', async () => {
    setUrl('provider=claude&sessionId=s-initial&projectName=-x&projectPath=/x');
    const { result } = renderHook(() => useCcuSession());
    expect(result.current?.sessionId).toBe('s-initial');

    const ch = FakeBroadcastChannel.lastInstance!;
    await act(async () => {
      ch.onmessage?.({ data: {
        provider: 'cursor',
        sessionId: 's-new',
        projectName: '-new',
        projectPath: '/new',
        model: 'm2',
        timestamp: Date.now(),
      } });
    });
    expect(result.current?.sessionId).toBe('s-new');
    expect(result.current?.provider).toBe('cursor');
  });

  it('ignores BroadcastChannel payloads that fail validation', async () => {
    setUrl('provider=claude&sessionId=s-initial&projectName=-x&projectPath=/x');
    const { result } = renderHook(() => useCcuSession());

    const ch = FakeBroadcastChannel.lastInstance!;
    await act(async () => {
      ch.onmessage?.({ data: { provider: 'bogus', sessionId: '', projectName: '', projectPath: '' } });
    });
    expect(result.current?.sessionId).toBe('s-initial');
  });

  it('closes the BroadcastChannel on unmount', () => {
    setUrl('provider=claude&sessionId=s&projectName=-x&projectPath=/x');
    const { unmount } = renderHook(() => useCcuSession());
    const ch = FakeBroadcastChannel.lastInstance!;
    expect(ch.closed).toBe(false);
    unmount();
    expect(ch.closed).toBe(true);
  });

  it('works when BroadcastChannel is undefined (initial URL only, no live update)', () => {
    delete (globalThis as any).BroadcastChannel;
    setUrl('provider=gemini&sessionId=g-1&projectName=-g&projectPath=/g');
    const { result } = renderHook(() => useCcuSession());
    expect(result.current?.provider).toBe('gemini');
  });
});
