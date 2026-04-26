// G-5 follow-up: detect hook/CLI meta-session spawns (title-gen, one-shot
// subprocesses) that leak into the sidebar. Unlike Task-tool subagents these
// have parentUuid: null on first user, so isSubagentSession misses them.
// Real user sessions have SessionStart-hook progress events; meta-sessions don't.
// See thoughts/searchable/shared/research/2026-04-16-session-handling-audit.md

import { describe, it, expect } from 'vitest';
import { isMetaSession } from '../../server/projects.js';

describe('isMetaSession', () => {
  it('returns true for a CLI title-generation subprocess (1 user, 2 assistant, 0 progress)', () => {
    // Shape observed in ~/.claude/projects/.../ad2104ed-*.jsonl — first user
    // content "CONTEXT: User: X\nAssistant: Y", two short assistant entries.
    const entries = [
      { type: 'queue-operation' },
      { type: 'queue-operation' },
      {
        type: 'user',
        parentUuid: null,
        message: {
          role: 'user',
          content: 'CONTEXT:\nUser: prior question\nAssistant: prior answer\n\nCURRENT MESSAGE:\nwhat does the Cloudflare skill do?',
        },
      },
      { type: 'ai-title' },
      { type: 'assistant' },
      { type: 'assistant' },
      { type: 'last-prompt' },
    ];
    expect(isMetaSession(entries)).toBe(true);
  });

  it('returns true for a title-generation subprocess spawned from a short option label', () => {
    const entries = [
      { type: 'queue-operation' },
      { type: 'queue-operation' },
      {
        type: 'user',
        parentUuid: null,
        message: {
          role: 'user',
          content: 'H — Lease negotiation (key terms, exclusivity, CAM)',
        },
      },
      { type: 'ai-title' },
      {
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [
            {
              type: 'thinking',
              thinking: [
                'The user has sent a brief message: "H — Lease negotiation (key terms, exclusivity, CAM)"',
                'I need to create a 2-4 word COMPLETE SENTENCE summarizing the user\'s CURRENT MESSAGE',
                'Start with a gerund (-ing verb)',
              ].join('\n'),
            },
          ],
        },
      },
      {
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [{ type: 'text', text: 'Negotiating lease terms.' }],
        },
      },
      { type: 'last-prompt' },
    ];

    expect(isMetaSession(entries)).toBe(true);
  });

  it('returns true for a title-generation subprocess whose prompt mirrors the user request', () => {
    const entries = [
      { type: 'queue-operation' },
      { type: 'queue-operation' },
      {
        type: 'user',
        parentUuid: null,
        message: {
          role: 'user',
          content: "Let's research the laundromat business",
        },
      },
      { type: 'ai-title' },
      {
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [
            {
              type: 'thinking',
              thinking: [
                'The user wants to research the laundromat business.',
                'But wait, my job here is to generate a 4-word title for this work session.',
              ].join('\n'),
            },
          ],
        },
      },
      {
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [{ type: 'text', text: 'Research Laundromat Business Opportunities' }],
        },
      },
      { type: 'last-prompt' },
    ];

    expect(isMetaSession(entries)).toBe(true);
  });

  it('returns true for an ai-title-only option-label subprocess', () => {
    const entries = [
      { type: 'queue-operation' },
      { type: 'queue-operation' },
      {
        type: 'user',
        parentUuid: null,
        message: {
          role: 'user',
          content: 'Both / comparing',
        },
      },
      { type: 'ai-title' },
      { type: 'last-prompt' },
    ];

    expect(isMetaSession(entries)).toBe(true);
  });

  it('returns false for a stalled root user session (1 user, 0 assistant, 0 progress)', () => {
    // Shape observed in 4eb333cd-*.jsonl — plain user msg, never got a response.
    const entries = [
      { type: 'queue-operation' },
      { type: 'queue-operation' },
      {
        type: 'user',
        parentUuid: null,
        message: {
          role: 'user',
          content: 'what does the Cloudflare skill do?',
        },
      },
      { type: 'ai-title' },
      { type: 'last-prompt' },
    ];
    expect(isMetaSession(entries)).toBe(false);
  });

  it('returns false for a short tool-completion root session (1 user, 2 assistant, 0 progress)', () => {
    // Shape observed in 8b4cd2b4-*.jsonl — root session started from the UI,
    // but the first user payload is a tool completion summary.
    const entries = [
      { type: 'queue-operation' },
      { type: 'queue-operation' },
      {
        type: 'user',
        parentUuid: null,
        message: {
          role: 'user',
          content: 'a1cec9316dd041073 toolu_01L6ZwK3WXzcWwaUFr2ByDVc completed Agent completed --- SUMMARY: Comprehensive laundromat acquisition research...',
        },
      },
      { type: 'ai-title' },
      { type: 'assistant' },
      { type: 'assistant' },
      { type: 'last-prompt' },
    ];
    expect(isMetaSession(entries)).toBe(false);
  });

  it('returns false for a real conversation (many turns + progress entries)', () => {
    // Shape observed in 85d294a2-*.jsonl — 12 progress, 11 assistant, 7 user.
    const entries = [
      ...Array(8).fill({ type: 'queue-operation' }),
      { type: 'user', parentUuid: null },
      { type: 'ai-title' },
      ...Array(11).fill({ type: 'assistant' }),
      ...Array(12).fill({ type: 'progress' }),
      { type: 'last-prompt' },
    ];
    expect(isMetaSession(entries)).toBe(false);
  });

  it('returns false when there is at least one progress entry (real SessionStart-hook signature)', () => {
    const entries = [
      { type: 'user' },
      { type: 'assistant' },
      { type: 'progress' },
    ];
    expect(isMetaSession(entries)).toBe(false);
  });

  it('returns true for an empty session (edge)', () => {
    expect(isMetaSession([])).toBe(true);
  });

  it('returns true at the boundary (2 assistants, 0 progress)', () => {
    const entries = [
      { type: 'user' },
      { type: 'assistant' },
      { type: 'assistant' },
    ];
    expect(isMetaSession(entries)).toBe(true);
  });

  it('returns false at the boundary (3 assistants, 0 progress)', () => {
    // A short but real conversation with multiple assistant turns is NOT hidden.
    const entries = [
      { type: 'user' },
      { type: 'assistant' },
      { type: 'assistant' },
      { type: 'assistant' },
    ];
    expect(isMetaSession(entries)).toBe(false);
  });
});
