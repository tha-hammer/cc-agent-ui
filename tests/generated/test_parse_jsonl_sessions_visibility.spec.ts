import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { parseJsonlSessions } from '../../server/projects.js';

let tmpDir: string;

function writeJsonl(filename: string, entries: unknown[]) {
  const filePath = path.join(tmpDir, filename);
  const body = entries.map((entry) => JSON.stringify(entry)).join('\n');
  fs.writeFileSync(filePath, `${body}\n`, 'utf8');
  return filePath;
}

describe('parseJsonlSessions visibility regression (Phase 1 · B12)', () => {
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'parse-jsonl-sessions-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('keeps a stalled root user session visible', async () => {
    const sessionId = '4eb333cd-14bd-4f3f-bde9-101753222b4f';
    const filePath = writeJsonl(`${sessionId}.jsonl`, [
      { type: 'queue-operation', operation: 'enqueue', sessionId },
      { type: 'queue-operation', operation: 'dequeue', sessionId },
      {
        type: 'user',
        sessionId,
        parentUuid: null,
        timestamp: '2026-04-16T19:19:59.015Z',
        message: {
          role: 'user',
          content: 'what does the Cloudflare skill do?',
        },
      },
      { type: 'ai-title', sessionId, aiTitle: 'Learn about Cloudflare skill functionality' },
      { type: 'last-prompt', sessionId, lastPrompt: 'what does the Cloudflare skill do?' },
    ]);

    const result = await parseJsonlSessions(filePath);

    expect(result.sessions).toHaveLength(1);
    expect(result.sessions[0]).toMatchObject({
      id: sessionId,
      summary: 'what does the Cloudflare skill do?',
    });
  });

  it('keeps a short tool-completion root session visible', async () => {
    const sessionId = '8b4cd2b4-5021-4433-af4a-7c0c6dee744b';
    const filePath = writeJsonl(`${sessionId}.jsonl`, [
      { type: 'queue-operation', operation: 'enqueue', sessionId },
      { type: 'queue-operation', operation: 'dequeue', sessionId },
      {
        type: 'user',
        sessionId,
        parentUuid: null,
        timestamp: '2026-04-25T21:33:52.061Z',
        message: {
          role: 'user',
          content: 'a1cec9316dd041073 toolu_01L6ZwK3WXzcWwaUFr2ByDVc completed Agent completed --- SUMMARY: Comprehensive laundromat acquisition research...',
        },
      },
      { type: 'ai-title', sessionId, aiTitle: 'Laundromat acquisition research' },
      {
        type: 'assistant',
        sessionId,
        message: {
          role: 'assistant',
          content: [{ type: 'text', text: 'Sharing laundromat research.' }],
        },
      },
      {
        type: 'assistant',
        sessionId,
        message: {
          role: 'assistant',
          content: [{ type: 'text', text: 'Here is the dossier.' }],
        },
      },
      { type: 'last-prompt', sessionId, lastPrompt: 'Laundromat acquisition research' },
    ]);

    const result = await parseJsonlSessions(filePath);

    expect(result.sessions).toHaveLength(1);
    expect(result.sessions[0]?.id).toBe(sessionId);
  });

  it('still hides a context-wrapped title-generation subprocess', async () => {
    const sessionId = 'ad2104ed-dd8f-4187-916d-de1437f43f3b';
    const filePath = writeJsonl(`${sessionId}.jsonl`, [
      { type: 'queue-operation', operation: 'enqueue', sessionId },
      { type: 'queue-operation', operation: 'dequeue', sessionId },
      {
        type: 'user',
        sessionId,
        parentUuid: null,
        timestamp: '2026-04-16T19:19:58.805Z',
        message: {
          role: 'user',
          content: 'CONTEXT:\nUser: what skills are available\nAssistant: prior answer\n\nCURRENT MESSAGE:\nwhat does the Cloudflare skill do?',
        },
      },
      { type: 'ai-title', sessionId, aiTitle: 'Explore available skills and integrations' },
      {
        type: 'assistant',
        sessionId,
        message: {
          role: 'assistant',
          content: [{ type: 'text', text: 'Thinking' }],
        },
      },
      {
        type: 'assistant',
        sessionId,
        message: {
          role: 'assistant',
          content: [{ type: 'text', text: 'I do not have the registry.' }],
        },
      },
      { type: 'last-prompt', sessionId, lastPrompt: 'what does the Cloudflare skill do?' },
    ]);

    const result = await parseJsonlSessions(filePath);

    expect(result.sessions).toEqual([]);
  });
});
