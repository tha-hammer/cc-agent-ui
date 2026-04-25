import { createContext, createElement, useContext, useMemo, type ReactNode } from 'react';
import { useCoAgent } from '@copilotkit/react-core';
import { useAiWorkingActiveSkill } from './useAiWorkingActiveSkill';
import type { HydrationResult } from './useHydratedState';
import type { NolmeAgentStateLike, NolmeSessionBinding } from '../lib/types';
import { DEFAULT_NOLME_AGENT_STATE } from '../lib/types';
import { normalizeNolmeState } from '../lib/ai-working/normalizeNolmeState';
import { projectAiWorkingProjection } from '../lib/ai-working/projectAiWorkingProjection';
import type { AiWorkingHydrationInput, AiWorkingProjection } from '../lib/ai-working/types';

const DEFAULT_HYDRATION_INPUT: AiWorkingHydrationInput = {
  binding: null,
  messages: [],
  state: { ...DEFAULT_NOLME_AGENT_STATE },
};

const AiWorkingHydrationContext = createContext<AiWorkingHydrationInput>(DEFAULT_HYDRATION_INPUT);

export function AiWorkingHydrationProvider(props: {
  binding: NolmeSessionBinding;
  hydration: HydrationResult;
  children: ReactNode;
}) {
  const normalizedState = useMemo(
    () => normalizeNolmeState(props.hydration.state).state,
    [props.hydration.state],
  );

  const value = useMemo<AiWorkingHydrationInput>(
    () => ({
      binding: props.binding,
      messages: props.hydration.messages ?? [],
      state: normalizedState,
    }),
    [props.binding, props.hydration.messages, normalizedState],
  );

  return createElement(AiWorkingHydrationContext.Provider, { value }, props.children);
}

export function useAiWorkingHydrationInput(): AiWorkingHydrationInput {
  return useContext(AiWorkingHydrationContext);
}

export function useAiWorkingProjection(): AiWorkingProjection {
  const hydration = useAiWorkingHydrationInput();
  const { state } = useCoAgent<Partial<NolmeAgentStateLike>>({
    name: 'ccu',
    initialState: hydration.state,
  });
  const activeSkill = useAiWorkingActiveSkill(hydration.binding);

  return useMemo(
    () =>
      projectAiWorkingProjection({
        binding: hydration.binding,
        state: (state as NolmeAgentStateLike | undefined) ?? hydration.state,
        messages: hydration.messages,
        activeSkill,
      }),
    [activeSkill, hydration.messages, hydration.state, state],
  );
}
