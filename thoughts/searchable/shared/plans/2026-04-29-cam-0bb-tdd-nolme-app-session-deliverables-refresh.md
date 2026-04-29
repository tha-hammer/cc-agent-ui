# /app Session Refresh and Deliverables TDD Implementation Plan

## Overview

The `/app` route currently renders project sessions and Algorithm phases, but selected sessions are loaded once and then become stale. When a Claude/cc-agent-ui session continues outside the initial load, `/app` does not refresh the transcript from the changed project JSONL, so the final assistant response and completed artifact output do not appear. The right-panel Deliverables pane also only reads `runState.deliverables`; selected provider sessions without a matching active Algorithm run never project completed task/artifact output into the pane.

This amended plan incorporates all findings from:

`thoughts/searchable/shared/plans/2026-04-29-cam-0bb-tdd-nolme-app-session-deliverables-refresh-REVIEW.md`

This TDD slice makes `/app` behave like a working session UI:

- Apply `projects_updated.projects` to `/app` project/session collection state so the nav-panel session list stays current.
- Refresh the selected `/app` transcript when the project watcher reports that the selected session file changed.
- Keep unrelated project/session updates from causing duplicate transcript fetches.
- Preserve raw normalized session messages long enough to derive Deliverables before mapping transcript rows.
- Derive Deliverables from supported task/artifact message shapes in selected session transcripts when no matching live Algorithm run deliverables exist.
- Treat live Algorithm run deliverables as authoritative only for explicit run mode or when the run is bound to the selected session.
- Make background refreshes last-write-wins so stale responses cannot overwrite newer transcript or deliverable state.
- Surface refresh errors without clearing the current transcript.

Tracked issues:

- Original plan: `cam-ro6`
- Review amendments: `cam-rz9`

Source research: `thoughts/searchable/shared/research/2026-04-29-cam-0bb-cc-agent-ui-artifact-deliverables-flow.md`

## Current State Analysis

### Key Discoveries

- `/app` owns its route-local session state in `src/components/nolme-app/view/NolmeAppRoute.tsx:326`, including `projects`, `selectedProject`, `selectedSession`, `chatSessionId`, `chatMessages`, `runState`, and `derivedRunState`.
- Opening a provider session calls `openSession()` at `src/components/nolme-app/view/NolmeAppRoute.tsx:459`, then fetches `api.unifiedSessionMessages(...)` at `src/components/nolme-app/view/NolmeAppRoute.tsx:475` exactly once.
- Loaded session messages are filtered through `toTranscriptItem()` at `src/components/nolme-app/view/NolmeAppRoute.tsx:215`. That helper accepts only normalized `kind: "text"` messages with `role` and `content`, so the current route throws away non-text artifact variants before the right panel can inspect them.
- Phase progress is derived from assistant text through `deriveAlgorithmRunStateFromText()` at `src/components/nolme-app/view/NolmeAppRoute.tsx:236`. The derived state has phase/task fields only and no deliverables.
- `rightPanelRunState` at `src/components/nolme-app/view/NolmeAppRoute.tsx:362` merges live and derived phase fields, but not session-derived deliverables.
- The right-panel Deliverables section reads only `runState?.deliverables ?? []` at `src/components/nolme-app/view/NolmeAppRoute.tsx:1726`, causing "No deliverables yet" for completed provider sessions with artifact-like transcript output.
- The normal session route already has the update pattern: `useProjectsState` consumes WebSocket `projects_updated` at `src/hooks/useProjectsState.ts:206`, matches `changedFile` to `selectedSession.id` at `src/hooks/useProjectsState.ts:235`, updates project metadata from `projects_updated.projects` at `src/hooks/useProjectsState.ts:257`, and increments `externalMessageUpdate` at `src/hooks/useProjectsState.ts:247`.
- `useChatSessionState` refreshes selected session messages from the server after an external update at `src/components/chat/hooks/useChatSessionState.ts:402`.
- The server broadcasts `projects_updated` with `projects` and `changedFile` from the project watcher at `server/index.js:144` and `server/index.js:164`.
- The project-update message contract is typed in `src/types/app.ts:56`.
- The API client exposes the needed fetch surface at `src/utils/api.js:58`.
- Existing `/app` route tests use Vitest/jsdom and mock `api`, `useWebSocket`, and `EventSource` in `tests/generated/test_nolme_app_route.spec.tsx`.
- Shared `NormalizedMessage` already includes `kind: "task_notification"`, `status`, `summary`, `toolResult`, and other artifact-relevant fields at `src/stores/useSessionStore.ts:16`.
- Provider docs also list `task_notification: status, summary` as a normalized message variant at `server/providers/types.js:47`.
- Claude history normalization attaches tool results to their parent tool-use messages at `server/providers/claude/adapter.js:262`.
- Algorithm run public state includes `sessionId` at `src/components/nolme-app/view/NolmeAppRoute.tsx:111` and the run store populates it at `server/algorithm-runs/run-store.js:85`, so right-panel run-state precedence can be scoped to the selected session.
- The specific test session evidence was `/home/maceo/.claude/projects/-home-maceo/d75f31dc-0e96-4267-aa35-ff7c68f86cdd.jsonl`; it had a completed `<task-notification>` payload and later assistant `REPORT DELIVERED` text, but no corresponding `.nolme-state.json` sidecar and no Algorithm run-store entry.

### Registry and Schema Discoveries

- `specs/schemas/resource_registry.json` is missing in this checkout.
- No files were found under `schema/`, `schemas/`, or `specs/schemas/`.
- Resource bindings below are marked as proposed. Each planned function still includes a contract tag block with a stable proposed UUID so the future registry can adopt or replace it.

## Desired End State

When the user is on `/app` and opens a provider-backed project session:

- The project/session list updates from `projects_updated.projects`, including visible message counts, modified times, session additions, session removals, and session ordering.
- The selected project and selected session metadata update without losing the active selection.
- The transcript refreshes after the selected session JSONL changes.
- The final assistant text appears without reloading the browser.
- Completed task/artifact transcript messages produce visible Deliverables rows in the right panel when no matching Algorithm run deliverables are available.
- Live Algorithm run deliverables continue to render from run state only when the UI is in explicit run mode or the live run is bound to the selected session.
- Unrelated project/session updates do not fetch or mutate the visible transcript.
- Failed background refreshes keep the last known transcript visible.
- Overlapping background refreshes are last-write-wins by request sequence.

## What We Are Not Doing

