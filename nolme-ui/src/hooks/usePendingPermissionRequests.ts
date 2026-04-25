import { useCallback, useEffect, useState } from 'react';
import { nolmeFetch } from '../lib/fetch';
import type { NolmeSessionBinding } from '../lib/types';

export interface PendingPermissionRequest {
  requestId: string;
  toolName: string;
  input?: Record<string, unknown>;
  context?: unknown;
  sessionId?: string | null;
}

function buildPendingPermissionsUrl(binding: NolmeSessionBinding): string {
  const params = new URLSearchParams({ provider: binding.provider });
  return `/api/nolme/pending-permissions/${encodeURIComponent(binding.sessionId)}?${params.toString()}`;
}

function buildPermissionDecisionUrl(binding: NolmeSessionBinding, requestId: string): string {
  return `/api/nolme/pending-permissions/${encodeURIComponent(binding.sessionId)}/${encodeURIComponent(requestId)}/decision`;
}

export function usePendingPermissionRequests(binding: NolmeSessionBinding | null) {
  const [requests, setRequests] = useState<PendingPermissionRequest[]>([]);

  useEffect(() => {
    if (!binding || binding.provider !== 'claude') {
      setRequests([]);
      return;
    }

    let cancelled = false;
    let timer: number | null = null;

    const poll = async () => {
      try {
        const response = await nolmeFetch(buildPendingPermissionsUrl(binding));
        if (!response.ok) {
          throw new Error(`pending permissions returned ${response.status}`);
        }

        const body = await response.json();
        if (!cancelled) {
          setRequests(Array.isArray(body?.requests) ? body.requests : []);
        }
      } catch (error) {
        if (!cancelled) {
          console.warn('[usePendingPermissionRequests] poll failed:', error);
        }
      } finally {
        if (!cancelled) {
          timer = window.setTimeout(poll, 1500);
        }
      }
    };

    void poll();

    return () => {
      cancelled = true;
      if (timer !== null) {
        clearTimeout(timer);
      }
    };
  }, [binding?.provider, binding?.sessionId]);

  const respond = useCallback(
    async (
      requestId: string,
      decision: {
        allow?: boolean;
        updatedInput?: unknown;
        message?: string;
        rememberEntry?: string | null;
      },
    ) => {
      if (!binding) {
        return;
      }

      const response = await nolmeFetch(buildPermissionDecisionUrl(binding, requestId), {
        method: 'POST',
        body: JSON.stringify(decision),
      });

      if (!response.ok) {
        throw new Error(`permission decision returned ${response.status}`);
      }

      setRequests((current) => current.filter((request) => request.requestId !== requestId));
    },
    [binding],
  );

  return { requests, respond };
}
