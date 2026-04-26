---
date: 2026-04-26
status: revised
repository: cc-agent-ui
scope: cc-agent-ui only
reference_plan: thoughts/searchable/shared/plans/2026-04-26-algorithm-run-api-boundary.md
review_reference: thoughts/searchable/shared/plans/2026-04-26-cc-agent-ui-algorithm-run-api-boundary-tdd-REVIEW.md
related_research:
  - thoughts/searchable/shared/research/2026-04-26-cc-agent-ui-harness-middleware-interfaces.md
  - thoughts/searchable/shared/research/2026-04-26-nolme-algorithm-interface-surfaces.md
related_beads:
  - cam-lml
  - cam-b1x
---

# cc-agent-ui Algorithm Run API Boundary TDD Implementation Plan

## Scope Confirmation

This is a new TDD plan for `cc-agent-ui` only.

This plan does not use the Nolme adapter. It does not modify `nolme-ui/`, `server/agents/ccu-session-agent.js`, `server/agents/ag-ui-event-translator.js`, `server/agents/nolme-ag-ui-writer.js`, or the CopilotKit runtime path. Those files are referenced only as existing context and explicit non-targets.

This plan also does not modify `cosmic-agent-core`. It defines the cc-agent-ui side of the Algorithm Run API boundary: HTTP routes, request/response contracts, command-client integration, run metadata/state/event storage, validation, and automated tests.

## Overview

The referenced plan attempted to define a cross-repo Algorithm Run boundary spanning `cosmic-agent-core`, `cc-agent-ui`, and Nolme. Its review found critical gaps: no executable Node-to-core boundary, undefined run identity, incomplete route contracts, unclear event ordering, and Nolme production hydration risk.

This replacement plan narrows the work to one implementable slice:

- `cc-agent-ui` exposes authenticated `/api/algorithm-runs` routes.
- `cc-agent-ui` validates versioned Algorithm Run API payloads at its server boundary.
- `cc-agent-ui` calls an external Algorithm command runner through an explicit child-process newline-delimited JSON frame protocol.
- `cc-agent-ui` stores and serves authenticated run metadata, state snapshots, and event cursors from one local run store.
- `cc-agent-ui` never reads arbitrary client-supplied event paths and never depends on Nolme AG-UI projection.

## Current State Analysis

### Key Discoveries

- Existing protected API routes are mounted in `server/index.js:464-478`; `/api/sessions` is protected, `/api/agent` uses API-key auth, and Nolme routes are separately mounted.
- The external middleware-style execution route already documents request/response/error conventions in `server/routes/agent.js:618-841` and dispatches providers at `server/routes/agent.js:842-988`.
- The main WebSocket writer shape is `{ send, setSessionId, getSessionId, userId }` at `server/index.js:1532-1557`, and provider dispatch occurs at `server/index.js:1573-1619`.
- The provider-neutral history contract is already routed through `GET /api/sessions/:sessionId/messages` in `server/routes/messages.js:29-54`.
- The shared normalized provider frame contract is defined in `server/providers/types.js:13-119`.
- `server/agents/ccu-session-agent.js:67-129` shows a reusable provider dispatch mapping, but this plan does not target that Nolme/CopilotKit adapter.
- `server/agents/ag-ui-event-translator.js:89-258` maps provider frames to AG-UI events, but this plan does not target AG-UI or Nolme state deltas.
- Existing generated tests use Vitest with route-level HTTP servers and module mocks, for example `tests/generated/test_nolme_state_route.spec.ts:420-469`, `tests/generated/test_copilotkit_route_auth.spec.ts:541-617`, and `tests/generated/test_ag_ui_event_translator.spec.ts:1-174`.

## Desired End State

`cc-agent-ui` exposes a tested Algorithm Run API surface:

| Concern | End state |
| --- | --- |
| Contract validation | `server/algorithm-runs/contracts.js` validates supported schema version, provider, run ids, command payloads, decisions, and error envelopes. |
| Core command boundary | `server/algorithm-runs/command-client.js` spawns an env-configured command using one JSON request line on stdin and newline-delimited JSON frames on stdout, with deterministic timeout/error behavior. |
| Active runner lifetime | `server/algorithm-runs/process-registry.js` tracks start-run child processes after HTTP `202`, terminates them on timeout/stop, and removes them on exit. |
| Run identity | `server/algorithm-runs/run-store.js` owns run metadata keyed by `runId`, including `ownerUserId`, `sessionId`, provider, status, timestamps, runner handle fields, and cursor. |
| State/events | `server/algorithm-runs/run-store.js` also appends/reads JSONL events, allocates sequences, and projects a server-side `AlgorithmRunState` snapshot. |
| HTTP routes | `server/routes/algorithm-runs.js` mounts start, state, events, lifecycle, question, and permission routes. |
| Auth mount | `server/index.js` mounts `/api/algorithm-runs` behind existing `authenticateToken`; auth failures keep the existing plain `{ error }` bodies. |

## What We're NOT Doing

- No Nolme adapter work.
- No `nolme-ui/` work.
- No AG-UI `STATE_DELTA` or `STATE_SNAPSHOT` projection work.
- No `server/agents/ccu-session-agent.js` changes.
- No `cosmic-agent-core` changes.
- No direct import from `cosmic-agent-core` TypeScript/Bun files.
- No arbitrary filesystem path reads supplied by clients.
- No transcript parsing as Algorithm state.

## Resource Registry And Schema Binding

The mandatory `specs/schemas/resource_registry.json` file is absent in this repository. The only nearby registry is `.cw9/schema/resource_registry.generic.json`, which is Nolme-focused and intentionally not used as the canonical registry for this no-Nolme plan.

All resource UUIDs below are marked `[PROPOSED]`. During implementation, either create the canonical registry entry first or replace these with existing canonical UUIDs if a registry appears.

Schema sources requested by the planning workflow:

- `schema/`: absent.
- `schemas/`: absent.
- `specs/schemas/`: absent.
- `.cw9/schema/*.json`: present but mostly empty; `.cw9/schema/resource_registry.generic.json` is Nolme-specific.

No verified TLA+ model exists for this Algorithm Run API boundary in this checkout. Existing `.cw9/specs/gwt-0001..0014` cover fork/session behavior, not this route/store/client boundary.

## Review-Resolved Boundary Decisions

This section closes the review findings before implementation starts.

1. Runner output is newline-delimited JSON frames. The start route returns `202` after an `accepted` frame, then a tracked child process continues to stream `event`, `state`, `log`, `error`, and terminal `result` frames into `run-store.js`.
2. Every run is owned by `ownerUserId = String(req.user.id)` at creation time. Every `/:runId` route reads metadata first and returns a versioned `403 forbidden` response when the authenticated user does not own the run.
3. `run-store.js` is the only persistence module for metadata, events, and projected state.
4. `ALGORITHM_RUNNER_COMMAND` is exactly a JSON array of non-empty strings, for example `["node","/abs/path/algorithm-runner.mjs"]`. Invalid JSON, an empty array, a non-string element, or an empty executable is `runner_unavailable`.
5. Algorithm events are a new route/store contract. They do not feed `NormalizedMessage`, AG-UI, CopilotKit, or Nolme in this plan. Existing provider-normalized runtime surfaces are regression guards only.
6. Mount-level authentication uses existing `authenticateToken` behavior. Missing tokens return HTTP `401` plain `{ "error": "Access denied. No token provided." }`; invalid JWTs return HTTP `403` plain `{ "error": "Invalid token" }`. Versioned Algorithm envelopes begin only after auth succeeds.
7. State, event, lifecycle, question, and permission schemas below are canonical for this plan. Tests must assert these shapes before implementation fills in route internals.

## Canonical Data Model And Schemas

### Storage Layout

Storage is a server-owned file store under `ALGORITHM_RUN_STORE_ROOT`, defaulting to `~/.cosmic-agent/algorithm-runs`.

Each run lives at:

```text
${ALGORITHM_RUN_STORE_ROOT}/${runId}/metadata.json
${ALGORITHM_RUN_STORE_ROOT}/${runId}/state.json
${ALGORITHM_RUN_STORE_ROOT}/${runId}/events.jsonl
```

