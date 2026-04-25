import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';

const { updateBindingSpy, locationAssignSpy } = vi.hoisted(() => ({
  updateBindingSpy: vi.fn(),
  locationAssignSpy: vi.fn(),
}));

const baseBinding = {
  provider: 'claude' as const,
  sessionId: 's-1',
  projectName: 'p',
  projectPath: '/x',
  model: 'opus',
};

vi.mock('../../../src/hooks/useCcuSessionState', () => ({
  useCcuSessionState: () => ({ binding: baseBinding, updateBinding: updateBindingSpy }),
}));

import { AgentProfileCardV2 } from '../../../src/components/AgentProfileCard.v2';
import { UsageCardV2 } from '../../../src/components/UsageCard.v2';
import { QuickActionChipRow } from '../../../src/components/QuickActionChipRow';
import { NolmeComposer } from '../../../src/components/NolmeComposer';
import { ModelSelectorPill } from '../../../src/components/ModelSelectorPill';

beforeEach(() => {
  updateBindingSpy.mockReset();
  locationAssignSpy.mockReset();
  Object.defineProperty(window, 'location', {
    value: { assign: locationAssignSpy, href: 'http://localhost/nolme/?sessionId=s-1', search: '?sessionId=s-1' },
    writable: true,
  });
});

describe('P14 · input-container component fidelity', () => {
  it('renders the agent details as a compact 24px avatar row instead of a bordered card', () => {
    const { container, getByText } = render(
      <AgentProfileCardV2
        profile={{
          name: 'Aria',
          role: 'Community Lead Specialist',
          avatarUrl: '/aria.png',
          skills: [],
          integrations: [],
        }}
      />,
    );

    const root = container.firstElementChild as HTMLElement;
    const img = container.querySelector('img');

    expect(root.className).not.toMatch(/\bborder\b/);
    expect(root.className).not.toMatch(/rounded-\[16px\]/);
    expect(root.className).not.toMatch(/w-\[292px\]/);
    expect(img?.className).toMatch(/h-\[24px\]/);
    expect(img?.className).toMatch(/w-\[24px\]/);
    expect(getByText('Aria • Community Lead Specialist').className).toMatch(/text-\[12px\]/);
    expect(getByText('Aria • Community Lead Specialist').className).toMatch(/text-nolme-neutral-500/);
  });

  it('renders usage as a compact 8px meter with inline "used" label instead of a separate card', () => {
    const { container, getByText, getByTestId } = render(<UsageCardV2 percent={82} />);
    const root = container.firstElementChild as HTMLElement;
    const rail = getByTestId('usage-rail');
    const fill = getByTestId('usage-fill');

    expect(root.className).not.toMatch(/\bborder\b/);
    expect(root.className).not.toMatch(/rounded-\[16px\]/);
    expect(getByText('82% used').className).toMatch(/text-\[11px\]/);
    expect(rail.className).toMatch(/h-\[8px\]/);
    expect(fill.className).toMatch(/h-\[8px\]/);
  });

  it('renders quick-action pills with the compact Figma purple-100 treatment', () => {
    const { getByText } = render(
      <QuickActionChipRow
        options={['Bring up any blockers', 'Do a pre audit', 'Start Phase 1']}
        onSelect={vi.fn()}
      />,
    );

    const pill = getByText('Bring up any blockers');

    expect(pill.className).toMatch(/bg-nolme-purple-100/);
    expect(pill.className).toMatch(/text-nolme-purple-900/);
    expect(pill.className).toMatch(/text-\[12px\]/);
    expect(pill.className).toMatch(/leading-\[16px\]/);
    expect(pill.className).toMatch(/tracking-\[0\.5px\]/);
    expect(pill.className).toMatch(/px-\[10px\]/);
    expect(pill.className).toMatch(/py-\[4px\]/);
    expect(pill.className).toMatch(/rounded-\[999px\]/);
    expect(pill.className).not.toMatch(/\bborder\b/);
  });

  it('renders the composer as a 784x100 Figma field with send status and without extra controls', () => {
    const { getByTestId, getByPlaceholderText, getByText, queryByLabelText } = render(
      <NolmeComposer
        inputValue=""
        onInputChange={vi.fn()}
        onSubmitMessage={vi.fn()}
      />,
    );

    const composer = getByTestId('nolme-composer');
    const textarea = getByPlaceholderText('Type your response...');

    expect(composer.className).toMatch(/w-\[784px\]/);
    expect(composer.className).toMatch(/h-\[100px\]/);
    expect(composer.className).toMatch(/rounded-\[8px\]/);
    expect(composer.className).toMatch(/border-\[\#c8c8d6\]/);
    expect(composer.className).toMatch(/bg-\[\#f8f8fa\]/);
    expect(textarea.className).toMatch(/text-\[16px\]/);
    expect(textarea.className).toMatch(/leading-\[26px\]/);
    expect(queryByLabelText('Add file')).toBeNull();
    expect(queryByLabelText('Voice input')).toBeNull();
    expect(getByText('0 tokens (est)')).toBeTruthy();
    expect(getByText('Send')).toBeTruthy();
  });

  it('renders the model selector pill with compact 24px Figma sizing and still updates the binding', () => {
    const { getByTestId, getByText } = render(<ModelSelectorPill />);
    const pill = getByTestId('model-selector-pill');

    expect(pill.className).toMatch(/h-\[24px\]/);
    expect(pill.className).toMatch(/px-\[8px\]/);
    expect(pill.className).toMatch(/py-\[3px\]/);
    expect(pill.className).toMatch(/text-\[12px\]/);
    expect(pill.className).toMatch(/font-\[Satoshi:Medium\]/);

    fireEvent.click(pill);
    fireEvent.click(getByText('Sonnet'));
    expect(updateBindingSpy).toHaveBeenCalledWith({ model: 'sonnet' });
    expect(locationAssignSpy).toHaveBeenCalledWith(expect.stringContaining('model=sonnet'));
  });
});
