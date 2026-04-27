---
date: 2026-04-27
status: needs_revision
repository: cc-agent-ui
reviewed_plan: thoughts/searchable/shared/plans/2026-04-27-cam-11u-tdd-algorithm-run-api-nolme-connection.md
related_beads:
  - cam-11u
  - cam-b1x
review_agent: StormySpring
---

# Plan Review Report: Algorithm Run API to Nolme UI TDD Implementation Plan

## Review Summary

| Category | Status | Issues Found |
|----------|--------|--------------|
| Contracts | CRITICAL | 3 |
| Interfaces | CRITICAL | 3 |
| Promises | WARNING | 3 |
| Data Models | WARNING | 2 |
| APIs | WARNING | 2 |

Approval status: **Needs Major Revision**. The plan has the right decomposition, and the high-level end state matches the codebase. Implementation should wait until the blocking interface contracts below are amended.

## Contract Review

### Well-Defined

- The plan correctly keeps Algorithm `runId` separate from Nolme/CopilotKit `threadId`; `/nolme` remains bound to provider `sessionId` (plan lines 64-71).
- The launch route is scoped to the Algorithm route family, so it should reuse the existing versioned `{ ok, schemaVersion }` envelope from `server/algorithm-runs/contracts.js:42` and the owner check in `server/routes/algorithm-runs.js:47`.
- Resource event legality is identified: `EVENT_TYPES` currently lacks `algorithm.resource.added` at `server/algorithm-runs/contracts.js:22`, and both append/rebuild reject unsupported event types at `server/algorithm-runs/run-store.js:263` and `server/algorithm-runs/run-store.js:363`.

### Missing or Unclear

- CRITICAL: Behavior 3 does not define sidecar merge ownership. `writeState(binding, state)` writes the whole sidecar payload at `server/agents/nolme-state-store.js:131`, while the existing sidecar also carries profile, quick actions, task notifications, token budget, and active skill slices (`nolme-ui/src/lib/ai-working/normalizeNolmeState.ts:185`). A full Algorithm projection write can erase live Nolme state owned by other code paths.

- CRITICAL: Behavior 3 says to call sync from the append path after durable event persistence (plan lines 371-375), but `appendAlgorithmEvent()` is in `run-store.js` and `nolme-sync.js` would need to read run-store metadata/state/events. Importing sync back into `run-store.js` risks a circular dependency, while syncing only from `persistRunnerFrame()` misses direct route appends such as lifecycle events at `server/routes/algorithm-runs.js:230`.

- WARNING: The resource projection contract says invalid badges should "default or reject consistently" (plan lines 240-287), but it does not decide which boundary owns validation. The UI currently defaults invalid badges to `P1` in `normalizeNolmeState()` at `nolme-ui/src/lib/ai-working/normalizeNolmeState.ts:74`, so the server projection must either mirror that behavior or guarantee only valid `NolmeResource` values are written.

### Recommendations

- Define sidecar ownership as a patch contract: Algorithm sync may update only `phases`, `currentPhaseIndex`, `currentReviewLine`, and `resources`, preserving all other existing fields from `readState(binding)`.
- Add a non-circular sync hook: either an injectable post-append observer in `run-store.js`, or an exported append-and-sync wrapper used by every route/runner path that writes Algorithm events.
- Add tests that prove a sidecar containing `tokenBudget`, `activeSkill`, `profile`, or `quickActions` survives Algorithm sync.

## Interface Review

### Well-Defined

- The launch endpoint response shape is directionally clear: `{ ready, binding?, state?, nolmeUrl, runStatus }` (plan lines 493-510).
- The UI hook tests are aimed at the right layer: resolve `runId` into a normal `NolmeSessionBinding`, then let existing `useHydratedState()` behavior cover `/api/sessions` and `/api/nolme/state` fetches.
- CopilotKit reconnect correctly targets `SafeInMemoryAgentRunner.connect()` because production connect does not currently reach `CcuSessionAgent.connect()`.

### Missing or Unclear

