---
date: 2026-04-26
reviewer: GoldAnchor
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
| Contracts | CRITICAL | 4 |
| Interfaces | CRITICAL | 4 |
| Promises | CRITICAL | 3 |
| Data Models | CRITICAL | 4 |
| APIs | CRITICAL | 3 |

Approval status: **Needs Major Revision**. The narrowed `cc-agent-ui` scope is the right correction from the previous cross-repo plan, and the route set is directionally implementable. Implementation should still wait until the plan defines runner event ingestion, authenticated run ownership, the full state/event schemas, and the exact mount-level auth/error behavior.

## Evidence Reviewed

- The plan narrows scope to `cc-agent-ui` and explicitly excludes Nolme/core changes at plan lines 18-24 and 64-73.
- The route contract and examples are at plan lines 90-166.
- The command-client protocol is defined as one JSON request and one JSON response at plan lines 422-457.
- The run store behavior is described at plan lines 529-616.
- The state/events route behavior is described at plan lines 630-718.
- The lifecycle and decision route behaviors are described at plan lines 722-891.
- The route mount and error-code table are at plan lines 895-1018.
- Protected app routes are mounted with `authenticateToken` in `server/index.js:431-478`; `/api/agent` is the API-key exception at `server/index.js:467-468`.
- `authenticateToken` returns plain `{ error }` bodies and uses `401` for missing tokens, `403` for invalid tokens in `server/middleware/auth.js:23-76`.
- Existing provider CLI streaming uses newline-framed JSON, partial-line buffers, and trailing flushes in `server/gemini-response-handler.js:14-70` and `server/cursor-cli.js:227-264`.
- Gemini timeout behavior kills the child after a no-output timeout in `server/gemini-cli.js:221-234`.
- The existing normalized provider boundary is `NormalizedMessage` / `ProviderAdapter` in `server/providers/types.js:13-119`.
- The current database is opened from `DATABASE_PATH` or `server/database/auth.db` at `server/database/db.js:25-60`; no Algorithm run/event table exists in the current schema.
- Nolme state sidecars use `~/.claude/projects/<projectName-or-encoded-projectPath>/<sessionId>.nolme-state.json` in `server/agents/nolme-state-store.js:4-70`, with tolerant reads and non-atomic full-file writes at `server/agents/nolme-state-store.js:97-136`.
- CopilotKit is mounted through `SafeInMemoryAgentRunner` in `server/routes/copilotkit.js:26-48`, and that runner delegates `connect()` to the superclass after pruning errored historic runs in `server/lib/safe-in-memory-agent-runner.js:30-49`.

## Contract Review

### Well-Defined

- The plan fixes the prior scope problem by keeping this implementation inside `cc-agent-ui` and avoiding Nolme/core edits.
- The API boundary is versioned and consistently uses `schemaVersion: 1` in success and failure examples.
- The plan correctly rejects client-supplied event paths and makes server-owned storage the only source for run state/events.
- The provider enum matches the local provider vocabulary: `claude | cursor | codex | gemini`.

### Missing or Unclear

- CRITICAL: The command-client contract is not sufficient for the planned async run API. The plan returns `202 starting` from `POST /api/algorithm-runs` at lines 111-129, but the runner protocol at lines 422-457 only returns one final JSON response. It does not define how later `AlgorithmEvent` records reach `run-store.js`, how stdout event frames are delimited, or whether the runner is long-lived, request/response, or event-streaming. Existing child-process integrations use newline-framed stream JSON and partial-line handling, not one unframed stdout object.
- CRITICAL: Authenticated run ownership is absent from the contract. The start response/run metadata at lines 117-124 and run-store end state at lines 57-60 include `runId`, `sessionId`, `projectPath`, `provider`, `status`, and cursor, but no `userId` or access check. Since the route is mounted behind `authenticateToken`, every state/lifecycle/decision route must bind `runId` to `req.user.id` or a documented single-user policy.
- CRITICAL: The state/event contract is named but not specified. The read route promises `AlgorithmRunState` at line 149, decision routes depend on `pendingQuestion` and `pendingPermission` at lines 825-827, and event tests use `algorithm.run.started` at lines 575-576. The plan does not define the full state fields, event union, terminal statuses, pending decision shapes, or projection rules.
- WARNING: The plan references an event-store resource id `44b6ef63-f7ea-4988-818f-094bebdc838e` in `@reads/@writes` blocks at lines 601-602, 693, 780, and 868, but no resource registry binding defines that id.

