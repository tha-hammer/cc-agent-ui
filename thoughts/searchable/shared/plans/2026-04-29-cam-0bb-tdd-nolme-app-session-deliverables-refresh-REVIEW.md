# Plan Review Report: /app Session Refresh and Deliverables

Reviewed plan: `thoughts/searchable/shared/plans/2026-04-29-cam-0bb-tdd-nolme-app-session-deliverables-refresh.md`

## Review Summary

| Category | Status | Issues Found |
|----------|--------|--------------|
| Contracts | Critical | 3 |
| Interfaces | Warning | 2 |
| Promises | Critical | 1 |
| Data Models | Critical | 2 |
| APIs | Warning | 1 |

Approval status: Needs Major Revision

The plan is directionally correct for the stale transcript and empty Deliverables pane, but it does not yet define enough state ownership, source precedence, artifact input shape, or async ordering contracts to implement safely.

## Contract Review

### Well-Defined

- The selected transcript refresh boundary is clear: `/app` should reuse `api.unifiedSessionMessages(...)` when a selected session JSONL changes. See plan lines 82-167 and existing API wrapper at `src/utils/api.js:58`.
- The normal session route precedent is correctly identified: `useProjectsState` reacts to `projects_updated` and `useChatSessionState` refreshes from server. See `src/hooks/useProjectsState.ts:206` and `src/components/chat/hooks/useChatSessionState.ts:402`.
- Server-side watcher contract is correctly grounded: `projects_updated` includes `projects` and `changedFile`. See `server/index.js:164` and `src/types/app.ts:56`.

### Missing or Unclear

1. Critical: The plan does not update `/app` project/session collection state from `projects_updated.projects`.

   Impact: The transcript may refresh, but the nav-panel session list can still show stale `messageCount`, stale `lastActivity`, stale session ordering, missing new sessions, or undeleted sessions. This misses the stated UI goal that projects and sessions stay updated.

   Evidence:
   - Plan only promises transcript refresh and unrelated refresh guards at lines 9, 44-48, and 96.
   - `/app` currently fetches projects once at mount and only updates selected project after that initial fetch at `src/components/nolme-app/view/NolmeAppRoute.tsx:401`.
   - The existing non-`/app` contract updates `projects`, `selectedProject`, and selected session metadata from `projects_updated.projects` at `src/hooks/useProjectsState.ts:257`.

   Recommendation: Add a behavior before or alongside Behavior 1: Given `/app` receives `projects_updated.projects`, when the changed projects array contains the selected project, then `projects`, `selectedProject`, and `selectedSession` metadata update without losing the current selection. Include assertions for visible message count and relative modified time.

2. Critical: Run-state deliverable precedence is not scoped to the selected session or active run view.

   Impact: A stale `nolme-active-algorithm-run-id` in localStorage can load unrelated live run deliverables and hide the selected provider session's derived deliverables. The current route reads `activeRunId` from URL/localStorage at mount, independent of which session the user opens.

   Evidence:
   - Plan says live run deliverables are authoritative at lines 47 and 501-559.
   - `readInitialRunId()` reads localStorage at `src/components/nolme-app/view/NolmeAppRoute.tsx:160`, `activeRunId` is initialized once at line 331, and run state loads whenever it exists at line 596.
   - Algorithm run state already includes `sessionId` at `src/components/nolme-app/view/NolmeAppRoute.tsx:111`, populated by the run store at `server/algorithm-runs/run-store.js:85`.

   Recommendation: Modify Behavior 5: live run deliverables are authoritative only when the UI is in explicit run mode or `runState.sessionId` matches `selectedSession.id` / `chatSessionId`. Add a stale-localStorage test where `runState.deliverables` exists for a different session and the selected session's derived deliverable wins.

3. Warning: Error contracts are too generic.

   Impact: Tests can lock in a message that the real API does not return. The unified messages endpoint returns `{ error: 'Failed to fetch messages' }` on 500, while the plan expects route-local text like `Failed to load session claude-session-1`.

   Evidence:
   - Plan lines 591-620 specify `ok: false` but not the response shape or status.
   - `/api/sessions/:sessionId/messages` returns `{ error: 'Failed to fetch messages' }` at `server/routes/messages.js:55`.

   Recommendation: Define loader error mapping explicitly: any non-ok response maps to `Failed to load session ${session.id}` for UI display, while preserving prior transcript state.

## Interface Review

### Well-Defined

- The plan correctly keeps the public network interface unchanged and uses the existing `api.unifiedSessionMessages(sessionId, provider, { projectName, projectPath })` shape.
- The route component is the correct owner for this slice because `/app` currently owns `chatMessages`, `runState`, `derivedRunState`, `projects`, and `selectedSession`.

