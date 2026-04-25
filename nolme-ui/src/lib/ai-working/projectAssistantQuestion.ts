import type {
  AiWorkingMessage,
  AiWorkingQuestionCard,
  AiWorkingQuestionOption,
  AiWorkingQuestionStep,
} from './types';

const DEFAULT_SKIP_LABEL = 'Skip for now';
const DEFAULT_CONTINUE_LABEL = 'Continue';
const DEFAULT_PLACEHOLDER = 'Type your answer';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function createOption(label: string, allowsFreeText = /other/i.test(label)): AiWorkingQuestionOption {
  return {
    id: slugify(label),
    label,
    allowsFreeText,
  };
}

function createStep(input: {
  header?: string | null;
  prompt: string;
  options: AiWorkingQuestionOption[];
  selectionMode?: 'single' | 'multi';
}): AiWorkingQuestionStep {
  return {
    id: slugify(input.prompt),
    header: input.header ?? null,
    prompt: input.prompt,
    options: input.options,
    selectionMode: input.selectionMode ?? 'single',
  };
}

function buildQuestionCard(input: {
  intro?: string | null;
  questions: AiWorkingQuestionStep[];
  skipLabel?: string | null;
  continueLabel?: string | null;
  placeholder?: string | null;
  source: AiWorkingQuestionCard['source'];
  responseMode?: AiWorkingQuestionCard['responseMode'];
  requestId?: string;
  requestInput?: Record<string, unknown>;
}): AiWorkingQuestionCard {
  return {
    intro: input.intro ?? null,
    questions: input.questions,
    skipLabel: input.skipLabel ?? DEFAULT_SKIP_LABEL,
    continueLabel: input.continueLabel ?? DEFAULT_CONTINUE_LABEL,
    placeholder: input.placeholder ?? DEFAULT_PLACEHOLDER,
    source: input.source,
    responseMode: input.responseMode ?? 'prompt',
    requestId: input.requestId,
    requestInput: input.requestInput,
  };
}

export function buildAskUserQuestionCard(
  input: unknown,
  options: {
    source: AiWorkingQuestionCard['source'];
    responseMode?: AiWorkingQuestionCard['responseMode'];
    requestId?: string;
  },
): AiWorkingQuestionCard | null {
  if (!isRecord(input) || !Array.isArray(input.questions)) {
    return null;
  }

  const questions = input.questions
    .map((question) => {
      if (!isRecord(question)) return null;
      const prompt = asString(question.question);
      if (!prompt) return null;

      const stepOptions = Array.isArray(question.options)
        ? question.options
            .map((option) => (isRecord(option) ? asString(option.label) : null))
            .filter((label): label is string => Boolean(label))
            .map((label) => createOption(label))
        : [];

      if (stepOptions.length === 0) return null;

      return createStep({
        header: asString(question.header),
        prompt,
        options: stepOptions,
        selectionMode: question.multiSelect === true ? 'multi' : 'single',
      });
    })
    .filter((question): question is AiWorkingQuestionStep => Boolean(question));

  if (questions.length === 0) {
    return null;
  }

  return buildQuestionCard({
    intro: asString(input.intro),
    questions,
    placeholder: asString(input.placeholder),
    source: options.source,
    responseMode: options.responseMode,
    requestId: options.requestId,
    requestInput: input,
  });
}

function parseToolQuestion(message: AiWorkingMessage): AiWorkingQuestionCard | null {
  if (message.toolName !== 'AskUserQuestion') {
    return null;
  }

  return buildAskUserQuestionCard(message.toolInput, {
    source: 'ask-user-question',
    responseMode: 'prompt',
  });
}

