import os from 'os';
import path from 'path';
import { promises as fs } from 'fs';
import {
  ALGORITHM_SCHEMA_VERSION,
  EVENT_TYPES,
  createAlgorithmError,
  isTerminalStatus,
  validateRunId,
  validateStatus,
} from './contracts.js';

const appendLocks = new Map();

function nowIso() {
  return new Date().toISOString();
}

function getRunStoreRoot() {
  return path.resolve(process.env.ALGORITHM_RUN_STORE_ROOT || path.join(os.homedir(), '.cosmic-agent', 'algorithm-runs'));
}

export function resolveRunDirectory(runId) {
  const validation = validateRunId(runId);
  if (!validation.ok) {
    throw createAlgorithmError('invalid_request', validation.error.message);
  }
  const root = getRunStoreRoot();
  const runDir = path.resolve(root, runId);
  const rootWithSep = root.endsWith(path.sep) ? root : `${root}${path.sep}`;
  if (runDir !== root && !runDir.startsWith(rootWithSep)) {
    throw createAlgorithmError('invalid_request', 'runId resolves outside the run store');
  }
  return runDir;
}

function metadataPath(runId) {
  return path.join(resolveRunDirectory(runId), 'metadata.json');
}

function statePath(runId) {
  return path.join(resolveRunDirectory(runId), 'state.json');
}

function eventsPath(runId) {
  return path.join(resolveRunDirectory(runId), 'events.jsonl');
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function atomicWriteJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmpPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await fs.rename(tmpPath, filePath);
}

async function readJsonFile(filePath, corruptCode = 'state_corrupt') {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch (error) {
    if (error?.code === 'ENOENT') {
      throw createAlgorithmError('not_found', 'Algorithm run not found');
    }
    throw createAlgorithmError(corruptCode, `Failed to parse ${path.basename(filePath)}`);
  }
}

function publicStateFromMetadata(metadata) {
  return {
    schemaVersion: ALGORITHM_SCHEMA_VERSION,
    runId: metadata.runId,
    provider: metadata.provider,
    model: metadata.model ?? null,
    prompt: metadata.prompt ?? null,
    taskTitle: metadata.taskTitle ?? null,
    status: metadata.status,
    sessionId: metadata.sessionId ?? null,
    phase: null,
    phases: [],
    currentPhaseIndex: 0,
    currentReviewLine: '',
    deliverables: [],
    finalOutput: null,
    eventCursor: { sequence: metadata.lastSequence ?? 0 },
    pendingQuestion: null,
    pendingPermission: null,
    lastError: null,
    createdAt: metadata.createdAt,
    updatedAt: metadata.updatedAt,
    startedAt: metadata.startedAt ?? null,
    endedAt: metadata.endedAt ?? null,
  };
}

function slugify(value, fallback = 'item') {
  const slug = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || fallback;
}

function normalizePhase(raw, index) {
  if (!raw || typeof raw !== 'object') return null;
  const title = String(raw.title ?? raw.name ?? raw.phase ?? raw.id ?? `Phase ${index + 1}`).trim();
  if (!title) return null;
  const status = ['idle', 'active', 'complete'].includes(raw.status) ? raw.status : 'idle';
  return {
    id: String(raw.id ?? slugify(title, `phase-${index + 1}`)),
    label: String(raw.label ?? `P${index + 1}`),
    title,
    status,
  };
}

function normalizePhases(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizePhase).filter(Boolean);
}

function normalizeDeliverable(raw, index) {
  if (!raw || typeof raw !== 'object') return null;
  const title = String(raw.title ?? raw.name ?? raw.path ?? raw.url ?? `Deliverable ${index + 1}`).trim();
  if (!title) return null;
  const action = raw.action === 'download' ? 'download' : 'link';
  return {
    id: String(raw.id ?? slugify(title, `deliverable-${index + 1}`)),
    badge: raw.badge === undefined || raw.badge === null ? '' : String(raw.badge),
    title,
    subtitle: String(raw.subtitle ?? raw.description ?? raw.kind ?? ''),
    tone: ['emerald', 'iris', 'gold', 'document', 'sheet', 'link'].includes(raw.tone) ? raw.tone : 'link',
    action,
    url: typeof raw.url === 'string' ? raw.url : null,
    createdAt: raw.createdAt ?? null,
  };
}

function normalizeDeliverables(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeDeliverable).filter(Boolean);
}

