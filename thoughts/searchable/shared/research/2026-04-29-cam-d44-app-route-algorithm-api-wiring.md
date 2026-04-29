---
date: 2026-04-29T10:41:19-04:00
researcher: IvoryPeak
git_commit: 32b573a783b1762155b0213ccf4e2b67f248a29d
branch: main
repository: cosmic-agent-memory
topic: "Wire the authenticated /app route UI to the Algorithm API for agent output, phases, and deliverables"
tags: [research, codebase, algorithm-runs, nolme-app, app-route, hydration]
status: complete
last_updated: 2026-04-29
last_updated_by: IvoryPeak
related_beads: [cam-d44, cam-b1x, cam-11u]
---

# Research: Wire the authenticated /app route UI to the Algorithm API

**Date**: 2026-04-29T10:41:19-04:00
**Researcher**: IvoryPeak
**Git Commit**: 32b573a783b1762155b0213ccf4e2b67f248a29d
**Branch**: main
**Repository**: cosmic-agent-memory

## Research Question

The `/app` route UI components are created. Now we need to wire them to the Algorithm API to hydrate the UI with agent output, phases, and deliverables. Study the plan to create the Algorithm API: `thoughts/searchable/shared/plans/2026-04-26-algorithm-run-api-boundary.md`.

## Summary

The repository currently has two adjacent pieces needed for the future `/app` hydration work:

1. A protected `/app` React route that renders the full Nolme-style shell from local component state.
2. A protected `/api/algorithm-runs` server API that starts Algorithm runs, stores run state/events, streams events over SSE, and accepts lifecycle/question/permission commands.

The `/app` component is not currently wired to the Algorithm API. Its chat messages, thinking text, question card, phase rail, deliverables list, and artifact output are all derived from local React state and hard-coded fixture arrays in `NolmeAppRoute.tsx`.

The Algorithm API currently exposes a public state shape with run identity, provider/model, status, session id, one `phase` value, event cursor, pending question, pending permission, last error, and timestamps. The current store projection records phase/status/session/question/permission/error/terminal events. It does not currently project a phase list, deliverables/resources list, capabilities, criteria progress, or final output summary into public state.

The existing Nolme AG-UI path, separate from the new `/app` route, already has session hydration patterns for replaying provider history and reading a per-session `NolmeAgentState` sidecar. That path is implemented in `CcuSessionAgent.connect()`, `ag-ui-event-translator.js`, `nolme-state-store.js`, `/api/nolme/state/:sessionId`, and workflow phase tool schemas. These files are the closest existing examples of hydrated messages, phases, deliverables/resources, pending questions, and permission decisions.

## Detailed Findings

### Planned Algorithm API Boundary

