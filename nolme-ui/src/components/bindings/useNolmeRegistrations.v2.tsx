/**
 * useNolmeRegistrations.v2
 *
 * v2 mirror of useNolmeRegistrations — registers every CopilotKit frontend tool
 * the Nolme dashboard needs via the v2 `useRenderTool` hook plus the wildcard
 * thinking-pill render. Used by NolmeDashboard.v2.
 *
 * Hook map:
 *   - useRenderTool('showVenueCard' .. 'showWarmAudience' → OutputCardV2)
 *   - useRenderTool({ name: '*' }                        → ThinkingPillV2 inProgress)
 *   - useHumanInTheLoop('approvePhase'                   → no-op render placeholder)
 */
import { useRenderTool, useHumanInTheLoop } from '@copilotkit/react-core/v2';
import type { ReactElement } from 'react';
import { OutputCardV2 } from '../OutputCard.v2';
import { ThinkingPillV2 } from '../ThinkingPill.v2';

const OUTPUT_CARD_TOOLS = [
  'showVenueCard',
  'showLumaDraft',
  'showEmailPreview',
  'showPricingModel',
  'showSurveyPlan',
  'showThankYouEmail',
  'showReportingSheet',
  'showWorkflowBrief',
  'showWarmAudience',
] as const;

function formatPillLabel(name: string, args: unknown): string {
  if (typeof args === 'object' && args && 'label' in (args as Record<string, unknown>)) {
    return String((args as { label: unknown }).label);
  }
  return `Working: ${name.replace(/^show/, '')}...`;
}

interface RenderToolNamedArgs {
  name: string;
  render: (props: { args: unknown; status: string }) => ReactElement;
}

interface RenderToolWildcardArgs {
  name: '*';
  render: (props: { name: string; args: unknown; status: string }) => ReactElement;
}

interface HumanInTheLoopArgs {
  name: string;
  render: (props: unknown) => ReactElement;
}

// v2's `useRenderTool` typed overload requires a Standard Schema V1 parameter
// validator (zod / valibot / ArkType) for named tools; we don't have one yet
// for the existing show* tool surface (cam-jhm — schemas land with the named
// v2 binding work). The cast below names the runtime-accepted shape we
// actually use, so the call sites are statically typed against a precise
// surface even if the cast is necessary at the boundary.
const renderToolNamed = useRenderTool as unknown as (config: RenderToolNamedArgs) => void;
const renderToolWildcard = useRenderTool as unknown as (config: RenderToolWildcardArgs) => void;
const registerHumanInTheLoop = useHumanInTheLoop as unknown as (config: HumanInTheLoopArgs) => void;

function renderOutputCard(args: unknown): ReactElement {
  const a = (args ?? {}) as Record<string, unknown>;
  return (
    <OutputCardV2
      title={String(a.title ?? '')}
      subtitle={String(a.subtitle ?? '')}
      description={typeof a.description === 'string' ? a.description : undefined}
      rating={typeof a.rating === 'number' ? a.rating : undefined}
    />
  );
}

function renderShowToolBody({ args, status }: { args: unknown; status: string }): ReactElement {
  if (status !== 'complete' && status !== 'inProgress') return <></>;
  return renderOutputCard(args);
}

export function useNolmeRegistrations(): void {
  // Output cards — flat hook calls (one per known tool; hook count must be
  // stable across renders, so this can't be a loop).
  /* eslint-disable react-hooks/rules-of-hooks */
  renderToolNamed({ name: OUTPUT_CARD_TOOLS[0], render: renderShowToolBody });
  renderToolNamed({ name: OUTPUT_CARD_TOOLS[1], render: renderShowToolBody });
  renderToolNamed({ name: OUTPUT_CARD_TOOLS[2], render: renderShowToolBody });
  renderToolNamed({ name: OUTPUT_CARD_TOOLS[3], render: renderShowToolBody });
  renderToolNamed({ name: OUTPUT_CARD_TOOLS[4], render: renderShowToolBody });
  renderToolNamed({ name: OUTPUT_CARD_TOOLS[5], render: renderShowToolBody });
  renderToolNamed({ name: OUTPUT_CARD_TOOLS[6], render: renderShowToolBody });
  renderToolNamed({ name: OUTPUT_CARD_TOOLS[7], render: renderShowToolBody });
  renderToolNamed({ name: OUTPUT_CARD_TOOLS[8], render: renderShowToolBody });

  // Wildcard thinking-pill render — fires on any in-flight tool_use frame.
  renderToolWildcard({
    name: '*',
    render: ({ name, args, status }) => {
      if (status !== 'inProgress') return <></>;
      return <ThinkingPillV2 label={formatPillLabel(name, args)} />;
    },
  });

  // approvePhase — placeholder until the v2 ApprovalChipRow lands.
  registerHumanInTheLoop({
    name: 'approvePhase',
    render: () => <></>,
  });
  /* eslint-enable react-hooks/rules-of-hooks */
}
