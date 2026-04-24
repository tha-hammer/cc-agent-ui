import { IntegrationsRow } from '../IntegrationsRow';
import { useCopilotKitNolmeAgentState } from './useCopilotKitNolmeAgentState';

export function IntegrationsRowBound() {
  const state = useCopilotKitNolmeAgentState();
  if (!state.profile) return null;
  return <IntegrationsRow integrations={state.profile.integrations} />;
}