- Not changing the server watcher protocol or the `/api/sessions/:id/messages` route.
- Not creating or backfilling `.nolme-state.json` sidecars for old sessions.
- Not changing the normal `/session/:id` route refresh flow.
- Not adding a persisted Algorithm run record for provider sessions that were not launched as Algorithm runs.
- Not storing session-derived deliverables in server run state.
- Not adding a `body` field to `AlgorithmDeliverable`. Deliverables remain index rows with `id`, `title`, `subtitle`, `tone`, `action`, and `url`.
- Not implementing deep markdown artifact rendering inside the Deliverables pane. This slice only makes the pane show artifact rows with enough metadata to prove completed output is detected.

## Implementation Contracts

These contracts are required before writing implementation code.

### Imported Message Type

Replace the local minimal `NormalizedMessage` shape in `NolmeAppRoute.tsx` with the shared type:

```ts
import type { NormalizedMessage } from '../../../stores/useSessionStore';
```

If direct import creates a cycle or unwanted bundle dependency, create a local `SessionArtifactSourceMessage` type that deliberately mirrors the fields used here:

```ts
type SessionArtifactSourceMessage = Pick<
  NormalizedMessage,
  'id' | 'sessionId' | 'timestamp' | 'provider' | 'kind' | 'role' | 'content' | 'status' | 'summary' | 'toolId' | 'toolName' | 'toolResult' | 'isError'
>;
```

The implementation must not derive deliverables after `toTranscriptItem()` because that loses non-text artifact variants.

### Unified Messages Response Contract

The selected-session loader must treat the API response as:

```ts
type UnifiedSessionMessagesResponse = {
  messages?: NormalizedMessage[];
  total?: number;
  hasMore?: boolean;
  tokenUsage?: unknown;
  error?: string;
};
```

`messages` defaults to `[]` only after a successful response. A non-ok response maps to the UI error message `Failed to load session ${session.id}` and must not clear the current transcript, raw messages, or derived deliverables.

### Planned Helper Interfaces

```ts
function applyProjectsUpdatedMessage(
  projectsMessage: ProjectsUpdatedMessage,
  currentProjects: Project[],
  selectedProject: Project | null,
  selectedSession: SessionWithProvider | null,
): {
  projects: Project[];
  selectedProject: Project | null;
  selectedSession: SessionWithProvider | null;
};

function doesProjectUpdateTargetSession(
  message: ProjectsUpdatedMessage,
  session: SessionWithProvider,
): boolean;

function mapNormalizedMessagesToTranscript(
  messages: NormalizedMessage[],
): ChatTranscriptItem[];

function deriveSessionDeliverables(
  messages: NormalizedMessage[],
): AlgorithmDeliverable[];

async function loadSelectedSessionMessages(
  project: Project,
  session: SessionWithProvider,
  options?: { showSpinner?: boolean; reason?: 'open' | 'refresh' },
): Promise<void>;

function selectRightPanelRunState(args: {
  runState: AlgorithmRunState | null;
  derivedRunState: AlgorithmRunState | null;
  sessionDeliverables: AlgorithmDeliverable[];
  selectedSessionId: string | null;
  chatSessionId: string | null;
  activeRunId: string;
  explicitRunMode: boolean;
}): AlgorithmRunState | null;
```

### Artifact Source Model

`deriveSessionDeliverables(messages)` supports these sources:

- `kind: "text"` user messages containing a `<task-notification>` envelope with any known subset of `task-id`, `tool-use-id`, `output-file`, `status`, `summary`, `result`, or `url`.
- `kind: "task_notification"` messages with `status` and `summary`.
- `kind: "tool_result"` messages whose `content` or `toolResult.toolUseResult` contains either a task-notification envelope or a JSON object with `status`, `summary`, `result`, `outputFile`, or `url`.
- `kind: "tool_use"` messages with attached `toolResult` in the same shapes above.
- Final assistant report fallback when no completed task/artifact deliverable has been emitted and an assistant text message contains a strong final marker such as `REPORT DELIVERED`.

Mapping rules:

- Only `status: "completed"` task/artifact sources produce deliverables.
- Malformed envelopes and malformed JSON are ignored without throwing.
- Dedupe key order: `task-id`, then `tool-use-id`, then `message.id`, then a hash of normalized title and subtitle.
- Deliverable `title`: `summary`, first markdown heading from `result`, tool name plus completion text, or a stable fallback.
- Deliverable `subtitle`: `Completed task output`, `Tool result artifact`, `Final assistant report`, or `Artifact`.
- Deliverable `tone`: `document` by default, `sheet` when a URL/path or title strongly indicates a table/spreadsheet, `link` when only a URL is known.
- Deliverable `url`: copied only when the source provides an HTTP(S) URL. Local paths and output-file values are not linked in this slice.
- `result` is not assigned to `AlgorithmDeliverable.body` because that field does not exist. `result` may be used only to derive title/subtitle or future `finalOutput` work outside this slice.

### Right-Panel Source Precedence

Live run state deliverables are authoritative only when:

- `activeRunId` came from the current URL `runId`, or
- `runState.sessionId` matches `selectedSession.id`, or
- `runState.sessionId` matches `chatSessionId`.

If the run id came only from stale localStorage and the run is not bound to the selected session, selected-session derived deliverables win for the Deliverables pane.

### Async Promise Guarantees

Background selected-session refreshes are last-write-wins:

- Maintain a monotonically increasing `sessionRefreshRequestIdRef`.
- Capture `{ requestId, sessionId }` for each `loadSelectedSessionMessages` call.
- Apply fetched messages, derived phases, and deliverables only when the request id is still current and the selected/chat session still matches the request session.
- Older successful responses are ignored.
- Failed stale responses are ignored and must not overwrite a newer success with an error.

## Testing Strategy

- Framework: Vitest with jsdom, React Testing Library, and existing mocks from `tests/generated/test_nolme_app_route.spec.tsx`.
- Test type: UI integration tests for `/app` route behavior because the bug is observable through selected session refresh, nav-panel metadata, and right-panel rendering.
- Supporting unit tests: add pure helper tests if artifact parsing is moved to `src/components/nolme-app/view/nolmeAppSessionArtifacts.ts`.
- Primary command: `npm test -- tests/generated/test_nolme_app_route.spec.tsx`
- Broad checks after implementation: `npm test -- tests/generated/test_nolme_app_route.spec.tsx tests/generated/test_use_session_broadcast.spec.tsx`, then `npm run typecheck`.

## Behavior 0: /app Applies Project And Session Metadata Updates

### Resource Registry Binding

- `resource_id`: `2146e52d-9460-432e-af89-b94dfe82f015` `[PROPOSED]`
- `address_alias`: `nolme-app.projects.apply-projects-updated-state` `[PROPOSED]`
- `predicate_refs`: current projects, selected project, selected session, WebSocket `projects_updated.projects`
- `codepath_ref`: `src/components/nolme-app/view/NolmeAppRoute.tsx::apply-projects-updated-message` `[PROPOSED]`
- `schema_contract_refs`: `N/A`