The route never accepts storage paths from clients. `runId` validation must make the path join safe before any filesystem access. `DATABASE_PATH`, `server/database/auth.db`, and Nolme sidecars are not used by this store.

### `AlgorithmRunMetadata`

```ts
type AlgorithmRunStatus =
  | 'starting'
  | 'running'
  | 'paused'
  | 'waiting_for_question'
  | 'waiting_for_permission'
  | 'stopping'
  | 'completed'
  | 'failed'
  | 'cancelled';

type TerminalAlgorithmRunStatus = 'completed' | 'failed' | 'cancelled';

type AlgorithmRunMetadata = {
  schemaVersion: 1;
  runId: string;
  ownerUserId: string;
  projectPath: string;
  provider: 'claude' | 'cursor' | 'codex' | 'gemini';
  model?: string | null;
  permissionMode?: string | null;
  algorithmMode?: string | null;
  status: AlgorithmRunStatus;
  sessionId: string | null;
  runnerRequestId: string;
  runnerPid?: number | null;
  externalRunHandle?: string | null;
  createdAt: string;
  updatedAt: string;
  startedAt?: string | null;
  endedAt?: string | null;
  lastSequence: number;
};
```

`sessionId` starts as `null` when the runner has not yet bound to a provider/core session. A runner `state` or `event` frame with `sessionId` updates both `metadata.sessionId` and the projected state. Tests must cover `sessionId: null -> "..."`.

### `AlgorithmRunState`

Public state responses must not include `projectPath`, storage roots, event filenames, runner command strings, raw stderr, or private tool input.

```ts
type AlgorithmRunState = {
  schemaVersion: 1;
  runId: string;
  provider: 'claude' | 'cursor' | 'codex' | 'gemini';
  model?: string | null;
  status: AlgorithmRunStatus;
  sessionId: string | null;
  phase?: string | null;
  eventCursor: { sequence: number };
  pendingQuestion?: AlgorithmQuestionRequest | null;
  pendingPermission?: AlgorithmPermissionRequest | null;
  lastError?: { code: string; message: string } | null;
  createdAt: string;
  updatedAt: string;
  startedAt?: string | null;
  endedAt?: string | null;
};
```

### `AlgorithmRunEvent`

The run store is the sequence authority. Normal appends accept events without `sequence`; `appendAlgorithmEvent` assigns `lastSequence + 1` under a per-run append lock. Replay/import helpers that accept an explicit `sequence` must reject duplicates and any value other than `lastSequence + 1`.

```ts
type AlgorithmRunEvent = {
  schemaVersion: 1;
  sequence: number;
  runId: string;
  type:
    | 'algorithm.runner.accepted'
    | 'algorithm.run.started'
    | 'algorithm.session.bound'
    | 'algorithm.phase.changed'
    | 'algorithm.status.changed'
    | 'algorithm.question.requested'
    | 'algorithm.question.answered'
    | 'algorithm.permission.requested'
    | 'algorithm.permission.decided'
    | 'algorithm.lifecycle.pause_requested'
    | 'algorithm.lifecycle.resume_requested'
    | 'algorithm.lifecycle.stop_requested'
    | 'algorithm.log'
    | 'algorithm.error'
    | 'algorithm.run.completed'
    | 'algorithm.run.failed'
    | 'algorithm.run.cancelled';
  createdAt: string;
  payload: Record<string, unknown>;
};
```

Projection rules:

- `algorithm.runner.accepted` sets `status: "running"` unless a later state frame sets a waiting or terminal status.
- `algorithm.session.bound` updates `sessionId` in metadata and state.
- `algorithm.status.changed` sets `status`; terminal status also sets `endedAt` and clears pending decisions.
- `algorithm.question.requested` sets `pendingQuestion` and `status: "waiting_for_question"`.
- `algorithm.question.answered` clears `pendingQuestion` only when ids match.
- `algorithm.permission.requested` sets `pendingPermission` and `status: "waiting_for_permission"`.
- `algorithm.permission.decided` clears `pendingPermission` only when ids match.
- `algorithm.error` sets `lastError`; `algorithm.run.failed` sets terminal `failed`.

Append order is append-before-publish: the event must be durably appended before a route or SSE writer exposes it. Snapshot writes use temp-file-then-rename. If `state.json` is missing or older than `metadata.lastSequence`, the store replays `events.jsonl` and rewrites `state.json`. If `metadata.lastSequence` disagrees with the event log, the store recomputes from the log and rewrites metadata. Malformed JSONL makes reads fail with `state_corrupt` and must not be silently skipped.

### Pending Decision Schemas

```ts
type AlgorithmQuestionRequest = {
  id: string;
  prompt: string;
  choices?: string[];
  defaultValue?: string | null;
  requestedAt: string;
  expiresAt?: string | null;
  sourceEventSequence: number;
};

type AlgorithmPermissionRequest = {
  id: string;
  toolName: string;
  action: string;
  input?: Record<string, unknown>;
  risks?: string[];
  requestedAt: string;
  expiresAt?: string | null;
  sourceEventSequence: number;
};

type AlgorithmQuestionAnswerBody = {
  schemaVersion: 1;
  answer: string;
  metadata?: Record<string, unknown>;
};

type AlgorithmPermissionDecisionBody = {
  schemaVersion: 1;
  allow: boolean;
  message?: string;
  updatedInput?: Record<string, unknown>;
};
```

Answering or deciding appends `algorithm.question.answered` or `algorithm.permission.decided` before forwarding the command result to callers. A stale id returns `404 not_found` and does not call the runner.

### Runner Frame Protocol

`command-client.js` exports these public functions:

| Function | Responsibility |
| --- | --- |
| `parseRunnerCommandEnv(value = process.env.ALGORITHM_RUNNER_COMMAND)` | Parse the required JSON array command config. |
| `runAlgorithmCommand(input)` | Spawn the configured command for short lifecycle/decision commands, write one request line, consume NDJSON stdout until a `result` or `error` frame, and return a typed result. |
| `startAlgorithmRun(input)` | Spawn a long-lived start process, write one request line, wait for `accepted`, register the child in `process-registry.js`, and stream later frames to `run-store.js` until exit. |
| `mapRunnerResultToHttp(result)` | Map command-client failures to the route error table without leaking raw stderr. |

Request line:

```json
{"schemaVersion":1,"kind":"request","command":"start","requestId":"req_01h...","runId":"alg_01h...","ownerUserId":"42","payload":{}}
```

Stdout frames are newline-delimited JSON objects:

```json
{"schemaVersion":1,"kind":"accepted","requestId":"req_01h...","runId":"alg_01h...","externalRunHandle":"runner-123","sessionId":null}
{"schemaVersion":1,"kind":"event","runId":"alg_01h...","event":{"type":"algorithm.run.started","payload":{}}}
{"schemaVersion":1,"kind":"state","runId":"alg_01h...","state":{"status":"running","sessionId":"sess_123"}}
{"schemaVersion":1,"kind":"log","runId":"alg_01h...","level":"info","message":"phase changed"}
{"schemaVersion":1,"kind":"result","requestId":"req_01h...","runId":"alg_01h...","ok":true,"status":"completed"}
{"schemaVersion":1,"kind":"error","requestId":"req_01h...","runId":"alg_01h...","error":{"code":"not_found","message":"run not found"}}
```

The stdout reader must buffer partial lines and flush one trailing complete line at EOF. A partial trailing line without a newline is accepted only if it parses as a complete JSON object. Non-JSON stdout is `runner_protocol_error`; stderr is captured for private diagnostics and never echoed raw in public responses. Unsupported `schemaVersion`, unknown `kind`, mismatched `requestId`, mismatched `runId`, ENOENT, non-zero exit before `result`, timeout, and max-output overflow are all typed command-client errors.

Start lifetime semantics:

- `POST /api/algorithm-runs` creates metadata with `status: "starting"` and `ownerUserId` before spawning.
- The route calls `startAlgorithmRun` and waits only until `accepted` or a start timeout.
- After `accepted`, `process-registry.js` owns the child. The HTTP handler returns `202`.
- Later runner frames are appended to `run-store.js`; they are the source for state/events routes.
- On child exit without a terminal event, the registry appends `algorithm.run.failed` with `runner_protocol_error`.
- `stop` sends a control command and, if the process is still registered after the command result, terminates the child.

