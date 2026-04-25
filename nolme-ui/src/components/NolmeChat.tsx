import { CopilotChat } from '@copilotkit/react-core/v2';
import type { AttachmentsConfig } from '@copilotkit/shared';
import { NolmeAssistantMessage } from './NolmeAssistantMessage';
import { NolmeUserMessage } from './NolmeUserMessage';
import { NolmeChatView } from './NolmeChatView';
import { makeV2OnUpload } from './bindings/useNolmeAttachmentsSubmit';

export interface NolmeChatProps {
  threadId: string;
  projectName: string;
}

const NolmeReasoningMessageSuppressed = () => null;

// CopilotKit v2's slot types (`SlotValue<typeof CopilotChatAssistantMessage>`)
// require static sub-components (MarkdownRenderer, Toolbar, ...). Our parallel
// Nolme components are plain function components — the runtime accepts them as
// slot overrides but the type system requires the cast. Tracked in cam-jhm.
type CopilotChatLoose = (props: Record<string, unknown>) => JSX.Element;
const CopilotChatLoose = CopilotChat as unknown as CopilotChatLoose;

export function NolmeChat({ threadId, projectName }: NolmeChatProps) {
  const attachmentsConfig: AttachmentsConfig = {
    enabled: true,
    onUpload: makeV2OnUpload(projectName),
    accept: 'image/*',
    maxSize: 5 * 1024 * 1024,
  };

  return (
    <section data-testid="nolme-chat" className="flex flex-1 flex-col min-h-0 overflow-hidden">
      <CopilotChatLoose
        threadId={threadId}
        hasExplicitThreadId={true}
        chatView={NolmeChatView}
        messageView={{
          assistantMessage: NolmeAssistantMessage,
          userMessage: NolmeUserMessage,
          reasoningMessage: NolmeReasoningMessageSuppressed,
        }}
        attachments={attachmentsConfig}
      />
    </section>
  );
}
