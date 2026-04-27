---
date: 2026-04-26T11:01:19-04:00
researcher: maceo
git_commit: b53fe98a6f87adbd63c09ff8045559e5c9142e59
branch: main
repository: cc-agent-ui
topic: "Existing Nolme, provider harness, and Algorithm state surfaces for an Algorithm Run API boundary"
tags: [research, codebase, nolme, algorithm, ag-ui, copilotkit, provider-harness, cosmic-agent-core]
status: complete
last_updated: 2026-04-26
last_updated_by: maceo
related_beads: [cam-11u]
---

# Research: Nolme Algorithm Interface Surfaces

**Date**: 2026-04-26T11:01:19-04:00  
**Researcher**: maceo  
**Git Commit**: `b53fe98a6f87adbd63c09ff8045559e5c9142e59`  
**Branch**: `main`  
**Repository**: `cc-agent-ui`

## Research Question

What existing code surfaces in `cc-agent-ui` and `/home/maceo/Dev/cosmic-agent-core` already correspond to an Algorithm Run boundary between the Algorithm orchestrator and Nolme as an agent work surface?

## Summary

The current system already has three separate layers that map onto the proposed command/event/state split, but they are not currently expressed as one named `AlgorithmRunState` / `AlgorithmEvent` contract.

- `cc-agent-ui` has provider command transports through WebSocket, `POST /api/agent`, and `/api/copilotkit`.
- Nolme has a hydrated work-surface state shape, `NolmeAgentState`, plus projections that derive phases, deliverables, questions, and active work context from explicit state or message history.
- `cosmic-agent-core` has `LoopAlgorithmState`, PRD/work state, phase/criteria parsing, loop lifecycle commands, and a generic domain-event bus that writes append-only JSONL events.

The named contracts found during source search are:

- `LoopAlgorithmState` in Core Algorithm loop runner.
- `DomainEvent` in Core hook event infrastructure.
- `NormalizedMessage` / `ProviderAdapter` in `cc-agent-ui` provider normalization.
- `NolmeSessionBinding` and `NolmeAgentState` in Nolme.

The exact symbols `AlgorithmRunState`, `AlgorithmEvent`, `algorithm.run.started`, and `algorithm.phase.changed` were not found in the researched files. The closest existing state/event surfaces are documented below.

## Related Existing Research

Three prior notes under `thoughts/searchable/shared/research` cover adjacent surfaces:

- [`2026-04-26-open-in-nolme-session-hydration.md`](./2026-04-26-open-in-nolme-session-hydration.md) documents Nolme launch binding, hydration, provider history replay, sidecar state, and projection fallback.
- [`2026-04-26-cc-agent-ui-harness-middleware-interfaces.md`](./2026-04-26-cc-agent-ui-harness-middleware-interfaces.md) documents WebSocket, REST/SSE, and CopilotKit harness interfaces.
- [`2026-04-26-cc-agent-ui-figma-surface-map.md`](./2026-04-26-cc-agent-ui-figma-surface-map.md) maps the existing UI shell and separate Nolme right-rail work surface.

The related bead is `cam-11u`, which tracks a Nolme hydration issue where an existing Claude session opens empty when CopilotKit connect uses runner history instead of the `CcuSessionAgent.connect()` provider-history path.

## Nolme Work-Surface State

