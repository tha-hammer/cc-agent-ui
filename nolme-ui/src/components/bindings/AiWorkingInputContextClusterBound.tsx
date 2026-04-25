import { AgentProfileCardBoundV2 } from './AgentProfileCardBound.v2';
import { UsageCardBoundV2 } from './UsageCardBound.v2';

export function AiWorkingInputContextClusterBound() {
  return (
    <div
      data-testid="ai-working-input-context-cluster"
      className="flex w-[198px] shrink-0 flex-col justify-center gap-[6px]"
    >
      <AgentProfileCardBoundV2 />
      <UsageCardBoundV2 />
    </div>
  );
}
