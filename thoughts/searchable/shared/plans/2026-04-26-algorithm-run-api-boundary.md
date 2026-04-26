---
date: 2026-04-26
status: draft
repository: cc-agent-ui
related_research:
  - thoughts/searchable/shared/research/2026-04-26-nolme-algorithm-interface-surfaces.md
  - thoughts/searchable/shared/research/2026-04-26-open-in-nolme-session-hydration.md
  - thoughts/searchable/shared/research/2026-04-26-cc-agent-ui-harness-middleware-interfaces.md
related_beads:
  - cam-b1x
  - cam-11u
---

# Algorithm Run API Boundary Implementation Plan

```text
┌────────────────────────────────────────────────────────────────────┐
│  Algorithm Run API Boundary                                        │
│  Status: Draft Plan                                                │
│  Date: 2026-04-26                                                  │
│  Scope: cosmic-agent-core contracts + cc-agent-ui/Nolme adapter     │
└────────────────────────────────────────────────────────────────────┘
```

## 📚 Overview

Define a versioned Algorithm Run API as the boundary between `cosmic-agent-core` and `cc-agent-ui`, so Nolme becomes an agent work surface rather than another transcript viewer.

The API has three layers:

| Layer | Owner | Purpose |
| --- | --- | --- |
| Command API | `cosmic-agent-core` exposed through `cc-agent-ui` server commands | Start, pause, resume, stop, answer questions, and approve actions |
| Event API | `cosmic-agent-core` | Append-only `algorithm.*` JSONL events for run lifecycle, phase, criteria, capabilities, questions, permissions, artifacts, and final output |
| State API | `cosmic-agent-core` projection consumed by `cc-agent-ui` | Current `AlgorithmRunState` snapshot for Nolme hydration and live updates |

## 📊 Current State Analysis

| Area | Current state | Gap |
| --- | --- | --- |
| Core Algorithm state | `LoopAlgorithmState` exists in `/home/maceo/Dev/cosmic-agent-core/v4.2.0/.claude/AAI/Tools/algorithm.ts:82` and is written under `MEMORY/STATE/algorithms/` by `writeAlgorithmState()` at line 245 | Shape is loop-runner internal state, not a versioned product API |
| Core PRD/work state | Algorithm v3.7.0 documents `PRD.md` as the source of truth, while `PRDSync.hook.ts` reads `MEMORY/WORK/.../PRD.md` writes and calls `syncToWorkJson()` | Event emission should supplement PRD/work state, not replace it |
| Core commands | `algorithm.ts` supports `new`, `status`, `pause`, `resume`, and `stop` around `/home/maceo/Dev/cosmic-agent-core/v4.2.0/.claude/AAI/Tools/algorithm.ts:153` and dispatches near line 1470 | Commands are CLI/PRD-frontmatter operations, not a normalized run command contract |
| Core events | `DomainEvent` and `EventBus` exist in `/home/maceo/Dev/cosmic-agent-core/v4.2.0/.claude/hooks/lib/domain-events.ts:168` and `event-bus.ts:30` | No `algorithm.run.started`, `algorithm.phase.changed`, or `AlgorithmEvent` union exists |
| Event persistence | JSONL consumer appends every `DomainEvent` in `/home/maceo/Dev/cosmic-agent-core/v4.2.0/.claude/hooks/lib/event-consumers.ts:27` | Current global stream is generic; Algorithm runs need run-scoped replay and sequence/cursor metadata |
| Nolme server bridge | `CcuSessionAgent.run()` wraps provider dispatch at `server/agents/ccu-session-agent.js:172`; `connect()` hydrates provider history and sidecar state at line 291 | It has no Algorithm event reader/projector and no structured Algorithm snapshot merge |
| Nolme state | `NolmeAgentState` includes phases/resources/profile/quickActions at `nolme-ui/src/lib/types.ts:63` | No first-class `algorithm` slice for task, criteria, pending decisions, artifacts lifecycle, final output, or event cursor |
| Nolme projection | `projectAiWorkingProjection()` prefers explicit sidecar phases/resources and falls back to transcript projection at `nolme-ui/src/lib/ai-working/projectAiWorkingProjection.ts:117` | Fallback parsing is the bridge; structured Algorithm events should become the preferred source |
| Questions/permissions | Questions parse `AskUserQuestion` and text fallbacks at `projectAssistantQuestion.ts:74`; permissions poll Claude pending requests at `usePendingPermissionRequests.ts:25` | Questions and approvals are not run-state-backed decision queues |

