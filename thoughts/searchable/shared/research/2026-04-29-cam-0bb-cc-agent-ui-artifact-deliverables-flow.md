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
last_updated_note: "Added follow-up research for /app session update state after completed test session"
related_beads: [cam-0bb, cam-cio]
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

## Follow-up Research 2026-04-29T13:39:53-04:00

### Research Question

The test session completed, but the loaded `/app` UI did not update with the final text or Deliverables. The screenshot showed `/app` at `http://localhost:5173/app` with phase progress derived through Build 4/7, an empty Deliverables pane, and the chat footer text `Send a message to the LLM. Algorithm phase events will appear when a run is active.`

### Follow-up Summary

The current `/app` route has two different update modes:

1. **Selected provider session mode**: clicking a project/session row calls `openSession()`, which fetches `/api/sessions/:sessionId/messages` once and maps only normalized `text` messages into `chatMessages`.
2. **Algorithm run mode**: when `activeRunId` exists from `?runId=` or `localStorage["nolme-active-algorithm-run-id"]`, `/app` fetches `/api/algorithm-runs/:runId/state` and opens an EventSource for `/api/algorithm-runs/:runId/events`.

The screenshot state matches selected provider session mode without an active Algorithm run. In this mode, the right-panel phases can be derived from assistant text already fetched into the page, but the Deliverables pane still reads only `runState.deliverables`. No code path in `NolmeAppRoute.tsx` re-fetches the selected session after the initial `openSession()` call when the session JSONL changes on disk.

### Live Test Session State

The test session history file exists and was updated after the screenshot's visible 12:45-12:46 messages:

| Runtime path | Observed state |
| --- | --- |
| `/home/maceo/.claude/projects/-home-maceo/d75f31dc-0e96-4267-aa35-ff7c68f86cdd.jsonl` | 946,035 bytes, mtime `2026-04-29 12:59:28 -0400`, 208 JSONL records. |
| line 127 | `type: "user"` string content containing the completed `<task-notification>` payload, timestamp `2026-04-29T16:44:11.729Z`, 22,607 chars. |
| line 208 | `type: "assistant"` text containing `REPORT DELIVERED`, timestamp `2026-04-29T16:59:28.418Z`, 13,648 chars. |
| `/home/maceo/.claude/projects/-home-maceo/d75f31dc-0e96-4267-aa35-ff7c68f86cdd.nolme-state.json` | No file exists at this path. |

The local Algorithm Run store has six `state.json` files under `/home/maceo/.cosmic-agent/algorithm-runs`, all from `2026-04-26`, all with `status: "running"`, `sessionId: null`, and no `finalOutput`. None references `d75f31dc-0e96-4267-aa35-ff7c68f86cdd`.

### `/app` Session Loading Path

