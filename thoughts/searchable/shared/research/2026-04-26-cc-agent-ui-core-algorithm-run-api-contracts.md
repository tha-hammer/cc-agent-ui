---
date: 2026-04-26T15:46:50-04:00
researcher: CobaltSpring
git_commit: b30ad5affbd6e0aac80570cffbf01ecb98ebb3fe
branch: main
repository: cosmic-agent-memory/cc-agent-ui
topic: "cc-agent-ui Algorithm Run API boundary completeness against cosmic-agent-core AAI contracts"
tags: [research, codebase, cc-agent-ui, cosmic-agent-core, algorithm-run-api, contracts, aai]
status: complete
last_updated: 2026-04-26
last_updated_by: CobaltSpring
related_beads: [cam-lml, cam-x3p, cam-b1x, cam-11u]
---

# Research: cc-agent-ui Core Algorithm Run API Contracts

**Date**: 2026-04-26T15:46:50-04:00  
**Researcher**: CobaltSpring  
**Git Commit**: `b30ad5affbd6e0aac80570cffbf01ecb98ebb3fe`  
**Branch**: `main`  
**Repository**: `cosmic-agent-memory/cc-agent-ui`

## Research Question

Study the revised TDD plan at [`thoughts/shared/plans/2026-04-26-cc-agent-ui-algorithm-run-api-boundary-tdd.md`](../plans/2026-04-26-cc-agent-ui-algorithm-run-api-boundary-tdd.md) and the `cosmic-agent-core` AAI documentation files to determine whether the API interfaces and contracts for the `cc-agent-ui` Algorithm Run boundary are complete.

Core documents reviewed:

- `/home/maceo/Dev/cosmic-agent-core/v4.2.0/.claude/AAI/SKILLSYSTEM.md`
- `/home/maceo/Dev/cosmic-agent-core/v4.2.0/.claude/AAI/PAISYSTEMARCHITECTURE.md`
- `/home/maceo/Dev/cosmic-agent-core/v4.2.0/.claude/AAI/PAIAGENTSYSTEM.md`
- `/home/maceo/Dev/cosmic-agent-core/v4.2.0/.claude/AAI/DOCUMENTATIONINDEX.md`

Additional core files reviewed for the live Algorithm CLI contract:

- `/home/maceo/Dev/cosmic-agent-core/v4.2.0/.claude/AAI/Tools/algorithm.ts`
- `/home/maceo/Dev/cosmic-agent-core/v4.2.0/.claude/AAI/CLI.md`
- `/home/maceo/Dev/cosmic-agent-core/v4.2.0/.claude/AAI/PRDFORMAT.md`
- `/home/maceo/Dev/cosmic-agent-core/v4.2.0/.claude/AAI/MEMORYSYSTEM.md`

## Summary

The revised plan is complete as a `cc-agent-ui`-side API contract. It defines authenticated HTTP routes, request and response bodies, ownership, public state projection, append-only event sequencing, local persistence, command-runner invocation, NDJSON frame ingestion, lifecycle operations, question/permission decisions, error codes, and planned tests.

The existing `cc-agent-ui` code has the adjacent surfaces the plan depends on: API-key and bearer-token middleware, authenticated `/api` mount topology, provider normalization types, `/api/sessions/:sessionId/messages`, `/api/agent` route test patterns, WebSocket/SSE writer interfaces, CopilotKit/Nolme auth patterns, and Nolme pending-permission routes.

The reviewed `cosmic-agent-core` AAI documents support a CLI-first boundary with deterministic code before prompts and standard I/O / JSON-oriented tools, but they do not define the specific Algorithm Run HTTP API or the NDJSON runner frame protocol from the plan. The live core Algorithm CLI currently exposes subcommands and flags over `bun`, reads and writes PRD frontmatter, writes `MEMORY/STATE/algorithms/{sessionId}.json`, and emits console output. It does not currently expose the plan's JSON request-line plus NDJSON `accepted | event | state | log | result | error` frame contract.

The current boundary reading is therefore:

- The plan is complete for the `cc-agent-ui` local API and storage boundary.
- `ALGORITHM_RUNNER_COMMAND` is a contract for a runner executable that must speak the plan's NDJSON protocol.
- The existing core `Tools/algorithm.ts` CLI is a related Algorithm implementation surface, but it is not itself the same runner protocol documented by the plan.

## Contract Coverage Matrix