### Key Discoveries

| Discovery | Evidence | Planning consequence |
| --- | --- | --- |
| Nolme already has the right adapter location | `CcuSessionAgent.connect()` emits `STATE_SNAPSHOT` after reading sidecar state at `server/agents/ccu-session-agent.js:334` | Merge Algorithm projection before this snapshot |
| Nolme already separates explicit state from fallback parsing | `normalizeNolmeState()` records explicit phases/resources at `nolme-ui/src/lib/ai-working/normalizeNolmeState.ts:205` | Add structured Algorithm state as higher precedence than both sidecar legacy fields and transcript parsing |
| Existing provider dispatch should stay | `buildProviderDispatch()` maps Nolme binding to Claude/Cursor/Codex/Gemini at `server/agents/ccu-session-agent.js:67` | Algorithm orchestrates; cc-agent-ui remains runtime/harness adapter |
| Core docs already describe append-only events | `MEMORYSYSTEM.md:220` documents `MEMORY/STATE/events.jsonl` as append-only observability | Reuse the principle, but anchor implementation to live files: `domain-events.ts`, `event-bus.ts`, and `event-consumers.ts` |
| Existing Nolme hydration has a known bug | `cam-11u` tracks production connect using runner history instead of provider history replay | Algorithm hydration tests must cover `connect()` snapshot ordering and not mask the existing bug |

## 🎯 Desired End State

Nolme can open a run and show:

| Field | Source |
| --- | --- |
| Run id and session id | `AlgorithmRunState.runId`, `sessionId` |
| Current goal/task title | `algorithm.run.started` and latest state snapshot |
| Active phase and phase list | `algorithm.phase.changed` |
| Criteria progress | `algorithm.criteria.updated` |
| Selected/invoked capabilities | `algorithm.capability.selected`, `algorithm.capability.invoked` |
| Pending questions | `algorithm.question.requested` and answer events |
| Pending approvals | `algorithm.permission.requested` and decision events |
| Artifacts/deliverables | `algorithm.artifact.created` |
| Final output summary | `algorithm.run.completed` |

Verification is straightforward: a synthetic Algorithm event log with no transcript headers hydrates Nolme into a populated work surface. Transcript parsing remains only as legacy fallback for old sessions with no Algorithm events.

## 🚫 What We're NOT Doing

| Not doing | What we are doing instead |
| --- | --- |
| Replacing Claude/Cursor/Codex/Gemini provider dispatch | Keep `cc-agent-ui` provider harnesses and route Algorithm commands through existing dispatch adapters |
| Making transcript text the source of truth | Keep transcript parsing as a fallback only |
| Rebuilding the entire Nolme visual design | Extend existing Nolme state/projection/bindings so current work-surface components have structured data |
| Migrating every old session into Algorithm events | Support old sessions through existing message projection |
| Putting UI-specific fields into core contracts | Core emits product-domain run/phase/criteria/artifact/question/permission state; cc-agent-ui maps it to Nolme UI shapes |
| Replacing global `DomainEvent` | Add Algorithm-specific events alongside existing domain events and optionally mirror high-value events into the global bus |

## 🚀 Implementation Approach

```text
Core contracts → Core event writer → Core command instrumentation
       ↓                  ↓                    ↓
cc-agent-ui event reader/projector → Nolme state hydration/live deltas
       ↓
Nolme work surface prefers structured Algorithm state, then legacy sidecar, then transcript fallback
```

The safest path is additive. First define and test contracts in `cosmic-agent-core`, then emit events from existing Algorithm lifecycle points, then teach `cc-agent-ui` to read and project those events without disturbing current provider dispatch or transcript hydration.

---

## ╔══════════════════════════════════════╗
## ║ PHASE 1                              ║
## ║ Versioned Core Contracts             ║
## ╚══════════════════════════════════════╝

### Overview

Create the durable JSON contracts before touching Nolme UI. This prevents UI text parsing from becoming the hidden architecture.

### Changes Required

#### 1. Add Algorithm contract types

