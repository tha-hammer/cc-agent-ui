import { useMemo } from 'react';
import { useAiWorkingHydrationInput, useAiWorkingProjection } from '../../hooks/useAiWorkingProjection';
import { buildAskUserQuestionCard } from '../../lib/ai-working/projectAssistantQuestion';
import { usePendingPermissionRequests } from '../../hooks/usePendingPermissionRequests';
import { AiResponseQuestionsCard } from '../AiResponseQuestionsCard';

export interface AiResponseQuestionsCardBoundProps {
  onSubmitPrompt?: (value: string) => void;
}

export function AiResponseQuestionsCardBound(props: AiResponseQuestionsCardBoundProps) {
  const hydration = useAiWorkingHydrationInput();
  const projection = useAiWorkingProjection();
  const { requests, respond } = usePendingPermissionRequests(hydration.binding);

  const liveQuestionCard = useMemo(() => {
    const pendingRequest = requests.find(
      (request) => request.toolName === 'AskUserQuestion' && request.input,
    );
    if (!pendingRequest) {
      return null;
    }

    return buildAskUserQuestionCard(pendingRequest.input, {
      source: 'pending-permission',
      responseMode: 'permission',
      requestId: pendingRequest.requestId,
    });
  }, [requests]);

  const questionCard = liveQuestionCard ?? projection.questionCard;

  if (!questionCard) {
    return null;
  }

  const handleSubmitAnswers = async (answers: Record<string, string>) => {
    if (questionCard.responseMode === 'permission' && questionCard.requestId && questionCard.requestInput) {
      await respond(questionCard.requestId, {
        allow: true,
        updatedInput: {
          ...questionCard.requestInput,
          answers,
        },
      });
      return;
    }

    if (Object.keys(answers).length === 0) {
      props.onSubmitPrompt?.(questionCard.skipLabel);
      return;
    }

    const entries = Object.entries(answers);
    const promptText = entries.length === 1
      ? entries[0][1]
      : entries.map(([prompt, answer]) => `${prompt}: ${answer}`).join('\n');
    props.onSubmitPrompt?.(promptText);
  };

  return (
    <AiResponseQuestionsCard
      question={questionCard}
      onSubmitAnswers={handleSubmitAnswers}
    />
  );
}