## Route Contract

### `POST /api/algorithm-runs`

Request:

```json
{
  "schemaVersion": 1,
  "projectPath": "/absolute/project/path",
  "prompt": "Implement the task",
  "provider": "claude",
  "model": "sonnet",
  "permissionMode": "default",
  "algorithmMode": "loop",
  "metadata": {
    "source": "cc-agent-ui"
  }
}
```

Success response, HTTP 202:

```json
{
  "ok": true,
  "schemaVersion": 1,
  "run": {
    "runId": "alg_01h...",
    "ownerUserId": "42",
    "sessionId": null,
    "projectPath": "/absolute/project/path",
    "provider": "claude",
    "status": "starting",
    "createdAt": "2026-04-26T15:04:05.000Z",
    "updatedAt": "2026-04-26T15:04:05.000Z",
    "eventCursor": { "sequence": 0 }
  },
  "links": {
    "state": "/api/algorithm-runs/alg_01h.../state",
    "events": "/api/algorithm-runs/alg_01h.../events?after=0"
  }
}
```

Failure response:

```json
{
  "ok": false,
  "schemaVersion": 1,
  "error": {
    "code": "invalid_request",
    "message": "provider must be one of claude, cursor, codex, gemini"
  }
}
```

Auth failures for this route come from `authenticateToken`, not the Algorithm router:

```json
{ "error": "Access denied. No token provided." }
```

Owner mismatch after auth succeeds returns a versioned route envelope:

```json
{
  "ok": false,
  "schemaVersion": 1,
  "error": {
    "code": "forbidden",
    "message": "run is owned by another user"
  }
}
```

### Read Routes

`GET /api/algorithm-runs/:runId/state` success, HTTP 200:

```json
{
  "ok": true,
  "schemaVersion": 1,
  "runId": "alg_01h...",
  "state": {
    "schemaVersion": 1,
    "runId": "alg_01h...",
    "provider": "claude",
    "model": "sonnet",
    "status": "waiting_for_question",
    "sessionId": "sess_123",
    "phase": "plan",
    "eventCursor": { "sequence": 7 },
    "pendingQuestion": {
      "id": "q_1",
      "prompt": "Which test should run first?",
      "choices": ["unit", "integration"],
      "requestedAt": "2026-04-26T15:05:00.000Z",
      "sourceEventSequence": 7
    },
    "pendingPermission": null,
    "lastError": null,
    "createdAt": "2026-04-26T15:04:05.000Z",
    "updatedAt": "2026-04-26T15:05:00.000Z",
    "startedAt": "2026-04-26T15:04:06.000Z",
    "endedAt": null
  }
}
```

`GET /api/algorithm-runs/:runId/events?after=N` success, HTTP 200:

```json
{
  "ok": true,
  "schemaVersion": 1,
  "runId": "alg_01h...",
  "events": [
    {
      "schemaVersion": 1,
      "sequence": 8,
      "runId": "alg_01h...",
      "type": "algorithm.question.answered",
      "createdAt": "2026-04-26T15:06:00.000Z",
      "payload": { "questionId": "q_1" }
    }
  ],
  "cursor": { "sequence": 8 }
}
```

`GET /api/algorithm-runs/:runId/events?after=N&stream=1` sends `text/event-stream`. The route sends all backlog frames before the first heartbeat:

```text
event: algorithm.event
data: {"schemaVersion":1,"sequence":8,"runId":"alg_01h...","type":"algorithm.question.answered","createdAt":"2026-04-26T15:06:00.000Z","payload":{"questionId":"q_1"}}

event: algorithm.heartbeat
data: {"schemaVersion":1,"runId":"alg_01h...","cursor":{"sequence":8}}

```

SSE cleanup requirements:

- Poll or watch interval: 1000 ms by default.
- Heartbeat interval: 15000 ms by default.
- Max connection lifetime: 15 minutes by default, after which the server closes the stream cleanly.
- `req.on('close')` must tear down timers/watchers.
- Terminal runs close immediately after the backlog and terminal event are sent.
- Auth for EventSource may use the existing `?token=` query fallback supported by `authenticateToken`.

### Lifecycle Routes

Routes:

- `POST /api/algorithm-runs/:runId/pause`
- `POST /api/algorithm-runs/:runId/resume`
- `POST /api/algorithm-runs/:runId/stop`

`stop` accepts:

```json
{ "schemaVersion": 1, "reason": "user requested stop" }
```

Lifecycle success, HTTP 200:

```json
{
  "ok": true,
  "schemaVersion": 1,
  "runId": "alg_01h...",
  "command": "pause",
  "state": {
    "schemaVersion": 1,
    "runId": "alg_01h...",
    "provider": "claude",
    "status": "paused",
    "sessionId": "sess_123",
    "eventCursor": { "sequence": 12 },
    "pendingQuestion": null,
    "pendingPermission": null,
    "lastError": null,
    "createdAt": "2026-04-26T15:04:05.000Z",
    "updatedAt": "2026-04-26T15:08:00.000Z"
  },
  "cursor": { "sequence": 12 }
}
```

Terminal lifecycle conflict, HTTP 409:

```json
{
  "ok": false,
  "schemaVersion": 1,
  "error": {
    "code": "conflict",
    "message": "cannot resume a completed run"
  }
}
```

### Decision Routes

`POST /api/algorithm-runs/:runId/questions/:questionId/answer` request:

```json
{
  "schemaVersion": 1,
  "answer": "unit"
}
```

Question answer success, HTTP 200:

```json
{
  "ok": true,
  "schemaVersion": 1,
  "runId": "alg_01h...",
  "questionId": "q_1",
  "state": {
    "schemaVersion": 1,
    "runId": "alg_01h...",
    "provider": "claude",
    "status": "running",
    "sessionId": "sess_123",
    "eventCursor": { "sequence": 8 },
    "pendingQuestion": null,
    "pendingPermission": null,
    "lastError": null,
    "createdAt": "2026-04-26T15:04:05.000Z",
    "updatedAt": "2026-04-26T15:06:00.000Z"
  },
  "cursor": { "sequence": 8 }
}
```

`POST /api/algorithm-runs/:runId/permissions/:permissionId/decision` request:

```json
{
  "schemaVersion": 1,
  "allow": true,
  "message": "Allowed for this run",
  "updatedInput": { "path": "src/index.js" }
}
```

Permission decision success follows the same envelope with `permissionId` instead of `questionId`. Empty answers return `400 invalid_request`; stale question/permission ids return `404 not_found`; runner failures return `502 runner_protocol_error` unless mapped to a more specific runner code.

## Testing Strategy

- Framework: Vitest via `npm test -- <file>`.
- Unit tests: contract validators, command client, run id/path validation, event replay.
- Integration tests: Express route behavior with module mocks and temporary run-store directories.
- Regression tests: CopilotKit/Nolme route tests continue to pass without modification, and missing direct `/api/agent` and `/api/sessions` route contract tests are added before the mount behavior is considered complete.

## Observable Behaviors

1. Given an Algorithm Run request, when the payload is malformed or unsupported, then the server rejects it before touching the command runner or filesystem.
2. Given a valid authenticated start request, when `/api/algorithm-runs` is called, then cc-agent-ui creates owner-bound metadata, waits for a runner `accepted` frame, registers the child process, and returns a versioned 202 response.
3. Given stored Algorithm events, when state/events routes are queried, then cc-agent-ui authorizes `ownerUserId`, returns deterministic snapshots, and cursor-filters events without accepting arbitrary event paths.
4. Given an existing run, when pause/resume/stop routes are called, then cc-agent-ui authorizes the owner, validates lifecycle state, forwards a typed command, and records returned events/state before responding.
5. Given pending question or permission state, when decision routes are called, then cc-agent-ui authorizes the owner and validates ids against current state before forwarding decisions.
6. Given an authenticated app server, when `/api/algorithm-runs` is mounted, then mount-level auth failures use existing `{ error }` bodies and existing non-Algorithm routes are unchanged.

---

## Behavior 1: Contract Validation Rejects Bad Requests

### Resource Registry Binding

