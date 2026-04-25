import { useEffect, useMemo, useState } from 'react';
import { normalizeAiWorkingTokenBudget } from '../../../shared/aiWorkingTokenBudget.js';
import { nolmeFetch } from '../lib/fetch';
import type { NolmeSessionBinding, SessionProvider } from '../lib/types';

export interface AiWorkingTokenBudget {
  provider: SessionProvider;
  source: 'route' | 'live' | 'persisted';
  supported: boolean;
  used: number | null;
  total: number | null;
  remaining: number | null;
  usedPercent: number;
  remainingPercent: number;
  breakdown?: Record<string, unknown>;
  message?: string;
  updatedAt: number;
}

function buildTokenUsageUrl(binding: NolmeSessionBinding): string {
  const params = new URLSearchParams({
    provider: binding.provider,
    projectName: binding.projectName,
    projectPath: binding.projectPath,
  });
  return `/api/projects/${encodeURIComponent(binding.projectName)}/sessions/${encodeURIComponent(binding.sessionId)}/token-usage?${params.toString()}`;
}

function normalizeBudget(
  raw: unknown,
  provider: SessionProvider | undefined,
  source: AiWorkingTokenBudget['source'],
): AiWorkingTokenBudget | null {
  if (!provider) return null;
  return (normalizeAiWorkingTokenBudget(raw, { provider, source }) as AiWorkingTokenBudget | null);
}

export function useAiWorkingTokenBudget(
  binding: NolmeSessionBinding | null,
  rawTokenBudget: unknown,
): AiWorkingTokenBudget | null {
  const [routeBudget, setRouteBudget] = useState<AiWorkingTokenBudget | null>(null);

  const stateBudget = useMemo(() => {
    if (!binding) return null;
    const source = (rawTokenBudget as { source?: string } | null)?.source === 'live' ? 'live' : 'persisted';
    return normalizeBudget(rawTokenBudget, binding.provider, source);
  }, [binding, rawTokenBudget]);

  useEffect(() => {
    if (!binding) {
      setRouteBudget(null);
      return;
    }

    const controller = new AbortController();
    setRouteBudget(null);

    void (async () => {
      try {
        const response = await nolmeFetch(buildTokenUsageUrl(binding), { signal: controller.signal });
        if (!response.ok) {
          return;
        }
        const body = await response.json();
        if (controller.signal.aborted) {
          return;
        }
        setRouteBudget(normalizeBudget(body, binding.provider, 'route'));
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error('[useAiWorkingTokenBudget] route fetch failed:', error);
        }
      }
    })();

    return () => controller.abort();
  }, [binding?.provider, binding?.sessionId, binding?.projectName, binding?.projectPath]);

  return stateBudget?.source === 'live'
    ? stateBudget
    : routeBudget ?? stateBudget;
}
