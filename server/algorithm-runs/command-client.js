import { spawn } from 'child_process';
import {
  ALGORITHM_SCHEMA_VERSION,
  createAlgorithmError,
  getHttpStatusForErrorCode,
  makeApiError,
  makeErrorResult,
  makeOkResult,
} from './contracts.js';
import {
  markAlgorithmProcessTerminal,
  registerAlgorithmProcess,
  unregisterAlgorithmProcess,
} from './process-registry.js';

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_STDOUT_BYTES = 1024 * 1024;
const DEFAULT_MAX_STDERR_BYTES = 256 * 1024;

export function parseRunnerCommandEnv(value = process.env.ALGORITHM_RUNNER_COMMAND) {
  if (typeof value !== 'string' || value.trim() === '') {
    return makeErrorResult('runner_unavailable', 'ALGORITHM_RUNNER_COMMAND is not configured');
  }
  let parsed;
  try {
    parsed = JSON.parse(value);
  } catch {
    return makeErrorResult('runner_unavailable', 'ALGORITHM_RUNNER_COMMAND must be a JSON array');
  }
  if (!Array.isArray(parsed) || parsed.length === 0) {
    return makeErrorResult('runner_unavailable', 'ALGORITHM_RUNNER_COMMAND must be a non-empty JSON array');
  }
  if (parsed.some((part) => typeof part !== 'string' || part.trim() === '')) {
    return makeErrorResult('runner_unavailable', 'ALGORITHM_RUNNER_COMMAND entries must be non-empty strings');
  }
  return makeOkResult({ executable: parsed[0], args: parsed.slice(1) });
}

function resolveCommand(input) {
  if (input.executable) {
    return makeOkResult({ executable: input.executable, args: input.args || [] });
  }
  return parseRunnerCommandEnv();
}

function isTerminalFrame(frame) {
  return frame.kind === 'result' || frame.kind === 'error';
}

function validateRunnerFrame(frame, { runId, requestId }) {
  if (!frame || typeof frame !== 'object' || Array.isArray(frame)) {
    throw createAlgorithmError('runner_protocol_error', 'Runner emitted a non-object frame');
  }
  if (frame.schemaVersion !== ALGORITHM_SCHEMA_VERSION) {
    throw createAlgorithmError('runner_protocol_error', 'Runner emitted an unsupported schemaVersion');
  }
  const kinds = ['accepted', 'event', 'state', 'log', 'result', 'error'];
  if (!kinds.includes(frame.kind)) {
    throw createAlgorithmError('runner_protocol_error', 'Runner emitted an unknown frame kind');
  }
  if (frame.runId !== runId) {
    throw createAlgorithmError('runner_protocol_error', 'Runner emitted a mismatched runId');
  }
  if (['accepted', 'result', 'error'].includes(frame.kind) && frame.requestId !== requestId) {
    throw createAlgorithmError('runner_protocol_error', 'Runner emitted a mismatched requestId');
  }
  return frame;
}

function createRequestLine(input) {
  return `${JSON.stringify({
    schemaVersion: ALGORITHM_SCHEMA_VERSION,
    kind: 'request',
    command: input.command,
    requestId: input.requestId,
    runId: input.runId,
    ownerUserId: String(input.ownerUserId),
    payload: input.payload || {},
  })}\n`;
}

