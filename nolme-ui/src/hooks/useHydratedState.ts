/**
 * useHydratedState
 *
 * Before Nolme mounts the CopilotKit provider, it fetches the session's prior
 * messages (via the existing unified `/api/sessions/:sessionId/messages`
 * endpoint) and the persisted NolmeAgentState sidecar (via the new
 * `/api/nolme/state/:sessionId` endpoint). The fetched payload is then passed
 * into `<CopilotKit updates={bootstrapState}>` so the chat column and rails
 * render the existing conversation before any new run starts.
 *
 * This hook is the Nolme-side pre-provider bootstrap. B15 wraps its result.
 */
import { useEffect, useRef, useState } from 'react';
import { nolmeFetch } from '../lib/fetch';
import { DEFAULT_NOLME_AGENT_STATE, type NolmeSessionBinding, type NolmeAgentState } from '../lib/types';

export type HydrationStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface HydrationResult {
  status: HydrationStatus;
  messages?: unknown[];
  state?: NolmeAgentState;
  error?: Error;
}

function buildMessagesUrl(b: NolmeSessionBinding): string {
  const params = new URLSearchParams({
    provider: b.provider,
    projectName: b.projectName,
    projectPath: b.projectPath,
  });
  return `/api/sessions/${encodeURIComponent(b.sessionId)}/messages?${params.toString()}`;
}

function buildStateUrl(b: NolmeSessionBinding): string {
  const params = new URLSearchParams({
    provider: b.provider,
    projectName: b.projectName,
    projectPath: b.projectPath,
  });
  return `/api/nolme/state/${encodeURIComponent(b.sessionId)}?${params.toString()}`;
}

export function useHydratedState(binding: NolmeSessionBinding | null): HydrationResult {
  const [result, setResult] = useState<HydrationResult>({ status: binding ? 'loading' : 'idle' });
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!binding) {
      setResult({ status: 'idle' });
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setResult({ status: 'loading' });

    (async () => {
      try {
        const [msgRes, stateRes] = await Promise.all([
          nolmeFetch(buildMessagesUrl(binding), { signal: controller.signal }),
          nolmeFetch(buildStateUrl(binding), { signal: controller.signal }),
        ]);

        if (!msgRes.ok) {
          throw new Error(`messages endpoint returned ${msgRes.status}`);
        }
        const msgBody = await msgRes.json();
        const messages = Array.isArray(msgBody?.messages) ? msgBody.messages : [];

        let state: NolmeAgentState = { ...DEFAULT_NOLME_AGENT_STATE };
        if (stateRes.ok) {
          const sidecar = await stateRes.json();
          if (sidecar && sidecar.schemaVersion === 1) {
            state = sidecar as NolmeAgentState;
          }
        }
        // 404 / 500 on state → keep defaults, proceed.

        if (!controller.signal.aborted) {
          setResult({ status: 'ready', messages, state });
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        setResult({ status: 'error', error: err instanceof Error ? err : new Error(String(err)) });
      }
    })();

    return () => controller.abort();
  }, [binding?.sessionId, binding?.provider, binding?.projectName, binding?.projectPath]);

  return result;
}
