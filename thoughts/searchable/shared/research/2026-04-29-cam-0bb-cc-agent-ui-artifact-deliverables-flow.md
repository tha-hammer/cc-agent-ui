---
date: 2026-04-29T13:00:59-04:00
researcher: Codex
git_commit: 5a94cdfc4916185d61d6cb019e3600e704a64adc
branch: main
repository: cosmic-agent-memory
topic: "How cc-agent-ui middleware stores agent artifacts and feeds the /app Deliverables pane"
tags: [research, codebase, cc-agent-ui, algorithm-runs, deliverables, nolme, sessions, middleware]
status: complete
last_updated: 2026-04-29
last_updated_by: Codex
related_beads: [cam-0bb]
session_url: "http://localhost:3001/session/d75f31dc-0e96-4267-aa35-ff7c68f86cdd"
---

# Research: cc-agent-ui Artifact and Deliverables Flow

**Date**: 2026-04-29T13:00:59-04:00  
**Researcher**: Codex  
**Git Commit**: `5a94cdfc4916185d61d6cb019e3600e704a64adc`  
**Branch**: `main`  
**Repository**: `cosmic-agent-memory`

## Research Question

How does the current `cc-agent-ui` middleware save agent artifacts, task transcript outputs, and tool result data so the `/app` route Deliverables pane can be populated from existing code paths? The concrete session provided for inspection was:

```text
http://localhost:3001/session/d75f31dc-0e96-4267-aa35-ff7c68f86cdd
```

## Summary

The current codebase has three distinct artifact-adjacent storage and projection paths:

1. **Provider transcript history**: Claude session history is read from `~/.claude/projects/<projectName>/*.jsonl`, normalized through the Claude provider adapter, and rendered by `/session/:sessionId`. Tool results are attached to matching tool calls for transcript display.
2. **Nolme sidecar state**: CopilotKit/Nolme state can store `resources` and `taskNotifications` in a per-session sidecar file at `~/.claude/projects/<projectName-or-encoded-path>/<sessionId>.nolme-state.json`.
3. **Algorithm Run state**: `/api/algorithm-runs` stores event-sourced run state under `~/.cosmic-agent/algorithm-runs/<runId>`. Its public state includes `deliverables` and `finalOutput`, which are the fields consumed by the current `/app` route.

The current `/app` Deliverables pane reads only `runState?.deliverables ?? []`. It does not read Claude transcript text, Claude `tool_result` content, Nolme sidecar `resources`, or `finalOutput` for that pane. `finalOutput` is rendered separately in the chat stream as an artifact card.

The inspected session shows task output present in transcript storage as a task notification/user text payload and as assistant report text. That output is not currently represented as Algorithm Run `deliverables` unless an Algorithm Run event updates `state.deliverables`.

## Observed Session Evidence

The user-provided session id is present in both Claude project history and the task output transcript:

| Path | Observed contents |
| --- | --- |
| `/tmp/claude-1000/-home-maceo/tasks/a0aeebb180e087ed4.output` | 44 JSONL lines, all with `sessionId: d75f31dc-0e96-4267-aa35-ff7c68f86cdd`, `isSidechain: true`, and `agentId: a0aeebb180e087ed4`. The final assistant line contains the market report text. |
| `/home/maceo/.claude/projects/-home-maceo/d75f31dc-0e96-4267-aa35-ff7c68f86cdd.jsonl` | 208 JSONL lines for the main session. Line 68 records the async agent launch as a `tool_result`. Line 83 records a `queue-operation` with a `<task-notification>` payload. Line 127 records the same task-notification payload as a `type: "user"` message with string content. Line 208 is assistant report text. |
| `/home/maceo/.claude/projects/-home-maceo/466a099d-0bf9-468a-b8d4-5735752bb8b0.jsonl` | A separate 6-line Claude session containing the completed task output as queue/user prompt text. |

The task-notification payload shape observed in the main session includes:

```xml
<task-notification>
  <task-id>a0aeebb180e087ed4</task-id>
  <tool-use-id>toolu_0177kN7BV3HhND6nRhjpfKnz</tool-use-id>
  <status>completed</status>
  <summary>Agent "Competitive landscape and major players research" completed</summary>
  <result>...</result>
</task-notification>
```

That shape is stored as transcript text in the Claude project JSONL. It is not an Algorithm Run deliverable event by itself.

## Detailed Findings

### 1. Unified Session History and Claude Transcript Normalization

