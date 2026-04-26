---
date: 2026-04-26
status: draft
repository: cc-agent-ui
scope: cc-agent-ui only
reference_plan: thoughts/searchable/shared/plans/2026-04-26-algorithm-run-api-boundary.md
review_reference: thoughts/searchable/shared/plans/2026-04-26-algorithm-run-api-boundary-REVIEW.md
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
- `cc-agent-ui` calls an external Algorithm command runner through an explicit child-process JSON protocol.
- `cc-agent-ui` stores and serves run metadata, state snapshots, and event cursors from a local run store.
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
| Core command boundary | `server/algorithm-runs/command-client.js` spawns an env-configured command using JSON stdin/stdout and deterministic timeout/error behavior. |
| Run identity | `server/algorithm-runs/run-store.js` owns run metadata keyed by `runId`, with `sessionId`, `projectPath`, provider, status, and cursor. |
| State/events | `server/algorithm-runs/event-store.js` appends/reads run events and projects a server-side `AlgorithmRunState` snapshot. |
| HTTP routes | `server/routes/algorithm-runs.js` mounts start, state, events, lifecycle, question, and permission routes. |
| Auth mount | `server/index.js` mounts `/api/algorithm-runs` behind `authenticateToken`. |

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
    "sessionId": null,
    "projectPath": "/absolute/project/path",
    "provider": "claude",
    "status": "starting",
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

### Read Routes

| Route | Response |
| --- | --- |
| `GET /api/algorithm-runs/:runId/state` | Latest projected `AlgorithmRunState`. |
| `GET /api/algorithm-runs/:runId/events?after=N` | JSON `{ ok, schemaVersion, runId, events, cursor }`. |
| `GET /api/algorithm-runs/:runId/events?after=N&stream=1` | SSE stream of events after cursor `N`, heartbeats, and terminal close. |

### Lifecycle Routes

| Route | Command |
| --- | --- |
| `POST /api/algorithm-runs/:runId/pause` | Forward `{ command: "pause", runId }` to command client. |
| `POST /api/algorithm-runs/:runId/resume` | Forward `{ command: "resume", runId }` to command client. |
| `POST /api/algorithm-runs/:runId/stop` | Forward `{ command: "stop", runId, reason? }` to command client. |

### Decision Routes

| Route | Command |
| --- | --- |
| `POST /api/algorithm-runs/:runId/questions/:questionId/answer` | Validate pending question id before forwarding answer. |
| `POST /api/algorithm-runs/:runId/permissions/:permissionId/decision` | Validate pending permission id before forwarding allow/deny decision. |

## Testing Strategy

- Framework: Vitest via `npm test -- <file>`.
- Unit tests: contract validators, command client, run id/path validation, event replay.
- Integration tests: Express route behavior with module mocks and temporary run-store directories.
- Regression tests: existing `/api/agent`, `/api/sessions`, and CopilotKit/Nolme route tests continue to pass without modification.

## Observable Behaviors

1. Given an Algorithm Run request, when the payload is malformed or unsupported, then the server rejects it before touching the command runner or filesystem.
2. Given a valid start request, when `/api/algorithm-runs` is called, then cc-agent-ui creates local run metadata, invokes the configured command runner once, and returns a versioned 202 response.
3. Given stored Algorithm events, when state/events routes are queried, then cc-agent-ui returns deterministic snapshots and cursor-filtered events without accepting arbitrary event paths.
4. Given an existing run, when pause/resume/stop routes are called, then cc-agent-ui validates lifecycle state, forwards a typed command, and records the returned state or error.
5. Given pending question or permission state, when decision routes are called, then cc-agent-ui validates ids against current state before forwarding decisions.
6. Given an authenticated app server, when `/api/algorithm-runs` is mounted, then unauthenticated requests are rejected and existing non-Algorithm routes are unchanged.

---

## Behavior 1: Contract Validation Rejects Bad Requests

### Resource Registry Binding

