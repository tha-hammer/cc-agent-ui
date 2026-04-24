/**
 * CcuSessionAgent — AG-UI agent wrapper around cc-agent-ui's existing per-provider
 * runtime dispatch. Consumed by the CopilotKit route at /api/copilotkit.
 *
 * @module agents/ccu-session-agent
 */
import { Observable } from 'rxjs';
import { AbstractAgent } from '@ag-ui/client';

import { encodeProjectPath, isSubagentSession, isMetaSession } from '../projects.js';
import { queryClaudeSDK } from '../claude-sdk.js';
import { spawnCursor } from '../cursor-cli.js';
import { queryCodex } from '../openai-codex.js';
import { spawnGemini } from '../gemini-cli.js';

import { createNolmeAgUiWriter } from './nolme-ag-ui-writer.js';
import { createCursor, translate } from './ag-ui-event-translator.js';

// Re-exported for B1 regression check; intentionally unused at runtime so it
// doesn't pollute the agent's public surface.
export const CANONICAL_HELPERS = Object.freeze({ encodeProjectPath, isSubagentSession, isMetaSession });

/**
 * Build the provider-specific options object that the existing runtime entrypoints
 * expect. Matches the WS dispatch shape in src/components/chat/hooks/useChatComposerState.ts:610-669.
 *
 * @param {object} binding
 * @returns {{ dispatch: Function, options: object }}
 */
function buildProviderDispatch(binding) {
  const { provider, sessionId, projectPath, model, permissionMode, toolsSettings, sessionSummary } = binding;
  const cwd = projectPath;

  switch (provider) {
    case 'claude':
      return {
        dispatch: queryClaudeSDK,
        options: {
          projectPath,
          cwd,
          toolsSettings,
          permissionMode,
          model,
          sessionSummary,
          sessionId,
        },
      };
    case 'cursor':
      return {
        dispatch: spawnCursor,
        options: {
          cwd,
          projectPath,
          sessionId,
          resume: Boolean(sessionId),
          model,
          skipPermissions: toolsSettings?.skipPermissions ?? false,
          sessionSummary,
          toolsSettings,
        },
      };
    case 'codex':
      return {
        dispatch: queryCodex,
        options: {
          cwd,
          projectPath,
          sessionId,
          resume: Boolean(sessionId),
          model,
          sessionSummary,
          permissionMode: permissionMode === 'plan' ? 'default' : permissionMode,
        },
      };
    case 'gemini':
      return {
        dispatch: spawnGemini,
        options: {
          cwd,
          projectPath,
          sessionId,
          resume: Boolean(sessionId),
          model,
          sessionSummary,
          permissionMode,
          toolsSettings,
        },
      };
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

/**
 * Extract the latest user prompt from a RunAgentInput messages array.
 * @param {Array<{ role: string, content: string }>} messages
 * @returns {string}
 */
function extractPrompt(messages) {
  if (!Array.isArray(messages)) return '';
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const m = messages[i];
    if (m && m.role === 'user' && typeof m.content === 'string') return m.content;
  }
  return '';
}

/**
 * AG-UI wrapper around cc-agent-ui's provider dispatch. `run(input)` returns an
 * Observable of BaseEvent objects produced by translating NormalizedMessage-like
 * frames from the underlying runtime entrypoints.
 *
 * The binding is passed via `input.forwardedProps.binding` — CopilotKit forwards
 * arbitrary props through runs, and this keeps the per-run binding scoped rather
 * than instance-scoped (so one CcuSessionAgent serves many sessions).
 */
export class CcuSessionAgent extends AbstractAgent {
  constructor(config = {}) {
    super({
      agentId: config.agentId ?? 'ccu',
      description: config.description ?? 'cc-agent-ui session wrapper',
      threadId: config.threadId,
      initialMessages: config.initialMessages,
      initialState: config.initialState,
      debug: config.debug,
    });
  }

  /**
   * @param {import('@ag-ui/core').RunAgentInput} input
   * @returns {Observable<import('@ag-ui/core').BaseEvent>}
   */
  run(input) {
    const binding = input?.forwardedProps?.binding;
    const threadId = input?.threadId ?? binding?.sessionId ?? '';
    const runId = input?.runId ?? '';

    return new Observable((observer) => {
      if (!binding) {
        observer.next({ type: 'RUN_STARTED', threadId, runId });
        observer.next({ type: 'RUN_ERROR', message: 'CcuSessionAgent.run: missing forwardedProps.binding' });
        observer.complete();
        return;
      }

      const cursor = createCursor();
      let runErrorEmitted = false;

      const writer = createNolmeAgUiWriter({
        onFrame: (frame) => {
          const events = translate(frame, cursor);
          for (const event of events) {
            if (event.type === 'RUN_ERROR') runErrorEmitted = true;
            observer.next(event);
          }
        },
        userId: binding.sessionId ?? null,
      });

      observer.next({ type: 'RUN_STARTED', threadId, runId });

      const prompt = extractPrompt(input?.messages);
      let dispatchFn;
      let dispatchOptions;
      try {
        const resolved = buildProviderDispatch(binding);
        dispatchFn = resolved.dispatch;
        dispatchOptions = resolved.options;
      } catch (err) {
        observer.next({ type: 'RUN_ERROR', message: err instanceof Error ? err.message : String(err) });
        observer.complete();
        writer.close();
        return;
      }

      Promise.resolve(dispatchFn(prompt, dispatchOptions, writer))
        .then(() => {
          // Flush any lingering open message span (defensive — provider should have
          // emitted stream_end).
          if (cursor.currentMessageId !== null) {
            observer.next({ type: 'TEXT_MESSAGE_END', messageId: cursor.currentMessageId });
            cursor.currentMessageId = null;
          }
          if (!runErrorEmitted) {
            observer.next({ type: 'RUN_FINISHED', threadId, runId });
          }
          observer.complete();
        })
        .catch((err) => {
          observer.next({ type: 'RUN_ERROR', message: err instanceof Error ? err.message : String(err) });
          observer.complete();
        })
        .finally(() => {
          writer.close();
        });
    });
  }
}
