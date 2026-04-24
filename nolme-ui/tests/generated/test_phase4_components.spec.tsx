import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';

import { AgentNavRail } from '../../src/components/AgentNavRail';
import { WorkflowPhaseBar } from '../../src/components/WorkflowPhaseBar';
import { OutputCard } from '../../src/components/OutputCard';
import { ThinkingPill } from '../../src/components/ThinkingPill';
import { ApprovalChipRow } from '../../src/components/ApprovalChipRow';
import { QuickActionChipRow } from '../../src/components/QuickActionChipRow';
import { AgentProfileCard } from '../../src/components/AgentProfileCard';
import { SkillChips } from '../../src/components/SkillChips';
import { IntegrationsRow } from '../../src/components/IntegrationsRow';
import { ResourcesRail } from '../../src/components/ResourcesRail';

import type { NolmeAgentProfile, NolmePhase, NolmeResource } from '../../src/lib/types';

/* -------------------------- B18 AgentNavRail ----------------------------- */

describe('AgentNavRail (Phase 4 · B18)', () => {
  it('renders 5 nav buttons + N logo + avatar initials', () => {
    const { container, getByText } = render(<AgentNavRail activeIcon="messages" avatarInitials="MJ" />);
    const buttons = container.querySelectorAll('button');
    expect(buttons).toHaveLength(5);
    expect(container.textContent).toContain('N');
    expect(getByText('MJ')).toBeInTheDocument();
  });

  it('marks the active icon button with aria-current="page"', () => {
    const { container } = render(<AgentNavRail activeIcon="home" />);
    const active = container.querySelector('[aria-current="page"]');
    expect(active).not.toBeNull();
    expect(active?.getAttribute('aria-label')).toBe('home');
  });
});

/* ---------------------- B19 WorkflowPhaseBar ----------------------------- */

const phases: NolmePhase[] = [
  { id: 'p1', label: 'Phase 1', title: 'Audience & venue', status: 'complete' },
  { id: 'p2', label: 'Phase 2', title: 'Promote & sell', status: 'active' },
  { id: 'p3', label: 'Phase 3', title: 'Post-event', status: 'idle' },
];

describe('WorkflowPhaseBar (Phase 4 · B19)', () => {
  it('renders one card per phase', () => {
    const { container } = render(<WorkflowPhaseBar phases={phases} currentReviewLine="x" />);
    const cards = container.querySelectorAll('[data-phase-status]');
    expect(cards).toHaveLength(3);
  });

  it('marks the active phase with aria-current="step" and "Active" pill', () => {
    const { container, getByText } = render(<WorkflowPhaseBar phases={phases} currentReviewLine="reviewing" />);
    const active = container.querySelector('[aria-current="step"]');
    expect(active?.getAttribute('data-phase-status')).toBe('active');
    expect(getByText('Active')).toBeInTheDocument();
  });

  it('shows a "Done" pill for complete phases', () => {
    const { getByText } = render(<WorkflowPhaseBar phases={phases} />);
    expect(getByText('Done')).toBeInTheDocument();
  });

  it('shows the reviewing line when provided', () => {
    const { container } = render(<WorkflowPhaseBar phases={phases} currentReviewLine="Reviewing task 3" />);
    expect(container.textContent).toContain('Reviewing task 3');
  });

  it('renders Edit button when onEdit is provided and invokes it', () => {
    const onEdit = vi.fn();
    const { getByText } = render(<WorkflowPhaseBar phases={phases} onEdit={onEdit} />);
    fireEvent.click(getByText('Edit'));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });
});

/* -------------------------- B20 OutputCard ------------------------------- */

describe('OutputCard (Phase 4 · B20)', () => {
  it('renders title + subtitle', () => {
    const { container } = render(<OutputCard title="Common Space" subtitle="3108B Filmore St" />);
    expect(container.textContent).toContain('Common Space');
    expect(container.textContent).toContain('3108B Filmore St');
  });

  it('renders rating with 5 stars when rating is a number', () => {
    const { container } = render(<OutputCard title="Venue" subtitle="Addr" rating={4.9} />);
    expect(container.textContent).toContain('4.9');
    const stars = container.querySelectorAll('[aria-label^="rating"] svg');
    expect(stars.length).toBe(5);
  });

  it('does not render a rating row when rating is undefined', () => {
    const { container } = render(<OutputCard title="t" subtitle="s" />);
    expect(container.querySelector('[aria-label^="rating"]')).toBeNull();
  });

  it('applies amber tone classes', () => {
    const { container } = render(<OutputCard title="t" subtitle="s" tone="amber" />);
    expect(container.querySelector('article')?.className).toMatch(/bg-nolme-amber-100/);
  });
});

/* -------------------------- B21 ThinkingPill ----------------------------- */

describe('ThinkingPill (Phase 4 · B21)', () => {
  it('renders the amber pill with the N badge and label', () => {
    const { container, getByText } = render(<ThinkingPill label="Browsing all locations..." />);
    expect(container.querySelector('[data-component="nolme-thinking-pill"]')).not.toBeNull();
    expect(getByText('Browsing all locations...')).toBeInTheDocument();
    expect(container.textContent).toContain('N');
  });

  it('has aria-live="polite" for screen readers', () => {
    const { container } = render(<ThinkingPill label="x" />);
    expect(container.querySelector('[aria-live="polite"]')).not.toBeNull();
  });
});

