/**
 * Frame → AG-UI event translator.
 *
 * Translates the NormalizedMessage-like frames emitted by cc-agent-ui's provider
 * runtime entrypoints (kind-enum defined in server/providers/types.js:22) into
 * the AG-UI BaseEvent shapes consumed by CopilotKit.
 *
 * This file is a PURE function plus a stateful `translate()` helper. All state
 * lives in the `TranslatorCursor` object owned by the caller (B2 constructs one
 * per run). Subsequent phases expand the `translate()` switch; B2 ships only the
 * minimum envelope (stream_delta, stream_end, complete, error).
 *
 * @module agents/ag-ui-event-translator
 */

/** @typedef {'RUN_STARTED'|'RUN_FINISHED'|'RUN_ERROR'|'TEXT_MESSAGE_START'|'TEXT_MESSAGE_CONTENT'|'TEXT_MESSAGE_END'|'TOOL_CALL_START'|'TOOL_CALL_ARGS'|'TOOL_CALL_END'|'STATE_SNAPSHOT'|'STATE_DELTA'} AgUiEventType */

/**
 * Caller-owned cursor. Fresh per run.
 * @typedef {{
 *   currentMessageId: string | null,
 *   currentToolId: string | null,
 *   sawComplete: boolean,
 *   sawError: boolean,
 * }} TranslatorCursor
 */

/** @returns {TranslatorCursor} */
export function createCursor() {
  return { currentMessageId: null, currentToolId: null, sawComplete: false, sawError: false };
}

let messageIdSeq = 0;
function nextMessageId() {
  messageIdSeq += 1;
  return `msg_${Date.now()}_${messageIdSeq}`;
}

/**
 * Translate a single frame to 0..N AG-UI events.
 * @param {any} frame - NormalizedMessage-like (see server/providers/types.js:22)
 * @param {TranslatorCursor} cursor
 * @returns {Array<{ type: AgUiEventType, [k: string]: any }>}
 */
export function translate(frame, cursor) {
  if (!frame || typeof frame !== 'object' || !frame.kind) return [];

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

    case 'complete': {
      cursor.sawComplete = true;
      // RUN_FINISHED is emitted by the caller (CcuSessionAgent.run) so it can
      // pair with the RUN_STARTED it issued.
      return [];
    }

    case 'error': {
      cursor.sawError = true;
      return [{ type: 'RUN_ERROR', message: typeof frame.content === 'string' ? frame.content : 'Unknown error' }];
    }

    default:
      // Unhandled kinds are a no-op in B2. B4 expands this switch to cover
      // text / thinking / tool_use / tool_result / permission_request /
      // permission_cancelled / session_created / status / interactive_prompt /
      // task_notification plus the three state-mutation tools.
      return [];
  }
}