- CRITICAL: Behavior 6's schema mapping says "Nolme binding headers -> `CcuSessionAgent.connect()` forwarded props" (plan lines 585-589), but production connect calls `runtime.runner.connect({ threadId, headers })` at `node_modules/@copilotkit/runtime/src/v2/runtime/handlers/sse/connect.ts:25`. The runner request interface has only `threadId`, optional `headers`, and optional `joinCode` at `node_modules/@copilotkit/runtime/src/v2/runtime/runner/agent-runner.ts:17`. There is no `agent` or `forwardedProps` in that path.

- CRITICAL: The current UI sends binding through CopilotKit `properties`, not connect headers. `NolmeApp` builds `properties: { binding }` at `nolme-ui/src/NolmeApp.tsx:126` and only adds auth headers at `nolme-ui/src/NolmeApp.tsx:133`. The plan proposes `x-ccu-*` headers later (plan lines 672-684), but should make that a required interface change and test it before server fallback work.

- WARNING: Behavior 5 requires a "ready:false waiting" state (plan lines 501-503), but `useCcuSession()` currently returns only `NolmeSessionBinding | null` (`nolme-ui/src/hooks/useCcuSession.ts:94`), and `NolmeApp` renders "No session selected" whenever that value is null (`nolme-ui/src/NolmeApp.tsx:115`). The hook interface needs a status-bearing result or a parallel launch status consumed by `NolmeApp`.

### Recommendations

- Amend Behavior 6 to factor provider-history replay into a shared helper, for example `hydrateNolmeConnect({ binding, threadId, runId, userId })`, used by both `CcuSessionAgent.connect()` and `SafeInMemoryAgentRunner.connect()`.
- Make `x-ccu-*` header propagation a first-class UI interface contract. CopilotKit forwards only `authorization` and `x-*` headers (`node_modules/@copilotkit/runtime/src/v2/runtime/handlers/header-utils.ts:5`), so these names are appropriate.
- Change `useCcuSession` or introduce a composed resolver that can return `{ status: 'idle' | 'resolving-run' | 'waiting-run' | 'ready' | 'error', binding, error }`.

## Promise Review

### Well-Defined

- The plan specifies best-effort sidecar sync: sidecar write failure should log a warning and must not corrupt Algorithm run state (plan lines 324-329).
- The plan preserves in-memory connect replay when in-memory history exists, avoiding duplicate provider history (plan lines 591-602).
- Polling lifecycle concerns are listed for `runId` launch resolution, including stopping after unmount and re-resolving when `runId` changes (plan lines 505-510).

### Missing or Unclear

- WARNING: `runId` pages are not pinned against later live session broadcasts. Initial URL/localStorage precedence is clear in `useCcuSession()` (`nolme-ui/src/hooks/useCcuSession.ts:47`), but later `BroadcastChannel('ccu-session')` messages replace the binding (`nolme-ui/src/hooks/useCcuSession.ts:117`). The plan should specify whether `/nolme/?runId=...` ignores live sidebar broadcasts until the user leaves that URL.

- WARNING: The sidecar fallback promise is broader in the plan than in current code. `useHydratedState()` ignores non-OK state HTTP responses and keeps defaults (`nolme-ui/src/hooks/useHydratedState.ts:76`), but state network failures or invalid JSON still go through the outer catch and make hydration status `error` (`nolme-ui/src/hooks/useHydratedState.ts:63`). If "sidecar missing/corrupt never blocks message fallback" is required, the plan must add a test and implementation step for state fetch/JSON failures.

- WARNING: Safe runner fallback behavior for invalid binding headers is underspecified. The plan says invalid provider falls back to empty connect rather than throwing (plan lines 597-602); it should define whether that means `super.connect(request)`, an empty completed observable, or a `RUN_ERROR`.

### Recommendations

