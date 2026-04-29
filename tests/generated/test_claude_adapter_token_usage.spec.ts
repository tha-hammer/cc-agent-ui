import { describe, expect, it, vi } from 'vitest';

const { getSessionMessagesMock } = vi.hoisted(() => ({
  getSessionMessagesMock: vi.fn(),
}));

vi.mock('../../server/projects.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../server/projects.js')>()),
  getSessionMessages: getSessionMessagesMock,
}));

import { claudeAdapter } from '../../server/providers/claude/adapter.js';

describe('Claude adapter context usage', () => {
  it('exposes latest-turn context usage instead of cumulative session spend', async () => {
    getSessionMessagesMock.mockResolvedValue([
      {
        type: 'assistant',
        uuid: 'old',
        timestamp: '2026-04-29T12:00:00.000Z',
        message: {
          role: 'assistant',
          model: 'claude-sonnet-4-6',
          content: [{ type: 'text', text: 'old answer' }],
          usage: {
            input_tokens: 1000,
            cache_creation_input_tokens: 1000,
            cache_read_input_tokens: 1000,
            output_tokens: 1000,
          },
        },
      },
      {
        type: 'assistant',
        uuid: 'new',
        timestamp: '2026-04-29T12:01:00.000Z',
        message: {
          role: 'assistant',
          model: 'claude-sonnet-4-5-1m',
          content: [{ type: 'text', text: 'new answer' }],
          usage: {
            input_tokens: 10,
            cache_creation_input_tokens: 20,
            cache_read_input_tokens: 30,
            output_tokens: 40,
          },
        },
      },
    ]);

    const result = await claudeAdapter.fetchHistory('s-1', { projectName: 'demo-project' });

    expect(result.tokenUsage).toEqual(expect.objectContaining({
      used: 100,
      total: 1_000_000,
      usedPercent: 0.01,
      model: 'claude-sonnet-4-5-1m',
    }));
  });
});
