import path from 'path';
import { existsSync, statSync } from 'fs';

export const ALGORITHM_SCHEMA_VERSION = 1;

export const PROVIDERS = Object.freeze(['claude', 'cursor', 'codex', 'gemini']);
export const RUN_STATUSES = Object.freeze([
  'starting',
  'running',
  'paused',
  'waiting_for_question',
  'waiting_for_permission',
  'stopping',
  'completed',
  'failed',
  'cancelled',
]);
export const TERMINAL_STATUSES = Object.freeze(['completed', 'failed', 'cancelled']);
export const LIFECYCLE_COMMANDS = Object.freeze(['pause', 'resume', 'stop']);
export const RUN_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;

export const EVENT_TYPES = Object.freeze([
  'algorithm.runner.accepted',
  'algorithm.run.started',
  'algorithm.session.bound',
  'algorithm.phase.changed',
  'algorithm.status.changed',
  'algorithm.question.requested',
  'algorithm.question.answered',
  'algorithm.permission.requested',
  'algorithm.permission.decided',
  'algorithm.lifecycle.pause_requested',
  'algorithm.lifecycle.resume_requested',
  'algorithm.lifecycle.stop_requested',
  'algorithm.log',
  'algorithm.error',
  'algorithm.run.completed',
  'algorithm.run.failed',
  'algorithm.run.cancelled',
]);

export function makeApiError(code, message, extra = undefined) {
  const error = { code, message };
  if (extra && typeof extra === 'object') {
    Object.assign(error, extra);
  }
  return { ok: false, schemaVersion: ALGORITHM_SCHEMA_VERSION, error };
}

export function makeApiSuccess(body = {}) {
  return { ok: true, schemaVersion: ALGORITHM_SCHEMA_VERSION, ...body };
}

export function makeErrorResult(code, message, extra = undefined) {
  return { ok: false, error: { code, message, ...(extra || {}) } };
}

export function makeOkResult(value) {
  return { ok: true, value };
}

export function getHttpStatusForErrorCode(code) {
  switch (code) {
    case 'invalid_request':
      return 400;
    case 'forbidden':
      return 403;
    case 'not_found':
      return 404;
    case 'conflict':
      return 409;
    case 'runner_unavailable':
      return 503;
    case 'runner_timeout':
      return 504;
    case 'runner_protocol_error':
      return 502;
    case 'state_corrupt':
      return 500;
    default:
      return 500;
  }
}

export function createAlgorithmError(code, message, extra = undefined) {
  const error = new Error(message);
  error.code = code;
  if (extra && typeof extra === 'object') {
    Object.assign(error, extra);
  }
  return error;
}

