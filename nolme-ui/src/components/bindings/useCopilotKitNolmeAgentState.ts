import type { NolmeAgentStateLike } from '../../lib/types';
import { useAiWorkingProjection } from '../../hooks/useAiWorkingProjection';

export function useCopilotKitNolmeAgentState(): NolmeAgentStateLike {
  return useAiWorkingProjection().state;
}
