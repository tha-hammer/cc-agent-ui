import { isTerminalStatus } from './contracts.js';

function writeSse(res, eventName, data) {
  res.write(`event: ${eventName}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function isTerminalEvent(event) {
  return ['algorithm.run.completed', 'algorithm.run.failed', 'algorithm.run.cancelled'].includes(event.type);
}

export function streamAlgorithmEvents({
  req,
  res,
  runId,
  after = 0,
  readEventsSince,
  readState,
  pollIntervalMs = 1000,
  heartbeatIntervalMs = 15000,
  maxLifetimeMs = 15 * 60 * 1000,
  onCleanup = null,
}) {
  let cursor = after;
  let closed = false;
  let pollTimer = null;
  let heartbeatTimer = null;
  let lifetimeTimer = null;

  const cleanup = () => {
    if (closed) return;
    closed = true;
    if (pollTimer) clearInterval(pollTimer);
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    if (lifetimeTimer) clearTimeout(lifetimeTimer);
    onCleanup?.();
  };

  const closeStream = () => {
    cleanup();
    if (!res.writableEnded) {
      res.end();
    }
  };

  const sendBacklog = async () => {
    if (closed) return;
    const events = await readEventsSince(runId, cursor);
    let terminal = false;
    for (const event of events) {
      if (closed) return;
      writeSse(res, 'algorithm.event', event);
      cursor = event.sequence;
      terminal = terminal || isTerminalEvent(event);
    }
    if (!terminal && events.length === 0 && readState) {
      const state = await readState(runId);
      terminal = isTerminalStatus(state.status);
      cursor = state.eventCursor?.sequence ?? cursor;
    }
    if (terminal) {
      closeStream();
    }
  };

  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  req.on('close', cleanup);

  void sendBacklog().then(() => {
    if (closed) return;
    heartbeatTimer = setInterval(() => {
      writeSse(res, 'algorithm.heartbeat', {
        schemaVersion: 1,
        runId,
        cursor: { sequence: cursor },
      });
    }, heartbeatIntervalMs);
    heartbeatTimer.unref?.();

    pollTimer = setInterval(() => {
      void sendBacklog().catch(closeStream);
    }, pollIntervalMs);
    pollTimer.unref?.();

    lifetimeTimer = setTimeout(closeStream, maxLifetimeMs);
    lifetimeTimer.unref?.();
  }).catch(closeStream);

  return cleanup;
}