- `resource_id`: `[PROPOSED] 2d7eb82b-b41e-430b-88a6-ed828a649b24`
- `address_alias`: `algorithm.run_contracts`
- `predicate_refs`: `schemaVersion == 1`, provider enum, run id safe segment, projectPath absolute and accessible, command enum, status enum, decision body schemas.
- `codepath_ref`: `server/algorithm-runs/contracts.js::validateStartRunRequest`
- `schema_contract_refs`: `[PROPOSED] .cw9/schema/middleware_schema.json::AlgorithmRunContracts`

### Schema Interface Mapping

- `loop_mode`: `low_context_detail`
- `mapped_contracts`: no canonical schema entry exists; add proposed `AlgorithmRunContracts`.
- `registry_updates`: add `[PROPOSED] 2d7eb82b-b41e-430b-88a6-ed828a649b24` to canonical registry when available.

### Test Specification

Given an unsupported schema version, unknown provider, relative/inaccessible project path, empty prompt, malformed run id, unsupported command, malformed decision body, or unsupported status, when validation runs, then it returns a structured `invalid_request` error and does not call the command client.

Edge cases:

- `schemaVersion: 2`
- provider `"nolme"` rejected
- `runId: "../escape"` rejected
- `projectPath: "relative/path"` rejected
- non-existent `projectPath` rejected before runner call unless implementation explicitly documents runner-delegated path failures in the test
- empty prompt rejected for start only
- unknown lifecycle command rejected
- `answer: ""` rejected
- permission decision without boolean `allow` rejected
- unknown status rejected during state/event projection

### TDD Cycle

#### Red: Write Failing Tests

File: `tests/generated/test_algorithm_run_contracts.spec.ts`

```ts
import { describe, expect, it } from 'vitest';
import {
  validateStartRunRequest,
  validateQuestionAnswerBody,
  validatePermissionDecisionBody,
  validateRunId,
  makeApiError,
} from '../../server/algorithm-runs/contracts.js';

describe('Algorithm Run contract validation', () => {
  it('rejects unsupported schema versions and providers', () => {
    expect(validateStartRunRequest({ schemaVersion: 2 }).ok).toBe(false);
    expect(validateStartRunRequest({ schemaVersion: 1, provider: 'nolme' }).ok).toBe(false);
  });

  it('rejects run ids that can escape the run store', () => {
    expect(validateRunId('../escape').ok).toBe(false);
    expect(validateRunId('valid-run_123').ok).toBe(true);
  });

  it('returns versioned API error envelopes', () => {
    expect(makeApiError('invalid_request', 'bad')).toEqual({
      ok: false,
      schemaVersion: 1,
      error: { code: 'invalid_request', message: 'bad' },
    });
  });

  it('validates decision bodies', () => {
    expect(validateQuestionAnswerBody({ schemaVersion: 1, answer: '' }).ok).toBe(false);
    expect(validatePermissionDecisionBody({ schemaVersion: 1, allow: 'yes' }).ok).toBe(false);
    expect(validatePermissionDecisionBody({ schemaVersion: 1, allow: true }).ok).toBe(true);
  });
});
```

#### Green: Minimal Implementation

File: `server/algorithm-runs/contracts.js`

```js
/**
 * @rr.id 2d7eb82b-b41e-430b-88a6-ed828a649b24
 * @rr.alias algorithm.run_contracts
 * @path.id validate-algorithm-run-contracts
 * @gwt.given an Algorithm Run API request reaches cc-agent-ui
 * @gwt.when validateStartRunRequest or validateRunId evaluates it
 * @gwt.then malformed payloads are rejected before runner or filesystem access
 * @reads 2d7eb82b-b41e-430b-88a6-ed828a649b24
 * @writes N/A
 * @raises invalid_request:InvalidAlgorithmRunRequest
 * @schema.contract .cw9/schema/middleware_schema.json::AlgorithmRunContracts [PROPOSED]
 */
export function validateStartRunRequest(body) {
  return { ok: true, value: body };
}
```

#### Refactor

- Split validators into `validateProvider`, `validatePermissionMode`, `validateProjectPath`, `validateRunId`, `validateStatus`, `validateQuestionAnswerBody`, `validatePermissionDecisionBody`, and `makeApiError`.
- Keep validators pure and side-effect free.
- Export only validation helpers used by routes and tests.

### Success Criteria

Automated:

- `npm test -- tests/generated/test_algorithm_run_contracts.spec.ts`
- Existing `npm test -- tests/generated/test_nolme_state_route.spec.ts tests/generated/test_copilotkit_route_auth.spec.ts` still pass.

Manual:

- Review confirms `"nolme"` is not an accepted provider or adapter mode.

---

## Behavior 2: Start Route Creates Metadata And Invokes Command Client

### Resource Registry Binding

- `resource_id`: `[PROPOSED] 94b2d483-62fd-444e-9540-a89e42d1d878`
- `address_alias`: `algorithm.start_route`
- `predicate_refs`: valid start request, authenticated user, owner-bound metadata, configured command client, runner accepted frame.
- `codepath_ref`: `server/routes/algorithm-runs.js::POST /api/algorithm-runs`
- `schema_contract_refs`: `[PROPOSED] .cw9/schema/backend_schema.json::AlgorithmRunsStartRoute`

### Schema Interface Mapping

- `loop_mode`: `low_context_detail`
- `mapped_contracts`: route contract table above -> proposed backend endpoint schema.
- `registry_updates`: add route resource to canonical registry when available.

### Test Specification

Given a valid start request and a fake command runner, when the route is called, then the server creates a run id, writes owner-bound metadata, invokes `startAlgorithmRun` once, waits for `accepted`, registers the child, and returns a 202 response with links.

Edge cases:

- `ALGORITHM_RUNNER_COMMAND` missing returns 503.
- runner emits `error` before `accepted` returns matching 502.
- command client timeout returns 504.
- project path missing returns 400 before runner call.
- metadata includes `ownerUserId: String(req.user.id)`.
- runner `accepted.sessionId` updates metadata when non-null.

### TDD Cycle

#### Red: Write Failing Tests

File: `tests/generated/test_algorithm_runs_route_start.spec.ts`

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import http from 'node:http';

const { startRunMock, runStoreMock } = vi.hoisted(() => ({
  startRunMock: vi.fn(),
  runStoreMock: {
    createRunMetadata: vi.fn(),
    readRunMetadata: vi.fn(),
    updateRunMetadata: vi.fn(),
  },
}));

vi.mock('../../server/algorithm-runs/command-client.js', () => ({
  startAlgorithmRun: startRunMock,
}));

vi.mock('../../server/algorithm-runs/run-store.js', () => runStoreMock);

describe('POST /api/algorithm-runs', () => {
  it('creates owner-bound run metadata and returns 202 after runner accepted', async () => {
    startRunMock.mockResolvedValue({
      ok: true,
      runId: 'alg_1',
      accepted: { externalRunHandle: 'runner-1', sessionId: null },
    });
    runStoreMock.createRunMetadata.mockResolvedValue({
      runId: 'alg_1',
      ownerUserId: '42',
      projectPath: '/tmp/project',
      provider: 'claude',
      status: 'starting',
      createdAt: '2026-04-26T15:04:05.000Z',
      updatedAt: '2026-04-26T15:04:05.000Z',
      eventCursor: { sequence: 0 },
    });

    // start test app with req.user.id = 42, POST valid body
    // assert createRunMetadata ownerUserId, startAlgorithmRun payload, status/body/links
  });
});
```

#### Green: Minimal Implementation

Files:

- `server/routes/algorithm-runs.js`
- `server/algorithm-runs/command-client.js`
- `server/algorithm-runs/run-store.js`
- `server/index.js`

```js
/**
 * @rr.id 94b2d483-62fd-444e-9540-a89e42d1d878
 * @rr.alias algorithm.start_route
 * @path.id start-algorithm-run-route
 * @gwt.given a valid authenticated Algorithm Run start request
 * @gwt.when POST /api/algorithm-runs handles it
 * @gwt.then owner-bound run metadata is created, the runner is accepted, and HTTP 202 is returned
 * @reads 2d7eb82b-b41e-430b-88a6-ed828a649b24,332cd3c7-78dc-4c2e-b6d4-61e18711a5c6,3f65fa2f-4f24-4e0e-8e41-d4d2fee65499
 * @writes 3f65fa2f-4f24-4e0e-8e41-d4d2fee65499
 * @raises invalid_request:InvalidAlgorithmRunRequest, runner_unavailable:AlgorithmRunnerUnavailable
 * @schema.contract .cw9/schema/backend_schema.json::AlgorithmRunsStartRoute [PROPOSED]
 */
