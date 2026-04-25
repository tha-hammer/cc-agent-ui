import { useCallback, useMemo } from 'react';
import { useCcuSession } from './useCcuSession';
import type { NolmeSessionBinding } from '../lib/types';

const LS_KEY = 'nolme-current-binding';
const CHANNEL = 'ccu-session';

export interface CcuSessionState {
  binding: NolmeSessionBinding | null;
  updateBinding: (partial: Partial<NolmeSessionBinding>) => void;
}

export function useCcuSessionState(): CcuSessionState {
  const binding = useCcuSession();

  const updateBinding = useCallback(
    (partial: Partial<NolmeSessionBinding>) => {
      if (!binding) return;
      const merged: NolmeSessionBinding = { ...binding, ...partial };
      try {
        localStorage.setItem(LS_KEY, JSON.stringify(merged));
      } catch {
        /* ignore */
      }
      try {
        const ch = new BroadcastChannel(CHANNEL);
        ch.postMessage({ type: 'update', binding: merged });
        ch.close();
      } catch {
        /* ignore */
      }
    },
    [binding],
  );

  return useMemo(() => ({ binding, updateBinding }), [binding, updateBinding]);
}
