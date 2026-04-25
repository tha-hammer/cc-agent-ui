/**
 * Frame → AG-UI event translator.
 *
 * Translates the NormalizedMessage-like frames emitted by cc-agent-ui's provider
 * runtime entrypoints (kind-enum defined in server/providers/types.js:22) into
 * the AG-UI BaseEvent shapes consumed by CopilotKit.
 *
 * This file is a PURE function plus a stateful `translate()` helper. All state
 * lives in the `TranslatorCursor` object owned by the caller.
 *
 * @module agents/ag-ui-event-translator
 */

import { normalizeAiWorkingTokenBudget } from '../../shared/aiWorkingTokenBudget.js';

/** @typedef {'RUN_STARTED'|'RUN_FINISHED'|'RUN_ERROR'|'TEXT_MESSAGE_START'|'TEXT_MESSAGE_CONTENT'|'TEXT_MESSAGE_END'|'TOOL_CALL_START'|'TOOL_CALL_ARGS'|'TOOL_CALL_END'|'STATE_SNAPSHOT'|'STATE_DELTA'} AgUiEventType */

/**
 * Caller-owned cursor. Fresh per run.
 * @typedef {{
 *   primarySessionId: string | null,
 *   currentMessageId: string | null,
 *   currentToolId: string | null,
 *   sawSessionCreated: boolean,
 *   sawComplete: boolean,
 *   sawError: boolean,
 * }} TranslatorCursor
 */

/**
 * @param {{ primarySessionId?: string | null }} [init]
 * @returns {TranslatorCursor}
 */
export function createCursor(init = {}) {
  return {
    primarySessionId: init.primarySessionId || null,
    currentMessageId: null,
    currentToolId: null,
    sawSessionCreated: false,
    sawComplete: false,
    sawError: false,
  };
}

let messageIdSeq = 0;
function nextMessageId() {
  messageIdSeq += 1;
  return `msg_${Date.now()}_${messageIdSeq}`;
}

let toolIdSeq = 0;
function nextToolId() {
  toolIdSeq += 1;
  return `tool_${Date.now()}_${toolIdSeq}`;
}

/**
 * session_created is evaluated separately — its newSessionId either bootstraps
 * the primary id (when none is set) or indicates a subagent spawn (drop).
 */
function passesSessionFilter(frame, cursor) {
  if (frame.kind === 'session_created') return true;
  if (!frame.sessionId) return true;
  if (cursor.primarySessionId === null) return true;
  return frame.sessionId === cursor.primarySessionId;
}

/**
 * Emit a full text-message triad in a single translate() call. Used by `text`
 * (complete, non-streamed) and `thinking` kinds.
 */
function emitTextTriad(content, cursor, { thinking = false } = {}) {
  const messageId = nextMessageId();
  const start = { type: 'TEXT_MESSAGE_START', messageId, role: 'assistant' };
  if (thinking) start.thinking = true;
  return [
    start,
    { type: 'TEXT_MESSAGE_CONTENT', messageId, delta: content },
    { type: 'TEXT_MESSAGE_END', messageId },
  ];
}

/**
 * Translate a single frame to 0..N AG-UI events.
 * @param {any} frame
 * @param {TranslatorCursor} cursor
 * @returns {Array<{ type: AgUiEventType, [k: string]: any }>}
 */
