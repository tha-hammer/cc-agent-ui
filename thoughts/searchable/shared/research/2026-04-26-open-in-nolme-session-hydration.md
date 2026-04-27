---
date: 2026-04-26T09:01:56-04:00
researcher: maceo
git_commit: b53fe98a6f87adbd63c09ff8045559e5c9142e59
branch: main
repository: cc-agent-ui
topic: "When an existing chat is loaded in Nolme using the 'Open in Nolme' button, how chat history, Phases, and Deliverables populate"
tags: [research, codebase, nolme, hydration, chat-history, ai-working]
status: complete
last_updated: 2026-04-26
last_updated_by: maceo
---

# Research: Open in Nolme Session Hydration

**Date**: 2026-04-26T09:01:56-04:00
**Researcher**: maceo
**Git Commit**: `b53fe98a6f87adbd63c09ff8045559e5c9142e59`
**Branch**: `main`
**Repository**: `cc-agent-ui`

## Research Question

When an existing chat is loaded in Nolme using the "Open in Nolme" button, how do the chat history, "Phases", and "Deliverables" populate, and what parts of the current codebase are responsible for making that visible?

## Summary

The current codebase already contains a full Nolme hydration path for existing sessions.

`Open in Nolme` builds a `NolmeLaunchBinding` from the currently selected project/session and opens `/nolme/` with that binding serialized into query params. On the Nolme side, `useCcuSession()` resolves the binding from URL first, then from `localStorage('nolme-current-binding')`, then from `BroadcastChannel('ccu-session')`.

Once a binding exists, `useHydratedState()` fetches two things in parallel:

1. prior session messages from `/api/sessions/:sessionId/messages`
2. persisted Nolme sidecar state from `/api/nolme/state/:sessionId`

The Nolme app blocks on that hydration before mounting the main CopilotKit surface. The hydrated sidecar state is passed into `<CopilotKit updates={...}>`, while the same binding is forwarded into `properties.binding`. The visible prior chat history is then replayed server-side by `CcuSessionAgent.connect()`, which fetches provider history, translates each normalized message into AG-UI events, emits a `STATE_SNAPSHOT` for the sidecar state, and finishes the connect stream.

For the right rail:

- `Phases` come from explicit non-empty `state.phases` when present.
- `Deliverables` come from explicit non-empty `state.resources` when present.
- If those arrays are absent or empty, Nolme falls back to projection from the hydrated message history using `projectPhaseTimeline()` and `projectDeliverables()`.

The current implementation therefore documents this behavior:

- If session message history exists and the messages endpoint succeeds, chat history is intended to be visible in Nolme.
- If persisted phase/resource state exists, the right rail is intended to populate from that sidecar.
- If the sidecar does not contain non-empty phases/resources, Nolme can derive those panels from the conversation history instead.
- If the messages endpoint returns a non-200 response, Nolme enters its hydration error state and does not render the hydrated chat view.

## Detailed Findings

### 1. "Open in Nolme" creates the session binding

The main app's header action calls `handleOpenNolme()`, which builds a Nolme launch binding from the selected project and selected session and opens the Nolme route in a new tab:

