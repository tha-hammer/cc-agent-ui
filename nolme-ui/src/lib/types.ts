/**
 * Nolme-side data contracts — mirrors plan C-1 / C-2 verbatim. Do not edit
 * without also updating the JSDoc typedef in server/agents/ccu-session-agent.js.
 */

export type SessionProvider = 'claude' | 'cursor' | 'codex' | 'gemini';

export type PermissionMode =
  | 'default'
  | 'acceptEdits'
  | 'bypassPermissions'
  | 'plan';

export interface ToolsSettings {
  allowedTools: string[];
  disallowedTools: string[];
  skipPermissions: boolean;
}

export interface NolmeSessionBinding {
  provider: SessionProvider;
  sessionId: string;
  projectName: string;
  projectPath: string;
  model?: string;
  permissionMode?: PermissionMode;
  toolsSettings?: ToolsSettings;
  sessionSummary?: string;
}

export interface NolmePhase {
  id: string;
  label: string;
  title: string;
  status: 'idle' | 'active' | 'complete';
}

export interface NolmeResource {
  id: string;
  badge: 'P1' | 'P2' | 'P3' | 'P4';
  title: string;
  subtitle: string;
  tone: 'emerald' | 'iris' | 'gold';
  action: 'download' | 'link';
  url?: string;
}

export interface NolmeAgentProfile {
  name: string;
  role: string;
  avatarUrl?: string;
  skills: string[];
  integrations: string[];
  usageValue?: number;
}

export interface NolmeTaskNotification {
  status: string;
  summary: string;
  ts: number;
}

export interface NolmeAgentState {
  schemaVersion: 1;
  phases: NolmePhase[];
  currentPhaseIndex: number;
  currentReviewLine: string;
  resources: NolmeResource[];
  profile: NolmeAgentProfile | null;
  quickActions: string[];
  taskNotifications: NolmeTaskNotification[];
}

export const DEFAULT_NOLME_AGENT_STATE: NolmeAgentState = Object.freeze({
  schemaVersion: 1,
  phases: [],
  currentPhaseIndex: 0,
  currentReviewLine: '',
  resources: [],
  profile: null,
  quickActions: [],
  taskNotifications: [],
}) as NolmeAgentState;

export const VALID_PROVIDERS: ReadonlyArray<SessionProvider> = ['claude', 'cursor', 'codex', 'gemini'];

export function isValidProvider(value: unknown): value is SessionProvider {
  return typeof value === 'string' && VALID_PROVIDERS.includes(value as SessionProvider);
}