### Schema Interface Mapping

- `loop_mode`: `low_context_detail`
- `mapped_contracts`: `N/A`
- `registry_updates`: attach future project-update schema refs to proposed resource `2146e52d-9460-432e-af89-b94dfe82f015`

### Test Specification

Given `/app` has loaded `demo-project`, the user opens `claude-session-1`, and the Projects panel initially shows message count `99` and an older timestamp.

When `latestMessage` becomes `projects_updated` with `projects` containing `claude-session-1` with `messageCount: 100` and `lastActivity: "2026-04-29T12:59:00.000Z"`.

Then `/app` updates `projects`, preserves the selected session, and shows the updated count and modified time when the user returns to the Projects panel.

Edge cases:

- If the selected project is missing from the update, preserve the previous selected project until a later full refresh resolves it.
- If the selected session is missing from the updated selected project, clear `selectedSession` and `chatSessionId` only if the session was actually removed.
- Preserve provider identity when replacing the selected session with the updated metadata.

### TDD Cycle

#### Red: Write Failing Test

File: `tests/generated/test_nolme_app_route.spec.tsx`

```tsx
it('applies project/session metadata updates in the /app projects browser', async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-04-29T13:00:00.000Z'));
  const { rerender } = render(<NolmeAppRoute />);

  fireEvent.click(await screen.findByRole('button', { name: /Open session cool!! what do you mean/i }));
  await screen.findByText('Existing answer');

  webSocketState.latestMessage = {
    type: 'projects_updated',
    changedFile: 'demo-project/claude-session-1.jsonl',
    projects: [
      {
        name: 'demo-project',
        displayName: 'maceo',
        path: '/workspace/demo-project',
        fullPath: '/workspace/demo-project',
        sessionMeta: { hasMore: true, total: 2 },
        sessions: [
          {
            id: 'claude-session-1',
            summary: 'cool!! what do you mean by zero-knowledge',
            lastActivity: '2026-04-29T12:59:00.000Z',
            messageCount: 100,
          },
        ],
        codexSessions: [],
        geminiSessions: [],
        cursorSessions: [],
      },
    ],
  };
  rerender(<NolmeAppRoute />);

  fireEvent.click(screen.getByRole('button', { name: 'Chat' }));

  expect(await screen.findByText('100')).toBeInTheDocument();
  expect(screen.getByText('1 min ago')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Open session cool!! what do you mean/i })).toBeInTheDocument();
  vi.useRealTimers();
});
```

Expected first failure: `/app` does not apply `projects_updated.projects`, so the session row still shows the old count/time.

#### Green: Minimal Implementation

File: `src/components/nolme-app/view/NolmeAppRoute.tsx`

Add a project-update branch before the transcript-refresh branch in the WebSocket update effect.

Planned function contract:

```ts
/**
 * @rr.id 2146e52d-9460-432e-af89-b94dfe82f015
 * @rr.alias nolme-app.projects.apply-projects-updated-state
 * @path.id app-projects-updated-state
 * @gwt.given /app has project/session state and receives projects_updated.projects
 * @gwt.when the updated project list contains project and session metadata
 * @gwt.then projects, selectedProject, and selectedSession metadata are updated without losing the active selection
 * @reads 2146e52d-9460-432e-af89-b94dfe82f015
 * @writes 2146e52d-9460-432e-af89-b94dfe82f015
 * @raises 984f2965-a9a1-45cc-a8ec-6ec3c44959bc:session_refresh_failed
 * @schema.contract N/A
 */
```

Implementation notes:

- Reuse `getProjectSessions(updatedSelectedProject)` to find the selected session by id.
- Preserve provider identity by using the returned `SessionWithProvider`.
- Do not collapse expanded projects.
- This behavior updates nav-panel state only. Transcript refresh still depends on Behavior 1's selected-session file match.

#### Refactor

- Keep the pure metadata-update helper separate from the fetch helper so unit tests can cover future project metadata edge cases without network mocks.

### Success Criteria

- Targeted command passes: `npm test -- tests/generated/test_nolme_app_route.spec.tsx -t "project/session metadata updates"`
- Existing projects/session browser tests still pass.

## Behavior 1: Selected /app Session Refreshes On Its Project File Update

### Resource Registry Binding

- `resource_id`: `ee7119c1-7cfa-47cc-a46d-f123ad81b07d` `[PROPOSED]`
- `address_alias`: `nolme-app.selected-session.refresh-on-project-update` `[PROPOSED]`
- `predicate_refs`: selected project, selected provider session, WebSocket `projects_updated.changedFile`
- `codepath_ref`: `src/components/nolme-app/view/NolmeAppRoute.tsx::selected-session-refresh-effect` `[PROPOSED]`
- `schema_contract_refs`: `N/A`

### Schema Interface Mapping

- `loop_mode`: `low_context_detail`
- `mapped_contracts`: `N/A`
- `registry_updates`: attach future session-update schema refs to proposed resource `ee7119c1-7cfa-47cc-a46d-f123ad81b07d`

### Test Specification

Given `/app` has opened project `demo-project` session `claude-session-1`, and the first fetch returned `Existing answer`.

When `useWebSocket().latestMessage` becomes:

```ts
{
  type: 'projects_updated',
  changedFile: 'demo-project/claude-session-1.jsonl',
  projects: [updatedProject],
}
```

Then `/app` calls `api.unifiedSessionMessages('claude-session-1', 'claude', { projectName: 'demo-project', projectPath: '/workspace/demo-project' })` again, preserves the raw normalized messages long enough to derive phases and deliverables, then renders the newly returned assistant text.

Edge cases:

- Accept both Unix and Windows separators in `changedFile`.
- Accept `changedFile` values whose final path segment is the selected session filename.
- Keep the selected session id and resume behavior unchanged after refresh.
- Apply only current request results; stale request ordering is covered in Behavior 7.

### TDD Cycle

#### Red: Write Failing Test

File: `tests/generated/test_nolme_app_route.spec.tsx`