### Recommendations

- Define the runner protocol as newline-delimited frames, for example `result`, `event`, `state`, `log`, and `error`, with EOF and partial-line behavior. If the runner remains request/response only, remove the async/event promises from the start route.
- Add `ownerUserId` or `userId` to run metadata and require every read/control route to compare it with `req.user.id`.
- Add complete schemas for `AlgorithmRunMetadata`, `AlgorithmRunState`, `AlgorithmRunEvent`, `AlgorithmQuestionRequest`, `AlgorithmPermissionRequest`, answer payloads, decision payloads, and terminal status values.
- Either add the missing `algorithm.event_store` resource binding or merge the event-store responsibility into the defined `algorithm.run_index` resource.

## Interface Review

### Well-Defined

- `server/routes/algorithm-runs.js` is a good local module boundary for the new Express router.
- `server/algorithm-runs/contracts.js`, `command-client.js`, and `run-store.js` are reasonable file boundaries for validators, process I/O, and persistence.
- The mount line `app.use('/api/algorithm-runs', authenticateToken, algorithmRunsRouter)` matches the local protected-router pattern in `server/index.js:431-478`.
- The route set covers start, read, lifecycle, question, and permission workflows.

### Missing or Unclear

- CRITICAL: The start-route test mock expects `startAlgorithmRun` at plan lines 337-339, while the command-client implementation and command-client tests export `runAlgorithmCommand` at lines 467 and 505. The interface name and wrapper responsibilities are inconsistent.
- CRITICAL: `event-store.js` appears in the desired end state at line 60, but all TDD examples import event functions from `run-store.js` at lines 565-570. Implementers cannot tell whether there should be one module or two.
- CRITICAL: The runner configuration interface is ambiguous. The plan says parse `ALGORITHM_RUNNER_COMMAND` with "JSON array support or a documented executable-plus-args format" at line 512. That is not an interface; it is a choice left to implementation.
- WARNING: The plan does not specify whether Algorithm runner output is translated into existing `NormalizedMessage` frames, a new Algorithm-specific event schema, or both. The current provider boundary is explicitly `NormalizedMessage` in `server/providers/types.js:13-119`.

### Recommendations

- Introduce a small public command-client API table: `startAlgorithmRun(input)`, `runAlgorithmCommand(input)`, and `mapRunnerResultToHttp(result)`, or collapse tests and routes onto one exported function.
- Pick one persistence module boundary: either `run-store.js` owns metadata, snapshots, and JSONL events, or `event-store.js` is separate and has its own resource binding.
- Define `ALGORITHM_RUNNER_COMMAND` exactly. Prefer a JSON array env var such as `["node","runner.mjs"]` plus tests for invalid JSON, empty array, missing executable, and extra args.
- State whether Algorithm events are a separate route/store contract only, or whether they also feed the existing provider-normalized runtime surfaces.

## Promise Review

### Well-Defined

- The plan promises validation before filesystem or runner access.
- It promises deterministic cursor-filtered event reads.
- It promises no shell interpolation by using `spawn(command, args, { shell: false })`.
- It identifies idempotent pause behavior and terminal-run conflicts.

### Missing or Unclear

- CRITICAL: Event ingestion and ordering are not enforceable as written. The plan says duplicate sequence is rejected at line 553 and reads are deterministic at lines 547-555, but it does not define who allocates sequences, whether append happens before route/SSE emit, how concurrent lifecycle and runner events are serialized, or how partial writes recover.
- CRITICAL: Start-route lifetime semantics are unclear. A `202 starting` response implies the runner continues after the HTTP handler returns, but the child-process protocol and command-client test are a short request/response call. There is no cleanup, process registry, detached process policy, or crash recovery behavior.
- WARNING: SSE promises need cleanup rules. The plan mentions heartbeats and terminal close at lines 151 and 648-655, but does not define polling interval, max connection lifetime, client disconnect handling, or watcher teardown.

### Recommendations