**File**: `/home/maceo/Dev/cosmic-agent-core/v4.2.0/.claude/hooks/lib/algorithm-run-contracts.ts`

**Changes**:

```typescript
export const ALGORITHM_RUN_CONTRACT_VERSION = 1;

export type AlgorithmPhase =
  | 'observe'
  | 'think'
  | 'plan'
  | 'build'
  | 'execute'
  | 'verify'
  | 'learn'
  | 'complete';

export type AlgorithmRunStatus =
  | 'starting'
  | 'running'
  | 'paused'
  | 'blocked'
  | 'stopped'
  | 'completed'
  | 'failed';

export interface AlgorithmCriteriaProgress {
  passing: number;
  total: number;
  failingIds: string[];
  criteria: Array<{
    id: string;
    description: string;
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
    type: 'criterion' | 'anti-criterion';
  }>;
}

export interface AlgorithmRunState {
  schemaVersion: 1;
  runId: string;
  sessionId?: string;
  projectPath: string;
  prdPath?: string;
  taskTitle: string;
  status: AlgorithmRunStatus;
  activePhase: AlgorithmPhase;
  phases: Array<{ id: AlgorithmPhase; title: string; status: 'idle' | 'active' | 'complete' }>;
  criteriaProgress: AlgorithmCriteriaProgress;
  capabilities: Array<{ id: string; label: string; status: 'selected' | 'invoked' | 'completed' | 'failed' }>;
  pendingQuestion?: AlgorithmQuestionRequest | null;
  pendingPermission?: AlgorithmPermissionRequest | null;
  artifacts: AlgorithmArtifact[];
  finalOutputSummary?: string;
  eventCursor: { sequence: number; eventsPath: string };
  updatedAt: string;
}
```

#### 2. Add Algorithm event union

**File**: `/home/maceo/Dev/cosmic-agent-core/v4.2.0/.claude/hooks/lib/algorithm-run-contracts.ts`

**Changes**:

```typescript
export type AlgorithmEvent =
  | AlgorithmRunStartedEvent
  | AlgorithmPhaseChangedEvent
  | AlgorithmCriteriaUpdatedEvent
  | AlgorithmCapabilitySelectedEvent
  | AlgorithmCapabilityInvokedEvent
  | AlgorithmQuestionRequestedEvent
  | AlgorithmQuestionAnsweredEvent
  | AlgorithmPermissionRequestedEvent
  | AlgorithmPermissionDecidedEvent
  | AlgorithmArtifactCreatedEvent
  | AlgorithmRunCompletedEvent
  | AlgorithmRunFailedEvent
  | AlgorithmRunPausedEvent
  | AlgorithmRunResumedEvent
  | AlgorithmRunStoppedEvent;
```

Every event must include:

| Field | Requirement |
| --- | --- |
| `schemaVersion` | Always `1` |
| `type` | Dot-separated `algorithm.*` event name |
| `runId` | Stable Algorithm run id |
| `sequence` | Monotonic within a run |
| `timestamp` | ISO-8601 |
| `sessionId` | Present once provider/Claude session is known |
| `projectPath` | Absolute path for run correlation |

### Success Criteria

#### Automated Verification

| Check | Command |
| --- | --- |
| Core contract type tests pass | `cd /home/maceo/Dev/cosmic-agent-core/v4.2.0/.claude && bun test hooks/lib/algorithm-run-contracts.test.ts` |
| Existing core event tests still pass | `cd /home/maceo/Dev/cosmic-agent-core/v4.2.0/.claude && bun test hooks/lib/domain-events.test.ts hooks/lib/event-bus.test.ts` |
| No cc-agent-ui tests touched by contract-only phase | `npm test -- tests/generated/test_ag_ui_event_translator.spec.ts` |

#### Manual Verification

| Check | Expected result |
| --- | --- |
| Contract review | Event names match the Command/Event/State API in this plan |
| Schema review | No Nolme-only labels, colors, or component-specific fields appear in core contracts |

---

## ╔══════════════════════════════════════╗
## ║ PHASE 2                              ║
## ║ Core Event Store And Projection       ║
## ╚══════════════════════════════════════╝

### Overview

Add a small append-only run event writer and deterministic projector in core.

### Changes Required

#### 1. Add run-scoped event storage

