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

vi.mock('../../../src/components/bindings/AgentProfileCardBound.v2', () => ({
  AgentProfileCardBoundV2: () => <div data-testid="profile-stub" />,
}));

vi.mock('../../../src/components/bindings/UsageCardBound.v2', () => ({
  UsageCardBoundV2: () => <div data-testid="usage-stub" />,
}));

vi.mock('../../../src/components/bindings/DeliverablesRailBound.v2', () => ({
  DeliverablesRailBoundV2: () => <div data-testid="deliverables-stub" />,
}));

vi.mock('../../../src/components/bindings/SkillChipsBound', () => ({
  SkillChipsBound: () => <div data-testid="skills-stub" />,
}));

vi.mock('../../../src/components/bindings/IntegrationsRowBound', () => ({
  IntegrationsRowBound: () => <div data-testid="integrations-stub" />,
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

import { NolmeChatView } from '../../../src/components/NolmeChatView';
import { NolmeDashboardV2 } from '../../../src/components/NolmeDashboard.v2';

describe('P7 · ai-working layout placement', () => {
  it('renders the question card inside the chat input zone above the quick-action row and composer', () => {
    const { getByTestId } = render(
      <NolmeChatView
        messages={[]}
        inputValue=""
        onInputChange={vi.fn()}
        onSubmitMessage={vi.fn()}
        isRunning={false}
      />,
    );

    const questionCard = getByTestId('question-card-stub');
    const quickActions = getByTestId('quick-actions-stub');
    const composer = getByTestId('composer-stub');

    expect(getByTestId('nolme-input-zone')).toContainElement(questionCard);
    expect(questionCard.compareDocumentPosition(quickActions) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(questionCard.compareDocumentPosition(composer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('renders quick actions inside the chat input zone above the composer', () => {
    const { getByTestId } = render(
      <NolmeChatView
        messages={[]}
        inputValue=""
        onInputChange={vi.fn()}
        onSubmitMessage={vi.fn()}
        isRunning={false}
      />,
    );

    const quickActions = getByTestId('quick-actions-stub');
    const composer = getByTestId('composer-stub');

    expect(getByTestId('nolme-chat-view')).toContainElement(quickActions);
    expect(quickActions.compareDocumentPosition(composer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('does not render a dashboard-level quick-action row outside the chat view', () => {
    const { queryByTestId } = render(<NolmeDashboardV2 />);

    expect(queryByTestId('quick-actions-stub')).toBeNull();
  });

  it('renders workflow phases in the right rail alongside deliverables', () => {
    const { container, getByTestId } = render(<NolmeDashboardV2 />);
    const aside = container.querySelector('aside');

    expect(aside).toContainElement(getByTestId('phases-stub'));
    expect(aside).toContainElement(getByTestId('deliverables-stub'));
  });

  it('renders the compact operator utility cluster in the input container, not the right rail', () => {
    const { container: dashboardContainer, queryByTestId } = render(<NolmeDashboardV2 />);
    const aside = dashboardContainer.querySelector('aside');

    expect(aside).not.toContainElement(queryByTestId('profile-stub'));
    expect(aside).not.toContainElement(queryByTestId('usage-stub'));

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
    const inputContainer = getByTestId('nolme-input-container');
    const utilityBar = getByTestId('nolme-input-utility-bar');

    expect(inputZone).toContainElement(inputContainer);
    expect(utilityBar).toContainElement(getByTestId('profile-stub'));
    expect(utilityBar).toContainElement(getByTestId('usage-stub'));
  });
});
