export interface NolmeUserMessageProps {
  message: {
    role: 'user';
    content: string;
  };
}

export function NolmeUserMessage({ message }: NolmeUserMessageProps) {
  return (
    <div data-testid="nolme-user-message" className="flex w-full justify-end">
      <div
        data-testid="nolme-user-stack"
        className="flex w-full max-w-[530px] min-w-[160px] flex-col items-end gap-[4px]"
      >
        <div
          data-testid="nolme-user-bubble"
          className="w-full rounded-bl-[12px] rounded-br-[12px] rounded-tl-[12px] rounded-tr-[4px] bg-[#e2e2ea] px-[16px] py-[12px] font-[Satoshi:Regular] text-[16px] leading-[26px] text-nolme-neutral-900"
        >
          {message.content}
        </div>
      </div>
    </div>
  );
}
