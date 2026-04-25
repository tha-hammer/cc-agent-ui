import { WorkflowPhaseBarV2 } from '../WorkflowPhaseBar.v2';
import { useCopilotKitNolmeAgentState } from './useCopilotKitNolmeAgentState';

export function WorkflowPhaseBarBoundV2() {
  const state = useCopilotKitNolmeAgentState();
  return (
    <WorkflowPhaseBarV2
      phases={state.phases}
      currentPhaseIndex={state.currentPhaseIndex}
      currentReviewLine={state.currentReviewLine}
    />
  );
}
