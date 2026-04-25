import { UsageCardV2 } from '../UsageCard.v2';
import { useCopilotKitNolmeAgentState } from './useCopilotKitNolmeAgentState';
import { useCcuSession } from '../../hooks/useCcuSession';
import { useAiWorkingTokenBudget } from '../../hooks/useAiWorkingTokenBudget';

export function UsageCardBoundV2() {
  const state = useCopilotKitNolmeAgentState();
  const binding = useCcuSession();
  const rawTokenBudget = (state as typeof state & { tokenBudget?: unknown }).tokenBudget;
  const tokenBudget = useAiWorkingTokenBudget(binding, rawTokenBudget);
  const percent = tokenBudget?.supported ? tokenBudget.usedPercent : 0;
  return <UsageCardV2 percent={percent} />;
}