The plan defines a versioned Algorithm Run API with three layers: Command API, Event API, and State API. The intended Event API covers run lifecycle, phase, criteria, capabilities, questions, permissions, artifacts, and final output. The intended State API is the projection consumed by `cc-agent-ui` for Nolme hydration and live updates ([plan:27](https://github.com/tha-hammer/agent-memory/blob/32b573a783b1762155b0213ccf4e2b67f248a29d/cc-agent-ui/thoughts/searchable/shared/plans/2026-04-26-algorithm-run-api-boundary.md#L27), [plan:31](https://github.com/tha-hammer/agent-memory/blob/32b573a783b1762155b0213ccf4e2b67f248a29d/cc-agent-ui/thoughts/searchable/shared/plans/2026-04-26-algorithm-run-api-boundary.md#L31)).

The plan's desired Nolme-visible fields are run/session id, task title, phase list and active phase, criteria progress, capabilities, pending questions, pending approvals, artifacts/deliverables, and final output summary ([plan:61](https://github.com/tha-hammer/agent-memory/blob/32b573a783b1762155b0213ccf4e2b67f248a29d/cc-agent-ui/thoughts/searchable/shared/plans/2026-04-26-algorithm-run-api-boundary.md#L61)).

The plan names the cc-agent-ui adapter shape as `server/agents/algorithm-run-adapter.js`, with readers for run state/events and projectors from Algorithm state/events into Nolme state and AG-UI deltas ([plan:390](https://github.com/tha-hammer/agent-memory/blob/32b573a783b1762155b0213ccf4e2b67f248a29d/cc-agent-ui/thoughts/searchable/shared/plans/2026-04-26-algorithm-run-api-boundary.md#L390)). It also places Algorithm state merging inside `CcuSessionAgent.connect()` before the `STATE_SNAPSHOT`, and live Algorithm event deltas inside `CcuSessionAgent.run()` when a binding has an Algorithm run id ([plan:415](https://github.com/tha-hammer/agent-memory/blob/32b573a783b1762155b0213ccf4e2b67f248a29d/cc-agent-ui/thoughts/searchable/shared/plans/2026-04-26-algorithm-run-api-boundary.md#L415), [plan:427](https://github.com/tha-hammer/agent-memory/blob/32b573a783b1762155b0213ccf4e2b67f248a29d/cc-agent-ui/thoughts/searchable/shared/plans/2026-04-26-algorithm-run-api-boundary.md#L427)).

The same plan lists the Algorithm command routes now present in the server: start, pause, resume, stop, answer question, and permission decision, mounted behind existing auth near `server/index.js` ([plan:438](https://github.com/tha-hammer/agent-memory/blob/32b573a783b1762155b0213ccf4e2b67f248a29d/cc-agent-ui/thoughts/searchable/shared/plans/2026-04-26-algorithm-run-api-boundary.md#L438)).

### Current `/app` Route UI

The authenticated `/app` route is mounted in `src/App.tsx` under `ProtectedRoute`, rendering `NolmeAppRoute` ([src/App.tsx:28](https://github.com/tha-hammer/agent-memory/blob/32b573a783b1762155b0213ccf4e2b67f248a29d/cc-agent-ui/src/App.tsx#L28)).

`NolmeAppRoute` uses a local view union of `send-working`, `questions`, `working`, and `artifact` ([NolmeAppRoute.tsx:23](https://github.com/tha-hammer/agent-memory/blob/32b573a783b1762155b0213ccf4e2b67f248a29d/cc-agent-ui/src/components/nolme-app/view/NolmeAppRoute.tsx#L23)). Its component state is `view`, `selectedOption`, and `customRadius` ([NolmeAppRoute.tsx:79](https://github.com/tha-hammer/agent-memory/blob/32b573a783b1762155b0213ccf4e2b67f248a29d/cc-agent-ui/src/components/nolme-app/view/NolmeAppRoute.tsx#L79)). When `view` becomes `working`, a timer advances it to `artifact` after 1400 ms ([NolmeAppRoute.tsx:84](https://github.com/tha-hammer/agent-memory/blob/32b573a783b1762155b0213ccf4e2b67f248a29d/cc-agent-ui/src/components/nolme-app/view/NolmeAppRoute.tsx#L84)).

Agent output is currently computed from the local view state. Message content is built in a `useMemo` block, the thinking label is selected from the current view, and the artifact response renders only when `view === 'artifact'` ([NolmeAppRoute.tsx:93](https://github.com/tha-hammer/agent-memory/blob/32b573a783b1762155b0213ccf4e2b67f248a29d/cc-agent-ui/src/components/nolme-app/view/NolmeAppRoute.tsx#L93), [NolmeAppRoute.tsx:115](https://github.com/tha-hammer/agent-memory/blob/32b573a783b1762155b0213ccf4e2b67f248a29d/cc-agent-ui/src/components/nolme-app/view/NolmeAppRoute.tsx#L115), [NolmeAppRoute.tsx:134](https://github.com/tha-hammer/agent-memory/blob/32b573a783b1762155b0213ccf4e2b67f248a29d/cc-agent-ui/src/components/nolme-app/view/NolmeAppRoute.tsx#L134)).

The question UI is also local. The question options are hard-coded in `QUESTION_OPTIONS`, the selected option defaults to `"15 miles"`, and the question text is in the component markup ([NolmeAppRoute.tsx:45](https://github.com/tha-hammer/agent-memory/blob/32b573a783b1762155b0213ccf4e2b67f248a29d/cc-agent-ui/src/components/nolme-app/view/NolmeAppRoute.tsx#L45), [NolmeAppRoute.tsx:81](https://github.com/tha-hammer/agent-memory/blob/32b573a783b1762155b0213ccf4e2b67f248a29d/cc-agent-ui/src/components/nolme-app/view/NolmeAppRoute.tsx#L81), [NolmeAppRoute.tsx:231](https://github.com/tha-hammer/agent-memory/blob/32b573a783b1762155b0213ccf4e2b67f248a29d/cc-agent-ui/src/components/nolme-app/view/NolmeAppRoute.tsx#L231)).

Deliverables use the local `Deliverable` type and the hard-coded `BASE_DELIVERABLES` array. Artifact mode appends a hard-coded `Luma - Curated venue list` deliverable. The right panel renders static P1-P4 phase labels and one active card with `Audience & venue`, `Waiting`, and `Task 5 of 5` ([NolmeAppRoute.tsx:31](https://github.com/tha-hammer/agent-memory/blob/32b573a783b1762155b0213ccf4e2b67f248a29d/cc-agent-ui/src/components/nolme-app/view/NolmeAppRoute.tsx#L31), [NolmeAppRoute.tsx:47](https://github.com/tha-hammer/agent-memory/blob/32b573a783b1762155b0213ccf4e2b67f248a29d/cc-agent-ui/src/components/nolme-app/view/NolmeAppRoute.tsx#L47), [NolmeAppRoute.tsx:371](https://github.com/tha-hammer/agent-memory/blob/32b573a783b1762155b0213ccf4e2b67f248a29d/cc-agent-ui/src/components/nolme-app/view/NolmeAppRoute.tsx#L371), [NolmeAppRoute.tsx:402](https://github.com/tha-hammer/agent-memory/blob/32b573a783b1762155b0213ccf4e2b67f248a29d/cc-agent-ui/src/components/nolme-app/view/NolmeAppRoute.tsx#L402)).

The route test documents the current behavior: render shell landmarks, click from initial state into the question card, click continue into working state, advance timers, and observe artifact/deliverable UI ([test_nolme_app_route.spec.tsx:14](https://github.com/tha-hammer/agent-memory/blob/32b573a783b1762155b0213ccf4e2b67f248a29d/cc-agent-ui/tests/generated/test_nolme_app_route.spec.tsx#L14), [test_nolme_app_route.spec.tsx:24](https://github.com/tha-hammer/agent-memory/blob/32b573a783b1762155b0213ccf4e2b67f248a29d/cc-agent-ui/tests/generated/test_nolme_app_route.spec.tsx#L24)).

### Current Algorithm Run HTTP API

The server imports `algorithmRunsRouter` and mounts it at `/api/algorithm-runs` behind `authenticateToken` ([server/index.js:71](https://github.com/tha-hammer/agent-memory/blob/32b573a783b1762155b0213ccf4e2b67f248a29d/cc-agent-ui/server/index.js#L71), [server/index.js:468](https://github.com/tha-hammer/agent-memory/blob/32b573a783b1762155b0213ccf4e2b67f248a29d/cc-agent-ui/server/index.js#L468)). The global `/api` API-key middleware runs before protected route mounts ([server/index.js:420](https://github.com/tha-hammer/agent-memory/blob/32b573a783b1762155b0213ccf4e2b67f248a29d/cc-agent-ui/server/index.js#L420)).

The contracts module defines `schemaVersion: 1`, supported providers, statuses, terminal statuses, lifecycle commands, event types, response envelopes, and validation helpers ([contracts.js:4](https://github.com/tha-hammer/agent-memory/blob/32b573a783b1762155b0213ccf4e2b67f248a29d/cc-agent-ui/server/algorithm-runs/contracts.js#L4), [contracts.js:42](https://github.com/tha-hammer/agent-memory/blob/32b573a783b1762155b0213ccf4e2b67f248a29d/cc-agent-ui/server/algorithm-runs/contracts.js#L42)).

`POST /api/algorithm-runs` validates a start body, reads the runner command from `ALGORITHM_RUNNER_COMMAND`, creates metadata, calls `startAlgorithmRun()`, persists accepted/runner frames, and returns `202` with `run` and `links.state` / `links.events` ([algorithm-runs.js:79](https://github.com/tha-hammer/agent-memory/blob/32b573a783b1762155b0213ccf4e2b67f248a29d/cc-agent-ui/server/routes/algorithm-runs.js#L79), [algorithm-runs.js:100](https://github.com/tha-hammer/agent-memory/blob/32b573a783b1762155b0213ccf4e2b67f248a29d/cc-agent-ui/server/routes/algorithm-runs.js#L100)).

`GET /api/algorithm-runs/:runId/state` returns `{ ok, schemaVersion, runId, state }`. `GET /api/algorithm-runs/:runId/events?after=<n>` returns cursor-filtered events, while `stream=1` switches to SSE through `streamAlgorithmEvents()` ([algorithm-runs.js:164](https://github.com/tha-hammer/agent-memory/blob/32b573a783b1762155b0213ccf4e2b67f248a29d/cc-agent-ui/server/routes/algorithm-runs.js#L164), [algorithm-runs.js:176](https://github.com/tha-hammer/agent-memory/blob/32b573a783b1762155b0213ccf4e2b67f248a29d/cc-agent-ui/server/routes/algorithm-runs.js#L176), [algorithm-runs.js:183](https://github.com/tha-hammer/agent-memory/blob/32b573a783b1762155b0213ccf4e2b67f248a29d/cc-agent-ui/server/routes/algorithm-runs.js#L183)).

Lifecycle routes share `handleLifecycle()` for pause, resume, and stop. Decision routes answer pending questions and resolve pending permissions only when the requested id matches the projected pending item in public run state ([algorithm-runs.js:210](https://github.com/tha-hammer/agent-memory/blob/32b573a783b1762155b0213ccf4e2b67f248a29d/cc-agent-ui/server/routes/algorithm-runs.js#L210), [algorithm-runs.js:276](https://github.com/tha-hammer/agent-memory/blob/32b573a783b1762155b0213ccf4e2b67f248a29d/cc-agent-ui/server/routes/algorithm-runs.js#L276), [algorithm-runs.js:309](https://github.com/tha-hammer/agent-memory/blob/32b573a783b1762155b0213ccf4e2b67f248a29d/cc-agent-ui/server/routes/algorithm-runs.js#L309)).

### Current Algorithm Store and Projection

Algorithm runs persist under `ALGORITHM_RUN_STORE_ROOT` or `~/.cosmic-agent/algorithm-runs`, with one directory per validated run id containing `metadata.json`, `state.json`, and `events.jsonl` ([run-store.js:19](https://github.com/tha-hammer/agent-memory/blob/32b573a783b1762155b0213ccf4e2b67f248a29d/cc-agent-ui/server/algorithm-runs/run-store.js#L19)).

The public state projection currently exposes:

- `schemaVersion`
- `runId`
- `provider`
- `model`
- `status`
- `sessionId`
- `phase`
- `eventCursor`
- `pendingQuestion`
- `pendingPermission`
- `lastError`
- timestamps

This shape is built in `publicStateFromMetadata()` ([run-store.js:76](https://github.com/tha-hammer/agent-memory/blob/32b573a783b1762155b0213ccf4e2b67f248a29d/cc-agent-ui/server/algorithm-runs/run-store.js#L76)).

The event projection updates status, session id, active phase string, pending question, pending permission, last error, and terminal timestamps. It clears pending queues when runs enter terminal statuses ([run-store.js:123](https://github.com/tha-hammer/agent-memory/blob/32b573a783b1762155b0213ccf4e2b67f248a29d/cc-agent-ui/server/algorithm-runs/run-store.js#L123)).

Runner frames map into store events in `persistRunnerFrame()`. Current `state` frames can write `algorithm.session.bound`, `algorithm.phase.changed`, and `algorithm.status.changed`; `log`, `error`, and terminal `result` frames map to log/error/terminal Algorithm events ([run-store.js:412](https://github.com/tha-hammer/agent-memory/blob/32b573a783b1762155b0213ccf4e2b67f248a29d/cc-agent-ui/server/algorithm-runs/run-store.js#L412)).

The SSE helper writes `algorithm.event` frames, heartbeats, polling backlog after a cursor, and closes on terminal events or terminal public state ([sse.js:12](https://github.com/tha-hammer/agent-memory/blob/32b573a783b1762155b0213ccf4e2b67f248a29d/cc-agent-ui/server/algorithm-runs/sse.js#L12), [sse.js:46](https://github.com/tha-hammer/agent-memory/blob/32b573a783b1762155b0213ccf4e2b67f248a29d/cc-agent-ui/server/algorithm-runs/sse.js#L46)).

The runner command client expects a JSON-array `ALGORITHM_RUNNER_COMMAND`, writes one request JSON line to stdin, validates NDJSON runner frames, and registers long-lived started processes until terminal frames or process exit ([command-client.js:20](https://github.com/tha-hammer/agent-memory/blob/32b573a783b1762155b0213ccf4e2b67f248a29d/cc-agent-ui/server/algorithm-runs/command-client.js#L20), [command-client.js:70](https://github.com/tha-hammer/agent-memory/blob/32b573a783b1762155b0213ccf4e2b67f248a29d/cc-agent-ui/server/algorithm-runs/command-client.js#L70), [command-client.js:192](https://github.com/tha-hammer/agent-memory/blob/32b573a783b1762155b0213ccf4e2b67f248a29d/cc-agent-ui/server/algorithm-runs/command-client.js#L192)).

The included runner adapter is an executable NDJSON adapter. Its `mapCoreAlgorithmStateToRunState()` maps core-like `sessionId`, phase/currentPhase, status-like values, timestamps, and external handles into the public run state subset used by the store ([runner-adapter.js:13](https://github.com/tha-hammer/agent-memory/blob/32b573a783b1762155b0213ccf4e2b67f248a29d/cc-agent-ui/server/algorithm-runs/runner-adapter.js#L13)). Its current `start` path emits `accepted`, `algorithm.run.started`, and a completed `result` frame ([runner-adapter.js:53](https://github.com/tha-hammer/agent-memory/blob/32b573a783b1762155b0213ccf4e2b67f248a29d/cc-agent-ui/server/algorithm-runs/runner-adapter.js#L53)).

### Existing Authenticated Frontend API Pattern

Frontend authenticated requests use `authenticatedFetch()` from `src/utils/api.js`. It reads `auth-token` from `localStorage`, adds `Authorization: Bearer <token>` outside platform mode, sets JSON content type for non-FormData bodies, and stores `X-Refreshed-Token` when present ([src/utils/api.js:3](https://github.com/tha-hammer/agent-memory/blob/32b573a783b1762155b0213ccf4e2b67f248a29d/cc-agent-ui/src/utils/api.js#L3)).

The same module exposes generic `api.get`, `api.post`, `api.put`, and `api.delete` helpers that prefix paths with `/api` ([src/utils/api.js:225](https://github.com/tha-hammer/agent-memory/blob/32b573a783b1762155b0213ccf4e2b67f248a29d/cc-agent-ui/src/utils/api.js#L225)).

`AuthProvider` owns the token in React state and persists it to the same `auth-token` storage key after login/register ([AuthContext.tsx:18](https://github.com/tha-hammer/agent-memory/blob/32b573a783b1762155b0213ccf4e2b67f248a29d/cc-agent-ui/src/components/auth/context/AuthContext.tsx#L18), [AuthContext.tsx:45](https://github.com/tha-hammer/agent-memory/blob/32b573a783b1762155b0213ccf4e2b67f248a29d/cc-agent-ui/src/components/auth/context/AuthContext.tsx#L45)).

For transports that cannot set headers, existing code passes the auth token as a query parameter. The WebSocket provider uses `/ws?token=...`, and `authenticateToken` accepts `?token=` for SSE/EventSource use ([WebSocketContext.tsx:22](https://github.com/tha-hammer/agent-memory/blob/32b573a783b1762155b0213ccf4e2b67f248a29d/cc-agent-ui/src/contexts/WebSocketContext.tsx#L22), [auth.js:40](https://github.com/tha-hammer/agent-memory/blob/32b573a783b1762155b0213ccf4e2b67f248a29d/cc-agent-ui/server/middleware/auth.js#L40)).

### Existing Nolme Hydration and Structured State Path

The existing Nolme launch binding is separate from `/app`. `buildNolmeLaunchBinding()` builds a binding from selected project/session, stored provider/model/permission mode, and tool settings. `buildNolmeLaunchUrl()` serializes that binding into `/nolme/?provider&sessionId&projectName&projectPath...` ([nolmeLaunch.ts:99](https://github.com/tha-hammer/agent-memory/blob/32b573a783b1762155b0213ccf4e2b67f248a29d/cc-agent-ui/src/utils/nolmeLaunch.ts#L99), [nolmeLaunch.ts:124](https://github.com/tha-hammer/agent-memory/blob/32b573a783b1762155b0213ccf4e2b67f248a29d/cc-agent-ui/src/utils/nolmeLaunch.ts#L124)).

`useSessionBroadcast()` writes the active Nolme binding to `localStorage('nolme-current-binding')` and posts it on `BroadcastChannel('ccu-session')` whenever selected project/session context changes ([useSessionBroadcast.ts:22](https://github.com/tha-hammer/agent-memory/blob/32b573a783b1762155b0213ccf4e2b67f248a29d/cc-agent-ui/src/hooks/useSessionBroadcast.ts#L22), [useSessionBroadcast.ts:39](https://github.com/tha-hammer/agent-memory/blob/32b573a783b1762155b0213ccf4e2b67f248a29d/cc-agent-ui/src/hooks/useSessionBroadcast.ts#L39)).

`CcuSessionAgent.run()` reads `input.forwardedProps.binding`, dispatches to the selected provider runtime, translates provider frames into AG-UI events, and persists token budget into the Nolme sidecar when status frames include budget data ([ccu-session-agent.js:172](https://github.com/tha-hammer/agent-memory/blob/32b573a783b1762155b0213ccf4e2b67f248a29d/cc-agent-ui/server/agents/ccu-session-agent.js#L172), [ccu-session-agent.js:193](https://github.com/tha-hammer/agent-memory/blob/32b573a783b1762155b0213ccf4e2b67f248a29d/cc-agent-ui/server/agents/ccu-session-agent.js#L193), [ccu-session-agent.js:248](https://github.com/tha-hammer/agent-memory/blob/32b573a783b1762155b0213ccf4e2b67f248a29d/cc-agent-ui/server/agents/ccu-session-agent.js#L248)).

`CcuSessionAgent.connect()` is the current hydration entrypoint for the CopilotKit path. It fetches provider history, translates historical messages into AG-UI events, reads the Nolme sidecar state, emits one `STATE_SNAPSHOT`, and then emits `RUN_FINISHED` ([ccu-session-agent.js:291](https://github.com/tha-hammer/agent-memory/blob/32b573a783b1762155b0213ccf4e2b67f248a29d/cc-agent-ui/server/agents/ccu-session-agent.js#L291), [ccu-session-agent.js:314](https://github.com/tha-hammer/agent-memory/blob/32b573a783b1762155b0213ccf4e2b67f248a29d/cc-agent-ui/server/agents/ccu-session-agent.js#L314), [ccu-session-agent.js:334](https://github.com/tha-hammer/agent-memory/blob/32b573a783b1762155b0213ccf4e2b67f248a29d/cc-agent-ui/server/agents/ccu-session-agent.js#L334)).

The AG-UI translator maps provider frames into text messages, tool calls, permission requests, status deltas, task notification deltas, and session snapshots ([ag-ui-event-translator.js:89](https://github.com/tha-hammer/agent-memory/blob/32b573a783b1762155b0213ccf4e2b67f248a29d/cc-agent-ui/server/agents/ag-ui-event-translator.js#L89), [ag-ui-event-translator.js:172](https://github.com/tha-hammer/agent-memory/blob/32b573a783b1762155b0213ccf4e2b67f248a29d/cc-agent-ui/server/agents/ag-ui-event-translator.js#L172), [ag-ui-event-translator.js:215](https://github.com/tha-hammer/agent-memory/blob/32b573a783b1762155b0213ccf4e2b67f248a29d/cc-agent-ui/server/agents/ag-ui-event-translator.js#L215)).

The sidecar state defaults to phases, current phase index, review line, resources, profile, quick actions, and task notifications. It is read from `~/.claude/projects/<projectName-or-encoded-path>/<sessionId>.nolme-state.json` and falls back to defaults on missing, malformed, or mismatched state ([nolme-state-store.js:36](https://github.com/tha-hammer/agent-memory/blob/32b573a783b1762155b0213ccf4e2b67f248a29d/cc-agent-ui/server/agents/nolme-state-store.js#L36), [nolme-state-store.js:55](https://github.com/tha-hammer/agent-memory/blob/32b573a783b1762155b0213ccf4e2b67f248a29d/cc-agent-ui/server/agents/nolme-state-store.js#L55), [nolme-state-store.js:97](https://github.com/tha-hammer/agent-memory/blob/32b573a783b1762155b0213ccf4e2b67f248a29d/cc-agent-ui/server/agents/nolme-state-store.js#L97)).

`/api/nolme/state/:sessionId` exposes this sidecar state, while `/api/nolme/pending-permissions/:sessionId` exposes pending Claude permission requests and a decision route ([nolme-state.js:23](https://github.com/tha-hammer/agent-memory/blob/32b573a783b1762155b0213ccf4e2b67f248a29d/cc-agent-ui/server/routes/nolme-state.js#L23), [nolme-state.js:45](https://github.com/tha-hammer/agent-memory/blob/32b573a783b1762155b0213ccf4e2b67f248a29d/cc-agent-ui/server/routes/nolme-state.js#L45), [nolme-state.js:66](https://github.com/tha-hammer/agent-memory/blob/32b573a783b1762155b0213ccf4e2b67f248a29d/cc-agent-ui/server/routes/nolme-state.js#L66)).

`WORKFLOW_PHASE_TOOLS` defines the existing tool schema surface for phases and resources: `setPhaseState`, `advancePhase`, and `addResource` ([workflow-phase-tools.js:36](https://github.com/tha-hammer/agent-memory/blob/32b573a783b1762155b0213ccf4e2b67f248a29d/cc-agent-ui/server/tools/workflow-phase-tools.js#L36)).

### Tests Covering Existing Behavior

The Algorithm start route test covers owner-bound metadata, `202`, `running` status, state link, and invalid project rejection ([test_algorithm_runs_route_start.spec.ts:56](https://github.com/tha-hammer/agent-memory/blob/32b573a783b1762155b0213ccf4e2b67f248a29d/cc-agent-ui/tests/generated/test_algorithm_runs_route_start.spec.ts#L56)).

The Algorithm state/events route test covers public state without private paths, cursor-filtered events, owner mismatch, SSE content type, terminal replay, and SSE cleanup ([test_algorithm_runs_route_state_events.spec.ts:67](https://github.com/tha-hammer/agent-memory/blob/32b573a783b1762155b0213ccf4e2b67f248a29d/cc-agent-ui/tests/generated/test_algorithm_runs_route_state_events.spec.ts#L67), [test_algorithm_runs_route_state_events.spec.ts:95](https://github.com/tha-hammer/agent-memory/blob/32b573a783b1762155b0213ccf4e2b67f248a29d/cc-agent-ui/tests/generated/test_algorithm_runs_route_state_events.spec.ts#L95)).

Lifecycle and decision tests cover pause forwarding, terminal resume conflict, matching question answers, stale permission ids, owner mismatch, and runner rejection preserving pending question state ([test_algorithm_runs_route_lifecycle.spec.ts:69](https://github.com/tha-hammer/agent-memory/blob/32b573a783b1762155b0213ccf4e2b67f248a29d/cc-agent-ui/tests/generated/test_algorithm_runs_route_lifecycle.spec.ts#L69), [test_algorithm_runs_route_decisions.spec.ts:68](https://github.com/tha-hammer/agent-memory/blob/32b573a783b1762155b0213ccf4e2b67f248a29d/cc-agent-ui/tests/generated/test_algorithm_runs_route_decisions.spec.ts#L68)).

The existing Nolme hydration test covers `CcuSessionAgent.connect()` event ordering, history replay, sidecar `STATE_SNAPSHOT`, fetch-history arguments, and error behavior ([test_ccu_session_agent_hydration.spec.ts:70](https://github.com/tha-hammer/agent-memory/blob/32b573a783b1762155b0213ccf4e2b67f248a29d/cc-agent-ui/tests/generated/test_ccu_session_agent_hydration.spec.ts#L70), [test_ccu_session_agent_hydration.spec.ts:125](https://github.com/tha-hammer/agent-memory/blob/32b573a783b1762155b0213ccf4e2b67f248a29d/cc-agent-ui/tests/generated/test_ccu_session_agent_hydration.spec.ts#L125), [test_ccu_session_agent_hydration.spec.ts:203](https://github.com/tha-hammer/agent-memory/blob/32b573a783b1762155b0213ccf4e2b67f248a29d/cc-agent-ui/tests/generated/test_ccu_session_agent_hydration.spec.ts#L203)).

## Code References

- `src/App.tsx:28` - protected `/app` route renders `NolmeAppRoute`.
- `src/components/nolme-app/view/NolmeAppRoute.tsx:23` - local view-state union for the `/app` route.
- `src/components/nolme-app/view/NolmeAppRoute.tsx:79` - local React state driving view, selected question option, and custom radius.
- `src/components/nolme-app/view/NolmeAppRoute.tsx:93` - local messages derived from view state.
- `src/components/nolme-app/view/NolmeAppRoute.tsx:371` - right panel deliverables assembled from local constants and artifact mode.
- `server/index.js:468` - protected Algorithm API mount at `/api/algorithm-runs`.
- `server/routes/algorithm-runs.js:100` - start run route.
- `server/routes/algorithm-runs.js:164` - state route.
- `server/routes/algorithm-runs.js:176` - events and SSE route.
- `server/routes/algorithm-runs.js:210` - lifecycle command handler.
- `server/routes/algorithm-runs.js:276` - question answer route.
- `server/routes/algorithm-runs.js:309` - permission decision route.
- `server/algorithm-runs/run-store.js:76` - current public state shape.
- `server/algorithm-runs/run-store.js:123` - event projection rules.
- `server/algorithm-runs/run-store.js:412` - runner frame to event mapping.
- `server/algorithm-runs/sse.js:12` - SSE stream helper.
- `server/agents/ccu-session-agent.js:291` - existing Nolme/CopilotKit hydration path.
- `server/agents/nolme-state-store.js:36` - current Nolme sidecar state shape.
- `server/tools/workflow-phase-tools.js:36` - existing phase/resource tool schemas.
- `src/utils/api.js:3` - authenticated frontend fetch helper.

## Architecture Documentation

The current app has three separate state channels relevant to `/app` hydration:

1. The new `/app` route state is component-local and renders a static Figma-derived shell.
2. The Algorithm Run API state is server-local, owner-scoped, event-sourced, and exposed over authenticated HTTP/SSE.
3. The existing Nolme AG-UI state is session-bound, sidecar-backed, and emitted to CopilotKit as `STATE_SNAPSHOT` / `STATE_DELTA`.

The current Algorithm Run API is process-backed. `ALGORITHM_RUNNER_COMMAND` is parsed as a JSON string array, cc-agent-ui writes a single JSON request line to child stdin, and runner stdout emits NDJSON frames. The store decides which frames become public events and state.

The current frontend auth pattern is bearer-token based for `fetch` calls through `authenticatedFetch()`. For EventSource/SSE-style connections, the server middleware accepts the same token through a query parameter because browser EventSource cannot set custom headers.

## Historical Context

- `thoughts/shared/plans/2026-04-26-algorithm-run-api-boundary.md` - Defines the intended Command/Event/State split and the Nolme-facing fields for Algorithm run hydration.
- `thoughts/shared/research/2026-04-26-nolme-algorithm-interface-surfaces.md` - Earlier research documented the pre-API surfaces corresponding to command/event/state concepts.
- `thoughts/shared/research/2026-04-26-open-in-nolme-session-hydration.md` - Documents the existing Nolme session hydration path through URL/localStorage/BroadcastChannel binding, provider history replay, sidecar state, and fallback projection.
- `thoughts/shared/research/2026-04-26-cc-agent-ui-harness-middleware-interfaces.md` - Documents the adjacent provider harness surfaces: WebSocket, `/api/agent`, and `/api/copilotkit`.
- `thoughts/shared/research/2026-04-26-cc-agent-ui-core-algorithm-run-api-contracts.md` - Documents the planned cc-agent-ui local API boundary and runner protocol before the current route/store/test implementation appeared in this checkout.
- `thoughts/shared/research/2026-04-26-cc-agent-ui-figma-surface-map.md` - Documents the Figma right panel, question card, and root app mapping that informed the new `/app` route shell.

Note: displayed `thoughts/` paths remove only the `searchable/` search-directory segment.

## Related Research

- `thoughts/searchable/shared/research/2026-04-26-nolme-algorithm-interface-surfaces.md`
- `thoughts/searchable/shared/research/2026-04-26-open-in-nolme-session-hydration.md`
- `thoughts/searchable/shared/research/2026-04-26-cc-agent-ui-harness-middleware-interfaces.md`
- `thoughts/searchable/shared/research/2026-04-26-cc-agent-ui-core-algorithm-run-api-contracts.md`
- `thoughts/searchable/shared/research/2026-04-26-cc-agent-ui-figma-surface-map.md`

## Open Questions

- The current `/app` route does not carry a selected project, selected session, or Algorithm run id in its component props or URL state. No current source path was found that associates `/app` with a specific run.
- The current Algorithm public state stores one `phase` string, not the phase-list/resource shape rendered by the `/app` right rail.
- The current Algorithm store accepts generic `algorithm.*` event frames from the runner, but its public projection only handles the event types implemented in `applyEventProjection()`.
- No current `server/agents/algorithm-run-adapter.js` file exists in this checkout.
