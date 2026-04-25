import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import http from 'node:http';
import express from 'express';

const {
  getPendingApprovalsForSessionMock,
  resolveToolApprovalMock,
} = vi.hoisted(() => ({
  getPendingApprovalsForSessionMock: vi.fn(),
  resolveToolApprovalMock: vi.fn(),
}));

vi.mock('../../server/claude-sdk.js', () => ({
  getPendingApprovalsForSession: getPendingApprovalsForSessionMock,
  resolveToolApproval: resolveToolApprovalMock,
}));

import nolmeStateRouter from '../../server/routes/nolme-state.js';

let server: http.Server;
let port: number;

async function start() {
  const app = express();
  app.use(express.json());
  app.use('/api/nolme', nolmeStateRouter);
  await new Promise<void>((resolve) => {
    server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      port = (server.address() as { port: number }).port;
      resolve();
    });
  });
}

describe('Nolme pending permission routes', () => {
  beforeEach(async () => {
    getPendingApprovalsForSessionMock.mockReset();
    resolveToolApprovalMock.mockReset();
    await start();
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('GET /api/nolme/pending-permissions/:sessionId returns pending AskUserQuestion requests', async () => {
    getPendingApprovalsForSessionMock.mockReturnValue([
      {
        requestId: 'req-1',
        toolName: 'AskUserQuestion',
        input: {
          questions: [
            {
              header: 'BUSINESS TYPE',
              question: 'Which business are you actively evaluating?',
              options: [{ label: 'Car wash' }, { label: 'Laundromat' }],
            },
          ],
        },
        sessionId: 's-1',
      },
    ]);

    const res = await fetch(`http://127.0.0.1:${port}/api/nolme/pending-permissions/s-1?provider=claude`);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      requests: [
        {
          requestId: 'req-1',
          toolName: 'AskUserQuestion',
          input: {
            questions: [
              {
                header: 'BUSINESS TYPE',
                question: 'Which business are you actively evaluating?',
                options: [{ label: 'Car wash' }, { label: 'Laundromat' }],
              },
            ],
          },
          sessionId: 's-1',
        },
      ],
    });
    expect(getPendingApprovalsForSessionMock).toHaveBeenCalledWith('s-1');
  });

  it('POST /api/nolme/pending-permissions/:sessionId/:requestId/decision resolves the approval with accumulated answers', async () => {
    getPendingApprovalsForSessionMock.mockReturnValue([
      { requestId: 'req-1', toolName: 'AskUserQuestion', input: { questions: [] }, sessionId: 's-1' },
    ]);

    const res = await fetch(
      `http://127.0.0.1:${port}/api/nolme/pending-permissions/s-1/req-1/decision`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          allow: true,
          updatedInput: {
            questions: [],
            answers: {
              'Which business are you actively evaluating?': 'Car wash',
              "What's your role in this?": 'Operator',
            },
          },
        }),
      },
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(resolveToolApprovalMock).toHaveBeenCalledWith('req-1', {
      allow: true,
      updatedInput: {
        questions: [],
        answers: {
          'Which business are you actively evaluating?': 'Car wash',
          "What's your role in this?": 'Operator',
        },
      },
      message: undefined,
      rememberEntry: undefined,
    });
  });
});