**File**: `/home/maceo/Dev/cosmic-agent-core/v4.2.0/.claude/hooks/lib/algorithm-run-events.ts`

**Changes**:

```typescript
export function getAlgorithmRunDir(runId: string): string;
export function getAlgorithmEventsPath(runId: string): string;
export function appendAlgorithmEvent(input: Omit<AlgorithmEvent, 'sequence' | 'timestamp'>): AlgorithmEvent;
export function readAlgorithmEvents(runId: string): AlgorithmEvent[];
export function projectAlgorithmRunState(events: AlgorithmEvent[]): AlgorithmRunState;
```

Store events at:

```text
~/.claude/MEMORY/STATE/algorithm-runs/<runId>/events.jsonl
~/.claude/MEMORY/STATE/algorithm-runs/<runId>/state.json
```

`appendAlgorithmEvent()` should also write `state.json` by replaying through `projectAlgorithmRunState()`. This gives consumers a cheap snapshot while preserving replay as the source of truth.

#### 2. Mirror selected events to the existing domain event bus

**Files**:

- `/home/maceo/Dev/cosmic-agent-core/v4.2.0/.claude/hooks/lib/domain-events.ts`
- `/home/maceo/Dev/cosmic-agent-core/v4.2.0/.claude/hooks/lib/event-consumers.ts`

**Changes**:

- Add `AlgorithmRunDomainEvent` with `type: 'algorithm.event'`.
- Keep detailed run data in run-scoped JSONL.
- Mirror compact metadata to global `MEMORY/STATE/events.jsonl` so existing observability still sees Algorithm activity.

### Success Criteria

#### Automated Verification

| Check | Command |
| --- | --- |
| Appending events creates JSONL and state snapshot | `cd /home/maceo/Dev/cosmic-agent-core/v4.2.0/.claude && bun test hooks/lib/algorithm-run-events.test.ts` |
| Replaying events is deterministic | `cd /home/maceo/Dev/cosmic-agent-core/v4.2.0/.claude && bun test hooks/lib/algorithm-run-events.test.ts -t replay` |
| Existing event bus behavior remains intact | `cd /home/maceo/Dev/cosmic-agent-core/v4.2.0/.claude && bun test hooks/lib/event-bus.test.ts hooks/lib/event-consumers.test.ts` |

#### Manual Verification

| Check | Expected result |
| --- | --- |
| Inspect JSONL | Each line is one valid JSON object with increasing `sequence` |
| Delete `state.json`, replay JSONL | Reconstructed state matches previous snapshot |

---

## ╔══════════════════════════════════════╗
## ║ PHASE 3                              ║
## ║ Core Command API And Instrumentation  ║
## ╚══════════════════════════════════════╝

### Overview

Instrument the existing Algorithm lifecycle and expose command helpers that can be called from CLI or cc-agent-ui server routes.

### Changes Required

#### 1. Add command API helper

**File**: `/home/maceo/Dev/cosmic-agent-core/v4.2.0/.claude/AAI/Tools/algorithm-run-api.ts`

**Changes**:

```typescript
export async function startRun(input: {
  projectPath: string;
  prompt: string;
  provider: 'claude' | 'cursor' | 'codex' | 'gemini';
  model?: string;
  permissionMode?: 'default' | 'acceptEdits' | 'bypassPermissions' | 'plan';
  algorithmMode: 'loop' | 'interactive';
}): Promise<{ runId: string; state: AlgorithmRunState }>;

export function pauseRun(runId: string): AlgorithmRunState;
export async function resumeRun(runId: string): Promise<AlgorithmRunState>;
export function stopRun(runId: string): AlgorithmRunState;
export function answerQuestion(runId: string, response: unknown): AlgorithmRunState;
export function approveAction(runId: string, decision: unknown): AlgorithmRunState;
```

#### 2. Instrument existing loop lifecycle

**File**: `/home/maceo/Dev/cosmic-agent-core/v4.2.0/.claude/AAI/Tools/algorithm.ts`

**Changes**:

| Location | Current behavior | Add |
| --- | --- | --- |
| `createLoopState()` at line 408 | Builds internal state | Emit `algorithm.run.started` and initial `algorithm.criteria.updated` |
| `updateLoopStateForIteration()` at line 445 | Updates iteration state | Emit `algorithm.phase.changed` and `algorithm.criteria.updated` |
| Parallel agent assignment around line 1023 | Populates `state.agents` | Emit capability/worker activity events |
| Iteration completion around lines 1067 and 1159 | Pushes loop history | Emit criteria and artifact updates |
| `finalizeLoopState()` at line 458 | Marks complete/failed/blocked/etc. | Emit `algorithm.run.completed` or `algorithm.run.failed` |
| `pauseLoop()` / `resumeLoop()` / `stopLoop()` at lines 1412, 1425, 1438 | Writes PRD frontmatter | Emit paused/resumed/stopped events |

#### 3. Emit PRD/work-state derived phase events

**Files**:

- `/home/maceo/Dev/cosmic-agent-core/v4.2.0/.claude/hooks/PRDSync.hook.ts`
- `/home/maceo/Dev/cosmic-agent-core/v4.2.0/.claude/hooks/lib/prd-utils.ts`

**Changes**:

- When `PRDSync.hook.ts` detects a valid phase transition at line 61, emit `algorithm.phase.changed` for the associated session/run.
- When `syncToWorkJson()` updates criteria around `prd-utils.ts:191`, emit `algorithm.criteria.updated`.
- If run id is unknown, attach `sessionId` and `prdPath` so the run-event layer can correlate or create a run record.

### Success Criteria

#### Automated Verification

| Check | Command |
| --- | --- |
| Loop lifecycle emits start/criteria/completion events | `cd /home/maceo/Dev/cosmic-agent-core/v4.2.0/.claude && bun test AAI/Tools/algorithm-run-api.test.ts` |
| PRD sync emits phase and criteria events | `cd /home/maceo/Dev/cosmic-agent-core/v4.2.0/.claude && bun test hooks/PRDSync.algorithm-events.test.ts` |
| Pause/resume/stop commands update state and events | `cd /home/maceo/Dev/cosmic-agent-core/v4.2.0/.claude && bun test AAI/Tools/algorithm-run-api.test.ts -t commands` |

#### Manual Verification

| Check | Expected result |
| --- | --- |
| Start a small loop run | `algorithm-runs/<runId>/events.jsonl` appears and receives run/phase/criteria events |
| Pause/resume/stop from CLI | Nolme-visible state changes without parsing console text |

---

## ╔══════════════════════════════════════╗
## ║ PHASE 4                              ║
## ║ cc-agent-ui Server Adapter            ║
## ╚══════════════════════════════════════╝

### Overview

Teach `cc-agent-ui` to read Algorithm run events and project them into Nolme state and AG-UI deltas.

### Changes Required

#### 1. Add Algorithm run reader/projector

**File**: `server/agents/algorithm-run-adapter.js`

**Changes**:

```javascript
export async function readAlgorithmRunState({ runId, sessionId, projectPath });
export async function readAlgorithmEventsSince({ runId, sequence });
export function projectAlgorithmRunToNolmeState(algorithmState, existingNolmeState);
export function projectAlgorithmEventToAgUiDelta(event);
```

Projection rules:

| Algorithm field | Nolme state field |
| --- | --- |
| `phases` / `activePhase` | `phases`, `currentPhaseIndex`, `currentReviewLine` |
| `criteriaProgress` | `algorithm.criteriaProgress`, usage/progress display |
| `capabilities` | `algorithm.capabilities`, `profile.skills`, `quickActions` |
| `pendingQuestion` | `algorithm.pendingQuestion`, existing question card |
| `pendingPermission` | `algorithm.pendingPermission`, existing approval card |
| `artifacts` | `algorithm.artifacts`, `resources` |
| `finalOutputSummary` | `algorithm.finalOutputSummary`, completion output card |

#### 2. Merge Algorithm state during hydration

**File**: `server/agents/ccu-session-agent.js`

**Changes**:

- In `connect()`, after provider history replay and before `STATE_SNAPSHOT` at line 334:
  - read sidecar state with `readState(binding)`
  - read Algorithm state by `binding.algorithmRunId`, or by latest run matching `binding.sessionId` / `binding.projectPath`
  - merge Algorithm projection over sidecar state
  - emit one `STATE_SNAPSHOT`

#### 3. Emit live state deltas during runs

**File**: `server/agents/ccu-session-agent.js`

