/**
 * Centralized read of the live NolmeAgentState from CopilotKit's CoAgent layer.
 *
 * @copilotkit/react-core@1.56.3 exposes `useCoAgent({ name })` which returns a
 * reactive { state } slice for the named agent. Our agent id is "ccu" — set
 * server-side in server/routes/copilotkit.js via CopilotRuntime({ agents }).
 */
import { useCoAgent } from '@copilotkit/react-core';
import { DEFAULT_NOLME_AGENT_STATE, type NolmeAgentState } from '../../lib/types';

export function useCopilotKitNolmeAgentState(): NolmeAgentState {
  // useCoAgent returns { state } — typed as Record<string, any>; we narrow to
  // NolmeAgentState and fall back to defaults so the bound components never
  // see undefined slices.
  const { state } = useCoAgent<Partial<NolmeAgentState>>({
    name: 'ccu',
    initialState: DEFAULT_NOLME_AGENT_STATE,
  });
  return {
    ...DEFAULT_NOLME_AGENT_STATE,
    ...(state ?? {}),
  } as NolmeAgentState;
}