router.post('/', async (req, res) => {
  return res.status(202).json({ ok: true, schemaVersion: 1 });
});
```

#### Refactor

- Move response envelope creation into `contracts.js`.
- Generate run ids in one helper, not in the route body.
- Store `ownerUserId = String(req.user.id)` in metadata before spawning.
- Call `startAlgorithmRun`, not `runAlgorithmCommand`, for the async start route.
- If `accepted.sessionId` is non-null, update metadata before responding.
- Ensure `server/index.js` mount is a single protected line near existing API mounts:
  `app.use('/api/algorithm-runs', authenticateToken, algorithmRunsRouter);`

### Success Criteria

Automated:

- `npm test -- tests/generated/test_algorithm_runs_route_start.spec.ts`
- `npm test -- tests/generated/test_copilotkit_route_auth.spec.ts`

Manual:

- Route contract reviewed against existing `/api/agent` conventions.

---

## Behavior 3: Command Client Uses Explicit NDJSON Frame Protocol

### Resource Registry Binding

- `resource_id`: `[PROPOSED] 332cd3c7-78dc-4c2e-b6d4-61e18711a5c6`
- `address_alias`: `algorithm.command_client`
- `predicate_refs`: configured executable JSON array, JSON request line, NDJSON stdout frames, timeout budget, max output budget.
- `codepath_ref`: `server/algorithm-runs/command-client.js::runAlgorithmCommand`
- `schema_contract_refs`: `[PROPOSED] .cw9/schema/middleware_schema.json::AlgorithmCommandClient`

### Schema Interface Mapping

- `loop_mode`: `low_context_detail`
- `mapped_contracts`: child-process JSON request plus NDJSON frame protocol -> proposed middleware schema.
- `registry_updates`: add command-client resource to canonical registry when available.

### Test Specification

Given a configured command executable, when cc-agent-ui sends a command payload, then the client spawns without shell interpolation, writes one JSON request line to stdin, parses newline-delimited stdout frames, buffers partial lines, and maps exit, timeout, malformed JSON, unsupported schema, ENOENT, non-zero exit, and max-output overflow to typed errors.

The protocol is the one defined in `Runner Frame Protocol` above. `startAlgorithmRun` waits for `accepted`; `runAlgorithmCommand` waits for `result` or `error`.

### TDD Cycle

#### Red: Write Failing Tests

File: `tests/generated/test_algorithm_command_client.spec.ts`

```ts
import { describe, expect, it, vi } from 'vitest';
import {
  parseRunnerCommandEnv,
  runAlgorithmCommand,
  startAlgorithmRun,
} from '../../server/algorithm-runs/command-client.js';

describe('Algorithm command client', () => {
  it('parses ALGORITHM_RUNNER_COMMAND as a JSON string array', () => {
    expect(parseRunnerCommandEnv('["node","runner.mjs"]')).toEqual({
      ok: true,
      value: { executable: 'node', args: ['runner.mjs'] },
    });
    expect(parseRunnerCommandEnv('node runner.mjs').ok).toBe(false);
    expect(parseRunnerCommandEnv('[]').ok).toBe(false);
  });

  it('sends a JSON request line and parses NDJSON result frames from a fake runner', async () => {
    const result = await runAlgorithmCommand({
      executable: process.execPath,
      args: ['tests/fixtures/fake-algorithm-runner.mjs'],
      command: 'pause',
      runId: 'alg_1',
      requestId: 'req_1',
      ownerUserId: '42',
      payload: {},
      timeoutMs: 1000,
    });
    expect(result.ok).toBe(true);
  });

  it('returns accepted from startAlgorithmRun and leaves later frames to the store callbacks', async () => {
    const result = await startAlgorithmRun({
      executable: process.execPath,
      args: ['tests/fixtures/fake-algorithm-runner.mjs'],
      runId: 'alg_1',
      requestId: 'req_1',
      ownerUserId: '42',
      payload: {},
      timeoutMs: 1000,
      onFrame: vi.fn(),
    });
    expect(result.ok).toBe(true);
    expect(result.accepted.runId).toBe('alg_1');
  });

  it('returns runner_timeout when the child does not answer in time', async () => {
    // fake runner sleeps beyond timeout
  });

  it('buffers partial stdout chunks and parses a trailing complete JSON line at EOF', async () => {
    // fake runner splits one result frame across multiple chunks
  });

  it('maps non-JSON stdout, unsupported schema, mismatched requestId, and non-zero exit to runner_protocol_error', async () => {
    // fake runners exercise each protocol failure
  });
});
```

#### Green: Minimal Implementation

File: `server/algorithm-runs/command-client.js`

```js
/**
 * @rr.id 332cd3c7-78dc-4c2e-b6d4-61e18711a5c6
 * @rr.alias algorithm.command_client
 * @path.id run-algorithm-command-client
 * @gwt.given cc-agent-ui must call an external Algorithm runner
 * @gwt.when runAlgorithmCommand or startAlgorithmRun spawns the configured executable
 * @gwt.then one JSON request line is written and versioned NDJSON frames are consumed
 * @reads 332cd3c7-78dc-4c2e-b6d4-61e18711a5c6
 * @writes N/A
 * @raises runner_unavailable:AlgorithmRunnerUnavailable, runner_timeout:AlgorithmRunnerTimeout, runner_protocol_error:AlgorithmRunnerProtocolError
 * @schema.contract .cw9/schema/middleware_schema.json::AlgorithmCommandClient [PROPOSED]
 */
export async function runAlgorithmCommand(input) {
  return { ok: true, schemaVersion: 1 };
}

export async function startAlgorithmRun(input) {
  return { ok: true, schemaVersion: 1, accepted: { runId: input.runId } };
}
```

#### Refactor

- Parse `ALGORITHM_RUNNER_COMMAND` only as a JSON array of non-empty strings.
- Use `spawn(command, args, { shell: false })`.
- Include stderr in private diagnostics but never raw stderr in public error bodies.
- Enforce max stdout/stderr byte budgets.
- Kill timed-out child processes.
- Keep stdout line buffering independent from route code so existing CLI integrations are not modified.

#### Process Registry Red/Green

File: `tests/generated/test_algorithm_process_registry.spec.ts`

```ts
import { describe, expect, it, vi } from 'vitest';
import {
  getRegisteredProcess,
  registerAlgorithmProcess,
  terminateAlgorithmProcess,
  unregisterAlgorithmProcess,
} from '../../server/algorithm-runs/process-registry.js';

