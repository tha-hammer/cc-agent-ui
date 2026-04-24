/**
 * useSessionBroadcast
 *
 * Publishes a full NolmeSessionBinding on `BroadcastChannel('ccu-session')`
 * whenever the cc-agent-ui app's selected project/session changes. Nolme (the
 * separate Vite workspace at cc-agent-ui/nolme-ui/) subscribes to the same
 * channel and rebinds its CopilotKit provider in response, so both UIs always
 * point at the same session at all times (plan constraint #1 locked).
 *
 * Additive-only: this hook is the entire cc-agent-ui-side change for Nolme.
 * No existing chat/files/shell/git/tasks/plugins surface is modified.
 *
 * @module hooks/useSessionBroadcast
 */

import { useEffect } from 'react';
import type { Project, ProjectSession, SessionProvider } from '../types/app';

type PermissionMode = 'default' | 'acceptEdits' | 'bypassPermissions' | 'plan';
type ToolsSettings = {
  allowedTools: string[];
  disallowedTools: string[];
  skipPermissions: boolean;
};

export function useSessionBroadcast(
  selectedProject: Project | null,
  selectedSession: ProjectSession | null,
  provider: SessionProvider,
  model: string | undefined,
  permissionMode: PermissionMode | undefined,
  toolsSettings: ToolsSettings | undefined,
): void {
  const sessionId = selectedSession?.id ?? '';
  const projectName = selectedProject?.name ?? '';
  const projectPath = selectedProject?.fullPath ?? (selectedProject as { path?: string } | null)?.path ?? '';
  const explicitProvider = (selectedSession?.__provider as SessionProvider | undefined) ?? provider;
  const allowed = toolsSettings?.allowedTools.join('\x1f') ?? '';
  const disallowed = toolsSettings?.disallowedTools.join('\x1f') ?? '';
  const skipPermissions = toolsSettings?.skipPermissions ?? false;

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    if (!selectedSession || !selectedProject) return;

    const binding = {
      provider: explicitProvider,
      sessionId,
      projectName,
      projectPath,
      model,
      permissionMode,
      toolsSettings,
      timestamp: Date.now(),
    };

    const channel = new BroadcastChannel('ccu-session');
    channel.postMessage(binding);

    return () => {
      channel.close();
    };
    // Serialized toolsSettings fields are the deps so a new identity of the
    // settings object doesn't re-broadcast unless the contents actually changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    sessionId,
    projectName,
    projectPath,
    explicitProvider,
    model,
    permissionMode,
    allowed,
    disallowed,
    skipPermissions,
  ]);
}
