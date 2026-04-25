import { Check, ChevronDown } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { AiWorkingQuestionCard } from '../lib/ai-working/types';

export interface AiResponseQuestionsCardProps {
  question: AiWorkingQuestionCard;
  onSubmitAnswers?: (answers: Record<string, string>) => Promise<void> | void;
}

export function AiResponseQuestionsCard({
  question,
  onSubmitAnswers = () => {},
}: AiResponseQuestionsCardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedByStep, setSelectedByStep] = useState<Record<number, string[]>>({});
  const [otherTextByStep, setOtherTextByStep] = useState<Record<number, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setCurrentStep(0);
    setSelectedByStep({});
    setOtherTextByStep({});
    setIsSubmitting(false);
  }, [question]);

  const steps = question.questions;
  const step = steps[currentStep];

  const selectedLabels = selectedByStep[currentStep] ?? [];
  const otherText = otherTextByStep[currentStep] ?? '';

  const isSelected = (label: string): boolean => selectedLabels.includes(label);

  const toggleOption = (label: string, allowsFreeText: boolean) => {
    if (!step) return;

    if (step.selectionMode === 'single') {
      setSelectedByStep((current) => ({ ...current, [currentStep]: [label] }));
      if (!allowsFreeText) {
        setOtherTextByStep((current) => ({ ...current, [currentStep]: '' }));
      }
      return;
    }

    setSelectedByStep((current) => {
      const selected = current[currentStep] ?? [];
      if (selected.includes(label)) {
        if (allowsFreeText) {
          setOtherTextByStep((texts) => ({ ...texts, [currentStep]: '' }));
        }
        return {
          ...current,
          [currentStep]: selected.filter((entry) => entry !== label),
        };
      }
      return {
        ...current,
        [currentStep]: [...selected, label],
      };
    });
  };

  const buildAnswerForStep = (stepIndex: number): string => {
    const currentStepDefinition = steps[stepIndex];
    if (!currentStepDefinition) {
      return '';
    }

    const currentOtherOption = currentStepDefinition.options.find((option) => option.allowsFreeText) ?? null;
    const currentOtherText = (otherTextByStep[stepIndex] ?? '').trim();
    const currentSelected = selectedByStep[stepIndex] ?? [];

    const answers = currentSelected.flatMap((label) => {
      if (!currentOtherOption || label !== currentOtherOption.label) {
        return [label];
      }

      return currentOtherText ? [currentOtherText] : [];
    });

    return answers.join(', ');
  };

  const buildAnswers = (): Record<string, string> => {
    return steps.reduce<Record<string, string>>((answers, currentStepDefinition, stepIndex) => {
      const answer = buildAnswerForStep(stepIndex);
      if (answer) {
        answers[currentStepDefinition.prompt] = answer;
      }
      return answers;
    }, {});
  };

  const currentAnswer = buildAnswerForStep(currentStep);

  const handleContinue = async () => {
    if (!currentAnswer || isSubmitting) return;

    if (currentStep < steps.length - 1) {
      setCurrentStep((value) => value + 1);
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmitAnswers(buildAnswers());
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onSubmitAnswers({});
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!step) {
    return null;
  }

  const isMultiStep = steps.length > 1;

  return (
    <section
      data-testid="ai-response-questions-card"
      className="w-full min-w-[320px] rounded-[12px] border border-[#e2e2ea] bg-white p-[20px] shadow-[0_8px_20px_rgba(79,62,214,0.05)]"
    >
      <div className="flex flex-col gap-[4px]">
        {question.intro ? (
          <p className="font-[Satoshi:Medium] text-[14px] leading-[22px] text-nolme-neutral-600">
            {question.intro}
          </p>
        ) : null}
        <div className="flex items-center justify-between gap-[12px]">
          {step.header ? (
            <p className="font-[Satoshi:Medium] text-[14px] leading-[22px] text-nolme-neutral-500">
              {step.header}
            </p>
          ) : <span />}
          {isMultiStep ? (
            <p className="font-[Satoshi:Medium] text-[12px] leading-[18px] text-nolme-neutral-400">
              {currentStep + 1}/{steps.length}
            </p>
          ) : null}
        </div>
        <p className="font-[Satoshi:Medium] text-[16px] leading-[26px] text-nolme-neutral-900">
          {step.prompt}
        </p>
      </div>

      <div className="mt-[20px] flex flex-col gap-[6px]">
        {step.options.map((option, index) => {
          const checked = isSelected(option.label);
          const showDivider = index < step.options.length - 1;

          return (
            <div key={option.id} className="flex flex-col gap-[6px]">
              <button
                type="button"
                onClick={() => toggleOption(option.label, option.allowsFreeText)}
                className="flex h-[32px] w-full items-center gap-[8px] text-left"
                disabled={isSubmitting}
              >
                <span
                  className={[
                    'flex h-[16px] w-[16px] items-center justify-center rounded-[4px] border-[1.5px]',
                    checked
                      ? 'border-nolme-purple-500 bg-nolme-purple-500 text-white'
                      : 'border-[#e2e2ea] bg-white text-transparent',
                  ].join(' ')}
                >
                  <Check className="h-[12px] w-[12px]" strokeWidth={2.5} />
                </span>
                <span className="font-[Satoshi:Regular] text-[14px] leading-[22px] text-nolme-neutral-900">
                  {option.label}
                </span>
              </button>

              {option.allowsFreeText && checked && (
                <input
                  type="text"
                  value={otherText}
                  onChange={(event) =>
                    setOtherTextByStep((current) => ({
                      ...current,
                      [currentStep]: event.target.value,
                    }))}
                  placeholder={question.placeholder}
                  className="h-[48px] w-full rounded-[8px] border-[1.5px] border-nolme-purple-550 px-[16px] font-[Satoshi:Regular] text-[16px] leading-[26px] text-nolme-neutral-900 outline-none"
                />
              )}

              {showDivider && <div className="h-px w-full rounded-[999px] bg-[#e2e2ea]" />}
            </div>
          );
        })}
      </div>

      <div className="mt-[20px] flex items-center justify-between">
        <button
          type="button"
          onClick={() => void handleSkip()}
          disabled={isSubmitting}
          className="font-[Satoshi:Regular] text-[14px] leading-[22px] text-nolme-neutral-600 disabled:text-nolme-neutral-300"
        >
          {question.skipLabel}
        </button>
        <button
          type="button"
          onClick={() => void handleContinue()}
          disabled={!currentAnswer || isSubmitting}
          className="inline-flex h-[34px] items-center gap-[4px] rounded-[999px] bg-nolme-purple-500 px-[16px] font-[Satoshi:Medium] text-[14px] leading-[18px] tracking-[1px] text-white disabled:bg-[#e2e2ea] disabled:text-nolme-neutral-400"
        >
          <span>{question.continueLabel}</span>
          <ChevronDown className="h-[12px] w-[12px] rotate-[-90deg]" strokeWidth={2.5} />
        </button>
      </div>
    </section>
  );
}
