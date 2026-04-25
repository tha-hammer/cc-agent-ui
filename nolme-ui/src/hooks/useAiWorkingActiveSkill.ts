import { useEffect, useState } from 'react';
import type { NolmeSessionBinding } from '../lib/types';
import {
  ACTIVE_SKILL_CHANNEL,
  ACTIVE_SKILL_STORAGE_KEY,
  makeActiveSkillIdentityKey,
  normalizeActiveSkillContext,
  parseActiveSkillStore,
  type ActiveSkillContext,
} from '../../../src/hooks/useActiveSkillBroadcast';

function readStoredActiveSkill(binding: NolmeSessionBinding | null): ActiveSkillContext | null {
  if (!binding || typeof localStorage === 'undefined') {
    return null;
  }

  const store = parseActiveSkillStore(localStorage.getItem(ACTIVE_SKILL_STORAGE_KEY));
  return store[makeActiveSkillIdentityKey(binding)] ?? null;
}

export function useAiWorkingActiveSkill(binding: NolmeSessionBinding | null): ActiveSkillContext | null {
  const [activeSkill, setActiveSkill] = useState<ActiveSkillContext | null>(() => readStoredActiveSkill(binding));

  useEffect(() => {
    setActiveSkill(readStoredActiveSkill(binding));
  }, [binding?.provider, binding?.sessionId, binding?.projectPath]);

  useEffect(() => {
    if (!binding) {
      setActiveSkill(null);
      return undefined;
    }

    const identityKey = makeActiveSkillIdentityKey(binding);

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== ACTIVE_SKILL_STORAGE_KEY) return;
      const store = parseActiveSkillStore(event.newValue);
      setActiveSkill(store[identityKey] ?? null);
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('storage', handleStorage);
    }

    let channel: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== 'undefined') {
      channel = new BroadcastChannel(ACTIVE_SKILL_CHANNEL);
      channel.onmessage = (event: MessageEvent<unknown>) => {
        const payload = event.data as { type?: string; context?: unknown } | null;
        const normalized = normalizeActiveSkillContext(payload?.context ?? payload);
        if (!normalized) return;
        if (makeActiveSkillIdentityKey(normalized) !== identityKey) return;
        setActiveSkill(normalized);
      };
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('storage', handleStorage);
      }
      channel?.close();
    };
  }, [binding?.provider, binding?.sessionId, binding?.projectPath]);

  return activeSkill;
}
