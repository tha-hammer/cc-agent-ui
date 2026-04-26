---
date: 2026-04-26
reviewer: CobaltMarsh
repository: cc-agent-ui
source_plan: thoughts/searchable/shared/plans/2026-04-26-cc-agent-ui-algorithm-run-api-boundary-tdd.md
status: needs_major_revision
---

# Plan Review Report: cc-agent-ui Algorithm Run API Boundary TDD

Source plan: `thoughts/searchable/shared/plans/2026-04-26-cc-agent-ui-algorithm-run-api-boundary-tdd.md`

Review date: 2026-04-26

## Review Summary

| Category | Status | Issues Found |
| --- | --- | --- |
| Contracts | WARNING | 2 |
| Interfaces | WARNING | 2 |
| Promises | CRITICAL | 3 |
| Data Models | WARNING | 3 |
| APIs | WARNING | 2 |

Approval status: **Needs Major Revision**. The enhanced plan resolves the earlier broad blockers: it is now scoped to `cc-agent-ui`, defines an NDJSON runner boundary, includes owner-bound metadata, specifies state/event schemas, and aligns mount-level auth with existing `authenticateToken`. Implementation should still wait until the plan fixes the decision-forwarding order and start-failure cleanup semantics.

## Evidence Reviewed

- The plan narrows scope and excludes Nolme/core changes at lines 20-28 and 74-85.
- The resolved boundary decisions define NDJSON runner output, owner checks, one run store, and plain mount-level auth failures at lines 104-119.
- Metadata, state, event, pending decision, and runner frame schemas are defined at lines 121-323.
- Route success/failure examples are defined at lines 368-620.
- Behavior 3 command-client/process-registry tests are defined at lines 887-1063; Behavior 3A runner adapter tests are defined at lines 1067-1243.
- Run-store and state/event route behavior is defined at lines 1247-1478.
- Lifecycle and decision route behavior is defined at lines 1482-1666.
- Mount and regression behavior is defined at lines 1670-1785.
- Existing API route mount order puts protected APIs before static/catch-all routing in `server/index.js:420-478`.
- `authenticateToken` returns plain `{ error }` bodies and sets `req.user` from the DB row in `server/middleware/auth.js:23-76`.
- Existing route tests use real Express apps, `http.createServer`, ephemeral ports, native `fetch`, hoisted module mocks, and explicit server close cleanup, for example `tests/generated/test_copilotkit_route_auth.spec.ts:71-90` and `tests/generated/test_nolme_state_route.spec.ts:17-35`.
- Existing CLI/process code shows useful local patterns for line buffering, timeout kill, and process registries in `server/cursor-cli.js:227-264`, `server/gemini-cli.js:221-234`, and `server/utils/plugin-process-manager.js:15-132`.

## Contract Review

### Well-Defined

- The plan now clearly states this is a `cc-agent-ui` API/store/runner-boundary slice, not a core or Nolme implementation.
- The runner protocol is explicit NDJSON with `accepted`, `event`, `state`, `log`, `result`, and `error` frames.
- The plan stores `ownerUserId = String(req.user.id)` and requires owner checks on every `/:runId` route.
- The Algorithm state/event/pending decision schemas are specified with version fields and public/private field exclusions.
- Mount-level auth behavior matches the real `authenticateToken` plain error bodies for missing and invalid tokens.

### Missing or Unclear

- WARNING: The accepted-frame status contract is internally inconsistent. Projection says `algorithm.runner.accepted` sets status to `running` at lines 233-235, but the start response after waiting for runner acceptance still shows `status: "starting"` at lines 389-405. Lines 316-321 say later runner frames feed state/events after acceptance, but the plan does not say whether `accepted` itself is durably appended before the `202` response.
- WARNING: The global `/api` API-key gate is omitted from the route contract. `server/index.js:420` applies `validateApiKey` to all `/api/*` routes before route-specific auth when `API_KEY` is configured. The plan's auth table at lines 1815-1820 only describes `authenticateToken`.

### Recommendations

- Decide whether `accepted` is a stored event. If yes, append it before returning `202` and make the start response/status `running`; if not, remove the `algorithm.runner.accepted` projection rule and keep the start response explicitly `starting`.
- Add one sentence to Behavior 8: `/api/algorithm-runs` also inherits the existing optional global `/api` `validateApiKey` gate when `API_KEY` is configured.

## Interface Review

### Well-Defined

- The planned module split is now coherent: `contracts.js`, `command-client.js`, `process-registry.js`, `runner-adapter.js`, `run-store.js`, `sse.js`, and `routes/algorithm-runs.js`.
- The command-client API table at lines 286-295 is concrete enough to guide implementation.
- The route mount line at lines 1720-1735 matches the local protected-router pattern in `server/index.js:464-478`.

### Missing or Unclear