function spawnRunner(input) {
  const command = resolveCommand(input);
  if (!command.ok) return command;
  try {
    const child = spawn(command.value.executable, command.value.args, {
      shell: false,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return makeOkResult({ child, command: command.value });
  } catch {
    return makeErrorResult('runner_unavailable', 'Algorithm runner is unavailable');
  }
}

export async function runAlgorithmCommand(input) {
  const spawned = spawnRunner(input);
  if (!spawned.ok) return spawned;
  const { child } = spawned.value;
  const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxStdoutBytes = input.maxStdoutBytes ?? DEFAULT_MAX_STDOUT_BYTES;
  const maxStderrBytes = input.maxStderrBytes ?? DEFAULT_MAX_STDERR_BYTES;
  const frames = [];

  return new Promise((resolve) => {
    let resolved = false;
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let stdoutBuffer = '';
    let stderr = '';
    let terminalFrame = null;

    const finish = (result) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timeout);
      resolve(result);
    };

    const fail = (code, message) => {
      if (typeof child.kill === 'function') child.kill('SIGTERM');
      finish(makeErrorResult(code, message));
    };

    const timeout = setTimeout(() => {
      fail('runner_timeout', 'Algorithm runner timed out');
    }, timeoutMs);
    timeout.unref?.();

    const handleLine = (line) => {
      if (terminalFrame || line.trim() === '') return;
      let frame;
      try {
        frame = JSON.parse(line);
        validateRunnerFrame(frame, { runId: input.runId, requestId: input.requestId });
      } catch (error) {
        fail(error.code || 'runner_protocol_error', error.message || 'Runner emitted malformed JSON');
        return;
      }
      frames.push(frame);
      input.onFrame?.(frame);
      if (frame.kind === 'result') {
        terminalFrame = frame;
        finish({ ok: true, schemaVersion: ALGORITHM_SCHEMA_VERSION, result: frame, frames });
      } else if (frame.kind === 'error') {
        terminalFrame = frame;
        finish(makeErrorResult(frame.error?.code || 'runner_protocol_error', frame.error?.message || 'Algorithm runner error'));
      }
    };

    child.on('error', () => {
      finish(makeErrorResult('runner_unavailable', 'Algorithm runner is unavailable'));
    });
    child.stdout.on('data', (chunk) => {
      stdoutBytes += chunk.length;
      if (stdoutBytes > maxStdoutBytes) {
        fail('runner_protocol_error', 'Algorithm runner exceeded stdout budget');
        return;
      }
      stdoutBuffer += chunk.toString('utf8');
      const lines = stdoutBuffer.split(/\r?\n/);
      stdoutBuffer = lines.pop() ?? '';
      for (const line of lines) handleLine(line);
    });
    child.stderr.on('data', (chunk) => {
      stderrBytes += chunk.length;
      if (stderrBytes <= maxStderrBytes) {
        stderr += chunk.toString('utf8');
      }
      if (stderrBytes > maxStderrBytes) {
        fail('runner_protocol_error', 'Algorithm runner exceeded stderr budget');
      }
    });
    child.on('close', (code, signal) => {
      if (resolved) return;
      if (stdoutBuffer.trim() !== '') {
        handleLine(stdoutBuffer);
      }
      if (resolved) return;
      if (code !== 0) {
        finish(makeErrorResult('runner_protocol_error', 'Algorithm runner exited before returning a result', { stderr }));
      } else {
        finish(makeErrorResult('runner_protocol_error', 'Algorithm runner exited without returning a result'));
      }
    });

    child.stdin.write(createRequestLine(input));
    child.stdin.end();
  });
}

