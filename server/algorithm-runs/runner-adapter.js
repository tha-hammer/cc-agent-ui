import { pathToFileURL } from 'url';

const SAFE_STATUSES = new Set(['running', 'paused', 'completed', 'failed', 'cancelled']);

function statusFromCore(coreState = {}) {
  const candidate = coreState.status ?? coreState.loopStatus ?? coreState.outcome;
  if (candidate === 'stopped') return 'cancelled';
  if (candidate === 'active') return 'running';
  if (SAFE_STATUSES.has(candidate)) return candidate;
  return 'running';
}

export function mapCoreAlgorithmStateToRunState(coreState = {}) {
  const state = {
    schemaVersion: 1,
    sessionId: coreState.sessionId ?? null,
    phase: coreState.phase ?? coreState.currentPhase ?? null,
    status: statusFromCore(coreState),
  };
  if (coreState.startedAt) state.startedAt = coreState.startedAt;
  if (coreState.endedAt ?? coreState.completedAt) state.endedAt = coreState.endedAt ?? coreState.completedAt;
  if (coreState.externalRunHandle ?? coreState.handle ?? coreState.slug) {
    state.externalRunHandle = coreState.externalRunHandle ?? coreState.handle ?? coreState.slug;
  }
  return state;
}

function makeErrorFrame(request, code, message) {
  return {
    schemaVersion: 1,
    kind: 'error',
    requestId: request?.requestId ?? 'unknown',
    runId: request?.runId ?? 'unknown',
    error: { code, message },
  };
}

function validateRequest(request) {
  if (!request || typeof request !== 'object' || Array.isArray(request)) {
    return 'request must be an object';
  }
  if (request.schemaVersion !== 1 || request.kind !== 'request') {
    return 'unsupported request schema';
  }
  for (const field of ['command', 'requestId', 'runId', 'ownerUserId']) {
    if (typeof request[field] !== 'string' || request[field].trim() === '') {
      return `${field} is required`;
    }
  }
  return null;
}

export async function handleRunnerRequest(request) {
  const invalid = validateRequest(request);
  if (invalid) {
    return [makeErrorFrame(request, 'runner_protocol_error', invalid)];
  }

  if (request.command === 'start') {
    return [
      {
        schemaVersion: 1,
        kind: 'accepted',
        requestId: request.requestId,
        runId: request.runId,
        externalRunHandle: `adapter-${request.runId}`,
        sessionId: null,
      },
      {
        schemaVersion: 1,
        kind: 'event',
        runId: request.runId,
        event: { type: 'algorithm.run.started', payload: {} },
      },
      {
        schemaVersion: 1,
        kind: 'result',
        requestId: request.requestId,
        runId: request.runId,
        ok: true,
        status: 'completed',
      },
    ];
  }

  if (['pause', 'resume', 'stop', 'answerQuestion', 'decidePermission'].includes(request.command)) {
    return [
      {
        schemaVersion: 1,
        kind: 'result',
        requestId: request.requestId,
        runId: request.runId,
        ok: true,
      },
    ];
  }

  return [makeErrorFrame(request, 'invalid_request', 'unknown command')];
}

async function readStdin() {
  process.stdin.setEncoding('utf8');
  let input = '';
  for await (const chunk of process.stdin) {
    input += chunk;
    if (input.includes('\n')) break;
  }
  return input.trim();
}

async function main() {
  let request;
  try {
    request = JSON.parse(await readStdin());
  } catch {
    process.stdout.write(`${JSON.stringify(makeErrorFrame(null, 'runner_protocol_error', 'invalid JSON request line'))}\n`);
    return;
  }
  const frames = await handleRunnerRequest(request);
  for (const frame of frames) {
    process.stdout.write(`${JSON.stringify(frame)}\n`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main().catch(() => {
    process.stdout.write(`${JSON.stringify(makeErrorFrame(null, 'runner_protocol_error', 'runner adapter failed'))}\n`);
  });
}