- Define one sequence allocator in the run store. Require append-before-publish, reject or quarantine out-of-order events, and specify recovery when `events.jsonl` and `state.json` disagree.
- Define whether `start` is synchronous until the runner exits, asynchronous with a tracked child process, or asynchronous because the external runner owns its own daemon/state.
- Add SSE teardown requirements: stop polling or watching on `req.close`, emit backlog before heartbeats, and close immediately for terminal states after the backlog.

## Data Model Review

### Well-Defined

- The run metadata includes core identity fields: `runId`, `sessionId`, `projectPath`, provider, status, and cursor.
- The plan keeps filesystem paths out of public state responses.
- The plan calls for atomic snapshot writes via temp file then rename.
- The provider and run-id validation concerns are correctly located in pure validators.

### Missing or Unclear

- CRITICAL: There is no complete durable storage schema. The plan alternates between local JSON sidecars and an undefined event store, but does not define filenames, JSON object shapes, `createdAt/updatedAt`, `ownerUserId`, indexes, or whether state lives under `~/.claude/projects`, `DATABASE_PATH`, or a configurable Algorithm root.
- CRITICAL: `sessionId` is nullable in the start response at line 119, but later metadata and decision/lifecycle behavior depend on the run being correlated with runner state. The plan does not state when `sessionId` becomes non-null or how a returned runner session id updates metadata.
- CRITICAL: Pending question/permission data models are not defined, even though decision routes validate against them. Required fields, stale clearing, answered/decided events, and public-vs-private payload fields are missing.
- WARNING: Project path validation only requires an absolute path. Existing `/api/agent` resolves and checks project paths before use in `server/routes/agent.js:891-900`. The Algorithm plan should specify existence/access checks or explicitly delegate those failures to the runner.

### Recommendations

- Add a data model section with `metadata.json`, `events.jsonl`, and `state.json` examples, or choose SQLite and include table definitions.
- Add `createdAt`, `updatedAt`, `ownerUserId`, `runnerRequestId`, `runnerPid` or `externalRunHandle`, and `lastSequence` to metadata.
- Define session-id update rules from runner output and require tests for `sessionId: null -> "..."`.
- Define pending decision schemas and projection rules before implementing decision routes.

## API Review

### Well-Defined

- `POST /api/algorithm-runs` has concrete request and response examples.
- The route set includes JSON read routes, SSE event reads, lifecycle commands, and decision commands.
- The plan includes a useful API error-code table.
- The route mount behind app auth is consistent with local protected APIs.

### Missing or Unclear

- CRITICAL: The `auth_required` error contract cannot be produced by the router as mounted. `authenticateToken` runs before `algorithmRunsRouter` and returns plain `{ error }`; invalid JWTs return `403`, not the plan's versioned `401` envelope. The error table at lines 1009-1018 and mount test at lines 921-929 need to reflect this or use a route-local auth wrapper.
- CRITICAL: State/events/lifecycle/decision response bodies are not fully specified. Read routes at lines 145-151 only describe shapes in prose, lifecycle routes only name command payloads at lines 153-159, and decision routes only describe validation at lines 161-166.
- WARNING: Regression testing says existing `/api/agent`, `/api/sessions`, and CopilotKit/Nolme routes should continue to pass at lines 168-173, but the final regression guard at lines 988-992 omits `/api/agent` and `/api/sessions` route tests.

### Recommendations

- Decide whether Algorithm routes inherit existing auth error bodies or install a wrapper that converts auth failures into the versioned envelope before the router.
- Add success and failure examples for every route, including `state`, JSON `events`, SSE frame format, pause/resume/stop, answer, and permission decision.
- Add regression commands for at least one `/api/sessions` messages test and one `/api/agent` route contract test, or state that such tests do not currently exist and must be added.

## Critical Issues To Address Before Implementation

1. **Runner/Event Contract**: The child-process protocol cannot produce the promised run event stream.
   - Impact: `POST /api/algorithm-runs` may return a run stuck in `starting`, and state/events routes may have no source of truth after the initial command response.
   - Recommendation: define newline-delimited runner frames or another explicit event ingestion mechanism before route implementation.

