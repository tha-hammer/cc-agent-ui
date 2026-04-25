import { useRef, useEffect } from 'react';
import { ModelSelectorPill } from './ModelSelectorPill';

export interface NolmeComposerProps {
  inputValue?: string;
  onInputChange?: (value: string) => void;
  onSubmitMessage?: (value: string) => void;
  onStop?: () => void;
  onAddFile?: () => void;
  isRunning?: boolean;
}

export function NolmeComposer({
  inputValue = '',
  onInputChange = () => {},
  onSubmitMessage = () => {},
  onStop,
  onAddFile,
  isRunning = false,
}: NolmeComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!isRunning) {
      textareaRef.current?.focus();
    }
  }, [isRunning]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const trimmed = inputValue.trim();
      if (!trimmed) return;
      onSubmitMessage(trimmed);
      onInputChange('');
    }
  };

  const trimmed = inputValue.trim();
  const canSend = trimmed.length > 0 && !isRunning;

  const handleSend = () => {
    if (!canSend) return;
    onSubmitMessage(trimmed);
    onInputChange('');
  };

  return (
    <div
      data-testid="nolme-composer"
      className="flex h-[100px] w-[784px] max-w-full flex-col items-start justify-between rounded-[8px] border border-[#c8c8d6] bg-[#f8f8fa] px-[16px] pb-[10px] pt-[12px]"
    >
      <textarea
        ref={textareaRef}
        rows={1}
        value={inputValue}
        onChange={(e) => onInputChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type your response..."
        className="min-h-0 w-full flex-1 resize-none bg-transparent outline-none font-[Satoshi:Regular] text-[16px] leading-[26px] text-nolme-neutral-800 placeholder:text-nolme-neutral-400"
      />
      <div className="flex h-[24px] w-full items-center justify-between">
        <ModelSelectorPill />
        <div className="flex items-center gap-[12px]">
          <p className="font-[Satoshi:Regular] text-[12px] leading-[18px] text-nolme-neutral-400">
            0 tokens (est)
          </p>
          {isRunning && onStop ? (
            <button
              type="button"
              aria-label="Stop run"
              onClick={onStop}
              className="rounded-[999px] bg-nolme-purple-500 px-[12px] py-[4px] font-[Satoshi:Medium] text-[12px] leading-[18px] text-white"
            >
              Stop
            </button>
          ) : (
            <button
              type="button"
              aria-label="Send message"
              disabled={!canSend}
              onClick={handleSend}
              className={[
                'rounded-[999px] px-[12px] py-[4px] font-[Satoshi:Medium] text-[12px] leading-[18px]',
                canSend
                  ? 'bg-nolme-purple-500 text-white'
                  : 'bg-[#e2e2ea] text-nolme-neutral-400',
              ].join(' ')}
            >
              Send
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
