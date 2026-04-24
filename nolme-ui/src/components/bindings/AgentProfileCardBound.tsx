import { AgentProfileCard } from '../AgentProfileCard';
import { useCopilotKitNolmeAgentState } from './useCopilotKitNolmeAgentState';

export function AgentProfileCardBound() {
  const state = useCopilotKitNolmeAgentState();
  if (!state.profile) return null;
  return <AgentProfileCard profile={state.profile} />;
}
