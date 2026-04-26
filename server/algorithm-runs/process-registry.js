import { EventEmitter } from 'events';

const registry = new Map();

export function registerAlgorithmProcess({ runId, child, ownerUserId, externalRunHandle = null, onExit = null }) {
  if (!runId || !child || typeof child.on !== 'function') {
    throw new Error('runId and child process are required');
  }

  unregisterAlgorithmProcess(runId);

  const entry = {
    runId,
    child,
    ownerUserId: ownerUserId ?? null,
    externalRunHandle,
    registeredAt: new Date().toISOString(),
    terminalSeen: false,
  };

  const cleanup = async (code, signal, error = null) => {
    const current = registry.get(runId);
    if (current !== entry) return;
    registry.delete(runId);
    if (typeof onExit === 'function') {
      await onExit({ runId, code, signal, error, terminalSeen: entry.terminalSeen });
    }
  };

  entry.cleanup = cleanup;
  child.once('exit', (code, signal) => {
    void cleanup(code, signal);
  });
  child.once('error', (error) => {
    void cleanup(null, null, error);
  });

  registry.set(runId, entry);
  return entry;
}

export function getRegisteredProcess(runId) {
  return registry.get(runId) || null;
}

export function markAlgorithmProcessTerminal(runId) {
  const entry = registry.get(runId);
  if (entry) {
    entry.terminalSeen = true;
  }
}

export function unregisterAlgorithmProcess(runId) {
  registry.delete(runId);
}

export async function terminateAlgorithmProcess(runId, { signal = 'SIGTERM', timeoutMs = 5000 } = {}) {
  const entry = registry.get(runId);
  if (!entry) {
    return { ok: true, terminated: false };
  }

  const child = entry.child;
  let settled = false;

  const waitForExit = new Promise((resolve) => {
    const finish = () => {
      if (settled) return;
      settled = true;
      registry.delete(runId);
      resolve();
    };
    child.once('exit', finish);
    child.once('error', finish);
    setTimeout(() => {
      if (!settled && typeof child.kill === 'function') {
        child.kill('SIGKILL');
      }
      finish();
    }, timeoutMs).unref?.();
  });

  if (typeof child.kill === 'function') {
    child.kill(signal);
  }

  await waitForExit;
  return { ok: true, terminated: true };
}

export function clearAlgorithmProcessRegistryForTests() {
  registry.clear();
}

export function createFakeChildProcessForTests() {
  return new EventEmitter();
}

