/**
 * NolmeAgUiWriter
 *
 * Matches the `.send(frame)` interface of `WebSocketWriter` (server/index.js:1484)
 * and `SSEStreamWriter` / `ResponseCollector` (server/routes/agent.js) so the
 * existing provider runtime entrypoints (`queryClaudeSDK`, `spawnCursor`,
 * `queryCodex`, `spawnGemini`) can drive it unchanged.
 *
 * Instead of writing frames to a socket or HTTP response, this writer calls a
 * translator callback for each frame. The translator converts the provider's
 * NormalizedMessage-like frame to one or more AG-UI BaseEvent objects, which are
 * then pushed to the rxjs Observer owned by CcuSessionAgent.run().
 *
 * @module agents/nolme-ag-ui-writer
 */

/**
 * @typedef {import('../providers/types.js').NormalizedMessage} NormalizedMessage
 * @typedef {{ send: (frame: any) => void, close?: () => void, userId: string | null }} WriterLike
 */

/**
 * Construct a NolmeAgUiWriter.
 * @param {{ onFrame: (frame: any) => void, userId?: string | null }} params
 * @returns {WriterLike}
 */
export function createNolmeAgUiWriter({ onFrame, userId = null }) {
  let closed = false;
  return {
    userId,
    send(frame) {
      if (closed) return;
      try {
        onFrame(frame);
      } catch (err) {
        // Defensive: a translator error must not crash the underlying runtime.
        // The error is logged here and an error frame is forwarded so the agent
        // surfaces RUN_ERROR through the Observable.
        console.error('[NolmeAgUiWriter] translator threw:', err);
        try {
          onFrame({ kind: 'error', content: err instanceof Error ? err.message : String(err) });
        } catch {
          /* swallow — keeps writer alive for downstream close() */
        }
      }
    },
    close() {
      closed = true;
    },
  };
}