export async function startAlgorithmRun(input) {
  const spawned = spawnRunner({ ...input, command: 'start' });
  if (!spawned.ok) return spawned;
  const { child } = spawned.value;
  const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxStdoutBytes = input.maxStdoutBytes ?? DEFAULT_MAX_STDOUT_BYTES;
  const maxStderrBytes = input.maxStderrBytes ?? DEFAULT_MAX_STDERR_BYTES;

  return new Promise((resolve) => {
    let resolved = false;
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let stdoutBuffer = '';
    let stderr = '';
    let accepted = null;
    let terminalSeen = false;
    let accepting = Promise.resolve();

    const finish = (result) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timeout);
      resolve(result);
    };

    const fail = (code, message) => {
      if (typeof child.kill === 'function') child.kill('SIGTERM');
      finish(makeErrorResult(code, message));
    };

    const timeout = setTimeout(() => {
      fail('runner_timeout', 'Algorithm runner timed out');
    }, timeoutMs);
    timeout.unref?.();

    const processFrame = async (frame) => {
      if (terminalSeen) return;
      if (frame.kind === 'accepted') {
        if (accepted) {
          throw createAlgorithmError('runner_protocol_error', 'Runner emitted duplicate accepted frames');
        }
        accepted = frame;
        await input.onAccepted?.(frame);
        registerAlgorithmProcess({
          runId: input.runId,
          child,
          ownerUserId: String(input.ownerUserId),
          externalRunHandle: frame.externalRunHandle ?? null,
        });
        finish({ ok: true, schemaVersion: ALGORITHM_SCHEMA_VERSION, accepted: frame, child });
        return;
      }
      if (!accepted) {
        if (frame.kind === 'error') {
          fail(frame.error?.code || 'runner_protocol_error', frame.error?.message || 'Algorithm runner error');
          return;
        }
        throw createAlgorithmError('runner_protocol_error', 'Runner emitted a non-accepted frame before accepted');
      }
      await input.onFrame?.(frame);
      if (isTerminalFrame(frame)) {
        terminalSeen = true;
        markAlgorithmProcessTerminal(input.runId);
        unregisterAlgorithmProcess(input.runId);
      }
    };

    const handleLine = (line) => {
      if (line.trim() === '') return;
      let frame;
      try {
        frame = JSON.parse(line);
        validateRunnerFrame(frame, { runId: input.runId, requestId: input.requestId });
      } catch (error) {
        fail(error.code || 'runner_protocol_error', error.message || 'Runner emitted malformed JSON');
        return;
      }
      accepting = accepting
        .then(() => processFrame(frame))
        .catch((error) => {
          fail(error.code || 'runner_protocol_error', error.message || 'Algorithm runner protocol error');
        });
    };

    child.on('error', () => {
      finish(makeErrorResult('runner_unavailable', 'Algorithm runner is unavailable'));
    });
    child.stdout.on('data', (chunk) => {
      stdoutBytes += chunk.length;
      if (stdoutBytes > maxStdoutBytes) {
        fail('runner_protocol_error', 'Algorithm runner exceeded stdout budget');
        return;
      }
      stdoutBuffer += chunk.toString('utf8');
      const lines = stdoutBuffer.split(/\r?\n/);
      stdoutBuffer = lines.pop() ?? '';
      for (const line of lines) handleLine(line);
    });
    child.stderr.on('data', (chunk) => {
      stderrBytes += chunk.length;
      if (stderrBytes <= maxStderrBytes) stderr += chunk.toString('utf8');
      if (stderrBytes > maxStderrBytes) {
        fail('runner_protocol_error', 'Algorithm runner exceeded stderr budget');
      }
    });
    child.on('close', (code, signal) => {
      if (stdoutBuffer.trim() !== '') {
        handleLine(stdoutBuffer);
      }
      void accepting.finally(async () => {
        if (accepted && !terminalSeen && (code !== 0 || signal)) {
          await input.onExitWithoutTerminal?.({ code, signal, error: null, stderr });
          unregisterAlgorithmProcess(input.runId);
        }
        if (!resolved && code !== 0) {
          finish(makeErrorResult('runner_protocol_error', 'Algorithm runner exited before accepted', { stderr }));
        } else if (!resolved) {
          finish(makeErrorResult('runner_protocol_error', 'Algorithm runner exited without accepted'));
        }
      });
    });

    child.stdin.write(createRequestLine({ ...input, command: 'start' }));
    child.stdin.end();
  });
}

export function mapRunnerResultToHttp(result) {
  if (result.ok) {
    return null;
  }
  const code = result.error?.code || 'runner_protocol_error';
  const message = result.error?.message || 'Algorithm runner failed';
  return {
    status: getHttpStatusForErrorCode(code),
    body: makeApiError(code, message),
  };
}
