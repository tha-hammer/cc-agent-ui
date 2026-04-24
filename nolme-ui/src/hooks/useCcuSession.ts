/**
 * useCcuSession
 *
 * Resolves the NolmeSessionBinding that Nolme is currently pointed at. Three
 * sources feed it, in order of precedence at mount time:
 *
 *   1. URL query params — `/nolme/?provider=claude&sessionId=s-1&projectName=-x&projectPath=/x`
 *   2. localStorage('nolme-current-binding') — the most recent binding that
 *      cc-agent-ui's useSessionBroadcast wrote (survives across page loads,
 *      covers the late-join case where Nolme opens AFTER the session was
 *      already selected in the main app).
 *   3. BroadcastChannel('ccu-session') — a live update from cc-agent-ui when
 *      the operator selects a different session in the main app.
 *
 * BroadcastChannel payloads always win over the initial cached value so the UI
 * stays in sync with cc-agent-ui's sidebar selection.
 */
import { useEffect, useState } from 'react';
import { isValidProvider, type NolmeSessionBinding, type SessionProvider, type PermissionMode } from '../lib/types';

function readFromUrl(): NolmeSessionBinding | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  if (!params.get('sessionId')) return null; // avoid shadowing localStorage with an empty URL
  return validateBinding({
    provider: params.get('provider'),
    sessionId: params.get('sessionId'),
    projectName: params.get('projectName'),
    projectPath: params.get('projectPath'),
    model: params.get('model') ?? undefined,
    permissionMode: params.get('permissionMode') ?? undefined,
    skipPermissions: params.get('skipPermissions'),
  });
}

function readFromLocalStorage(): NolmeSessionBinding | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem('nolme-current-binding');
    if (!raw) return null;
    return validateBinding(JSON.parse(raw));
  } catch {
    return null;
  }
}

function readInitialBinding(): NolmeSessionBinding | null {
  return readFromUrl() ?? readFromLocalStorage();
}

function validateBinding(raw: unknown): NolmeSessionBinding | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;

  if (!isValidProvider(r.provider)) return null;
  if (typeof r.sessionId !== 'string' || r.sessionId.length === 0) return null;
  if (typeof r.projectName !== 'string') return null;
  if (typeof r.projectPath !== 'string' || r.projectPath.length === 0) return null;

  const provider = r.provider as SessionProvider;

  const binding: NolmeSessionBinding = {
    provider,
    sessionId: r.sessionId as string,
    projectName: r.projectName as string,
    projectPath: r.projectPath as string,
  };

  if (typeof r.model === 'string' && r.model.length > 0) {
    binding.model = r.model;
  }
  if (typeof r.permissionMode === 'string') {
    const valid: PermissionMode[] = ['default', 'acceptEdits', 'bypassPermissions', 'plan'];
    if (valid.includes(r.permissionMode as PermissionMode)) {
      binding.permissionMode = r.permissionMode as PermissionMode;
    }
  }

  // toolsSettings is a structured object — the BroadcastChannel may deliver it
  // already serialized; the URL can only deliver skipPermissions as a string.
  if (r.toolsSettings && typeof r.toolsSettings === 'object') {
    binding.toolsSettings = r.toolsSettings as NolmeSessionBinding['toolsSettings'];
  } else if (r.skipPermissions === '1' || r.skipPermissions === 'true' || r.skipPermissions === true) {
    binding.toolsSettings = {
      allowedTools: [],
      disallowedTools: [],
      skipPermissions: true,
    };
  }

  return binding;
}

export function useCcuSession(): NolmeSessionBinding | null {
  const [binding, setBinding] = useState<NolmeSessionBinding | null>(() => readInitialBinding());

  useEffect(() => {
    // Also listen to the storage event so a change in another tab's
    // localStorage-write surfaces here even if BroadcastChannel is unavailable
    // (Safari's older quirks, for example).
    const handleStorage = (ev: StorageEvent) => {
      if (ev.key !== 'nolme-current-binding' || !ev.newValue) return;
      try {
        const next = validateBinding(JSON.parse(ev.newValue));
        if (next) setBinding(next);
      } catch {
        /* ignore */
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', handleStorage);
    }

    let channel: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== 'undefined') {
      channel = new BroadcastChannel('ccu-session');
      channel.onmessage = (ev: { data: unknown }) => {
        const next = validateBinding(ev.data);
        if (next) setBinding(next);
      };
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('storage', handleStorage);
      }
      channel?.close();
    };
  }, []);

  return binding;
}
