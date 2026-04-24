import { WorkflowPhaseBar } from '../WorkflowPhaseBar';
import { useCopilotKitNolmeAgentState } from './useCopilotKitNolmeAgentState';

export function WorkflowPhaseBarBound() {
  const state = useCopilotKitNolmeAgentState();
  return <WorkflowPhaseBar phases={state.phases} currentReviewLine={state.currentReviewLine} />;
}
