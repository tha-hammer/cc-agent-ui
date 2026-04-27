---
date: 2026-04-26T10:33:13-04:00
researcher: maceo
git_commit: b53fe98a6f87adbd63c09ff8045559e5c9142e59
branch: main
repository: cc-agent-ui
topic: "How cc-agent-ui hooks into coding agent harnesses and the current middleware-facing interfaces/contracts"
tags: [research, codebase, middleware, harnesses, providers, websocket, sse, copilotkit, nolme]
status: complete
last_updated: 2026-04-26
last_updated_by: maceo
---

# Research: cc-agent-ui Harness Middleware Interfaces

**Date**: 2026-04-26T10:33:13-04:00  
**Researcher**: maceo  
**Git Commit**: `b53fe98a6f87adbd63c09ff8045559e5c9142e59`  
**Branch**: `main`  
**Repository**: `cc-agent-ui`

## Research Question

How does `cc-agent-ui` hook into the underlying coding agent harnesses today, and what interfaces and contracts already exist that could be treated as a middleware API layer?

## Summary

`cc-agent-ui` already uses the same four provider harnesses through three different surfaces:

1. the main authenticated chat WebSocket at `/ws`
2. the external API-key-backed REST/SSE route at `POST /api/agent`
3. the Nolme/CopilotKit AG-UI wrapper at `/api/copilotkit`

Across those surfaces, the stable shared boundary is:

- a provider name: `claude | cursor | codex | gemini`
- a provider-specific options object containing session, project, model, and permission/tool settings
- a writer-like sink with `.send(frame)` and session helpers
- a normalized outbound message/event contract defined in `server/providers/types.js`

The main app sends provider-specific command envelopes over WebSocket. The external `/api/agent` route builds the same provider option shapes server-side and swaps in an SSE or collecting writer. Nolme's `CcuSessionAgent` does the same again through `buildProviderDispatch(binding)`, which intentionally mirrors the WebSocket dispatch shape and forwards frames into an AG-UI translator instead of a socket.

The existing codebase therefore already contains a de facto middleware layer with four parts:

- frontend/provider command envelopes
- server-side dispatch routing
- per-provider harness entrypoints
- shared normalized frame history/runtime adapters

## Detailed Findings

### 1. Current integration surfaces

The server exposes three distinct transport surfaces that all converge on the same provider harnesses:

- main UI history + live chat:
  - WebSocket transport and dispatch in [`server/index.js#L1532-L1715`](https://github.com/tha-hammer/agent-memory/blob/b53fe98a6f87adbd63c09ff8045559e5c9142e59/server/index.js#L1532-L1715)
- unified session history:
  - `GET /api/sessions/:sessionId/messages` in [`server/routes/messages.js#L1-L59`](https://github.com/tha-hammer/agent-memory/blob/b53fe98a6f87adbd63c09ff8045559e5c9142e59/server/routes/messages.js#L1-L59)
- external middleware-style execution surface:
  - `POST /api/agent` in [`server/routes/agent.js#L842-L1000`](https://github.com/tha-hammer/agent-memory/blob/b53fe98a6f87adbd63c09ff8045559e5c9142e59/server/routes/agent.js#L842-L1000)
- Nolme/CopilotKit wrapper:
  - mount path in [`server/routes/copilotkit.js#L1-L90`](https://github.com/tha-hammer/agent-memory/blob/b53fe98a6f87adbd63c09ff8045559e5c9142e59/server/routes/copilotkit.js#L1-L90)
  - agent wrapper in [`server/agents/ccu-session-agent.js#L1-L344`](https://github.com/tha-hammer/agent-memory/blob/b53fe98a6f87adbd63c09ff8045559e5c9142e59/server/agents/ccu-session-agent.js#L1-L344)

These surfaces are mounted from the main server here:

- [`server/index.js#L465-L476`](https://github.com/tha-hammer/agent-memory/blob/b53fe98a6f87adbd63c09ff8045559e5c9142e59/server/index.js#L465-L476)

### 2. Shared provider contract

The common normalized provider contract is defined in [`server/providers/types.js#L1-L119`](https://github.com/tha-hammer/agent-memory/blob/b53fe98a6f87adbd63c09ff8045559e5c9142e59/server/providers/types.js#L1-L119).

That file defines:

- `SessionProvider = 'claude' | 'cursor' | 'codex' | 'gemini'`
- `MessageKind` as the shared runtime/history event vocabulary
- `NormalizedMessage` as the flat transport-neutral message shape
- `ProviderAdapter` with:
  - `fetchHistory(sessionId, opts?)`
  - `normalizeMessage(raw, sessionId)`

The provider registry is a simple name-to-adapter map in [`server/providers/registry.js#L1-L44`](https://github.com/tha-hammer/agent-memory/blob/b53fe98a6f87adbd63c09ff8045559e5c9142e59/server/providers/registry.js#L1-L44).

That registry is used by:

- the unified history route
- `CcuSessionAgent.connect()` for Nolme hydration
- any server code that needs a provider adapter rather than a direct harness invocation

### 3. Frontend command envelopes for the main chat

The main chat UI opens an authenticated WebSocket and exposes `sendMessage()` plus `latestMessage` through `WebSocketProvider` in [`src/contexts/WebSocketContext.tsx#L1-L127`](https://github.com/tha-hammer/agent-memory/blob/b53fe98a6f87adbd63c09ff8045559e5c9142e59/src/contexts/WebSocketContext.tsx#L1-L127).

When the operator submits a prompt, `useChatComposerState()` sends a provider-specific envelope over that socket in [`src/components/chat/hooks/useChatComposerState.ts#L637-L701`](https://github.com/tha-hammer/agent-memory/blob/b53fe98a6f87adbd63c09ff8045559e5c9142e59/src/components/chat/hooks/useChatComposerState.ts#L637-L701).

Current outgoing WebSocket message types are:

- `cursor-command`
- `codex-command`
- `gemini-command`
- `claude-command`

The option shapes differ slightly by provider:

- Cursor:
  - `cwd`, `projectPath`, `sessionId`, `resume`, `model`, `skipPermissions`, `sessionSummary`, `toolsSettings`
- Codex:
  - `cwd`, `projectPath`, `sessionId`, `resume`, `model`, `sessionSummary`, `permissionMode`
- Gemini:
  - `cwd`, `projectPath`, `sessionId`, `resume`, `model`, `sessionSummary`, `permissionMode`, `toolsSettings`
- Claude:
  - `projectPath`, `cwd`, `toolsSettings`, `permissionMode`, `model`, `sessionSummary`, `images`, `sessionId`, `resume`, optional `appendSystemPrompt`

The client-side session store mirrors the same normalized message vocabulary and hydrates history through the unified messages endpoint in [`src/stores/useSessionStore.ts#L1-L280`](https://github.com/tha-hammer/agent-memory/blob/b53fe98a6f87adbd63c09ff8045559e5c9142e59/src/stores/useSessionStore.ts#L1-L280) and [`src/utils/api.js#L1-L69`](https://github.com/tha-hammer/agent-memory/blob/b53fe98a6f87adbd63c09ff8045559e5c9142e59/src/utils/api.js#L1-L69).

### 4. WebSocket dispatch path on the server

The server-side live-chat dispatch path is `handleChatConnection()` in [`server/index.js#L1560-L1715`](https://github.com/tha-hammer/agent-memory/blob/b53fe98a6f87adbd63c09ff8045559e5c9142e59/server/index.js#L1560-L1715).

It routes WebSocket command types directly into the harness entrypoints:

- `claude-command` -> `queryClaudeSDK(...)`
- `cursor-command` -> `spawnCursor(...)`
- `codex-command` -> `queryCodex(...)`
- `gemini-command` -> `spawnGemini(...)`

The same block also handles auxiliary lifecycle/control messages:

- `fork-prepare`
- `abort-session`
- `claude-permission-response`
- `cursor-abort`
- `check-session-status`
- `get-pending-permissions`
- `get-active-sessions`

The live-chat transport wrapper is `WebSocketWriter`, defined in [`server/index.js#L1532-L1557`](https://github.com/tha-hammer/agent-memory/blob/b53fe98a6f87adbd63c09ff8045559e5c9142e59/server/index.js#L1532-L1557). Its public shape is:

- `send(data)`
- `setSessionId(sessionId)`
- `getSessionId()`
- `userId`

That writer shape is significant because the same provider entrypoints are written against it and reused by other surfaces.

### 5. External `/api/agent` as a server-side middleware surface

`POST /api/agent` is the most direct middleware-like server entrypoint in the current codebase. Its detailed request contract is documented inline in [`server/routes/agent.js#L618-L841`](https://github.com/tha-hammer/agent-memory/blob/b53fe98a6f87adbd63c09ff8045559e5c9142e59/server/routes/agent.js#L618-L841), and the handler itself starts at [`server/routes/agent.js#L842-L1000`](https://github.com/tha-hammer/agent-memory/blob/b53fe98a6f87adbd63c09ff8045559e5c9142e59/server/routes/agent.js#L842-L1000).

Current request body fields include:

- `githubUrl`
- `projectPath`
- `message`
- `provider`
- `stream`
- `model`
- `cleanup`
- `githubToken`
- `branchName`
- `sessionId`
- `createBranch`
- `createPR`

This route resolves or clones a project, registers it, then dispatches to the same provider harnesses used by the WebSocket path:

- Claude via `queryClaudeSDK(...)` with `permissionMode: 'bypassPermissions'`
- Cursor via `spawnCursor(...)` with `skipPermissions: true`
- Codex via `queryCodex(...)` with `permissionMode: 'bypassPermissions'`
- Gemini via `spawnGemini(...)` with `skipPermissions: true`

The transport-specific writers for this route are:

- `SSEStreamWriter` in [`server/routes/agent.js#L452-L484`](https://github.com/tha-hammer/agent-memory/blob/b53fe98a6f87adbd63c09ff8045559e5c9142e59/server/routes/agent.js#L452-L484)
- `ResponseCollector` in [`server/routes/agent.js#L489-L602`](https://github.com/tha-hammer/agent-memory/blob/b53fe98a6f87adbd63c09ff8045559e5c9142e59/server/routes/agent.js#L489-L602)

Those classes expose the same core writer methods used by the harnesses:

- `send(data)`
- `setSessionId(sessionId)`
- `getSessionId()`

### 6. Nolme/CopilotKit as a wrapper over the same harnesses

The Nolme surface uses a session binding rather than the main app's composer state.

The browser-side binding contract is defined in:

- main app launch binding: [`src/utils/nolmeLaunch.ts#L1-L137`](https://github.com/tha-hammer/agent-memory/blob/b53fe98a6f87adbd63c09ff8045559e5c9142e59/src/utils/nolmeLaunch.ts#L1-L137)
- Nolme-side binding/state types: [`nolme-ui/src/lib/types.ts#L1-L77`](https://github.com/tha-hammer/agent-memory/blob/b53fe98a6f87adbd63c09ff8045559e5c9142e59/nolme-ui/src/lib/types.ts#L1-L77)
- binding resolution order: [`nolme-ui/src/hooks/useCcuSession.ts#L1-L132`](https://github.com/tha-hammer/agent-memory/blob/b53fe98a6f87adbd63c09ff8045559e5c9142e59/nolme-ui/src/hooks/useCcuSession.ts#L1-L132)
- hydration bootstrap: [`nolme-ui/src/hooks/useHydratedState.ts#L1-L96`](https://github.com/tha-hammer/agent-memory/blob/b53fe98a6f87adbd63c09ff8045559e5c9142e59/nolme-ui/src/hooks/useHydratedState.ts#L1-L96)

On the server side, CopilotKit mounts a single `ccu` agent backed by `SafeInMemoryAgentRunner` in [`server/routes/copilotkit.js#L1-L90`](https://github.com/tha-hammer/agent-memory/blob/b53fe98a6f87adbd63c09ff8045559e5c9142e59/server/routes/copilotkit.js#L1-L90).

`CcuSessionAgent` is the wrapper that connects the Nolme binding to the same harness entrypoints. The key adapter point is `buildProviderDispatch(binding)` in [`server/agents/ccu-session-agent.js#L57-L117`](https://github.com/tha-hammer/agent-memory/blob/b53fe98a6f87adbd63c09ff8045559e5c9142e59/server/agents/ccu-session-agent.js#L57-L117).

That function explicitly reproduces the same option shapes used by the main WebSocket composer:

- Claude -> `queryClaudeSDK`
- Cursor -> `spawnCursor`
- Codex -> `queryCodex`
- Gemini -> `spawnGemini`

Runtime execution happens in `run(input)` at [`server/agents/ccu-session-agent.js#L146-L268`](https://github.com/tha-hammer/agent-memory/blob/b53fe98a6f87adbd63c09ff8045559e5c9142e59/server/agents/ccu-session-agent.js#L146-L268).

Hydration for an existing session happens in `connect(input)` at [`server/agents/ccu-session-agent.js#L270-L344`](https://github.com/tha-hammer/agent-memory/blob/b53fe98a6f87adbd63c09ff8045559e5c9142e59/server/agents/ccu-session-agent.js#L270-L344), which:

- resolves the provider adapter from the registry
- calls `adapter.fetchHistory(sessionId, { projectName, projectPath, limit: null, offset: 0 })`
- translates the normalized history into AG-UI events
- reads the Nolme sidecar state
- emits `STATE_SNAPSHOT`

The writer bridge for Nolme is `createNolmeAgUiWriter()` in [`server/agents/nolme-ag-ui-writer.js#L1-L51`](https://github.com/tha-hammer/agent-memory/blob/b53fe98a6f87adbd63c09ff8045559e5c9142e59/server/agents/nolme-ag-ui-writer.js#L1-L51). It preserves the same `send(frame)` shape as the WebSocket/SSE writers, but routes frames into the AG-UI translator instead of a socket or HTTP response.

The frame-to-AG-UI translation layer is in [`server/agents/ag-ui-event-translator.js#L1-L258`](https://github.com/tha-hammer/agent-memory/blob/b53fe98a6f87adbd63c09ff8045559e5c9142e59/server/agents/ag-ui-event-translator.js#L1-L258).

### 7. Provider harness entrypoints and their input contracts

The four harness entrypoints are:

- Claude: [`server/claude-sdk.js#L146-L233`](https://github.com/tha-hammer/agent-memory/blob/b53fe98a6f87adbd63c09ff8045559e5c9142e59/server/claude-sdk.js#L146-L233) and [`server/claude-sdk.js#L486-L747`](https://github.com/tha-hammer/agent-memory/blob/b53fe98a6f87adbd63c09ff8045559e5c9142e59/server/claude-sdk.js#L486-L747)
- Cursor: [`server/cursor-cli.js#L27-L309`](https://github.com/tha-hammer/agent-memory/blob/b53fe98a6f87adbd63c09ff8045559e5c9142e59/server/cursor-cli.js#L27-L309)
- Codex: [`server/openai-codex.js#L167-L332`](https://github.com/tha-hammer/agent-memory/blob/b53fe98a6f87adbd63c09ff8045559e5c9142e59/server/openai-codex.js#L167-L332)
- Gemini: [`server/gemini-cli.js#L16-L405`](https://github.com/tha-hammer/agent-memory/blob/b53fe98a6f87adbd63c09ff8045559e5c9142e59/server/gemini-cli.js#L16-L405)

Their current option mappings are:

#### Claude

`mapCliOptionsToSDK()` maps cc-agent-ui options into Claude SDK options:

- `cwd`
- `permissionMode`
- `toolsSettings`
- `skipPermissions` via `bypassPermissions` unless plan mode
- `allowedTools` / `disallowedTools`
- `model`
- `systemPrompt` preset plus optional appended prompt
- `settingSources = ['project', 'user', 'local']`
- `sessionId` -> SDK `resume`
- `continueConversation` -> SDK `continue`
- `forkSession`

During execution, `queryClaudeSDK()` also:

- attaches MCP server config
- persists temp image files for image prompts
- exposes `canUseTool` for permission requests
- emits `session_created`
- normalizes outbound events through the Claude adapter
- emits `status` token-budget frames and `complete`

#### Cursor

`spawnCursor()` reads:

- `sessionId`
- `projectPath`
- `cwd`
- `resume`
- `toolsSettings`
- `skipPermissions`
- `model`
- `sessionSummary`

It turns that into Cursor CLI flags such as:

- `--resume=<sessionId>`
- `-p <prompt>`
- `--model <model>`
- `--output-format stream-json`
- `-f`
- retry with `--trust` when needed

It captures `response.session_id`, updates the writer session id, emits `session_created`, normalizes assistant output through the Cursor adapter, and emits `complete`.

#### Codex

`queryCodex()` reads:

- `sessionId`
- `sessionSummary`
- `cwd`
- `projectPath`
- `model`
- `permissionMode`

Permission mode is mapped by `mapPermissionModeToCodexOptions()` in [`server/openai-codex.js#L167-L192`](https://github.com/tha-hammer/agent-memory/blob/b53fe98a6f87adbd63c09ff8045559e5c9142e59/server/openai-codex.js#L167-L192):

- `default` -> `workspace-write` + `approvalPolicy: 'untrusted'`
- `acceptEdits` -> `workspace-write` + `approvalPolicy: 'never'`
- `bypassPermissions` -> `danger-full-access` + `approvalPolicy: 'never'`

Execution resumes or starts a Codex thread, emits `session_created`, translates streamed turn events via `transformCodexEvent()`, normalizes them through the Codex adapter, emits token-budget status, then emits `complete`.

#### Gemini

`spawnGemini()` reads:

- `sessionId`
- `projectPath`
- `cwd`
- `toolsSettings`
- `permissionMode`
- `images`
- `sessionSummary`

It turns those into Gemini CLI flags such as:

- `--prompt`
- `--resume <cliSessionId>`
- `--mcp-config ~/.gemini.json`
- `--model`
- `--output-format stream-json`
- `--yolo`
- `--approval-mode auto_edit|plan`
- `--allowed-tools`

It also persists image inputs as temporary files, captures or synthesizes a session id, emits `session_created`, and emits `complete` when the process finishes.

### 8. Unified history/persistence boundary

The unified history route is transport-neutral and depends only on provider adapters. It is implemented in [`server/routes/messages.js#L1-L59`](https://github.com/tha-hammer/agent-memory/blob/b53fe98a6f87adbd63c09ff8045559e5c9142e59/server/routes/messages.js#L1-L59).

Its query contract is:

- `provider`
- `projectName`
- `projectPath`
- `limit`
- `offset`

Current provider-specific history sources are:

- Claude:
  - adapter in [`server/providers/claude/adapter.js#L213-L282`](https://github.com/tha-hammer/agent-memory/blob/b53fe98a6f87adbd63c09ff8045559e5c9142e59/server/providers/claude/adapter.js#L213-L282)
  - underlying session loader in `server/projects.js:getSessionMessages(...)`, which filters exact `entry.sessionId === sessionId`
- Cursor:
  - adapter in [`server/providers/cursor/adapter.js#L163-L245`](https://github.com/tha-hammer/agent-memory/blob/b53fe98a6f87adbd63c09ff8045559e5c9142e59/server/providers/cursor/adapter.js#L163-L245)
  - raw storage in `~/.cursor/chats/<cwdId>/<sessionId>/store.db`
- Codex:
  - adapter in [`server/providers/codex/adapter.js#L203-L247`](https://github.com/tha-hammer/agent-memory/blob/b53fe98a6f87adbd63c09ff8045559e5c9142e59/server/providers/codex/adapter.js#L203-L247)
  - underlying loader `getCodexSessionMessages(...)`
- Gemini:
  - adapter in [`server/providers/gemini/adapter.js#L85-L150`](https://github.com/tha-hammer/agent-memory/blob/b53fe98a6f87adbd63c09ff8045559e5c9142e59/server/providers/gemini/adapter.js#L85-L150)
  - in-memory session manager first, then CLI disk fallback via `getGeminiCliSessionMessages(...)`

For Nolme specifically, persisted sidecar state is separate from chat history and lives in [`server/agents/nolme-state-store.js#L1-L123`](https://github.com/tha-hammer/agent-memory/blob/b53fe98a6f87adbd63c09ff8045559e5c9142e59/server/agents/nolme-state-store.js#L1-L123) at:

- `~/.claude/projects/<projectName-or-encoded-projectPath>/<sessionId>.nolme-state.json`

### 9. Current middleware-facing interface map

The codebase currently exposes these reusable boundaries:

| Layer | Current input contract | Current output contract | Primary files |
| --- | --- | --- | --- |
| Frontend chat dispatch | WebSocket envelope: `{ type, command, sessionId?, options }` | socket frames from server | `useChatComposerState.ts`, `WebSocketContext.tsx` |
| Transport-neutral provider dispatch | `(prompt, options, writer)` | calls `writer.send(normalizedFrame)` | `claude-sdk.js`, `cursor-cli.js`, `openai-codex.js`, `gemini-cli.js` |
| Writer interface | `{ send(frame), setSessionId?, getSessionId?, userId? }` | transport-specific side effect | `WebSocketWriter`, `SSEStreamWriter`, `ResponseCollector`, `NolmeAgUiWriter` |
| History API | `fetchHistory(sessionId, opts)` | `{ messages, total, hasMore, offset, limit, tokenUsage? }` | provider adapters, `routes/messages.js` |
| Normalized runtime/history frame | `NormalizedMessage` | consumed by UI store or AG-UI translator | `providers/types.js` |
| Nolme wrapper | `RunAgentInput.forwardedProps.binding` | AG-UI `BaseEvent[]` stream | `ccu-session-agent.js`, `ag-ui-event-translator.js` |

## Code References

- `src/components/chat/hooks/useChatComposerState.ts:637-701` - provider-specific outgoing WebSocket command envelopes
- `src/contexts/WebSocketContext.tsx:1-127` - authenticated WebSocket connection and `sendMessage()`
- `src/stores/useSessionStore.ts:1-280` - session-keyed normalized message store and unified history fetch
- `src/utils/api.js:49-69` - frontend helper for the unified `/api/sessions/:id/messages` endpoint
- `server/index.js:1532-1715` - `WebSocketWriter` and `handleChatConnection()` dispatch
- `server/routes/agent.js:452-602` - SSE and collecting writers used by `/api/agent`
- `server/routes/agent.js:618-841` - `/api/agent` request/response contract documentation
- `server/routes/agent.js:842-1000` - `/api/agent` provider dispatch path
- `server/routes/messages.js:1-59` - unified messages endpoint
- `server/routes/copilotkit.js:1-90` - CopilotKit runtime mounting
- `server/agents/ccu-session-agent.js:57-117` - Nolme binding -> provider dispatch mapping
- `server/agents/ccu-session-agent.js:146-268` - AG-UI run wrapper over provider harnesses
- `server/agents/ccu-session-agent.js:270-344` - AG-UI hydration/connect wrapper over provider history
- `server/agents/nolme-ag-ui-writer.js:1-51` - writer shim for AG-UI
- `server/agents/ag-ui-event-translator.js:1-258` - normalized frame -> AG-UI event translation
- `server/providers/types.js:1-119` - shared normalized message and adapter interface
- `server/providers/registry.js:1-44` - provider adapter registry
- `server/providers/claude/adapter.js:213-282` - Claude history normalization
- `server/providers/cursor/adapter.js:163-245` - Cursor SQLite history normalization
- `server/providers/codex/adapter.js:203-247` - Codex history normalization
- `server/providers/gemini/adapter.js:85-150` - Gemini history normalization

## Architecture Documentation

The current architecture separates harness integration into two layers:

1. provider harness entrypoints that know how to talk to a specific SDK or CLI
2. transport wrappers that decide how prompts enter and how normalized frames leave

That separation is visible in the current reuse pattern:

- WebSocket chat uses the provider harnesses directly with `WebSocketWriter`
- `/api/agent` uses the same harnesses with `SSEStreamWriter` or `ResponseCollector`
- Nolme uses the same harnesses again through `CcuSessionAgent` and `NolmeAgUiWriter`

The normalized message contract is the common language across:

- persisted history loading
- live runtime streaming
- frontend session-store merging
- AG-UI event translation for Nolme

## Historical Context (from thoughts/)

The most directly related prior note is the Nolme hydration pass:

- `thoughts/shared/research/2026-04-26-open-in-nolme-session-hydration.md` - documents how an existing session is bound into Nolme, how `/api/sessions/:sessionId/messages` and `/api/nolme/state/:sessionId` are used during hydration, and how `CcuSessionAgent.connect()` replays history for the CopilotKit surface

Related tracked work adjacent to this surface:

- `cam-11u` - Nolme/CopilotKit session-hydration bug investigation

## Related Research

- `thoughts/shared/research/2026-04-26-open-in-nolme-session-hydration.md`

## Open Questions

- This pass traced `cc-agent-ui`'s adapter layer and transport boundaries, but did not inspect the internals of the external CLIs/SDKs beyond the options and events that `cc-agent-ui` passes to them.
