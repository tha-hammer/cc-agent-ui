import { AgentProfileCardV2 } from '../AgentProfileCard.v2';
import { useCopilotKitNolmeAgentState } from './useCopilotKitNolmeAgentState';

export function AgentProfileCardBoundV2() {
  const state = useCopilotKitNolmeAgentState();
  if (!state.profile) return null;
  return <AgentProfileCardV2 profile={state.profile} />;
}