- WARNING: Fixture naming is inconsistent. Behavior 3 tests use `tests/fixtures/fake-algorithm-runner.mjs` at lines 936 and 950, while the rest of the plan standardizes on `tests/fixtures/algorithm-runner-fixture.mjs` at lines 67, 116, 338, 1146, and 1205.
- WARNING: `runAlgorithmCommand` and `startAlgorithmRun` need an explicit config-source contract. The API table says `parseRunnerCommandEnv(value = process.env.ALGORITHM_RUNNER_COMMAND)` at lines 286-295, but test examples pass `executable` and `args` directly at lines 933-957. Both modes can be valid, but route code and tests need to know which is production-default and which is test injection.

### Recommendations

- Use one fixture filename everywhere, preferably `tests/fixtures/algorithm-runner-fixture.mjs`.
- State that production callers omit `executable/args` and use `ALGORITHM_RUNNER_COMMAND`, while tests may inject `executable/args` to avoid mutating global env.

## Promise Review

### Well-Defined

- Validation-before-runner and validation-before-filesystem are explicit.
- Runner stdout parsing, stderr privacy, timeout, ENOENT, schema mismatch, run/request id mismatch, and max-output failures are enumerated.
- SSE backlog-before-heartbeat, disconnect cleanup, heartbeat interval, and max lifetime are now specified.
- The process registry is explicitly process-local and best-effort, with crash recovery delegated to the run store.

### Missing or Unclear

- CRITICAL: Decision routes append the clearing event before forwarding the decision to the runner. Lines 284 and 1593-1595 say answering/deciding appends `algorithm.question.answered` or `algorithm.permission.decided` before forwarding. Projection clears pending decisions on those events at lines 238-241. If the runner call then fails with the planned `502 runner_protocol_error` at line 1604, the local state has already cleared the pending question/permission even though the runner never accepted the decision.
- CRITICAL: Start failure after metadata creation has no cleanup or terminal-state contract. Lines 318-320 require metadata creation before spawning and waiting for `accepted`; lines 780-783 define missing runner, pre-accepted runner error, timeout, and missing project path failures. The plan does not say whether the pre-created run is deleted, marked `failed`, or left as `starting`.
- WARNING: Start-process registration ordering needs one more invariant. The adapter example emits `accepted` and `result` back-to-back at lines 1182-1187, while `startAlgorithmRun` registers after `accepted` at lines 316-323. The command client must not register an already-terminal child as active when accepted and terminal frames arrive in the same stdout chunk.

### Recommendations

- For decision routes, either forward first and append `answered/decided` only after runner success, or split local audit from state-clearing with events such as `decision.submitted` and `decision.forward_failed`. Do not let a failed runner call clear pending state.
- For start failures, define one behavior: validate runner/project before metadata creation where possible; for failures after creation, append `algorithm.run.failed` with the typed runner error or delete the run directory before returning the error.
- In `startAlgorithmRun`, specify that accepted is handled, the process is registered, and only then are buffered post-accepted frames dispatched; if a terminal frame is already buffered, registration must immediately unregister.

## Data Model Review

### Well-Defined

- `AlgorithmRunMetadata`, `AlgorithmRunState`, `AlgorithmRunEvent`, `AlgorithmQuestionRequest`, and `AlgorithmPermissionRequest` are now defined.
- The storage layout is explicit under `ALGORITHM_RUN_STORE_ROOT`, defaulting to `~/.cosmic-agent/algorithm-runs`.
- `metadata.lastSequence`, append-before-publish, per-run append lock, snapshot replay, metadata repair, and `state_corrupt` behavior are specified.
- Public state excludes storage paths, runner commands, raw stderr, private tool input, and `projectPath`.

### Missing or Unclear

- WARNING: The run-id grammar is still only implied. The plan rejects `../escape` and accepts `valid-run_123` at lines 696-699, while generated examples use `alg_01h...`. Because run ids are directory names, the exact regex should be canonical.
- WARNING: Store tests need mandatory temp-root isolation. The testing strategy mentions temporary run-store directories at line 626, but the Behavior 4 sample test creates run metadata without showing `ALGORITHM_RUN_STORE_ROOT` setup/cleanup at lines 1297-1304. Without an explicit fixture, tests can write to `~/.cosmic-agent/algorithm-runs`.
- WARNING: The per-run append lock is process-local. That is fine for the current single Node server model, but the plan should explicitly state that multi-process/clustered app instances are unsupported until a file lock or DB-backed store exists.

### Recommendations

- Define `validateRunId` as an exact regex and require path resolution to verify the final run directory remains under the configured root.
- Add a test harness note: every run-store/route integration test must set `ALGORITHM_RUN_STORE_ROOT` to `fs.mkdtemp(...)` and clean it with `rm -rf`/`fs.rm(..., { recursive: true, force: true })`.
- Add a storage-scope sentence: sequence guarantees are per Node process for the file-backed first pass.