- `resource_id`: `[PROPOSED] 2d7eb82b-b41e-430b-88a6-ed828a649b24`
- `address_alias`: `algorithm.run_contracts`
- `predicate_refs`: `schemaVersion == 1`, provider enum, run id safe segment, projectPath absolute, command enum.
- `codepath_ref`: `server/algorithm-runs/contracts.js::validateStartRunRequest`
- `schema_contract_refs`: `[PROPOSED] .cw9/schema/middleware_schema.json::AlgorithmRunContracts`

### Schema Interface Mapping

- `loop_mode`: `low_context_detail`
- `mapped_contracts`: no canonical schema entry exists; add proposed `AlgorithmRunContracts`.
- `registry_updates`: add `[PROPOSED] 2d7eb82b-b41e-430b-88a6-ed828a649b24` to canonical registry when available.

### Test Specification

Given an unsupported schema version, unknown provider, relative project path, empty prompt, malformed run id, or unsupported command, when validation runs, then it returns a structured `invalid_request` error and does not call the command client.

Edge cases:

- `schemaVersion: 2`
- provider `"nolme"` rejected
- `runId: "../escape"` rejected
- `projectPath: "relative/path"` rejected
- empty prompt rejected for start only
- unknown lifecycle command rejected

### TDD Cycle

#### Red: Write Failing Tests

File: `tests/generated/test_algorithm_run_contracts.spec.ts`

```ts
import { describe, expect, it } from 'vitest';
import {
  validateStartRunRequest,
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

- Split validators into `validateProvider`, `validatePermissionMode`, `validateProjectPath`, `validateRunId`, and `makeApiError`.
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
- `predicate_refs`: valid start request, authenticated user, configured command client.
- `codepath_ref`: `server/routes/algorithm-runs.js::POST /api/algorithm-runs`
- `schema_contract_refs`: `[PROPOSED] .cw9/schema/backend_schema.json::AlgorithmRunsStartRoute`

### Schema Interface Mapping

- `loop_mode`: `low_context_detail`
- `mapped_contracts`: route contract table above -> proposed backend endpoint schema.
- `registry_updates`: add route resource to canonical registry when available.

### Test Specification

Given a valid start request and a fake command runner, when the route is called, then the server creates a run id, writes metadata, invokes the command client once, and returns a 202 response with links.

Edge cases:

- `ALGORITHM_RUNNER_COMMAND` missing returns 503.
- runner returns `{ ok: false }` returns matching 502.
- command client timeout returns 504.
- project path missing returns 400 before runner call.

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
  },
}));

vi.mock('../../server/algorithm-runs/command-client.js', () => ({
  startAlgorithmRun: startRunMock,
}));

vi.mock('../../server/algorithm-runs/run-store.js', () => runStoreMock);

describe('POST /api/algorithm-runs', () => {
  it('creates run metadata and returns 202 with state/events links', async () => {
    startRunMock.mockResolvedValue({ ok: true, runId: 'alg_1', state: { status: 'starting' } });
    runStoreMock.createRunMetadata.mockResolvedValue({
      runId: 'alg_1',
      projectPath: '/tmp/project',
      provider: 'claude',
      status: 'starting',
      eventCursor: { sequence: 0 },
    });

    // start test app, POST valid body, assert status/body/mocks
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
 * @gwt.then run metadata is created, the command client is invoked, and HTTP 202 is returned
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
- Ensure `server/index.js` mount is a single protected line near existing API mounts:
  `app.use('/api/algorithm-runs', authenticateToken, algorithmRunsRouter);`

### Success Criteria

Automated:

- `npm test -- tests/generated/test_algorithm_runs_route_start.spec.ts`
- `npm test -- tests/generated/test_copilotkit_route_auth.spec.ts`

Manual:

- Route contract reviewed against existing `/api/agent` conventions.

---

## Behavior 3: Command Client Uses Explicit JSON Protocol

### Resource Registry Binding

- `resource_id`: `[PROPOSED] 332cd3c7-78dc-4c2e-b6d4-61e18711a5c6`
- `address_alias`: `algorithm.command_client`
- `predicate_refs`: configured executable, JSON request payload, timeout budget.
- `codepath_ref`: `server/algorithm-runs/command-client.js::runAlgorithmCommand`
- `schema_contract_refs`: `[PROPOSED] .cw9/schema/middleware_schema.json::AlgorithmCommandClient`

### Schema Interface Mapping

- `loop_mode`: `low_context_detail`
- `mapped_contracts`: child-process JSON request/response protocol -> proposed middleware schema.
- `registry_updates`: add command-client resource to canonical registry when available.

### Test Specification

Given a configured command executable, when cc-agent-ui sends a command payload, then the client spawns without shell interpolation, writes one JSON object to stdin, parses one JSON response from stdout, and maps exit, timeout, and malformed JSON to typed errors.

Protocol:

```json
{
  "schemaVersion": 1,
  "command": "start",
  "requestId": "req_...",
  "runId": "alg_...",
  "payload": {}
}
```

Success:

```json
{
  "ok": true,
  "schemaVersion": 1,
  "runId": "alg_...",
  "state": {}
}
```

Failure:

```json
{
  "ok": false,
  "schemaVersion": 1,
  "error": { "code": "not_found", "message": "run not found" }
}
```

### TDD Cycle

#### Red: Write Failing Tests

File: `tests/generated/test_algorithm_command_client.spec.ts`

```ts
import { describe, expect, it } from 'vitest';
import { runAlgorithmCommand } from '../../server/algorithm-runs/command-client.js';

