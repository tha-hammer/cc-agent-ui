---
date: 2026-04-26T20:58:23-04:00
researcher: maceo
git_commit: ed58338f4806b2690acff208e7eb539799857384
branch: main
repository: cosmic-agent-memory
topic: "How to use the cc-agent-ui Algorithm Run API"
tags: [research, codebase, cc-agent-ui, algorithm-runs, api]
status: complete
last_updated: 2026-04-26
last_updated_by: maceo
---

# How to use the cc-agent-ui Algorithm Run API

Use this guide when you need to start an Algorithm run through `cc-agent-ui`, read its current public state, consume ordered run events, send lifecycle commands, or resolve pending question and permission requests.

## Prerequisites

- A running `cc-agent-ui` server with `/api/algorithm-runs` mounted behind the existing authenticated API routes.
- A valid app JWT for the user that should own the run.
- If `API_KEY` is configured, the matching `x-api-key` header for all `/api/*` requests.
- `ALGORITHM_RUNNER_COMMAND` set to a JSON array command, for example:

```bash
export ALGORITHM_RUNNER_COMMAND='["node","./server/algorithm-runs/runner-adapter.js"]'
```

- Optional: `ALGORITHM_RUN_STORE_ROOT` set when you want run metadata, state, and event logs outside the default `~/.cosmic-agent/algorithm-runs`.

## Steps

1. **Configure the runner command**

   Set `ALGORITHM_RUNNER_COMMAND` to a JSON array of non-empty strings. The command client parses this value and spawns the executable without shell interpolation.

   ```bash
   export ALGORITHM_RUNNER_COMMAND='["node","./server/algorithm-runs/runner-adapter.js"]'
   ```

   The runner receives one JSON request line on stdin and emits newline-delimited JSON frames on stdout. For tests and local harnesses, the deterministic fixture is `tests/fixtures/algorithm-runner-fixture.mjs`.

2. **Start a run**

   Send `POST /api/algorithm-runs` with schema version `1`, an existing absolute `projectPath`, a non-empty `prompt`, and one supported provider: `claude`, `cursor`, `codex`, or `gemini`.

   ```bash
   curl -sS -X POST "$BASE_URL/api/algorithm-runs" \
     -H "Authorization: Bearer $JWT" \
     -H "Content-Type: application/json" \
     -H "x-api-key: $API_KEY" \
     -d '{
       "schemaVersion": 1,
       "projectPath": "/absolute/path/to/project",
       "prompt": "Implement the requested task",
       "provider": "claude",
       "model": "sonnet"
     }'
   ```

   A successful start returns HTTP `202` after the runner emits `accepted` and the server stores `algorithm.runner.accepted` as the first event. The response includes the generated `runId`, current cursor, and links for state and events.

3. **Read the current state**

   Call `GET /api/algorithm-runs/:runId/state` as the same authenticated owner.

   ```bash
   curl -sS "$BASE_URL/api/algorithm-runs/$RUN_ID/state" \
     -H "Authorization: Bearer $JWT" \
     -H "x-api-key: $API_KEY"
   ```

   The state response contains public run state only: provider, model, status, session id, phase, event cursor, pending question or permission, last error, and timestamps.

4. **Read events after a cursor**

   Call `GET /api/algorithm-runs/:runId/events?after=<sequence>`.

   ```bash
   curl -sS "$BASE_URL/api/algorithm-runs/$RUN_ID/events?after=1" \
     -H "Authorization: Bearer $JWT" \
     -H "x-api-key: $API_KEY"
   ```

   Use the returned `cursor.sequence` as the next `after` value. Empty or omitted `after` starts at `0`.

5. **Stream events with SSE**

   Add `stream=1` to the events route. Because EventSource-style clients cannot always set headers, the existing auth middleware also accepts the JWT as a `token` query parameter.

   ```bash
   curl -N "$BASE_URL/api/algorithm-runs/$RUN_ID/events?after=0&stream=1&token=$JWT" \
     -H "x-api-key: $API_KEY"
   ```

   The stream emits `algorithm.event` frames for backlog and new events. Heartbeats use `algorithm.heartbeat` and include the current cursor.

6. **Pause, resume, or stop a run**

   Send lifecycle commands to the run owner routes.

   ```bash
   curl -sS -X POST "$BASE_URL/api/algorithm-runs/$RUN_ID/pause" \
     -H "Authorization: Bearer $JWT" \
     -H "x-api-key: $API_KEY"

   curl -sS -X POST "$BASE_URL/api/algorithm-runs/$RUN_ID/resume" \
     -H "Authorization: Bearer $JWT" \
     -H "x-api-key: $API_KEY"

   curl -sS -X POST "$BASE_URL/api/algorithm-runs/$RUN_ID/stop" \
     -H "Authorization: Bearer $JWT" \
     -H "Content-Type: application/json" \
     -H "x-api-key: $API_KEY" \
     -d '{"reason":"operator requested stop"}'
   ```

   Pause and resume forward typed runner commands and then project the updated state. Stop also terminates a registered active runner process.

7. **Answer a pending question**

   First read state and take the id from `state.pendingQuestion.id`. Then post the answer to the matching question route.

   ```bash
   curl -sS -X POST "$BASE_URL/api/algorithm-runs/$RUN_ID/questions/$QUESTION_ID/answer" \
     -H "Authorization: Bearer $JWT" \
     -H "Content-Type: application/json" \
     -H "x-api-key: $API_KEY" \
     -d '{
       "schemaVersion": 1,
       "answer": "Use the unit test target",
       "metadata": { "source": "operator" }
     }'
   ```

   The route clears the pending question only after the runner command succeeds.

8. **Decide a pending permission request**

   First read state and take the id from `state.pendingPermission.id`. Then post the decision to the matching permission route.

   ```bash
   curl -sS -X POST "$BASE_URL/api/algorithm-runs/$RUN_ID/permissions/$PERMISSION_ID/decision" \
     -H "Authorization: Bearer $JWT" \
     -H "Content-Type: application/json" \
     -H "x-api-key: $API_KEY" \
     -d '{
       "schemaVersion": 1,
       "allow": true,
       "message": "Approved for this run"
     }'
   ```

   The route rejects stale permission ids before calling the runner.

9. **Handle API errors**

   After auth succeeds, Algorithm Run routes return versioned error envelopes:

   ```json
   {
     "ok": false,
     "schemaVersion": 1,
     "error": {
       "code": "invalid_request",
       "message": "prompt is required"
     }
   }
   ```

   Common status mappings are: `400 invalid_request`, `403 forbidden`, `404 not_found`, `409 conflict`, `503 runner_unavailable`, `504 runner_timeout`, `502 runner_protocol_error`, and `500 state_corrupt`.

   Auth and API-key failures happen before the Algorithm router and keep the existing plain bodies such as `{ "error": "Invalid API key" }`, `{ "error": "Access denied. No token provided." }`, and `{ "error": "Invalid token" }`.

## Implementation Links

- Route mount: `server/index.js`
- Route handlers: `server/routes/algorithm-runs.js`
- Validation and envelopes: `server/algorithm-runs/contracts.js`
- Runner command protocol: `server/algorithm-runs/command-client.js`
- File-backed run store: `server/algorithm-runs/run-store.js`
- SSE streaming helper: `server/algorithm-runs/sse.js`
- Active process registry: `server/algorithm-runs/process-registry.js`
- Adapter executable: `server/algorithm-runs/runner-adapter.js`
- TDD plan: `thoughts/searchable/shared/plans/2026-04-26-cc-agent-ui-algorithm-run-api-boundary-tdd.md`
