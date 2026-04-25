/**
 * @gwt.id    gwt-nolme-chat-mount, gwt-nolme-assistant-message, gwt-nolme-user-message, gwt-nolme-reasoning-absent
 * @rr.reads  rr.nolme.session_binding
 * @rr.writes rr.nolme.assistant_message, rr.nolme.user_message, rr.nolme.reasoning_message
 * @rr.raises —
 */
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';

const { CopilotChatSpy } = vi.hoisted(() => ({ CopilotChatSpy: vi.fn() }));

vi.mock('@copilotkit/react-core/v2', () => ({
  CopilotChat: (props: Record<string, unknown>) => {
    CopilotChatSpy(props);
    return <div data-testid="cpk-chat" />;
  },
  CopilotChatView: () => null,
  CopilotChatMessageView: () => null,
  CopilotChatInput: () => null,
  CopilotChatAssistantMessage: () => null,
  CopilotChatUserMessage: () => null,
  CopilotChatReasoningMessage: () => null,
  CopilotChatAttachmentRenderer: () => null,
  useAttachments: () => ({ attachments: [], enabled: true, consumeAttachments: () => [], handleDrop: vi.fn() }),
  useRenderTool: vi.fn(),
  useHumanInTheLoop: vi.fn(),
}));

vi.mock('@copilotkit/react-core', () => ({
  useCopilotChat: () => ({ appendMessage: vi.fn() }),
}));

import { NolmeChat } from '../../../src/components/NolmeChat';
import { NolmeAssistantMessage } from '../../../src/components/NolmeAssistantMessage';
import { NolmeUserMessage } from '../../../src/components/NolmeUserMessage';

describe('A1 · NolmeChat mount passes Nolme slots to CopilotChat', () => {
  it('forwards chatView=NolmeChatView (full layout override)', () => {
    CopilotChatSpy.mockReset();
    render(<NolmeChat threadId="s-1" projectName="proj" />);
    expect(CopilotChatSpy).toHaveBeenCalledTimes(1);
    const props = CopilotChatSpy.mock.calls[0][0] as Record<string, any>;
    expect(props.threadId).toBe('s-1');
    expect(props.hasExplicitThreadId).toBe(true);
    expect(props.messageView).toBeDefined();
    expect(props.messageView.assistantMessage).toBeDefined();
    expect(props.messageView.userMessage).toBeDefined();
    expect(props.messageView.reasoningMessage).toBeDefined();
    // Nolme owns the full visible chat layout via the chatView slot.
    expect(props.chatView).toBeDefined();
    expect(typeof props.chatView).toBe('function');
    // Anti-criterion: no per-slot input overrides — Nolme no longer touches
    // CopilotChatInput; the visible composer is rendered inside chatView.
    expect(props.input).toBeUndefined();
    expect(props.attachments?.enabled).toBe(true);
  });

  it('A2 · hasExplicitThreadId=true suppresses welcome', () => {
    CopilotChatSpy.mockReset();
    render(<NolmeChat threadId="s-1" projectName="proj" />);
    expect(CopilotChatSpy.mock.calls[0][0].hasExplicitThreadId).toBe(true);
  });

  it('D2 · reasoningMessage slot renders null (no reasoning-message in DOM)', () => {
    CopilotChatSpy.mockReset();
    render(<NolmeChat threadId="s-1" projectName="proj" />);
    const slot = CopilotChatSpy.mock.calls[0][0].messageView.reasoningMessage;
    expect(slot()).toBe(null);
  });
});

