import { DeliverablesRailV2, type DeliverableItem } from '../DeliverablesRail.v2';
import { useCopilotKitNolmeAgentState } from './useCopilotKitNolmeAgentState';

const PHASE_FROM_BADGE: Record<string, DeliverableItem['phase']> = {
  P1: 'P1',
  P2: 'P2',
  P3: 'P3',
  P4: 'P4',
};

export function DeliverablesRailBoundV2() {
  const state = useCopilotKitNolmeAgentState();
  const items: DeliverableItem[] = state.resources.map((r) => ({
    id: r.id,
    phase: PHASE_FROM_BADGE[r.badge] ?? 'P1',
    title: r.title,
    subtitle: r.subtitle,
  }));
  return <DeliverablesRailV2 items={items} />;
}
