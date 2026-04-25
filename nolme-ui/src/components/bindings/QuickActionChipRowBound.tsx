import { useCopilotChat, useCopilotChatSuggestions } from '@copilotkit/react-core';
import { QuickActionChipRow } from '../QuickActionChipRow';
import { useCopilotKitNolmeAgentState } from './useCopilotKitNolmeAgentState';
import { useCcuSession } from '../../hooks/useCcuSession';
import { useAiWorkingActiveSkill } from '../../hooks/useAiWorkingActiveSkill';
import { projectSkillQuickActions } from './projectSkillQuickActions';

/**
 * Quick-action chips driven by useCopilotChatSuggestions.
 *
 * The state.quickActions array (from the agent's setPhaseState tool calls)
 * provides the seed labels. useCopilotChatSuggestions is the v1 hook name in
 * @copilotkit/react-core@1.56.3 (plan referenced "useConfigureSuggestions" —
 * that name is the v2 alias and does not exist in v1).
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

  // Seed CopilotKit's suggestion engine with the agent's per-phase quick
  // actions; deps include currentPhaseIndex so suggestions regenerate on
  // phase advance.
  useCopilotChatSuggestions(
    {
      instructions: `Surface up to ${Math.max(3, quickActions.length)} short next-action suggestions for the operator. Prefer active-skill context first, then phase-relevant verbs.`,
      minSuggestions: Math.min(3, quickActions.length || 3),
      maxSuggestions: Math.max(3, quickActions.length),
    },
    [
      state.currentPhaseIndex,
      quickActions.join(''),
      activeSkill?.commandName ?? '',
      activeSkill?.argsText ?? '',
      activeSkill?.updatedAt ?? 0,
    ],
  );

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
