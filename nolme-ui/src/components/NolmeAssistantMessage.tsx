import type { ReactNode } from 'react';

export interface PhaseHeaderMeta {
  phase: string;
  task: string;
  status: string;
}

export interface NolmeAssistantMessageProps {
  message: {
    role: 'assistant';
    content: string;
    metadata?: {
      phaseHeader?: PhaseHeaderMeta;
    };
  };
  renderMarkdown?: (content: string) => ReactNode;
}

function defaultMarkdownRenderer(content: string): ReactNode {
  return <div data-testid="nolme-markdown">{content}</div>;
}

export function NolmeAssistantMessage({ message, renderMarkdown }: NolmeAssistantMessageProps) {
  const phaseHeader = message.metadata?.phaseHeader;
  const renderer = renderMarkdown ?? defaultMarkdownRenderer;

  return (
    <div
      data-testid="nolme-assistant-message"
      className="flex w-[816px] max-w-full flex-col gap-[8px] overflow-clip rounded-[16px] bg-white p-[24px] font-[Satoshi:Regular] text-[16px] leading-[26px] text-nolme-neutral-900"
    >
      {phaseHeader && (
        <header
          data-testid="nolme-phase-header"
          className="bg-nolme-neutral-100 rounded-t-[24px] p-[16px] flex gap-[24px] items-center text-nolme-neutral-800 whitespace-nowrap"
        >
          <h3 className="font-[Satoshi:Bold] text-[26px] leading-[34px] tracking-[-0.26px]">
            {phaseHeader.phase}: {phaseHeader.task}
          </h3>
          <p className="font-[Satoshi:Regular] text-[18px] leading-[28px]">{phaseHeader.status}</p>
        </header>
      )}
      <div data-testid="nolme-assistant-body" className="flex flex-col gap-[24px]">
        {renderer(message.content)}
      </div>
    </div>
  );
}