Nolme is launched from the main UI with a session binding. `NolmeLaunchBinding` includes provider, session id, project name/path, model, permission mode, and tool settings in [`src/utils/nolmeLaunch.ts:9`](../../../../src/utils/nolmeLaunch.ts#L9). The launcher builds that binding from the selected project/session and stored provider preferences in [`src/utils/nolmeLaunch.ts:99`](../../../../src/utils/nolmeLaunch.ts#L99), then serializes `/nolme/?provider=...&sessionId=...` in [`src/utils/nolmeLaunch.ts:124`](../../../../src/utils/nolmeLaunch.ts#L124).

The main app publishes the current Nolme binding through local storage and `BroadcastChannel('ccu-session')` in [`src/hooks/useSessionBroadcast.ts:22`](../../../../src/hooks/useSessionBroadcast.ts#L22). Nolme resolves the binding from URL params, local storage, and broadcast events in [`nolme-ui/src/hooks/useCcuSession.ts:21`](../../../../nolme-ui/src/hooks/useCcuSession.ts#L21), [`nolme-ui/src/hooks/useCcuSession.ts:36`](../../../../nolme-ui/src/hooks/useCcuSession.ts#L36), and [`nolme-ui/src/hooks/useCcuSession.ts:94`](../../../../nolme-ui/src/hooks/useCcuSession.ts#L94).

Hydration is split between transcript history and work-surface state. `useHydratedState()` builds `/api/sessions/:sessionId/messages` in [`nolme-ui/src/hooks/useHydratedState.ts:31`](../../../../nolme-ui/src/hooks/useHydratedState.ts#L31), builds `/api/nolme/state/:sessionId` in [`nolme-ui/src/hooks/useHydratedState.ts:40`](../../../../nolme-ui/src/hooks/useHydratedState.ts#L40), and fetches both in parallel in [`nolme-ui/src/hooks/useHydratedState.ts:63`](../../../../nolme-ui/src/hooks/useHydratedState.ts#L63). Message fetch failure is treated as an error; sidecar state failure defaults to an empty Nolme state.

`NolmeApp` mounts CopilotKit only after binding and hydration are ready. The app calls `useCcuSession()` and `useHydratedState()` in [`nolme-ui/src/NolmeApp.tsx:109`](../../../../nolme-ui/src/NolmeApp.tsx#L109), then mounts `<CopilotKit runtimeUrl="/api/copilotkit" agent="ccu" threadId=... updates=... properties={{ binding }}>` in [`nolme-ui/src/NolmeApp.tsx:121`](../../../../nolme-ui/src/NolmeApp.tsx#L121). The hydrated work-surface provider wraps `NolmeDashboardV2` in [`nolme-ui/src/NolmeApp.tsx:136`](../../../../nolme-ui/src/NolmeApp.tsx#L136).

`NolmeAgentState` is the existing UI-facing state snapshot shape. It is defined with phases, active phase index, resources, quick actions, token budget, active skill, and profile fields in [`nolme-ui/src/lib/types.ts:63`](../../../../nolme-ui/src/lib/types.ts#L63). `DEFAULT_NOLME_AGENT_STATE` is defined in [`nolme-ui/src/lib/types.ts:76`](../../../../nolme-ui/src/lib/types.ts#L76). The server-side sidecar store persists per-session `NolmeAgentState` for phases, current phase index, resources, agent profile, quick actions, and token budget in [`server/agents/nolme-state-store.js:1`](../../../../server/agents/nolme-state-store.js#L1), reads state in [`server/agents/nolme-state-store.js:97`](../../../../server/agents/nolme-state-store.js#L97), and writes state in [`server/agents/nolme-state-store.js:131`](../../../../server/agents/nolme-state-store.js#L131).

The dashboard surface is already organized as work state rather than only transcript. `NolmeDashboardV2` renders nav, chat, phase bar, and deliverables rail in [`nolme-ui/src/components/NolmeDashboard.v2.tsx:7`](../../../../nolme-ui/src/components/NolmeDashboard.v2.tsx#L7). Bound components consume projected state through `useCopilotKitNolmeAgentState()` in [`nolme-ui/src/components/bindings/useCopilotKitNolmeAgentState.ts:4`](../../../../nolme-ui/src/components/bindings/useCopilotKitNolmeAgentState.ts#L4), the phase bar binds phases/current index/review line in [`nolme-ui/src/components/bindings/WorkflowPhaseBarBound.v2.tsx:4`](../../../../nolme-ui/src/components/bindings/WorkflowPhaseBarBound.v2.tsx#L4), and the deliverables rail maps `state.resources` in [`nolme-ui/src/components/bindings/DeliverablesRailBound.v2.tsx:11`](../../../../nolme-ui/src/components/bindings/DeliverablesRailBound.v2.tsx#L11).

Nolme has both explicit-state and transcript-derived projection. `normalizeNolmeState()` normalizes persisted/live state and records which slices were explicit in [`nolme-ui/src/lib/ai-working/normalizeNolmeState.ts:158`](../../../../nolme-ui/src/lib/ai-working/normalizeNolmeState.ts#L158). `useAiWorkingProjection()` calls `useCoAgent({ name: 'ccu', initialState })` and merges live Copilot state with hydrated messages in [`nolme-ui/src/hooks/useAiWorkingProjection.ts:45`](../../../../nolme-ui/src/hooks/useAiWorkingProjection.ts#L45). `projectAiWorkingProjection()` normalizes messages, projects phases, deliverables, and questions in [`nolme-ui/src/lib/ai-working/projectAiWorkingProjection.ts:117`](../../../../nolme-ui/src/lib/ai-working/projectAiWorkingProjection.ts#L117); explicit state wins and missing slices fall back to conversation projection in [`nolme-ui/src/lib/ai-working/projectAiWorkingProjection.ts:124`](../../../../nolme-ui/src/lib/ai-working/projectAiWorkingProjection.ts#L124).

The current phase projection reads Algorithm-like transcript structure. It normalizes phase keys in [`nolme-ui/src/lib/ai-working/projectPhaseTimeline.ts:57`](../../../../nolme-ui/src/lib/ai-working/projectPhaseTimeline.ts#L57), extracts Algorithm phase keys from assistant lines containing `ALGORITHM` in [`nolme-ui/src/lib/ai-working/projectPhaseTimeline.ts:74`](../../../../nolme-ui/src/lib/ai-working/projectPhaseTimeline.ts#L74), scopes to the latest Algorithm cycle start in [`nolme-ui/src/lib/ai-working/projectPhaseTimeline.ts:110`](../../../../nolme-ui/src/lib/ai-working/projectPhaseTimeline.ts#L110), extracts latest header/progress state in [`nolme-ui/src/lib/ai-working/projectPhaseTimeline.ts:137`](../../../../nolme-ui/src/lib/ai-working/projectPhaseTimeline.ts#L137), and also reads workflow tool calls such as `setPhaseState` and `advancePhase` in [`nolme-ui/src/lib/ai-working/projectPhaseTimeline.ts:352`](../../../../nolme-ui/src/lib/ai-working/projectPhaseTimeline.ts#L352).

Deliverables are likewise projected from runtime history. `projectDeliverables()` derives file deliverables from `tool_result.toolUseResult.filePath`, tool resources from `addResource`, and summary deliverables from assistant `COMPLETED:` text in [`nolme-ui/src/lib/ai-working/projectDeliverables.ts:100`](../../../../nolme-ui/src/lib/ai-working/projectDeliverables.ts#L100), [`nolme-ui/src/lib/ai-working/projectDeliverables.ts:140`](../../../../nolme-ui/src/lib/ai-working/projectDeliverables.ts#L140), [`nolme-ui/src/lib/ai-working/projectDeliverables.ts:178`](../../../../nolme-ui/src/lib/ai-working/projectDeliverables.ts#L178), and merges candidates in [`nolme-ui/src/lib/ai-working/projectDeliverables.ts:240`](../../../../nolme-ui/src/lib/ai-working/projectDeliverables.ts#L240).

Questions and approvals have existing UI surfaces. `AskUserQuestion` is treated as interaction-required in [`server/claude-sdk.js:35`](../../../../server/claude-sdk.js#L35). Claude permission requests are emitted and stored pending in [`server/claude-sdk.js:560`](../../../../server/claude-sdk.js#L560), then filtered by session in [`server/claude-sdk.js:807`](../../../../server/claude-sdk.js#L807). Nolme exposes pending-permission GET and decision POST routes in [`server/routes/nolme-state.js:45`](../../../../server/routes/nolme-state.js#L45) and [`server/routes/nolme-state.js:66`](../../../../server/routes/nolme-state.js#L66). The Nolme hook polls those routes for Claude sessions in [`nolme-ui/src/hooks/usePendingPermissionRequests.ts:22`](../../../../nolme-ui/src/hooks/usePendingPermissionRequests.ts#L22). The question card binding chooses live pending question state before projected historical questions in [`nolme-ui/src/components/bindings/AiResponseQuestionsCardBound.tsx:11`](../../../../nolme-ui/src/components/bindings/AiResponseQuestionsCardBound.tsx#L11), and `NolmeChatView` renders the question card above the composer in [`nolme-ui/src/components/NolmeChatView.tsx:107`](../../../../nolme-ui/src/components/NolmeChatView.tsx#L107).

## cc-agent-ui Harness And AG-UI Surfaces

`cc-agent-ui` has three current execution transports that converge on the same provider harnesses.

The main WebSocket is created in [`server/index.js:333`](../../../../server/index.js#L333), routes `/ws`, `/shell`, and plugin sockets in [`server/index.js:1504`](../../../../server/index.js#L1504), wraps chat sockets in `WebSocketWriter` in [`server/index.js:1532`](../../../../server/index.js#L1532), and dispatches provider command types to `queryClaudeSDK`, `spawnCursor`, `queryCodex`, and `spawnGemini` in [`server/index.js:1573`](../../../../server/index.js#L1573).

The external API surface mounts `/api/agent` in [`server/index.js:467`](../../../../server/index.js#L467). The route handles `POST /` in [`server/routes/agent.js:842`](../../../../server/routes/agent.js#L842), validates `provider` in [`server/routes/agent.js:862`](../../../../server/routes/agent.js#L862), creates an SSE writer or response collector in [`server/routes/agent.js:918`](../../../../server/routes/agent.js#L918), and dispatches Claude/Cursor/Codex/Gemini in [`server/routes/agent.js:947`](../../../../server/routes/agent.js#L947).

The Nolme/CopilotKit surface mounts `/api/copilotkit` in [`server/index.js:471`](../../../../server/index.js#L471). The route creates a CopilotKit runtime with `SafeInMemoryAgentRunner` and `ccu: new CcuSessionAgent(...)` in [`server/routes/copilotkit.js:26`](../../../../server/routes/copilotkit.js#L26), registers the `ccu` agent in [`server/routes/copilotkit.js:36`](../../../../server/routes/copilotkit.js#L36), installs the single-route CopilotKit handler in [`server/routes/copilotkit.js:66`](../../../../server/routes/copilotkit.js#L66), and forwards the authenticated user id as `x-cc-user-id` in [`server/routes/copilotkit.js:82`](../../../../server/routes/copilotkit.js#L82).

The provider-normalized frame contract is in [`server/providers/types.js:1`](../../../../server/providers/types.js#L1). It defines providers `claude | cursor | codex | gemini` in [`server/providers/types.js:13`](../../../../server/providers/types.js#L13), normalized message kinds in [`server/providers/types.js:19`](../../../../server/providers/types.js#L19), `NormalizedMessage` fields in [`server/providers/types.js:27`](../../../../server/providers/types.js#L27), fetch-history results in [`server/providers/types.js:53`](../../../../server/providers/types.js#L53), and `ProviderAdapter` with `fetchHistory()` plus `normalizeMessage()` in [`server/providers/types.js:72`](../../../../server/providers/types.js#L72). `createNormalizedMessage()` fills ids, timestamps, session ids, and provider fields in [`server/providers/types.js:106`](../../../../server/providers/types.js#L106).

The provider registry registers built-in adapters in [`server/providers/registry.js:23`](../../../../server/providers/registry.js#L23), exposes `getProvider()` in [`server/providers/registry.js:29`](../../../../server/providers/registry.js#L29), and is used by `CcuSessionAgent.connect()` to hydrate existing provider history in [`server/agents/ccu-session-agent.js:307`](../../../../server/agents/ccu-session-agent.js#L307).

`CcuSessionAgent` is the AG-UI runtime adapter. `buildProviderDispatch()` maps a Nolme binding into the provider-specific invocation options in [`server/agents/ccu-session-agent.js:67`](../../../../server/agents/ccu-session-agent.js#L67). `run(input)` reads `input.forwardedProps.binding`, creates a translator cursor and `NolmeAgUiWriter`, persists token budget into sidecar state, translates provider frames into AG-UI events, and dispatches to the selected provider in [`server/agents/ccu-session-agent.js:172`](../../../../server/agents/ccu-session-agent.js#L172). `connect(input)` reads the binding, fetches provider history, translates history messages, reads sidecar state, emits `STATE_SNAPSHOT`, and emits `RUN_FINISHED` in [`server/agents/ccu-session-agent.js:291`](../../../../server/agents/ccu-session-agent.js#L291).

`NolmeAgUiWriter` is a writer-like bridge that matches the `.send(frame)` interface used by the WebSocket and SSE paths in [`server/agents/nolme-ag-ui-writer.js:1`](../../../../server/agents/nolme-ag-ui-writer.js#L1). Its `send()` method calls `onFrame(frame)` and converts translator exceptions into error frames in [`server/agents/nolme-ag-ui-writer.js:27`](../../../../server/agents/nolme-ag-ui-writer.js#L27).

`ag-ui-event-translator` maps normalized frames to AG-UI events. `createCursor()` owns per-run translation state in [`server/agents/ag-ui-event-translator.js:34`](../../../../server/agents/ag-ui-event-translator.js#L34). `translate()` handles stream/text/thinking frames as text events, tool and permission frames as tool events, status/task/session frames as `STATE_DELTA` or `STATE_SNAPSHOT`, and errors as `RUN_ERROR` in [`server/agents/ag-ui-event-translator.js:89`](../../../../server/agents/ag-ui-event-translator.js#L89). Thinking frames are intentionally emitted as regular assistant text events in [`server/agents/ag-ui-event-translator.js:121`](../../../../server/agents/ag-ui-event-translator.js#L121). Status frames can update `/statusText` and `/tokenBudget` in [`server/agents/ag-ui-event-translator.js:172`](../../../../server/agents/ag-ui-event-translator.js#L172). Interactive prompts map to `askQuestion` tool calls in [`server/agents/ag-ui-event-translator.js:205`](../../../../server/agents/ag-ui-event-translator.js#L205).

## Core Algorithm State And Events

Core Algorithm CLI code lives at `/home/maceo/Dev/cosmic-agent-core/v4.2.0/.claude/AAI/Tools/algorithm.ts`. The file documents loop and interactive modes plus commands `new`, `status`, `pause`, `resume`, and `stop` at line 9. The parser recognizes subcommands around line 148, and command dispatch is around line 1470.

`LoopAlgorithmState` is defined inline at `/home/maceo/Dev/cosmic-agent-core/v4.2.0/.claude/AAI/Tools/algorithm.ts:82`. Its fields include active/session/task/phase timing, `sla`, criteria, agents, capabilities, PRD path, phase history, completion summary, loop fields, parallel-agent count, and mode.

Algorithm loop state files are stored under `MEMORY/STATE/algorithms/{sessionId}.json`. `ALGORITHMS_DIR` is set around `/home/maceo/Dev/cosmic-agent-core/v4.2.0/.claude/AAI/Tools/algorithm.ts:48`, and `readAlgorithmState()` / `writeAlgorithmState()` read and write `${sessionId}.json` around line 235. The Core memory docs describe `STATE/algorithms/` as per-session algorithm state in `/home/maceo/Dev/cosmic-agent-core/v4.2.0/.claude/AAI/MEMORYSYSTEM.md:64` and line 208.

The Algorithm runner parses PRDs directly. `readPRD()` extracts YAML-ish frontmatter and default PRD fields around `/home/maceo/Dev/cosmic-agent-core/v4.2.0/.claude/AAI/Tools/algorithm.ts:293`. `countCriteria()` parses checked and unchecked `ISC-*` checklist rows, falls back to legacy IDs, and returns total/passing/failing counts around line 364. `syncCriteriaToState()` maps criteria counts into loop state around line 398.

Loop lifecycle helpers are state-file writers. `createLoopState()` initializes an active loop state around `/home/maceo/Dev/cosmic-agent-core/v4.2.0/.claude/AAI/Tools/algorithm.ts:408`. `updateLoopStateForIteration()` refreshes active iteration state around line 445. `finalizeLoopState()` marks the state inactive, records completion time, updates phase, summary, and criteria, and closes phase history around line 458. `runLoop()` creates state/session-name entries around line 887, checks completion/blocked/max-iteration/paused/stopped conditions around line 933, and records per-iteration history around lines 1067 and 1155.

Pause, resume, and stop are PRD-frontmatter controls. `pauseLoop()` requires `loopStatus === running` and writes `paused` around `/home/maceo/Dev/cosmic-agent-core/v4.2.0/.claude/AAI/Tools/algorithm.ts:1412`. `resumeLoop()` requires `paused`, writes `running`, then calls `runLoop()` around line 1425. `stopLoop()` writes `stopped` around line 1438. `runLoop()` observes paused/stopped between iterations around line 984.

Core also has hook-driven work state. `PRDSync.hook.ts` fires on `PostToolUse` for Write/Edit and only handles `MEMORY/WORK/.../PRD.md` paths in `/home/maceo/Dev/cosmic-agent-core/v4.2.0/.claude/hooks/PRDSync.hook.ts:1` and line 32. It calls `syncToWorkJson()` with frontmatter/content/session id around line 47, then updates phase tab color on phase changes around line 61. `WORK_JSON` is `MEMORY/STATE/work.json` in `/home/maceo/Dev/cosmic-agent-core/v4.2.0/.claude/hooks/lib/prd-utils.ts:16`; `syncToWorkJson()` upserts sessions, phase history, criteria, progress, effort, mode, timestamps, and iteration around line 127.

Core domain events are typed in `/home/maceo/Dev/cosmic-agent-core/v4.2.0/.claude/hooks/lib/domain-events.ts`. The file describes the canonical domain event contract at line 1, defines base event fields around line 15, defines event interfaces for session, message, artifact, work, signal, learning, preference, context, security, voice, budget, and session profile events around lines 23-165, and exports the `DomainEvent` union around line 168.

The event bus is in `/home/maceo/Dev/cosmic-agent-core/v4.2.0/.claude/hooks/lib/event-bus.ts`. `EventBus` holds consumers, injects timestamp/runtime, catches consumer errors, and emits to all consumers around line 16. `getEventBus()` creates a singleton with `defaultRuntime = 'claude-code'` and registers JSONL plus Beads consumers around line 57. The JSONL consumer appends each event to `events.jsonl` in `/home/maceo/Dev/cosmic-agent-core/v4.2.0/.claude/hooks/lib/event-consumers.ts:23`; the Beads consumer indexes selected signal/learning/preference events and returns early for logging-only event types around line 47.

Existing Core emitters include:

- `WorkCompletionLearning` emitting `learning.captured` in `/home/maceo/Dev/cosmic-agent-core/v4.2.0/.claude/hooks/WorkCompletionLearning.hook.ts:362`.
- `SessionCleanup` emitting `work.completed` and `session.ended` in `/home/maceo/Dev/cosmic-agent-core/v4.2.0/.claude/hooks/SessionCleanup.hook.ts:223`.
- `RatingCapture` emitting `signal.captured` in `/home/maceo/Dev/cosmic-agent-core/v4.2.0/.claude/hooks/RatingCapture.hook.ts:412` and line 541.
- `BudgetCheck` emitting budget events in `/home/maceo/Dev/cosmic-agent-core/v4.2.0/.claude/hooks/BudgetCheck.hook.ts:85`.

Core workflow transition validation is in `/home/maceo/Dev/cosmic-agent-core/v4.2.0/.claude/hooks/lib/workflow-state.ts`. It defines ordered phases and stop reasons around line 23, validates same-phase/next-phase/any-to-complete/backward/skip transitions around line 54, and persists stop records to `MEMORY/STATE/stop-reason-{sessionId}.json` around line 102.

Algorithm phase semantics are documented in `/home/maceo/Dev/cosmic-agent-core/v4.2.0/.claude/AAI/Algorithm/v3.7.0.md`. PRD as system of record is documented around line 245. OBSERVE PRD stub and criteria gate behavior is documented around line 321. THINK through LEARN phase responsibilities are documented around line 489. Context recovery and PRD format are documented around line 653.

## Existing Test Coverage Around These Surfaces

The current test suite includes coverage for the surfaces above:

- Launch/header/broadcast: [`tests/generated/test_nolme_launch_binding.spec.ts:14`](../../../../tests/generated/test_nolme_launch_binding.spec.ts#L14), [`tests/generated/test_main_content_header_nolme_entry.spec.tsx:27`](../../../../tests/generated/test_main_content_header_nolme_entry.spec.tsx#L27), [`tests/generated/test_use_session_broadcast.spec.tsx:42`](../../../../tests/generated/test_use_session_broadcast.spec.tsx#L42).
- Nolme binding/hydration/provider mount: [`nolme-ui/tests/generated/test_use_ccu_session.spec.tsx:42`](../../../../nolme-ui/tests/generated/test_use_ccu_session.spec.tsx#L42), [`nolme-ui/tests/generated/test_use_hydrated_state.spec.tsx:32`](../../../../nolme-ui/tests/generated/test_use_hydrated_state.spec.tsx#L32), [`nolme-ui/tests/generated/test_nolme_app_provider.spec.tsx:90`](../../../../nolme-ui/tests/generated/test_nolme_app_provider.spec.tsx#L90).
- Projection/state: [`nolme-ui/tests/generated/ai-working/P00_nolme_state_validation.spec.ts:5`](../../../../nolme-ui/tests/generated/ai-working/P00_nolme_state_validation.spec.ts#L5), [`nolme-ui/tests/generated/ai-working/P0_projection_boundary.spec.ts:40`](../../../../nolme-ui/tests/generated/ai-working/P0_projection_boundary.spec.ts#L40), [`nolme-ui/tests/generated/ai-working/P1_merge_precedence.spec.ts:35`](../../../../nolme-ui/tests/generated/ai-working/P1_merge_precedence.spec.ts#L35), [`nolme-ui/tests/generated/ai-working/P2_phase_timeline_from_conversation.spec.ts:9`](../../../../nolme-ui/tests/generated/ai-working/P2_phase_timeline_from_conversation.spec.ts#L9), [`nolme-ui/tests/generated/ai-working/P3_deliverables_from_conversation.spec.ts:9`](../../../../nolme-ui/tests/generated/ai-working/P3_deliverables_from_conversation.spec.ts#L9).
- Questions/permissions: [`nolme-ui/tests/generated/ai-working/P12_question_projection.spec.ts:11`](../../../../nolme-ui/tests/generated/ai-working/P12_question_projection.spec.ts#L11), [`nolme-ui/tests/generated/nolme-chat/P12_question_card_surface.spec.tsx:36`](../../../../nolme-ui/tests/generated/nolme-chat/P12_question_card_surface.spec.tsx#L36), [`nolme-ui/tests/generated/nolme-chat/P13_live_question_permission_flow.spec.tsx:36`](../../../../nolme-ui/tests/generated/nolme-chat/P13_live_question_permission_flow.spec.tsx#L36), [`tests/generated/test_nolme_pending_permissions_route.spec.ts:47`](../../../../tests/generated/test_nolme_pending_permissions_route.spec.ts#L47).
- Server sidecar/connect: [`tests/generated/test_nolme_state_sidecar.spec.ts:31`](../../../../tests/generated/test_nolme_state_sidecar.spec.ts#L31), [`tests/generated/test_nolme_state_route.spec.ts:38`](../../../../tests/generated/test_nolme_state_route.spec.ts#L38), [`tests/generated/test_ccu_session_agent_hydration.spec.ts:63`](../../../../tests/generated/test_ccu_session_agent_hydration.spec.ts#L63), [`tests/generated/test_ccu_session_agent_hydration.spec.ts:125`](../../../../tests/generated/test_ccu_session_agent_hydration.spec.ts#L125).

## Existing Surface Map

| Boundary concern | Existing code surface |
| --- | --- |
| Start a provider-backed run | WebSocket command envelopes in `useChatComposerState`, `POST /api/agent`, and `CcuSessionAgent.run()` |
| Pause/resume/stop Algorithm loop | Core CLI `pauseLoop()`, `resumeLoop()`, `stopLoop()` update PRD frontmatter |
| Current UI state snapshot | `NolmeAgentState`, Nolme sidecar store, `useCoAgent()` state, `useAiWorkingProjection()` |
| Phase list and active phase | Explicit `NolmeAgentState.phases/currentPhaseIndex`; fallback `projectPhaseTimeline()` over Algorithm headers and workflow tool calls |
| Criteria progress | Core `countCriteria()` / `syncCriteriaToState()` and `work.json` PRD sync |
| Capability/skill context | Core `LoopAlgorithmState.capabilities`; Nolme `activeSkill`, skill-aware quick actions, and registration tools |
| Questions | `AskUserQuestion`, `projectAssistantQuestion()`, `AiResponseQuestionsCardBound` |
| Permissions | Claude pending permission store, `/api/nolme/pending-permissions/:sessionId`, decision POST route, Nolme polling hook |
| Artifacts/deliverables | Core artifact event types, PRD/work state, Nolme `resources`, `projectDeliverables()` |
| Runtime events | Provider `NormalizedMessage`, AG-UI translator events, Core `DomainEvent` and JSONL event bus |