describe('B1 · NolmeAssistantMessage wraps markdown in Nolme typography', () => {
  it('uses the Figma assistant-card container and renders markdown content', () => {
    const renderMarkdown = vi.fn((content: string) => (
      <span data-testid="markdown-spy">{content}</span>
    ));
    const { getByTestId } = render(
      <NolmeAssistantMessage
        message={{ role: 'assistant', content: 'hello **world**' }}
        renderMarkdown={renderMarkdown}
      />,
    );
    const wrapper = getByTestId('nolme-assistant-message');
    expect(wrapper.className).toMatch(/bg-white/);
    expect(wrapper.className).toMatch(/rounded-\[16px\]/);
    expect(wrapper.className).toMatch(/p-\[24px\]/);
    expect(wrapper.className).toMatch(/w-\[816px\]/);
    expect(wrapper.className).toMatch(/max-w-full/);
    expect(wrapper.className).toMatch(/font-\[Satoshi:Regular\]/);
    expect(wrapper.className).toMatch(/text-\[16px\]/);
    expect(wrapper.className).toMatch(/leading-\[26px\]/);
    expect(renderMarkdown).toHaveBeenCalledWith('hello **world**');
    expect(getByTestId('markdown-spy').textContent).toBe('hello **world**');
  });

  it('B1 · does NOT render a toolbar child (toolbar slot overridden to null)', () => {
    const { container } = render(
      <NolmeAssistantMessage message={{ role: 'assistant', content: 'ok' }} />,
    );
    expect(container.querySelector('[data-testid="assistant-toolbar"]')).toBeNull();
  });
});

describe('B3 · Phase header styling', () => {
  it('renders phase header when metadata.phaseHeader is present', () => {
    const { getByTestId } = render(
      <NolmeAssistantMessage
        message={{
          role: 'assistant',
          content: 'body',
          metadata: { phaseHeader: { phase: 'Phase 1', task: 'Task 3', status: 'Ready to review' } },
        }}
      />,
    );
    const header = getByTestId('nolme-phase-header');
    expect(header.className).toMatch(/bg-nolme-neutral-100/);
    expect(header.className).toMatch(/rounded-t-\[24px\]/);
    expect(header.className).toMatch(/p-\[16px\]/);
    expect(header.textContent).toContain('Phase 1');
    expect(header.textContent).toContain('Task 3');
    expect(header.textContent).toContain('Ready to review');
  });

  it('does NOT render a phase header when metadata is absent', () => {
    const { container } = render(
      <NolmeAssistantMessage message={{ role: 'assistant', content: 'hello' }} />,
    );
    expect(container.querySelector('[data-testid="nolme-phase-header"]')).toBeNull();
  });
});

describe('C1 · NolmeUserMessage right-aligned bubble', () => {
  it('uses the Figma right-aligned bubble stack with 530px max width and asymmetric radius', () => {
    const { getByTestId } = render(
      <NolmeUserMessage message={{ role: 'user', content: 'hi' }} />,
    );
    const wrapper = getByTestId('nolme-user-message');
    expect(wrapper.className).toMatch(/w-full/);
    expect(wrapper.className).toMatch(/justify-end/);
    const stack = getByTestId('nolme-user-stack');
    expect(stack.className).toMatch(/flex-col/);
    expect(stack.className).toMatch(/gap-\[4px\]/);
    expect(stack.className).toMatch(/items-end/);
    expect(stack.className).toMatch(/max-w-\[530px\]/);
    expect(stack.className).toMatch(/min-w-\[160px\]/);
    const bubble = getByTestId('nolme-user-bubble');
    expect(bubble.className).toMatch(/bg-\[#e2e2ea\]/);
    expect(bubble.className).toMatch(/rounded-tl-\[12px\]/);
    expect(bubble.className).toMatch(/rounded-bl-\[12px\]/);
    expect(bubble.className).toMatch(/rounded-br-\[12px\]/);
    expect(bubble.className).toMatch(/rounded-tr-\[4px\]/);
    expect(bubble.className).toMatch(/px-\[16px\]/);
    expect(bubble.className).toMatch(/py-\[12px\]/);
    expect(bubble.className).toMatch(/font-\[Satoshi:Regular\]/);
    expect(bubble.className).toMatch(/text-\[16px\]/);
    expect(bubble.className).toMatch(/leading-\[26px\]/);
    expect(bubble.textContent).toBe('hi');
  });
});