function normalizeOutput(raw) {
  if (!raw) return null;
  if (typeof raw === 'string') {
    return { title: 'Algorithm output', body: raw, url: null };
  }
  if (typeof raw !== 'object') return null;
  const body = raw.body ?? raw.summary ?? raw.content ?? raw.message ?? '';
  const title = raw.title ?? raw.name ?? 'Algorithm output';
  return {
    title: String(title),
    body: String(body),
    url: typeof raw.url === 'string' ? raw.url : null,
  };
}

function setActivePhaseFromString(state, phaseValue) {
  const phase = phaseValue === undefined || phaseValue === null ? null : String(phaseValue);
  state.phase = phase;
  if (!phase) return;

  const matchingIndex = state.phases.findIndex((item) => (
    item.id === phase || item.title === phase || item.label === phase
  ));
  if (matchingIndex >= 0) {
    state.currentPhaseIndex = matchingIndex;
    state.phases = state.phases.map((item, index) => ({
      ...item,
      status: index < matchingIndex ? 'complete' : index === matchingIndex ? 'active' : item.status,
    }));
    return;
  }

  if (state.phases.length === 0) {
    state.phases = [{
      id: slugify(phase, 'phase-1'),
      label: 'P1',
      title: phase,
      status: 'active',
    }];
    state.currentPhaseIndex = 0;
  }
}

function normalizeQuestion(payload, event) {
  const source = payload?.question && typeof payload.question === 'object' ? payload.question : payload;
  return {
    id: String(source.id ?? source.questionId ?? ''),
    prompt: String(source.prompt ?? ''),
    choices: Array.isArray(source.choices) ? source.choices.map(String) : undefined,
    defaultValue: source.defaultValue ?? null,
    requestedAt: source.requestedAt ?? event.createdAt,
    expiresAt: source.expiresAt ?? null,
    sourceEventSequence: event.sequence,
  };
}

function normalizePermission(payload, event) {
  const source = payload?.permission && typeof payload.permission === 'object' ? payload.permission : payload;
  return {
    id: String(source.id ?? source.permissionId ?? ''),
    toolName: String(source.toolName ?? ''),
    action: String(source.action ?? ''),
    input: source.input && typeof source.input === 'object' ? source.input : undefined,
    risks: Array.isArray(source.risks) ? source.risks.map(String) : undefined,
    requestedAt: source.requestedAt ?? event.createdAt,
    expiresAt: source.expiresAt ?? null,
    sourceEventSequence: event.sequence,
  };
}