- Add a launch-mode precedence rule: explicit `sessionId` URL wins over `runId`; active `runId` wins over localStorage and BroadcastChannel until URL changes; non-run pages keep current behavior.
- Add a `useHydratedState()` regression that state endpoint network/JSON failure still returns `ready` with messages and default state, if that is the intended promise.
- Define invalid connect headers as `super.connect(request)` to preserve current empty/historic in-memory behavior without surfacing a false provider error.

## Data Model Review

### Well-Defined

- The plan maps concrete current contracts: `AlgorithmRunState.phase/status` to `NolmeAgentState.phases/currentPhaseIndex/currentReviewLine`, and resource payloads to `NolmeResource`.
- The plan acknowledges that public Algorithm state intentionally omits `projectPath`, `phases`, `currentReviewLine`, and `resources` (plan lines 31-39).
- Existing Nolme state shape is complete in `nolme-ui/src/lib/types.ts:63`.

### Missing or Unclear

- WARNING: Projection must read metadata and the event log, not public state alone. `projectPath` is metadata-only (`server/algorithm-runs/run-store.js:311`), and `algorithm.phase.changed` currently projects only `state.phase` (`server/algorithm-runs/run-store.js:155`). Review lines and resources must come from ordered events.

- WARNING: UI explicit precedence depends on raw array presence, not normalized valid content. `normalizeNolmeState()` marks explicit phases/resources true when raw arrays are non-empty (`nolme-ui/src/lib/ai-working/normalizeNolmeState.ts:207`), so a malformed non-empty Algorithm sidecar can suppress message fallback while normalizing to empty arrays.

### Recommendations

- Specify `projectAlgorithmRunToNolmeState({ metadata, state, events })`, not just `{ state, events }`, or make launch/sync build bindings outside the projector and explicitly pass the necessary metadata.
- Add server projection tests for invalid phase/resource arrays and a UI regression proving malformed explicit Algorithm state does not blank message-derived fallback, or guarantee server projection never writes malformed arrays.

## API Review

### Well-Defined

- Existing Algorithm routes are protected by `authenticateToken` at `server/index.js:468` and use centralized owner authorization in `server/routes/algorithm-runs.js:47`.
- The launch route should follow Algorithm route envelope conventions from `makeApiSuccess()` / `makeApiError()` at `server/algorithm-runs/contracts.js:42`.
- Nolme state and messages routes already use the binding query parameters that the launch route will return (`nolme-ui/src/hooks/useHydratedState.ts:31` and `nolme-ui/src/hooks/useHydratedState.ts:40`).

### Missing or Unclear

- WARNING: The plan should not imply Nolme state routes adopt Algorithm envelopes. `/api/nolme/state/:sessionId` returns raw state or plain `{ error }` (`server/routes/nolme-state.js:23`), and `useHydratedState()` expects raw state (`nolme-ui/src/hooks/useHydratedState.ts:78`). Keep the launch endpoint versioned, not the sidecar endpoint.

- WARNING: Test file naming is slightly inconsistent with existing route tests. Existing Algorithm route tests use `test_algorithm_runs_route_*`; `test_algorithm_runs_nolme_launch_route.spec.ts` will run, but `test_algorithm_runs_route_nolme_launch.spec.ts` matches local convention better.

### Recommendations

- Add `links.nolme` to start/state responses only after the launch endpoint is implemented and tested, as the plan already suggests.
- For sidecar sync tests, prefer the real `writeState()`/`readState()` path with isolated `HOME`, matching `tests/generated/test_nolme_state_sidecar.spec.ts`, instead of mocking the store for the primary integration assertion.

## Critical Issues

1. **Sidecar ownership and sync hook are under-specified.**
   - Impact: Implementation can erase non-Algorithm Nolme sidecar fields or miss direct Algorithm event appends.
   - Recommendation: Define a merge/patch contract and a non-circular post-append sync mechanism before implementation.

2. **CopilotKit reconnect interface is misstated.**
   - Impact: Implementing against `CcuSessionAgent.connect()` forwarded props will not fix production reconnect, because production connect reaches only `SafeInMemoryAgentRunner.connect({ threadId, headers })`.
   - Recommendation: Require `x-ccu-*` UI headers and a shared provider-history hydration helper callable from the safe runner.

