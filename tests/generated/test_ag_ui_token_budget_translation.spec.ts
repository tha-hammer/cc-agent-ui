import { describe, expect, it } from 'vitest';

import { createCursor, translate } from '../../server/agents/ag-ui-event-translator.js';

describe('ag-ui token-budget translation (cam-by2)', () => {
  it('emits a tokenBudget state patch even when a tool call is open', () => {
    const cursor = createCursor({ primarySessionId: 's-1' });

    translate(
      { kind: 'tool_use', toolId: 'tool-1', toolName: 'Bash', toolInput: { command: 'ls' }, sessionId: 's-1' },
      cursor,
    );

    const events = translate(
      {
        kind: 'status',
        text: 'token_budget',
        tokenBudget: { used: 120, total: 200 },
        provider: 'claude',
        sessionId: 's-1',
      },
      cursor,
    );

    expect(events.map((event) => event.type)).toEqual(['TOOL_CALL_ARGS', 'STATE_DELTA']);
    const delta = (events[1] as any).delta as Array<any>;
    expect(delta).toEqual(
      expect.arrayContaining([
        { op: 'add', path: '/statusText', value: 'token_budget' },
        expect.objectContaining({
          op: 'add',
          path: '/tokenBudget',
          value: expect.objectContaining({
            provider: 'claude',
            source: 'live',
            supported: true,
            used: 120,
            total: 200,
            remaining: 80,
            usedPercent: 60,
            remainingPercent: 40,
          }),
        }),
      ]),
    );
  });

  it('does not add /tokenBudget when the payload is malformed', () => {
    const cursor = createCursor({ primarySessionId: 's-1' });
    const events = translate(
      {
        kind: 'status',
        text: 'token_budget',
        tokenBudget: { used: 'bad', total: 200 },
        provider: 'claude',
        sessionId: 's-1',
      } as any,
      cursor,
    );

    expect(events.map((event) => event.type)).toEqual(['STATE_DELTA']);
    const delta = (events[0] as any).delta as Array<any>;
    expect(delta).toEqual([{ op: 'add', path: '/statusText', value: 'token_budget' }]);
  });
});
