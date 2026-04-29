# /app Session Refresh and Deliverables TDD Implementation Plan

## Overview

The `/app` route currently renders project sessions and Algorithm phases, but selected sessions are loaded once and then become stale. When a Claude/cc-agent-ui session continues outside the initial load, `/app` does not refresh the transcript from the changed project JSONL, so the final assistant response and completed artifact output do not appear. The right-panel Deliverables pane also only reads `runState.deliverables`; selected provider sessions without an active Algorithm run never project completed task/artifact output into the pane.

This plan uses TDD to make `/app` behave like a working session UI instead of a hard-coded Figma shell:

- Refresh the selected `/app` session when the project watcher reports that the selected session file changed.
- Keep unrelated project/session updates from causing duplicate fetches.
- Derive Deliverables from completed task/artifact messages in selected session transcripts when no live Algorithm run deliverables exist.
- Preserve live Algorithm run state as the source of truth when `runState.deliverables` is present.

Tracked issue: `cam-ro6`

Source research: `thoughts/searchable/shared/research/2026-04-29-cam-0bb-cc-agent-ui-artifact-deliverables-flow.md`

## Current State Analysis

### Key Discoveries

- `/app` owns its route-local session state in `src/components/nolme-app/view/NolmeAppRoute.tsx:326`, including `projects`, `selectedProject`, `selectedSession`, `chatSessionId`, `chatMessages`, `runState`, and `derivedRunState`.
- Opening a provider session calls `openSession()` at `src/components/nolme-app/view/NolmeAppRoute.tsx:459`, then fetches `api.unifiedSessionMessages(...)` at `src/components/nolme-app/view/NolmeAppRoute.tsx:475` exactly once.
- Loaded session messages are filtered through `toTranscriptItem()` at `src/components/nolme-app/view/NolmeAppRoute.tsx:215`. That helper accepts only normalized `kind: "text"` messages with `role` and `content`, so XML-like `<task-notification>` content remains a raw transcript body if it is present at all.
- Phase progress is derived from assistant text through `deriveAlgorithmRunStateFromText()` at `src/components/nolme-app/view/NolmeAppRoute.tsx:236`. The derived state has phase/task fields only and no deliverables.
- `rightPanelRunState` at `src/components/nolme-app/view/NolmeAppRoute.tsx:362` merges live and derived phase fields, but not session-derived deliverables.
- The right-panel Deliverables section reads only `runState?.deliverables ?? []` at `src/components/nolme-app/view/NolmeAppRoute.tsx:1726`, causing "No deliverables yet" for completed provider sessions with artifact-like transcript output.
- The normal session route already has the update pattern: `useProjectsState` consumes WebSocket `projects_updated` at `src/hooks/useProjectsState.ts:206`, matches `changedFile` to `selectedSession.id` at `src/hooks/useProjectsState.ts:235`, increments `externalMessageUpdate` at `src/hooks/useProjectsState.ts:247`, and `useChatSessionState` refreshes from server at `src/components/chat/hooks/useChatSessionState.ts:402`.
- The server broadcasts `projects_updated` with `changedFile` from the project watcher at `server/index.js:144` and `server/index.js:164`.
- The API client already exposes the needed fetch surface at `src/utils/api.js:58`.
- Existing `/app` route tests use Vitest/jsdom and mock `api`, `useWebSocket`, and `EventSource` in `tests/generated/test_nolme_app_route.spec.tsx`.
- The specific test session evidence was `/home/maceo/.claude/projects/-home-maceo/d75f31dc-0e96-4267-aa35-ff7c68f86cdd.jsonl`; it had a completed `<task-notification>` payload and later assistant `REPORT DELIVERED` text, but no corresponding `.nolme-state.json` sidecar and no Algorithm run-store entry. The UI must therefore derive selected-session deliverables from transcript data when run-state deliverables are absent.

### Registry and Schema Discoveries

- `specs/schemas/resource_registry.json` is missing in this checkout.
- No files were found under `schema/`, `schemas/`, or `specs/schemas/`.
- Resource bindings below are marked as proposed. Each planned function still includes a contract tag block with a stable proposed UUID so the future registry can adopt or replace it.

## Desired End State

When the user is on `/app` and opens a provider-backed project session:

- The transcript refreshes after the selected session JSONL changes.
- The final assistant text appears without reloading the browser.
- Completed task/artifact transcript messages produce visible Deliverables rows in the right panel when no Algorithm run deliverables are available.
- Live Algorithm run deliverables continue to render from run state and are not replaced by derived transcript artifacts.
- Unrelated project/session updates do not fetch or mutate the visible transcript.

## What We Are Not Doing

