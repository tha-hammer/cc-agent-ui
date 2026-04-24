import { SkillChips } from '../SkillChips';
import { useCopilotKitNolmeAgentState } from './useCopilotKitNolmeAgentState';

export function SkillChipsBound() {
  const state = useCopilotKitNolmeAgentState();
  if (!state.profile) return null;
  return <SkillChips skills={state.profile.skills} />;
}
