# Plan Review Report: Algorithm Run API Boundary

Source plan: `thoughts/searchable/shared/plans/2026-04-26-algorithm-run-api-boundary.md`

Review date: 2026-04-26

## Review Summary

| Category | Status | Issues Found |
| --- | --- | --- |
| Contracts | CRITICAL | 5 |
| Interfaces | CRITICAL | 5 |
| Promises | CRITICAL | 4 |
| Data Models | CRITICAL | 4 |
| APIs | CRITICAL | 5 |

Approval status: **Needs Major Revision**. The architecture is directionally sound, but implementation should not start until the plan defines the executable cross-repo boundary, run identity/correlation rules, decision-queue schemas, and the production CopilotKit hydration path.

## Evidence Reviewed

- Plan lines 31-35 define Command/Event/State API ownership.
- Plan lines 155-173 and 182-211 define the initial state/event contracts.
- Plan lines 249-277 define run-scoped event storage and global mirroring.
- Plan lines 315-330 define the command helper surface.
- Plan lines 421-436 define Nolme hydration/live-delta integration.
- Plan lines 444-453 define HTTP command routes.
- `server/routes/copilotkit.js:36-48` creates the runtime with `SafeInMemoryAgentRunner`.
- `server/lib/safe-in-memory-agent-runner.js:30-49` delegates connect to `InMemoryAgentRunner.connect()`.
- `server/agents/ccu-session-agent.js:291-344` has the tested provider-history hydration method.
- `nolme-ui/src/lib/types.ts:20-29` defines `NolmeSessionBinding` without an Algorithm run id.
- `src/utils/nolmeLaunch.ts:124-136` serializes Nolme URLs without an Algorithm run id.
- `/home/maceo/Dev/cosmic-agent-core/v4.2.0/.claude/AAI/Tools/algorithm.ts:888-892` creates a random loop session id and writes current state keyed by session id.
- `/home/maceo/Dev/cosmic-agent-core/v4.2.0/.claude/AAI/Tools/algorithm.ts:1412-1438` controls pause/resume/stop by PRD path, not run id.

## Contract Review

### Well-Defined

- The plan correctly separates Command API, Event API, and State API ownership.
- The plan preserves existing provider dispatch and treats transcript projection as fallback.
- The run-scoped JSONL plus `state.json` snapshot model is the right durable shape for replay plus fast hydration.

### Missing or Unclear

- CRITICAL: The production CopilotKit connect path is not proven to call `CcuSessionAgent.connect()`. The plan puts the Algorithm snapshot merge in `CcuSessionAgent.connect()` at plan lines 421-425, but `server/routes/copilotkit.js:36-48` wires a `SafeInMemoryAgentRunner`, and `server/lib/safe-in-memory-agent-runner.js:48` delegates connect to the runner superclass. This matches `cam-11u`: tests can pass against `agent.connect()` while production still hydrates from runner memory only.
- CRITICAL: `runId` is declared stable at plan lines 207-208 and used by commands at lines 325-329, but the existing core loop creates `loopSessionId = randomUUID()` and stores state as `MEMORY/STATE/algorithms/<sessionId>.json`. Pause/resume/stop currently accept PRD paths. The plan does not define the run-id to session-id to PRD-path index.
- CRITICAL: The cc-agent-ui to cosmic-agent-core execution boundary is missing. Plan lines 311-330 add a Bun/TypeScript helper under `.claude/AAI/Tools`, while cc-agent-ui runs as Node ESM (`server/index.js`). The plan does not specify whether Express imports compiled JS, spawns `bun`, calls a CLI JSON protocol, or discovers core through an env var.
- CRITICAL: Event ordering is promised but not enforceable yet. Plan line 208 requires monotonic sequence per run, and lines 356-358 add PRD-sync-derived events from a separate hook process. The plan does not specify locking, idempotency keys, duplicate handling, or conflict behavior when multiple emitters append to the same run.
- WARNING: The plan references `AlgorithmQuestionRequest`, `AlgorithmPermissionRequest`, and `AlgorithmArtifact` in the state contract but does not define those interfaces.

### Recommendations

- Add a Phase 0 or Phase 4 precondition: fix `cam-11u` or move Algorithm snapshot hydration into the production CopilotKit connect path. Require an integration test through the mounted `/api/copilotkit` route, not only direct `CcuSessionAgent.connect()`.
- Define a `run-index.json` or per-run `metadata.json` contract with `runId`, `sessionId`, `prdPath`, `projectPath`, `provider`, `algorithmMode`, `createdAt`, `status`, and current `eventCursor`.
- Define the cross-repo adapter explicitly: either a child-process JSON protocol around Bun, or a compiled/importable Node-compatible module. Include discovery env vars, timeout/cancellation behavior, and error translation.
- Require file locking or another single-writer mechanism for `appendAlgorithmEvent()`, plus deterministic behavior for duplicate, out-of-order, and unknown-version events.

## Interface Review

### Well-Defined

