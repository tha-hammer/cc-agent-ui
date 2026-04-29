import { describe, expect, it } from 'vitest';
import { getModelContextWindow } from '../../shared/modelConstants.js';
import { normalizeAiWorkingTokenBudget } from '../../shared/aiWorkingTokenBudget.js';

describe('AI working token budget normalization', () => {
  it('uses the selected Claude model to derive total context when raw usage omits it', () => {
    expect(normalizeAiWorkingTokenBudget(
      { used: 250_000, model: 'sonnet[1m]' },
      { provider: 'claude', source: 'live' },
    )).toEqual(expect.objectContaining({
      used: 250_000,
      total: 1_000_000,
      usedPercent: 25,
      model: 'sonnet[1m]',
    }));
  });

  it('maps raw Claude JSONL model names to their context window', () => {
    expect(getModelContextWindow('claude', 'claude-sonnet-4-6')).toBe(200_000);
    expect(getModelContextWindow('claude', 'claude-sonnet-4-5-1m')).toBe(1_000_000);
  });

  it('preserves provider-reported Codex context windows from raw LLM output', () => {
    expect(normalizeAiWorkingTokenBudget(
      {
        total_token_usage: { total_tokens: 120_000 },
        model_context_window: 400_000,
      },
      { provider: 'codex', source: 'route' },
    )).toEqual(expect.objectContaining({
      used: 120_000,
      total: 400_000,
      usedPercent: 30,
    }));
  });
});