### Missing or Unclear

1. Warning: Planned helpers are named conceptually, but their TypeScript signatures are not specified.

   Impact: Implementation can drift into route-local closures that are hard to unit test, especially for artifact parsing and path matching.

   Recommendation: Amend the plan with concrete signatures:

   ```ts
   function doesProjectUpdateTargetSession(message: ProjectsUpdatedMessage, session: SessionWithProvider): boolean
   function deriveSessionDeliverables(messages: NormalizedMessage[]): AlgorithmDeliverable[]
   async function loadSelectedSessionMessages(project: Project, session: SessionWithProvider, options?: { showSpinner?: boolean; reason?: 'open' | 'refresh' }): Promise<void>
   function selectRightPanelRunState(args: { runState: AlgorithmRunState | null; derivedRunState: AlgorithmRunState | null; sessionDeliverables: AlgorithmDeliverable[]; selectedSessionId: string | null; chatSessionId: string | null }): AlgorithmRunState | null
   ```

2. Warning: The plan does not specify whether `NormalizdMessage` should be imported from `src/stores/useSessionStore.ts` or duplicated in `NolmeAppRoute.tsx`.

   Impact: The local `NormalizedMessage` type in `/app` currently only includes `kind`, `role`, and `content`, but the shared type includes `task_notification`, `summary`, `status`, `toolResult`, `parentToolUseId`, and other fields.

   Evidence:
   - Local type is minimal at `src/components/nolme-app/view/NolmeAppRoute.tsx:138`.
   - Shared type is fuller at `src/stores/useSessionStore.ts:16`.

   Recommendation: Use the shared `NormalizedMessage` type or define a new `SessionArtifactSourceMessage` type that intentionally covers every supported artifact source.

## Promise Review

### Well-Defined

- The plan states that a failed background refresh must not clear the transcript, which is the right user-facing guarantee.
- It also states that unrelated project updates should not trigger duplicate session fetches.

### Missing or Unclear

1. Critical: Async ordering and stale refresh response handling are not specified.

   Impact: Multiple file updates can produce overlapping `loadSelectedSessionMessages(...)` calls. If an older request resolves after a newer request, it can overwrite the newer transcript and derived deliverables with stale data.

   Evidence:
   - Plan lines 164-167 call the loader directly from the new effect.
   - Plan lines 650-654 preserve data on failure but do not cover out-of-order success.

   Recommendation: Add a promise contract: background refreshes are last-write-wins by request sequence. Track a `sessionRefreshRequestIdRef` or use `AbortController`; apply results only if the request is still current for the same `session.id`. Add a test with two deferred refresh promises resolving out of order.

2. Warning: Negative async tests can pass before unwanted work runs.

   Impact: Behavior 2's `waitFor(() => expect(unifiedSessionMessagesSpy).toHaveBeenCalledTimes(1))` is already true immediately after opening the session, so it can pass even if an async second fetch is scheduled after rerender.

   Evidence: Plan lines 216-230.

   Recommendation: After rerender, flush one microtask/timer turn with `await act(async () => {})` or a controlled promise, then assert the call count remains 1.

## Data Model Review

### Well-Defined

- `AlgorithmDeliverable` fields for right-panel display are already simple and match the UI row: `id`, `title`, `subtitle`, `tone`, `action`, and `url`.
- The plan correctly avoids persisting session-derived deliverables into server run state.

### Missing or Unclear

1. Critical: Artifact source data model is underspecified and misses existing normalized variants.

   Impact: The implementation could only parse the specific user-text XML envelope in the test and still miss provider-normalized task notifications or tool results that already exist in the app model.

   Evidence:
   - Plan lines 291 and 370 constrain extraction to user text content with envelope tags.
   - Shared `MessageKind` already includes `task_notification` at `src/stores/useSessionStore.ts:30`.
   - Provider type docs specify `task_notification: status, summary` at `server/providers/types.js:47`.
   - Claude history normalization attaches tool results to tool-use messages at `server/providers/claude/adapter.js:262`.

   Recommendation: Define supported artifact source variants explicitly:
   - `kind: 'text'` with `<task-notification>` envelope.
   - `kind: 'task_notification'` with `status` and `summary`.
   - optional future `tool_result` / `tool_use.toolResult` handling if the source contains an artifact path, URL, or structured `toolUseResult`.

   If this implementation intentionally supports only the text envelope, mark other variants out of scope and add tests proving they are ignored intentionally.

