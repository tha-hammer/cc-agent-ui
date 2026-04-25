import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';

vi.mock('@copilotkit/react-core/v2', () => ({
  CopilotChatMessageView: () => <div data-testid="message-view-stub" />,
}));

vi.mock('../../../src/components/NolmeComposer', () => ({
  NolmeComposer: () => <div data-testid="composer-stub" />,
}));

vi.mock('../../../src/components/bindings/AiWorkingInputContextClusterBound', () => ({
  AiWorkingInputContextClusterBound: () => <div data-testid="input-context-stub" />,
}));

vi.mock('../../../src/components/bindings/QuickActionChipRowBound', () => ({
  QuickActionChipRowBound: () => <div data-testid="quick-actions-stub" />,
}));

vi.mock('../../../src/components/bindings/AiResponseQuestionsCardBound', () => ({
  AiResponseQuestionsCardBound: () => <div data-testid="question-card-stub" />,
}));

vi.mock('../../../src/components/AgentNavRail.v2', () => ({
  AgentNavRailV2: () => <div data-testid="nav-rail-stub" />,
}));

vi.mock('../../../src/components/bindings/DeliverablesRailBound.v2', () => ({
  DeliverablesRailBoundV2: () => <div data-testid="deliverables-stub" />,
}));

vi.mock('../../../src/components/bindings/WorkflowPhaseBarBound.v2', () => ({
  WorkflowPhaseBarBoundV2: () => <div data-testid="phases-stub" />,
}));

vi.mock('../../../src/components/bindings/NolmeChatBound', () => ({
  NolmeChatBound: () => <div data-testid="chat-bound-stub" />,
}));

vi.mock('../../../src/components/bindings/useNolmeRegistrations.v2', () => ({
  useNolmeRegistrations: () => undefined,
}));

import { NolmeDashboardV2 } from '../../../src/components/NolmeDashboard.v2';
import { NolmeChatView } from '../../../src/components/NolmeChatView';

describe('P13 · input-container layout fidelity', () => {
  it('uses a 1008px conversation stream shell so the 816px input container can sit inside the wider Figma canvas', () => {
    const { container } = render(<NolmeDashboardV2 />);
    const chatShell = container.querySelector('main > div > div');

    expect(chatShell?.className).toMatch(/w-\[1008px\]/);
    expect(chatShell?.className).toMatch(/max-w-full/);
  });

  it('wraps the prompt utilities and composer in a single Figma-sized input container below any question card', () => {
    const { getByTestId } = render(
      <NolmeChatView
        messages={[]}
        inputValue=""
        onInputChange={vi.fn()}
        onSubmitMessage={vi.fn()}
        isRunning={false}
      />,
    );

    const inputZone = getByTestId('nolme-input-zone');
    const questionCard = getByTestId('question-card-stub');
    const inputContainer = getByTestId('nolme-input-container');
    const utilityBar = getByTestId('nolme-input-utility-bar');

    expect(inputZone).toContainElement(questionCard);
    expect(inputZone).toContainElement(inputContainer);
    expect(questionCard.compareDocumentPosition(inputContainer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    expect(inputContainer.className).toMatch(/w-\[816px\]/);
    expect(inputContainer.className).toMatch(/h-\[192px\]/);
    expect(inputContainer.className).toMatch(/rounded-\[16px\]/);
    expect(inputContainer.className).toMatch(/p-\[16px\]/);
    expect(inputContainer.className).toMatch(/bg-white/);
    expect(inputContainer.className).toMatch(/shadow-\[0_4px_8px_rgba\(0,0,0,0\.15\)\]/);
    expect(inputZone.className).toMatch(/items-center/);
    expect(inputZone.className).toMatch(/pb-\[40px\]/);

    expect(utilityBar).toContainElement(getByTestId('input-context-stub'));
    expect(utilityBar).toContainElement(getByTestId('quick-actions-stub'));
    expect(inputContainer).toContainElement(getByTestId('composer-stub'));
  });
});
