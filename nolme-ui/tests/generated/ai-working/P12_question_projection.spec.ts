import { describe, expect, it } from 'vitest';
import { projectAiWorkingProjection } from '../../../src/lib/ai-working/projectAiWorkingProjection';

const binding = {
  provider: 'claude' as const,
  sessionId: 'session-questions',
  projectName: 'demo-project',
  projectPath: '/workspace/demo-project',
};

describe('P12 · assistant question projection', () => {
  it('projects AskUserQuestion tool payloads into a structured question card', () => {
    const result = projectAiWorkingProjection({
      binding,
      messages: [
        {
          id: 'question-tool',
          kind: 'tool_use',
          toolName: 'AskUserQuestion',
          toolInput: {
            questions: [
              {
                header: 'BUSINESS TYPE',
                question: 'Which business are you actively evaluating?',
                options: [
                  { label: 'Car wash' },
                  { label: 'Laundromat' },
                  { label: 'Both / comparing' },
                ],
              },
              {
                header: 'ROLE / ANGLE',
                question: "What's your role in this?",
                options: [
                  { label: 'Owner-operator' },
                  { label: 'Passive investor' },
                  { label: 'Advisor / research' },
                ],
              },
            ],
          },
        },
      ],
    });

    expect(result.questionCard).toEqual({
      intro: null,
      continueLabel: 'Continue',
      skipLabel: 'Skip for now',
      placeholder: 'Type your answer',
      source: 'ask-user-question',
      responseMode: 'prompt',
      requestId: undefined,
      requestInput: {
        questions: [
          {
            header: 'BUSINESS TYPE',
            question: 'Which business are you actively evaluating?',
            options: [
              { label: 'Car wash' },
              { label: 'Laundromat' },
              { label: 'Both / comparing' },
            ],
          },
          {
            header: 'ROLE / ANGLE',
            question: "What's your role in this?",
            options: [
              { label: 'Owner-operator' },
              { label: 'Passive investor' },
              { label: 'Advisor / research' },
            ],
          },
        ],
      },
      questions: [
        {
          id: 'which-business-are-you-actively-evaluating',
          header: 'BUSINESS TYPE',
          prompt: 'Which business are you actively evaluating?',
          selectionMode: 'single',
          options: [
            { id: 'car-wash', label: 'Car wash', allowsFreeText: false },
            { id: 'laundromat', label: 'Laundromat', allowsFreeText: false },
            { id: 'both-comparing', label: 'Both / comparing', allowsFreeText: false },
          ],
        },
        {
          id: 'what-s-your-role-in-this',
          header: 'ROLE / ANGLE',
          prompt: "What's your role in this?",
          selectionMode: 'single',
          options: [
            { id: 'owner-operator', label: 'Owner-operator', allowsFreeText: false },
            { id: 'passive-investor', label: 'Passive investor', allowsFreeText: false },
            { id: 'advisor-research', label: 'Advisor / research', allowsFreeText: false },
          ],
        },
      ],
    });
  });

  it('projects a tagged assistant question block from assistant text', () => {
    const result = projectAiWorkingProjection({
      binding,
      messages: [
        {
          id: 'assistant-question-block',
          kind: 'text',
          role: 'assistant',
          content: [
            '════ SAI | NATIVE MODE ═══════════════════════',
            '🗒️ TASK: Clarify targeting radius',
            '',
            '<ask-user-question>',
            "intro: Before I proceed, I'd like to clarify a few things:",
            'prompt: How much distance outside the Bay Area did you want to apply?',
            'mode: single',
            'option: 5 mile radius',
            'option: 10 mile radius',
            'option: 20 mile radius',
            'option_other: Other (describe below)',
            'placeholder: 15 miles radius outside the Bay Area',
            'skip_label: Skip for now',
            'continue_label: Continue',
            '</ask-user-question>',
          ].join('\n'),
        },
      ],
    });

    expect(result.questionCard).toEqual({
      intro: "Before I proceed, I'd like to clarify a few things:",
      continueLabel: 'Continue',
      skipLabel: 'Skip for now',
      placeholder: '15 miles radius outside the Bay Area',
      source: 'assistant-block',
      responseMode: 'prompt',
      requestId: undefined,
      requestInput: undefined,
      questions: [
        {
          id: 'how-much-distance-outside-the-bay-area-did-you-want-to-apply',
          header: null,
          prompt: 'How much distance outside the Bay Area did you want to apply?',
          selectionMode: 'single',
          options: [
            { id: '5-mile-radius', label: '5 mile radius', allowsFreeText: false },
            { id: '10-mile-radius', label: '10 mile radius', allowsFreeText: false },
            { id: '20-mile-radius', label: '20 mile radius', allowsFreeText: false },
            { id: 'other-describe-below', label: 'Other (describe below)', allowsFreeText: true },
          ],
        },
      ],
    });
  });

  it('does not invent a question card from ordinary assistant prose', () => {
    const result = projectAiWorkingProjection({
      binding,
      messages: [
        {
          id: 'assistant-summary',
          kind: 'text',
          role: 'assistant',
          content: [
            'Across the car wash and laundromat research, here are the critical unknowns',
            '- What markets are you targeting?',
            '- What is your capital position?',
            '- Are you buying one or building a portfolio?',
          ].join('\n'),
        },
      ],
    });

    expect(result.questionCard).toBeNull();
  });

  it('suppresses an AskUserQuestion card after a later user answer is already present in history', () => {
    const result = projectAiWorkingProjection({
      binding,
      messages: [
        {
          id: 'question-tool',
          kind: 'tool_use',
          toolName: 'AskUserQuestion',
          toolInput: {
            questions: [
              {
                header: 'BUSINESS TYPE',
                question: 'Which business are you actively evaluating?',
                options: [
                  { label: 'Car wash' },
                  { label: 'Laundromat' },
                ],
              },
            ],
          },
        },
        {
          id: 'user-answer',
          kind: 'text',
          role: 'user',
          content: 'Car wash',
        },
        {
          id: 'assistant-follow-up',
          kind: 'text',
          role: 'assistant',
          content: 'Understood. I will focus on car wash opportunities.',
        },
      ],
    });

    expect(result.questionCard).toBeNull();
  });

  it('suppresses an AskUserQuestion card after the matching tool call has completed', () => {
    const result = projectAiWorkingProjection({
      binding,
      messages: [
        {
          id: 'question-tool',
          kind: 'tool_use',
          toolId: 'tool-ask-1',
          toolName: 'AskUserQuestion',
          toolInput: {
            questions: [
              {
                header: 'BUSINESS TYPE',
                question: 'Which business are you actively evaluating?',
                options: [
                  { label: 'Car wash' },
                  { label: 'Laundromat' },
                ],
              },
            ],
          },
        },
        {
          id: 'question-tool-result',
          kind: 'tool_result',
          toolId: 'tool-ask-1',
          toolResult: {
            toolUseResult: {
              answers: {
                'Which business are you actively evaluating?': 'Car wash',
              },
            },
          },
        },
      ],
    });

    expect(result.questionCard).toBeNull();
  });
});