describe('Algorithm process registry', () => {
  it('registers a start-run child and removes it on exit', async () => {
    const child = fakeChildProcess();
    registerAlgorithmProcess({ runId: 'alg_1', child, ownerUserId: '42' });
    expect(getRegisteredProcess('alg_1')).toBeTruthy();
    child.emit('exit', 0, null);
    expect(getRegisteredProcess('alg_1')).toBeNull();
  });

  it('terminates a registered child for stop cleanup', async () => {
    const child = fakeChildProcess({ kill: vi.fn() });
    registerAlgorithmProcess({ runId: 'alg_1', child, ownerUserId: '42' });
    await terminateAlgorithmProcess('alg_1', { signal: 'SIGTERM', timeoutMs: 100 });
    expect(child.kill).toHaveBeenCalledWith('SIGTERM');
  });

  it('keeps unregister idempotent for already-exited children', () => {
    unregisterAlgorithmProcess('alg_1');
    unregisterAlgorithmProcess('alg_1');
    expect(getRegisteredProcess('alg_1')).toBeNull();
  });
});
```

Registry requirements:

- The registry is process-local and best-effort; crash recovery comes from `run-store.js` detecting non-terminal runs whose child is absent and appending `algorithm.run.failed`.
- Register only after `accepted`; unregister on `exit`, `error`, terminal result, timeout, and explicit stop cleanup.
- Never expose child process objects through routes.

### Success Criteria

Automated:

- `npm test -- tests/generated/test_algorithm_command_client.spec.ts`
- `npm test -- tests/generated/test_algorithm_process_registry.spec.ts`

Manual:

- Review confirms no shell string interpolation is introduced.

---

## Behavior 4: Run Store Serves Safe State And Cursor-Filtered Events

### Resource Registry Binding

- `resource_id`: `[PROPOSED] 3f65fa2f-4f24-4e0e-8e41-d4d2fee65499`
- `address_alias`: `algorithm.run_index`
- `predicate_refs`: valid run id, known metadata, owner user id, server-owned storage root, monotonic sequence allocation.
- `codepath_ref`: `server/algorithm-runs/run-store.js`
- `schema_contract_refs`: `[PROPOSED] .cw9/schema/shared_objects_schema.json::AlgorithmRunStore`

### Schema Interface Mapping

- `loop_mode`: `low_context_detail`
- `mapped_contracts`: run metadata/state/events -> proposed shared object schema.
- `registry_updates`: add run-store resource to canonical registry when available.

### Test Specification

Given run metadata and event JSONL stored under the server-owned run directory, when a caller requests state or events after a sequence, then the store resolves only safe run ids, preserves `ownerUserId` for route authorization, allocates monotonic event sequences, and returns deterministic event slices.

Edge cases:

- missing run returns `not_found`
- malformed JSONL line returns `state_corrupt`
- normal append allocates `sequence: lastSequence + 1`
- explicit replay/import append rejects duplicate or out-of-order sequence
- `metadata.lastSequence` mismatch with event log is repaired from the log
- missing/stale `state.json` is replayed from `events.jsonl`
- `after` below zero returns 400 at route validation
- state projection never leaks `eventsPath`
- state projection never leaks `projectPath`
- session-bound event updates `metadata.sessionId` from `null` to the runner-reported id

### TDD Cycle

#### Red: Write Failing Tests

File: `tests/generated/test_algorithm_run_store.spec.ts`

```ts
import { describe, expect, it } from 'vitest';
import {
  appendAlgorithmEvent,
  createRunMetadata,
  readAlgorithmEventsSince,
  readAlgorithmRunState,
  readRunMetadata,
} from '../../server/algorithm-runs/run-store.js';

describe('Algorithm run store', () => {
  it('stores metadata and returns events after a cursor', async () => {
    await createRunMetadata({
      runId: 'alg_1',
      ownerUserId: '42',
      projectPath: '/tmp/p',
      provider: 'claude',
      status: 'starting',
    });
    await appendAlgorithmEvent('alg_1', { type: 'algorithm.run.started', payload: {} });
    await appendAlgorithmEvent('alg_1', { type: 'algorithm.phase.changed', payload: { phase: 'plan' } });

    const events = await readAlgorithmEventsSince('alg_1', 1);
    expect(events.map((e) => e.sequence)).toEqual([2]);
  });

  it('preserves ownerUserId for route authorization', async () => {
    const metadata = await readRunMetadata('alg_1');
    expect(metadata.ownerUserId).toBe('42');
  });

  it('updates sessionId when a session-bound event is projected', async () => {
    await appendAlgorithmEvent('alg_1', {
      type: 'algorithm.session.bound',
      payload: { sessionId: 'sess_123' },
    });
    const metadata = await readRunMetadata('alg_1');
    expect(metadata.sessionId).toBe('sess_123');
  });

  it('does not expose filesystem paths in public state', async () => {
    const state = await readAlgorithmRunState('alg_1');
    expect(JSON.stringify(state)).not.toContain('events.jsonl');
    expect(JSON.stringify(state)).not.toContain('/tmp/p');
  });
});
```

#### Green: Minimal Implementation

File: `server/algorithm-runs/run-store.js`

```js
/**
 * @rr.id 3f65fa2f-4f24-4e0e-8e41-d4d2fee65499
 * @rr.alias algorithm.run_index
 * @path.id read-algorithm-run-store
 * @gwt.given a valid run id and server-owned run storage
 * @gwt.when state or events are read after a cursor
 * @gwt.then only matching run data is returned and local storage paths remain server-side
 * @reads 3f65fa2f-4f24-4e0e-8e41-d4d2fee65499
 * @writes 3f65fa2f-4f24-4e0e-8e41-d4d2fee65499
 * @raises not_found:AlgorithmRunNotFound, state_corrupt:AlgorithmRunStateCorrupt
 * @schema.contract .cw9/schema/shared_objects_schema.json::AlgorithmRunStore [PROPOSED]
 */
export async function readAlgorithmRunState(runId) {
  return { schemaVersion: 1, runId, status: 'unknown', eventCursor: { sequence: 0 } };
}
```

#### Refactor

- Keep private storage paths out of public state responses.
- Use atomic write via temp file then rename for snapshots.
- Store under a server-owned root, defaulting to `~/.cosmic-agent/algorithm-runs/<runId>/`.
- Use one per-run append lock so runner frames and lifecycle/decision route events serialize through the same sequence allocator.
- Add small helpers for event JSONL parse and projection.

### Success Criteria

Automated:

- `npm test -- tests/generated/test_algorithm_run_store.spec.ts`

Manual:

- Inspect a state response and confirm no local filesystem path is exposed.

---

## Behavior 5: State And Event Routes Are Deterministic

### Resource Registry Binding

- `resource_id`: `[PROPOSED] bdf59902-ffb7-499b-bccb-865814290356`
- `address_alias`: `algorithm.state_events_routes`
- `predicate_refs`: known run id, valid cursor, authenticated user, owner match, SSE cleanup.
- `codepath_ref`: `server/routes/algorithm-runs.js::GET /:runId/state`, `GET /:runId/events`
- `schema_contract_refs`: `[PROPOSED] .cw9/schema/backend_schema.json::AlgorithmRunReadRoutes`

### Schema Interface Mapping

- `loop_mode`: `low_context_detail`
- `mapped_contracts`: state/events HTTP route shape -> proposed backend endpoint schema.
- `registry_updates`: add read route resource to canonical registry when available.

### Test Specification

Given an existing run owned by the authenticated user with events 1 through 3, when a caller requests `after=1`, then the response contains events 2 and 3 and cursor 3. Given `stream=1`, the route emits backlog SSE events in sequence order before heartbeats, tears down timers on disconnect, and closes for terminal runs.

Edge cases:

- unknown run id -> 404
- known run owned by another user -> 403 `forbidden`
- invalid cursor -> 400
- unsupported `Accept`/`stream` combination falls back to JSON
- SSE backlog emits before heartbeat
- SSE `req.on('close')` clears polling/watcher and heartbeat timers
- SSE max lifetime closes the connection
- terminal run SSE closes after current backlog

### TDD Cycle

#### Red: Write Failing Tests

File: `tests/generated/test_algorithm_runs_route_state_events.spec.ts`

```ts
import { describe, expect, it, vi } from 'vitest';

describe('Algorithm run state/events routes', () => {
  it('returns state without private event path', async () => {
    // mock store, GET /api/algorithm-runs/alg_1/state
  });

  it('returns cursor-filtered events', async () => {
    // mock store, GET /api/algorithm-runs/alg_1/events?after=1
  });

  it('rejects owner mismatch before reading state or events', async () => {
    // mock metadata.ownerUserId = 7, req.user.id = 42, assert 403
  });

  it('streams events as SSE when stream=1', async () => {
    // assert text/event-stream, backlog-before-heartbeat, ordered data frames
  });

  it('tears down SSE timers when the request closes', async () => {
    // simulate req.close and assert watcher/timers are cleared
  });
});
```

#### Green: Minimal Implementation

File: `server/routes/algorithm-runs.js`

```js
/**
 * @rr.id bdf59902-ffb7-499b-bccb-865814290356
 * @rr.alias algorithm.state_events_routes
 * @path.id read-algorithm-run-state-events-routes
 * @gwt.given an authenticated caller requests known Algorithm run data
 * @gwt.when state or events routes read server-owned storage
 * @gwt.then deterministic state and cursor-filtered events are returned
 * @reads 2d7eb82b-b41e-430b-88a6-ed828a649b24,3f65fa2f-4f24-4e0e-8e41-d4d2fee65499
 * @writes N/A
 * @raises invalid_request:InvalidAlgorithmRunRequest, forbidden:AlgorithmRunForbidden, not_found:AlgorithmRunNotFound
 * @schema.contract .cw9/schema/backend_schema.json::AlgorithmRunReadRoutes [PROPOSED]
 */
