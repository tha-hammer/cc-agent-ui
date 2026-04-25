import { useEffect, useRef } from 'react';
import { CopilotChatMessageView } from '@copilotkit/react-core/v2';
import type { DragEvent } from 'react';
import { NolmeComposer } from './NolmeComposer';
import { AiWorkingInputContextClusterBound } from './bindings/AiWorkingInputContextClusterBound';
import { AiResponseQuestionsCardBound } from './bindings/AiResponseQuestionsCardBound';
import { QuickActionChipRowBound } from './bindings/QuickActionChipRowBound';

export interface NolmeChatViewProps {
  messageView?: any;
  messages?: any[];
  isRunning?: boolean;
  inputValue?: string;
  onInputChange?: (v: string) => void;
  onSubmitMessage?: (v: string) => void;
  onStop?: () => void;
  onAddFile?: () => void;
  attachments?: any[];
  dragOver?: boolean;
  onDragOver?: (e: DragEvent) => void;
  onDragLeave?: (e: DragEvent) => void;
  onDrop?: (e: DragEvent) => void;
}

// Match the framework's pin-to-bottom behaviour (CopilotChatView.ScrollView
// uses <StickToBottom>). We pin only when the user is already within
// PIN_THRESHOLD_PX of the bottom — otherwise we leave their scroll position
// alone so they can read history while a run is streaming.
const PIN_THRESHOLD_PX = 120;

export function NolmeChatView(props: NolmeChatViewProps) {
  const {
    messageView,
    messages = [],
    isRunning = false,
    inputValue = '',
    onInputChange = () => {},
    onSubmitMessage = () => {},
    onStop,
    onAddFile,
    onDragOver,
    onDragLeave,
    onDrop,
  } = props;

  const slotOverrides =
    typeof messageView === 'object' && messageView !== null ? messageView : {};

  const scrollRef = useRef<HTMLDivElement>(null);
  const wasNearBottomRef = useRef(true);

  // Track whether the user is near the bottom BEFORE the next layout (so a
  // freshly-arrived message doesn't itself push us out of the threshold).
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handle = () => {
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      wasNearBottomRef.current = distanceFromBottom <= PIN_THRESHOLD_PX;
    };
    handle();
    el.addEventListener('scroll', handle, { passive: true });
    return () => el.removeEventListener('scroll', handle);
  }, []);

  // After messages or running state change, pin to bottom if the user was
  // there. Tracks message count + last message content length so streaming
  // chunks (which mutate the last message in place) keep the view pinned.
  const lastMessage = messages[messages.length - 1];
  const lastContentLen =
    typeof lastMessage?.content === 'string' ? lastMessage.content.length : 0;
  useEffect(() => {
    if (!wasNearBottomRef.current) return;
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length, lastContentLen, isRunning]);

  const MessageViewLoose = CopilotChatMessageView as unknown as (
    p: Record<string, unknown>,
  ) => JSX.Element;

  return (
    <div
      data-testid="nolme-chat-view"
      className="flex flex-1 flex-col min-h-0 overflow-hidden bg-nolme-neutral-200"
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div
        ref={scrollRef}
        data-testid="nolme-history-scroll"
        className="flex-1 min-h-0 overflow-y-auto"
      >
        <div
          data-testid="nolme-chat-messages"
          className="flex min-h-full w-full flex-col justify-end gap-[40px] px-[96px] pb-[40px]"
        >
          <MessageViewLoose messages={messages} {...slotOverrides} />
        </div>
      </div>
      <div
        data-testid="nolme-input-zone"
        className="flex shrink-0 flex-col items-center gap-[10px] pb-[40px]"
      >
        <AiResponseQuestionsCardBound onSubmitPrompt={onSubmitMessage} />
        <div
          data-testid="nolme-input-container"
          className="flex h-[192px] w-[816px] max-w-full shrink-0 flex-col items-start rounded-[16px] bg-white p-[16px] shadow-[0_4px_8px_rgba(0,0,0,0.15)]"
        >
          <div className="flex w-full flex-col justify-center gap-[16px]">
            <div
              data-testid="nolme-input-utility-bar"
              className="flex w-full items-end justify-between gap-[16px]"
            >
              <AiWorkingInputContextClusterBound />
              <QuickActionChipRowBound onSubmitPrompt={onSubmitMessage} />
            </div>
            <NolmeComposer
              inputValue={inputValue}
              onInputChange={onInputChange}
              onSubmitMessage={onSubmitMessage}
              onStop={onStop}
              onAddFile={onAddFile}
              isRunning={isRunning}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