```tsx
it('refreshes the selected /app session when its project file changes', async () => {
  const { rerender } = render(<NolmeAppRoute />);

  fireEvent.click(await screen.findByRole('button', { name: /Open session cool!! what do you mean/i }));
  expect(await screen.findByText('Existing answer')).toBeInTheDocument();

  unifiedSessionMessagesSpy.mockReturnValueOnce(jsonResponse({
    messages: [
      { id: 'm1', sessionId: 'claude-session-1', provider: 'claude', kind: 'text', role: 'user', content: 'Existing question', timestamp: '2026-04-28T12:00:00.000Z' },
      { id: 'm2', sessionId: 'claude-session-1', provider: 'claude', kind: 'text', role: 'assistant', content: 'Existing answer', timestamp: '2026-04-28T12:01:00.000Z' },
      { id: 'm3', sessionId: 'claude-session-1', provider: 'claude', kind: 'text', role: 'assistant', content: 'REPORT DELIVERED', timestamp: '2026-04-29T12:59:00.000Z' },
    ],
  }));

  webSocketState.latestMessage = {
    type: 'projects_updated',
    changedFile: 'demo-project/claude-session-1.jsonl',
    projects: [],
  };
  rerender(<NolmeAppRoute />);

  await waitFor(() => expect(unifiedSessionMessagesSpy).toHaveBeenCalledTimes(2));
  expect(await screen.findByText('REPORT DELIVERED')).toBeInTheDocument();
});
```

Expected first failure: `unifiedSessionMessagesSpy` is called only once because `/app` ignores `projects_updated`.

#### Green: Minimal Implementation

File: `src/components/nolme-app/view/NolmeAppRoute.tsx`

Add a shared session loader and a `projects_updated` effect that reuses the same fetch/mapping path as `openSession()`.

Planned function contract:

```ts
/**
 * @rr.id ee7119c1-7cfa-47cc-a46d-f123ad81b07d
 * @rr.alias nolme-app.selected-session.refresh-on-project-update
 * @path.id selected-app-session-refresh
 * @gwt.given /app has a selected provider session and receives a project update for that session file
 * @gwt.when the update basename matches selectedSession.id plus .jsonl
 * @gwt.then the selected transcript is reloaded through the unified session messages API
 * @reads ee7119c1-7cfa-47cc-a46d-f123ad81b07d
 * @writes ee7119c1-7cfa-47cc-a46d-f123ad81b07d
 * @raises 984f2965-a9a1-45cc-a8ec-6ec3c44959bc:session_refresh_failed
 * @schema.contract N/A
 */
```

Implementation notes:

- Extract the body of `openSession()` fetch/mapping into `loadSelectedSessionMessages(project, session, options)`.
- The loader reads the `UnifiedSessionMessagesResponse`, keeps `body.messages` as raw `NormalizedMessage[]`, maps transcript items with `mapNormalizedMessagesToTranscript(messages)`, derives phases from assistant text, and derives session deliverables from the same raw messages.
- In a new `useEffect`, ignore messages without `type: "projects_updated"`, without a selected project/session, or while `isStartingRun` is true.
- Normalize `changedFile.replace(/\\/g, '/')`, take the basename, strip `.jsonl`, and compare to `selectedSession.id`.
- On match, call `loadSelectedSessionMessages(selectedProject, selectedSession, { showSpinner: false, reason: 'refresh' })`.

#### Refactor

- Keep session loading logic in one callback so `openSession()` and background refresh cannot diverge.
- Keep realtime text/stream handling at `src/components/nolme-app/view/NolmeAppRoute.tsx:642` separate from file-refresh handling to avoid duplicate transcript appends.

### Success Criteria

- Red command fails for the expected reason: `npm test -- tests/generated/test_nolme_app_route.spec.tsx -t "refreshes the selected /app session"`
- Green command passes the new test.
- Existing "loads an existing session inside /app and resumes it on the next send" test still passes.

## Behavior 2: Unrelated Project Updates Do Not Refresh The Selected Session

### Resource Registry Binding

- `resource_id`: `51180918-5828-4ce9-b8de-b231cb13a441` `[PROPOSED]`
- `address_alias`: `nolme-app.selected-session.ignore-unrelated-project-update` `[PROPOSED]`
- `predicate_refs`: selected session id, unrelated `projects_updated.changedFile`
- `codepath_ref`: `src/components/nolme-app/view/NolmeAppRoute.tsx::selected-session-refresh-effect` `[PROPOSED]`
- `schema_contract_refs`: `N/A`

### Schema Interface Mapping

- `loop_mode`: `low_context_detail`
- `mapped_contracts`: `N/A`
- `registry_updates`: attach future project-update message schema refs to proposed resource `51180918-5828-4ce9-b8de-b231cb13a441`

### Test Specification

Given `/app` has opened `claude-session-1`.

When `latestMessage` is `projects_updated` with `changedFile: "demo-project/other-session.jsonl"`.

Then `/app` applies any project metadata from `projects_updated.projects`, but it does not call `api.unifiedSessionMessages` again and the visible transcript remains unchanged.

Edge cases:

- Missing `changedFile` does not refresh the selected session.
- `changeType: "fork"` without a `changedFile` updates project metadata only if `projects` is provided, but does not reload transcript.

### TDD Cycle

#### Red: Write Failing Test

File: `tests/generated/test_nolme_app_route.spec.tsx`

```tsx
it('does not reload the selected /app session for unrelated project updates', async () => {
  const { rerender } = render(<NolmeAppRoute />);

  fireEvent.click(await screen.findByRole('button', { name: /Open session cool!! what do you mean/i }));
  await screen.findByText('Existing answer');

  webSocketState.latestMessage = {
    type: 'projects_updated',
    changedFile: 'demo-project/other-session.jsonl',
    projects: [],
  };
  rerender(<NolmeAppRoute />);

  await act(async () => {});
  expect(unifiedSessionMessagesSpy).toHaveBeenCalledTimes(1);
  expect(screen.queryByText('REPORT DELIVERED')).not.toBeInTheDocument();
});
```

Expected first failure after Behavior 1 is a regression guard if the refresh effect reloads on every `projects_updated`. The `act` flush is required so the negative assertion cannot pass before an unwanted scheduled fetch runs.

#### Green: Minimal Implementation

File: `src/components/nolme-app/view/NolmeAppRoute.tsx`

Use a predicate helper before fetching.

Planned function contract:

```ts
/**
 * @rr.id 51180918-5828-4ce9-b8de-b231cb13a441
 * @rr.alias nolme-app.selected-session.ignore-unrelated-project-update
 * @path.id selected-app-session-project-update-match
 * @gwt.given a selected provider session and a projects_updated message
 * @gwt.when changedFile is absent or its basename does not equal the selected session jsonl filename
 * @gwt.then no transcript refresh is requested
 * @reads 51180918-5828-4ce9-b8de-b231cb13a441
 * @writes 51180918-5828-4ce9-b8de-b231cb13a441
 * @raises 984f2965-a9a1-45cc-a8ec-6ec3c44959bc:session_refresh_failed
 * @schema.contract N/A
 */
```

Implementation notes:

