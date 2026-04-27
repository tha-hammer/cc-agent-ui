---
date: 2026-04-27T11:21:13-04:00
researcher: RusticPuma
git_commit: 6464d6e7d9180767b0186b37db6e2421c252f12e
branch: main
repository: cosmic-agent-memory
topic: "How to connect the Algorithm Run API to Nolme phases and deliverables"
tags: [research, codebase, cc-agent-ui, nolme, algorithm-runs, api]
status: complete
last_updated: 2026-04-27
last_updated_by: RusticPuma
---

# How to connect the Algorithm Run API to Nolme phases and deliverables

Use this guide when an Algorithm run exists in `cc-agent-ui` and Nolme needs to show populated phase pills, the selected task card, and deliverable artifacts.

The integration target is the existing Nolme work-surface state, `NolmeAgentState`. The implemented Algorithm Run API is a run-control and event boundary; it does not currently render into Nolme components directly.

## Prerequisites

- A running `cc-agent-ui` server with authenticated `/api/algorithm-runs`, `/api/sessions/:sessionId/messages`, `/api/nolme/state/:sessionId`, and `/api/copilotkit` routes.
- A started Algorithm run id from `POST /api/algorithm-runs`.
- A provider session id from the Algorithm run state or an `algorithm.session.bound` event.
- The Nolme launch binding fields: `provider`, `sessionId`, `projectName`, and `projectPath`.

## Steps

1. **Start or identify the Algorithm run**

   Start the run with `POST /api/algorithm-runs`, then keep the returned `run.runId`, `run.provider`, and state/events links.

   The start response is enough to poll the public run state:

   ```text
   GET /api/algorithm-runs/:runId/state
   ```

   Or stream ordered events:

   ```text
   GET /api/algorithm-runs/:runId/events?after=<sequence>&stream=1
   ```

2. **Wait for the provider session binding**

   Read `state.sessionId` from `GET /api/algorithm-runs/:runId/state`, or watch for `algorithm.session.bound` events.

   Nolme binds to provider sessions, not Algorithm run ids. If `sessionId` is still `null`, the Algorithm API can show run status, but Nolme cannot hydrate provider history or sidecar state for that run yet.

3. **Bind Nolme to the provider session**

   Build the normal `NolmeSessionBinding`:

   ```ts
   {
     provider,
     sessionId,
     projectName,
     projectPath,
     model,
     permissionMode,
     toolsSettings
   }
   ```

   Nolme already accepts this binding through URL params, `localStorage('nolme-current-binding')`, and `BroadcastChannel('ccu-session')`.

   A URL launch uses this shape:

   ```text
   /nolme/?provider=claude&sessionId=<sessionId>&projectName=<projectName>&projectPath=<projectPath>
   ```

4. **Populate the phase pills through `NolmeAgentState.phases`**

   The phase bar reads these fields:

   ```ts
   {
     phases: NolmePhase[],
     currentPhaseIndex: number,
     currentReviewLine: string
   }
   ```

   Each phase item must match:

   ```ts
   {
     id: string,
     label: string,
     title: string,
     status: 'idle' | 'active' | 'complete'
   }
   ```

   Use the current Algorithm phase string from `AlgorithmRunState.phase` or `algorithm.phase.changed` to choose the active phase. The ordered phase list and human titles must come from the bridge's phase catalog or from richer runner payloads, because the implemented Algorithm API currently exposes only one `phase` string.

   A typical status projection is:

   - phases before the active index: `complete`
   - active phase: `active`
   - phases after the active index: `idle`
   - terminal completed run: all phases `complete`

5. **Populate the selected task card through phase title and review line**

   The selected info box does not have separate `taskName` and `taskDetails` fields. It renders:

   - task name: `phases[currentPhaseIndex].title`
   - task details: `currentReviewLine`
   - progress label: `Task {currentPhaseIndex + 1} of {phases.length}`

   If `currentReviewLine` is empty, the component falls back to `Continue the ${phase.title.toLowerCase()} workflow.`

6. **Populate deliverables through `NolmeAgentState.resources`**

   The deliverables rail reads `state.resources`:

   ```ts
   {
     id: string,
     badge: 'P1' | 'P2' | 'P3' | 'P4',
     title: string,
     subtitle: string,
     tone: 'emerald' | 'iris' | 'gold',
     action: 'download' | 'link',
     url?: string
   }
   ```

   `DeliverablesRailBoundV2` maps `badge` to the UI phase group (`P1` through `P4`) and passes `title` and `subtitle` into the artifact rows.

   The current visual rail does not pass `action` or `url` into `DeliverablesRailV2`; those fields are part of `NolmeResource` state, but the rendered rows currently use title/subtitle grouping only.

