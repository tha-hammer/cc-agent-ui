import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';

// Hoisted mock tracking
const { copilotKitSpy, useCcuSessionMock, useHydratedStateMock } = vi.hoisted(() => ({
  copilotKitSpy: vi.fn(),
  useCcuSessionMock: vi.fn(),
  useHydratedStateMock: vi.fn(),
}));

vi.mock('@copilotkit/react-core', () => ({
  CopilotKit: (props: { children?: unknown }) => {
    copilotKitSpy(props);
    return props.children as React.ReactElement;
  },
}));

vi.mock('../../src/hooks/useCcuSession', () => ({
  useCcuSession: useCcuSessionMock,
}));

vi.mock('../../src/hooks/useHydratedState', () => ({
  useHydratedState: useHydratedStateMock,
}));

// NolmeDashboard exercises a chain of CopilotKit hooks (useFrontendTool /
// useHumanInTheLoop / useRenderToolCall / useCoAgent / useCopilotChat /
// useCopilotChatSuggestions). B15's contract is the CopilotKit provider wire,
// not the dashboard — stub the dashboard so the B15 assertions stay focused.
vi.mock('../../src/components/NolmeDashboard', () => ({
  NolmeDashboard: () => null,
}));

import { NolmeApp } from '../../src/NolmeApp';

const claudeBinding = {
  provider: 'claude' as const,
  sessionId: 's-1',
  projectName: '-x',
  projectPath: '/x',
};

const readyState = {
  status: 'ready' as const,
  messages: [],
  state: {
    schemaVersion: 1,
    phases: [],
    currentPhaseIndex: 0,
    currentReviewLine: '',
    resources: [],
    profile: null,
    quickActions: [],
    taskNotifications: [],
  },
};

describe('NolmeApp — CopilotKit provider wire (Phase 3 · B15)', () => {
  beforeEach(() => {
    copilotKitSpy.mockReset();
    useCcuSessionMock.mockReset();
    useHydratedStateMock.mockReset();
    localStorage.setItem('auth-token', 'jwt-abc');
  });

  it('renders "Pick a session" placeholder when binding is null', () => {
    useCcuSessionMock.mockReturnValue(null);
    useHydratedStateMock.mockReturnValue({ status: 'idle' });
    const { container } = render(<NolmeApp />);
    expect(container.textContent).toMatch(/no session|pick a session/i);
    expect(copilotKitSpy).not.toHaveBeenCalled();
  });

  it('renders a loading skeleton while hydration is in progress', () => {
    useCcuSessionMock.mockReturnValue(claudeBinding);
    useHydratedStateMock.mockReturnValue({ status: 'loading' });
    const { container } = render(<NolmeApp />);
    expect(container.textContent).toMatch(/loading|hydrat/i);
    expect(copilotKitSpy).not.toHaveBeenCalled();
  });

  it('renders an error placeholder when hydration fails', () => {
    useCcuSessionMock.mockReturnValue(claudeBinding);
    useHydratedStateMock.mockReturnValue({ status: 'error', error: new Error('down') });
    const { container } = render(<NolmeApp />);
    expect(container.textContent).toMatch(/error|failed|retry/i);
    expect(copilotKitSpy).not.toHaveBeenCalled();
  });

  it('wraps children in <CopilotKit> with runtimeUrl / agentId / threadId / updates when hydration is ready', async () => {
    useCcuSessionMock.mockReturnValue(claudeBinding);
    useHydratedStateMock.mockReturnValue(readyState);
    render(<NolmeApp />);
    await waitFor(() => expect(copilotKitSpy).toHaveBeenCalledTimes(1));
    const props = copilotKitSpy.mock.calls[0][0] as any;
    expect(props.runtimeUrl).toBe('/api/copilotkit');
    expect(props.agentId).toBe('ccu');
    expect(props.threadId).toBe('s-1');
    expect(props.updates).toBe(readyState.state);
  });

  it('forwards Authorization: Bearer <token> as headers from localStorage', () => {
    useCcuSessionMock.mockReturnValue(claudeBinding);
    useHydratedStateMock.mockReturnValue(readyState);
    render(<NolmeApp />);
    const props = copilotKitSpy.mock.calls[0][0] as any;
    expect(props.headers).toBeDefined();
    expect(props.headers.Authorization).toBe('Bearer jwt-abc');
  });

  it('omits Authorization header when localStorage has no auth-token', () => {
    localStorage.removeItem('auth-token');
    useCcuSessionMock.mockReturnValue(claudeBinding);
    useHydratedStateMock.mockReturnValue(readyState);
    render(<NolmeApp />);
    const props = copilotKitSpy.mock.calls[0][0] as any;
    expect(props.headers).toBeUndefined();
  });

  it('rebinds threadId when useCcuSession returns a new binding (live session switch)', () => {
    useCcuSessionMock.mockReturnValue(claudeBinding);
    useHydratedStateMock.mockReturnValue(readyState);
    const { rerender } = render(<NolmeApp />);
    expect((copilotKitSpy.mock.calls[0][0] as any).threadId).toBe('s-1');

    copilotKitSpy.mockClear();
    useCcuSessionMock.mockReturnValue({ ...claudeBinding, sessionId: 's-2' });
    rerender(<NolmeApp />);
    expect((copilotKitSpy.mock.calls[0][0] as any).threadId).toBe('s-2');
  });
});
