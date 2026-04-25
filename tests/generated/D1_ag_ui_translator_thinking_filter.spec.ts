/**
 * @gwt.id    gwt-nolme-thinking-drop
 * @rr.reads  rr.nolme.ag_ui_translator
 * @rr.writes rr.nolme.reasoning_message
 * @rr.raises —
 */
import { describe, it, expect } from 'vitest';
import { translate } from '../../server/agents/ag-ui-event-translator.js';

function makeCursor(primarySessionId: string | null = 's-1') {
  return {
    primarySessionId,
    currentMessageId: null,
    currentToolId: null,
    sawSessionCreated: false,
    sawComplete: false,
  };
}

describe('D1 · AG-UI translator thinking flow', () => {
  it('emits assistant text events for thinking frames', () => {
    const events = translate(
      { kind: 'thinking', content: 'internal monologue', sessionId: 's-1' },
      makeCursor(),
    );
    expect(events).toEqual([
      { type: 'TEXT_MESSAGE_START', messageId: events[0]?.messageId, role: 'assistant' },
      { type: 'TEXT_MESSAGE_CONTENT', messageId: events[0]?.messageId, delta: 'internal monologue' },
      { type: 'TEXT_MESSAGE_END', messageId: events[0]?.messageId },
    ]);
  });

  it('still emits TEXT_MESSAGE_* events for ordinary text frames', () => {
    const events = translate(
      { kind: 'text', content: 'hello', sessionId: 's-1' },
      makeCursor(),
    );
    expect(events.length).toBeGreaterThan(0);
    expect(events[0].type).toMatch(/TEXT_MESSAGE/);
  });
});