2. Critical: The plan suggests storing `result` on `AlgorithmDeliverable.body`, but the type has no `body` field and the UI ignores it.

   Impact: Implementation may either fail TypeScript checks or silently discard the most important artifact content.

   Evidence:
   - Plan line 373 says use `result` for `body` if compatible.
   - `AlgorithmDeliverable` has no `body` at `src/components/nolme-app/view/NolmeAppRoute.tsx:74`.
   - `DeliverableRow` renders only title and subtitle at `src/components/nolme-app/view/NolmeAppRoute.tsx:1805`.
   - `AlgorithmOutput` has `body`, but that is separate from deliverables at `src/components/nolme-app/view/NolmeAppRoute.tsx:98`.

   Recommendation: Choose one model:
   - Keep Deliverables as index rows only and use `result` solely to derive title/subtitle.
   - Or add a separate session-derived `finalOutput`/artifact preview contract and render it through `ArtifactResponse`.
   - Do not add `body` to `AlgorithmDeliverable` unless the UI and type are amended in the same plan.

## API Review

### Well-Defined

- No new endpoint is required. The plan correctly reuses `GET /api/sessions/:sessionId/messages`.
- Auth is inherited through `authenticatedFetch` in the API wrapper.

### Missing or Unclear

1. Warning: The response contract for refresh is only implied.

   Impact: Implementers may forget to update derived deliverables from raw normalized messages because `toTranscriptItem()` throws away non-text variants.

   Recommendation: Add this explicit response contract to the plan:

   ```ts
   type UnifiedSessionMessagesResponse = {
     messages?: NormalizedMessage[];
     total?: number;
     hasMore?: boolean;
     tokenUsage?: unknown;
     error?: string;
   };
   ```

   The loader must preserve the raw normalized messages long enough to derive deliverables before mapping transcript items.

## Critical Issues To Address Before Implementation

1. Project/session collection state is out of scope but required by the UI.
   - Impact: Message counts, last modified times, and session rows remain stale.
   - Recommendation: Add a behavior and tests for applying `projects_updated.projects` to `/app` project state.

2. Run-state precedence can hide selected-session deliverables for unrelated runs.
   - Impact: A stale localStorage run id can keep showing the wrong right-panel artifacts.
   - Recommendation: Gate run-state deliverable precedence by explicit run mode or `runState.sessionId === selectedSession.id`.

3. Artifact input model does not cover existing normalized task-notification/tool-result shapes.
   - Impact: Deliverables remain empty for non-envelope normalized messages.
   - Recommendation: Define `deriveSessionDeliverables(messages: NormalizedMessage[])` over raw normalized messages and enumerate supported `kind` variants.

4. Background refresh ordering is undefined.
   - Impact: Older refresh responses can overwrite newer transcript and deliverable state.
   - Recommendation: Add request sequence or cancellation semantics and a deferred-promise test.

## Suggested Plan Amendments

```diff
+ Add Behavior 0: /app applies projects_updated.projects to projects, selectedProject, and selectedSession metadata.
+ Add test: changed selected session metadata updates visible message count and modified time without losing selection.

~ Modify Behavior 1: loadSelectedSessionMessages must return/apply raw NormalizedMessage[] first, then derive transcript and deliverables.
~ Modify Behavior 1/6: background refreshes are last-write-wins; stale responses are ignored.

~ Modify Behavior 3: define supported artifact source variants: text envelope, task_notification, and explicitly scoped tool_result handling.
- Remove: AlgorithmDeliverable.body unless the type and UI render path are intentionally extended.

~ Modify Behavior 5: live run deliverables are authoritative only for an explicit active run view or a run whose sessionId matches the selected session.
+ Add test: stale localStorage activeRunId with unrelated runState does not hide selected-session deliverables.

~ Modify Behavior 2 negative test: flush scheduled effects before asserting unifiedSessionMessages call count remains 1.
```

## Review Checklist

### Contracts

- Component boundaries are mostly identified.
- Input/output contracts need amendments for project-state updates and right-panel source precedence.
- Error contracts need explicit response-to-UI mapping.
- Preconditions and postconditions need async ordering rules.
- Invariants need one addition: selected-session view should prefer selected-session data over unrelated persisted active run state.

### Interfaces

- Public network interface is complete.
- Planned helper signatures need concrete TypeScript definitions.
- Naming follows local patterns.
- Extension points for future artifact schemas are not yet clear.

### Promises

- Transcript preservation on refresh failure is documented.
- Timeout/cancellation or stale-response handling is missing.
- Idempotency for repeated project updates is partially addressed but needs stronger tests.
- Ordering guarantees are missing.

### Data Models

- `AlgorithmDeliverable` display fields are clear.
- `result`/artifact body handling is not compatible with the current type.
- Normalized task-notification and tool-result shapes are not fully modeled.
- Serialization remains unchanged.

### APIs

- Endpoint reuse is appropriate.
- Request parameters are clear.
- Response and error shape should be explicitly included in the plan.
- Authentication is inherited from `authenticatedFetch`.