- `server/agents/algorithm-run-adapter.js` is the right cc-agent-ui adapter location.
- The plan keeps existing `NormalizedMessage` translation unchanged and adds Algorithm deltas beside it.
- Existing auth mounting near `server/index.js:420-478` gives the command routes a natural authenticated mount point.

### Missing or Unclear

- CRITICAL: `binding.algorithmRunId` is used in plan lines 423 and 434, but no plan phase extends `NolmeSessionBinding`, `NolmeLaunchBinding`, URL parsing, localStorage broadcast, or `CopilotKit properties` to carry it. Current binding types contain provider/session/project fields only.
- CRITICAL: Route request bodies and response shapes are absent. Plan lines 444-451 list route names, but not JSON schemas, required fields, success envelopes, error envelopes, or HTTP status codes.
- CRITICAL: `projectAlgorithmEventToAgUiDelta(event)` is only named. The plan does not enumerate JSON Patch paths and ops for each event type, although existing AG-UI deltas require concrete operations such as `add` to `/statusText` and `/taskNotifications/-`.
- WARNING: The command helper signatures use `answerQuestion(runId, response: unknown)` and `approveAction(runId, decision: unknown)`, which prevents route validation and UI contract tests from being meaningful.
- WARNING: Visibility/versioning for the new core contracts is incomplete. The plan says versioned contracts, but not whether `algorithm-run-contracts.ts` is public API, how future schema versions are accepted, or how cc-agent-ui rejects unsupported versions.

### Recommendations

- Add `algorithmRunId?: string` to launch/binding types, URL serialization/parsing, storage/broadcast payloads, and tests.
- Add a route contract table with JSON request schema, response schema, error codes, auth expectations, and path validation for every route.
- Add a `STATE_DELTA` mapping table per Algorithm event, including snapshot fallback behavior and idempotency rules tied to `eventCursor.sequence`.
- Replace `unknown` command payloads with named request interfaces.

## Promise Review

### Well-Defined

- The plan preserves transcript fallback for old sessions.
- The plan promises replay determinism and cheap state snapshots.
- The plan identifies batching and polling fallback as performance concerns.

### Missing or Unclear

- CRITICAL: The "latest run matching sessionId/projectPath" hydration rule at plan line 423 is not deterministic. It does not define sorting, tie-breakers, status filtering, or whether completed/stopped runs are eligible.
- CRITICAL: Resume semantics are underspecified. Existing `resumeLoop()` writes PRD frontmatter and calls `runLoop()`, which currently creates a new loop session id when starting a loop. The plan does not state how `resumeRun(runId)` continues the same run/event stream.
- CRITICAL: Cancellation and timeout behavior is not defined for command routes that start or resume long-running provider work.
- WARNING: Resource cleanup is not specified for event watchers/pollers added to `CcuSessionAgent.run()`. The Observable teardown should stop polling, close watchers, and avoid emitting after completion.

### Recommendations

- Define run lookup rules: exact `algorithmRunId` first; then active run by session/project; then newest non-terminal only if explicitly allowed.
- Define command lifecycle promises: idempotent pause/stop, resume keeps the same `runId`, start failure emits `algorithm.run.failed`, and route cancellation/timeout behavior is observable.
- Add Observable teardown requirements for live polling/watching.

## Data Model Review

### Well-Defined

- `AlgorithmRunState` includes the right top-level slices for Nolme: phase, criteria, capabilities, decisions, artifacts, final summary, and cursor.
- `NolmeAlgorithmState` keeps core state separate from existing `phases` and `resources`.
- The migration plan keeps old sidecars and transcripts working.

### Missing or Unclear

- CRITICAL: Decision queue data models are incomplete. The plan does not define question ids, permission ids, answer payloads, decision payloads, resolved/answered/decided event shapes, or stale-clearing rules.
- CRITICAL: Artifact schema is incomplete across layers. Core references `AlgorithmArtifact[]`, Nolme artifacts include `path` and `url`, existing `NolmeResource` requires `badge`, `subtitle`, `tone`, and `action`, and the plan does not define required mapping defaults.
- WARNING: Criteria status mapping is not reconciled with current core parsing. Core `countCriteria()` returns checklist statuses `passing` and `failing`, while planned state uses `pending`, `in_progress`, `completed`, and `failed`.
- WARNING: `eventCursor.eventsPath` exposes a local filesystem path into cc-agent-ui/Nolme state. The plan should state whether UI clients receive this path or whether the server strips it.

### Recommendations

- Add full `AlgorithmQuestionRequest`, `AlgorithmQuestionAnsweredEvent`, `AlgorithmPermissionRequest`, `AlgorithmPermissionDecidedEvent`, and `AlgorithmArtifact` schemas.
- Add artifact-to-resource mapping defaults for `badge`, `subtitle`, `tone`, `action`, `filePath`, `url`, and missing path/url cases.
- Define the criteria status translation from current PRD checkboxes to the product contract.
- Keep filesystem paths server-side unless there is a clear UI need and path exposure policy.

