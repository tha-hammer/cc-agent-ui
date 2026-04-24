/**
 * Workflow-phase agent tools.
 *
 * Three frontend-registered tools that the Nolme agent calls to mutate shared
 * NolmeAgentState (phases / currentPhaseIndex / resources). The tool schemas
 * are consumed by CopilotKit to advertise the tools to the LLM.
 *
 * Each tool triggers:
 *   1. A TOOL_CALL_* AG-UI event pair (so the UI can render a brief ack card)
 *   2. A STATE_SNAPSHOT or STATE_DELTA (so the rail components re-render)
 *   3. A sidecar write to ~/.claude/projects/<encoded>/<session-id>.nolme-state.json
 *      (B8 — persists across reconnects)
 *
 * The schemas mirror the TypeScript interfaces in plan C-2 (NolmePhase,
 * NolmeResource). JSON Schema is used instead of Zod to avoid pinning an
 * additional zod major in the server build.
 *
 * @module tools/workflow-phase-tools
 */

const PHASE_ITEM_SCHEMA = {
  type: 'object',
  required: ['id', 'label', 'title', 'status'],
  properties: {
    id: { type: 'string', description: 'Stable phase id (kebab-case).' },
    label: { type: 'string', description: 'Short label (e.g. "Phase 1").' },
    title: { type: 'string', description: 'Human-readable title (e.g. "Audience & venue").' },
    status: {
      type: 'string',
      enum: ['idle', 'active', 'complete'],
      description: 'Current lifecycle state of the phase card.',
    },
  },
};

export const WORKFLOW_PHASE_TOOLS = [
  {
    name: 'setPhaseState',
    description:
      'Replace the entire workflow phase list. Use this at the start of a run when the agent produces the initial phase plan (e.g. "Audience & venue / Promote & sell / Post-event"). Subsequent within-run updates should prefer advancePhase to surface progress incrementally.',
    parameters: {
      type: 'object',
      required: ['phases'],
      properties: {
        phases: {
          type: 'array',
          minItems: 1,
          items: PHASE_ITEM_SCHEMA,
        },
        currentPhaseIndex: {
          type: 'integer',
          minimum: 0,
          description: 'Optional. Index of the phase that should be marked active.',
        },
        currentReviewLine: {
          type: 'string',
          description: 'Optional. Human-readable line under "Workflow Phases:" (e.g. "Reviewing task 3 of 3 - Event venue choices and reason").',
        },
      },
    },
  },
  {
    name: 'advancePhase',
    description:
      'Mark the phase with the given id as complete and activate the next phase in the sequence. No-op if the phase is already complete.',
    parameters: {
      type: 'object',
      required: ['phaseId'],
      properties: {
        phaseId: {
          type: 'string',
          description: 'The id of the phase to mark complete (e.g. "audience-venue").',
        },
      },
    },
  },
  {
    name: 'addResource',
    description:
      'Append a resource card to the right-rail Resources list. Use when the agent produces a concrete artifact (Workflow brief, Warm audience sheet, Venue matches link, etc.).',
    parameters: {
      type: 'object',
      required: ['badge', 'title', 'subtitle', 'tone', 'action'],
      properties: {
        badge: {
          type: 'string',
          enum: ['P1', 'P2', 'P3', 'P4'],
          description: 'Phase badge shown on the resource card.',
        },
        title: { type: 'string', description: 'Resource title (e.g. "Workflow brief").' },
        subtitle: { type: 'string', description: 'Resource subtitle (e.g. "Google Document", "Google Sheet • 142 contacts").' },
        tone: {
          type: 'string',
          enum: ['emerald', 'iris', 'gold'],
          description: 'Color tone of the badge chip (mirrors the Figma palette).',
        },
        action: {
          type: 'string',
          enum: ['download', 'link'],
          description: 'Whether the card shows a download icon or a link-out icon.',
        },
        url: {
          type: 'string',
          format: 'uri',
          description: 'Optional external URL if action is "link".',
        },
        id: {
          type: 'string',
          description: 'Optional stable resource id. If omitted, the server generates one.',
        },
      },
    },
  },
];
