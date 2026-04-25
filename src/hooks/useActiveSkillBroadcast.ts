import { useCallback } from 'react';
import type { SessionProvider } from '../types/app';

export const ACTIVE_SKILL_STORAGE_KEY = 'nolme-active-skill-contexts';
export const ACTIVE_SKILL_CHANNEL = 'nolme-active-skill';

export interface ActiveSkillContext {
  provider: SessionProvider;
  sessionId: string;
  projectPath: string;
  commandName: string;
  metadata: Record<string, unknown> | null;
  argsText: string;
  updatedAt: number;
}

export type ActiveSkillIdentity = Pick<ActiveSkillContext, 'provider' | 'sessionId' | 'projectPath'>;
export type ActiveSkillStore = Record<string, ActiveSkillContext>;

export function makeActiveSkillIdentityKey(identity: ActiveSkillIdentity): string {
  return [identity.provider, identity.sessionId, identity.projectPath].join('\x1f');
}

export function normalizeActiveSkillContext(raw: unknown): ActiveSkillContext | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const value = raw as Record<string, unknown>;
  const provider = value.provider;
  const sessionId = value.sessionId;
  const projectPath = value.projectPath;
  const commandName = value.commandName;
  const argsText = typeof value.argsText === 'string' ? value.argsText.trim() : '';
  const updatedAt = value.updatedAt;

  if (
    provider !== 'claude'
    && provider !== 'cursor'
    && provider !== 'codex'
    && provider !== 'gemini'
  ) {
    return null;
  }

  if (
    typeof sessionId !== 'string'
    || sessionId.length === 0
    || typeof projectPath !== 'string'
    || projectPath.length === 0
    || typeof commandName !== 'string'
    || commandName.length === 0
    || typeof updatedAt !== 'number'
    || !Number.isFinite(updatedAt)
  ) {
    return null;
  }

  const metadata = value.metadata && typeof value.metadata === 'object'
    ? { ...(value.metadata as Record<string, unknown>) }
    : null;

  return {
    provider,
    sessionId,
    projectPath,
    commandName,
    metadata,
    argsText,
    updatedAt,
  };
}

export function parseActiveSkillStore(raw: unknown): ActiveSkillStore {
  if (typeof raw !== 'string' || raw.length === 0) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return {};
    }

    const next: ActiveSkillStore = {};
    for (const entry of Object.values(parsed as Record<string, unknown>)) {
      const normalized = normalizeActiveSkillContext(entry);
      if (!normalized) continue;
      next[makeActiveSkillIdentityKey(normalized)] = normalized;
    }
    return next;
  } catch {
    return {};
  }
}

export function selectActiveSkillContext(
  store: ActiveSkillStore,
  identity: ActiveSkillIdentity | null | undefined,
): ActiveSkillContext | null {
  if (!identity) return null;
  return store[makeActiveSkillIdentityKey(identity)] ?? null;
}

function writeActiveSkillStore(store: ActiveSkillStore): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(ACTIVE_SKILL_STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* ignore */
  }
}

function broadcastActiveSkillContext(context: ActiveSkillContext): void {
  if (typeof BroadcastChannel === 'undefined') return;
  try {
    const channel = new BroadcastChannel(ACTIVE_SKILL_CHANNEL);
    channel.postMessage({ type: 'active-skill-update', context });
    channel.close();
  } catch {
    /* ignore */
  }
}

export function useActiveSkillBroadcast() {
  const publishActiveSkill = useCallback((context: ActiveSkillContext) => {
    const normalized = normalizeActiveSkillContext(context);
    if (!normalized) return;

    const current = typeof localStorage === 'undefined'
      ? {}
      : parseActiveSkillStore(localStorage.getItem(ACTIVE_SKILL_STORAGE_KEY));
    const next = {
      ...current,
      [makeActiveSkillIdentityKey(normalized)]: normalized,
    };

    writeActiveSkillStore(next);
    broadcastActiveSkillContext(normalized);
  }, []);

  return { publishActiveSkill };
}