describe('Algorithm command client', () => {
  it('sends JSON on stdin and parses JSON stdout from a fake runner', async () => {
    const result = await runAlgorithmCommand({
      executable: process.execPath,
      args: ['tests/fixtures/fake-algorithm-runner.mjs'],
      command: 'pause',
      runId: 'alg_1',
      payload: {},
      timeoutMs: 1000,
    });
    expect(result.ok).toBe(true);
  });

  it('returns runner_timeout when the child does not answer in time', async () => {
    // fake runner sleeps beyond timeout
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
 * @gwt.when runAlgorithmCommand spawns the configured executable
 * @gwt.then one JSON request is written and one versioned JSON result is returned
 * @reads 332cd3c7-78dc-4c2e-b6d4-61e18711a5c6
 * @writes N/A
 * @raises runner_unavailable:AlgorithmRunnerUnavailable, runner_timeout:AlgorithmRunnerTimeout, runner_protocol_error:AlgorithmRunnerProtocolError
 * @schema.contract .cw9/schema/middleware_schema.json::AlgorithmCommandClient [PROPOSED]
 */
export async function runAlgorithmCommand(input) {
  return { ok: true, schemaVersion: 1 };
}
```

#### Refactor

- Parse `ALGORITHM_RUNNER_COMMAND` with JSON array support or a documented executable-plus-args format.
- Use `spawn(command, args, { shell: false })`.
- Include stderr in logs but not raw stderr in public error bodies unless safe.
- Kill timed-out child processes.

### Success Criteria

Automated:

- `npm test -- tests/generated/test_algorithm_command_client.spec.ts`

Manual:

- Review confirms no shell string interpolation is introduced.

---

## Behavior 4: Run Store Serves Safe State And Cursor-Filtered Events

### Resource Registry Binding

- `resource_id`: `[PROPOSED] 3f65fa2f-4f24-4e0e-8e41-d4d2fee65499`
- `address_alias`: `algorithm.run_index`
- `predicate_refs`: valid run id, known metadata, server-owned storage root.
- `codepath_ref`: `server/algorithm-runs/run-store.js`
- `schema_contract_refs`: `[PROPOSED] .cw9/schema/shared_objects_schema.json::AlgorithmRunStore`

### Schema Interface Mapping

- `loop_mode`: `low_context_detail`
- `mapped_contracts`: run metadata/state/events -> proposed shared object schema.
- `registry_updates`: add run-store resource to canonical registry when available.

### Test Specification

Given run metadata and event JSONL stored under the server-owned run directory, when a caller requests state or events after a sequence, then the store resolves only safe run ids and returns deterministic event slices.

Edge cases:

- missing run returns `not_found`
- malformed JSONL line is skipped or returns `state_corrupt` as specified by the test
- duplicate sequence is rejected on append
- `after` below zero returns 400 at route validation
- state projection never leaks `eventsPath`

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
} from '../../server/algorithm-runs/run-store.js';

describe('Algorithm run store', () => {
  it('stores metadata and returns events after a cursor', async () => {
    await createRunMetadata({ runId: 'alg_1', projectPath: '/tmp/p', provider: 'claude' });
    await appendAlgorithmEvent('alg_1', { sequence: 1, type: 'algorithm.run.started' });
    await appendAlgorithmEvent('alg_1', { sequence: 2, type: 'algorithm.phase.changed' });

    const events = await readAlgorithmEventsSince('alg_1', 1);
    expect(events.map((e) => e.sequence)).toEqual([2]);
  });

  it('does not expose filesystem paths in public state', async () => {
    const state = await readAlgorithmRunState('alg_1');
    expect(JSON.stringify(state)).not.toContain('events.jsonl');
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
 * @reads 3f65fa2f-4f24-4e0e-8e41-d4d2fee65499,44b6ef63-f7ea-4988-818f-094bebdc838e
 * @writes 3f65fa2f-4f24-4e0e-8e41-d4d2fee65499,44b6ef63-f7ea-4988-818f-094bebdc838e
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
- Store under a server-owned root, defaulting to `~/.claude/projects/<encodedProjectPath>/algorithm-runs/<runId>/`.
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
- `predicate_refs`: known run id, valid cursor, authenticated user.
- `codepath_ref`: `server/routes/algorithm-runs.js::GET /:runId/state`, `GET /:runId/events`
- `schema_contract_refs`: `[PROPOSED] .cw9/schema/backend_schema.json::AlgorithmRunReadRoutes`

### Schema Interface Mapping

- `loop_mode`: `low_context_detail`
- `mapped_contracts`: state/events HTTP route shape -> proposed backend endpoint schema.
- `registry_updates`: add read route resource to canonical registry when available.

### Test Specification

Given an existing run with events 1 through 3, when a caller requests `after=1`, then the response contains events 2 and 3 and cursor 3. Given `stream=1`, the route emits SSE events in sequence order and closes for terminal runs.

Edge cases:

- unknown run id -> 404
- invalid cursor -> 400
- unsupported `Accept`/`stream` combination falls back to JSON
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

  it('streams events as SSE when stream=1', async () => {
    // assert text/event-stream and ordered data frames
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
 * @reads 2d7eb82b-b41e-430b-88a6-ed828a649b24,3f65fa2f-4f24-4e0e-8e41-d4d2fee65499,44b6ef63-f7ea-4988-818f-094bebdc838e
 * @writes N/A
 * @raises invalid_request:InvalidAlgorithmRunRequest, not_found:AlgorithmRunNotFound
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
- `predicate_refs`: existing run metadata, non-terminal status, valid command.
- `codepath_ref`: `server/routes/algorithm-runs.js::pause/resume/stop`
- `schema_contract_refs`: `[PROPOSED] .cw9/schema/backend_schema.json::AlgorithmRunLifecycleRoutes`

### Schema Interface Mapping

- `loop_mode`: `low_context_detail`
- `mapped_contracts`: pause/resume/stop route body and response -> proposed backend endpoint schema.
- `registry_updates`: add lifecycle route resource to canonical registry when available.

### Test Specification

Given an existing running run, when pause is requested, then the route forwards a `pause` command to the command client and writes the returned state. Given a terminal run, when pause/resume/stop is requested, then the route returns a typed conflict without calling the runner.

Edge cases:

- missing run -> 404
- paused run + pause -> idempotent 200 with unchanged state
- completed run + resume -> 409
- stop accepts optional reason string

### TDD Cycle

#### Red: Write Failing Tests

File: `tests/generated/test_algorithm_runs_route_lifecycle.spec.ts`

```ts
describe('Algorithm lifecycle routes', () => {
  it('forwards pause for a running run', async () => {
    // mock metadata running, command client ok, assert command payload
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
 * @writes 3f65fa2f-4f24-4e0e-8e41-d4d2fee65499,44b6ef63-f7ea-4988-818f-094bebdc838e
 * @raises not_found:AlgorithmRunNotFound, conflict:AlgorithmRunLifecycleConflict, runner_protocol_error:AlgorithmRunnerProtocolError
 * @schema.contract .cw9/schema/backend_schema.json::AlgorithmRunLifecycleRoutes [PROPOSED]
 */
async function handleLifecycle(req, res, command) {
  return res.json({ ok: true, schemaVersion: 1, command });
}
```

#### Refactor

- Implement `isTerminalStatus(status)`.
- Keep idempotent behavior explicit for pause/stop.
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
- `predicate_refs`: current state has matching pending question or permission id.
- `codepath_ref`: `server/routes/algorithm-runs.js::answerQuestion`, `approvePermission`
- `schema_contract_refs`: `[PROPOSED] .cw9/schema/backend_schema.json::AlgorithmRunDecisionRoutes`

### Schema Interface Mapping

- `loop_mode`: `low_context_detail`
- `mapped_contracts`: answer/decision route payloads -> proposed backend endpoint schema.
- `registry_updates`: add decision route resource to canonical registry when available.

### Test Specification

Given current state with a pending question, when the matching question id is answered, then the route forwards `{ command: "answerQuestion", runId, questionId, answer }`. Given a stale id, the route returns 404 and does not call the runner.

Permission decisions follow the same shape with `{ allow: boolean, message?, updatedInput? }`.

Edge cases:

- empty answer rejected
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
    // mock state.pendingQuestion.id = q1, POST /questions/q1/answer
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
 * @writes 3f65fa2f-4f24-4e0e-8e41-d4d2fee65499,44b6ef63-f7ea-4988-818f-094bebdc838e
 * @raises invalid_request:InvalidDecisionRequest, not_found:PendingDecisionNotFound, runner_protocol_error:AlgorithmRunnerProtocolError
 * @schema.contract .cw9/schema/backend_schema.json::AlgorithmRunDecisionRoutes [PROPOSED]
 */
async function handleDecision(req, res) {
  return res.json({ ok: true, schemaVersion: 1 });
}
```

#### Refactor

- Share pending-id lookup logic for questions and permissions.
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
- `predicate_refs`: Express app with `authenticateToken`, existing API mounts.
- `codepath_ref`: `server/index.js::app.use('/api/algorithm-runs', authenticateToken, algorithmRunsRouter)`
- `schema_contract_refs`: `[PROPOSED] .cw9/schema/backend_schema.json::AlgorithmRunsMount`

### Schema Interface Mapping

- `loop_mode`: `low_context_detail`
- `mapped_contracts`: route mount -> proposed backend endpoint schema.
- `registry_updates`: add mount resource to canonical registry when available.

### Test Specification

Given the app route mount, when unauthenticated callers hit `/api/algorithm-runs`, then auth rejects them before the route handler. Given existing routes, when their tests run, then they are unchanged.

### TDD Cycle

#### Red: Write Failing Tests

File: `tests/generated/test_algorithm_runs_mount_auth.spec.ts`

```ts
describe('Algorithm run route mount auth', () => {
  it('rejects unauthenticated requests before algorithm route code runs', async () => {
    // fake auth middleware denies request, assert handler not called
  });

  it('mounts under /api/algorithm-runs without changing /api/agent or /api/sessions', async () => {
    // route-level smoke test
  });
});
```

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
 * @raises auth_required:AlgorithmRunAuthRequired
 * @schema.contract .cw9/schema/backend_schema.json::AlgorithmRunsMount [PROPOSED]
 */
app.use('/api/algorithm-runs', authenticateToken, algorithmRunsRouter);
```

#### Refactor

- Keep mount order near `server/index.js:464-478`.
- Do not place the route under `/api/nolme` or `/api/copilotkit`.
- Do not apply API-key auth from `/api/agent`; this is app-authenticated server API.

### Success Criteria

Automated:

- `npm test -- tests/generated/test_algorithm_runs_mount_auth.spec.ts`
- `npm test -- tests/generated/test_copilotkit_route_auth.spec.ts tests/generated/test_nolme_state_route.spec.ts`

Manual:

- Route table review confirms no Nolme route changes.

---

## Integration And Regression Testing

Run these after each behavior lands:

```bash
npm test -- tests/generated/test_algorithm_run_contracts.spec.ts
npm test -- tests/generated/test_algorithm_command_client.spec.ts
npm test -- tests/generated/test_algorithm_run_store.spec.ts
npm test -- tests/generated/test_algorithm_runs_route_start.spec.ts
npm test -- tests/generated/test_algorithm_runs_route_state_events.spec.ts
npm test -- tests/generated/test_algorithm_runs_route_lifecycle.spec.ts
npm test -- tests/generated/test_algorithm_runs_route_decisions.spec.ts
npm test -- tests/generated/test_algorithm_runs_mount_auth.spec.ts
npm run typecheck
```

Regression guard:

```bash
npm test -- tests/generated/test_nolme_state_route.spec.ts tests/generated/test_copilotkit_route_auth.spec.ts tests/generated/test_ag_ui_event_translator.spec.ts
```

These regression tests are not because this plan touches Nolme. They are guards proving the no-Nolme boundary was respected.

## Implementation Order

1. Add pure contract validators.
2. Add command-client JSON protocol with fake-runner tests.
3. Add run store and event projection tests.
4. Add start route.
5. Add state/events routes.
6. Add lifecycle routes.
7. Add decision routes.
8. Mount the router behind app auth and run regression tests.

## API Error Codes

| Code | HTTP | Meaning |
| --- | --- | --- |
| `invalid_request` | 400 | Request shape, provider, run id, cursor, or payload failed validation. |
| `auth_required` | 401 | Existing `authenticateToken` rejected the request. |
| `not_found` | 404 | Run id or pending decision id was not found. |
| `conflict` | 409 | Lifecycle command is invalid for current status. |
| `runner_unavailable` | 503 | `ALGORITHM_RUNNER_COMMAND` is not configured or executable. |
| `runner_timeout` | 504 | Command runner exceeded timeout. |
| `runner_protocol_error` | 502 | Runner exited non-zero, emitted malformed JSON, or returned unsupported schema. |
| `state_corrupt` | 500 | Server-owned run state cannot be parsed. |

## References

- Reference plan: `thoughts/searchable/shared/plans/2026-04-26-algorithm-run-api-boundary.md`
- Review: `thoughts/searchable/shared/plans/2026-04-26-algorithm-run-api-boundary-REVIEW.md`
- Harness middleware research: `thoughts/searchable/shared/research/2026-04-26-cc-agent-ui-harness-middleware-interfaces.md`
- Nolme surface research, used only to identify non-targets: `thoughts/searchable/shared/research/2026-04-26-nolme-algorithm-interface-surfaces.md`
- Route mount pattern: `server/index.js:464-478`
- External API route pattern: `server/routes/agent.js:618-988`
- WebSocket writer and provider dispatch: `server/index.js:1532-1619`
- Unified history route: `server/routes/messages.js:29-54`
- Provider normalized message contract: `server/providers/types.js:13-119`
- Explicit non-target Nolme adapter: `server/agents/ccu-session-agent.js:67-345`
- Explicit non-target AG-UI translator: `server/agents/ag-ui-event-translator.js:89-258`
