import { ResourcesRail } from '../ResourcesRail';
import { useCopilotKitNolmeAgentState } from './useCopilotKitNolmeAgentState';

export function ResourcesRailBound() {
  const state = useCopilotKitNolmeAgentState();
  return <ResourcesRail resources={state.resources} collapsible />;
}