export function translate(frame, cursor) {
  if (!frame || typeof frame !== 'object' || !frame.kind) return [];
  if (!passesSessionFilter(frame, cursor)) return [];

  switch (frame.kind) {
    case 'stream_delta': {
      const content = typeof frame.content === 'string' ? frame.content : (frame.delta ?? '');
      if (cursor.currentMessageId === null) {
        const messageId = nextMessageId();
        cursor.currentMessageId = messageId;
        return [
          { type: 'TEXT_MESSAGE_START', messageId, role: 'assistant' },
          { type: 'TEXT_MESSAGE_CONTENT', messageId, delta: content },
        ];
      }
      return [{ type: 'TEXT_MESSAGE_CONTENT', messageId: cursor.currentMessageId, delta: content }];
    }

    case 'stream_end': {
      if (cursor.currentMessageId !== null) {
        const messageId = cursor.currentMessageId;
        cursor.currentMessageId = null;
        return [{ type: 'TEXT_MESSAGE_END', messageId }];
      }
      return [];
    }

    case 'text': {
      const content = typeof frame.content === 'string' ? frame.content : '';
      return emitTextTriad(content, cursor);
    }

    case 'thinking': {
      // The provider-side `thinking` frame is where Algorithm-mode and
      // long-form Silmari output actually live (the SDK separates "thought
      // process / final answer" from short tool/control frames). cc-agent-ui
      // sees this content because it taps the CLI stdout directly; for
      // Nolme it has to flow through CopilotKit, which means we have to emit
      // events for it.
      //
      // We emit as a regular assistant text triad (no `thinking: true` flag)
      // so the message lands in agent.messages as a normal `role: 'assistant'`
      // entry and renders via the existing NolmeAssistantMessage slot.
      // Suppressing it (returning []) hides the bulk of the agent's output.
      const content = typeof frame.content === 'string' ? frame.content : '';
      return emitTextTriad(content, cursor);
    }

    case 'tool_use': {
      const toolCallId = frame.toolId || nextToolId();
      cursor.currentToolId = toolCallId;
      const toolCallName = frame.toolName || 'unknown';
      const toolInput = frame.toolInput ?? {};
      return [
        { type: 'TOOL_CALL_START', toolCallId, toolCallName, parentMessageId: cursor.currentMessageId ?? null },
        { type: 'TOOL_CALL_ARGS', toolCallId, delta: JSON.stringify(toolInput) },
      ];
    }

    case 'tool_result': {
      const toolCallId = frame.toolId || cursor.currentToolId;
      if (!toolCallId) return [];
      if (cursor.currentToolId === toolCallId) cursor.currentToolId = null;
      return [{ type: 'TOOL_CALL_END', toolCallId }];
    }

    case 'permission_request': {
      const toolCallId = `perm_${frame.requestId ?? nextToolId()}`;
      cursor.currentToolId = toolCallId;
      const inputPayload = { toolName: frame.toolName ?? null, input: frame.input ?? null, context: frame.context ?? null };
      return [
        { type: 'TOOL_CALL_START', toolCallId, toolCallName: 'requestPermission', parentMessageId: cursor.currentMessageId ?? null },
        { type: 'TOOL_CALL_ARGS', toolCallId, delta: JSON.stringify(inputPayload) },
      ];
    }

    case 'permission_cancelled': {
      const toolCallId = frame.requestId ? `perm_${frame.requestId}` : cursor.currentToolId;
      if (!toolCallId) return [];
      if (cursor.currentToolId === toolCallId) cursor.currentToolId = null;
      return [{ type: 'TOOL_CALL_END', toolCallId }];
    }

    case 'status': {
      const text = typeof frame.text === 'string' ? frame.text : '';
      const tokenBudget = text === 'token_budget'
        ? normalizeAiWorkingTokenBudget(frame.tokenBudget, {
            provider: frame.provider,
            source: 'live',
          })
        : null;
      const delta = [{ op: 'add', path: '/statusText', value: text }];
      if (tokenBudget) {
        delta.push({ op: 'add', path: '/tokenBudget', value: tokenBudget });
      }
      const events = [];
      if (cursor.currentToolId) {
        events.push({
          type: 'TOOL_CALL_ARGS',
          toolCallId: cursor.currentToolId,
          delta: JSON.stringify({ status: text }),
        });
      }
      events.push({
        type: 'STATE_DELTA',
        // `add` (not `replace`) so the patch succeeds when /statusText is
        // not yet present in NolmeAgentState (DEFAULT_NOLME_AGENT_STATE
        // doesn't seed it). RFC 6902 `replace` requires the path to exist;
        // `add` creates-or-replaces. Without this, the first status frame
        // throws OPERATION_PATH_UNRESOLVABLE and the AG-UI stream stalls,
        // so subsequent text/tool events never reach the Nolme client.
        delta,
      });
      return events;
    }

    case 'interactive_prompt': {
      const toolCallId = nextToolId();
      cursor.currentToolId = toolCallId;
      const content = typeof frame.content === 'string' ? frame.content : '';
      return [
        { type: 'TOOL_CALL_START', toolCallId, toolCallName: 'askQuestion', parentMessageId: cursor.currentMessageId ?? null },
        { type: 'TOOL_CALL_ARGS', toolCallId, delta: JSON.stringify({ question: content }) },
      ];
    }

    case 'task_notification': {
      return [
        {
          type: 'STATE_DELTA',
          delta: [
            {
              op: 'add',
              path: '/taskNotifications/-',
              value: { status: frame.status ?? 'unknown', summary: frame.summary ?? '', ts: Date.now() },
            },
          ],
        },
      ];
    }

    case 'session_created': {
      if (cursor.sawSessionCreated) return [];
      cursor.sawSessionCreated = true;
      if (frame.newSessionId && cursor.primarySessionId === null) {
        cursor.primarySessionId = frame.newSessionId;
      }
      return [
        {
          type: 'STATE_SNAPSHOT',
          snapshot: { sessionId: frame.newSessionId ?? cursor.primarySessionId },
        },
      ];
    }

    case 'complete': {
      cursor.sawComplete = true;
      // RUN_FINISHED is emitted by the caller so it pairs with RUN_STARTED.
      return [];
    }

    case 'error': {
      cursor.sawError = true;
      return [{ type: 'RUN_ERROR', message: typeof frame.content === 'string' ? frame.content : 'Unknown error' }];
    }

    default:
      return [];
  }
}