| Concern | Revised plan defines | Existing `cc-agent-ui` support | Existing core support | Current status |
| --- | --- | --- | --- | --- |
| Scope boundary | `cc-agent-ui` only; no Nolme/core/CopilotKit adapter changes ([plan:18](../plans/2026-04-26-cc-agent-ui-algorithm-run-api-boundary-tdd.md#L18)) | Routes and auth can be added under existing server mount topology ([`server/index.js:419`](../../../../server/index.js#L419), [`server/index.js:464`](../../../../server/index.js#L464)) | Core docs describe infrastructure, not this UI route set | Complete as plan scope |
| Authentication | Inherits `authenticateToken`; 401/403 bodies remain existing middleware bodies ([plan:91](../plans/2026-04-26-cc-agent-ui-algorithm-run-api-boundary-tdd.md#L91), [plan:1556](../plans/2026-04-26-cc-agent-ui-algorithm-run-api-boundary-tdd.md#L1556)) | `validateApiKey` and `authenticateToken` already set `req.user` and return 401/403 bodies ([`server/middleware/auth.js:8`](../../../../server/middleware/auth.js#L8), [`server/middleware/auth.js:23`](../../../../server/middleware/auth.js#L23)) | Not applicable to core CLI | Complete for UI boundary |
| API routes | Start, state, events, SSE, lifecycle, question answer, permission decision routes ([plan:307](../plans/2026-04-26-cc-agent-ui-algorithm-run-api-boundary-tdd.md#L307)) | Existing route/test patterns exist; Algorithm route is not present yet | No HTTP API route in reviewed core docs/code | Complete in plan; not implemented in current UI |
| Request and response schemas | Explicit start, state, event, lifecycle, question, permission, and error schemas ([plan:119](../plans/2026-04-26-cc-agent-ui-algorithm-run-api-boundary-tdd.md#L119), [plan:159](../plans/2026-04-26-cc-agent-ui-algorithm-run-api-boundary-tdd.md#L159), [plan:183](../plans/2026-04-26-cc-agent-ui-algorithm-run-api-boundary-tdd.md#L183), [plan:228](../plans/2026-04-26-cc-agent-ui-algorithm-run-api-boundary-tdd.md#L228)) | Existing provider schemas are separate `NormalizedMessage`/`ProviderAdapter` contracts ([`server/providers/types.js:27`](../../../../server/providers/types.js#L27), [`server/providers/types.js:72`](../../../../server/providers/types.js#L72)) | Core has `LoopAlgorithmState`, not `AlgorithmRunState` | Complete in plan; separate from existing provider/core schemas |
| Ownership | Stores `ownerUserId`, filters every run lookup by authenticated owner ([plan:91](../plans/2026-04-26-cc-agent-ui-algorithm-run-api-boundary-tdd.md#L91), [plan:119](../plans/2026-04-26-cc-agent-ui-algorithm-run-api-boundary-tdd.md#L119)) | `authenticateToken` sets `req.user` in current middleware ([`server/middleware/auth.js:64`](../../../../server/middleware/auth.js#L64)) | Core Algorithm state has session/task fields, not UI user ownership | Complete for UI boundary |
| Storage | Local store under `ALGORITHM_RUN_STORE_ROOT`, default `~/.cosmic-agent/algorithm-runs`, with metadata, state, and events JSON/JSONL ([plan:103](../plans/2026-04-26-cc-agent-ui-algorithm-run-api-boundary-tdd.md#L103)) | No existing Algorithm run store module; plan names the module and behavior | Core Algorithm stores under `MEMORY/STATE/algorithms` ([`MEMORYSYSTEM.md:202`](/home/maceo/Dev/cosmic-agent-core/v4.2.0/.claude/AAI/MEMORYSYSTEM.md), `/home/maceo/Dev/cosmic-agent-core/v4.2.0/.claude/AAI/Tools/algorithm.ts:48`) | Complete in plan; distinct from core storage |
| Event sequencing | Run store owns sequence numbers; append-before-publish; replay and corrupt-state behavior ([plan:183](../plans/2026-04-26-cc-agent-ui-algorithm-run-api-boundary-tdd.md#L183)) | Existing provider and AG-UI translators have independent event/message contracts ([`server/agents/ag-ui-event-translator.js:89`](../../../../server/agents/ag-ui-event-translator.js#L89)) | Core has hook domain events and JSONL observability, but not the plan's AlgorithmRunEvent union | Complete in plan; separate from core event bus |
| Runner protocol | JSON request line to child stdin; NDJSON frames on stdout; stderr capped as private diagnostics ([plan:268](../plans/2026-04-26-cc-agent-ui-algorithm-run-api-boundary-tdd.md#L268)) | No existing command-client module; plan defines `server/algorithm/command-client.js` | Core AAI architecture favors CLI and stdio/JSON, but live `Tools/algorithm.ts` accepts flags/subcommands and emits console output | Complete as new runner contract; not evidenced as existing core CLI contract |
| Lifecycle operations | `pause`, `resume`, `cancel`, `stop`, `archive` HTTP routes and runner events ([plan:449](../plans/2026-04-26-cc-agent-ui-algorithm-run-api-boundary-tdd.md#L449)) | Existing UI APIs use route modules and auth wrappers | Core CLI has `pause`, `resume`, `stop` subcommands that mutate PRD frontmatter (`/home/maceo/Dev/cosmic-agent-core/v4.2.0/.claude/AAI/Tools/algorithm.ts:1412`) | Same lifecycle concepts; different wire contract |
| Questions and permissions | Pending question/permission schemas and answer/decision routes ([plan:228](../plans/2026-04-26-cc-agent-ui-algorithm-run-api-boundary-tdd.md#L228), [plan:509](../plans/2026-04-26-cc-agent-ui-algorithm-run-api-boundary-tdd.md#L509)) | Nolme has pending-permission GET/decision POST routes and normalized permission/prompt frames ([`server/routes/nolme-state.js:45`](../../../../server/routes/nolme-state.js#L45), [`server/agents/ag-ui-event-translator.js:205`](../../../../server/agents/ag-ui-event-translator.js#L205)) | Reviewed core docs do not define this HTTP interaction contract | Complete in plan; adjacent UI patterns exist |
| Tests | Lists focused TDD files for schemas, store, routes, SSE, lifecycle, security, and command client ([plan:579](../plans/2026-04-26-cc-agent-ui-algorithm-run-api-boundary-tdd.md#L579)) | Existing generated tests use Vitest, route-level Express apps, hoisted mocks, and fetch-based assertions | Not applicable | Complete as planned test inventory; files are not present yet |

## Detailed Findings

### Revised Plan Contract

The plan explicitly restricts the work to `cc-agent-ui` and states that it does not modify Nolme, `cosmic-agent-core`, provider adapters, or CopilotKit runtime adapters ([plan:18](../plans/2026-04-26-cc-agent-ui-algorithm-run-api-boundary-tdd.md#L18), [plan:65](../plans/2026-04-26-cc-agent-ui-algorithm-run-api-boundary-tdd.md#L65)). This matches the plan's API shape: it adds a local `/api/algorithm-runs` surface rather than changing an existing provider transport.

The plan's desired end state names the module boundaries: HTTP route contracts, `command-client`, `process-registry`, `run-store`, `server/routes/algorithm-runs.js`, and server mounting/authentication ([plan:51](../plans/2026-04-26-cc-agent-ui-algorithm-run-api-boundary-tdd.md#L51)). It also documents absent formal artifacts and identifies the Nolme resource registry schema as not reusable for this boundary ([plan:76](../plans/2026-04-26-cc-agent-ui-algorithm-run-api-boundary-tdd.md#L76)).

The review-resolution section fills the main previously missing API contracts: external process over stdin/stdout NDJSON, `ownerUserId`, one run-store module, JSON-array `ALGORITHM_RUNNER_COMMAND`, Algorithm events separate from `NormalizedMessage`/AG-UI/Nolme, and inherited `authenticateToken` error bodies ([plan:91](../plans/2026-04-26-cc-agent-ui-algorithm-run-api-boundary-tdd.md#L91)).

The storage contract defines server-local data only. It stores under `ALGORITHM_RUN_STORE_ROOT`, defaulting to `~/.cosmic-agent/algorithm-runs`, and explicitly does not expose client paths, storage roots, event filenames, runner commands, raw stderr, or private tool input through the public state API ([plan:103](../plans/2026-04-26-cc-agent-ui-algorithm-run-api-boundary-tdd.md#L103), [plan:159](../plans/2026-04-26-cc-agent-ui-algorithm-run-api-boundary-tdd.md#L159)).

The public state and event contracts are explicit. `AlgorithmRunMetadata` includes ownership, run ids, nullable session and runner handles, process ids, status, timestamps, and last sequence ([plan:119](../plans/2026-04-26-cc-agent-ui-algorithm-run-api-boundary-tdd.md#L119)). `AlgorithmRunState` exposes public run status, phase, progress, decisions, pending questions, pending permissions, outputs, error summary, and timestamps ([plan:159](../plans/2026-04-26-cc-agent-ui-algorithm-run-api-boundary-tdd.md#L159)). `AlgorithmRunEvent` is an append-only union with store-owned sequence numbers and projection rules ([plan:183](../plans/2026-04-26-cc-agent-ui-algorithm-run-api-boundary-tdd.md#L183)).

The command boundary is also explicit. The plan defines `parseRunnerCommandEnv`, `runAlgorithmCommand`, `startAlgorithmRun`, and `mapRunnerResultToHttp`; sends one JSON request line to child stdin; ingests NDJSON frames from stdout; handles malformed frames, stderr caps, EOF, spawn errors, and timeout behavior ([plan:268](../plans/2026-04-26-cc-agent-ui-algorithm-run-api-boundary-tdd.md#L268)).

The route contract is complete at the HTTP layer. It covers start, state read, event history, SSE replay/live stream, lifecycle mutation, question answers, and permission decisions ([plan:307](../plans/2026-04-26-cc-agent-ui-algorithm-run-api-boundary-tdd.md#L307)). It also defines route-specific error codes and says inherited auth failures keep the existing auth body shapes ([plan:1556](../plans/2026-04-26-cc-agent-ui-algorithm-run-api-boundary-tdd.md#L1556)).

### Existing cc-agent-ui Interfaces

The server already has the auth and route-mount pattern the plan depends on. `validateApiKey` optionally enforces `x-api-key` against `API_KEY` and returns a 401 invalid key body ([`server/middleware/auth.js:8`](../../../../server/middleware/auth.js#L8)). `authenticateToken` supports platform mode, bearer tokens, query tokens, and sets `req.user` on success ([`server/middleware/auth.js:23`](../../../../server/middleware/auth.js#L23)). The main server applies API-key validation under `/api` and separately mounts authenticated route groups ([`server/index.js:419`](../../../../server/index.js#L419), [`server/index.js:464`](../../../../server/index.js#L464)).

The provider and message contracts are separate from the planned Algorithm Run events. `server/providers/types.js` defines provider names, normalized message kinds, `NormalizedMessage`, history results, `ProviderAdapter`, and `createNormalizedMessage()` ([`server/providers/types.js:13`](../../../../server/providers/types.js#L13), [`server/providers/types.js:27`](../../../../server/providers/types.js#L27), [`server/providers/types.js:72`](../../../../server/providers/types.js#L72), [`server/providers/types.js:106`](../../../../server/providers/types.js#L106)). The plan keeps Algorithm events distinct from these provider frames.

Existing route tests provide the local pattern for the planned API tests. `tests/generated/test_copilotkit_route_auth.spec.ts` uses an isolated Express app and hoisted mocks to assert auth behavior for `/api/copilotkit`. `tests/generated/test_nolme_state_route.spec.ts` uses a similar route-level style for Nolme state. No `test_algorithm_*` generated test files were present during this research pass.

The current `/api/agent` route is an SSE or JSON command surface for provider commands, not Algorithm runs. It documents its inline contract around [`server/routes/agent.js:618`](../../../../server/routes/agent.js#L618), validates request fields around [`server/routes/agent.js:853`](../../../../server/routes/agent.js#L853), creates an SSE writer or response collector around [`server/routes/agent.js:918`](../../../../server/routes/agent.js#L918), and dispatches to Claude/Cursor/Codex/Gemini around [`server/routes/agent.js:947`](../../../../server/routes/agent.js#L947).

The WebSocket harness uses a writer object with `.send()`, `.setSessionId()`, and `.getSessionId()` methods ([`server/index.js:1525`](../../../../server/index.js#L1525)). The plan's runner frame ingestion is not built on this writer, but it follows the same server pattern of translating a lower-level provider/process stream into server-owned public events.

Nolme has adjacent question and permission routes. `server/routes/nolme-state.js` exposes pending-permission read and decision write routes ([`server/routes/nolme-state.js:45`](../../../../server/routes/nolme-state.js#L45), [`server/routes/nolme-state.js:66`](../../../../server/routes/nolme-state.js#L66)). `ag-ui-event-translator` maps `permission_request` and `interactive_prompt` normalized frames into AG-UI tool events ([`server/agents/ag-ui-event-translator.js:205`](../../../../server/agents/ag-ui-event-translator.js#L205)). These are similar interaction concepts, but the plan defines a separate Algorithm Run interaction contract.

### cosmic-agent-core AAI Contracts

`PAISYSTEMARCHITECTURE.md` describes the infrastructure posture that matches a child-process runner boundary: deterministic code before prompts, spec/test/evals before implementation, UNIX-style composable tools, and CLIs as interfaces. The relevant sections describe "Code before prompts", "Spec / Tests / Evals first", "UNIX Philosophy", "CLI as interface", and the progression "Goal -> Code -> CLI -> Prompts -> Agents" (`/home/maceo/Dev/cosmic-agent-core/v4.2.0/.claude/AAI/PAISYSTEMARCHITECTURE.md:132`, `:143`, `:154`, `:175`, `:187`).

`SKILLSYSTEM.md` defines the skill system as markdown instructions plus executable tools under a skill directory. It documents required structure, activation via `USE WHEN`, and workflow-to-tool integration (`/home/maceo/Dev/cosmic-agent-core/v4.2.0/.claude/AAI/SKILLSYSTEM.md:1`, `:34`, `:112`). This supports the plan's assumption that a workflow can be invoked behind a stable external command, but it does not define the plan's runner frame schema.

`PAIAGENTSYSTEM.md` describes three agent systems: Task Tool Subagent Types, Named Agents, and Custom Agents, and it states that custom agents must be created through the Agents skill and ComposeAgent path (`/home/maceo/Dev/cosmic-agent-core/v4.2.0/.claude/AAI/PAIAGENTSYSTEM.md:1`, `:19`, `:39`). The plan's `ALGORITHM_RUNNER_COMMAND` boundary does not directly use these APIs; it treats the runner as an external executable.

`DOCUMENTATIONINDEX.md` indexes the AAI docs and points to CLI, CLI-first architecture, skill system, memory system, hooks, and agent system docs (`/home/maceo/Dev/cosmic-agent-core/v4.2.0/.claude/AAI/DOCUMENTATIONINDEX.md:14`). It does not list an Algorithm Run HTTP API contract or a runner-frame specification.

### Live Core Algorithm CLI

The live core Algorithm implementation is `/home/maceo/Dev/cosmic-agent-core/v4.2.0/.claude/AAI/Tools/algorithm.ts`. It describes "THE ALGORITHM CLI" with loop and interactive modes, dashboard integration, and commands `new`, `status`, `pause`, `resume`, and `stop` (`algorithm.ts:1`, `:9`). It parses CLI arguments and subcommands, including flags such as `--mode`, `--prd`, `--max`, `--agents`, `--title`, and `--effort` (`algorithm.ts:148`, `:188`).

Its state shape is `LoopAlgorithmState`, not `AlgorithmRunState`. The state includes session id, task, phase, SLA, criteria, agents, capabilities, PRD path, phase history, completion summary, loop fields, parallel-agent count, and mode (`algorithm.ts:81`). State is stored under `MEMORY/STATE/algorithms/{sessionId}.json` through `readAlgorithmState()` and `writeAlgorithmState()` (`algorithm.ts:48`, `:235`).

The core Algorithm CLI reads and mutates PRD files. `readPRD()` parses YAML-like frontmatter and PRD content (`algorithm.ts:293`). `countCriteria()` extracts checklist criteria (`algorithm.ts:366`). `runLoop()` creates and updates state, updates PRD frontmatter, checks complete/blocked/max-iteration/paused/stopped states, and emits human-readable console output (`algorithm.ts:864`, `:887`, `:933`, `:984`, `:1067`, `:1155`).

Lifecycle controls exist in core, but their wire shape differs from the plan. `pauseLoop()`, `resumeLoop()`, and `stopLoop()` mutate `loopStatus` in PRD frontmatter and, for resume, call `runLoop()` (`algorithm.ts:1412`, `:1425`, `:1438`). The plan's lifecycle routes mutate a UI run store and communicate over `AlgorithmRunEvent` records.

Core memory documentation describes Algorithm state and events as observability and work-state files. `MEMORYSYSTEM.md` documents `STATE/algorithms/` as per-session Algorithm state and `STATE/events.jsonl` as a unified event log with `timestamp`, `session_id`, `source`, and `type` fields (`/home/maceo/Dev/cosmic-agent-core/v4.2.0/.claude/AAI/MEMORYSYSTEM.md:202`, `:208`, `:216`). This is related to the plan's local store, but it is not the same public event schema.

## Current Interface Boundary Statement

The plan's API interfaces are complete for `cc-agent-ui` as the owner of:

- HTTP route bodies and status codes.
- Auth and ownership checks.
- Public run state projection.
- Event history and SSE replay.
- Local metadata/state/event persistence.
- Child process invocation and NDJSON frame handling.
- Decision routes for questions and permissions.

The core AAI documents establish a compatible architectural posture for external commands and JSON-oriented tooling, but the reviewed core docs and live `Tools/algorithm.ts` do not define the exact protocol that `server/algorithm/command-client.js` expects. The named executable behind `ALGORITHM_RUNNER_COMMAND` is therefore the current handoff point between the UI plan and core infrastructure.

No existing `AlgorithmRunState`, `AlgorithmRunEvent`, `algorithm.run.started`, or `algorithm.phase.changed` symbols were found in the reviewed `cc-agent-ui` and `cosmic-agent-core` surfaces. Existing analogous surfaces are `LoopAlgorithmState` in core, `DomainEvent` in core hooks, `NormalizedMessage` in `cc-agent-ui` providers, and `NolmeAgentState` in Nolme.

## Code References

- [`thoughts/shared/plans/2026-04-26-cc-agent-ui-algorithm-run-api-boundary-tdd.md:18`](../plans/2026-04-26-cc-agent-ui-algorithm-run-api-boundary-tdd.md#L18) - Revised plan scope: `cc-agent-ui` only.
- [`thoughts/shared/plans/2026-04-26-cc-agent-ui-algorithm-run-api-boundary-tdd.md:91`](../plans/2026-04-26-cc-agent-ui-algorithm-run-api-boundary-tdd.md#L91) - Review-resolved decisions for NDJSON, ownership, store, command env, event separation, and auth bodies.
- [`thoughts/shared/plans/2026-04-26-cc-agent-ui-algorithm-run-api-boundary-tdd.md:103`](../plans/2026-04-26-cc-agent-ui-algorithm-run-api-boundary-tdd.md#L103) - Run store path and file layout.
- [`thoughts/shared/plans/2026-04-26-cc-agent-ui-algorithm-run-api-boundary-tdd.md:119`](../plans/2026-04-26-cc-agent-ui-algorithm-run-api-boundary-tdd.md#L119) - `AlgorithmRunMetadata` schema.
- [`thoughts/shared/plans/2026-04-26-cc-agent-ui-algorithm-run-api-boundary-tdd.md:159`](../plans/2026-04-26-cc-agent-ui-algorithm-run-api-boundary-tdd.md#L159) - Public `AlgorithmRunState` schema.
- [`thoughts/shared/plans/2026-04-26-cc-agent-ui-algorithm-run-api-boundary-tdd.md:183`](../plans/2026-04-26-cc-agent-ui-algorithm-run-api-boundary-tdd.md#L183) - `AlgorithmRunEvent` union and projection rules.
- [`thoughts/shared/plans/2026-04-26-cc-agent-ui-algorithm-run-api-boundary-tdd.md:268`](../plans/2026-04-26-cc-agent-ui-algorithm-run-api-boundary-tdd.md#L268) - Runner command and NDJSON frame protocol.
- [`thoughts/shared/plans/2026-04-26-cc-agent-ui-algorithm-run-api-boundary-tdd.md:307`](../plans/2026-04-26-cc-agent-ui-algorithm-run-api-boundary-tdd.md#L307) - HTTP route contracts.
- [`server/middleware/auth.js:8`](../../../../server/middleware/auth.js#L8) - API-key middleware.
- [`server/middleware/auth.js:23`](../../../../server/middleware/auth.js#L23) - Bearer/platform auth middleware.
- [`server/index.js:419`](../../../../server/index.js#L419) - `/api` API-key validation mount.
- [`server/index.js:464`](../../../../server/index.js#L464) - Authenticated route mounts.
- [`server/providers/types.js:27`](../../../../server/providers/types.js#L27) - `NormalizedMessage` contract.
- [`server/providers/types.js:72`](../../../../server/providers/types.js#L72) - `ProviderAdapter` contract.
- [`server/routes/agent.js:618`](../../../../server/routes/agent.js#L618) - Existing `/api/agent` contract documentation.
- [`server/routes/nolme-state.js:45`](../../../../server/routes/nolme-state.js#L45) - Existing Nolme pending-permission route.
- [`server/agents/ag-ui-event-translator.js:89`](../../../../server/agents/ag-ui-event-translator.js#L89) - AG-UI translation entrypoint.
- `/home/maceo/Dev/cosmic-agent-core/v4.2.0/.claude/AAI/PAISYSTEMARCHITECTURE.md:154` - Core UNIX/stdio/JSON architecture.
- `/home/maceo/Dev/cosmic-agent-core/v4.2.0/.claude/AAI/Tools/algorithm.ts:81` - Core `LoopAlgorithmState`.
- `/home/maceo/Dev/cosmic-agent-core/v4.2.0/.claude/AAI/Tools/algorithm.ts:148` - Core Algorithm CLI argument parsing.
- `/home/maceo/Dev/cosmic-agent-core/v4.2.0/.claude/AAI/Tools/algorithm.ts:864` - Core loop runner.
- `/home/maceo/Dev/cosmic-agent-core/v4.2.0/.claude/AAI/Tools/algorithm.ts:1412` - Core pause/resume/stop lifecycle functions.

## Architecture Documentation

The existing architecture has three adjacent but separate contracts:

1. `cc-agent-ui` provider harness contracts, centered on `NormalizedMessage`, `ProviderAdapter`, WebSocket writers, `/api/agent`, and AG-UI translation.
2. `cc-agent-ui` Nolme work-surface contracts, centered on `NolmeAgentState`, session binding, hydrated provider history, sidecar state, and pending permission routes.
3. `cosmic-agent-core` Algorithm contracts, centered on PRD files, `LoopAlgorithmState`, `MEMORY/STATE/algorithms`, hook-domain events, and CLI lifecycle commands.

The revised plan introduces a fourth contract: `cc-agent-ui` Algorithm Run API. It deliberately does not reuse provider messages, AG-UI events, Nolme state, or core state files as public API shapes. It uses them as surrounding context while defining its own run state, event, storage, route, and runner command interfaces.

## Historical Context

The older review document [`thoughts/shared/plans/2026-04-26-cc-agent-ui-algorithm-run-api-boundary-tdd-REVIEW.md`](../plans/2026-04-26-cc-agent-ui-algorithm-run-api-boundary-tdd-REVIEW.md) recorded `status: needs_major_revision` and identified missing contracts around asynchronous runner ingestion, ownership, state/events, auth envelope behavior, and persistence. The current revised plan contains explicit sections for each of those areas.

Related local research:

- [`thoughts/shared/research/2026-04-26-cc-agent-ui-harness-middleware-interfaces.md`](./2026-04-26-cc-agent-ui-harness-middleware-interfaces.md) - Documents existing provider harness middleware, writer, and normalized frame interfaces.
- [`thoughts/shared/research/2026-04-26-nolme-algorithm-interface-surfaces.md`](./2026-04-26-nolme-algorithm-interface-surfaces.md) - Documents existing Nolme, provider harness, and core Algorithm state surfaces; notes that exact `AlgorithmRunState`/`AlgorithmEvent` symbols were not present.
- [`thoughts/shared/research/2026-04-26-open-in-nolme-session-hydration.md`](./2026-04-26-open-in-nolme-session-hydration.md) - Documents Nolme session hydration and provider-history paths.

Related beads:

- `cam-lml` - Plan review issue for Algorithm Run API boundary needing major revision.
- `cam-x3p` - Plan review issue for this TDD plan.
- `cam-b1x` - Implementation issue for Algorithm Run API boundary for Nolme.
- `cam-11u` - Nolme session hydration issue that is adjacent to the provider-history and work-surface contracts.

## Open Questions

- Which executable will be configured as `ALGORITHM_RUNNER_COMMAND` for the first implementation pass?
- Will that executable be a compatibility wrapper around current `Tools/algorithm.ts`, a new core CLI mode, or a separate runner located with `cc-agent-ui`?
- Is the planned default store root `~/.cosmic-agent/algorithm-runs` intentionally separate from core's documented `MEMORY/STATE/algorithms` state directory?
- Which fields, if any, should map between core `LoopAlgorithmState` and the plan's public `AlgorithmRunState` projection?

## Short Answer

  Use a cc-agent-ui-owned runner adapter as the first real executable:

  ALGORITHM_RUNNER_COMMAND='["node","./server/algorithm/runner-adapter.js"]'

  For tests, use a deterministic fixture runner instead:

  ALGORITHM_RUNNER_COMMAND='["node","./tests/fixtures/algorithm-runner-fixture.js"]'

  The executable is needed because the API contract is process-based: cc-agent-ui writes
  one JSON request to stdin and reads structured NDJSON frames from stdout. The current
  core Algorithm CLI does not speak that protocol directly.

  Executable Decision

  The first implementation pass should use a separate runner located in cc-agent-ui,
  implemented as a compatibility wrapper around core behavior.

  That means:

  - server/algorithm/command-client.js owns spawning and frame parsing.
  - server/algorithm/runner-adapter.js owns adapting the stable NDJSON protocol to
    whatever core currently exposes.
  - The current core file, /home/maceo/Dev/cosmic-agent-core/v4.2.0/.claude/AAI/Tools/
    algorithm.ts, should not be configured directly as ALGORITHM_RUNNER_COMMAND.

  Why not point directly at Tools/algorithm.ts?

  Because it currently accepts CLI flags/subcommands, reads PRD frontmatter, writes
  MEMORY/STATE/algorithms, and prints console output. The plan requires a child process
  that accepts this:

  {"schemaVersion":1,"kind":"request","command":"start","requestId":"...","runId":"...","o
  wnerUserId":"...","payload":{}}

  and emits this kind of stream:

  {"schemaVersion":1,"kind":"accepted","requestId":"...","runId":"...","externalRunHandle"
  :"...","sessionId":null}
  {"schemaVersion":1,"kind":"state","runId":"...","state":
  {"status":"running","sessionId":"..."}}
  {"schemaVersion":1,"kind":"result","requestId":"...","runId":"...","ok":true,"status":"c
  ompleted"}

  The wrapper gives the API a stable protocol now, without requiring a core change. Later,
  core can add a native runner mode that speaks the same protocol, and only
  ALGORITHM_RUNNER_COMMAND changes.

  Why An Executable At All

  The API needs a spawned executable because Algorithm runs are long-lived and
  operationally separate from the HTTP request lifecycle.

  It gives you:

  - A stable stdin/stdout protocol instead of importing core internals.
  - Process isolation from core dependencies, crashes, stdout noise, and runtime
    assumptions.
  - A pid for stop/cancel handling through the process registry.
  - Deterministic tests by swapping in fixture executables.
  - Deployment flexibility: dev, test, and prod can point at different runners without
    changing route code.
  - A clean trust boundary: the API store decides what becomes public state/events.

  Wrapper vs Core Mode

  Answer this as:

  > First pass: a cc-agent-ui compatibility runner. Future pass: optional native core
  > runner mode.

  A new core CLI mode would be cleaner long term, but it violates the current plan’s cc-
  agent-ui only scope. The wrapper is the correct first step because it makes the API
  contract testable and complete without changing core.

  Store Root

  Yes, ~/.cosmic-agent/algorithm-runs should stay intentionally separate from core’s
  MEMORY/STATE/algorithms.

  Reason: they store different things.

  cc-agent-ui store:

  - Auth-scoped by ownerUserId.
  - Public API projection.
  - Append-only events with sequence cursors.
  - SSE replay source.
  - Sanitized state, no raw stderr, no private paths.

  Core store:

  - Core implementation state.
  - PRD/frontmatter/workflow state.
  - Not user-auth scoped.
  - Not the public API schema.
  - May include paths or implementation details.

  The UI store can reference core through externalRunHandle and sessionId, but it should
  not share core’s mutable state files as its API source of truth.

  Field Mapping

  Use a minimal first-pass mapping:

  | Core LoopAlgorithmState | API field |
  | --- | --- |
  | sessionId | metadata.sessionId, state.sessionId once known |
  | mode or PRD mode | metadata.algorithmMode |
  | currentPhase or PRD phase | state.phase |
  | algorithmStartedAt / PRD started | startedAt |
  | completedAt | endedAt |
  | active/running state | status: "running" |
  | PRD loopStatus: paused | status: "paused" |
  | PRD/core completed outcome | status: "completed" |
  | PRD/core failed outcome | status: "failed" |
  | PRD/core stopped outcome | status: "cancelled" |
  | core handle / PRD slug / core session handle | metadata.externalRunHandle |

  Do not expose these in first-pass public state:

  - prdPath
  - loopPrdPath
  - projectPath
  - raw criteria bodies
  - agent internals
  - capabilities
  - raw console output
  - raw stderr
  - private tool input

  Those can be emitted as sanitized events later if needed, but they should not be part of
  the public AlgorithmRunState unless the plan adds explicit fields for them.

## Research Notes

`zettel recall --status in_progress -l 10 -d connected` was attempted at session start per repo instructions and failed with `curl: (56) Recv failure: Connection reset by peer`.

Subagent notes were written under `/tmp/cc-agent-ui-api-boundary-research-20260426/` during the research pass:

- `cc-agent-ui-api-surfaces.md`
- `local-plan-research-tests.md`
- `core-aai-doc-contracts.md`