function applyEventProjection(metadata, state, event) {
  const payload = event.payload || {};
  metadata.lastSequence = event.sequence;
  state.eventCursor = { sequence: event.sequence };
  metadata.updatedAt = event.createdAt;
  state.updatedAt = event.createdAt;

  if (payload.sessionId) {
    metadata.sessionId = String(payload.sessionId);
    state.sessionId = String(payload.sessionId);
  }

  switch (event.type) {
    case 'algorithm.runner.accepted':
      metadata.status = 'running';
      state.status = 'running';
      metadata.startedAt = metadata.startedAt ?? event.createdAt;
      state.startedAt = metadata.startedAt;
      metadata.externalRunHandle = payload.externalRunHandle ?? metadata.externalRunHandle ?? null;
      break;
    case 'algorithm.run.started':
      metadata.status = 'running';
      state.status = 'running';
      metadata.startedAt = metadata.startedAt ?? event.createdAt;
      state.startedAt = metadata.startedAt;
      break;
    case 'algorithm.session.bound':
      if (payload.sessionId) {
        metadata.sessionId = String(payload.sessionId);
        state.sessionId = String(payload.sessionId);
      }
      break;
    case 'algorithm.phase.changed':
      setActivePhaseFromString(state, payload.phase);
      break;
    case 'algorithm.phases.updated': {
      const phases = normalizePhases(payload.phases);
      if (phases.length > 0) {
        state.phases = phases;
      }
      if (Number.isInteger(payload.currentPhaseIndex)) {
        state.currentPhaseIndex = Math.max(0, Math.min(payload.currentPhaseIndex, Math.max(state.phases.length - 1, 0)));
      } else {
        const activeIndex = state.phases.findIndex((phase) => phase.status === 'active');
        if (activeIndex >= 0) {
          state.currentPhaseIndex = activeIndex;
        }
      }
      if (payload.currentReviewLine !== undefined && payload.currentReviewLine !== null) {
        state.currentReviewLine = String(payload.currentReviewLine);
      }
      const activePhase = state.phases[state.currentPhaseIndex];
      if (activePhase) {
        state.phase = activePhase.id;
        state.phases = state.phases.map((item, index) => ({
          ...item,
          status: item.status === 'complete' || index < state.currentPhaseIndex
            ? 'complete'
            : index === state.currentPhaseIndex
              ? 'active'
              : item.status,
        }));
      }
      break;
    }
    case 'algorithm.deliverables.updated':
      state.deliverables = normalizeDeliverables(payload.deliverables ?? payload.resources ?? payload.artifacts);
      break;
    case 'algorithm.output.updated':
      state.finalOutput = normalizeOutput(payload.output ?? payload);
      break;
    case 'algorithm.status.changed': {
      const status = payload.status;
      if (!validateStatus(status).ok) {
        throw createAlgorithmError('state_corrupt', 'Event contains unsupported status');
      }
      metadata.status = status;
      state.status = status;
      if (isTerminalStatus(status)) {
        metadata.endedAt = metadata.endedAt ?? event.createdAt;
        state.endedAt = metadata.endedAt;
        state.pendingQuestion = null;
        state.pendingPermission = null;
      }
      break;
    }
    case 'algorithm.question.requested':
      state.pendingQuestion = normalizeQuestion(payload, event);
      metadata.status = 'waiting_for_question';
      state.status = 'waiting_for_question';
      break;
    case 'algorithm.question.answered': {
      const questionId = payload.questionId ?? payload.id;
      if (state.pendingQuestion?.id === questionId) {
        state.pendingQuestion = null;
        if (!state.pendingPermission && !isTerminalStatus(state.status)) {
          metadata.status = 'running';
          state.status = 'running';
        }
      }
      break;
    }
    case 'algorithm.permission.requested':
      state.pendingPermission = normalizePermission(payload, event);
      metadata.status = 'waiting_for_permission';
      state.status = 'waiting_for_permission';
      break;
    case 'algorithm.permission.decided': {
      const permissionId = payload.permissionId ?? payload.id;
      if (state.pendingPermission?.id === permissionId) {
        state.pendingPermission = null;
        if (!state.pendingQuestion && !isTerminalStatus(state.status)) {
          metadata.status = 'running';
          state.status = 'running';
        }
      }
      break;
    }
    case 'algorithm.error':
      state.lastError = {
        code: String(payload.code ?? 'runner_protocol_error'),
        message: String(payload.message ?? 'Algorithm runner error'),
      };
      break;
    case 'algorithm.run.completed':
      metadata.status = 'completed';
      state.status = 'completed';
      metadata.endedAt = metadata.endedAt ?? event.createdAt;
      state.endedAt = metadata.endedAt;
      state.pendingQuestion = null;
      state.pendingPermission = null;
      break;
    case 'algorithm.run.failed':
      metadata.status = 'failed';
      state.status = 'failed';
      metadata.endedAt = metadata.endedAt ?? event.createdAt;
      state.endedAt = metadata.endedAt;
      state.pendingQuestion = null;
      state.pendingPermission = null;
      state.lastError = {
        code: String(payload.code ?? 'runner_protocol_error'),
        message: String(payload.message ?? 'Algorithm run failed'),
      };
      break;
    case 'algorithm.run.cancelled':
      metadata.status = 'cancelled';
      state.status = 'cancelled';
      metadata.endedAt = metadata.endedAt ?? event.createdAt;
      state.endedAt = metadata.endedAt;
      state.pendingQuestion = null;
      state.pendingPermission = null;
      break;
    default:
      break;
  }

  state.status = metadata.status;
  state.sessionId = metadata.sessionId ?? null;
  state.endedAt = metadata.endedAt ?? null;
  state.startedAt = metadata.startedAt ?? null;
  return { metadata, state };
}

async function readEventLog(runId) {
  const filePath = eventsPath(runId);
  if (!(await pathExists(filePath))) {
    return [];
  }
  const content = await fs.readFile(filePath, 'utf8');
  if (content.trim() === '') {
    return [];
  }
  const events = [];
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    if (line.trim() === '') continue;
    try {
      const event = JSON.parse(line);
      if (!Number.isInteger(event.sequence) || event.sequence <= 0 || !EVENT_TYPES.includes(event.type)) {
        throw new Error('invalid event');
      }
      events.push(event);
    } catch {
      throw createAlgorithmError('state_corrupt', 'Algorithm event log is corrupt');
    }
  }
  return events;
}

