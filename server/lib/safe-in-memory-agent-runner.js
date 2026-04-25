import { EventType } from '@ag-ui/client';
import { InMemoryAgentRunner } from '@copilotkit/runtime/v2';

const GLOBAL_STORE_KEY = Symbol.for('@copilotkit/runtime/in-memory-store');

function pruneErroredRuns(runs) {
  if (!Array.isArray(runs) || runs.length === 0) {
    return runs ?? [];
  }

  return runs.filter(
    (run) => !run?.events?.some((event) => event?.type === EventType.RUN_ERROR),
  );
}

function syncHistoricRunBackup(threadId, historicRuns) {
  const data = globalThis[GLOBAL_STORE_KEY];
  if (!data?.historicRunsBackup) {
    return;
  }

  if (historicRuns.length === 0) {
    data.historicRunsBackup.delete(threadId);
    return;
  }

  data.historicRunsBackup.set(threadId, historicRuns);
}

export class SafeInMemoryAgentRunner extends InMemoryAgentRunner {
  connect(request) {
    const data = globalThis[GLOBAL_STORE_KEY];
    const store = data?.stores?.get?.(request.threadId);

    if (store?.historicRuns) {
      const prunedRuns = pruneErroredRuns(store.historicRuns);
      if (prunedRuns.length !== store.historicRuns.length) {
        store.historicRuns = prunedRuns;
        syncHistoricRunBackup(request.threadId, prunedRuns);
      }
    } else if (data?.historicRunsBackup?.has?.(request.threadId)) {
      const prunedRuns = pruneErroredRuns(
        data.historicRunsBackup.get(request.threadId),
      );
      syncHistoricRunBackup(request.threadId, prunedRuns);
    }

    return super.connect(request);
  }
}
