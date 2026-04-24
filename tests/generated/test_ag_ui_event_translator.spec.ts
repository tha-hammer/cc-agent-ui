import { describe, it, expect } from 'vitest';
import { createCursor, translate } from '../../server/agents/ag-ui-event-translator.js';

describe('ag-ui-event-translator — full MessageKind coverage (Phase 1 · B4)', () => {
  const P = 'primary-s1';

  it('ignores malformed frames', () => {
    const c = createCursor({ primarySessionId: P });
    expect(translate(null, c)).toEqual([]);
    expect(translate({}, c)).toEqual([]);
    expect(translate({ kind: null }, c)).toEqual([]);
  });

  it('text frame emits START + CONTENT + END in one go', () => {
    const c = createCursor({ primarySessionId: P });
    const events = translate({ kind: 'text', role: 'assistant', content: 'Hi', sessionId: P }, c);
    expect(events.map((e) => e.type)).toEqual([
      'TEXT_MESSAGE_START',
      'TEXT_MESSAGE_CONTENT',
      'TEXT_MESSAGE_END',
    ]);
    expect((events[1] as any).delta).toBe('Hi');
  });

  it('thinking frame emits TEXT_MESSAGE_* with thinking flag', () => {
    const c = createCursor({ primarySessionId: P });
    const events = translate({ kind: 'thinking', content: 'pondering...', sessionId: P }, c);
    expect(events.map((e) => e.type)).toEqual([
      'TEXT_MESSAGE_START',
      'TEXT_MESSAGE_CONTENT',
      'TEXT_MESSAGE_END',
    ]);
    expect((events[0] as any).thinking).toBe(true);
  });

  it('tool_use frame emits TOOL_CALL_START + TOOL_CALL_ARGS', () => {
    const c = createCursor({ primarySessionId: P });
    const events = translate(
      { kind: 'tool_use', toolId: 't1', toolName: 'Bash', toolInput: { command: 'ls' }, sessionId: P },
      c,
    );
    expect(events.map((e) => e.type)).toEqual(['TOOL_CALL_START', 'TOOL_CALL_ARGS']);
    expect((events[0] as any).toolCallId).toBe('t1');
    expect((events[0] as any).toolCallName).toBe('Bash');
    expect((events[1] as any).toolCallId).toBe('t1');
    expect(JSON.parse((events[1] as any).delta)).toEqual({ command: 'ls' });
  });

  it('tool_result frame emits TOOL_CALL_END with the result', () => {
    const c = createCursor({ primarySessionId: P });
    const events = translate(
      { kind: 'tool_result', toolId: 't1', content: 'done', sessionId: P },
      c,
    );
    expect(events.map((e) => e.type)).toEqual(['TOOL_CALL_END']);
    expect((events[0] as any).toolCallId).toBe('t1');
  });

  it('permission_request emits synthetic TOOL_CALL_START for requestPermission', () => {
    const c = createCursor({ primarySessionId: P });
    const events = translate(
      {
        kind: 'permission_request',
        requestId: 'req-1',
        toolName: 'Bash',
        input: { command: 'rm -rf /' },
        sessionId: P,
      },
      c,
    );
    expect(events.map((e) => e.type)).toEqual(['TOOL_CALL_START', 'TOOL_CALL_ARGS']);
    expect((events[0] as any).toolCallName).toBe('requestPermission');
    expect((events[0] as any).toolCallId).toBe('perm_req-1');
  });

  it('permission_cancelled resolves the synthetic requestPermission tool call', () => {
    const c = createCursor({ primarySessionId: P });
    const events = translate(
      { kind: 'permission_cancelled', requestId: 'req-1', sessionId: P },
      c,
    );
    expect(events.map((e) => e.type)).toEqual(['TOOL_CALL_END']);
    expect((events[0] as any).toolCallId).toBe('perm_req-1');
  });

  it('status with active tool emits TOOL_CALL_ARGS on that tool', () => {
    const c = createCursor({ primarySessionId: P });
    // Open a tool call first
    translate({ kind: 'tool_use', toolId: 't1', toolName: 'Bash', toolInput: {}, sessionId: P }, c);
    const events = translate({ kind: 'status', text: 'running...', sessionId: P }, c);
    expect(events.map((e) => e.type)).toEqual(['TOOL_CALL_ARGS']);
    expect((events[0] as any).toolCallId).toBe('t1');
  });

  it('status with no active tool emits STATE_DELTA on statusText', () => {
    const c = createCursor({ primarySessionId: P });
    const events = translate({ kind: 'status', text: 'idle...', sessionId: P }, c);
    expect(events.map((e) => e.type)).toEqual(['STATE_DELTA']);
  });

  it('interactive_prompt emits synthetic TOOL_CALL_START for askQuestion', () => {
    const c = createCursor({ primarySessionId: P });
    const events = translate(
      { kind: 'interactive_prompt', content: 'Are you sure?', sessionId: P },
      c,
    );
    expect(events.map((e) => e.type)).toEqual(['TOOL_CALL_START', 'TOOL_CALL_ARGS']);
    expect((events[0] as any).toolCallName).toBe('askQuestion');
  });

  it('task_notification emits STATE_DELTA patching taskNotifications', () => {
    const c = createCursor({ primarySessionId: P });
    const events = translate(
      { kind: 'task_notification', status: 'completed', summary: 'task done', sessionId: P },
      c,
    );
    expect(events.map((e) => e.type)).toEqual(['STATE_DELTA']);
    const delta = (events[0] as any).delta;
    expect(Array.isArray(delta)).toBe(true);
    const patch = delta[0];
    expect(patch.op).toBe('add');
    expect(patch.path).toBe('/taskNotifications/-');
    expect(patch.value.summary).toBe('task done');
  });

  it('stream_delta + stream_end still work (B2 regression)', () => {
    const c = createCursor({ primarySessionId: P });
    const a = translate({ kind: 'stream_delta', content: 'Hel', sessionId: P }, c);
    const b = translate({ kind: 'stream_delta', content: 'lo', sessionId: P }, c);
    const d = translate({ kind: 'stream_end', sessionId: P }, c);
    expect([...a, ...b, ...d].map((e) => e.type)).toEqual([
      'TEXT_MESSAGE_START',
      'TEXT_MESSAGE_CONTENT',
      'TEXT_MESSAGE_CONTENT',
      'TEXT_MESSAGE_END',
    ]);
  });

  it('session_created first emits STATE_SNAPSHOT; second dropped (B3 regression)', () => {
    const c = createCursor();
    const a = translate({ kind: 'session_created', newSessionId: 'brand-new' }, c);
    const b = translate({ kind: 'session_created', newSessionId: 'subagent-x' }, c);
    expect(a).toHaveLength(1);
    expect(a[0].type).toBe('STATE_SNAPSHOT');
    expect(b).toEqual([]);
  });

  it('error frame emits RUN_ERROR', () => {
    const c = createCursor({ primarySessionId: P });
    const events = translate({ kind: 'error', content: 'boom', sessionId: P }, c);
    expect(events.map((e) => e.type)).toEqual(['RUN_ERROR']);
    expect((events[0] as any).message).toBe('boom');
  });

  it('session filter drops frames with mismatched sessionId', () => {
    const c = createCursor({ primarySessionId: P });
    const events = translate({ kind: 'stream_delta', content: 'leak', sessionId: 'other' }, c);
    expect(events).toEqual([]);
  });

  it('unhandled kind returns empty array', () => {
    const c = createCursor({ primarySessionId: P });
    // 'complete' is intentionally a no-op in the translator — agent handles RUN_FINISHED.
    expect(translate({ kind: 'complete', sessionId: P }, c)).toEqual([]);
    // Truly unknown kind
    expect(translate({ kind: 'novel_kind', sessionId: P } as any, c)).toEqual([]);
  });
});
