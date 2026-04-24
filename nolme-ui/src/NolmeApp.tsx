/**
 * NolmeApp — top-level Nolme wrapper.
 *
 * Phase 3 wiring (plan B15): combines useCcuSession (session binding from URL
 * or BroadcastChannel) with useHydratedState (prior messages + sidecar state)
 * and mounts <CopilotKit> with:
 *   - runtimeUrl="/api/copilotkit"            — Express endpoint (plan B10)
 *   - headers={{ Authorization: Bearer <jwt> }} from localStorage('auth-token')
 *   - agentId="ccu"                            — matches server/routes/copilotkit.js
 *   - threadId={binding.sessionId}
 *   - updates={bootstrapState}                 — hydrated NolmeAgentState
 *
 * Placeholders render during idle / loading / error so the UI never crashes.
 * The <NolmeDashboard> below the provider is stubbed until Phase 4 / 5.
 */
import { CopilotKit } from '@copilotkit/react-core';
import { useCcuSession } from './hooks/useCcuSession';
import { useHydratedState } from './hooks/useHydratedState';

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

function NolmeDashboardStub() {
  return (
    <main className="nolme-root min-h-dvh bg-white p-6 text-nolme-neutral-800">
      <h1 className="text-3xl font-bold tracking-tight">Nolme</h1>
      <p className="mt-2 text-nolme-neutral-600">Session connected. Phase 4/5 renders real chrome here.</p>
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

  if (!binding) return <NoSessionPlaceholder />;
  if (hydration.status === 'loading' || hydration.status === 'idle') return <HydrationSkeleton />;
  if (hydration.status === 'error') return <HydrationErrorPlaceholder error={hydration.error} />;

  const headers = getAuthHeaders();
  const providerProps: Record<string, unknown> = {
    runtimeUrl: '/api/copilotkit',
    agentId: 'ccu',
    threadId: binding.sessionId,
    updates: hydration.state,
  };
  if (headers) providerProps.headers = headers;

  return (
    // @ts-expect-error — CopilotKit prop types vary across major versions;
    // the spread is runtime-verified by the B15 test.
    <CopilotKit {...providerProps}>
      <NolmeDashboardStub />
    </CopilotKit>
  );
}
