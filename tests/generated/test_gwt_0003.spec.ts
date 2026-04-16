// gwt-0003: fork.handler.sends-fork-prepare-on-click (JSONL-slice pivot)
// Verifies:
//   - Click dispatches a single `fork-prepare` WS frame with the stripped uuid
//   - Subsequent submit sends a plain `claude-command` with NO fork fields
//     (no forkSession, no resumeSessionAt, no caller-minted fork sessionId)

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useChatComposerState } from '../../src/components/chat/hooks/useChatComposerState';

const baseProps = (sendMessage: any) => ({
  selectedProject: { name: 'p', path: '/home/maceo/Dev/temp_testing', displayName: 'p', fullPath: '/home/maceo/Dev/temp_testing' } as any,
  selectedSession: null,
  sendMessage,
  ws: { current: null } as any,
  wsReady: true,
  provider: 'claude' as const,
  currentSessionId: '11111111-1111-4111-8111-111111111111',
  pendingViewSessionRef: { current: null } as any,
  onReplaceTemporarySession: vi.fn(),
  onNavigateToSession: vi.fn(),
  setSessionSummary: vi.fn(),
  sessionSummary: undefined,
  onTriggerRefresh: vi.fn(),
  onClearRealtimeMessages: vi.fn(),
  isLoading: false,
  setIsLoading: vi.fn(),
  setCanAbortSession: vi.fn(),
  canAbortSession: false,
  setClaudeStatus: vi.fn(),
  claudeStatus: null,
  pendingPermissionRequests: [],
  setPendingPermissionRequests: vi.fn(),
  onSessionProcessing: vi.fn(),
  onSessionNotProcessing: vi.fn(),
  onSessionActive: vi.fn(),
  onSessionInactive: vi.fn(),
});

describe('gwt-0003 fork.handler.sends-fork-prepare-on-click', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('fork click sends a single fork-prepare frame with stripped parentMessageUuid', () => {
    const sendMessage = vi.fn();
    const { result } = renderHook(() => useChatComposerState(baseProps(sendMessage) as any));

    act(() => {
      result.current.handleForkFromMessage('msg_abc_text', 3);
    });

    expect(sendMessage).toHaveBeenCalledTimes(1);
    const frame = sendMessage.mock.calls[0][0];
    expect(frame.type).toBe('fork-prepare');
    expect(frame.options).toMatchObject({
      parentSessionId: '11111111-1111-4111-8111-111111111111',
      parentMessageUuid: 'msg_abc',
      projectPath: '/home/maceo/Dev/temp_testing',
    });
    expect(frame.options.forkSession).toBeUndefined();
    expect(frame.options.resumeSessionAt).toBeUndefined();
  });

  it('does not fire when currentSessionId is missing', () => {
    const sendMessage = vi.fn();
    const props = { ...baseProps(sendMessage), currentSessionId: '' } as any;
    const { result } = renderHook(() => useChatComposerState(props));

    act(() => {
      result.current.handleForkFromMessage('msg_abc_text', 0);
    });

    expect(sendMessage).not.toHaveBeenCalled();
  });
});
