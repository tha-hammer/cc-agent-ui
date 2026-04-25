import type { Project, ProjectSession, SessionProvider } from '../types/app';

type NolmePermissionMode = 'default' | 'acceptEdits' | 'bypassPermissions' | 'plan';

type NolmeToolsSettings = Record<string, unknown> & {
  skipPermissions?: boolean;
};

export type NolmeLaunchBinding = {
  provider: SessionProvider;
  sessionId: string;
  projectName: string;
  projectPath: string;
  model?: string;
  permissionMode?: NolmePermissionMode;
  toolsSettings?: NolmeToolsSettings;
};

const VALID_PERMISSION_MODES = new Set<NolmePermissionMode>([
  'default',
  'acceptEdits',
  'bypassPermissions',
  'plan',
]);

function safeGetItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function parseJsonObject(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function getSettingsStorageKey(provider: SessionProvider): string {
  if (provider === 'cursor') return 'cursor-tools-settings';
  if (provider === 'codex') return 'codex-settings';
  if (provider === 'gemini') return 'gemini-settings';
  return 'claude-settings';
}

export function readStoredProvider(providerHint?: SessionProvider): SessionProvider {
  if (providerHint) return providerHint;
  const stored = safeGetItem('selected-provider');
  if (stored === 'cursor' || stored === 'codex' || stored === 'gemini' || stored === 'claude') {
    return stored;
  }
  return 'claude';
}

export function readStoredModel(provider: SessionProvider): string | undefined {
  const model = safeGetItem(`${provider}-model`);
  return model && model.length > 0 ? model : undefined;
}

export function readStoredPermissionMode(
  sessionId: string,
  provider: SessionProvider,
): NolmePermissionMode | undefined {
  const perSession = safeGetItem(`permissionMode-${sessionId}`);
  if (perSession && VALID_PERMISSION_MODES.has(perSession as NolmePermissionMode)) {
    return perSession as NolmePermissionMode;
  }

  const settings = parseJsonObject(safeGetItem(getSettingsStorageKey(provider)));
  const maybeMode = settings?.permissionMode;
  if (typeof maybeMode === 'string' && VALID_PERMISSION_MODES.has(maybeMode as NolmePermissionMode)) {
    return maybeMode as NolmePermissionMode;
  }

  return undefined;
}

export function readStoredToolsSettings(
  provider: SessionProvider,
): NolmeToolsSettings | undefined {
  const settings = parseJsonObject(safeGetItem(getSettingsStorageKey(provider)));
  if (!settings) return undefined;

  const hasToolShape =
    'allowedTools' in settings ||
    'disallowedTools' in settings ||
    'allowedCommands' in settings ||
    'disallowedCommands' in settings ||
    'skipPermissions' in settings;

  return hasToolShape ? (settings as NolmeToolsSettings) : undefined;
}

export function buildNolmeLaunchBinding(
  project: Project | null,
  session: ProjectSession | null,
  overrides?: Partial<NolmeLaunchBinding>,
): NolmeLaunchBinding | null {
  if (!project || !session?.id) return null;

  const provider = readStoredProvider(
    (overrides?.provider as SessionProvider | undefined) ??
      (session.__provider as SessionProvider | undefined),
  );

  return {
    provider,
    sessionId: session.id,
    projectName: project.name,
    projectPath: project.fullPath || project.path || '',
    model: overrides?.model ?? readStoredModel(provider),
    permissionMode:
      (overrides?.permissionMode as NolmePermissionMode | undefined) ??
      readStoredPermissionMode(session.id, provider),
    toolsSettings: overrides?.toolsSettings ?? readStoredToolsSettings(provider),
  };
}

export function buildNolmeLaunchUrl(binding: NolmeLaunchBinding): string {
  const params = new URLSearchParams({
    provider: binding.provider,
    sessionId: binding.sessionId,
    projectName: binding.projectName,
    projectPath: binding.projectPath,
  });

  if (binding.model) params.set('model', binding.model);
  if (binding.permissionMode) params.set('permissionMode', binding.permissionMode);
  if (binding.toolsSettings?.skipPermissions) params.set('skipPermissions', '1');

  return `/nolme/?${params.toString()}`;
}
