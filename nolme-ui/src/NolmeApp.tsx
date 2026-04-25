/**
 * NolmeApp — top-level Nolme wrapper.
 *
 * Phase 3 wiring (plan B15): combines useCcuSession (session binding from URL
 * or BroadcastChannel) with useHydratedState (prior messages + sidecar state)
 * and mounts <CopilotKit> with:
 *   - runtimeUrl="/api/copilotkit"            — Express endpoint (plan B10)
 *   - headers={{ Authorization: Bearer <jwt> }} from localStorage('auth-token')
 *   - agent="ccu"                              — matches server/routes/copilotkit.js
 *   - threadId={binding.sessionId}
 *   - updates={bootstrapState}                 — hydrated NolmeAgentState
 *
 * Placeholders render during idle / loading / error so the UI never crashes.
 * The <NolmeDashboard> below the provider is stubbed until Phase 4 / 5.
 */
import { useEffect } from 'react';
import { CopilotKit } from '@copilotkit/react-core';
import { useCcuSession } from './hooks/useCcuSession';
import { useHydratedState } from './hooks/useHydratedState';
import { AiWorkingHydrationProvider } from './hooks/useAiWorkingProjection';
import { NolmeDashboardV2 } from './components/NolmeDashboard.v2';
import {
  CLAUDE_MODELS,
  CURSOR_MODELS,
  CODEX_MODELS,
  GEMINI_MODELS,
} from '../../shared/modelConstants.js';
import type { NolmeSessionBinding, SessionProvider } from './lib/types';

const PROVIDER_MODEL_CATALOG: Record<SessionProvider, { OPTIONS: Array<{ value: string; label: string }>; DEFAULT: string }> = {
  claude: CLAUDE_MODELS,
  cursor: CURSOR_MODELS,
  codex: CODEX_MODELS,
  gemini: GEMINI_MODELS,
};

function isKnownModel(provider: SessionProvider, model: string | undefined): boolean {
  if (!model) return true; // empty model is fine — server falls back to default
  return PROVIDER_MODEL_CATALOG[provider]?.OPTIONS.some((o) => o.value === model) ?? false;
}

/**
 * Self-heal: if the persisted binding has a model that's no longer in the
 * canonical catalog (left over from an older version of the catalog), strip
 * the model from URL + localStorage so the next session is clean. The server
 * also normalises invalid models in resolveModel() — this hook just keeps
 * the persisted state from leaking the bad value forever.
 */
function useNolmeModelSelfHeal(binding: NolmeSessionBinding | null): void {
  useEffect(() => {
    if (!binding) return;
    if (isKnownModel(binding.provider, binding.model)) return;
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.has('model')) {
        url.searchParams.delete('model');
        window.history.replaceState(null, '', url.toString());
      }
      const stored = localStorage.getItem('nolme-current-binding');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed === 'object' && 'model' in parsed) {
          delete parsed.model;
          localStorage.setItem('nolme-current-binding', JSON.stringify(parsed));
        }
      }
    } catch {
      /* ignore — best-effort cleanup */
    }
  }, [binding?.provider, binding?.model]);
}

function NoSessionPlaceholder() {
  return (
    <main className="nolme-root min-h-dvh bg-white p-6">
      <h1 className="text-2xl font-bold text-nolme-neutral-900">No session selected</h1>
      <p className="mt-2 text-nolme-neutral-600">
        Pick a session from the cc-agent-ui sidebar, then come back to /nolme/ to see it here.
      </p>
    </main>
  );
}

function HydrationSkeleton() {
  return (
    <main className="nolme-root min-h-dvh bg-white p-6">
      <p className="text-nolme-neutral-500">Loading session history...</p>
    </main>
  );
}

function HydrationErrorPlaceholder({ error }: { error: Error | undefined }) {
  return (
    <main className="nolme-root min-h-dvh bg-white p-6">
      <h1 className="text-xl font-bold text-red-600">Error</h1>
      <p className="mt-2 text-nolme-neutral-600">{error?.message ?? 'Hydration failed.'}</p>
      <p className="mt-2 text-nolme-neutral-500">Retry by reloading the page.</p>
    </main>
  );
}

function getAuthHeaders(): Record<string, string> | undefined {
  if (typeof localStorage === 'undefined') return undefined;
  const token = localStorage.getItem('auth-token');
  if (!token) return undefined;
  return { Authorization: `Bearer ${token}` };
}

export function NolmeApp() {
  const binding = useCcuSession();
  const hydration = useHydratedState(binding);

  useNolmeModelSelfHeal(binding);

  if (!binding) return <NoSessionPlaceholder />;
  if (hydration.status === 'loading' || hydration.status === 'idle') return <HydrationSkeleton />;
  if (hydration.status === 'error') return <HydrationErrorPlaceholder error={hydration.error} />;

  const headers = getAuthHeaders();
  const providerKey = [binding.provider, binding.sessionId, binding.projectPath].join(':');
  const providerProps: Record<string, unknown> = {
    runtimeUrl: '/api/copilotkit',
    agent: 'ccu',
    threadId: binding.sessionId,
    updates: hydration.state,
    properties: { binding },
    // Disable the CopilotKit Inspector floating button (the "v1.50 is now
    // live!" diamond toast in the bottom-right). Nolme has its own surface
    // for debugging — the inspector overlaps the composer and isn't part of
    // the Figma design.
    enableInspector: false,
  };
  if (headers) providerProps.headers = headers;

  return (
    <CopilotKit key={providerKey} {...(providerProps as Record<string, never>)}>
      <AiWorkingHydrationProvider binding={binding} hydration={hydration}>
        <NolmeDashboardV2 />
      </AiWorkingHydrationProvider>
    </CopilotKit>
  );
}
