import { AgentNavRailV2 } from './AgentNavRail.v2';
import { DeliverablesRailBoundV2 } from './bindings/DeliverablesRailBound.v2';
import { WorkflowPhaseBarBoundV2 } from './bindings/WorkflowPhaseBarBound.v2';
import { NolmeChatBound } from './bindings/NolmeChatBound';
import { useNolmeRegistrations } from './bindings/useNolmeRegistrations.v2';

export function NolmeDashboardV2() {
  useNolmeRegistrations();
  return (
    <div
      data-testid="nolme-dashboard-v2"
      className="nolme-root grid h-dvh overflow-hidden grid-cols-[88px_minmax(0,1fr)_360px] bg-nolme-purple-100 text-nolme-neutral-800"
    >
      <AgentNavRailV2 />
      <main className="flex min-w-0 min-h-0 flex-col gap-[10px] overflow-hidden bg-nolme-neutral-200 px-[24px] pb-[24px] pt-[16px]">
        <div className="flex min-h-0 flex-1 flex-col items-center overflow-hidden">
          <div className="flex w-[1008px] max-w-full min-h-0 flex-1 flex-col gap-[10px] overflow-hidden">
            <NolmeChatBound />
          </div>
        </div>
      </main>
      <aside className="flex min-h-0 flex-col gap-[10px] overflow-y-auto bg-white px-[24px] pb-[24px] pt-0">
        <WorkflowPhaseBarBoundV2 />
        <DeliverablesRailBoundV2 />
      </aside>
    </div>
  );
}
