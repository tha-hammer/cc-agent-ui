import type { NolmeAttachment } from './bindings/useNolmeAttachmentsSubmit';

export interface NolmeAttachmentQueueProps {
  attachments: Array<NolmeAttachment & { id: string }>;
  onRemoveAttachment: (id: string) => void;
}

export function NolmeAttachmentQueue({ attachments, onRemoveAttachment }: NolmeAttachmentQueueProps) {
  if (!attachments.length) return null;
  return (
    <div data-testid="nolme-attachment-queue" className="flex flex-wrap gap-2">
      {attachments.map((att) => (
        <div
          key={att.id}
          data-testid={`attachment-${att.id}`}
          className="relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-[4px] border border-nolme-border-input bg-nolme-neutral-100"
        >
          <img src={att.source.value} alt={att.filename} className="h-full w-full object-cover" />
          <button
            type="button"
            aria-label={`Remove ${att.filename}`}
            onClick={() => onRemoveAttachment(att.id)}
            className="absolute right-0 top-0 bg-white/80 text-nolme-neutral-800 text-xs px-1"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