async function rebuildState(runId) {
  const metadata = await readRunMetadata(runId);
  const events = await readEventLog(runId);
  const rebuiltMetadata = { ...metadata, lastSequence: 0 };
  const state = publicStateFromMetadata(rebuiltMetadata);
  for (const event of events) {
    if (event.sequence !== rebuiltMetadata.lastSequence + 1) {
      throw createAlgorithmError('state_corrupt', 'Algorithm event log sequence is corrupt');
    }
    applyEventProjection(rebuiltMetadata, state, event);
  }
  rebuiltMetadata.lastSequence = events.length ? events[events.length - 1].sequence : 0;
  await atomicWriteJson(metadataPath(runId), rebuiltMetadata);
  await atomicWriteJson(statePath(runId), state);
  return { metadata: rebuiltMetadata, state, events };
}

async function withRunAppendLock(runId, fn) {
  const previous = appendLocks.get(runId) || Promise.resolve();
  let release;
  const current = new Promise((resolve) => {
    release = resolve;
  });
  appendLocks.set(runId, previous.then(() => current, () => current));
  try {
    await previous.catch(() => {});
    return await fn();
  } finally {
    release();
    if (appendLocks.get(runId) === current) {
      appendLocks.delete(runId);
    }
  }
}

export async function createRunMetadata(input) {
  const createdAt = nowIso();
  const metadata = {
    schemaVersion: ALGORITHM_SCHEMA_VERSION,
    runId: input.runId,
    ownerUserId: String(input.ownerUserId),
    projectPath: input.projectPath,
    provider: input.provider,
    model: input.model ?? null,
    permissionMode: input.permissionMode ?? null,
    algorithmMode: input.algorithmMode ?? null,
    status: input.status ?? 'starting',
    sessionId: input.sessionId ?? null,
    runnerRequestId: input.runnerRequestId ?? null,
    runnerPid: input.runnerPid ?? null,
    externalRunHandle: input.externalRunHandle ?? null,
    prompt: input.prompt ?? null,
    taskTitle: input.taskTitle ?? null,
    createdAt,
    updatedAt: createdAt,
    startedAt: input.startedAt ?? null,
    endedAt: input.endedAt ?? null,
    lastSequence: input.lastSequence ?? 0,
  };
  const validation = validateRunId(metadata.runId);
  if (!validation.ok) {
    throw createAlgorithmError('invalid_request', validation.error.message);
  }
  await fs.mkdir(resolveRunDirectory(metadata.runId), { recursive: true });
  await atomicWriteJson(metadataPath(metadata.runId), metadata);
  await atomicWriteJson(statePath(metadata.runId), publicStateFromMetadata(metadata));
  await fs.appendFile(eventsPath(metadata.runId), '', 'utf8');
  return metadata;
}

export async function readRunMetadata(runId) {
  return readJsonFile(metadataPath(runId));
}

export async function updateRunMetadata(runId, patchOrUpdater) {
  const metadata = await readRunMetadata(runId);
  const patch = typeof patchOrUpdater === 'function' ? patchOrUpdater({ ...metadata }) : patchOrUpdater;
  const next = {
    ...metadata,
    ...(patch || {}),
    updatedAt: patch?.updatedAt ?? nowIso(),
  };
  await atomicWriteJson(metadataPath(runId), next);
  return next;
}

export async function appendAlgorithmEvent(runId, eventInput) {
  return withRunAppendLock(runId, async () => {
    const { metadata, state } = await rebuildState(runId);
    if (!EVENT_TYPES.includes(eventInput.type)) {
      throw createAlgorithmError('invalid_request', 'Algorithm event type is not supported');
    }
    const explicitSequence = eventInput.sequence;
    const sequence = explicitSequence ?? metadata.lastSequence + 1;
    if (!Number.isInteger(sequence) || sequence !== metadata.lastSequence + 1) {
      throw createAlgorithmError('state_corrupt', 'Algorithm event sequence is out of order');
    }
    const event = {
      schemaVersion: ALGORITHM_SCHEMA_VERSION,
      sequence,
      runId,
      type: eventInput.type,
      createdAt: eventInput.createdAt ?? nowIso(),
      payload: eventInput.payload && typeof eventInput.payload === 'object' ? eventInput.payload : {},
    };

    await fs.appendFile(eventsPath(runId), `${JSON.stringify(event)}\n`, 'utf8');
    applyEventProjection(metadata, state, event);
    await atomicWriteJson(metadataPath(runId), metadata);
    await atomicWriteJson(statePath(runId), state);
    return event;
  });
}