**Changes**:

- During `run()`, keep current provider `NormalizedMessage` translation unchanged.
- Add Algorithm event polling/watching when `binding.algorithmRunId` exists.
- Convert new Algorithm events to `STATE_DELTA` operations using `projectAlgorithmEventToAgUiDelta()`.
- Do not emit Algorithm events as assistant transcript text.

#### 4. Add command routes

**File**: `server/routes/algorithm-runs.js`

**Changes**:

| Route | Command |
| --- | --- |
| `POST /api/algorithm-runs` | `startRun(...)` |
| `POST /api/algorithm-runs/:runId/pause` | `pauseRun(runId)` |
| `POST /api/algorithm-runs/:runId/resume` | `resumeRun(runId)` |
| `POST /api/algorithm-runs/:runId/stop` | `stopRun(runId)` |
| `POST /api/algorithm-runs/:runId/questions/:questionId/answer` | `answerQuestion(runId, response)` |
| `POST /api/algorithm-runs/:runId/permissions/:permissionId/decision` | `approveAction(runId, decision)` |

Mount behind the existing auth stack near `server/index.js:467`.

### Success Criteria

#### Automated Verification

| Check | Command |
| --- | --- |
| Adapter projects synthetic Algorithm state into Nolme state | `npm test -- tests/generated/test_algorithm_run_adapter.spec.ts` |
| `connect()` emits Algorithm-backed `STATE_SNAPSHOT` | `npm test -- tests/generated/test_ccu_session_agent_algorithm_hydration.spec.ts` |
| Live events become `STATE_DELTA`, not transcript messages | `npm test -- tests/generated/test_ag_ui_algorithm_event_translation.spec.ts` |
| Command routes validate request bodies and auth | `npm test -- tests/generated/test_algorithm_runs_route.spec.ts` |

#### Manual Verification

| Check | Expected result |
| --- | --- |
| Open Nolme with a run id | Work surface hydrates from Algorithm state even if transcript has no phase headers |
| Trigger a phase event while Nolme is open | Phase rail updates via state delta |
| Trigger an artifact event | Deliverables rail updates with title/action/path metadata |

---

## ╔══════════════════════════════════════╗
## ║ PHASE 5                              ║
## ║ Nolme Structured Work Surface         ║
## ╚══════════════════════════════════════╝

### Overview

Extend Nolme state and projection so structured Algorithm state wins over transcript parsing.

### Changes Required

#### 1. Extend Nolme types

**File**: `nolme-ui/src/lib/types.ts`

**Changes**:

```typescript
export interface NolmeAlgorithmState {
  schemaVersion: 1;
  runId: string;
  sessionId?: string;
  taskTitle: string;
  status: 'starting' | 'running' | 'paused' | 'blocked' | 'stopped' | 'completed' | 'failed';
  activePhase: string;
  criteriaProgress: {
    passing: number;
    total: number;
    failingIds: string[];
  };
  capabilities: Array<{ id: string; label: string; status: string }>;
  pendingQuestion?: unknown;
  pendingPermission?: unknown;
  artifacts: Array<{
    id: string;
    title: string;
    subtitle?: string;
    path?: string;
    url?: string;
    kind: string;
    createdAt: string;
  }>;
  finalOutputSummary?: string;
  eventCursor: { sequence: number; eventsPath?: string };
}

export interface NolmeAgentState {
  schemaVersion: 1;
  algorithm?: NolmeAlgorithmState | null;
  phases: NolmePhase[];
  currentPhaseIndex: number;
  currentReviewLine: string;
  resources: NolmeResource[];
  profile: NolmeAgentProfile | null;
  quickActions: string[];
  taskNotifications: NolmeTaskNotification[];
}
```

#### 2. Normalize and project with Algorithm precedence

**Files**:

- `nolme-ui/src/lib/ai-working/normalizeNolmeState.ts`
- `nolme-ui/src/lib/ai-working/projectAiWorkingProjection.ts`

**Changes**:

Priority order:

1. `state.algorithm` projected from Algorithm events/state
2. legacy explicit `state.phases` / `state.resources`
3. workflow-tool events (`setPhaseState`, `advancePhase`)
4. transcript text fallback (`ALGORITHM` headers, `COMPLETED:`, etc.)

#### 3. State-backed questions and permissions

