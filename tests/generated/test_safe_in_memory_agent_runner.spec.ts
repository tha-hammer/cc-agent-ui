import { describe, it, expect, afterEach } from 'vitest';
import { EMPTY, lastValueFrom } from 'rxjs';
import { toArray } from 'rxjs/operators';
import { AbstractAgent, EventType } from '@ag-ui/client';

import { SafeInMemoryAgentRunner } from '../../server/lib/safe-in-memory-agent-runner.js';

const GLOBAL_STORE_KEY = Symbol.for('@copilotkit/runtime/in-memory-store');

function clearThread(threadId: string) {
  const data = (globalThis as Record<symbol, any>)[GLOBAL_STORE_KEY];
  data?.stores?.delete?.(threadId);
  data?.historicRunsBackup?.delete?.(threadId);
}

class ThrowingAgent extends AbstractAgent {
  constructor(private readonly error: Error) {
    super();
  }

  async runAgent(): Promise<void> {
    throw this.error;
  }

  clone(): AbstractAgent {
    return new ThrowingAgent(this.error);
  }

  protected run(): ReturnType<AbstractAgent['run']> {
    return EMPTY;
  }

  protected connect(): ReturnType<AbstractAgent['connect']> {
    return EMPTY;
  }
}

class FinishingAgent extends AbstractAgent {
  async runAgent(
    input: any,
    options: {
      onEvent: (event: { event: any }) => void;
      onRunStartedEvent?: () => void;
    },
  ): Promise<void> {
    options.onEvent({
      event: {
        type: EventType.RUN_STARTED,
        threadId: input.threadId,
        runId: input.runId,
      },
    });
    options.onRunStartedEvent?.();
    options.onEvent({
      event: {
        type: EventType.TEXT_MESSAGE_START,
        messageId: 'assistant-1',
        role: 'assistant',
      },
    });
    options.onEvent({
      event: {
        type: EventType.TEXT_MESSAGE_CONTENT,
        messageId: 'assistant-1',
        delta: 'Recovered',
      },
    });
    options.onEvent({
      event: {
        type: EventType.TEXT_MESSAGE_END,
        messageId: 'assistant-1',
      },
    });
    options.onEvent({
      event: {
        type: EventType.RUN_FINISHED,
        threadId: input.threadId,
        runId: input.runId,
      },
    });
  }

  clone(): AbstractAgent {
    return new FinishingAgent();
  }

  protected run(): ReturnType<AbstractAgent['run']> {
    return EMPTY;
  }

  protected connect(): ReturnType<AbstractAgent['connect']> {
    return EMPTY;
  }
}

describe('SafeInMemoryAgentRunner', () => {
  const threadId = `safe-runner-${Date.now()}`;

  afterEach(() => {
    clearThread(threadId);
  });

  it('prunes errored historic runs before connect replay', async () => {
    const runner = new SafeInMemoryAgentRunner();

    await lastValueFrom(
      runner
        .run({
          threadId,
          agent: new ThrowingAgent(new Error('boom')),
          input: { threadId, runId: 'run-error', messages: [], state: {} },
        })
        .pipe(toArray()),
    );

    const replayAfterFailure = await lastValueFrom(
      runner.connect({ threadId }).pipe(toArray()),
    );
    expect(replayAfterFailure).toEqual([]);

    await lastValueFrom(
      runner
        .run({
          threadId,
          agent: new FinishingAgent(),
          input: { threadId, runId: 'run-ok', messages: [], state: {} },
        })
        .pipe(toArray()),
    );

    const replayAfterRecovery = await lastValueFrom(
      runner.connect({ threadId }).pipe(toArray()),
    );

    expect(replayAfterRecovery.map((event) => event.type)).toEqual([
      EventType.RUN_STARTED,
      EventType.TEXT_MESSAGE_START,
      EventType.TEXT_MESSAGE_CONTENT,
      EventType.TEXT_MESSAGE_END,
      EventType.RUN_FINISHED,
    ]);
    expect(
      replayAfterRecovery.find((event: any) => event.type === EventType.RUN_ERROR),
    ).toBeUndefined();
  });
});