router.get('/:runId/state', async (req, res) => {
  return res.json({ ok: true, schemaVersion: 1 });
});
```

#### Refactor

- Factor SSE formatting into `server/algorithm-runs/sse.js`.
- Keep JSON and SSE routes backed by the same `readAlgorithmEventsSince` helper.
- Add heartbeats only after deterministic backlog delivery.
- Read metadata and enforce `metadata.ownerUserId === String(req.user.id)` before returning state/events.
- Keep a single SSE cleanup function wired to `req.on('close')`, terminal backlog completion, and max lifetime timeout.

### Success Criteria

Automated:

- `npm test -- tests/generated/test_algorithm_runs_route_state_events.spec.ts`

Manual:

- `curl` JSON route returns versioned envelopes.
- `curl -N` stream route emits valid SSE `data:` frames.

---

## Behavior 6: Lifecycle Commands Are Validated And Forwarded

### Resource Registry Binding

- `resource_id`: `[PROPOSED] 010bf08c-4ffe-40cb-953b-2a0e09064db3`
- `address_alias`: `algorithm.lifecycle_routes`
- `predicate_refs`: existing run metadata, owner match, non-terminal status, valid command.
- `codepath_ref`: `server/routes/algorithm-runs.js::pause/resume/stop`
- `schema_contract_refs`: `[PROPOSED] .cw9/schema/backend_schema.json::AlgorithmRunLifecycleRoutes`

### Schema Interface Mapping

- `loop_mode`: `low_context_detail`
- `mapped_contracts`: pause/resume/stop route body and response -> proposed backend endpoint schema.
- `registry_updates`: add lifecycle route resource to canonical registry when available.

### Test Specification

Given an existing running run owned by the authenticated user, when pause is requested, then the route appends a lifecycle request event, forwards a `pause` command to the command client, and writes the returned events/state. Given a terminal run, when pause/resume/stop is requested, then the route returns a typed conflict without calling the runner.

Edge cases:

- missing run -> 404
- known run owned by another user -> 403 `forbidden`
- paused run + pause -> idempotent 200 with unchanged state
- completed run + resume -> 409
- stop accepts optional reason string
- stop terminates the registered child process if the runner remains active after the command result

### TDD Cycle

#### Red: Write Failing Tests

File: `tests/generated/test_algorithm_runs_route_lifecycle.spec.ts`

```ts
describe('Algorithm lifecycle routes', () => {
  it('forwards pause for a running run', async () => {
    // mock metadata running and ownerUserId match, command client ok, assert command payload
  });

  it('rejects owner mismatch before command-client call', async () => {
    // mock metadata.ownerUserId = 7, req.user.id = 42, assert 403 and no command call
  });

  it('rejects resume for a completed run without calling the runner', async () => {
    // mock terminal metadata, assert 409 and no command call
  });
});
```

#### Green: Minimal Implementation

File: `server/routes/algorithm-runs.js`

```js
/**
 * @rr.id 010bf08c-4ffe-40cb-953b-2a0e09064db3
 * @rr.alias algorithm.lifecycle_routes
 * @path.id forward-algorithm-run-lifecycle-command
 * @gwt.given an existing Algorithm run and a lifecycle route request
 * @gwt.when pause, resume, or stop is requested
 * @gwt.then route-level lifecycle validation happens before a typed command is forwarded
 * @reads 2d7eb82b-b41e-430b-88a6-ed828a649b24,332cd3c7-78dc-4c2e-b6d4-61e18711a5c6,3f65fa2f-4f24-4e0e-8e41-d4d2fee65499
 * @writes 3f65fa2f-4f24-4e0e-8e41-d4d2fee65499
 * @raises not_found:AlgorithmRunNotFound, forbidden:AlgorithmRunForbidden, conflict:AlgorithmRunLifecycleConflict, runner_protocol_error:AlgorithmRunnerProtocolError
 * @schema.contract .cw9/schema/backend_schema.json::AlgorithmRunLifecycleRoutes [PROPOSED]
 */
async function handleLifecycle(req, res, command) {
  return res.json({ ok: true, schemaVersion: 1, command });
}
```

#### Refactor

- Implement `isTerminalStatus(status)`.
- Keep idempotent behavior explicit for pause/stop.
- Read metadata and enforce owner before lifecycle validation.
- Include `ownerUserId` and `requestId` in the command-client request.
- Persist command result through the run store in one helper.

### Success Criteria

Automated:

- `npm test -- tests/generated/test_algorithm_runs_route_lifecycle.spec.ts`

Manual:

- Route responses distinguish validation errors from runner failures.

---

## Behavior 7: Question And Permission Decisions Validate Pending State

### Resource Registry Binding

- `resource_id`: `[PROPOSED] c6db6f76-d7d8-4dc4-b043-cd020d72c171`
- `address_alias`: `algorithm.decision_routes`
- `predicate_refs`: owner match, current state has matching pending question or permission id, answer/decision body schema.
- `codepath_ref`: `server/routes/algorithm-runs.js::answerQuestion`, `approvePermission`
- `schema_contract_refs`: `[PROPOSED] .cw9/schema/backend_schema.json::AlgorithmRunDecisionRoutes`

### Schema Interface Mapping

- `loop_mode`: `low_context_detail`
- `mapped_contracts`: answer/decision route payloads -> proposed backend endpoint schema.
- `registry_updates`: add decision route resource to canonical registry when available.

### Test Specification

Given current state with a pending question owned by the authenticated user, when the matching question id is answered, then the route appends `algorithm.question.answered`, forwards `{ command: "answerQuestion", runId, questionId, answer }`, and returns the updated state. Given a stale id, the route returns 404 and does not call the runner.

Permission decisions follow the same shape with `{ schemaVersion: 1, allow: boolean, message?, updatedInput? }` and append `algorithm.permission.decided`.

Edge cases:

- empty answer rejected
- owner mismatch rejected before pending-state lookup or runner call
- stale question id rejected
- stale permission id rejected
- permission decision requires boolean `allow`
- runner failure returns 502 with stable error envelope

### TDD Cycle

#### Red: Write Failing Tests

File: `tests/generated/test_algorithm_runs_route_decisions.spec.ts`

```ts
describe('Algorithm decision routes', () => {
  it('forwards an answer only when questionId matches pending state', async () => {
    // mock owner match and state.pendingQuestion.id = q1, POST /questions/q1/answer
  });

  it('rejects owner mismatch before checking pending decisions', async () => {
    // mock metadata.ownerUserId = 7, req.user.id = 42, assert 403 and no command call
  });

  it('rejects stale permission ids before command-client call', async () => {
    // mock pendingPermission.id = p1, POST /permissions/p2/decision
  });
});
```

#### Green: Minimal Implementation

File: `server/routes/algorithm-runs.js`

```js
/**
 * @rr.id c6db6f76-d7d8-4dc4-b043-cd020d72c171
 * @rr.alias algorithm.decision_routes
 * @path.id forward-algorithm-run-decision-command
 * @gwt.given an Algorithm run has a pending question or permission request
 * @gwt.when a matching decision route is posted
 * @gwt.then cc-agent-ui validates the pending id before forwarding the decision command
 * @reads 2d7eb82b-b41e-430b-88a6-ed828a649b24,332cd3c7-78dc-4c2e-b6d4-61e18711a5c6,3f65fa2f-4f24-4e0e-8e41-d4d2fee65499
 * @writes 3f65fa2f-4f24-4e0e-8e41-d4d2fee65499
 * @raises invalid_request:InvalidDecisionRequest, forbidden:AlgorithmRunForbidden, not_found:PendingDecisionNotFound, runner_protocol_error:AlgorithmRunnerProtocolError
 * @schema.contract .cw9/schema/backend_schema.json::AlgorithmRunDecisionRoutes [PROPOSED]
 */