2. **Run Ownership**: Run metadata has no authenticated owner and no authorization rule for `runId`.
   - Impact: in multi-user or platform mode, any authenticated caller who knows a `runId` could read state or issue lifecycle/decision commands.
   - Recommendation: store `ownerUserId` at creation and enforce it in every `/:runId` route.

3. **State/Event/Decision Schemas**: Decision routes depend on state fields that are not defined.
   - Impact: implementers will invent incompatible `pendingQuestion`, `pendingPermission`, event, and status shapes, making route validation and tests weak.
   - Recommendation: add full schemas and event projection rules before TDD starts.

4. **Auth/Error Contract**: The versioned `auth_required` envelope conflicts with mount-level `authenticateToken`.
   - Impact: tests written from the plan will fail against real Express mount behavior, or implementation will duplicate auth logic inconsistently.
   - Recommendation: revise the plan to accept existing auth bodies or introduce an explicit auth adapter.

5. **Persistence Boundary**: The storage root and module split are not settled.
   - Impact: implementation may scatter metadata, snapshots, and events across incompatible file/database locations and make replay/corruption handling brittle.
   - Recommendation: define a single durable store contract and exact file/table layout.

## Suggested Plan Amendments

```diff
# In Desired End State
~ Modify: collapse or clearly split run-store/event-store ownership.
+ Add: run metadata includes ownerUserId, createdAt, updatedAt, lastSequence, and runner handle/session update fields.

# In Route Contract
+ Add: route-level authorization rule: req.user.id must match run.ownerUserId for every /:runId route.
~ Modify: auth_required behavior to match authenticateToken's existing 401/403 plain { error } bodies, or specify a custom wrapper.
+ Add: full success/failure bodies for state, events, SSE frames, lifecycle, question answer, and permission decision.

# In Behavior 3: Command Client
~ Modify: replace "one JSON response from stdout" with a newline-delimited protocol.
+ Add: frame schemas for result, event, state, log, and error.
+ Add: tests for partial stdout chunks, non-JSON logs, stderr, ENOENT, non-zero exit, timeout, unsupported schema, closed-without-response, and max output.

# In Behavior 4: Run Store
+ Add: storage layout examples for metadata.json, events.jsonl, and state.json, or SQLite table definitions.
+ Add: sequence allocation, append-before-publish, duplicate/out-of-order behavior, and snapshot recovery rules.
+ Add: sessionId null-to-known update rules after runner reports a provider/core session id.

# In Behavior 5: State And Event Routes
+ Add: SSE disconnect cleanup, heartbeat interval, max connection lifetime, and terminal close semantics.
+ Add: tests for owner mismatch, backlog-before-heartbeat, and terminal close.

# In Behavior 7: Decision Routes
+ Add: AlgorithmQuestionRequest and AlgorithmPermissionRequest schemas.
+ Add: answered/decided event shapes and stale-clearing projection rules.

# In Integration And Regression Testing
+ Add: /api/agent and /api/sessions regression tests or create missing route contract tests first.
```

## Review Checklist

### Contracts

- [x] Component boundaries are identified.
- [ ] Input/output contracts are fully specified.
- [ ] Error contracts enumerate all failure modes.
- [ ] Preconditions and postconditions are documented.
- [ ] Invariants are identified and enforceable.

### Interfaces

- [ ] All public methods are defined with complete signatures.
- [ ] Naming follows codebase conventions.
- [ ] Interface matches existing production paths.
- [ ] Extension points are considered.
- [ ] Visibility/versioning strategy is explicit.

### Promises

- [ ] Behavioral guarantees are documented.
- [ ] Async operations have timeout/cancellation handling.
- [ ] Resource cleanup is specified.
- [ ] Idempotency requirements are addressed.
- [ ] Ordering guarantees are enforceable.

### Data Models

- [ ] All fields have types.
- [ ] Required vs optional is clear.
- [ ] Relationships are documented.
- [ ] Migration strategy is defined.
- [ ] Serialization format and version behavior are specified.

### APIs

- [x] Main endpoints are named.
- [ ] Request/response formats are fully specified.
- [ ] Error responses match the actual auth/mount behavior.
- [ ] Authentication requirements are complete.
- [ ] Versioning strategy is defined beyond schema-version rejection.
