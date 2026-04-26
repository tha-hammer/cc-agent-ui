import { useCopilotChat } from '@copilotkit/react-core';
import { QuickActionChipRow } from '../QuickActionChipRow';
import { useCopilotKitNolmeAgentState } from './useCopilotKitNolmeAgentState';
import { useCcuSession } from '../../hooks/useCcuSession';
import { useAiWorkingActiveSkill } from '../../hooks/useAiWorkingActiveSkill';
import { projectSkillQuickActions } from './projectSkillQuickActions';

/**
 * Quick-action chips driven entirely by projected Nolme state.
 *
 * Nolme already projects explicit next actions into agent state. Registering
 * CopilotKit's suggestion engine here would trigger extra background reloads
 * and can launch unintended agent runs against the bound session.
 */
export function QuickActionChipRowBound(props: {
  onSubmitPrompt?: (text: string) => void;
}) {
  const state = useCopilotKitNolmeAgentState();
  const binding = useCcuSession();
  const activeSkill = useAiWorkingActiveSkill(binding);
  const quickActions = projectSkillQuickActions({
    activeSkill,
    explicitQuickActions: state.quickActions,
    phases: state.phases,
    currentPhaseIndex: state.currentPhaseIndex,
  });

  const { appendMessage } = useCopilotChat();

  const handleSelect = (label: string) => {
    if (props.onSubmitPrompt) {
      props.onSubmitPrompt(label);
      return;
    }
    void appendMessage({ role: 'user', content: label } as never);
  };

  return <QuickActionChipRow options={quickActions} onSelect={handleSelect} />;
}
