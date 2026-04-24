/**
 * NolmeDashboard — composes the bound rail components inside the CopilotKit
 * provider. NolmeApp renders this once provider is ready; useNolmeRegistrations
 * is mounted at the top so all frontend tools are registered before the agent
 * issues any tool call.
 */
import { AgentNavRail } from './AgentNavRail';
import { WorkflowPhaseBarBound } from './bindings/WorkflowPhaseBarBound';
import { AgentProfileCardBound } from './bindings/AgentProfileCardBound';
import { SkillChipsBound } from './bindings/SkillChipsBound';
import { IntegrationsRowBound } from './bindings/IntegrationsRowBound';
import { ResourcesRailBound } from './bindings/ResourcesRailBound';
import { QuickActionChipRowBound } from './bindings/QuickActionChipRowBound';
import { useNolmeRegistrations } from './bindings/useNolmeRegistrations';

export function NolmeDashboard() {
  useNolmeRegistrations();
  return (
    <div className="nolme-root grid min-h-dvh grid-cols-[64px_minmax(0,1fr)_280px] gap-3 bg-[radial-gradient(circle_at_top_left,_#ffffff_0%,_#f5f1ff_38%,_#ebe9ff_100%)] p-3 text-nolme-neutral-800">
      <AgentNavRail />
      <main className="flex min-w-0 flex-col gap-3 rounded-[22px] border border-nolme-purple-200 bg-[#f0f0f5] p-3 shadow-[0_28px_90px_rgba(60,46,184,0.12)]">
        <WorkflowPhaseBarBound />
        <section className="flex flex-1 flex-col gap-3 rounded-[20px] border border-nolme-purple-200 bg-white p-4">
          <p className="text-[14px] text-nolme-neutral-600">Chat column placeholder — wiring lives here.</p>
          <QuickActionChipRowBound />
        </section>
      </main>
      <aside className="flex flex-col gap-3">
        <AgentProfileCardBound />
        <SkillChipsBound />
        <IntegrationsRowBound />
        <ResourcesRailBound />
      </aside>
    </div>
  );
}