async function handleDecision(req, res) {
  return res.json({ ok: true, schemaVersion: 1 });
}
```

#### Refactor

- Share pending-id lookup logic for questions and permissions.
- Validate answer/decision bodies with `contracts.js` before reading or forwarding.
- Read metadata and enforce owner before pending-state lookup.
- Keep provider-specific Claude pending-permission functions out of this route; this route talks only to the Algorithm command client.
- Record returned decision events through the run store.

### Success Criteria

Automated:

- `npm test -- tests/generated/test_algorithm_runs_route_decisions.spec.ts`

Manual:

- Stale id behavior is easy to distinguish from runner failures.

---

## Behavior 8: Route Mount Is Authenticated And Non-Invasive

### Resource Registry Binding

- `resource_id`: `[PROPOSED] 4f81efc8-7a45-438c-8dd5-bfd533bfa53c`
- `address_alias`: `algorithm.route_mount`
- `predicate_refs`: Express app with `authenticateToken`, existing auth error bodies, existing API mounts.
- `codepath_ref`: `server/index.js::app.use('/api/algorithm-runs', authenticateToken, algorithmRunsRouter)`
- `schema_contract_refs`: `[PROPOSED] .cw9/schema/backend_schema.json::AlgorithmRunsMount`

### Schema Interface Mapping

- `loop_mode`: `low_context_detail`
- `mapped_contracts`: route mount -> proposed backend endpoint schema.
- `registry_updates`: add mount resource to canonical registry when available.

### Test Specification

Given the app route mount, when unauthenticated callers hit `/api/algorithm-runs`, then existing `authenticateToken` rejects them before the route handler with its plain `{ error }` body. Given existing routes, when their tests run, then they are unchanged. Because this checkout does not currently include direct `/api/agent` or `/api/sessions` route contract tests, Behavior 8 includes adding minimal smoke tests for those routes before declaring the mount non-invasive.

### TDD Cycle

#### Red: Write Failing Tests

File: `tests/generated/test_algorithm_runs_mount_auth.spec.ts`

```ts
describe('Algorithm run route mount auth', () => {
  it('rejects unauthenticated requests before algorithm route code runs', async () => {
    // request without token, assert 401 { error: 'Access denied. No token provided.' }
    // assert algorithm route handler is not called
  });

  it('keeps invalid-token behavior as authenticateToken plain 403', async () => {
    // request with invalid bearer token, assert 403 { error: 'Invalid token' }
  });

  it('mounts under /api/algorithm-runs without changing /api/agent or /api/sessions', async () => {
    // route-level smoke test
  });
});
```

Additional route-contract tests to add if no existing file covers them:

- `tests/generated/test_agent_route_contract.spec.ts`: asserts `/api/agent` remains mounted with API-key behavior, not app JWT auth.
- `tests/generated/test_sessions_messages_route_contract.spec.ts`: asserts `/api/sessions/:sessionId/messages` remains protected by `authenticateToken`.

#### Green: Minimal Implementation

File: `server/index.js`

```js
/**
 * @rr.id 4f81efc8-7a45-438c-8dd5-bfd533bfa53c
 * @rr.alias algorithm.route_mount
 * @path.id mount-algorithm-run-routes
 * @gwt.given cc-agent-ui has authenticated API route mounts
 * @gwt.when algorithm run routes are added
 * @gwt.then they are mounted behind authenticateToken and existing routes remain unchanged
 * @reads 4f81efc8-7a45-438c-8dd5-bfd533bfa53c
 * @writes N/A
 * @raises existing_auth_error:ExistingAuthenticateTokenError
 * @schema.contract .cw9/schema/backend_schema.json::AlgorithmRunsMount [PROPOSED]
 */
app.use('/api/algorithm-runs', authenticateToken, algorithmRunsRouter);
```

#### Refactor

- Keep mount order near `server/index.js:464-478`.
- Do not place the route under `/api/nolme` or `/api/copilotkit`.
- Do not apply API-key auth from `/api/agent`; this is app-authenticated server API.
- Do not wrap or replace `authenticateToken`; owner authorization belongs inside `algorithmRunsRouter` after auth succeeds.

### Success Criteria

Automated:

- `npm test -- tests/generated/test_algorithm_runs_mount_auth.spec.ts`
- `npm test -- tests/generated/test_agent_route_contract.spec.ts tests/generated/test_sessions_messages_route_contract.spec.ts`
- `npm test -- tests/generated/test_copilotkit_route_auth.spec.ts tests/generated/test_nolme_state_route.spec.ts`

Manual:

- Route table review confirms no Nolme route changes.

---

## Integration And Regression Testing

Run these after each behavior lands:

```bash
npm test -- tests/generated/test_algorithm_run_contracts.spec.ts
npm test -- tests/generated/test_algorithm_command_client.spec.ts
npm test -- tests/generated/test_algorithm_process_registry.spec.ts
npm test -- tests/generated/test_algorithm_run_store.spec.ts
npm test -- tests/generated/test_algorithm_runs_route_start.spec.ts
npm test -- tests/generated/test_algorithm_runs_route_state_events.spec.ts
npm test -- tests/generated/test_algorithm_runs_route_lifecycle.spec.ts
npm test -- tests/generated/test_algorithm_runs_route_decisions.spec.ts
npm test -- tests/generated/test_algorithm_runs_mount_auth.spec.ts
npm test -- tests/generated/test_agent_route_contract.spec.ts tests/generated/test_sessions_messages_route_contract.spec.ts
npm run typecheck
```

Regression guard:

```bash
npm test -- tests/generated/test_nolme_state_route.spec.ts tests/generated/test_copilotkit_route_auth.spec.ts tests/generated/test_ag_ui_event_translator.spec.ts
npm test -- tests/generated/test_agent_route_contract.spec.ts tests/generated/test_sessions_messages_route_contract.spec.ts
```

These regression tests are not because this plan touches Nolme. They are guards proving the no-Nolme boundary was respected.

## Implementation Order

1. Add pure contract validators.
2. Add command-client NDJSON frame protocol with fake-runner tests.
3. Add process-registry lifetime and cleanup tests.
4. Add run store and event projection tests.
5. Add start route.
6. Add state/events routes.
7. Add lifecycle routes.
8. Add decision routes.
9. Mount the router behind app auth and run regression tests.

## API Error Codes

Algorithm router errors after `authenticateToken` succeeds use versioned envelopes:

| Code | HTTP | Meaning |
| --- | --- | --- |
| `invalid_request` | 400 | Request shape, provider, run id, cursor, or payload failed validation. |
| `forbidden` | 403 | Authenticated user does not own the requested run. |
| `not_found` | 404 | Run id or pending decision id was not found. |
| `conflict` | 409 | Lifecycle command is invalid for current status. |
| `runner_unavailable` | 503 | `ALGORITHM_RUNNER_COMMAND` is missing, invalid JSON, not a non-empty string array, or not executable. |
| `runner_timeout` | 504 | Command runner exceeded timeout. |
| `runner_protocol_error` | 502 | Runner exited non-zero, emitted malformed JSON/NDJSON, returned unsupported schema, mismatched run/request ids, or exceeded output budget. |
| `state_corrupt` | 500 | Server-owned run state cannot be parsed. |

Mount-level auth failures are not versioned Algorithm envelopes because `authenticateToken` runs before the router:

| Case | HTTP | Body |
| --- | --- | --- |
| Missing token | 401 | `{ "error": "Access denied. No token provided." }` |
| Invalid token | 403 | `{ "error": "Invalid token" }` |

## References

- Reference plan: `thoughts/searchable/shared/plans/2026-04-26-algorithm-run-api-boundary.md`
- Applied review: `thoughts/searchable/shared/plans/2026-04-26-cc-agent-ui-algorithm-run-api-boundary-tdd-REVIEW.md`
- Harness middleware research: `thoughts/searchable/shared/research/2026-04-26-cc-agent-ui-harness-middleware-interfaces.md`
- Nolme surface research, used only to identify non-targets: `thoughts/searchable/shared/research/2026-04-26-nolme-algorithm-interface-surfaces.md`
- Route mount pattern: `server/index.js:464-478`
- External API route pattern: `server/routes/agent.js:618-988`
- WebSocket writer and provider dispatch: `server/index.js:1532-1619`
- Unified history route: `server/routes/messages.js:29-54`
- Provider normalized message contract: `server/providers/types.js:13-119`
- Explicit non-target Nolme adapter: `server/agents/ccu-session-agent.js:67-345`
- Explicit non-target AG-UI translator: `server/agents/ag-ui-event-translator.js:89-258`
