import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';

vi.mock('@copilotkit/react-core/v2', () => ({
  CopilotChatMessageView: () => <div data-testid="message-view-stub" />,
}));

vi.mock('../../../src/components/NolmeComposer', () => ({
  NolmeComposer: () => <div data-testid="composer-stub" />,
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

vi.mock('../../../src/components/bindings/AiWorkingInputContextClusterBound', () => ({
  AiWorkingInputContextClusterBound: () => <div data-testid="input-context-stub" />,
}));

import { NolmeDashboardV2 } from '../../../src/components/NolmeDashboard.v2';
import { NolmeChatView } from '../../../src/components/NolmeChatView';

describe('P11 · independent Nolme chat scroll', () => {
  it('clamps the dashboard to the viewport and prevents page-level overflow from chat growth', () => {
    const { getByTestId, container } = render(<NolmeDashboardV2 />);

    const root = getByTestId('nolme-dashboard-v2');
    const main = container.querySelector('main');
    const aside = container.querySelector('aside');

    expect(root.className).toMatch(/\bh-dvh\b/);
    expect(root.className).toMatch(/\boverflow-hidden\b/);
    expect(main?.className).toMatch(/\bmin-h-0\b/);
    expect(main?.className).toMatch(/\boverflow-hidden\b/);
    expect(aside?.className).toMatch(/\bmin-h-0\b/);
    expect(aside?.className).toMatch(/\boverflow-y-auto\b/);
  });

  it('uses a dedicated history scroll container and keeps the input zone fixed below it', () => {
    const { getByTestId } = render(
      <NolmeChatView
        messages={[
          { id: 'm1', role: 'assistant', content: 'one' },
          { id: 'm2', role: 'assistant', content: 'two' },
        ] as any}
        inputValue=""
        onInputChange={vi.fn()}
        onSubmitMessage={vi.fn()}
        isRunning={false}
      />,
    );

    const chatView = getByTestId('nolme-chat-view');
    const historyScroll = getByTestId('nolme-history-scroll');
    const inputZone = getByTestId('nolme-input-zone');

    expect(chatView.className).toMatch(/\boverflow-hidden\b/);
    expect(historyScroll.className).toMatch(/\boverflow-y-auto\b/);
    expect(historyScroll.className).toMatch(/\bflex-1\b/);
    expect(inputZone.className).toMatch(/\bshrink-0\b/);
  });
});