7. **Use the agent UI message API as the fallback deliverables source**

   During hydration, Nolme fetches provider history from:

   ```text
   GET /api/sessions/:sessionId/messages?provider=<provider>&projectName=<projectName>&projectPath=<projectPath>
   ```

   If explicit `state.resources` is empty, `projectDeliverables()` derives artifacts from normalized messages:

   - `tool_result.toolUseResult.filePath`
   - `tool_use` named `addResource`
   - latest assistant `COMPLETED:` line when no concrete artifact exists

   To make deliverables appear from the agent UI API without writing explicit resources, ensure the provider history contains one of those normalized message shapes.

8. **Choose the state delivery path**

   There are two existing paths into Nolme state:

   - persisted sidecar: write `NolmeAgentState` for the provider session, then Nolme reads it through `/api/nolme/state/:sessionId`
   - live CopilotKit state: emit `STATE_SNAPSHOT` or `STATE_DELTA` for agent `ccu`

   The current Algorithm Run API does not emit AG-UI state events. A connector between `/api/algorithm-runs` and Nolme should project Algorithm run state/events into the existing `NolmeAgentState` fields above.

9. **Verify the populated UI**

   Confirm the phase rail has non-empty `state.phases`, a valid `state.currentPhaseIndex`, and the intended `state.currentReviewLine`.

   Confirm the deliverables rail has non-empty `state.resources`, or that the hydrated messages contain artifact-producing `tool_result` / `addResource` records.

## Current contract constraints

The implemented `AlgorithmRunState` includes `runId`, `provider`, `model`, `status`, `sessionId`, `phase`, cursor, pending question/permission, last error, and timestamps.

It does not currently include:

- `phases`
- `currentPhaseIndex`
- `currentReviewLine`
- `taskName`
- `taskDetails`
- `resources`
- artifact event types

`persistRunnerFrame()` currently maps runner `state` frames to `algorithm.session.bound`, `algorithm.phase.changed`, and `algorithm.status.changed`. It does not project artifacts or Nolme resources.

## Field map

| Source | Target | Used by |
| --- | --- | --- |
| `AlgorithmRunState.sessionId` | `NolmeSessionBinding.sessionId` | Nolme launch, hydration, CopilotKit thread |
| `AlgorithmRunState.phase` / `algorithm.phase.changed` | `NolmeAgentState.phases[*].status` and `currentPhaseIndex` | Phase pills and selected phase |
| bridge phase catalog or runner payload | `NolmeAgentState.phases[*].label/title` | Phase pill text and task card title |
| bridge task detail or runner payload | `NolmeAgentState.currentReviewLine` | Task card details |
| `NolmeAgentState.resources` | deliverable rail items | Explicit artifact rows |
| `/api/sessions/:sessionId/messages` normalized history | `projectDeliverables(messages)` fallback | Artifact rows when `resources` is empty |

## Implementation links

- Algorithm routes: `server/routes/algorithm-runs.js`
- Algorithm contracts: `server/algorithm-runs/contracts.js`
- Algorithm run store: `server/algorithm-runs/run-store.js`
- Runner adapter mapping: `server/algorithm-runs/runner-adapter.js`
- Nolme state type: `nolme-ui/src/lib/types.ts`
- Nolme hydration: `nolme-ui/src/hooks/useHydratedState.ts`
- Nolme projection merge: `nolme-ui/src/lib/ai-working/projectAiWorkingProjection.ts`
- Phase projection fallback: `nolme-ui/src/lib/ai-working/projectPhaseTimeline.ts`
- Deliverables projection fallback: `nolme-ui/src/lib/ai-working/projectDeliverables.ts`
- Phase UI binding: `nolme-ui/src/components/bindings/WorkflowPhaseBarBound.v2.tsx`
- Deliverables UI binding: `nolme-ui/src/components/bindings/DeliverablesRailBound.v2.tsx`
- TDD plan: `thoughts/searchable/shared/plans/2026-04-26-cc-agent-ui-algorithm-run-api-boundary-tdd.md`
