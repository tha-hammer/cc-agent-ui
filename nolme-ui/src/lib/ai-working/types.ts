import type { ActiveSkillContext } from '../../../../src/hooks/useActiveSkillBroadcast';
import type {
  NolmeAgentStateLike,
  NolmePhase,
  NolmeResource,
  NolmeSessionBinding,
} from '../types';

export type AiWorkingPhaseKey =
  | 'observe'
  | 'think'
  | 'plan'
  | 'build'
  | 'execute'
  | 'verify'
  | 'learn'
  | 'complete';

export interface AiWorkingProgress {
  current: number;
  total: number;
}

export interface AiWorkingMarkerState {
  capture?: string;
  next?: string;
  completed?: string;
}

export interface AiWorkingConversationState {
  phaseKey: AiWorkingPhaseKey | null;
  progress: AiWorkingProgress | null;
  markers: AiWorkingMarkerState;
}

export interface AiWorkingMessage {
  id?: string;
  timestamp?: string;
  kind: string;
  role?: string;
  content?: string;
  text?: string;
  toolName?: string;
  toolId?: string;
  toolInput?: Record<string, unknown>;
  toolUseResult?: Record<string, unknown>;
  toolResult?: {
    toolUseResult?: Record<string, unknown>;
    [key: string]: unknown;
  };
}

export interface AiWorkingPhaseProjection {
  phases: NolmePhase[];
  currentReviewLine: string;
  phaseKey: AiWorkingPhaseKey | null;
  progress: AiWorkingProgress | null;
  source: 'workflow-tool' | 'marker' | 'empty' | 'prd' | 'algorithm';
}

export interface AiWorkingDeliverable {
  id: string;
  badge: NolmeResource['badge'];
  title: string;
  subtitle: string;
  tone: NolmeResource['tone'];
  action: NolmeResource['action'];
  url?: string;
  source: 'file' | 'addResource' | 'summary';
  filePath?: string;
}

export interface AiWorkingQuestionOption {
  id: string;
  label: string;
  allowsFreeText: boolean;
}

export interface AiWorkingQuestionStep {
  id: string;
  header?: string | null;
  prompt: string;
  options: AiWorkingQuestionOption[];
  selectionMode: 'single' | 'multi';
}

export interface AiWorkingQuestionCard {
  intro?: string | null;
  questions: AiWorkingQuestionStep[];
  skipLabel: string;
  continueLabel: string;
  placeholder: string;
  source: 'ask-user-question' | 'assistant-block' | 'assistant-text' | 'pending-permission';
  responseMode: 'prompt' | 'permission';
  requestId?: string;
  requestInput?: Record<string, unknown>;
}

export interface AiWorkingHydrationInput {
  binding: NolmeSessionBinding | null;
  messages: unknown[];
  state: NolmeAgentStateLike;
}

export interface AiWorkingProjectionInput {
  binding?: NolmeSessionBinding | null;
  state?: unknown;
  messages?: unknown;
  activeSkill?: ActiveSkillContext | null;
}

export interface AiWorkingProjection {
  state: NolmeAgentStateLike;
  messages: AiWorkingMessage[];
  activeSkill: ActiveSkillContext | null;
  phases: NolmePhase[];
  deliverables: NolmeResource[];
  questionCard: AiWorkingQuestionCard | null;
  quickActions: string[];
  explicit: {
    phases: boolean;
    resources: boolean;
    quickActions: boolean;
  };
  empty: {
    messages: boolean;
    phases: boolean;
    resources: boolean;
    quickActions: boolean;
  };
}

export const PHASE_TITLES: Record<AiWorkingPhaseKey, string> = {
  observe: 'Observe',
  think: 'Think',
  plan: 'Plan',
  build: 'Build',
  execute: 'Execute',
  verify: 'Verify',
  learn: 'Learn',
  complete: 'Complete',
};

export const AI_WORKING_PHASES: Array<{
  key: AiWorkingPhaseKey;
  header: string;
}> = [
  { key: 'observe', header: '━━━ 👁️ OBSERVE' },
  { key: 'think', header: '━━━ 🧠 THINK' },
  { key: 'plan', header: '━━━ 📋 PLAN' },
  { key: 'build', header: '━━━ 🔨 BUILD' },
  { key: 'execute', header: '━━━ ⚡ EXECUTE' },
  { key: 'verify', header: '━━━ ✅ VERIFY' },
  { key: 'learn', header: '━━━ 📚 LEARN' },
];

export const BADGE_TONE: Record<NolmeResource['badge'], NolmeResource['tone']> = {
  P1: 'emerald',
  P2: 'emerald',
  P3: 'iris',
  P4: 'gold',
};