- A pure `doesProjectUpdateTargetSession(message, session)` helper is required.
- Keep the helper conservative: no refresh without `changedFile`.
- Do not skip Behavior 0 metadata application just because this behavior skips transcript fetch.

#### Refactor

- Use the same helper in future tests for Windows paths and missing file paths.

### Success Criteria

- Targeted command passes: `npm test -- tests/generated/test_nolme_app_route.spec.tsx -t "unrelated project updates"`
- Behavior 0 and Behavior 1 still pass.

## Behavior 3: Completed Artifact Sources Become Session-Derived Deliverables

### Resource Registry Binding

- `resource_id`: `2d959f04-e1c9-44dd-a835-d445e35b7b21` `[PROPOSED]`
- `address_alias`: `nolme-app.deliverables.from-completed-artifact-sources` `[PROPOSED]`
- `predicate_refs`: normalized messages, completed status, summary/result/url fields
- `codepath_ref`: `src/components/nolme-app/view/NolmeAppRoute.tsx::derive-session-deliverables` `[PROPOSED]`
- `schema_contract_refs`: `N/A`

### Schema Interface Mapping

- `loop_mode`: `low_context_detail`
- `mapped_contracts`: `N/A`
- `registry_updates`: attach future task notification/artifact schema refs to proposed resource `2d959f04-e1c9-44dd-a835-d445e35b7b21`

### Test Specification

Given `api.unifiedSessionMessages` returns raw normalized messages that include supported completed artifact sources.

When `/app` opens or refreshes the selected session.

Then the right-panel Deliverables section shows derived artifact rows using the artifact summary/title data without exposing raw XML or JSON payloads.

Supported source cases in tests:

- A user `kind: "text"` message with a completed `<task-notification>` envelope.
- A `kind: "task_notification"` message with `status: "completed"` and `summary`.
- A `kind: "tool_result"` or `kind: "tool_use"` message with attached result data containing a completed artifact summary.

Edge cases:

- Ignore non-completed task notifications.
- Ignore malformed notifications without throwing.
- De-duplicate repeated notifications by task id, tool-use id, message id, or generated content hash.
- Do not show raw XML-like envelopes or raw JSON as Deliverables row titles.
- Do not assign `result` to `AlgorithmDeliverable.body`; that field does not exist.

### TDD Cycle

#### Red: Write Failing Tests

File: `tests/generated/test_nolme_app_route.spec.tsx`

```tsx
it('projects completed text task notification output into the /app deliverables pane', async () => {
  unifiedSessionMessagesSpy.mockReturnValue(jsonResponse({
    messages: [
      {
        id: 'artifact-1',
        sessionId: 'claude-session-1',
        provider: 'claude',
        kind: 'text',
        role: 'user',
        timestamp: '2026-04-29T12:59:00.000Z',
        content: [
          '<task-notification>',
          '<task-id>a0aeebb180e087ed4</task-id>',
          '<tool-use-id>toolu_0177kN7BV3HhND6nRhjpfKnz</tool-use-id>',
          '<status>completed</status>',
          '<summary>Agent "Competitive landscape and major players research" completed</summary>',
          '<result># Recruiting & Staffing Industry: Competitive Landscape Report</result>',
          '</task-notification>',
        ].join(' '),
      },
    ],
  }));

  render(<NolmeAppRoute />);
  fireEvent.click(await screen.findByRole('button', { name: /Open session cool!! what do you mean/i }));

  expect(await screen.findByText('Agent "Competitive landscape and major players research" completed')).toBeInTheDocument();
  expect(screen.getByText('Completed task output')).toBeInTheDocument();
  expect(screen.queryByText('No deliverables yet')).not.toBeInTheDocument();
});

it('projects normalized task_notification messages into the /app deliverables pane', async () => {
  unifiedSessionMessagesSpy.mockReturnValue(jsonResponse({
    messages: [
      {
        id: 'task-notification-1',
        sessionId: 'claude-session-1',
        provider: 'claude',
        kind: 'task_notification',
        status: 'completed',
        summary: 'Research report completed',
        timestamp: '2026-04-29T12:59:00.000Z',
      },
    ],
  }));

  render(<NolmeAppRoute />);
  fireEvent.click(await screen.findByRole('button', { name: /Open session cool!! what do you mean/i }));

  expect(await screen.findByText('Research report completed')).toBeInTheDocument();
  expect(screen.getByText('Completed task output')).toBeInTheDocument();
});
```

Expected first failure: the right panel still shows "No deliverables yet".

#### Green: Minimal Implementation

File: `src/components/nolme-app/view/NolmeAppRoute.tsx`

Add session-derived deliverable extraction and merge it into `rightPanelRunState` when no matching live run deliverables exist.

Planned function contract:

```ts
/**
 * @rr.id 2d959f04-e1c9-44dd-a835-d445e35b7b21
 * @rr.alias nolme-app.deliverables.from-completed-artifact-sources
 * @path.id session-artifact-source-to-deliverable
 * @gwt.given raw normalized selected-session messages contain completed artifact output
 * @gwt.when /app derives session deliverables before transcript-only mapping
 * @gwt.then completed artifact output is exposed as AlgorithmDeliverable rows
 * @reads 2d959f04-e1c9-44dd-a835-d445e35b7b21
 * @writes 2d959f04-e1c9-44dd-a835-d445e35b7b21
 * @raises 984f2965-a9a1-45cc-a8ec-6ec3c44959bc:session_refresh_failed
 * @schema.contract N/A
 */
```

Implementation notes:

- Keep parsing narrowly scoped to the supported source model in the Implementation Contracts section.
- Use a safe tag/JSON extraction helper that returns `null` on malformed content.
- Only emit deliverables for completed statuses.
- Keep Deliverables as index rows. Use `result` only to derive title/subtitle. Do not add `body` to `AlgorithmDeliverable`.
- Store derived deliverables in route state or derive them from raw normalized messages in the shared loader.

#### Refactor

- Move parsing to `src/components/nolme-app/view/nolmeAppSessionArtifacts.ts` if it becomes more than a few small functions. Keep the UI test as behavior-level proof.

### Success Criteria

- Targeted command passes: `npm test -- tests/generated/test_nolme_app_route.spec.tsx -t "deliverables pane"`
- Malformed notification handling and dedupe are covered by either helper unit tests or extra UI cases.

## Behavior 4: Assistant Final Report Text Can Produce A Fallback Deliverable

### Resource Registry Binding