- Not changing the server watcher protocol or the `/api/sessions/:id/messages` route.
- Not creating or backfilling `.nolme-state.json` sidecars for old sessions.
- Not changing the normal `/session/:id` route refresh flow.
- Not adding a persisted Algorithm run record for provider sessions that were not launched as Algorithm runs.
- Not implementing deep markdown artifact rendering inside the Deliverables pane. This slice only makes the pane show artifact rows with enough metadata to prove the completed output is detected.

## Testing Strategy

- Framework: Vitest with jsdom, React Testing Library, and existing mocks from `tests/generated/test_nolme_app_route.spec.tsx`.
- Test type: UI integration tests for `/app` route behavior because the bug is observable through selected session refresh and right-panel rendering.
- Supporting unit tests: optional pure helper tests if artifact parsing is extracted from the component.
- Primary command: `npm test -- tests/generated/test_nolme_app_route.spec.tsx`
- Broad checks after implementation: `npm test -- tests/generated/test_nolme_app_route.spec.tsx tests/generated/test_use_session_broadcast.spec.tsx`, then `npm run typecheck`.

## Behavior 1: Selected /app Session Refreshes On Its Project File Update

### Resource Registry Binding

- `resource_id`: `ee7119c1-7cfa-47cc-a46d-f123ad81b07d` `[PROPOSED]`
- `address_alias`: `nolme-app.selected-session.refresh-on-project-update` `[PROPOSED]`
- `predicate_refs`: selected project, selected provider session, WebSocket `projects_updated.changedFile`
- `codepath_ref`: `src/components/nolme-app/view/NolmeAppRoute.tsx::selected-session-refresh-effect` `[PROPOSED]`
- `schema_contract_refs`: `N/A` because no schema or registry files exist in this checkout

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

Then `/app` calls `api.unifiedSessionMessages('claude-session-1', 'claude', { projectName: 'demo-project', projectPath: '/workspace/demo-project' })` again and renders the newly returned assistant text.

Edge cases:

- Accept both Unix and Windows separators in `changedFile`.
- Accept `changedFile` values whose final path segment is the selected session filename.
- Keep the selected session id and resume behavior unchanged after refresh.

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

- Extract the body of `openSession()` fetch/mapping into a local `loadSelectedSessionMessages(project, session)` callback.
- In a new `useEffect`, ignore messages without `type: "projects_updated"`, without a selected project/session, or while `isStartingRun` is true.
- Normalize `changedFile.replace(/\\/g, '/')`, take the basename, strip `.jsonl`, and compare to `selectedSession.id`.
- On match, call `loadSelectedSessionMessages(selectedProject, selectedSession, { showSpinner: false })`.

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

Then `/app` does not call `api.unifiedSessionMessages` again and the visible transcript remains unchanged.

Edge cases:

- Missing `changedFile` does not refresh the selected session.
- `changeType: "fork"` without a `changedFile` updates project metadata only if needed, but does not reload transcript.

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

  await waitFor(() => expect(unifiedSessionMessagesSpy).toHaveBeenCalledTimes(1));
  expect(screen.queryByText('REPORT DELIVERED')).not.toBeInTheDocument();
});
```

Expected first failure after Behavior 1 is a regression guard if the refresh effect reloads on every `projects_updated`.

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

- A pure `doesProjectUpdateTargetSession(message, session)` helper is enough.
- Keep the helper conservative: no refresh without `changedFile`.

#### Refactor

- Use the same helper in future tests for Windows paths and missing file paths.

### Success Criteria

- Targeted command passes: `npm test -- tests/generated/test_nolme_app_route.spec.tsx -t "unrelated project updates"`
- The Behavior 1 refresh test still passes.

## Behavior 3: Completed Task Notifications Become Session-Derived Deliverables

### Resource Registry Binding

- `resource_id`: `2d959f04-e1c9-44dd-a835-d445e35b7b21` `[PROPOSED]`
- `address_alias`: `nolme-app.deliverables.from-completed-task-notification` `[PROPOSED]`
- `predicate_refs`: normalized text message content, `<task-notification>`, `<status>completed</status>`, summary/result fields
- `codepath_ref`: `src/components/nolme-app/view/NolmeAppRoute.tsx::derive-session-deliverables` `[PROPOSED]`
- `schema_contract_refs`: `N/A`

### Schema Interface Mapping

- `loop_mode`: `low_context_detail`
- `mapped_contracts`: `N/A`
- `registry_updates`: attach future task notification/artifact schema refs to proposed resource `2d959f04-e1c9-44dd-a835-d445e35b7b21`

### Test Specification

Given `api.unifiedSessionMessages` returns a user text message containing a completed `<task-notification>` with a `summary` and `result`.

When `/app` opens or refreshes the selected session.

Then the right-panel Deliverables section shows a derived artifact row using the task notification summary as the title and a stable subtitle such as `Completed task output`.

Edge cases:

- Ignore non-completed task notifications.
- Ignore malformed notifications without throwing.
- De-duplicate repeated notifications by task id, tool-use id, or generated content hash.
- Do not show the raw XML-like envelope in the Deliverables row title.

### TDD Cycle

#### Red: Write Failing Test

File: `tests/generated/test_nolme_app_route.spec.tsx`

```tsx
it('projects completed task notification output into the /app deliverables pane', async () => {
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
```

Expected first failure: the right panel still shows "No deliverables yet".

#### Green: Minimal Implementation

File: `src/components/nolme-app/view/NolmeAppRoute.tsx`

Add session-derived deliverable extraction and merge it into `rightPanelRunState` when no live run deliverables exist.

Planned function contract:

```ts
/**
 * @rr.id 2d959f04-e1c9-44dd-a835-d445e35b7b21
 * @rr.alias nolme-app.deliverables.from-completed-task-notification
 * @path.id session-task-notification-to-deliverable
 * @gwt.given normalized selected-session text messages contain completed task notification output
 * @gwt.when /app maps session transcript state
 * @gwt.then completed task output is exposed as AlgorithmDeliverable rows
 * @reads 2d959f04-e1c9-44dd-a835-d445e35b7b21
 * @writes 2d959f04-e1c9-44dd-a835-d445e35b7b21
 * @raises 984f2965-a9a1-45cc-a8ec-6ec3c44959bc:session_refresh_failed
 * @schema.contract N/A
 */
```

Implementation notes:

- Keep parsing narrowly scoped to the known envelope tags: `task-id`, `tool-use-id`, `status`, `summary`, and `result`.
- Use a safe tag extraction helper that returns `null` on malformed content.
- Only emit deliverables for `status` equal to `completed`.
- Use `summary` for `title`, `Completed task output` for `subtitle`, `document` for `tone`, and `result` for `body` if the existing type remains compatible.
- Store derived deliverables in route state or derive them from the raw normalized messages in the shared loader.

#### Refactor

- If the helper becomes more than a few small functions, move it to `src/components/nolme-app/view/nolmeAppSessionArtifacts.ts` and test it directly. Keep the UI test as the behavior-level proof.

### Success Criteria

- Targeted command passes: `npm test -- tests/generated/test_nolme_app_route.spec.tsx -t "completed task notification"`
- Malformed notification handling is covered by either a small unit test or an extra case in the same UI test.

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

Given a selected session transcript has no completed task notification, but the latest assistant message includes `REPORT DELIVERED` and a markdown report heading.

When `/app` loads or refreshes the session.

Then the Deliverables pane shows one derived report deliverable using the first markdown heading or a stable fallback title.

Edge cases:

- Do not create fallback deliverables for ordinary assistant chat.
- Do not duplicate a fallback report if a completed task notification already produced a deliverable for the same final output.

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
- Do not emit this fallback if completed task notification deliverables already exist.

#### Refactor

- Keep final-report heuristics behind a pure helper so future Algorithm event schema work can replace it without touching the right-panel component.

### Success Criteria

- Targeted command passes: `npm test -- tests/generated/test_nolme_app_route.spec.tsx -t "final assistant report"`
- Existing phase derivation test still passes because report parsing must not interfere with `deriveAlgorithmRunStateFromText()`.

## Behavior 5: Live Algorithm Run Deliverables Stay Authoritative

### Resource Registry Binding

- `resource_id`: `a6339adc-8f76-4b93-9ae4-137db9700073` `[PROPOSED]`
- `address_alias`: `nolme-app.deliverables.run-state-precedence` `[PROPOSED]`
- `predicate_refs`: active Algorithm run state with non-empty deliverables, selected transcript with derived deliverables
- `codepath_ref`: `src/components/nolme-app/view/NolmeAppRoute.tsx::right-panel-run-state-merge` `[PROPOSED]`
- `schema_contract_refs`: `N/A`

### Schema Interface Mapping

- `loop_mode`: `low_context_detail`
- `mapped_contracts`: `N/A`
- `registry_updates`: attach future Algorithm run state schema refs to proposed resource `a6339adc-8f76-4b93-9ae4-137db9700073`

### Test Specification

Given `runState.deliverables` contains `Run summary`, and the selected session transcript also contains a completed task notification.

When `/app` renders the right panel.

Then it shows the live run-state deliverables and does not replace them with session-derived deliverables.

Edge cases:

- If `runState.deliverables` is empty or absent, session-derived deliverables can fill the pane.
- If `runState` only has phases but no deliverables, derived deliverables can still render alongside derived/live phase state.

### TDD Cycle

#### Red: Extend Existing Run-State Test

File: `tests/generated/test_nolme_app_route.spec.tsx`

Extend `renders live phases and deliverables from an active Algorithm run`:

```tsx
expect(screen.getByText('Run summary')).toBeInTheDocument();
expect(screen.queryByText('Agent "Competitive landscape and major players research" completed')).not.toBeInTheDocument();
```

If needed, seed `unifiedSessionMessagesSpy` with a completed task notification and open the selected session after the run state is loaded.

Expected first failure after adding derived deliverables: both run-state and derived deliverables may render if precedence is not explicit.

#### Green: Minimal Implementation

File: `src/components/nolme-app/view/NolmeAppRoute.tsx`

Merge deliverables into the state passed to `RightPanel` only when live run deliverables are absent.

Planned function contract:

```ts
/**
 * @rr.id a6339adc-8f76-4b93-9ae4-137db9700073
 * @rr.alias nolme-app.deliverables.run-state-precedence
 * @path.id right-panel-deliverables-source-precedence
 * @gwt.given live run state and selected-session derived deliverables are both available
 * @gwt.when /app computes the right-panel run state
 * @gwt.then non-empty live runState.deliverables remain the authoritative pane source
 * @reads a6339adc-8f76-4b93-9ae4-137db9700073
 * @writes a6339adc-8f76-4b93-9ae4-137db9700073
 * @raises 984f2965-a9a1-45cc-a8ec-6ec3c44959bc:session_refresh_failed
 * @schema.contract N/A
 */
```

Implementation notes:

- Add `sessionDerivedDeliverables` to the dependencies of the `rightPanelRunState` memo.
- If `runState?.deliverables?.length` is greater than zero, pass `runState.deliverables`.
- Else if `derivedRunState` exists, add `deliverables: sessionDerivedDeliverables` to the derived/merged state.
- Else create a minimal right-panel state only when `sessionDerivedDeliverables.length > 0`.

#### Refactor

- Avoid pushing session-derived deliverables into server run state. This is presentation state for selected provider sessions.

### Success Criteria

- Existing active Algorithm run test still passes.
- New precedence assertion passes.
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

When a matching session-file update triggers a refresh and `api.unifiedSessionMessages` returns `ok: false`.

Then `/app` shows a refresh error through the existing `runError` surface and keeps `Existing answer` visible.

Edge cases:

- A later successful refresh clears the refresh error.
- A failed background refresh must not set `loadingSessionId` forever.

### TDD Cycle

#### Red: Write Failing Test

File: `tests/generated/test_nolme_app_route.spec.tsx`

```tsx
it('keeps the current /app transcript visible when a background session refresh fails', async () => {
  const { rerender } = render(<NolmeAppRoute />);
  fireEvent.click(await screen.findByRole('button', { name: /Open session cool!! what do you mean/i }));
  expect(await screen.findByText('Existing answer')).toBeInTheDocument();

  unifiedSessionMessagesSpy.mockReturnValueOnce(jsonResponse({ error: 'unavailable' }, false));
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

Make `loadSelectedSessionMessages` update `chatMessages` only after a successful fetch and parse.

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
- Clear `runError` on the next successful refresh.

#### Refactor

- Keep error text specific enough for tests and useful for users.

### Success Criteria

- Targeted command passes: `npm test -- tests/generated/test_nolme_app_route.spec.tsx -t "background session refresh fails"`
- Behavior 1 and Behavior 2 still pass.

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
- Confirm the final assistant text appears after the session JSONL changes without browser reload.
- Confirm the right-panel Phases still derive from Algorithm text.
- Confirm the right-panel Deliverables pane shows the completed task/report row when no live Algorithm run deliverables exist.
- Confirm a live run loaded by `?runId=` still shows server run-state deliverables.

## Implementation Order

1. Add the selected-session refresh test and make it pass by extracting a reusable session loader.
2. Add the unrelated-update guard test and make it pass with a small path/session matcher.
3. Add the completed task notification deliverables test and make it pass with a conservative artifact parser.
4. Add the final assistant report fallback test and make it pass behind the same derive helper.
5. Add run-state precedence assertions and make `rightPanelRunState` choose live deliverables first.
6. Add refresh-error preservation behavior and make the loader update UI state only after successful fetches.

## References

- Research: `thoughts/searchable/shared/research/2026-04-29-cam-0bb-cc-agent-ui-artifact-deliverables-flow.md`
- Existing `/app` tests: `tests/generated/test_nolme_app_route.spec.tsx`
- `/app` implementation: `src/components/nolme-app/view/NolmeAppRoute.tsx`
- Normal session refresh pattern: `src/hooks/useProjectsState.ts` and `src/components/chat/hooks/useChatSessionState.ts`
- Project watcher broadcast: `server/index.js`
- API client: `src/utils/api.js`
