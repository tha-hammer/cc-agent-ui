import express from 'express';
import crypto from 'crypto';
import {
  getHttpStatusForErrorCode,
  isTerminalStatus,
  makeApiError,
  makeApiSuccess,
  validateCursor,
  validateLifecycleCommand,
  validatePermissionDecisionBody,
  validateQuestionAnswerBody,
  validateRunId,
  validateStartRunRequest,
} from '../algorithm-runs/contracts.js';
import {
  parseRunnerCommandEnv,
  runAlgorithmCommand,
  startAlgorithmRun,
} from '../algorithm-runs/command-client.js';
import {
  appendAlgorithmEvent,
  createRunMetadata,
  persistRunnerFrame,
  readAlgorithmEventsSince,
  readAlgorithmRunState,
  readRunMetadata,
} from '../algorithm-runs/run-store.js';
import { terminateAlgorithmProcess } from '../algorithm-runs/process-registry.js';
import { streamAlgorithmEvents } from '../algorithm-runs/sse.js';

const router = express.Router();

function newId(prefix) {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '')}`;
}

function ownerUserId(req) {
  return String(req.user?.id ?? req.user?.userId ?? '');
}

function sendErrorResult(res, result) {
  const code = result.error?.code || 'runner_protocol_error';
  const message = result.error?.message || 'Algorithm Run request failed';
  return res.status(getHttpStatusForErrorCode(code)).json(makeApiError(code, message));
}

async function authorizeRun(req, res) {
  const runIdValidation = validateRunId(req.params.runId);
  if (!runIdValidation.ok) {
    sendErrorResult(res, runIdValidation);
    return null;
  }
  let metadata;
  try {
    metadata = await readRunMetadata(req.params.runId);
  } catch (error) {
    const code = error.code || 'state_corrupt';
    res.status(getHttpStatusForErrorCode(code)).json(makeApiError(code, error.message));
    return null;
  }
  if (metadata.ownerUserId !== ownerUserId(req)) {
    res.status(403).json(makeApiError('forbidden', 'run is owned by another user'));
    return null;
  }
  return metadata;
}

async function failStartedRun(runId, code, message) {
  try {
    await appendAlgorithmEvent(runId, {
      type: 'algorithm.run.failed',
      payload: { code, message },
    });
  } catch (error) {
    console.error('[algorithm-runs] failed to persist failed start:', error);
  }
}

function startResponse(metadata, state) {
  return makeApiSuccess({
    run: {
      runId: metadata.runId,
      ownerUserId: metadata.ownerUserId,
      sessionId: state.sessionId ?? null,
      projectPath: metadata.projectPath,
      provider: metadata.provider,
      status: state.status,
      createdAt: metadata.createdAt,
      updatedAt: state.updatedAt,
      startedAt: state.startedAt,
      eventCursor: state.eventCursor,
    },
    links: {
      state: `/api/algorithm-runs/${metadata.runId}/state`,
      events: `/api/algorithm-runs/${metadata.runId}/events?after=${state.eventCursor.sequence}`,
    },
  });
}

router.post('/', async (req, res) => {
  const validation = validateStartRunRequest(req.body);
  if (!validation.ok) return sendErrorResult(res, validation);

  const commandConfig = parseRunnerCommandEnv();
  if (!commandConfig.ok) return sendErrorResult(res, commandConfig);

  const runId = newId('alg');
  const requestId = newId('req');
  const input = validation.value;
  const userId = ownerUserId(req);

  try {
    await createRunMetadata({
      runId,
      ownerUserId: userId,
      projectPath: input.projectPath,
      provider: input.provider,
      model: input.model,
      permissionMode: input.permissionMode,
      algorithmMode: input.algorithmMode,
      status: 'starting',
      runnerRequestId: requestId,
    });

    const result = await startAlgorithmRun({
      runId,
      requestId,
      ownerUserId: userId,
      payload: input,
      onAccepted: async (frame) => {
        await appendAlgorithmEvent(runId, {
          type: 'algorithm.runner.accepted',
          payload: {
            externalRunHandle: frame.externalRunHandle ?? null,
            sessionId: frame.sessionId ?? null,
          },
        });
      },
      onFrame: (frame) => persistRunnerFrame(runId, frame),
      onExitWithoutTerminal: ({ code, signal }) => appendAlgorithmEvent(runId, {
        type: 'algorithm.run.failed',
        payload: {
          code: 'runner_protocol_error',
          message: `Algorithm runner exited without terminal event (${code ?? signal ?? 'unknown'})`,
        },
      }),
    });

    if (!result.ok) {
      await failStartedRun(runId, result.error.code, result.error.message);
      return sendErrorResult(res, result);
    }

    const metadata = await readRunMetadata(runId);
    const state = await readAlgorithmRunState(runId);
    return res.status(202).json(startResponse(metadata, state));
  } catch (error) {
    await failStartedRun(runId, error.code || 'runner_protocol_error', error.message || 'Algorithm run failed');
    const code = error.code || 'runner_protocol_error';
    return res.status(getHttpStatusForErrorCode(code)).json(makeApiError(code, error.message || 'Algorithm run failed'));
  }
});

router.get('/:runId/state', async (req, res) => {
  const metadata = await authorizeRun(req, res);
  if (!metadata) return;
  try {
    const state = await readAlgorithmRunState(metadata.runId);
    return res.json(makeApiSuccess({ runId: metadata.runId, state }));
  } catch (error) {
    const code = error.code || 'state_corrupt';
    return res.status(getHttpStatusForErrorCode(code)).json(makeApiError(code, error.message));
  }
});

router.get('/:runId/events', async (req, res) => {
  const metadata = await authorizeRun(req, res);
  if (!metadata) return;

  const cursor = validateCursor(req.query.after);
  if (!cursor.ok) return sendErrorResult(res, cursor);

  if (req.query.stream === '1') {
    streamAlgorithmEvents({
      req,
      res,
      runId: metadata.runId,
      after: cursor.value,
      readEventsSince: readAlgorithmEventsSince,
      readState: readAlgorithmRunState,
    });
    return;
  }

  try {
    const events = await readAlgorithmEventsSince(metadata.runId, cursor.value);
    const state = await readAlgorithmRunState(metadata.runId);
    const sequence = events.at(-1)?.sequence ?? state.eventCursor.sequence;
    return res.json(makeApiSuccess({
      runId: metadata.runId,
      events,
      cursor: { sequence },
    }));
  } catch (error) {
    const code = error.code || 'state_corrupt';
    return res.status(getHttpStatusForErrorCode(code)).json(makeApiError(code, error.message));
  }
});

async function handleLifecycle(req, res, command) {
  const commandValidation = validateLifecycleCommand(command);
  if (!commandValidation.ok) return sendErrorResult(res, commandValidation);
  const metadata = await authorizeRun(req, res);
  if (!metadata) return;

  const state = await readAlgorithmRunState(metadata.runId);
  if (isTerminalStatus(state.status)) {
    return res.status(409).json(makeApiError('conflict', `cannot ${command} a ${state.status} run`));
  }
  if (command === 'pause' && state.status === 'paused') {
    return res.json(makeApiSuccess({ runId: metadata.runId, command, state, cursor: state.eventCursor }));
  }

  const requestEvent = {
    pause: 'algorithm.lifecycle.pause_requested',
    resume: 'algorithm.lifecycle.resume_requested',
    stop: 'algorithm.lifecycle.stop_requested',
  }[command];

  await appendAlgorithmEvent(metadata.runId, {
    type: requestEvent,
    payload: command === 'stop' ? { reason: req.body?.reason ?? null } : {},
  });

  const result = await runAlgorithmCommand({
    command,
    runId: metadata.runId,
    requestId: newId('req'),
    ownerUserId: metadata.ownerUserId,
    payload: command === 'stop' ? { reason: req.body?.reason ?? null } : {},
    onFrame: (frame) => persistRunnerFrame(metadata.runId, frame),
  });
  if (!result.ok) return sendErrorResult(res, result);

  if (command === 'pause') {
    await appendAlgorithmEvent(metadata.runId, {
      type: 'algorithm.status.changed',
      payload: { status: 'paused' },
    });
  } else if (command === 'resume') {
    await appendAlgorithmEvent(metadata.runId, {
      type: 'algorithm.status.changed',
      payload: { status: 'running' },
    });
  } else if (command === 'stop') {
    await appendAlgorithmEvent(metadata.runId, {
      type: 'algorithm.status.changed',
      payload: { status: 'stopping' },
    });
    await terminateAlgorithmProcess(metadata.runId, { signal: 'SIGTERM', timeoutMs: 1000 });
  }

  const nextState = await readAlgorithmRunState(metadata.runId);
  return res.json(makeApiSuccess({
    runId: metadata.runId,
    command,
    state: nextState,
    cursor: nextState.eventCursor,
  }));
}

router.post('/:runId/pause', (req, res) => handleLifecycle(req, res, 'pause'));
router.post('/:runId/resume', (req, res) => handleLifecycle(req, res, 'resume'));
router.post('/:runId/stop', (req, res) => handleLifecycle(req, res, 'stop'));

router.post('/:runId/questions/:questionId/answer', async (req, res) => {
  const body = validateQuestionAnswerBody(req.body);
  if (!body.ok) return sendErrorResult(res, body);
  const metadata = await authorizeRun(req, res);
  if (!metadata) return;
  const state = await readAlgorithmRunState(metadata.runId);
  if (state.pendingQuestion?.id !== req.params.questionId) {
    return res.status(404).json(makeApiError('not_found', 'pending question not found'));
  }

  const result = await runAlgorithmCommand({
    command: 'answerQuestion',
    runId: metadata.runId,
    requestId: newId('req'),
    ownerUserId: metadata.ownerUserId,
    payload: { questionId: req.params.questionId, answer: body.value.answer, metadata: body.value.metadata },
    onFrame: (frame) => persistRunnerFrame(metadata.runId, frame),
  });
  if (!result.ok) return sendErrorResult(res, result);

  await appendAlgorithmEvent(metadata.runId, {
    type: 'algorithm.question.answered',
    payload: { questionId: req.params.questionId },
  });
  const nextState = await readAlgorithmRunState(metadata.runId);
  return res.json(makeApiSuccess({
    runId: metadata.runId,
    questionId: req.params.questionId,
    state: nextState,
    cursor: nextState.eventCursor,
  }));
});

router.post('/:runId/permissions/:permissionId/decision', async (req, res) => {
  const body = validatePermissionDecisionBody(req.body);
  if (!body.ok) return sendErrorResult(res, body);
  const metadata = await authorizeRun(req, res);
  if (!metadata) return;
  const state = await readAlgorithmRunState(metadata.runId);
  if (state.pendingPermission?.id !== req.params.permissionId) {
    return res.status(404).json(makeApiError('not_found', 'pending permission not found'));
  }

  const result = await runAlgorithmCommand({
    command: 'decidePermission',
    runId: metadata.runId,
    requestId: newId('req'),
    ownerUserId: metadata.ownerUserId,
    payload: {
      permissionId: req.params.permissionId,
      allow: body.value.allow,
      message: body.value.message,
      updatedInput: body.value.updatedInput,
    },
    onFrame: (frame) => persistRunnerFrame(metadata.runId, frame),
  });
  if (!result.ok) return sendErrorResult(res, result);

  await appendAlgorithmEvent(metadata.runId, {
    type: 'algorithm.permission.decided',
    payload: { permissionId: req.params.permissionId, allow: body.value.allow },
  });
  const nextState = await readAlgorithmRunState(metadata.runId);
  return res.json(makeApiSuccess({
    runId: metadata.runId,
    permissionId: req.params.permissionId,
    state: nextState,
    cursor: nextState.eventCursor,
  }));
});

export default router;