- `resource_id`: `358a9fd7-b1de-4943-b198-70c1e3d48f4a` `[PROPOSED]`
- `address_alias`: `nolme-app.deliverables.from-final-report-text` `[PROPOSED]`
- `predicate_refs`: assistant text containing a report-delivered marker or report heading, no completed task notification deliverable
- `codepath_ref`: `src/components/nolme-app/view/NolmeAppRoute.tsx::derive-session-deliverables` `[PROPOSED]`
- `schema_contract_refs`: `N/A`

### Schema Interface Mapping

- `loop_mode`: `low_context_detail`
- `mapped_contracts`: `N/A`
- `registry_updates`: attach future final-output schema refs to proposed resource `358a9fd7-b1de-4943-b198-70c1e3d48f4a`

### Test Specification

Given a selected session transcript has no completed task/artifact deliverable, but the latest assistant message includes `REPORT DELIVERED` and a markdown report heading.

When `/app` loads or refreshes the session.

Then the Deliverables pane shows one derived report deliverable using the first markdown heading or a stable fallback title.

Edge cases:

- Do not create fallback deliverables for ordinary assistant chat.
- Do not duplicate a fallback report if a completed task/artifact source already produced a deliverable for the same final output.

### TDD Cycle

#### Red: Write Failing Test

File: `tests/generated/test_nolme_app_route.spec.tsx`

```tsx
it('uses final assistant report text as a fallback deliverable when no task artifact exists', async () => {
  unifiedSessionMessagesSpy.mockReturnValue(jsonResponse({
    messages: [
      {
        id: 'final-report',
        sessionId: 'claude-session-1',
        provider: 'claude',
        kind: 'text',
        role: 'assistant',
        timestamp: '2026-04-29T12:59:00.000Z',
        content: 'REPORT DELIVERED\n\n# Recruiting Agency Market Report\n\nFinal findings...',
      },
    ],
  }));

  render(<NolmeAppRoute />);
  fireEvent.click(await screen.findByRole('button', { name: /Open session cool!! what do you mean/i }));

  expect(await screen.findByText('Recruiting Agency Market Report')).toBeInTheDocument();
  expect(screen.getByText('Final assistant report')).toBeInTheDocument();
});
```

Expected first failure: no deliverable row is rendered for final assistant output.

#### Green: Minimal Implementation

File: `src/components/nolme-app/view/NolmeAppRoute.tsx`

Extend the same deliverable derivation helper with a fallback final-report detector.

Planned function contract:

```ts
/**
 * @rr.id 358a9fd7-b1de-4943-b198-70c1e3d48f4a
 * @rr.alias nolme-app.deliverables.from-final-report-text
 * @path.id session-final-report-to-deliverable
 * @gwt.given selected-session assistant text contains a final report marker and no completed task artifact deliverable exists
 * @gwt.when /app derives right-panel deliverables from the selected transcript
 * @gwt.then one fallback report deliverable is rendered
 * @reads 358a9fd7-b1de-4943-b198-70c1e3d48f4a
 * @writes 358a9fd7-b1de-4943-b198-70c1e3d48f4a
 * @raises 984f2965-a9a1-45cc-a8ec-6ec3c44959bc:session_refresh_failed
 * @schema.contract N/A
 */
```

Implementation notes:

- Detect final output only when text contains a strong marker such as `REPORT DELIVERED` or the Algorithm final-output marker already observed in the research.
- Extract the first markdown H1/H2 after the marker as title.
- Use `Final assistant report` as subtitle and `document` as tone.
- Do not emit this fallback if completed task/artifact deliverables already exist.

#### Refactor

- Keep final-report heuristics behind a pure helper so future Algorithm event schema work can replace it without touching the right-panel component.

### Success Criteria

- Targeted command passes: `npm test -- tests/generated/test_nolme_app_route.spec.tsx -t "final assistant report"`
- Existing phase derivation test still passes because report parsing must not interfere with `deriveAlgorithmRunStateFromText()`.

## Behavior 5: Right-Panel Deliverable Source Precedence Is Scoped To The Selected Session

### Resource Registry Binding

- `resource_id`: `a6339adc-8f76-4b93-9ae4-137db9700073` `[PROPOSED]`
- `address_alias`: `nolme-app.deliverables.selected-session-run-state-precedence` `[PROPOSED]`
- `predicate_refs`: active Algorithm run state, run-state sessionId, selected session id, selected transcript deliverables
- `codepath_ref`: `src/components/nolme-app/view/NolmeAppRoute.tsx::select-right-panel-run-state` `[PROPOSED]`
- `schema_contract_refs`: `N/A`

### Schema Interface Mapping

- `loop_mode`: `low_context_detail`
- `mapped_contracts`: `N/A`
- `registry_updates`: attach future Algorithm run state schema refs to proposed resource `a6339adc-8f76-4b93-9ae4-137db9700073`

### Test Specification

Given `runState.deliverables` contains `Run summary`, and the selected session transcript also contains a completed artifact source.

When the run state is explicitly active through the URL `runId` or `runState.sessionId` matches the selected session.

Then the right panel shows live run-state deliverables and does not replace them with session-derived deliverables.

When the run state exists only because of stale localStorage and `runState.sessionId` does not match the selected session.

Then the selected session-derived deliverable wins.

Edge cases:

- If `runState.deliverables` is empty or absent, session-derived deliverables can fill the pane.
- If `runState` only has phases but no deliverables, derived deliverables can still render alongside derived/live phase state.

### TDD Cycle

#### Red: Extend Existing Run-State Test And Add Stale-Run Test

File: `tests/generated/test_nolme_app_route.spec.tsx`

Extend `renders live phases and deliverables from an active Algorithm run`:

```tsx
expect(screen.getByText('Run summary')).toBeInTheDocument();
expect(screen.queryByText('Agent "Competitive landscape and major players research" completed')).not.toBeInTheDocument();
```

Add:

```tsx
it('does not let stale localStorage run deliverables hide the selected session deliverable', async () => {
  localStorage.setItem('nolme-active-algorithm-run-id', 'alg_stale');
  algorithmRunStateSpy.mockReturnValue(jsonResponse({
    state: {
      runId: 'alg_stale',
      provider: 'claude',
      status: 'completed',
      sessionId: 'different-session',
      deliverables: [{ id: 'stale', title: 'Stale run artifact', subtitle: 'Old run', tone: 'document' }],
    },
  }));
  unifiedSessionMessagesSpy.mockReturnValue(jsonResponse({
    messages: [
      {
        id: 'task-notification-1',
        sessionId: 'claude-session-1',
        provider: 'claude',
        kind: 'task_notification',
        status: 'completed',
        summary: 'Selected session report completed',
        timestamp: '2026-04-29T12:59:00.000Z',
      },
    ],
  }));

  render(<NolmeAppRoute />);
  fireEvent.click(await screen.findByRole('button', { name: /Open session cool!! what do you mean/i }));

  expect(await screen.findByText('Selected session report completed')).toBeInTheDocument();
  expect(screen.queryByText('Stale run artifact')).not.toBeInTheDocument();
});
```

