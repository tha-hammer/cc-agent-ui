/**
 * @gwt.id    gwt-nolme-binding-contract-client
 * @rr.reads  rr.nolme.session_binding, rr.nolme.copilotkit_properties
 * @rr.writes —
 * @rr.raises —
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';

const { CopilotKitSpy } = vi.hoisted(() => ({ CopilotKitSpy: vi.fn() }));

vi.mock('@copilotkit/react-core', () => ({
  CopilotKit: (props: { children?: React.ReactNode } & Record<string, unknown>) => {
    CopilotKitSpy(props);
    return props.children as React.ReactElement;
  },
  useCopilotChat: () => ({ appendMessage: vi.fn() }),
}));

const readyBinding = {
  provider: 'claude' as const,
  sessionId: 's-1',
  projectName: 'p',
  projectPath: '/x',
  model: 'opus-4-7',
};

vi.mock('../../../src/hooks/useCcuSession', () => ({
  useCcuSession: () => readyBinding,
}));

vi.mock('../../../src/hooks/useHydratedState', () => ({
  useHydratedState: () => ({
    status: 'ready',
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
  }),
}));

vi.mock('../../../src/components/NolmeDashboard.v2', () => ({
  NolmeDashboardV2: () => null,
}));

import { NolmeApp } from '../../../src/NolmeApp';

describe('P0 · NolmeApp forwards binding via CopilotKit properties', () => {
  beforeEach(() => {
    CopilotKitSpy.mockReset();
  });

  it('passes properties={{ binding }} to <CopilotKit>', async () => {
    render(<NolmeApp />);
    await waitFor(() => expect(CopilotKitSpy).toHaveBeenCalled());
    const props = CopilotKitSpy.mock.calls[0][0] as { properties?: { binding?: unknown } };
    expect(props.properties).toBeDefined();
    expect(props.properties?.binding).toEqual(readyBinding);
  });
});
