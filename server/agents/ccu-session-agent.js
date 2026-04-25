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
import { getProvider } from '../providers/registry.js';
import {
  CLAUDE_MODELS,
  CURSOR_MODELS,
  CODEX_MODELS,
  GEMINI_MODELS,
} from '../../shared/modelConstants.js';

import { createNolmeAgUiWriter } from './nolme-ag-ui-writer.js';
import { createCursor, translate } from './ag-ui-event-translator.js';
import { readState, writeState } from './nolme-state-store.js';
import { normalizeAiWorkingTokenBudget } from '../../shared/aiWorkingTokenBudget.js';

const PROVIDER_MODEL_CATALOG = {
  claude: CLAUDE_MODELS,
  cursor: CURSOR_MODELS,
  codex: CODEX_MODELS,
  gemini: GEMINI_MODELS,
};

/**
 * Validate the binding's `model` against the provider's canonical catalog
 * (shared/modelConstants.js). If the persisted model is unknown (e.g., a
 * stale value from an old client catalog), fall back to the provider default
 * so the SDK never receives an invalid identifier and exits 1.
 *
 * @param {string|undefined} provider
 * @param {string|undefined} model
 * @returns {string|undefined}
 */
function resolveModel(provider, model) {
  const catalog = PROVIDER_MODEL_CATALOG[provider];
  if (!catalog) return model;
  if (!model) return catalog.DEFAULT;
  const isKnown = Array.isArray(catalog.OPTIONS)
    && catalog.OPTIONS.some((o) => o.value === model);
  if (isKnown) return model;
  console.warn(`[CcuSessionAgent] dropping unknown model '${model}' for provider '${provider}'; falling back to default '${catalog.DEFAULT}'`);
  return catalog.DEFAULT;
}

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
  const { provider, sessionId, projectPath, model: rawModel, permissionMode, toolsSettings, sessionSummary } = binding;
  const cwd = projectPath;
  const model = resolveModel(provider, rawModel);

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
    this.userId = Number.isInteger(config.userId) ? config.userId : null;
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

      // Seed the translator cursor with the binding's sessionId as the primary,
      // so frames with mismatched sessionId (subagent/meta leaks) are filtered
      // out at translation time. Empty binding.sessionId leaves primary null;
      // the first session_created frame will bootstrap it.
      const cursor = createCursor({ primarySessionId: binding.sessionId || null });
      let runErrorEmitted = false;
      let persistChain = Promise.resolve();

      const writer = createNolmeAgUiWriter({
        onFrame: (frame) => {
          const normalizedTokenBudget = frame?.kind === 'status' && frame?.text === 'token_budget'
            ? normalizeAiWorkingTokenBudget(frame.tokenBudget, {
                provider: frame.provider || binding.provider,
                source: 'live',
              })
            : null;

          if (normalizedTokenBudget) {
            persistChain = persistChain
              .then(async () => {
                const currentState = await readState(binding);
                await writeState(binding, {
                  ...currentState,
                  tokenBudget: {
                    ...normalizedTokenBudget,
                    source: 'persisted',
                  },
                });
              })
              .catch((err) => {
                console.warn('[CcuSessionAgent] failed to persist tokenBudget:', err);
              });
          }

          const events = translate(frame, cursor);
          for (const event of events) {
            if (event.type === 'RUN_ERROR') runErrorEmitted = true;
            observer.next(event);
          }
        },
        // userId must be the authenticated `users.id` (INTEGER PRIMARY KEY)
        // because downstream notifyRunStopped → notificationPreferencesDb
        // INSERTs against user_notification_preferences.user_id which strictly
        // enforces integer values (SQLite "datatype mismatch" otherwise).
        userId: this.userId,
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
        .then(async () => {
          await persistChain;
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

  /**
   * Hydration entrypoint. CopilotKit's runtime routes POST /agent/:agentId/connect
   * to this method. It replays prior messages from the provider's adapter and
   * surfaces persisted NolmeAgentState so the UI can render the full session
   * context before the operator issues a new prompt.
   *
   * Event envelope:
   *   RUN_STARTED
   *   (for each prior NormalizedMessage) translate(msg, cursor) → TEXT_MESSAGE_* / TOOL_CALL_* / …
   *   STATE_SNAPSHOT { snapshot: NolmeAgentState }
   *   RUN_FINISHED
   *
   * Errors (missing binding, fetchHistory rejection, sidecar read failure) are
   * surfaced as RUN_ERROR so the client gets a clear signal rather than a hung
   * stream.
   *
   * @param {import('@ag-ui/core').RunAgentInput} input
   * @returns {Observable<import('@ag-ui/core').BaseEvent>}
   */
  connect(input) {
    const binding = input?.forwardedProps?.binding;
    const threadId = input?.threadId ?? binding?.sessionId ?? '';
    const runId = input?.runId ?? '';

    return new Observable((observer) => {
      if (!binding) {
        observer.next({ type: 'RUN_STARTED', threadId, runId });
        observer.next({ type: 'RUN_ERROR', message: 'CcuSessionAgent.connect: missing forwardedProps.binding' });
        observer.complete();
        return;
      }

      observer.next({ type: 'RUN_STARTED', threadId, runId });

      (async () => {
        const adapter = getProvider(binding.provider);
        if (!adapter || typeof adapter.fetchHistory !== 'function') {
          observer.next({ type: 'RUN_ERROR', message: `No adapter for provider: ${binding.provider}` });
          observer.complete();
          return;
        }

        const history = await adapter.fetchHistory(binding.sessionId, {
          projectName: binding.projectName,
          projectPath: binding.projectPath,
          limit: null,
          offset: 0,
        });

        const cursor = createCursor({ primarySessionId: binding.sessionId || null });
        for (const msg of history?.messages ?? []) {
          const events = translate(msg, cursor);
          for (const event of events) observer.next(event);
        }

        // Close any open message span before the STATE_SNAPSHOT so it doesn't
        // intermix weirdly with the state event.
        if (cursor.currentMessageId !== null) {
          observer.next({ type: 'TEXT_MESSAGE_END', messageId: cursor.currentMessageId });
          cursor.currentMessageId = null;
        }

        const state = await readState(binding);
        observer.next({ type: 'STATE_SNAPSHOT', snapshot: state });

        observer.next({ type: 'RUN_FINISHED', threadId, runId });
        observer.complete();
      })().catch((err) => {
        observer.next({ type: 'RUN_ERROR', message: err instanceof Error ? err.message : String(err) });
        observer.complete();
      });
    });
  }
}