export function resultFromError(error, fallbackCode = 'runner_protocol_error') {
  return makeErrorResult(
    error?.code || fallbackCode,
    error?.publicMessage || error?.message || 'Algorithm Run operation failed',
  );
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function validateSchemaVersion(body) {
  if (!isPlainObject(body)) {
    return makeErrorResult('invalid_request', 'request body must be an object');
  }
  if (body.schemaVersion !== ALGORITHM_SCHEMA_VERSION) {
    return makeErrorResult('invalid_request', 'schemaVersion must be 1');
  }
  return makeOkResult(body);
}

export function validateProvider(provider) {
  if (!PROVIDERS.includes(provider)) {
    return makeErrorResult('invalid_request', 'provider must be one of claude, cursor, codex, gemini');
  }
  return makeOkResult(provider);
}

export function validateStatus(status) {
  if (!RUN_STATUSES.includes(status)) {
    return makeErrorResult('invalid_request', 'status is not supported');
  }
  return makeOkResult(status);
}

export function isTerminalStatus(status) {
  return TERMINAL_STATUSES.includes(status);
}

export function validateRunId(runId) {
  if (typeof runId !== 'string' || !RUN_ID_PATTERN.test(runId)) {
    return makeErrorResult('invalid_request', 'runId is invalid');
  }
  if (runId.includes('%')) {
    return makeErrorResult('invalid_request', 'runId is invalid');
  }
  return makeOkResult(runId);
}

export function validateProjectPath(projectPath) {
  if (typeof projectPath !== 'string' || projectPath.trim() === '') {
    return makeErrorResult('invalid_request', 'projectPath is required');
  }
  if (!path.isAbsolute(projectPath)) {
    return makeErrorResult('invalid_request', 'projectPath must be absolute');
  }
  try {
    if (!existsSync(projectPath) || !statSync(projectPath).isDirectory()) {
      return makeErrorResult('invalid_request', 'projectPath must exist and be a directory');
    }
  } catch {
    return makeErrorResult('invalid_request', 'projectPath must be accessible');
  }
  return makeOkResult(projectPath);
}

export function validateLifecycleCommand(command) {
  if (!LIFECYCLE_COMMANDS.includes(command)) {
    return makeErrorResult('invalid_request', 'lifecycle command is not supported');
  }
  return makeOkResult(command);
}

export function validateStartRunRequest(body) {
  const schema = validateSchemaVersion(body);
  if (!schema.ok) return schema;

  const provider = validateProvider(body.provider);
  if (!provider.ok) return provider;

  const projectPath = validateProjectPath(body.projectPath);
  if (!projectPath.ok) return projectPath;

  if (typeof body.prompt !== 'string' || body.prompt.trim() === '') {
    return makeErrorResult('invalid_request', 'prompt is required');
  }

  for (const key of ['model', 'permissionMode', 'algorithmMode']) {
    if (body[key] !== undefined && body[key] !== null && typeof body[key] !== 'string') {
      return makeErrorResult('invalid_request', `${key} must be a string or null`);
    }
  }

  if (body.metadata !== undefined && !isPlainObject(body.metadata)) {
    return makeErrorResult('invalid_request', 'metadata must be an object');
  }

  return makeOkResult({
    schemaVersion: ALGORITHM_SCHEMA_VERSION,
    projectPath: body.projectPath,
    prompt: body.prompt,
    provider: body.provider,
    model: body.model ?? null,
    permissionMode: body.permissionMode ?? null,
    algorithmMode: body.algorithmMode ?? null,
    metadata: body.metadata ?? {},
  });
}

export function validateQuestionAnswerBody(body) {
  const schema = validateSchemaVersion(body);
  if (!schema.ok) return schema;
  if (typeof body.answer !== 'string' || body.answer.trim() === '') {
    return makeErrorResult('invalid_request', 'answer must be a non-empty string');
  }
  if (body.metadata !== undefined && !isPlainObject(body.metadata)) {
    return makeErrorResult('invalid_request', 'metadata must be an object');
  }
  return makeOkResult({
    schemaVersion: ALGORITHM_SCHEMA_VERSION,
    answer: body.answer,
    metadata: body.metadata ?? {},
  });
}

export function validatePermissionDecisionBody(body) {
  const schema = validateSchemaVersion(body);
  if (!schema.ok) return schema;
  if (typeof body.allow !== 'boolean') {
    return makeErrorResult('invalid_request', 'allow must be a boolean');
  }
  if (body.message !== undefined && body.message !== null && typeof body.message !== 'string') {
    return makeErrorResult('invalid_request', 'message must be a string or null');
  }
  if (body.updatedInput !== undefined && !isPlainObject(body.updatedInput)) {
    return makeErrorResult('invalid_request', 'updatedInput must be an object');
  }
  return makeOkResult({
    schemaVersion: ALGORITHM_SCHEMA_VERSION,
    allow: body.allow,
    message: body.message ?? null,
    updatedInput: body.updatedInput ?? undefined,
  });
}

export function validateCursor(value) {
  if (value === undefined || value === null || value === '') {
    return makeOkResult(0);
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    return makeErrorResult('invalid_request', 'after cursor must be a non-negative integer');
  }
  return makeOkResult(parsed);
}

export function sendApiError(res, code, message) {
  return res.status(getHttpStatusForErrorCode(code)).json(makeApiError(code, message));
}