## API Review

### Well-Defined

- The planned route set covers the main run lifecycle commands.
- Mounting behind the existing auth stack is consistent with current server conventions.
- The tests proposed for route auth and request validation are the right test category.

### Missing or Unclear

- CRITICAL: No request/response examples are provided for `POST /api/algorithm-runs`, so implementers do not know how `prompt`, `projectPath`, provider settings, `algorithmMode`, model, permission mode, or returned binding data should flow into Nolme.
- CRITICAL: `pause`, `resume`, and `stop` error responses are not enumerated for missing run, terminal run, already paused, already stopped, or core process unavailable.
- CRITICAL: `questions/:questionId/answer` and `permissions/:permissionId/decision` do not specify how ids are validated against pending state, how provider permission approval is invoked, or what status is returned for stale ids.
- WARNING: Path and run-id validation are absent. Since `runId` is used in filesystem paths and `projectPath` is client-supplied, the API needs explicit allowlists or normalization rules.
- WARNING: Version negotiation is not defined for HTTP clients consuming `AlgorithmRunState`.

### Recommendations

- Add API examples for each route, including success and failure bodies.
- Add validation rules for run ids, project paths, provider values, model values, permission modes, and answer/decision payloads.
- Add `schemaVersion` handling to HTTP responses and adapter rejection behavior for unsupported versions.

## Critical Issues To Address Before Implementation

1. Production Nolme hydration may never execute the planned merge point.
   - Impact: Algorithm snapshots can be implemented and tested against `CcuSessionAgent.connect()` but remain invisible in real Nolme opens.
   - Recommendation: make `cam-11u` a hard precondition or move the merge to the actual CopilotKit runner connect path, with a mounted-route regression test.

2. Run identity and correlation are not defined.
   - Impact: `pauseRun(runId)`, `resumeRun(runId)`, event replay, PRD sync correlation, and Nolme hydration can point at different state files or create duplicate runs.
   - Recommendation: add a durable run metadata/index contract and exact lookup/resume rules.

3. cc-agent-ui cannot safely call the planned core command helper yet.
   - Impact: implementation will invent an import/spawn bridge with unclear errors, timeouts, deployment assumptions, and testability.
   - Recommendation: specify the Node-to-Bun/Core adapter protocol before route implementation.

4. Event sequence and append concurrency are underspecified.
   - Impact: replay determinism can fail under simultaneous loop, hook, and route writers.
   - Recommendation: define single-writer locking/idempotency and projector behavior for duplicates/out-of-order events.

5. Decision queue schemas are not implementable.
   - Impact: question/permission UI may render, but answers and approvals cannot be validated, correlated, resolved, or bridged back to providers reliably.
   - Recommendation: define typed question and permission request/decision contracts end to end.

## Suggested Plan Amendments

```diff
# Add Phase 0: Production Hydration Precondition
+ Resolve cam-11u or move Algorithm state merge to the actual CopilotKit runner connect path.
+ Add mounted /api/copilotkit connect test proving provider history plus Algorithm snapshot reaches Nolme.

# In Phase 1: Versioned Core Contracts
+ Define AlgorithmQuestionRequest, AlgorithmQuestionAnsweredEvent, AlgorithmPermissionRequest,
+ AlgorithmPermissionDecidedEvent, AlgorithmArtifact, and AlgorithmRunMetadata.
+ Define unsupported schema-version behavior.

# In Phase 2: Core Event Store And Projection
+ Add per-run metadata/index file and exact run lookup rules.
+ Add append locking/idempotency and duplicate/out-of-order replay behavior.
+ Add path validation for runId-derived paths.

# In Phase 3: Core Command API And Instrumentation
~ Modify pauseRun/resumeRun/stopRun to resolve runId through AlgorithmRunMetadata.
+ Define resumeRun as continuing the same runId/event stream.
+ Define Node/Express-to-Core adapter protocol: import compiled JS or spawn Bun with JSON I/O.

# In Phase 4: cc-agent-ui Server Adapter
+ Extend NolmeSessionBinding/NolmeLaunchBinding with algorithmRunId and serialize it through URL,
+ localStorage, BroadcastChannel, and CopilotKit properties.
+ Add route request/response/error schema table for every /api/algorithm-runs endpoint.
+ Add JSON Patch mapping table for every AlgorithmEvent -> STATE_DELTA conversion.

# In Phase 5: Nolme Structured Work Surface
+ Define state.algorithm decision-card conversion, stale question/permission clearing, and
+ fallback ordering when both Algorithm state and Claude pending-permission polling exist.
+ Define AlgorithmArtifact -> NolmeResource defaults for subtitle, badge, tone, action, url, filePath.
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

- [ ] All endpoints are defined.
- [ ] Request/response formats are specified.
- [ ] Error responses are documented.
- [ ] Authentication requirements are clear.
- [ ] Versioning strategy is defined.
