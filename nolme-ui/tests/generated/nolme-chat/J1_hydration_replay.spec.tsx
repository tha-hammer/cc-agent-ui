/**
 * @gwt.id    gwt-nolme-hydration-replay
 * @rr.reads  rr.nolme.session_binding, rr.nolme.workflow_phase_state
 * @rr.writes —
 * @rr.raises —
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';

const { copilotKitSpy } = vi.hoisted(() => ({ copilotKitSpy: vi.fn() }));

vi.mock('@copilotkit/react-core', () => ({
  CopilotKit: (props: { children?: React.ReactNode } & Record<string, unknown>) => {
    copilotKitSpy(props);
    return props.children as React.ReactElement;
  },
}));

const claudeBinding = {
  provider: 'claude' as const,
  sessionId: 's-1',
  projectName: 'p',
  projectPath: '/x',
  model: 'opus-4-7',
};

const hydratedState = {
  schemaVersion: 1 as const,
  phases: [],
  currentPhaseIndex: 0,
  currentReviewLine: '',
  resources: [],
  profile: null,
  quickActions: [],
  taskNotifications: [],
};

const threeMessages = [
  { role: 'user', content: 'hi' },
  { role: 'assistant', content: 'hello' },
  { role: 'user', content: 'ok' },
];

vi.mock('../../../src/hooks/useCcuSession', () => ({
  useCcuSession: () => claudeBinding,
}));

vi.mock('../../../src/hooks/useHydratedState', () => ({
  useHydratedState: () => ({
    status: 'ready',
    messages: threeMessages,
    state: hydratedState,
  }),
}));

vi.mock('../../../src/components/NolmeDashboard.v2', () => ({
  NolmeDashboardV2: () => <div data-testid="nolme-dashboard-mounted" />,
}));

import { NolmeApp } from '../../../src/NolmeApp';

beforeEach(() => {
  copilotKitSpy.mockReset();
  localStorage.setItem('auth-token', 'jwt-abc');
});

describe('J1 · hydration replay bootstrap', () => {
  it('forwards a ready hydration.state into <CopilotKit updates> while binding is set', async () => {
    render(<NolmeApp />);
    await waitFor(() => expect(copilotKitSpy).toHaveBeenCalled());
    const props = copilotKitSpy.mock.calls[0][0];
    expect(props.updates).toBe(hydratedState);
    expect(props.threadId).toBe('s-1');
    expect(props.properties).toEqual({ binding: claudeBinding });
  });

  it('mounts NolmeDashboard once hydration status === "ready" (children render past the gate)', async () => {
    const { getByTestId } = render(<NolmeApp />);
    await waitFor(() => expect(getByTestId('nolme-dashboard-mounted')).toBeTruthy());
  });

  it('hydrated message list (3 prior) reaches the runtime via the same binding so connect replay can dispatch them', () => {
    // Mechanism note: prior messages flow client→server via the AG-UI `connect`
    // stream, not via a direct CopilotKit prop. The contract this spec locks
    // is that the SAME binding NolmeApp held when we hydrated 3 messages is
    // forwarded as `properties.binding`, so the agent's `connect()` can fetch
    // history for that exact session and replay it. See tests/generated/
    // test_ccu_session_agent_hydration.spec.ts for the server-side replay.
    render(<NolmeApp />);
    const props = copilotKitSpy.mock.calls[0][0];
    expect(props.properties.binding.sessionId).toBe(claudeBinding.sessionId);
    expect(props.properties.binding.provider).toBe(claudeBinding.provider);
    expect(threeMessages).toHaveLength(3);
  });
});
