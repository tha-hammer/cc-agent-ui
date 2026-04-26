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

  it('hides an option-label title-generation subprocess', async () => {
    const sessionId = '18a9b4ce-2e5e-4cc6-97fb-f350b362b5c0';
    const filePath = writeJsonl(`${sessionId}.jsonl`, [
      { type: 'queue-operation', operation: 'enqueue', sessionId, content: 'H — Lease negotiation (key terms, exclusivity, CAM)' },
      { type: 'queue-operation', operation: 'dequeue', sessionId },
      {
        type: 'user',
        sessionId,
        parentUuid: null,
        timestamp: '2026-04-26T01:28:22.079Z',
        message: {
          role: 'user',
          content: 'H — Lease negotiation (key terms, exclusivity, CAM)',
        },
      },
      { type: 'ai-title', sessionId, aiTitle: 'Lease negotiation key terms and CAM' },
      {
        type: 'assistant',
        sessionId,
        message: {
          role: 'assistant',
          content: [{
            type: 'thinking',
            thinking: [
              'The user has sent a brief message: "H — Lease negotiation (key terms, exclusivity, CAM)"',
              'I need to create a 2-4 word COMPLETE SENTENCE summarizing the user\'s CURRENT MESSAGE',
              'Start with a gerund (-ing verb)',
            ].join('\n'),
          }],
        },
      },
      {
        type: 'assistant',
        sessionId,
        message: {
          role: 'assistant',
          content: [{ type: 'text', text: 'Negotiating lease terms.' }],
        },
      },
      { type: 'last-prompt', sessionId, lastPrompt: 'H — Lease negotiation (key terms, exclusivity, CAM)' },
    ]);

    const result = await parseJsonlSessions(filePath);

    expect(result.sessions).toEqual([]);
  });

  it('hides a natural-language title-generation subprocess', async () => {
    const sessionId = '22818ae0-6d0a-4124-8fdc-dfa236298e7d';
    const filePath = writeJsonl(`${sessionId}.jsonl`, [
      { type: 'queue-operation', operation: 'enqueue', sessionId, content: "Let's research the laundromat business" },
      { type: 'queue-operation', operation: 'dequeue', sessionId },
      {
        type: 'user',
        sessionId,
        parentUuid: null,
        timestamp: '2026-04-25T21:56:17.131Z',
        message: {
          role: 'user',
          content: "Let's research the laundromat business",
        },
      },
      { type: 'ai-title', sessionId, aiTitle: 'Research laundromat business' },
      {
        type: 'assistant',
        sessionId,
        message: {
          role: 'assistant',
          content: [{
            type: 'thinking',
            thinking: [
              'The user wants to research the laundromat business.',
              'But wait, my job here is to generate a 4-word title for this work session.',
            ].join('\n'),
          }],
        },
      },
      {
        type: 'assistant',
        sessionId,
        message: {
          role: 'assistant',
          content: [{ type: 'text', text: 'Research Laundromat Business Opportunities' }],
        },
      },
      { type: 'last-prompt', sessionId, lastPrompt: "Let's research the laundromat business" },
    ]);

    const result = await parseJsonlSessions(filePath);

    expect(result.sessions).toEqual([]);
  });

  it('hides an ai-title-only option-label subprocess', async () => {
    const sessionId = 'e4398c31-5480-4ee8-8fa8-b85d348910ab';
    const filePath = writeJsonl(`${sessionId}.jsonl`, [
      { type: 'queue-operation', operation: 'enqueue', sessionId, content: 'Both / comparing' },
      { type: 'queue-operation', operation: 'dequeue', sessionId },
      {
        type: 'user',
        sessionId,
        parentUuid: null,
        timestamp: '2026-04-25T21:13:27.057Z',
        message: {
          role: 'user',
          content: 'Both / comparing',
        },
      },
      { type: 'ai-title', sessionId, aiTitle: 'Comparing two approaches or options' },
      { type: 'last-prompt', sessionId, lastPrompt: 'Both / comparing' },
    ]);

    const result = await parseJsonlSessions(filePath);

    expect(result.sessions).toEqual([]);
  });
});
