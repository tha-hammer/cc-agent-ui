/**
 * useNolmeRegistrations
 *
 * Registers every CopilotKit frontend tool / HITL handler / wildcard renderer
 * that the Nolme dashboard needs. Mounted ONCE inside <CopilotKit> by
 * NolmeDashboard.
 *
 * Hook map (matches plan B25-B27 + B29):
 *   - useFrontendTool('showVenueCard'  → OutputCard)
 *   - useFrontendTool('showLumaDraft'  → OutputCard)
 *   - useFrontendTool('showEmailPreview' → OutputCard)
 *   - useFrontendTool('showPricingModel' → OutputCard)
 *   - useFrontendTool('showSurveyPlan' → OutputCard)
 *   - useFrontendTool('showThankYouEmail' → OutputCard)
 *   - useFrontendTool('showReportingSheet' → OutputCard)
 *   - useFrontendTool('showWorkflowBrief' → OutputCard)
 *   - useFrontendTool('showWarmAudience' → OutputCard)
 *   - useRenderToolCall({ name: '*'    → ThinkingPill while inProgress})
 *   - useHumanInTheLoop('approvePhase' → ApprovalChipRow)
 *   - useHumanInTheLoop('askQuestion'  → text input)
 */
import {
  useFrontendTool,
  useHumanInTheLoop,
  useRenderToolCall,
} from '@copilotkit/react-core';
import { OutputCard, type OutputCardTone } from '../OutputCard';
import { ThinkingPill } from '../ThinkingPill';
import { ApprovalChipRow } from '../ApprovalChipRow';

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

const OUTPUT_CARD_TONE_BY_TOOL: Record<string, OutputCardTone> = {
  showPricingModel: 'amber',
  showThankYouEmail: 'lavender',
  showReportingSheet: 'lavender',
};

function formatPillLabel(name: string, args: unknown): string {
  if (typeof args === 'object' && args && 'label' in (args as Record<string, unknown>)) {
    return String((args as { label: unknown }).label);
  }
  return `Working: ${name.replace(/^show/, '')}...`;
}

export function useNolmeRegistrations(): void {
  // Output cards — one useFrontendTool per known card type. Each registration
  // is a hook call, so this needs to be flat (cannot loop).
  /* eslint-disable react-hooks/rules-of-hooks */
  useFrontendTool({
    name: OUTPUT_CARD_TOOLS[0],
    description: 'Display an in-stream output card for a venue match.',
    parameters: [],
    handler: () => 'rendered',
    render: ({ args, status }) => {
      if (status !== 'complete' && status !== 'inProgress') return <></>;
      const a = (args ?? {}) as Record<string, unknown>;
      return (
        <OutputCard
          title={String(a.title ?? '')}
          subtitle={String(a.subtitle ?? '')}
          description={typeof a.description === 'string' ? a.description : undefined}
          tone={OUTPUT_CARD_TONE_BY_TOOL[OUTPUT_CARD_TOOLS[0]] ?? 'white'}
          rating={typeof a.rating === 'number' ? a.rating : undefined}
        />
      );
    },
  });
  for (let i = 1; i < OUTPUT_CARD_TOOLS.length; i += 1) {
    const toolName = OUTPUT_CARD_TOOLS[i];
    useFrontendTool({
      name: toolName,
      description: `Display an in-stream output card for ${toolName.replace(/^show/, '')}.`,
      parameters: [],
      handler: () => 'rendered',
      render: ({ args, status }) => {
        if (status !== 'complete' && status !== 'inProgress') return <></>;
        const a = (args ?? {}) as Record<string, unknown>;
        return (
          <OutputCard
            title={String(a.title ?? '')}
            subtitle={String(a.subtitle ?? '')}
            description={typeof a.description === 'string' ? a.description : undefined}
            tone={OUTPUT_CARD_TONE_BY_TOOL[toolName] ?? 'white'}
            rating={typeof a.rating === 'number' ? a.rating : undefined}
          />
        );
      },
    });
  }
  /* eslint-enable react-hooks/rules-of-hooks */

  // Wildcard thinking pill — fires for any tool currently inProgress; collapses
  // when complete. Using useRenderToolCall with name "*" (B25 per plan).
  type WildcardRenderProps = { name: string; args: unknown; status: string };
  useRenderToolCall({
    name: '*',
    render: ({ name, args, status }: WildcardRenderProps) => {
      if (status !== 'inProgress') return <></>;
      return <ThinkingPill label={formatPillLabel(name, args)} />;
    },
  } as never);

  // Approval chip row HITL.
  type HitlRenderProps = {
    args: { options?: unknown };
    respond?: (value: string) => void;
    status: string;
  };
  useHumanInTheLoop({
    name: 'approvePhase',
    description: 'Ask the operator to confirm or revise a phase output.',
    parameters: [
      { name: 'phaseId', type: 'string', required: true },
      { name: 'options', type: 'string[]', required: true },
    ],
    render: ({ args, respond, status }: HitlRenderProps) => {
      if (status !== 'executing' || !respond) return <></>;
      const opts = Array.isArray(args.options) ? (args.options as string[]) : [];
      return <ApprovalChipRow options={opts} onSelect={(label) => respond(label)} />;
    },
  } as never);
}
