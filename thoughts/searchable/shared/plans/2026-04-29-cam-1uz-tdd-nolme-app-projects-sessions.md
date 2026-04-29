# /app Projects and Sessions TDD Implementation Plan

## Overview

Add a real projects/sessions browser to the `/app` route. When the user clicks the Chat nav icon, `/app` should show projects and saved sessions for each project. The user can start a new session, load an existing session inside `/app`, and delete existing sessions supported by the current backend APIs.

## Current State Analysis

`/app` currently treats the Chat panel as the composer/conversation surface. The nav state only has `search`, `chat`, and `tasks`, so clicking Chat cannot distinguish "show project/session browser" from "show current conversation".

### Key Discoveries

- `/app` has a local `Project` type with only `name`, `displayName`, `path`, and `fullPath`, so it discards `sessions`, provider session arrays, and `sessionMeta` returned by `/api/projects`: `src/components/nolme-app/view/NolmeAppRoute.tsx:31`.
- `/app` already fetches projects from `api.projects()` but only stores them as that narrow local shape: `src/components/nolme-app/view/NolmeAppRoute.tsx:227`.
- The current Chat nav branch renders `ChatPanel`, while Search and Tasks render their own panels: `src/components/nolme-app/view/NolmeAppRoute.tsx:560`.
- Existing sidebar project sessions already implement the desired interaction shape: "New Session", session rows, "Show more", and per-row delete/edit affordances: `src/components/sidebar/view/subcomponents/SidebarProjectSessions.tsx:96`.
- Existing sidebar session rows already display provider logo, last modified time, and message count using `SessionProviderLogo`, `formatTimeAgo`, and `createSessionViewModel`: `src/components/sidebar/view/subcomponents/SidebarSessionItem.tsx:49`.
- API helpers already cover `/api/projects`, project session pagination, unified session messages, Claude delete, Codex delete, and Gemini delete: `src/utils/api.js:54`.
- There is no Cursor session delete API in `server/routes/cursor.js`; existing sidebar hides Cursor delete. `/app` should match that backend reality.
- This repo has no `specs/schemas/resource_registry.json` and no `schema/`, `schemas/`, or `specs/schemas/` directories. Registry and schema bindings below are therefore marked `[PROPOSED]` or `N/A`.

## Desired End State

When the user clicks Chat in `/app`, they see a project/session browser that resembles the existing cc-agent-ui sidebar behavior but uses the `/app` visual language. Expanding a project shows a New Session action and saved sessions. Session rows show provider logo, title, message count, and relative last modified time. New Session opens the `/app` composer scoped to that project. Loading an existing session fetches its history into `/app` and subsequent sends resume that session. Deleting a supported session removes it from the UI after a successful backend delete.

### Observable Behaviors

- Given `/api/projects` returns projects with sessions, when the user clicks Chat, then `/app` shows project rows and expandable session rows.
- Given an expanded project, when the user clicks New Session, then `/app` opens the composer with that project selected and no session resume id.
- Given an existing session, when the user clicks that session, then `/app` fetches unified session messages, displays them, stores the session id, and resumes that session on the next send.
- Given a deletable session, when the user deletes it and confirms, then `/app` calls the provider-specific delete API and removes the session from the browser.
- Given a project with additional Claude sessions, when the user clicks Show more sessions, then `/app` appends the next page from `api.sessions(projectName, 5, offset)`.

## What We Are Not Doing

- Replacing the existing cc-agent-ui sidebar.
- Adding project rename, project delete, or project creation to `/app`.
- Adding Cursor session deletion until a backend delete endpoint exists.
- Implementing full chat message rendering parity with the main `/session/:id` route.
- Redirecting loaded sessions to `/session/:id`; the user confirmed loading should stay inside `/app`.

## Testing Strategy

- Framework: Vitest with React Testing Library.
- Primary test file: `tests/generated/test_nolme_app_route.spec.tsx`.
- Mocking: continue mocking `api`, `authenticatedFetch`, `useWebSocket`, and `Settings`.
- TDD order: browser rendering, new session selection, existing session loading, deletion, pagination, send/resume integration.

## Behavior 1: Chat Nav Shows Project And Session Browser

### Resource Registry Binding

- `resource_id`: `[PROPOSED] nolme-app-project-session-browser`
- `address_alias`: `nolme.app.projects.sessions.browser`
- `predicate_refs`: `projects-api-response`, `chat-nav-click`
- `codepath_ref`: `src/components/nolme-app/view/NolmeAppRoute.tsx::NavPanel -> ProjectsPanel`
- `schema_contract_refs`: `N/A`

### Schema Interface Mapping

- `loop_mode`: `summary`
- `mapped_contracts`: `Project`, `ProjectSession`, `SessionProvider` -> `[PROPOSED] nolme-app-project-session-browser`
- `registry_updates`: `[PROPOSED] schema_refs unavailable because repo has no schema registry`

### Test Specification

Given `/api/projects` returns a project with Claude, Codex, and Gemini sessions, when the user clicks the Chat nav button, then `/app` renders project rows and session rows with provider logo labels, message counts, and last modified text.