Expected first failure after adding derived deliverables: stale localStorage run-state deliverables can hide selected-session deliverables.

#### Green: Minimal Implementation

File: `src/components/nolme-app/view/NolmeAppRoute.tsx`

Replace the ad hoc `rightPanelRunState` merge with `selectRightPanelRunState(...)`.

Planned function contract:

```ts
/**
 * @rr.id a6339adc-8f76-4b93-9ae4-137db9700073
 * @rr.alias nolme-app.deliverables.selected-session-run-state-precedence
 * @path.id right-panel-deliverables-source-precedence
 * @gwt.given live run state and selected-session derived deliverables are both available
 * @gwt.when /app computes the right-panel run state
 * @gwt.then live deliverables win only for explicit run mode or matching run/session identity
 * @reads a6339adc-8f76-4b93-9ae4-137db9700073
 * @writes a6339adc-8f76-4b93-9ae4-137db9700073
 * @raises 984f2965-a9a1-45cc-a8ec-6ec3c44959bc:session_refresh_failed
 * @schema.contract N/A
 */
```

Implementation notes:

- Track `explicitRunMode` from the initial URL, not from localStorage.
- If `runState?.deliverables?.length` and the run is explicit or session-matched, pass live deliverables.
- Otherwise, use selected session-derived deliverables.
- Preserve phase information from `derivedRunState` and matching `runState` exactly as the current merge does.
- Avoid pushing session-derived deliverables into server run state.

#### Refactor

- Keep source-precedence logic pure and covered by tests if moved out of the component.

### Success Criteria

- Existing active Algorithm run test still passes.
- Stale-localStorage run test passes.
- No duplicate deliverable rows render.

## Behavior 6: Refresh Errors Are Visible But Do Not Clear The Current Transcript

### Resource Registry Binding

- `resource_id`: `e611b38a-ecda-4a42-ba0b-c26e035bc644` `[PROPOSED]`
- `address_alias`: `nolme-app.selected-session.refresh-error-preserves-transcript` `[PROPOSED]`
- `predicate_refs`: selected session, matching project update, failed unified messages response
- `codepath_ref`: `src/components/nolme-app/view/NolmeAppRoute.tsx::load-selected-session-messages` `[PROPOSED]`
- `schema_contract_refs`: `N/A`

### Schema Interface Mapping

- `loop_mode`: `low_context_detail`
- `mapped_contracts`: `N/A`
- `registry_updates`: attach future error-response schema refs to proposed resource `e611b38a-ecda-4a42-ba0b-c26e035bc644`

### Test Specification

Given `/app` has already rendered `Existing answer`.

When a matching session-file update triggers a refresh and `api.unifiedSessionMessages` returns `ok: false` with `{ error: 'Failed to fetch messages' }`.

Then `/app` maps that response to the UI error `Failed to load session claude-session-1`, shows the error through the existing `runError` surface, and keeps `Existing answer` visible.

Edge cases:

- A later successful current refresh clears the refresh error.
- A failed background refresh must not set `loadingSessionId` forever.
- A failed stale refresh is ignored under Behavior 7.

### TDD Cycle

#### Red: Write Failing Test

File: `tests/generated/test_nolme_app_route.spec.tsx`

```tsx
it('keeps the current /app transcript visible when a background session refresh fails', async () => {
  const { rerender } = render(<NolmeAppRoute />);
  fireEvent.click(await screen.findByRole('button', { name: /Open session cool!! what do you mean/i }));
  expect(await screen.findByText('Existing answer')).toBeInTheDocument();

  unifiedSessionMessagesSpy.mockReturnValueOnce(jsonResponse({ error: 'Failed to fetch messages' }, false));
  webSocketState.latestMessage = {
    type: 'projects_updated',
    changedFile: 'demo-project/claude-session-1.jsonl',
    projects: [],
  };
  rerender(<NolmeAppRoute />);

  expect(await screen.findByText(/Failed to load session claude-session-1/i)).toBeInTheDocument();
  expect(screen.getByText('Existing answer')).toBeInTheDocument();
});
```

Expected first failure depends on Behavior 1 implementation. Without explicit preservation, the loader may clear or replace transcript state incorrectly.

#### Green: Minimal Implementation

File: `src/components/nolme-app/view/NolmeAppRoute.tsx`

Make `loadSelectedSessionMessages` update `chatMessages`, raw messages, and derived deliverables only after a successful current fetch and parse.

Planned function contract:

```ts
/**
 * @rr.id e611b38a-ecda-4a42-ba0b-c26e035bc644
 * @rr.alias nolme-app.selected-session.refresh-error-preserves-transcript
 * @path.id selected-app-session-refresh-error
 * @gwt.given /app has a visible selected-session transcript
 * @gwt.when a matching background refresh fails
 * @gwt.then the previous transcript remains visible and an error message is surfaced
 * @reads e611b38a-ecda-4a42-ba0b-c26e035bc644
 * @writes e611b38a-ecda-4a42-ba0b-c26e035bc644
 * @raises 984f2965-a9a1-45cc-a8ec-6ec3c44959bc:session_refresh_failed
 * @schema.contract N/A
 */
```

Implementation notes:

- Do not clear `chatMessages` before a background refresh.
- Keep initial `openSession()` spinner behavior, but only replace messages after a successful response.
- Map all non-ok responses to `Failed to load session ${session.id}` in UI state.
- Clear `runError` on the next successful current refresh.

#### Refactor

- Keep error text specific enough for tests and useful for users.

### Success Criteria

- Targeted command passes: `npm test -- tests/generated/test_nolme_app_route.spec.tsx -t "background session refresh fails"`
- Behavior 1, Behavior 2, and Behavior 7 still pass.

## Behavior 7: Overlapping Background Refreshes Are Last-Write-Wins

### Resource Registry Binding

- `resource_id`: `2b031d6f-0534-47d0-b524-daca69bf4bc9` `[PROPOSED]`
- `address_alias`: `nolme-app.selected-session.refresh-ordering` `[PROPOSED]`
- `predicate_refs`: selected session, two matching project updates, two unresolved unified messages requests
- `codepath_ref`: `src/components/nolme-app/view/NolmeAppRoute.tsx::load-selected-session-messages-request-sequence` `[PROPOSED]`
- `schema_contract_refs`: `N/A`

### Schema Interface Mapping

- `loop_mode`: `low_context_detail`
- `mapped_contracts`: `N/A`
- `registry_updates`: attach future refresh-ordering schema refs to proposed resource `2b031d6f-0534-47d0-b524-daca69bf4bc9`