function parseTaggedBlock(text: string): AiWorkingQuestionCard | null {
  const match = text.match(/<ask-user-question>([\s\S]*?)<\/ask-user-question>/i);
  if (!match) return null;

  let intro: string | null = null;
  let prompt: string | null = null;
  let selectionMode: 'single' | 'multi' = 'single';
  let skipLabel: string | null = null;
  let continueLabel: string | null = null;
  let placeholder: string | null = null;
  const options: AiWorkingQuestionOption[] = [];

  for (const rawLine of match[1].split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    const separatorIndex = line.indexOf(':');
    if (separatorIndex < 0) continue;

    const prefix = line.slice(0, separatorIndex).trim().toLowerCase();
    const value = line.slice(separatorIndex + 1).trim();

    switch (prefix) {
      case 'intro':
        intro = value || null;
        break;
      case 'prompt':
        prompt = value || null;
        break;
      case 'mode':
        selectionMode = value.toLowerCase() === 'multi' ? 'multi' : 'single';
        break;
      case 'option':
        if (value) options.push(createOption(value, false));
        break;
      case 'option_other':
        if (value) options.push(createOption(value, true));
        break;
      case 'skip_label':
        skipLabel = value || null;
        break;
      case 'continue_label':
        continueLabel = value || null;
        break;
      case 'placeholder':
        placeholder = value || null;
        break;
      default:
        break;
    }
  }

  if (!prompt || options.length === 0) return null;

  return buildQuestionCard({
    intro,
    questions: [
      createStep({
        prompt,
        options,
        selectionMode,
      }),
    ],
    skipLabel,
    continueLabel,
    placeholder,
    source: 'assistant-block',
    responseMode: 'prompt',
  });
}

function extractOptionLabel(line: string): string | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  const listMatch = trimmed.match(/^(?:[-*]|\d+\.)\s+(.*)$/);
  if (listMatch?.[1]) return listMatch[1].trim();

  const checkboxMatch = trimmed.match(/^\[[ xX]?\]\s*(.*)$/);
  if (checkboxMatch?.[1]) return checkboxMatch[1].trim();

  if (/^other\b/i.test(trimmed)) return trimmed;

  return null;
}

function parseImplicitClarifyingQuestion(text: string): AiWorkingQuestionCard | null {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const introIndex = lines.findIndex(
    (line) => /before i proceed/i.test(line) || /clarify a few things/i.test(line),
  );
  if (introIndex < 0) return null;

  let promptIndex = -1;
  for (let index = introIndex + 1; index < lines.length; index += 1) {
    if (/[?:]$/.test(lines[index])) {
      promptIndex = index;
      break;
    }
  }

  if (promptIndex < 0) return null;

  const options: AiWorkingQuestionOption[] = [];
  for (let index = promptIndex + 1; index < lines.length; index += 1) {
    const label = extractOptionLabel(lines[index]);
    if (!label) {
      if (options.length > 0) break;
      continue;
    }
    options.push(createOption(label));
  }

  if (options.length < 2) return null;

  return buildQuestionCard({
    intro: lines[introIndex],
    questions: [
      createStep({
        prompt: lines[promptIndex].replace(/:+$/, '?'),
        options,
      }),
    ],
    source: 'assistant-text',
    responseMode: 'prompt',
  });
}

export function projectAssistantQuestion(messages: AiWorkingMessage[]): AiWorkingQuestionCard | null {
  let lastUserIndex = -1;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.kind === 'text' && message.role === 'user' && typeof message.content === 'string') {
      lastUserIndex = index;
      break;
    }
  }

  const resolvedToolIds = new Set<string>();

  for (let index = messages.length - 1; index > lastUserIndex; index -= 1) {
    const message = messages[index];

    if (message.kind === 'tool_result' && typeof message.toolId === 'string') {
      resolvedToolIds.add(message.toolId);
      continue;
    }

    if (message.kind === 'tool_use') {
      if (message.toolName === 'AskUserQuestion' && message.toolId && resolvedToolIds.has(message.toolId)) {
        continue;
      }
      const toolQuestion = parseToolQuestion(message);
      if (toolQuestion) return toolQuestion;
    }

    if (message.kind === 'text' && message.role === 'assistant' && typeof message.content === 'string') {
      const blockQuestion = parseTaggedBlock(message.content);
      if (blockQuestion) return blockQuestion;

      const implicitQuestion = parseImplicitClarifyingQuestion(message.content);
      if (implicitQuestion) return implicitQuestion;
    }
  }

  return null;
}