## API Review

### Well-Defined

- The main endpoint set is complete: start, state, events JSON/SSE, lifecycle, question answer, and permission decision.
- Success and failure examples exist for start, read, lifecycle, and decisions.
- Owner mismatch returns a versioned `403 forbidden` after `authenticateToken` succeeds.
- Regression coverage now includes adding direct `/api/agent` and `/api/sessions` route contract tests before declaring the mount non-invasive.

### Missing or Unclear

- WARNING: Behavior 8 should include the optional global `/api` API-key gate in the auth test matrix or explicitly isolate tests with `delete process.env.API_KEY`.
- WARNING: The plan asks for SSE timer cleanup tests, but this repo has no existing generated test that exercises a real `text/event-stream` connection or request close. The plan should spell out whether to use fake timers with a mocked response/request or a real HTTP stream test.

### Recommendations

- Add test setup/teardown for `process.env.API_KEY` in mount tests.
- Add an SSE test harness pattern before implementation: real HTTP streaming with abort/close, or unit tests around `server/algorithm-runs/sse.js` with fake timers and mocked request/response objects.

## Critical Issues To Address Before Implementation

1. **Decision Forwarding Order**: Pending state is cleared before runner success is known.
   - Impact: a failed runner decision can make the UI believe a question or permission was resolved when the runner never received it.
   - Recommendation: append state-clearing `answered/decided` events only after runner success, or introduce non-clearing submitted/failed audit events.

2. **Start Failure Cleanup**: Metadata is created before spawn/acceptance, but pre-accepted failures do not define cleanup.
   - Impact: failed starts can leave orphaned `starting` runs and stale event cursors.
   - Recommendation: validate before create where possible; otherwise mark the run `failed` with a terminal event or delete the run before returning the error.

## Suggested Plan Amendments

```diff
# In Pending Decision Schemas / Behavior 7
- Answering or deciding appends algorithm.question.answered or algorithm.permission.decided before forwarding the command result to callers.
+ Validate pending state first, forward the decision to the runner, then append algorithm.question.answered or algorithm.permission.decided only after the runner accepts/succeeds.
+ If audit-before-forward is required, append a non-clearing decision.submitted event and append decision.forward_failed on runner failure.

# In Start lifetime semantics / Behavior 2
+ If start fails after metadata creation but before accepted, either delete the run directory or append algorithm.run.failed and persist terminal failed state before returning the mapped error.
+ If accepted and terminal frames arrive in the same stdout chunk, register/unregister ordering must not leave the child in process-registry.

# In Runner Frame Protocol / Route Contract
~ Decide whether accepted is persisted as algorithm.runner.accepted before the 202 response.
~ Align the start response status with that decision: starting if accepted is only a handshake, running if accepted is a stored event.

# In Behavior 3 tests
- tests/fixtures/fake-algorithm-runner.mjs
+ tests/fixtures/algorithm-runner-fixture.mjs

# In Behavior 4 tests
+ Set ALGORITHM_RUN_STORE_ROOT to a per-test temp directory and clean it after each test.
+ Define validateRunId with an exact regex and assert path containment under the store root.

# In Behavior 8
+ Account for the existing global /api validateApiKey middleware when API_KEY is set, or explicitly clear API_KEY in focused mount tests.
```

## Review Checklist

### Contracts

- [x] Component boundaries are clearly defined.
- [x] Input/output contracts are mostly specified.
- [x] Error contracts enumerate runner and route failures.
- [ ] Preconditions and postconditions are fully documented for start and decision failure cases.
- [ ] Accepted-frame/status invariants are unambiguous.

### Interfaces

- [x] Public module responsibilities are defined.
- [x] Naming mostly follows codebase conventions.
- [ ] Test fixture names are consistent.
- [ ] Production env config vs test injection is explicit.
- [x] Route visibility/mounting is appropriate.

### Promises

- [x] Behavioral guarantees are documented for auth, storage, and SSE.
- [x] Async timeout/cancellation handling is planned.
- [ ] Decision failure does not corrupt pending state.
- [ ] Start failure does not leave orphaned starting runs.
- [ ] Registration ordering is defined for same-chunk accepted/result frames.

### Data Models

- [x] Fields have types.
- [x] Required vs optional is clear.
- [x] Relationships between metadata, state, and events are documented.
- [ ] Test storage isolation is mandatory.
- [ ] Run-id grammar and process-scope sequence guarantees are explicit.

### APIs

- [x] All endpoints are named.
- [x] Request/response formats are mostly specified.
- [x] Error responses match `authenticateToken` for JWT failures.
- [ ] Optional global API-key auth is included in the API contract.
- [ ] SSE cleanup test strategy is concrete.