### Test Specification

Given `/app` has opened `claude-session-1`.

When two matching `projects_updated` messages trigger two background refreshes and the newer request resolves before the older request.

Then the newer response remains visible and the older response is ignored when it resolves later.

Edge cases:

- A stale failed response must not show an error over a newer success.
- A stale successful response must not overwrite `chatMessages`, `derivedRunState`, or `sessionDerivedDeliverables`.

### TDD Cycle

#### Red: Write Failing Test

File: `tests/generated/test_nolme_app_route.spec.tsx`

```tsx
it('ignores stale selected-session refresh responses that resolve out of order', async () => {
  const firstRefresh = deferredResponse();
  const secondRefresh = deferredResponse();
  const { rerender } = render(<NolmeAppRoute />);

  fireEvent.click(await screen.findByRole('button', { name: /Open session cool!! what do you mean/i }));
  await screen.findByText('Existing answer');

  unifiedSessionMessagesSpy
    .mockReturnValueOnce(firstRefresh.promise)
    .mockReturnValueOnce(secondRefresh.promise);

  webSocketState.latestMessage = {
    type: 'projects_updated',
    changedFile: 'demo-project/claude-session-1.jsonl',
    projects: [],
  };
  rerender(<NolmeAppRoute />);

  webSocketState.latestMessage = {
    type: 'projects_updated',
    changedFile: 'demo-project/claude-session-1.jsonl',
    projects: [],
    timestamp: '2026-04-29T13:00:01.000Z',
  };
  rerender(<NolmeAppRoute />);

  secondRefresh.resolve(jsonResponse({
    messages: [
      { id: 'newer', sessionId: 'claude-session-1', provider: 'claude', kind: 'text', role: 'assistant', content: 'Newer response', timestamp: '2026-04-29T13:00:01.000Z' },
    ],
  }));
  expect(await screen.findByText('Newer response')).toBeInTheDocument();

  firstRefresh.resolve(jsonResponse({
    messages: [
      { id: 'older', sessionId: 'claude-session-1', provider: 'claude', kind: 'text', role: 'assistant', content: 'Older response', timestamp: '2026-04-29T13:00:00.000Z' },
    ],
  }));
  await act(async () => {});

  expect(screen.getByText('Newer response')).toBeInTheDocument();
  expect(screen.queryByText('Older response')).not.toBeInTheDocument();
});
```

Expected first failure: without request sequencing, the older response can overwrite the newer response.

#### Green: Minimal Implementation

File: `src/components/nolme-app/view/NolmeAppRoute.tsx`

Add `sessionRefreshRequestIdRef` and apply response state only when the request is current.

Planned function contract:

```ts
/**
 * @rr.id 2b031d6f-0534-47d0-b524-daca69bf4bc9
 * @rr.alias nolme-app.selected-session.refresh-ordering
 * @path.id selected-app-session-refresh-last-write-wins
 * @gwt.given overlapping selected-session refresh requests are in flight
 * @gwt.when an older request resolves after a newer request
 * @gwt.then stale response state is ignored and the newest applied response remains visible
 * @reads 2b031d6f-0534-47d0-b524-daca69bf4bc9
 * @writes 2b031d6f-0534-47d0-b524-daca69bf4bc9
 * @raises 984f2965-a9a1-45cc-a8ec-6ec3c44959bc:session_refresh_failed
 * @schema.contract N/A
 */
```

Implementation notes:

- Increment the request id for every `loadSelectedSessionMessages` call.
- Capture the target `session.id`.
- Before applying success or failure state, confirm both `requestId === sessionRefreshRequestIdRef.current` and the current selected/chat session still matches.
- Initial `openSession()` calls also use this sequence so switching sessions cannot apply old messages to the new selection.

#### Refactor

- If tests need `deferredResponse()`, add it locally to `tests/generated/test_nolme_app_route.spec.tsx`.

### Success Criteria

- Targeted command passes: `npm test -- tests/generated/test_nolme_app_route.spec.tsx -t "out of order"`
- Behavior 1 and Behavior 6 still pass.

## Integration and Regression Testing

Run these after all behavior slices are green:

```bash
npm test -- tests/generated/test_nolme_app_route.spec.tsx
npm test -- tests/generated/test_use_session_broadcast.spec.tsx
npm run typecheck
```

Manual verification:

- Start the app with the existing dev workflow.
- Open `http://localhost:5173/app`.
- Open session `d75f31dc-0e96-4267-aa35-ff7c68f86cdd` or another provider session with completed task output.
- Confirm the session row message count and modified time update after the JSONL changes.
- Confirm the final assistant text appears after the selected session JSONL changes without browser reload.
- Confirm the right-panel Phases still derive from Algorithm text.
- Confirm the right-panel Deliverables pane shows the completed task/report row when no matching live Algorithm run deliverables exist.
- Confirm a live run loaded by `?runId=` still shows server run-state deliverables.
- Confirm a stale `nolme-active-algorithm-run-id` from localStorage does not hide selected-session deliverables for an unrelated session.

## Implementation Order

1. Add Behavior 0 and make `/app` apply `projects_updated.projects` to project/session metadata.
2. Add Behavior 1 and extract a reusable selected-session loader that preserves raw normalized messages.
3. Add Behavior 2 and guard selected transcript refresh by `changedFile` basename.
4. Add Behavior 7 request sequencing so all later loader work is safe against out-of-order responses.
5. Add Behavior 6 refresh-error preservation and explicit error mapping.
6. Add Behavior 3 artifact source parsing and derived Deliverables rows.
7. Add Behavior 4 final assistant report fallback.
8. Add Behavior 5 right-panel source precedence scoped to explicit run mode or matching `runState.sessionId`.

## References

- Review: `thoughts/searchable/shared/plans/2026-04-29-cam-0bb-tdd-nolme-app-session-deliverables-refresh-REVIEW.md`
- Research: `thoughts/searchable/shared/research/2026-04-29-cam-0bb-cc-agent-ui-artifact-deliverables-flow.md`
- Existing `/app` tests: `tests/generated/test_nolme_app_route.spec.tsx`
- `/app` implementation: `src/components/nolme-app/view/NolmeAppRoute.tsx`
- Normal session refresh pattern: `src/hooks/useProjectsState.ts` and `src/components/chat/hooks/useChatSessionState.ts`
- Project watcher broadcast and payload: `server/index.js`
- WebSocket payload types: `src/types/app.ts`
- Unified messages endpoint: `server/routes/messages.js`
- Shared normalized message type: `src/stores/useSessionStore.ts`
- API client: `src/utils/api.js`
