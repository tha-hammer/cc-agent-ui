import { useCopilotChat, useCopilotChatSuggestions } from '@copilotkit/react-core';
import { QuickActionChipRow } from '../QuickActionChipRow';
import { useCopilotKitNolmeAgentState } from './useCopilotKitNolmeAgentState';

/**
 * Quick-action chips driven by useCopilotChatSuggestions.
 *
 * The state.quickActions array (from the agent's setPhaseState tool calls)
 * provides the seed labels. useCopilotChatSuggestions is the v1 hook name in
 * @copilotkit/react-core@1.56.3 (plan referenced "useConfigureSuggestions" —
 * that name is the v2 alias and does not exist in v1).
 */
export function QuickActionChipRowBound() {
  const state = useCopilotKitNolmeAgentState();

  // Seed CopilotKit's suggestion engine with the agent's per-phase quick
  // actions; deps include currentPhaseIndex so suggestions regenerate on
  // phase advance.
  useCopilotChatSuggestions(
    {
      instructions: `Surface up to ${Math.max(3, state.quickActions.length)} short next-action suggestions for the operator. Prefer phase-relevant verbs.`,
      minSuggestions: Math.min(3, state.quickActions.length || 3),
      maxSuggestions: Math.max(3, state.quickActions.length),
    },
    [state.currentPhaseIndex, state.quickActions.join('')],
  );

  const { appendMessage } = useCopilotChat();

  const handleSelect = (label: string) => {
    void appendMessage({ role: 'user', content: label } as never);
  };

  return <QuickActionChipRow options={state.quickActions} onSelect={handleSelect} />;
}