export async function readAlgorithmRunState(runId) {
  const metadata = await readRunMetadata(runId);
  const events = await readEventLog(runId);
  const stateFile = statePath(runId);
  if (!(await pathExists(stateFile))) {
    return (await rebuildState(runId)).state;
  }
  const state = await readJsonFile(stateFile);
  const logSequence = events.at(-1)?.sequence ?? 0;
  if (state?.eventCursor?.sequence !== metadata.lastSequence || metadata.lastSequence !== logSequence) {
    return (await rebuildState(runId)).state;
  }
  return state;
}

export async function readAlgorithmEventsSince(runId, after = 0) {
  await readRunMetadata(runId);
  if (!Number.isInteger(after) || after < 0) {
    throw createAlgorithmError('invalid_request', 'after cursor must be a non-negative integer');
  }
  const events = await readEventLog(runId);
  return events.filter((event) => event.sequence > after);
}

export async function persistRunnerFrame(runId, frame) {
  if (frame.kind === 'event') {
    return appendAlgorithmEvent(runId, {
      type: frame.event?.type,
      payload: frame.event?.payload ?? {},
    });
  }
  if (frame.kind === 'state') {
    const written = [];
    const state = frame.state || {};
    if (state.sessionId) {
      written.push(await appendAlgorithmEvent(runId, {
        type: 'algorithm.session.bound',
        payload: { sessionId: state.sessionId },
      }));
    }
    if (state.phase !== undefined) {
      written.push(await appendAlgorithmEvent(runId, {
        type: 'algorithm.phase.changed',
        payload: { phase: state.phase },
      }));
    }
    if (Array.isArray(state.phases) || state.currentPhaseIndex !== undefined || state.currentReviewLine !== undefined) {
      written.push(await appendAlgorithmEvent(runId, {
        type: 'algorithm.phases.updated',
        payload: {
          phases: state.phases ?? [],
          currentPhaseIndex: state.currentPhaseIndex,
          currentReviewLine: state.currentReviewLine,
        },
      }));
    }
    if (Array.isArray(state.deliverables) || Array.isArray(state.resources) || Array.isArray(state.artifacts)) {
      written.push(await appendAlgorithmEvent(runId, {
        type: 'algorithm.deliverables.updated',
        payload: {
          deliverables: state.deliverables ?? state.resources ?? state.artifacts ?? [],
        },
      }));
    }
    if (state.finalOutput !== undefined || state.output !== undefined || state.summary !== undefined) {
      written.push(await appendAlgorithmEvent(runId, {
        type: 'algorithm.output.updated',
        payload: { output: state.finalOutput ?? state.output ?? state.summary },
      }));
    }
    if (state.status) {
      written.push(await appendAlgorithmEvent(runId, {
        type: 'algorithm.status.changed',
        payload: { status: state.status },
      }));
    }
    return written.at(-1) ?? null;
  }
  if (frame.kind === 'log') {
    return appendAlgorithmEvent(runId, {
      type: 'algorithm.log',
      payload: { level: frame.level ?? 'info', message: frame.message ?? '' },
    });
  }
  if (frame.kind === 'error') {
    await appendAlgorithmEvent(runId, {
      type: 'algorithm.error',
      payload: {
        code: frame.error?.code ?? 'runner_protocol_error',
        message: frame.error?.message ?? 'Algorithm runner error',
      },
    });
    return appendAlgorithmEvent(runId, {
      type: 'algorithm.run.failed',
      payload: {
        code: frame.error?.code ?? 'runner_protocol_error',
        message: frame.error?.message ?? 'Algorithm runner error',
      },
    });
  }
  if (frame.kind === 'result' && frame.status) {
    if (frame.output !== undefined || frame.summary !== undefined) {
      await appendAlgorithmEvent(runId, {
        type: 'algorithm.output.updated',
        payload: { output: frame.output ?? frame.summary },
      });
    }
    const terminalType = frame.status === 'failed'
      ? 'algorithm.run.failed'
      : frame.status === 'cancelled'
        ? 'algorithm.run.cancelled'
        : frame.status === 'completed'
          ? 'algorithm.run.completed'
          : 'algorithm.status.changed';
    return appendAlgorithmEvent(runId, {
      type: terminalType,
      payload: { status: frame.status },
    });
  }
  return null;
}