The shared provider message vocabulary includes `text`, `tool_use`, `tool_result`, `thinking`, stream/control messages, permissions, interactive prompts, and `task_notification` ([`server/providers/types.js:19`](https://github.com/tha-hammer/agent-memory/blob/5a94cdfc4916185d61d6cb019e3600e704a64adc/cc-agent-ui/server/providers/types.js#L19)). The same type list is mirrored on the frontend session store ([`src/stores/useSessionStore.ts:16`](https://github.com/tha-hammer/agent-memory/blob/5a94cdfc4916185d61d6cb019e3600e704a64adc/cc-agent-ui/src/stores/useSessionStore.ts#L16)).

`GET /api/sessions/:sessionId/messages` is the unified history endpoint. It reads `provider`, `projectName`, `projectPath`, `limit`, and `offset`, resolves the provider adapter, and delegates to `adapter.fetchHistory()` ([`server/routes/messages.js:29`](https://github.com/tha-hammer/agent-memory/blob/5a94cdfc4916185d61d6cb019e3600e704a64adc/cc-agent-ui/server/routes/messages.js#L29)).

Claude history is loaded from `~/.claude/projects/<projectName>`. `getSessionMessages()` excludes `agent-*.jsonl` from primary history, filters lines by exact `entry.sessionId === sessionId`, then attaches subagent tools from `agent-<agentId>.jsonl` when `toolUseResult.agentId` is present ([`server/projects.js:996`](https://github.com/tha-hammer/agent-memory/blob/5a94cdfc4916185d61d6cb019e3600e704a64adc/cc-agent-ui/server/projects.js#L996), [`server/projects.js:1037`](https://github.com/tha-hammer/agent-memory/blob/5a94cdfc4916185d61d6cb019e3600e704a64adc/cc-agent-ui/server/projects.js#L1037), [`server/projects.js:1055`](https://github.com/tha-hammer/agent-memory/blob/5a94cdfc4916185d61d6cb019e3600e704a64adc/cc-agent-ui/server/projects.js#L1055)).

The Claude adapter normalizes user `tool_result` parts into `kind: "tool_result"` and preserves `toolUseResult` and `subagentTools` where present ([`server/providers/claude/adapter.js:37`](https://github.com/tha-hammer/agent-memory/blob/5a94cdfc4916185d61d6cb019e3600e704a64adc/cc-agent-ui/server/providers/claude/adapter.js#L37)). User string content becomes `kind: "text"` with `role: "user"` ([`server/providers/claude/adapter.js:90`](https://github.com/tha-hammer/agent-memory/blob/5a94cdfc4916185d61d6cb019e3600e704a64adc/cc-agent-ui/server/providers/claude/adapter.js#L90)).

The adapter also performs a two-pass tool result attachment: it first collects user `tool_result` parts by `tool_use_id`, then attaches the matching result onto normalized assistant `tool_use` messages ([`server/providers/claude/adapter.js:232`](https://github.com/tha-hammer/agent-memory/blob/5a94cdfc4916185d61d6cb019e3600e704a64adc/cc-agent-ui/server/providers/claude/adapter.js#L232), [`server/providers/claude/adapter.js:262`](https://github.com/tha-hammer/agent-memory/blob/5a94cdfc4916185d61d6cb019e3600e704a64adc/cc-agent-ui/server/providers/claude/adapter.js#L262)).

On the frontend, `useSessionStore.fetchFromServer()` calls the unified endpoint and stores normalized server messages for rendering ([`src/stores/useSessionStore.ts:169`](https://github.com/tha-hammer/agent-memory/blob/5a94cdfc4916185d61d6cb019e3600e704a64adc/cc-agent-ui/src/stores/useSessionStore.ts#L169)). `getMessages()` returns merged server and realtime messages ([`src/stores/useSessionStore.ts:420`](https://github.com/tha-hammer/agent-memory/blob/5a94cdfc4916185d61d6cb019e3600e704a64adc/cc-agent-ui/src/stores/useSessionStore.ts#L420)).

### 2. `/session/:id` Transcript Rendering

`/session/:sessionId` renders the normal `AppContent` chat surface, not the `/app` route. The chat path converts normalized messages in `normalizedToChatMessages()`.

For `tool_use`, the frontend reads the attached `toolResult`, marks the message as a tool call, and supplies `toolName`, `toolInput`, `toolId`, `toolResult`, and subagent state to the chat renderer ([`src/components/chat/hooks/useChatMessages.ts:68`](https://github.com/tha-hammer/agent-memory/blob/5a94cdfc4916185d61d6cb019e3600e704a64adc/cc-agent-ui/src/components/chat/hooks/useChatMessages.ts#L68)). Standalone `tool_result` messages are skipped as separate chat items because they are attached to the tool call ([`src/components/chat/hooks/useChatMessages.ts:175`](https://github.com/tha-hammer/agent-memory/blob/5a94cdfc4916185d61d6cb019e3600e704a64adc/cc-agent-ui/src/components/chat/hooks/useChatMessages.ts#L175)).

For user text, the chat mapper contains a legacy task notification parser. The parser expects exactly a `<task-notification>` with `<task-id>`, `<output-file>`, `<status>`, and `<summary>` tags, then renders a compact assistant notification ([`src/components/chat/hooks/useChatMessages.ts:34`](https://github.com/tha-hammer/agent-memory/blob/5a94cdfc4916185d61d6cb019e3600e704a64adc/cc-agent-ui/src/components/chat/hooks/useChatMessages.ts#L34)). The observed task notification text in this session uses `<tool-use-id>` and `<result>` fields, so by current mapping it follows the generic user-text branch ([`src/components/chat/hooks/useChatMessages.ts:47`](https://github.com/tha-hammer/agent-memory/blob/5a94cdfc4916185d61d6cb019e3600e704a64adc/cc-agent-ui/src/components/chat/hooks/useChatMessages.ts#L47)).

`MessageComponent` renders task notifications as compact left-side rows when `isTaskNotification` is set ([`src/components/chat/view/subcomponents/MessageComponent.tsx:154`](https://github.com/tha-hammer/agent-memory/blob/5a94cdfc4916185d61d6cb019e3600e704a64adc/cc-agent-ui/src/components/chat/view/subcomponents/MessageComponent.tsx#L154)). It renders tool calls through `ToolRenderer`, passing both input and attached result data ([`src/components/chat/view/subcomponents/MessageComponent.tsx:188`](https://github.com/tha-hammer/agent-memory/blob/5a94cdfc4916185d61d6cb019e3600e704a64adc/cc-agent-ui/src/components/chat/view/subcomponents/MessageComponent.tsx#L188)).

This transcript rendering path does not populate the `/app` right-panel Deliverables list. It is a separate chat-session surface.

### 3. Nolme Sidecar State and AG-UI Events

The existing Nolme sidecar store persists per-session state at `~/.claude/projects/<encoded-project-path>/<sessionId>.nolme-state.json`. The documented schema includes `phases`, `currentPhaseIndex`, `currentReviewLine`, `resources`, `profile`, `quickActions`, and `taskNotifications` ([`server/agents/nolme-state-store.js:1`](https://github.com/tha-hammer/agent-memory/blob/5a94cdfc4916185d61d6cb019e3600e704a64adc/cc-agent-ui/server/agents/nolme-state-store.js#L1)). Defaults include empty `resources` and `taskNotifications` arrays ([`server/agents/nolme-state-store.js:36`](https://github.com/tha-hammer/agent-memory/blob/5a94cdfc4916185d61d6cb019e3600e704a64adc/cc-agent-ui/server/agents/nolme-state-store.js#L36)). `readState()` returns default state when the file is missing, malformed, or wrong-versioned ([`server/agents/nolme-state-store.js:97`](https://github.com/tha-hammer/agent-memory/blob/5a94cdfc4916185d61d6cb019e3600e704a64adc/cc-agent-ui/server/agents/nolme-state-store.js#L97)).

`CcuSessionAgent.connect()` is the existing CopilotKit hydration path. It fetches provider history, translates each normalized message into AG-UI events, reads the Nolme sidecar, and emits a `STATE_SNAPSHOT` ([`server/agents/ccu-session-agent.js:291`](https://github.com/tha-hammer/agent-memory/blob/5a94cdfc4916185d61d6cb019e3600e704a64adc/cc-agent-ui/server/agents/ccu-session-agent.js#L291), [`server/agents/ccu-session-agent.js:314`](https://github.com/tha-hammer/agent-memory/blob/5a94cdfc4916185d61d6cb019e3600e704a64adc/cc-agent-ui/server/agents/ccu-session-agent.js#L314), [`server/agents/ccu-session-agent.js:334`](https://github.com/tha-hammer/agent-memory/blob/5a94cdfc4916185d61d6cb019e3600e704a64adc/cc-agent-ui/server/agents/ccu-session-agent.js#L334)).

`CcuSessionAgent.run()` translates live provider frames into AG-UI events. In the current implementation, the explicit sidecar write inside that path persists token budget data from `status` frames ([`server/agents/ccu-session-agent.js:193`](https://github.com/tha-hammer/agent-memory/blob/5a94cdfc4916185d61d6cb019e3600e704a64adc/cc-agent-ui/server/agents/ccu-session-agent.js#L193)). Other translated events are emitted downstream by `translate()` ([`server/agents/ccu-session-agent.js:219`](https://github.com/tha-hammer/agent-memory/blob/5a94cdfc4916185d61d6cb019e3600e704a64adc/cc-agent-ui/server/agents/ccu-session-agent.js#L219)).

The AG-UI translator maps normalized `task_notification` frames to a `STATE_DELTA` append at `/taskNotifications/-` ([`server/agents/ag-ui-event-translator.js:215`](https://github.com/tha-hammer/agent-memory/blob/5a94cdfc4916185d61d6cb019e3600e704a64adc/cc-agent-ui/server/agents/ag-ui-event-translator.js#L215)). It also maps `status` frames to `STATE_DELTA` updates for `/statusText` and optional `/tokenBudget` ([`server/agents/ag-ui-event-translator.js:172`](https://github.com/tha-hammer/agent-memory/blob/5a94cdfc4916185d61d6cb019e3600e704a64adc/cc-agent-ui/server/agents/ag-ui-event-translator.js#L172)).

The existing workflow phase tool schema includes an `addResource` tool, whose parameters match a right-rail resource card shape: `badge`, `title`, `subtitle`, `tone`, `action`, optional `url`, and optional `id` ([`server/tools/workflow-phase-tools.js:80`](https://github.com/tha-hammer/agent-memory/blob/5a94cdfc4916185d61d6cb019e3600e704a64adc/cc-agent-ui/server/tools/workflow-phase-tools.js#L80)). That schema describes Nolme-side `resources`, not the current `/app` `runState.deliverables` array.

### 4. Algorithm Run Store and Deliverables Projection

`/api/algorithm-runs` is mounted as a protected server route and exposes run start, state, events, lifecycle, question, and permission endpoints. `GET /api/algorithm-runs/:runId/state` returns `{ runId, state }` from `readAlgorithmRunState()` ([`server/routes/algorithm-runs.js:166`](https://github.com/tha-hammer/agent-memory/blob/5a94cdfc4916185d61d6cb019e3600e704a64adc/cc-agent-ui/server/routes/algorithm-runs.js#L166)). The events endpoint streams via SSE when `stream=1` ([`server/routes/algorithm-runs.js:178`](https://github.com/tha-hammer/agent-memory/blob/5a94cdfc4916185d61d6cb019e3600e704a64adc/cc-agent-ui/server/routes/algorithm-runs.js#L178)).

Algorithm Run files live under `ALGORITHM_RUN_STORE_ROOT` or `~/.cosmic-agent/algorithm-runs/<runId>`, with `metadata.json`, `state.json`, and `events.jsonl` paths defined by the run store ([`server/algorithm-runs/run-store.js:19`](https://github.com/tha-hammer/agent-memory/blob/5a94cdfc4916185d61d6cb019e3600e704a64adc/cc-agent-ui/server/algorithm-runs/run-store.js#L19)).

The public Algorithm state initializes `phases: []`, `deliverables: []`, and `finalOutput: null` ([`server/algorithm-runs/run-store.js:76`](https://github.com/tha-hammer/agent-memory/blob/5a94cdfc4916185d61d6cb019e3600e704a64adc/cc-agent-ui/server/algorithm-runs/run-store.js#L76)). The contracts list includes `algorithm.deliverables.updated` and `algorithm.output.updated` event types ([`server/algorithm-runs/contracts.js:22`](https://github.com/tha-hammer/agent-memory/blob/5a94cdfc4916185d61d6cb019e3600e704a64adc/cc-agent-ui/server/algorithm-runs/contracts.js#L22)).

Deliverables are normalized from objects with `title`, `name`, `path`, or `url`, plus optional `badge`, `subtitle`, `description`, `kind`, `tone`, `action`, `url`, and `createdAt` fields ([`server/algorithm-runs/run-store.js:130`](https://github.com/tha-hammer/agent-memory/blob/5a94cdfc4916185d61d6cb019e3600e704a64adc/cc-agent-ui/server/algorithm-runs/run-store.js#L130)). Output is normalized separately as `{ title, body, url }` ([`server/algorithm-runs/run-store.js:152`](https://github.com/tha-hammer/agent-memory/blob/5a94cdfc4916185d61d6cb019e3600e704a64adc/cc-agent-ui/server/algorithm-runs/run-store.js#L152)).

When Algorithm events are projected, `algorithm.deliverables.updated` replaces `state.deliverables`, accepting `payload.deliverables`, `payload.resources`, or `payload.artifacts`. `algorithm.output.updated` assigns `state.finalOutput` ([`server/algorithm-runs/run-store.js:287`](https://github.com/tha-hammer/agent-memory/blob/5a94cdfc4916185d61d6cb019e3600e704a64adc/cc-agent-ui/server/algorithm-runs/run-store.js#L287)).

Runner `state` frames that include `deliverables`, `resources`, or `artifacts` arrays are persisted as `algorithm.deliverables.updated` events ([`server/algorithm-runs/run-store.js:581`](https://github.com/tha-hammer/agent-memory/blob/5a94cdfc4916185d61d6cb019e3600e704a64adc/cc-agent-ui/server/algorithm-runs/run-store.js#L581)). Runner `state` frames with `finalOutput`, `output`, or `summary` become `algorithm.output.updated` events ([`server/algorithm-runs/run-store.js:589`](https://github.com/tha-hammer/agent-memory/blob/5a94cdfc4916185d61d6cb019e3600e704a64adc/cc-agent-ui/server/algorithm-runs/run-store.js#L589)). Terminal `result` frames with `output` or `summary` also append `algorithm.output.updated` ([`server/algorithm-runs/run-store.js:625`](https://github.com/tha-hammer/agent-memory/blob/5a94cdfc4916185d61d6cb019e3600e704a64adc/cc-agent-ui/server/algorithm-runs/run-store.js#L625)).

### 5. `/app` Route Consumption of Deliverables

The `/app` route's local `AlgorithmRunState` type includes `phases`, `deliverables`, and `finalOutput` fields ([`src/components/nolme-app/view/NolmeAppRoute.tsx:104`](https://github.com/tha-hammer/agent-memory/blob/5a94cdfc4916185d61d6cb019e3600e704a64adc/cc-agent-ui/src/components/nolme-app/view/NolmeAppRoute.tsx#L104)).

The route derives `activeRunId` from `?runId=` or `localStorage["nolme-active-algorithm-run-id"]` ([`src/components/nolme-app/view/NolmeAppRoute.tsx:160`](https://github.com/tha-hammer/agent-memory/blob/5a94cdfc4916185d61d6cb019e3600e704a64adc/cc-agent-ui/src/components/nolme-app/view/NolmeAppRoute.tsx#L160)). `loadRunState()` calls `api.algorithmRunState(runId)` and stores `body.state` in local `runState` ([`src/components/nolme-app/view/NolmeAppRoute.tsx:385`](https://github.com/tha-hammer/agent-memory/blob/5a94cdfc4916185d61d6cb019e3600e704a64adc/cc-agent-ui/src/components/nolme-app/view/NolmeAppRoute.tsx#L385), [`src/components/nolme-app/view/NolmeAppRoute.tsx:393`](https://github.com/tha-hammer/agent-memory/blob/5a94cdfc4916185d61d6cb019e3600e704a64adc/cc-agent-ui/src/components/nolme-app/view/NolmeAppRoute.tsx#L393)). The API helper maps this to `GET /api/algorithm-runs/:runId/state` ([`src/utils/api.js:109`](https://github.com/tha-hammer/agent-memory/blob/5a94cdfc4916185d61d6cb019e3600e704a64adc/cc-agent-ui/src/utils/api.js#L109)).

The route opens an `EventSource` for `/api/algorithm-runs/:runId/events?...&stream=1`; each `algorithm.event` causes a fresh `loadRunState()` ([`src/components/nolme-app/view/NolmeAppRoute.tsx:600`](https://github.com/tha-hammer/agent-memory/blob/5a94cdfc4916185d61d6cb019e3600e704a64adc/cc-agent-ui/src/components/nolme-app/view/NolmeAppRoute.tsx#L600), [`src/components/nolme-app/view/NolmeAppRoute.tsx:611`](https://github.com/tha-hammer/agent-memory/blob/5a94cdfc4916185d61d6cb019e3600e704a64adc/cc-agent-ui/src/components/nolme-app/view/NolmeAppRoute.tsx#L611)).

The right panel is rendered as `<RightPanel runState={rightPanelRunState} />` ([`src/components/nolme-app/view/NolmeAppRoute.tsx:947`](https://github.com/tha-hammer/agent-memory/blob/5a94cdfc4916185d61d6cb019e3600e704a64adc/cc-agent-ui/src/components/nolme-app/view/NolmeAppRoute.tsx#L947)). Inside `RightPanel`, deliverables are read only from `runState?.deliverables ?? []` and rendered through `DeliverableRow` ([`src/components/nolme-app/view/NolmeAppRoute.tsx:1726`](https://github.com/tha-hammer/agent-memory/blob/5a94cdfc4916185d61d6cb019e3600e704a64adc/cc-agent-ui/src/components/nolme-app/view/NolmeAppRoute.tsx#L1726), [`src/components/nolme-app/view/NolmeAppRoute.tsx:1782`](https://github.com/tha-hammer/agent-memory/blob/5a94cdfc4916185d61d6cb019e3600e704a64adc/cc-agent-ui/src/components/nolme-app/view/NolmeAppRoute.tsx#L1782)).

The route has a text-derived phase fallback for Algorithm output. `deriveAlgorithmRunStateFromText()` can infer phases and task progress from assistant text ([`src/components/nolme-app/view/NolmeAppRoute.tsx:253`](https://github.com/tha-hammer/agent-memory/blob/5a94cdfc4916185d61d6cb019e3600e704a64adc/cc-agent-ui/src/components/nolme-app/view/NolmeAppRoute.tsx#L253)). `rightPanelRunState` merges this derived phase data when API state lacks phases ([`src/components/nolme-app/view/NolmeAppRoute.tsx:362`](https://github.com/tha-hammer/agent-memory/blob/5a94cdfc4916185d61d6cb019e3600e704a64adc/cc-agent-ui/src/components/nolme-app/view/NolmeAppRoute.tsx#L362)). That derived state returns phase/task fields, not deliverables ([`src/components/nolme-app/view/NolmeAppRoute.tsx:267`](https://github.com/tha-hammer/agent-memory/blob/5a94cdfc4916185d61d6cb019e3600e704a64adc/cc-agent-ui/src/components/nolme-app/view/NolmeAppRoute.tsx#L267)).

`finalOutput` is rendered in the chat stream through `ArtifactResponse`, not in the Deliverables pane ([`src/components/nolme-app/view/NolmeAppRoute.tsx:1441`](https://github.com/tha-hammer/agent-memory/blob/5a94cdfc4916185d61d6cb019e3600e704a64adc/cc-agent-ui/src/components/nolme-app/view/NolmeAppRoute.tsx#L1441), [`src/components/nolme-app/view/NolmeAppRoute.tsx:1823`](https://github.com/tha-hammer/agent-memory/blob/5a94cdfc4916185d61d6cb019e3600e704a64adc/cc-agent-ui/src/components/nolme-app/view/NolmeAppRoute.tsx#L1823)).

## Code References

| File | What it contains |
| --- | --- |
| `server/providers/types.js:19` | Shared normalized provider message kinds, including `tool_result` and `task_notification`. |
| `server/routes/messages.js:29` | Unified session history endpoint. |
| `server/projects.js:996` | Claude session JSONL loading and exact `sessionId` filtering. |
| `server/providers/claude/adapter.js:37` | User `tool_result` normalization. |
| `server/providers/claude/adapter.js:90` | User string content normalization. |
| `src/components/chat/hooks/useChatMessages.ts:34` | Legacy task-notification parser for user text. |
| `server/agents/nolme-state-store.js:1` | Nolme sidecar state schema and location. |
| `server/agents/ccu-session-agent.js:291` | CopilotKit/Nolme connect hydration from provider history and sidecar state. |
| `server/agents/ag-ui-event-translator.js:215` | `task_notification` frames become AG-UI task notification state deltas. |
| `server/tools/workflow-phase-tools.js:80` | Existing `addResource` schema for Nolme resource cards. |
| `server/algorithm-runs/contracts.js:22` | Algorithm event types, including deliverables and output updates. |
| `server/algorithm-runs/run-store.js:130` | Deliverable normalization. |
| `server/algorithm-runs/run-store.js:287` | Event projection into `state.deliverables` and `state.finalOutput`. |
| `server/algorithm-runs/run-store.js:581` | Runner frame persistence for `deliverables`, `resources`, and `artifacts`. |
| `src/components/nolme-app/view/NolmeAppRoute.tsx:1726` | `/app` RightPanel reads `runState.deliverables`. |
| `src/components/nolme-app/view/NolmeAppRoute.tsx:1441` | `/app` chat stream renders `finalOutput` separately. |

## Architecture Documentation

Current artifact-related data is separated by surface:

| Surface | Storage | Read path | Current UI consumer |
| --- | --- | --- | --- |
| Claude session transcript | `~/.claude/projects/<projectName>/*.jsonl` and sidechain task output files | `/api/sessions/:sessionId/messages` through provider adapters | `/session/:id` chat transcript |
| Nolme state sidecar | `~/.claude/projects/<projectName-or-encoded-path>/<sessionId>.nolme-state.json` | `/api/nolme/state/:sessionId` and `CcuSessionAgent.connect()` | CopilotKit/Nolme state snapshot path |
| Algorithm Run state | `~/.cosmic-agent/algorithm-runs/<runId>/{metadata.json,state.json,events.jsonl}` | `/api/algorithm-runs/:runId/state` and `/events` SSE | `/app` right panel and chat stream |

The `/app` route is currently Algorithm Run state-first. Its Deliverables pane uses the Algorithm public state field `deliverables`. Its chat stream uses `finalOutput`. Its phase rail can additionally derive phase progress from assistant output text when API state lacks a phase list.

The normal `/session/:id` route is transcript-first. It renders normalized provider history and tool calls. In the inspected session, task output is present in this transcript layer as a queued task-notification string and assistant text report.

The Nolme sidecar layer stores `resources`, which are artifact-like cards in the older Nolme/CopilotKit state model. The `/app` route in this checkout does not read that sidecar `resources` field for its Deliverables pane.

## Historical Context

- `thoughts/searchable/shared/research/2026-04-29-cam-d44-app-route-algorithm-api-wiring.md` - Documents that `/app` is now an authenticated shell connected to `/api/algorithm-runs`, with phases, deliverables, and final output represented in the route-level state shape.
- `thoughts/searchable/shared/research/2026-04-26-cc-agent-ui-harness-middleware-interfaces.md` - Documents the provider harness boundary: provider dispatch, writer-like sinks, normalized messages, unified history, and Nolme AG-UI wrapper.
- `docs/2026-04-27-algorithm-run-api-nolme-ui-connection.md` - Documents the previous Nolme connection model where phases come from `NolmeAgentState.phases` and deliverables come from `NolmeAgentState.resources` or provider-history fallback projection.
- `thoughts/searchable/shared/research/2026-04-26-open-in-nolme-session-hydration.md` - Documents existing Nolme hydration from URL/localStorage/BroadcastChannel binding, provider history, and sidecar state.
- `thoughts/searchable/shared/research/2026-04-26-nolme-algorithm-interface-surfaces.md` - Documents pre-Algorithm-Run-API command/event/state surfaces and the older resource projection concepts.

## Related Research

- `thoughts/searchable/shared/research/2026-04-29-cam-d44-app-route-algorithm-api-wiring.md`
- `thoughts/searchable/shared/research/2026-04-26-cc-agent-ui-harness-middleware-interfaces.md`
- `thoughts/searchable/shared/research/2026-04-26-open-in-nolme-session-hydration.md`
- `thoughts/searchable/shared/research/2026-04-26-nolme-algorithm-interface-surfaces.md`
- `docs/2026-04-27-algorithm-run-api-nolme-ui-connection.md`

## Open Questions

- Which Algorithm run id, if any, corresponds to the inspected provider session `d75f31dc-0e96-4267-aa35-ff7c68f86cdd` was not visible in the provided URL. The `/app` route identifies its run through `?runId=` or `localStorage["nolme-active-algorithm-run-id"]`, not through the provider session route.
- The observed task notification payload is stored as transcript text with `<tool-use-id>` and `<result>` tags. Current chat parsing recognizes a different legacy task-notification shape that includes `<output-file>`.
- Current `/app` phase fallback derives phase/task fields from output text. No corresponding text-derived deliverables fallback was found in `NolmeAppRoute.tsx`.