**Files**:

- `nolme-ui/src/components/bindings/AiResponseQuestionsCardBound.tsx`
- `nolme-ui/src/lib/ai-working/projectAssistantQuestion.ts`
- `nolme-ui/src/hooks/usePendingPermissionRequests.ts`

**Changes**:

- Prefer `state.algorithm.pendingQuestion`.
- Prefer `state.algorithm.pendingPermission`.
- Keep polling route as compatibility fallback for Claude sessions that have no Algorithm event stream.
- Add resolved/dismissed handling so stale questions do not reappear after response.

#### 4. Preserve richer artifact metadata

**Files**:

- `nolme-ui/src/lib/ai-working/types.ts`
- `nolme-ui/src/lib/ai-working/projectDeliverables.ts`
- `nolme-ui/src/components/bindings/DeliverablesRailBound.v2.tsx`

**Changes**:

- Preserve `action`, `url`, `source`, `filePath`, and Algorithm artifact metadata.
- Map Algorithm artifacts into deliverables without requiring tool-result parsing.

### Success Criteria

#### Automated Verification

| Check | Command |
| --- | --- |
| Algorithm state wins over transcript fallback | `npm --prefix nolme-ui test -- tests/generated/ai-working/P20_algorithm_state_precedence.spec.ts` |
| Structured question/permission state renders and resolves | `npm --prefix nolme-ui test -- tests/generated/nolme-chat/P20_algorithm_decision_queue.spec.tsx` |
| Algorithm artifacts render in deliverables rail | `npm --prefix nolme-ui test -- tests/generated/ai-working/P21_algorithm_artifacts.spec.ts` |
| Existing legacy projection tests still pass | `npm --prefix nolme-ui test -- tests/generated/ai-working/P1_merge_precedence.spec.ts tests/generated/ai-working/P2_phase_timeline_from_conversation.spec.ts tests/generated/ai-working/P3_deliverables_from_conversation.spec.ts` |

#### Manual Verification

| Check | Expected result |
| --- | --- |
| Run with structured events and no Algorithm text headers | Nolme still shows phase/progress/deliverables |
| Run with only old transcript history | Existing fallback projection still works |
| Pending question answered in Nolme | Card disappears and run event/state records answer |
| Permission approved/denied in Nolme | Existing provider permission flow receives the decision and state updates |

---

## ╔══════════════════════════════════════╗
## ║ PHASE 6                              ║
## ║ End-To-End Verification And Rollout   ║
## ╚══════════════════════════════════════╝

### Overview

Validate the new boundary with synthetic fixtures first, then a live Algorithm run.

### Changes Required

#### 1. Add fixtures

**Files**:

- `tests/fixtures/algorithm-runs/simple-run/events.jsonl`
- `nolme-ui/tests/fixtures/algorithm-runs/simple-run/state.json`

**Changes**:

Create fixtures covering:

- start
- phase change
- criteria update
- capability selected/invoked
- question requested/answered
- permission requested/decided
- artifact created
- completion summary

#### 2. Add cross-layer integration tests

**Files**:

- `tests/generated/test_algorithm_run_end_to_end_projection.spec.ts`
- `nolme-ui/tests/generated/nolme-chat/P22_algorithm_work_surface.spec.tsx`

**Changes**:

Tests should prove:

- cc-agent-ui can hydrate from event JSONL.
- Nolme work surface renders from `state.algorithm`.
- No `ALGORITHM` text headers are required.
- Legacy transcript fallback still works when no Algorithm state exists.

### Success Criteria

#### Automated Verification

| Check | Command |
| --- | --- |
| Root tests pass for server adapter/routes | `npm test -- tests/generated/test_algorithm_run_adapter.spec.ts tests/generated/test_algorithm_runs_route.spec.ts tests/generated/test_algorithm_run_end_to_end_projection.spec.ts` |
| Nolme tests pass for projection/work surface | `npm --prefix nolme-ui test -- tests/generated/ai-working/P20_algorithm_state_precedence.spec.ts tests/generated/nolme-chat/P22_algorithm_work_surface.spec.tsx` |
| Type checks pass | `npm run typecheck && npm --prefix nolme-ui run typecheck` |
| Builds pass | `npm run build:all` |

#### Manual Verification