3. **`runId` launch cannot express waiting/error states through the current `useCcuSession()` interface.**
   - Impact: `/nolme/?runId=<runId>` can show "No session selected" or stale localStorage binding before the Algorithm run is bound.
   - Recommendation: Amend the hook/API contract to return launch status and define launch-mode precedence against localStorage/BroadcastChannel.

## Suggested Plan Amendments

```diff
## Behavior 3: Sync Bound Algorithm Runs Into The Nolme Sidecar

+ Add: `syncAlgorithmRunToNolmeState` must read existing sidecar state and patch only Algorithm-owned slices:
+      `phases`, `currentPhaseIndex`, `currentReviewLine`, and `resources`.
+ Add: Tests proving tokenBudget/activeSkill/profile/quickActions survive Algorithm sync.
+ Add: A non-circular post-append sync contract. Either expose an append observer from run-store,
+      or route all Algorithm event writes through an append-and-sync wrapper with tests for
+      runner frames, lifecycle routes, and decision routes.
~ Modify: Projector signature to accept `{ metadata, state, events }` or explicitly state that
~         binding construction happens outside the projector from metadata plus state.

## Behavior 5: `/nolme/?runId=` Resolves To The Normal Session Binding

+ Add: Status-bearing launch/session resolver interface consumed by `NolmeApp`.
+ Add: Launch-mode precedence rule: active `runId` ignores localStorage/BroadcastChannel until
+      the URL changes, while explicit `sessionId` URL still wins.
+ Add: Test that `/nolme/?runId=alg_1` does not hydrate a stale localStorage binding.

## Behavior 6: Fresh CopilotKit Connect Replays Provider History

~ Modify: Replace "headers -> CcuSessionAgent.connect forwarded props" with
~         "x-ccu-* headers -> bindingFromConnectHeaders -> shared provider-history replay helper".
+ Add: UI test that CopilotKit headers include `x-ccu-provider`, `x-ccu-session-id`,
+      `x-ccu-project-name`, and `x-ccu-project-path`.
+ Add: Safe runner test that invalid/missing binding headers delegate to `super.connect(request)`.
+ Add: Refactor `CcuSessionAgent.connect()` to reuse the same provider-history replay helper
+      so connect replay semantics stay identical.

## Behavior 2: Project Algorithm Resources To Nolme Deliverables

+ Add: Payload validation/defaulting decision for `algorithm.resource.added`.
+ Add: Tests covering append, rebuild, and `persistRunnerFrame({ kind: "event" })` for
+      `algorithm.resource.added`.
```

## Review Checklist

### Contracts

- [x] Component boundaries are mostly defined.
- [ ] Sidecar field ownership is explicitly defined.
- [ ] Post-append sync hook avoids circular dependencies and missed append callers.
- [ ] Error contracts enumerate all launch/connect failure modes.

### Interfaces

- [x] Launch endpoint response direction is specified.
- [ ] CopilotKit connect interface matches actual `AgentRunnerConnectRequest`.
- [ ] `runId` launch resolver has a status-bearing UI interface.
- [ ] Header names and encoding/decoding semantics are fully specified.

### Promises

- [x] Best-effort sidecar write promise is stated.
- [ ] Launch-mode precedence against localStorage/BroadcastChannel is specified.
- [ ] State-sidecar fetch/parse failure behavior is explicit.
- [ ] Invalid connect header fallback behavior is explicit.

### Data Models

- [x] `NolmeAgentState` fields are identified.
- [ ] Projector inputs include metadata or explicitly avoid needing it.
- [ ] Malformed explicit sidecar arrays cannot suppress message fallback.
- [ ] `algorithm.resource.added` payload schema is specified.

### APIs

- [x] Launch route should use existing Algorithm envelopes and owner authorization.
- [x] Nolme sidecar route remains raw-state-compatible.
- [ ] Test names and route tests align with local conventions.
- [ ] Real sidecar path integration is tested for sync.