### TDD Cycle

#### Red: Write Failing Test

File: `tests/generated/test_nolme_app_route.spec.tsx`

Add a test that renders `/app`, clicks Chat, expands a project if needed, and asserts:

- project display name appears
- path appears
- session title appears
- message count appears
- provider logo accessible text or provider marker appears
- relative last modified text appears

#### Green: Minimal Implementation

File: `src/components/nolme-app/view/NolmeAppRoute.tsx`

- Replace the local `Project` type with imports from `src/types/app`.
- Add a `chatView: 'projects' | 'composer'` state.
- Make Chat nav selection set `activePanel = 'chat'` and `chatView = 'projects'`.
- Add `ProjectsPanel`, `ProjectRow`, and `SessionRow` inside the route file or adjacent app-specific subcomponents.
- Use `getAllSessions`, `createSessionViewModel`, `formatTimeAgo`, and `SessionProviderLogo`.

Documentation Contract:

```ts
/**
 * @rr.id [PROPOSED] nolme-app-project-session-browser
 * @rr.alias nolme.app.projects.sessions.browser
 * @path.id nolme-app-chat-nav-project-browser
 * @gwt.given projects have saved provider sessions
 * @gwt.when user clicks the Chat nav icon
 * @gwt.then project and session browser is visible
 * @reads Project[], ProjectSession[]
 * @writes chatView
 * @raises N/A
 * @schema.contract N/A
 */
```

#### Refactor

- Keep row formatting helpers small and pure.
- Keep `/app` CSS scoped under `nolme-app__`.

## Behavior 2: New Session Opens Composer For Selected Project

### Resource Registry Binding

- `resource_id`: `[PROPOSED] nolme-app-new-session-selection`
- `address_alias`: `nolme.app.projects.sessions.new`
- `predicate_refs`: `expanded-project`, `new-session-click`
- `codepath_ref`: `NolmeAppRoute::handleNewSession`
- `schema_contract_refs`: `N/A`

### Test Specification

Given the projects browser is showing an expanded project, when the user clicks New Session, then the composer appears, the project is selected, `chatSessionId` is cleared, and sending a message uses that project's `projectPath` and `cwd`.

### TDD Cycle

#### Red

File: `tests/generated/test_nolme_app_route.spec.tsx`

Add a test that clicks New Session, enters a prompt, sends it, and expects the websocket payload to contain the selected project path and no `resume: true`.

#### Green

File: `src/components/nolme-app/view/NolmeAppRoute.tsx`

- Add `selectedProject` and `selectedSession` state.
- Add `handleNewSession(project)`.
- Update `handleSendPrompt` to use `selectedProject.fullPath || selectedProject.path`.
- Disable or guard Send when no project is selected.

Documentation Contract:

```ts
/**
 * @rr.id [PROPOSED] nolme-app-new-session-selection
 * @rr.alias nolme.app.projects.sessions.new
 * @path.id nolme-app-new-session-selects-project
 * @gwt.given a project is available in the browser
 * @gwt.when user clicks New Session
 * @gwt.then composer opens scoped to that project without resume session id
 * @reads Project
 * @writes selectedProject, selectedSession, chatSessionId, chatView
 * @raises N/A
 * @schema.contract N/A
 */
```

#### Refactor

- Centralize project path extraction in `getProjectPath(project)`.

## Behavior 3: Existing Session Loads In /app And Resumes On Send

### Resource Registry Binding

- `resource_id`: `[PROPOSED] nolme-app-session-load-resume`
- `address_alias`: `nolme.app.projects.sessions.load`
- `predicate_refs`: `session-row-click`
- `codepath_ref`: `NolmeAppRoute::handleSessionSelect`
- `schema_contract_refs`: `N/A`

### Test Specification

Given a saved session row, when the user clicks it, then `/app` calls `api.unifiedSessionMessages(sessionId, provider, { projectName, projectPath })`, renders normalized text messages, stores `chatSessionId`, and the next send includes `sessionId` and `resume: true`.

### TDD Cycle

#### Red

File: `tests/generated/test_nolme_app_route.spec.tsx`

Add a test with an existing session and mocked normalized messages. Assert the loaded user/assistant messages render and subsequent send resumes the selected session.

#### Green

File: `src/components/nolme-app/view/NolmeAppRoute.tsx`

- Add a local `NormalizedMessage` subset type.
- Add `loadSessionMessages(session, project)` that maps normalized `text`, `stream_delta`, and `error` messages into `ChatTranscriptItem`.
- Set `selectedProject`, `selectedSession`, `chatSessionId`, `selected-provider`, and `chatView = 'composer'`.
- Preserve the existing realtime websocket handling.

Documentation Contract:

```ts
/**
 * @rr.id [PROPOSED] nolme-app-session-load-resume
 * @rr.alias nolme.app.projects.sessions.load
 * @path.id nolme-app-load-existing-session
 * @gwt.given a saved session exists for a project
 * @gwt.when user clicks the session row
 * @gwt.then messages load inside /app and future sends resume the session
 * @reads Project, ProjectSession, NormalizedMessage[]
 * @writes selectedProject, selectedSession, chatSessionId, chatMessages, chatView
 * @raises session-load-error
 * @schema.contract N/A
 */
```

#### Refactor

- Extract `normalizedMessageToTranscriptItem` as a pure helper if the mapping grows.

## Behavior 4: Delete Supported Existing Session

### Resource Registry Binding

- `resource_id`: `[PROPOSED] nolme-app-session-delete`
- `address_alias`: `nolme.app.projects.sessions.delete`
- `predicate_refs`: `session-delete-click`, `delete-confirm`
- `codepath_ref`: `NolmeAppRoute::handleDeleteSession`
- `schema_contract_refs`: `N/A`

### Test Specification

Given a Claude, Codex, or Gemini session row, when the user clicks delete and confirms, then `/app` calls the matching API helper and removes the session from local project state. If the deleted session is selected, the composer returns to an unselected/new state.

### TDD Cycle

#### Red

File: `tests/generated/test_nolme_app_route.spec.tsx`

Add tests for Claude and Codex/Gemini deletion. Mock `window.confirm`. Assert the correct API helper is called and the row disappears.

#### Green

File: `src/components/nolme-app/view/NolmeAppRoute.tsx`

- Add provider-aware delete function.
- Add immutable project state removal for `sessions`, `codexSessions`, and `geminiSessions`.
- Hide or disable delete for Cursor until backend support exists.

Documentation Contract:

```ts
/**
 * @rr.id [PROPOSED] nolme-app-session-delete
 * @rr.alias nolme.app.projects.sessions.delete
 * @path.id nolme-app-delete-existing-session
 * @gwt.given a supported provider session exists
 * @gwt.when user confirms deletion
 * @gwt.then backend delete is called and local row is removed
 * @reads ProjectSession.__provider
 * @writes projects, selectedSession, chatSessionId
 * @raises delete-session-error
 * @schema.contract N/A
 */
```

#### Refactor

- Keep provider routing aligned with existing sidebar behavior.

## Behavior 5: Load More Claude Sessions

### Resource Registry Binding

- `resource_id`: `[PROPOSED] nolme-app-session-pagination`
- `address_alias`: `nolme.app.projects.sessions.pagination`
- `predicate_refs`: `project-sessionMeta-hasMore`
- `codepath_ref`: `NolmeAppRoute::handleLoadMoreSessions`
- `schema_contract_refs`: `N/A`

### Test Specification

Given a project has `sessionMeta.hasMore = true`, when the user clicks Show more sessions, then `/app` requests the next page and appends returned Claude sessions while updating `hasMore`.

### TDD Cycle

#### Red

File: `tests/generated/test_nolme_app_route.spec.tsx`

Add a test where the project starts with one session and `hasMore: true`; click Show more and assert `api.sessions(project.name, 5, 1)` is called and the new row appears.

#### Green

File: `src/components/nolme-app/view/NolmeAppRoute.tsx`

- Add `loadingSessionsByProject`.
- Compute current Claude session offset from `project.sessions.length`.
- Append returned sessions into that project and update `sessionMeta.hasMore`.

Documentation Contract:

```ts
/**
 * @rr.id [PROPOSED] nolme-app-session-pagination
 * @rr.alias nolme.app.projects.sessions.pagination
 * @path.id nolme-app-load-more-sessions
 * @gwt.given a project has additional sessions
 * @gwt.when user clicks Show more sessions
 * @gwt.then next page is appended to that project
 * @reads Project.sessionMeta
 * @writes projects, loadingSessionsByProject
 * @raises N/A
 * @schema.contract N/A
 */
```

#### Refactor

- Avoid mutating project objects in place.

## Integration Verification

### Automated

- Red tests fail before implementation: `npm test -- tests/generated/test_nolme_app_route.spec.tsx`
- Green focused tests pass: `npm test -- tests/generated/test_nolme_app_route.spec.tsx`
- TypeScript passes: `npm run typecheck`
- Lint touched component: `npx eslint src/components/nolme-app/view/NolmeAppRoute.tsx`
- Full suite and build pass: `npm test && npm run build`

### Manual

- Open `/app`, click Chat, and verify project/session browser appears.
- Expand projects and confirm rows match expected visual hierarchy.
- Start New Session and verify prompt sends to selected project.
- Load an existing session and verify prior messages appear without redirect.
- Delete a supported session and verify it disappears after confirmation.

## References

- Beads issue: `cam-1uz`
- Existing app route: `src/components/nolme-app/view/NolmeAppRoute.tsx`
- Sidebar project sessions pattern: `src/components/sidebar/view/subcomponents/SidebarProjectSessions.tsx`
- Sidebar session row pattern: `src/components/sidebar/view/subcomponents/SidebarSessionItem.tsx`
- Sidebar session helpers: `src/components/sidebar/utils/utils.ts`
- API helpers: `src/utils/api.js`