/* -------------------------- B22 ApprovalChipRow -------------------------- */

describe('ApprovalChipRow (Phase 4 · B22)', () => {
  it('renders nothing when options is empty', () => {
    const { container } = render(<ApprovalChipRow options={[]} onSelect={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders one button per option and fires onSelect with the label', () => {
    const onSelect = vi.fn();
    const { getByText } = render(
      <ApprovalChipRow options={['Confirm Phase 3 👍', 'Make changes']} onSelect={onSelect} />,
    );
    fireEvent.click(getByText('Confirm Phase 3 👍'));
    expect(onSelect).toHaveBeenCalledWith('Confirm Phase 3 👍');
  });

  it('renders an "Ask question" amber pill when provided', () => {
    const onAsk = vi.fn();
    const { getByText } = render(
      <ApprovalChipRow
        options={['a']}
        onSelect={() => {}}
        askQuestionLabel="Ask question while working"
        onAskQuestion={onAsk}
      />,
    );
    fireEvent.click(getByText('Ask question while working'));
    expect(onAsk).toHaveBeenCalledTimes(1);
  });

  it('disables buttons when disabled=true', () => {
    const { container } = render(<ApprovalChipRow options={['a']} onSelect={() => {}} disabled />);
    const btn = container.querySelector('button');
    expect(btn).toBeDisabled();
  });
});

/* ------------------------- B23 QuickActionChipRow ------------------------ */

describe('QuickActionChipRow (Phase 4 · B23)', () => {
  it('renders nothing when options is empty', () => {
    const { container } = render(<QuickActionChipRow options={[]} onSelect={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it('fires onSelect with the chip label when clicked', () => {
    const onSelect = vi.fn();
    const { getByText } = render(
      <QuickActionChipRow options={['Draft brief', 'Summarize audience']} onSelect={onSelect} />,
    );
    fireEvent.click(getByText('Summarize audience'));
    expect(onSelect).toHaveBeenCalledWith('Summarize audience');
  });
});

/* -------------------- B24 Rail components (profile, skills, etc) --------- */

const ariaProfile: NolmeAgentProfile = {
  name: 'Aria',
  role: 'Community Lead',
  skills: ['Deep research', 'Events'],
  integrations: ['luma', 'gmail'],
  usageValue: 24,
};

describe('AgentProfileCard (Phase 4 · B24)', () => {
  it('renders name, role, JD + Guidelines buttons', () => {
    const jd = vi.fn();
    const gl = vi.fn();
    const { getByText } = render(
      <AgentProfileCard profile={ariaProfile} onOpenJobDescription={jd} onOpenGuidelines={gl} />,
    );
    expect(getByText('Aria')).toBeInTheDocument();
    expect(getByText('Community Lead')).toBeInTheDocument();
    fireEvent.click(getByText('Job Description'));
    fireEvent.click(getByText('Guidelines'));
    expect(jd).toHaveBeenCalledTimes(1);
    expect(gl).toHaveBeenCalledTimes(1);
  });

  it('renders the usage ring when usageValue is set', () => {
    const { container } = render(<AgentProfileCard profile={ariaProfile} />);
    expect(container.querySelector('[aria-label="Usage 24%"]')).not.toBeNull();
  });
});

describe('SkillChips (Phase 4 · B24)', () => {
  it('renders one chip per skill', () => {
    const { getByText } = render(<SkillChips skills={['Marketing', 'Events']} />);
    expect(getByText('Marketing')).toBeInTheDocument();
    expect(getByText('Events')).toBeInTheDocument();
  });
  it('renders an add button when onAdd is provided', () => {
    const onAdd = vi.fn();
    const { getByLabelText } = render(<SkillChips skills={['x']} onAdd={onAdd} />);
    fireEvent.click(getByLabelText('Add skill'));
    expect(onAdd).toHaveBeenCalledTimes(1);
  });
});

describe('IntegrationsRow (Phase 4 · B24)', () => {
  it('renders one slot per known integration', () => {
    const { container } = render(<IntegrationsRow integrations={['luma', 'gmail', 'linear']} />);
    const slots = container.querySelectorAll('[data-integration]');
    expect(slots).toHaveLength(3);
  });
  it('renders fallback initials for unknown integration keys', () => {
    const { container } = render(<IntegrationsRow integrations={['novel-tool']} />);
    expect(container.textContent).toContain('NO'); // first two chars uppercased
  });
});

const sampleResources: NolmeResource[] = [
  {
    id: 'r1',
    badge: 'P1',
    title: 'Workflow brief',
    subtitle: 'Google Document',
    tone: 'emerald',
    action: 'download',
  },
  {
    id: 'r2',
    badge: 'P2',
    title: 'Venue matches',
    subtitle: 'Luma • 3 locations',
    tone: 'iris',
    action: 'link',
  },
];

describe('ResourcesRail (Phase 4 · B24)', () => {
  it('renders empty-state message when resources is empty', () => {
    const { container } = render(<ResourcesRail resources={[]} />);
    expect(container.textContent).toContain('Resources appear here');
  });
  it('renders one card per resource with badge and correct action icon', () => {
    const { container } = render(<ResourcesRail resources={sampleResources} />);
    expect(container.textContent).toContain('P1');
    expect(container.textContent).toContain('P2');
    expect(container.querySelector('[aria-label="download"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="link"]')).not.toBeNull();
  });
});
