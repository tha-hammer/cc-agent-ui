/**
 * @gwt.id    gwt-nolme-tool-call-routing
 * @rr.reads  —
 * @rr.writes rr.nolme.assistant_message
 * @rr.raises —
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';

const { renderToolSpy, humanInTheLoopSpy } = vi.hoisted(() => ({
  renderToolSpy: vi.fn(),
  humanInTheLoopSpy: vi.fn(),
}));

vi.mock('@copilotkit/react-core/v2', () => ({
  useRenderTool: (cfg: unknown) => renderToolSpy(cfg),
  useHumanInTheLoop: (cfg: unknown) => humanInTheLoopSpy(cfg),
}));

import { useNolmeRegistrations } from '../../../src/components/bindings/useNolmeRegistrations.v2';

function Harness() {
  useNolmeRegistrations();
  return null;
}

beforeEach(() => {
  renderToolSpy.mockReset();
  humanInTheLoopSpy.mockReset();
});

const SHOW_TOOLS = [
  'showVenueCard',
  'showLumaDraft',
  'showEmailPreview',
  'showPricingModel',
  'showSurveyPlan',
  'showThankYouEmail',
  'showReportingSheet',
  'showWorkflowBrief',
  'showWarmAudience',
];

describe('B2 · v2 tool-call routing — show* tools render OutputCardV2', () => {
  it('registers every show* tool name + a wildcard via useRenderTool', () => {
    render(<Harness />);
    const names = renderToolSpy.mock.calls.map((c) => (c[0] as { name: string }).name);
    for (const tool of SHOW_TOOLS) {
      expect(names).toContain(tool);
    }
    expect(names).toContain('*');
  });

  it('showVenueCard render({ args, status:"complete" }) returns OutputCardV2 with title + subtitle', () => {
    render(<Harness />);
    const cfg = renderToolSpy.mock.calls
      .map((c) => c[0] as { name: string; render: (p: unknown) => any })
      .find((c) => c.name === 'showVenueCard');
    expect(cfg).toBeDefined();
    const tree = cfg!.render({
      args: { title: 'Common Space', subtitle: 'Co-working venue', rating: 4.9 },
      status: 'complete',
    });
    expect(tree).toBeTruthy();
    expect(tree.props.title).toBe('Common Space');
    expect(tree.props.subtitle).toBe('Co-working venue');
    expect(tree.props.rating).toBe(4.9);
  });

  it('show* render returns empty fragment when status is not complete/inProgress', () => {
    render(<Harness />);
    const cfg = renderToolSpy.mock.calls
      .map((c) => c[0] as { name: string; render: (p: unknown) => any })
      .find((c) => c.name === 'showVenueCard');
    const tree = cfg!.render({ args: { title: 'x' }, status: 'pending' });
    expect(tree.props.children).toBeUndefined();
  });

  it('wildcard render produces ThinkingPillV2 only when status==="inProgress"', () => {
    render(<Harness />);
    const wildcard = renderToolSpy.mock.calls
      .map((c) => c[0] as { name: string; render: (p: unknown) => any })
      .find((c) => c.name === '*');
    expect(wildcard).toBeDefined();
    const inProgress = wildcard!.render({ name: 'showFoo', args: { label: 'Browsing...' }, status: 'inProgress' });
    expect(inProgress.props.label).toBe('Browsing...');

    const completed = wildcard!.render({ name: 'showFoo', args: { label: 'x' }, status: 'complete' });
    expect(completed.props.children).toBeUndefined();
  });

  it('registers approvePhase via useHumanInTheLoop', () => {
    render(<Harness />);
    expect(humanInTheLoopSpy).toHaveBeenCalled();
    const cfg = humanInTheLoopSpy.mock.calls[0][0] as { name: string };
    expect(cfg.name).toBe('approvePhase');
  });
});