| Check | Expected result |
| --- | --- |
| Start Algorithm run from Nolme | New run id appears, work surface shows current goal and active phase |
| Pause/resume/stop | State updates in Nolme without relying on transcript text |
| Complete run | Final output summary and artifacts appear in Nolme |
| Audit/debug lane | Transcript, tool calls, and thinking remain available but are not the primary state source |

---

## 🧪 Testing Strategy

### Unit Tests

| Area | Test focus |
| --- | --- |
| Core contracts | Event validation, required fields, versioning |
| Core event store | Append, sequence assignment, JSONL replay, snapshot generation |
| Core command API | Command input validation and lifecycle events |
| cc-agent-ui adapter | Event/state projection into Nolme-compatible state |
| Nolme projection | Structured Algorithm state precedence over sidecar and transcript fallback |

### Integration Tests

| Scenario | Expected result |
| --- | --- |
| Synthetic event log hydrates Nolme | Work surface has phases, criteria, artifacts, question/permission state |
| Existing session with no Algorithm events | Current transcript fallback tests continue passing |
| Live Algorithm event updates | AG-UI emits `STATE_DELTA` and Nolme updates without transcript text |
| Permission decision | Decision reaches existing provider permission flow and emits Algorithm decision event |

### Manual Testing Steps

1. Start the server with `npm run dev:all`.
2. Open an existing session in Nolme to confirm legacy hydration still works.
3. Start a new Algorithm run through the new command route.
4. Confirm Nolme shows the goal, phase, criteria progress, and active capability before any transcript-derived headers appear.
5. Trigger a question and a permission request.
6. Answer/approve through Nolme and confirm cards clear.
7. Complete the run and confirm final output plus artifacts remain visible after reload.

## ⚙️ Performance Considerations

| Concern | Mitigation |
| --- | --- |
| Large JSONL files | Keep run-scoped event logs and maintain `state.json` snapshot with `eventCursor.sequence` |
| Live updates | Poll or watch only the active run file, starting from last sequence |
| Hydration speed | Read `state.json` first, replay JSONL only for corruption recovery or tests |
| UI churn | Batch multiple Algorithm events into one `STATE_DELTA` when possible |
| File watcher portability | Use polling fallback when `fs.watch` misses events on networked filesystems |

## 🔁 Migration Notes

| Existing data | Behavior after rollout |
| --- | --- |
| Old Nolme sidecars | Continue to hydrate through existing `phases` and `resources` fields |
| Old transcripts | Continue to use `projectPhaseTimeline()` and `projectDeliverables()` fallback |
| Existing `cam-11u` bug | Keep connect/hydration ordering explicit; Algorithm snapshots should not mask broken provider history replay |
| Core event docs mentioning `event-emitter.ts` / `event-types.ts` | Treat them as stale documentation unless those files are restored; implement against live `domain-events.ts`, `event-bus.ts`, and `event-consumers.ts` |
| Existing global events | Continue to be written; Algorithm run JSONL adds run-scoped replay rather than replacing global observability |

## 📌 References

- Related research: `thoughts/searchable/shared/research/2026-04-26-nolme-algorithm-interface-surfaces.md`
- Related research: `thoughts/searchable/shared/research/2026-04-26-open-in-nolme-session-hydration.md`
- Related research: `thoughts/searchable/shared/research/2026-04-26-cc-agent-ui-harness-middleware-interfaces.md`
- Implementation bead: `cam-b1x`
- Related bead: `cam-11u`
- Core Algorithm loop state: `/home/maceo/Dev/cosmic-agent-core/v4.2.0/.claude/AAI/Tools/algorithm.ts:82`
- Core event bus: `/home/maceo/Dev/cosmic-agent-core/v4.2.0/.claude/hooks/lib/event-bus.ts:30`
- Core event consumer: `/home/maceo/Dev/cosmic-agent-core/v4.2.0/.claude/hooks/lib/event-consumers.ts:27`
- Nolme AG-UI bridge: `server/agents/ccu-session-agent.js:172`
- Nolme sidecar store: `server/agents/nolme-state-store.js:97`
- Nolme state types: `nolme-ui/src/lib/types.ts:63`
- Nolme projection precedence: `nolme-ui/src/lib/ai-working/projectAiWorkingProjection.ts:117`