`NolmeAppRoute` owns separate state for `runState`, `derivedRunState`, `chatSessionId`, and `chatMessages` ([`NolmeAppRoute.tsx:326`](https://github.com/tha-hammer/agent-memory/blob/ba8ff7ba12c8fe8746031302d9c6813bd4ee93d1/cc-agent-ui/src/components/nolme-app/view/NolmeAppRoute.tsx#L326)).

When the user opens an existing session in `/app`, `openSession()`:

- stores the selected project/session locally;
- sets `chatSessionId` to the selected session id;
- calls `api.unifiedSessionMessages(session.id, provider, { projectName, projectPath })`;
- maps returned normalized messages through `toTranscriptItem()`;
- builds `derivedRunState` from assistant text already returned by that fetch ([`NolmeAppRoute.tsx:459`](https://github.com/tha-hammer/agent-memory/blob/ba8ff7ba12c8fe8746031302d9c6813bd4ee93d1/cc-agent-ui/src/components/nolme-app/view/NolmeAppRoute.tsx#L459), [`NolmeAppRoute.tsx:475`](https://github.com/tha-hammer/agent-memory/blob/ba8ff7ba12c8fe8746031302d9c6813bd4ee93d1/cc-agent-ui/src/components/nolme-app/view/NolmeAppRoute.tsx#L475), [`NolmeAppRoute.tsx:487`](https://github.com/tha-hammer/agent-memory/blob/ba8ff7ba12c8fe8746031302d9c6813bd4ee93d1/cc-agent-ui/src/components/nolme-app/view/NolmeAppRoute.tsx#L487)).

`toTranscriptItem()` only accepts normalized messages where `kind === "text"`, `role` is present, and `content` is present ([`NolmeAppRoute.tsx:215`](https://github.com/tha-hammer/agent-memory/blob/ba8ff7ba12c8fe8746031302d9c6813bd4ee93d1/cc-agent-ui/src/components/nolme-app/view/NolmeAppRoute.tsx#L215)). Normalized `tool_result`, `tool_use`, `task_notification`, and other event kinds are not converted into `/app` chat transcript rows by this function.

`deriveAlgorithmRunStateFromText()` searches accumulated assistant text for Algorithm phase/progress markers and returns phase/task fields only: `runId`, `provider`, `status`, `taskTitle`, `phase`, `phases`, `currentPhaseIndex`, and `currentReviewLine` ([`NolmeAppRoute.tsx:236`](https://github.com/tha-hammer/agent-memory/blob/ba8ff7ba12c8fe8746031302d9c6813bd4ee93d1/cc-agent-ui/src/components/nolme-app/view/NolmeAppRoute.tsx#L236), [`NolmeAppRoute.tsx:267`](https://github.com/tha-hammer/agent-memory/blob/ba8ff7ba12c8fe8746031302d9c6813bd4ee93d1/cc-agent-ui/src/components/nolme-app/view/NolmeAppRoute.tsx#L267)). It does not return `deliverables` or `finalOutput`.

`rightPanelRunState` can merge `derivedRunState` into `runState` when API state lacks phases, but that merge only carries phase/task fields. It does not project transcript content into deliverables ([`NolmeAppRoute.tsx:362`](https://github.com/tha-hammer/agent-memory/blob/ba8ff7ba12c8fe8746031302d9c6813bd4ee93d1/cc-agent-ui/src/components/nolme-app/view/NolmeAppRoute.tsx#L362)).

### `/app` Live Update Path

The `/app` route reads `activeRunId` once from `readInitialRunId()` into `useState(readInitialRunId)`. `readInitialRunId()` checks URL `?runId=` first, then `localStorage["nolme-active-algorithm-run-id"]` ([`NolmeAppRoute.tsx:160`](https://github.com/tha-hammer/agent-memory/blob/ba8ff7ba12c8fe8746031302d9c6813bd4ee93d1/cc-agent-ui/src/components/nolme-app/view/NolmeAppRoute.tsx#L160), [`NolmeAppRoute.tsx:331`](https://github.com/tha-hammer/agent-memory/blob/ba8ff7ba12c8fe8746031302d9c6813bd4ee93d1/cc-agent-ui/src/components/nolme-app/view/NolmeAppRoute.tsx#L331)).

If `activeRunId` is present, `/app` writes it back into localStorage and adds it to the URL, then loads Algorithm state and opens an EventSource for Algorithm events ([`NolmeAppRoute.tsx:578`](https://github.com/tha-hammer/agent-memory/blob/ba8ff7ba12c8fe8746031302d9c6813bd4ee93d1/cc-agent-ui/src/components/nolme-app/view/NolmeAppRoute.tsx#L578), [`NolmeAppRoute.tsx:590`](https://github.com/tha-hammer/agent-memory/blob/ba8ff7ba12c8fe8746031302d9c6813bd4ee93d1/cc-agent-ui/src/components/nolme-app/view/NolmeAppRoute.tsx#L590), [`NolmeAppRoute.tsx:600`](https://github.com/tha-hammer/agent-memory/blob/ba8ff7ba12c8fe8746031302d9c6813bd4ee93d1/cc-agent-ui/src/components/nolme-app/view/NolmeAppRoute.tsx#L600)).

If `activeRunId` is absent, the Algorithm state effect sets `runState` to `null` and no Algorithm EventSource is opened ([`NolmeAppRoute.tsx:590`](https://github.com/tha-hammer/agent-memory/blob/ba8ff7ba12c8fe8746031302d9c6813bd4ee93d1/cc-agent-ui/src/components/nolme-app/view/NolmeAppRoute.tsx#L590), [`NolmeAppRoute.tsx:600`](https://github.com/tha-hammer/agent-memory/blob/ba8ff7ba12c8fe8746031302d9c6813bd4ee93d1/cc-agent-ui/src/components/nolme-app/view/NolmeAppRoute.tsx#L600)).

The screenshot URL was `/app`, not `/app?runId=...`, and the chat footer text was the no-run-state message from `ChatPanel`: `Send a message to the LLM. Algorithm phase events will appear when a run is active.` That text is selected when `runState` is null and `isStartingRun` is false ([`NolmeAppRoute.tsx:1419`](https://github.com/tha-hammer/agent-memory/blob/ba8ff7ba12c8fe8746031302d9c6813bd4ee93d1/cc-agent-ui/src/components/nolme-app/view/NolmeAppRoute.tsx#L1419)).

The `/app` WebSocket `latestMessage` handler appends live Claude messages only for a small set of normalized message kinds: `session_created`, assistant `text`, `stream_delta`, `stream_end`, `error`, and `complete` ([`NolmeAppRoute.tsx:642`](https://github.com/tha-hammer/agent-memory/blob/ba8ff7ba12c8fe8746031302d9c6813bd4ee93d1/cc-agent-ui/src/components/nolme-app/view/NolmeAppRoute.tsx#L642)). It filters out messages with a mismatched `sessionId` when `chatSessionId` is set ([`NolmeAppRoute.tsx:649`](https://github.com/tha-hammer/agent-memory/blob/ba8ff7ba12c8fe8746031302d9c6813bd4ee93d1/cc-agent-ui/src/components/nolme-app/view/NolmeAppRoute.tsx#L649)). It does not handle `projects_updated`, `tool_result`, `tool_use`, `task_notification`, or queued task-notification user text.

### Server Project Watcher and Normal Session Refresh Path

The server watches provider project/session folders and broadcasts `projects_updated` WebSocket messages with the full updated projects list and a `changedFile` when files are added or changed ([`server/index.js:144`](https://github.com/tha-hammer/agent-memory/blob/ba8ff7ba12c8fe8746031302d9c6813bd4ee93d1/cc-agent-ui/server/index.js#L144), [`server/index.js:164`](https://github.com/tha-hammer/agent-memory/blob/ba8ff7ba12c8fe8746031302d9c6813bd4ee93d1/cc-agent-ui/server/index.js#L164)). The watcher uses polling with a 2-second interval for text files ([`server/index.js:206`](https://github.com/tha-hammer/agent-memory/blob/ba8ff7ba12c8fe8746031302d9c6813bd4ee93d1/cc-agent-ui/server/index.js#L206)).

The normal `/session/:id` app path consumes those `projects_updated` messages through `useProjectsState()`. When the changed file matches the selected session and the session is not active, it increments `externalMessageUpdate` ([`src/hooks/useProjectsState.ts:206`](https://github.com/tha-hammer/agent-memory/blob/ba8ff7ba12c8fe8746031302d9c6813bd4ee93d1/cc-agent-ui/src/hooks/useProjectsState.ts#L206), [`src/hooks/useProjectsState.ts:235`](https://github.com/tha-hammer/agent-memory/blob/ba8ff7ba12c8fe8746031302d9c6813bd4ee93d1/cc-agent-ui/src/hooks/useProjectsState.ts#L235), [`src/hooks/useProjectsState.ts:243`](https://github.com/tha-hammer/agent-memory/blob/ba8ff7ba12c8fe8746031302d9c6813bd4ee93d1/cc-agent-ui/src/hooks/useProjectsState.ts#L243)).

`AppContent` passes `externalMessageUpdate` into `ChatInterface` ([`src/components/app/AppContent.tsx:30`](https://github.com/tha-hammer/agent-memory/blob/ba8ff7ba12c8fe8746031302d9c6813bd4ee93d1/cc-agent-ui/src/components/app/AppContent.tsx#L30), [`src/components/app/AppContent.tsx:176`](https://github.com/tha-hammer/agent-memory/blob/ba8ff7ba12c8fe8746031302d9c6813bd4ee93d1/cc-agent-ui/src/components/app/AppContent.tsx#L176)). `useChatSessionState()` then refreshes the selected session from the server when `externalMessageUpdate` changes and the chat is not currently loading/streaming ([`src/components/chat/hooks/useChatSessionState.ts:402`](https://github.com/tha-hammer/agent-memory/blob/ba8ff7ba12c8fe8746031302d9c6813bd4ee93d1/cc-agent-ui/src/components/chat/hooks/useChatSessionState.ts#L402)).

`NolmeAppRoute` does not use `useProjectsState()`, does not track `externalMessageUpdate`, and does not have a corresponding selected-session refresh effect. Its project/session list is fetched once on mount through `api.projects()` ([`NolmeAppRoute.tsx:401`](https://github.com/tha-hammer/agent-memory/blob/ba8ff7ba12c8fe8746031302d9c6813bd4ee93d1/cc-agent-ui/src/components/nolme-app/view/NolmeAppRoute.tsx#L401)).

### Follow-up Code References

| File | What it contains |
| --- | --- |
| `src/components/nolme-app/view/NolmeAppRoute.tsx:459` | One-time selected-session load in `/app`. |
| `src/components/nolme-app/view/NolmeAppRoute.tsx:215` | `/app` session transcript conversion accepts only normalized text messages. |
| `src/components/nolme-app/view/NolmeAppRoute.tsx:236` | Derived phase state parser for assistant text. |
| `src/components/nolme-app/view/NolmeAppRoute.tsx:578` | `activeRunId` localStorage/URL sync. |
| `src/components/nolme-app/view/NolmeAppRoute.tsx:600` | Algorithm EventSource opens only when an active run id and cursor exist. |
| `src/components/nolme-app/view/NolmeAppRoute.tsx:642` | `/app` live WebSocket message handler and accepted message kinds. |
| `src/components/nolme-app/view/NolmeAppRoute.tsx:1726` | Deliverables pane reads only `runState.deliverables`. |
| `server/index.js:144` | Server project file watcher broadcasts changed project/session files. |
| `src/hooks/useProjectsState.ts:235` | Normal app route converts `projects_updated` for selected sessions into `externalMessageUpdate`. |
| `src/components/chat/hooks/useChatSessionState.ts:402` | Normal chat route refreshes selected session messages after external update. |

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