- [`src/components/main-content/view/MainContent.tsx#L91-L95`](https://github.com/tha-hammer/agent-memory/blob/b53fe98a6f87adbd63c09ff8045559e5c9142e59/src/components/main-content/view/MainContent.tsx#L91-L95)

The binding includes:

- `provider`
- `sessionId`
- `projectName`
- `projectPath`
- optional `model`
- optional `permissionMode`
- optional `toolsSettings`

That shape and the `/nolme/?...` URL builder live here:

- [`src/utils/nolmeLaunch.ts#L9-L17`](https://github.com/tha-hammer/agent-memory/blob/b53fe98a6f87adbd63c09ff8045559e5c9142e59/src/utils/nolmeLaunch.ts#L9-L17)
- [`src/utils/nolmeLaunch.ts#L99-L137`](https://github.com/tha-hammer/agent-memory/blob/b53fe98a6f87adbd63c09ff8045559e5c9142e59/src/utils/nolmeLaunch.ts#L99-L137)

### 2. Nolme resolves the binding from URL, local storage, or broadcast

`useCcuSession()` defines the three binding sources in priority order:

1. URL query params
2. `localStorage('nolme-current-binding')`
3. `BroadcastChannel('ccu-session')`

That logic lives here:

- [`nolme-ui/src/hooks/useCcuSession.ts#L4-L17`](https://github.com/tha-hammer/agent-memory/blob/b53fe98a6f87adbd63c09ff8045559e5c9142e59/nolme-ui/src/hooks/useCcuSession.ts#L4-L17)
- [`nolme-ui/src/hooks/useCcuSession.ts#L21-L49`](https://github.com/tha-hammer/agent-memory/blob/b53fe98a6f87adbd63c09ff8045559e5c9142e59/nolme-ui/src/hooks/useCcuSession.ts#L21-L49)
- [`nolme-ui/src/hooks/useCcuSession.ts#L94-L132`](https://github.com/tha-hammer/agent-memory/blob/b53fe98a6f87adbd63c09ff8045559e5c9142e59/nolme-ui/src/hooks/useCcuSession.ts#L94-L132)

The main app also publishes that same binding into both `localStorage` and `BroadcastChannel`, which is what supports late-joining Nolme tabs:

- [`src/hooks/useSessionBroadcast.ts#L22-L29`](https://github.com/tha-hammer/agent-memory/blob/b53fe98a6f87adbd63c09ff8045559e5c9142e59/src/hooks/useSessionBroadcast.ts#L22-L29)
- [`src/hooks/useSessionBroadcast.ts#L36-L69`](https://github.com/tha-hammer/agent-memory/blob/b53fe98a6f87adbd63c09ff8045559e5c9142e59/src/hooks/useSessionBroadcast.ts#L36-L69)

### 3. Nolme hydrates messages and sidecar state before rendering the main surface

`useHydratedState()` is the client bootstrap for existing sessions. It builds:

- `/api/sessions/:sessionId/messages?...`
- `/api/nolme/state/:sessionId?...`

and requests them in parallel:

- [`nolme-ui/src/hooks/useHydratedState.ts#L31-L47`](https://github.com/tha-hammer/agent-memory/blob/b53fe98a6f87adbd63c09ff8045559e5c9142e59/nolme-ui/src/hooks/useHydratedState.ts#L31-L47)
- [`nolme-ui/src/hooks/useHydratedState.ts#L49-L93`](https://github.com/tha-hammer/agent-memory/blob/b53fe98a6f87adbd63c09ff8045559e5c9142e59/nolme-ui/src/hooks/useHydratedState.ts#L49-L93)

Important behavior from this hook:

- messages are required for success; a non-OK messages response throws an error
- sidecar state is optional; if the state response is non-OK, Nolme keeps `DEFAULT_NOLME_AGENT_STATE`
- successful hydration sets `{ status: 'ready', messages, state }`

This is also locked by tests:

- [`nolme-ui/tests/generated/test_use_hydrated_state.spec.tsx#L32-L62`](https://github.com/tha-hammer/agent-memory/blob/b53fe98a6f87adbd63c09ff8045559e5c9142e59/nolme-ui/tests/generated/test_use_hydrated_state.spec.tsx#L32-L62)
- [`nolme-ui/tests/generated/test_use_hydrated_state.spec.tsx#L84-L94`](https://github.com/tha-hammer/agent-memory/blob/b53fe98a6f87adbd63c09ff8045559e5c9142e59/nolme-ui/tests/generated/test_use_hydrated_state.spec.tsx#L84-L94)
- [`nolme-ui/tests/generated/test_use_hydrated_state.spec.tsx#L113-L123`](https://github.com/tha-hammer/agent-memory/blob/b53fe98a6f87adbd63c09ff8045559e5c9142e59/nolme-ui/tests/generated/test_use_hydrated_state.spec.tsx#L113-L123)

### 4. NolmeApp gates rendering on hydration readiness

`NolmeApp` does not render the CopilotKit-backed dashboard until both a binding exists and hydration has reached `ready`. Before that it renders one of:

- `NoSessionPlaceholder`
- `HydrationSkeleton`
- `HydrationErrorPlaceholder`

Once ready, it mounts `<CopilotKit>` with:

- `threadId={binding.sessionId}`
- `updates={hydration.state}`
- `properties={{ binding }}`

Code:

- [`nolme-ui/src/NolmeApp.tsx#L109-L141`](https://github.com/tha-hammer/agent-memory/blob/b53fe98a6f87adbd63c09ff8045559e5c9142e59/nolme-ui/src/NolmeApp.tsx#L109-L141)

Test coverage:

- [`nolme-ui/tests/generated/nolme-chat/J1_hydration_replay.spec.tsx#L67-L94`](https://github.com/tha-hammer/agent-memory/blob/b53fe98a6f87adbd63c09ff8045559e5c9142e59/nolme-ui/tests/generated/nolme-chat/J1_hydration_replay.spec.tsx#L67-L94)

That J1 test explicitly documents that hydrated messages reach the runtime through the same forwarded binding, and that `connect()` is the server-side replay mechanism rather than a direct chat prop.

### 5. Visible chat history is replayed by the CopilotKit connect path

The Nolme chat surface is a `CopilotChat` bound to the session thread id:

- [`nolme-ui/src/components/NolmeChat.tsx#L22-L44`](https://github.com/tha-hammer/agent-memory/blob/b53fe98a6f87adbd63c09ff8045559e5c9142e59/nolme-ui/src/components/NolmeChat.tsx#L22-L44)

The server-side replay happens in `CcuSessionAgent.connect()`:

- it reads `forwardedProps.binding`
- it resolves the provider adapter
- it calls `adapter.fetchHistory(binding.sessionId, { projectName, projectPath, limit: null, offset: 0 })`
- it translates each normalized message into AG-UI events
- it emits `STATE_SNAPSHOT` with the persisted Nolme state
- it emits `RUN_FINISHED`

Code:

- [`server/agents/ccu-session-agent.js#L291-L344`](https://github.com/tha-hammer/agent-memory/blob/b53fe98a6f87adbd63c09ff8045559e5c9142e59/server/agents/ccu-session-agent.js#L291-L344)

Tests:

- [`tests/generated/test_ccu_session_agent_hydration.spec.ts#L90-L145`](https://github.com/tha-hammer/agent-memory/blob/b53fe98a6f87adbd63c09ff8045559e5c9142e59/tests/generated/test_ccu_session_agent_hydration.spec.ts#L90-L145)
- [`tests/generated/test_ccu_session_agent_hydration.spec.ts#L147-L163`](https://github.com/tha-hammer/agent-memory/blob/b53fe98a6f87adbd63c09ff8045559e5c9142e59/tests/generated/test_ccu_session_agent_hydration.spec.ts#L147-L163)
- [`tests/generated/test_ccu_session_agent_hydration.spec.ts#L203-L228`](https://github.com/tha-hammer/agent-memory/blob/b53fe98a6f87adbd63c09ff8045559e5c9142e59/tests/generated/test_ccu_session_agent_hydration.spec.ts#L203-L228)

The message history source behind that unified replay path is provider-specific:

- registry: [`server/providers/registry.js#L10-L44`](https://github.com/tha-hammer/agent-memory/blob/b53fe98a6f87adbd63c09ff8045559e5c9142e59/server/providers/registry.js#L10-L44)
- Claude JSONL: [`server/providers/claude/adapter.js#L213-L282`](https://github.com/tha-hammer/agent-memory/blob/b53fe98a6f87adbd63c09ff8045559e5c9142e59/server/providers/claude/adapter.js#L213-L282)
- Codex JSONL: [`server/providers/codex/adapter.js#L203-L247`](https://github.com/tha-hammer/agent-memory/blob/b53fe98a6f87adbd63c09ff8045559e5c9142e59/server/providers/codex/adapter.js#L203-L247)
- Cursor SQLite: [`server/providers/cursor/adapter.js#L163-L195`](https://github.com/tha-hammer/agent-memory/blob/b53fe98a6f87adbd63c09ff8045559e5c9142e59/server/providers/cursor/adapter.js#L163-L195)
- Gemini in-memory/CLI fallback: [`server/providers/gemini/adapter.js#L85-L150`](https://github.com/tha-hammer/agent-memory/blob/b53fe98a6f87adbd63c09ff8045559e5c9142e59/server/providers/gemini/adapter.js#L85-L150)

### 6. The persisted Nolme sidecar backs Phases and Deliverables when explicit data exists

The Nolme state route returns the per-session sidecar:

- [`server/routes/nolme-state.js#L23-L43`](https://github.com/tha-hammer/agent-memory/blob/b53fe98a6f87adbd63c09ff8045559e5c9142e59/server/routes/nolme-state.js#L23-L43)

That sidecar is read from:

- `~/.claude/projects/<encoded-project-path>/<sessionId>.nolme-state.json`

with tolerant read behavior that falls back to defaults on missing file, malformed JSON, or wrong schema version:

- [`server/agents/nolme-state-store.js#L4-L25`](https://github.com/tha-hammer/agent-memory/blob/b53fe98a6f87adbd63c09ff8045559e5c9142e59/server/agents/nolme-state-store.js#L4-L25)
- [`server/agents/nolme-state-store.js#L55-L70`](https://github.com/tha-hammer/agent-memory/blob/b53fe98a6f87adbd63c09ff8045559e5c9142e59/server/agents/nolme-state-store.js#L55-L70)
- [`server/agents/nolme-state-store.js#L97-L119`](https://github.com/tha-hammer/agent-memory/blob/b53fe98a6f87adbd63c09ff8045559e5c9142e59/server/agents/nolme-state-store.js#L97-L119)

The state shape includes:

- `phases`
- `currentPhaseIndex`
- `currentReviewLine`
- `resources`
- `profile`
- `quickActions`
- `taskNotifications`

The right-rail UI wiring is:

- dashboard layout: [`nolme-ui/src/components/NolmeDashboard.v2.tsx#L7-L28`](https://github.com/tha-hammer/agent-memory/blob/b53fe98a6f87adbd63c09ff8045559e5c9142e59/nolme-ui/src/components/NolmeDashboard.v2.tsx#L7-L28)
- phases binding: [`nolme-ui/src/components/bindings/WorkflowPhaseBarBound.v2.tsx#L4-L12`](https://github.com/tha-hammer/agent-memory/blob/b53fe98a6f87adbd63c09ff8045559e5c9142e59/nolme-ui/src/components/bindings/WorkflowPhaseBarBound.v2.tsx#L4-L12)
- deliverables binding: [`nolme-ui/src/components/bindings/DeliverablesRailBound.v2.tsx#L11-L19`](https://github.com/tha-hammer/agent-memory/blob/b53fe98a6f87adbd63c09ff8045559e5c9142e59/nolme-ui/src/components/bindings/DeliverablesRailBound.v2.tsx#L11-L19)

### 7. If explicit phases/resources are empty, Nolme projects them from message history

The projection layer normalizes hydrated state, then combines it with hydrated messages and live `useCoAgent()` state:

- [`nolme-ui/src/hooks/useAiWorkingProjection.ts#L19-L63`](https://github.com/tha-hammer/agent-memory/blob/b53fe98a6f87adbd63c09ff8045559e5c9142e59/nolme-ui/src/hooks/useAiWorkingProjection.ts#L19-L63)

`normalizeNolmeState()` records whether phases/resources/quickActions were explicit and non-empty:

- [`nolme-ui/src/lib/ai-working/normalizeNolmeState.ts#L158-L213`](https://github.com/tha-hammer/agent-memory/blob/b53fe98a6f87adbd63c09ff8045559e5c9142e59/nolme-ui/src/lib/ai-working/normalizeNolmeState.ts#L158-L213)

`projectAiWorkingProjection()` uses that explicitness to choose between sidecar data and conversation-derived fallbacks:

- phases use sidecar only when `explicit.phases === true`
- deliverables use sidecar only when `explicit.resources === true`

Code:

- [`nolme-ui/src/lib/ai-working/projectAiWorkingProjection.ts#L117-L160`](https://github.com/tha-hammer/agent-memory/blob/b53fe98a6f87adbd63c09ff8045559e5c9142e59/nolme-ui/src/lib/ai-working/projectAiWorkingProjection.ts#L117-L160)

The fallback sources are:

- `projectPhaseTimeline(messages)`
- `projectDeliverables(messages)`

This means an existing chat can still show phases and deliverables even when the sidecar is empty, so long as the conversation history contains enough signal for those projections.

### 8. Conversation-derived phases and deliverables are already covered by tests

Conversation-derived phase timeline tests:

- [`nolme-ui/tests/generated/ai-working/P2_phase_timeline_from_conversation.spec.ts`](https://github.com/tha-hammer/agent-memory/blob/b53fe98a6f87adbd63c09ff8045559e5c9142e59/nolme-ui/tests/generated/ai-working/P2_phase_timeline_from_conversation.spec.ts)

Conversation-derived deliverables tests:

- [`nolme-ui/tests/generated/ai-working/P3_deliverables_from_conversation.spec.ts`](https://github.com/tha-hammer/agent-memory/blob/b53fe98a6f87adbd63c09ff8045559e5c9142e59/nolme-ui/tests/generated/ai-working/P3_deliverables_from_conversation.spec.ts)

Hydrated projection bridge test:

- [`nolme-ui/tests/generated/ai-working/P00_hydration_bridge.spec.tsx#L64-L97`](https://github.com/tha-hammer/agent-memory/blob/b53fe98a6f87adbd63c09ff8045559e5c9142e59/nolme-ui/tests/generated/ai-working/P00_hydration_bridge.spec.tsx#L64-L97)

Hydrated right-rail rendering from persisted state:

- [`nolme-ui/tests/generated/nolme-chat/P8_hydrated_ai_working_view.spec.tsx#L45-L122`](https://github.com/tha-hammer/agent-memory/blob/b53fe98a6f87adbd63c09ff8045559e5c9142e59/nolme-ui/tests/generated/nolme-chat/P8_hydrated_ai_working_view.spec.tsx#L45-L122)

Hydrated right-rail rendering from example session messages:

- [`nolme-ui/tests/generated/ai-working/P10_example_session_regression.spec.tsx#L74-L109`](https://github.com/tha-hammer/agent-memory/blob/b53fe98a6f87adbd63c09ff8045559e5c9142e59/nolme-ui/tests/generated/ai-working/P10_example_session_regression.spec.tsx#L74-L109)

## Code References

- `src/components/main-content/view/MainContent.tsx:91-95` - the UI action that opens Nolme for the selected session
- `src/utils/nolmeLaunch.ts:99-137` - serialized launch binding and `/nolme/?...` URL generation
- `src/hooks/useSessionBroadcast.ts:36-69` - localStorage and BroadcastChannel write-through for the active binding
- `nolme-ui/src/hooks/useCcuSession.ts:21-49` - initial Nolme binding resolution order
- `nolme-ui/src/hooks/useHydratedState.ts:63-89` - parallel fetch of chat history and sidecar state
- `nolme-ui/src/NolmeApp.tsx:115-140` - hydration gate and CopilotKit mount
- `server/routes/messages.js:29-58` - unified messages endpoint
- `server/agents/ccu-session-agent.js:314-337` - server-side connect replay and `STATE_SNAPSHOT`
- `server/routes/nolme-state.js:23-43` - Nolme sidecar read route
- `server/agents/nolme-state-store.js:97-119` - tolerant sidecar read semantics
- `nolme-ui/src/lib/ai-working/projectAiWorkingProjection.ts:124-143` - explicit state vs. message-derived fallback selection

## Architecture Documentation

The current Nolme session-load path is a two-channel hydration model:

1. Chat history channel
   Loaded from the provider-backed unified messages endpoint and replayed through the CopilotKit connect stream.

2. Ai-working state channel
   Loaded from the Nolme sidecar and surfaced as `STATE_SNAPSHOT` plus `updates={hydration.state}`.

The two channels meet in `useAiWorkingProjection()`, which merges:

- hydrated messages
- hydrated sidecar state
- live co-agent state
- active skill context

That merged view model is what drives:

- the `Phases` bar
- the `Deliverables` rail
- quick actions
- profile/usage cards

This architecture means chat history and right-rail state are related but not identical data sources.

## Historical Context (from thoughts/)

No `thoughts/` directory exists in this checkout, so there was no repository-local historical research corpus to read for this topic.

One code comment in `server/providers/claude/adapter.js` references `thoughts/searchable/shared/research/2026-04-16-session-handling-audit.md`, but that path is not present in the current working tree.

## Related Research

No prior repository-local research documents were found in this checkout.

## Beads Context

`bd list --status=open` returned no open beads issues related to this topic at research time.

## Open Questions

- This research pass documented the implemented codepath and the generated tests in this repository. It did not run the Nolme UI against a live existing session to capture runtime behavior outside those codepaths.
- The repo-local resumption command from `AGENTS.md`, `zettel recall --status in_progress -l 10 -d connected`, was attempted twice but failed in this shell with `curl: (56) Recv failure: Connection reset by peer`.
