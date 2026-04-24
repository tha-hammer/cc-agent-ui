import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';

/* --------------------------- hook spies --------------------------------- */

const {
  useFrontendToolSpy,
  useHumanInTheLoopSpy,
  useRenderToolCallSpy,
  useCoAgentSpy,
  useCopilotChatSuggestionsSpy,
  appendMessageSpy,
  coAgentStateRef,
} = vi.hoisted(() => ({
  useFrontendToolSpy: vi.fn(),
  useHumanInTheLoopSpy: vi.fn(),
  useRenderToolCallSpy: vi.fn(),
  useCoAgentSpy: vi.fn(),
  useCopilotChatSuggestionsSpy: vi.fn(),
  appendMessageSpy: vi.fn(),
  coAgentStateRef: { current: null as unknown },
}));

vi.mock('@copilotkit/react-core', () => ({
  useFrontendTool: (cfg: unknown) => { useFrontendToolSpy(cfg); },
  useHumanInTheLoop: (cfg: unknown) => { useHumanInTheLoopSpy(cfg); },
  useRenderToolCall: (cfg: unknown) => { useRenderToolCallSpy(cfg); },
  useCoAgent: (cfg: unknown) => {
    useCoAgentSpy(cfg);
    return { state: coAgentStateRef.current };
  },
  useCopilotChat: () => ({ appendMessage: appendMessageSpy }),
  useCopilotChatSuggestions: (cfg: unknown, deps: unknown) => useCopilotChatSuggestionsSpy(cfg, deps),
}));

import { NolmeDashboard } from '../../src/components/NolmeDashboard';
import { WorkflowPhaseBarBound } from '../../src/components/bindings/WorkflowPhaseBarBound';
import { ResourcesRailBound } from '../../src/components/bindings/ResourcesRailBound';
import { AgentProfileCardBound } from '../../src/components/bindings/AgentProfileCardBound';
import { QuickActionChipRowBound } from '../../src/components/bindings/QuickActionChipRowBound';
import { DEFAULT_NOLME_AGENT_STATE, type NolmeAgentState } from '../../src/lib/types';

function setState(partial: Partial<NolmeAgentState>) {
  coAgentStateRef.current = { ...DEFAULT_NOLME_AGENT_STATE, ...partial };
}

beforeEach(() => {
  useFrontendToolSpy.mockReset();
  useHumanInTheLoopSpy.mockReset();
  useRenderToolCallSpy.mockReset();
  useCoAgentSpy.mockReset();
  useCopilotChatSuggestionsSpy.mockReset();
  appendMessageSpy.mockReset();
  coAgentStateRef.current = null;
});

/* --------------------------- B25 wildcard thinking pill ------------------ */

describe('Phase 5 · B25 wildcard thinking pill', () => {
  it('registers useRenderToolCall with name "*"', () => {
    setState({});
    render(<NolmeDashboard />);
    expect(useRenderToolCallSpy).toHaveBeenCalledTimes(1);
    const cfg = useRenderToolCallSpy.mock.calls[0][0] as { name: string };
    expect(cfg.name).toBe('*');
  });
});

/* --------------------------- B26 output-card tools ----------------------- */

describe('Phase 5 · B26 output-card tool registrations', () => {
  it('registers every known show* tool with useFrontendTool', () => {
    setState({});
    render(<NolmeDashboard />);
    const names = useFrontendToolSpy.mock.calls.map((c) => (c[0] as { name: string }).name);
    expect(names).toEqual(expect.arrayContaining([
      'showVenueCard',
      'showLumaDraft',
      'showEmailPreview',
      'showPricingModel',
      'showSurveyPlan',
      'showThankYouEmail',
      'showReportingSheet',
      'showWorkflowBrief',
      'showWarmAudience',
    ]));
  });
});

/* --------------------------- B27 approvePhase HITL ----------------------- */

describe('Phase 5 · B27 approvePhase human-in-the-loop', () => {
  it('registers useHumanInTheLoop with name "approvePhase"', () => {
    setState({});
    render(<NolmeDashboard />);
    expect(useHumanInTheLoopSpy).toHaveBeenCalled();
    const names = useHumanInTheLoopSpy.mock.calls.map((c) => (c[0] as { name: string }).name);
    expect(names).toContain('approvePhase');
  });

  it('HITL render returns <ApprovalChipRow> that calls respond on click', () => {
    setState({});
    render(<NolmeDashboard />);
    const cfg = useHumanInTheLoopSpy.mock.calls[0][0] as { render: (p: any) => any };
    const respond = vi.fn();
    const element = cfg.render({
      args: { options: ['Confirm', 'Revise'] },
      respond,
      status: 'executing',
    });
    const { getByText } = render(element);
    fireEvent.click(getByText('Confirm'));
    expect(respond).toHaveBeenCalledWith('Confirm');
  });
});

/* --------------------------- B28 useCoAgent state bindings --------------- */

describe('Phase 5 · B28 useCoAgent state binding', () => {
  it('WorkflowPhaseBarBound reads phases from agent.state', () => {
    setState({
      phases: [{ id: 'p1', label: 'Phase 1', title: 'Audience & venue', status: 'active' }],
      currentReviewLine: 'reviewing',
    });
    const { container } = render(<WorkflowPhaseBarBound />);
    expect(container.textContent).toContain('Audience & venue');
    expect(container.textContent).toContain('reviewing');
    expect(useCoAgentSpy).toHaveBeenCalledWith(expect.objectContaining({ name: 'ccu' }));
  });

  it('ResourcesRailBound reads resources from agent.state', () => {
    setState({
      resources: [{
        id: 'r1', badge: 'P1', title: 'Brief', subtitle: 'Doc',
        tone: 'emerald', action: 'download',
      }],
    });
    const { container } = render(<ResourcesRailBound />);
    expect(container.textContent).toContain('Brief');
  });

  it('AgentProfileCardBound returns null when no profile is set', () => {
    setState({ profile: null });
    const { container } = render(<AgentProfileCardBound />);
    expect(container.firstChild).toBeNull();
  });

  it('AgentProfileCardBound renders the profile when agent.state.profile is set', () => {
    setState({
      profile: {
        name: 'Aria',
        role: 'Community Lead',
        skills: ['Events'],
        integrations: ['luma'],
      },
    });
    const { container } = render(<AgentProfileCardBound />);
    expect(container.textContent).toContain('Aria');
    expect(container.textContent).toContain('Community Lead');
  });
});

/* --------------------------- B29 quick-action suggestions --------------- */

describe('Phase 5 · B29 useCopilotChatSuggestions', () => {
  it('registers with agent.state-derived deps and renders chips from state.quickActions', () => {
    setState({
      currentPhaseIndex: 1,
      quickActions: ['Draft brief', 'Summarize audience'],
    });
    const { getByText } = render(<QuickActionChipRowBound />);
    expect(useCopilotChatSuggestionsSpy).toHaveBeenCalled();
    expect(getByText('Draft brief')).toBeInTheDocument();
    expect(getByText('Summarize audience')).toBeInTheDocument();
  });

  it('chip click appends a message via useCopilotChat', () => {
    setState({ quickActions: ['Draft brief'] });
    const { getByText } = render(<QuickActionChipRowBound />);
    fireEvent.click(getByText('Draft brief'));
    expect(appendMessageSpy).toHaveBeenCalled();
    const arg = appendMessageSpy.mock.calls[0][0] as { role: string; content: string };
    expect(arg.role).toBe('user');
    expect(arg.content).toBe('Draft brief');
  });
});
