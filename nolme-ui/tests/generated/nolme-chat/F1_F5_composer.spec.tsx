/**
 * @gwt.id    gwt-nolme-composer, gwt-nolme-model-picker, gwt-nolme-stop-affordance
 * @rr.reads  rr.nolme.session_binding, rr.nolme.model_id
 * @rr.writes rr.nolme.session_binding_mutator
 * @rr.raises —
 *
 * NolmeComposer is the visible input field inside the larger prompt-input
 * container. It still receives the framework-supplied submission state
 * (`inputValue`/`onInputChange`/`onSubmitMessage`) and run lifecycle
 * props (`isRunning`/`onStop`) via CopilotKit's custom `chatView`.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';

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

describe('K1 · NolmeComposer container chrome (Figma 88:522)', () => {
  it('container matches the Figma field chrome at 784×100', () => {
    const { getByTestId } = render(
      <NolmeComposer
        inputValue=""
        onInputChange={vi.fn()}
        onSubmitMessage={vi.fn()}
        isRunning={false}
      />,
    );
    const container = getByTestId('nolme-composer');
    expect(container.className).toMatch(/w-\[784px\]/);
    expect(container.className).toMatch(/bg-\[\#f8f8fa\]/);
    expect(container.className).toMatch(/border-\[\#c8c8d6\]/);
    expect(container.className).toMatch(/rounded-\[8px\]/);
    expect(container.className).toMatch(/px-\[16px\]/);
    expect(container.className).toMatch(/pt-\[12px\]/);
    expect(container.className).toMatch(/pb-\[10px\]/);
    expect(container.className).toMatch(/h-\[100px\]/);
  });
});

describe('K2 · Textarea is controlled by inputValue/onInputChange', () => {
  it('renders inputValue and emits onInputChange on type', () => {
    const onInputChange = vi.fn();
    const { getByPlaceholderText } = render(
      <NolmeComposer
        inputValue="hi"
        onInputChange={onInputChange}
        onSubmitMessage={vi.fn()}
      />,
    );
    const ta = getByPlaceholderText('Type your response...') as HTMLTextAreaElement;
    expect(ta.value).toBe('hi');
    fireEvent.change(ta, { target: { value: 'hi!' } });
    expect(onInputChange).toHaveBeenCalledWith('hi!');
  });

  it('uses Satoshi 16/26 typography in the textarea', () => {
    const { getByPlaceholderText } = render(
      <NolmeComposer
        inputValue=""
        onInputChange={vi.fn()}
        onSubmitMessage={vi.fn()}
      />,
    );
    const ta = getByPlaceholderText('Type your response...');
    expect(ta.className).toMatch(/text-\[16px\]/);
    expect(ta.className).toMatch(/leading-\[26px\]/);
    expect(ta.className).toMatch(/font-\[Satoshi:Regular\]/);
  });
});

describe('S1 · Enter submits via onSubmitMessage and clears input', () => {
  it('Enter calls onSubmitMessage with trimmed value and clears via onInputChange', () => {
    const onSubmit = vi.fn();
    const onChange = vi.fn();
    const { getByPlaceholderText } = render(
      <NolmeComposer
        inputValue="hi there"
        onInputChange={onChange}
        onSubmitMessage={onSubmit}
      />,
    );
    fireEvent.keyDown(getByPlaceholderText('Type your response...'), { key: 'Enter' });
    expect(onSubmit).toHaveBeenCalledWith('hi there');
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('Enter with empty value does NOT submit', () => {
    const onSubmit = vi.fn();
    const { getByPlaceholderText } = render(
      <NolmeComposer
        inputValue="   "
        onInputChange={vi.fn()}
        onSubmitMessage={onSubmit}
      />,
    );
    fireEvent.keyDown(getByPlaceholderText('Type your response...'), { key: 'Enter' });
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe('S2 · Shift+Enter does NOT submit', () => {
  it('Shift+Enter inserts newline (no submit)', () => {
    const onSubmit = vi.fn();
    const { getByPlaceholderText } = render(
      <NolmeComposer
        inputValue="hi"
        onInputChange={vi.fn()}
        onSubmitMessage={onSubmit}
      />,
    );
    fireEvent.keyDown(getByPlaceholderText('Type your response...'), { key: 'Enter', shiftKey: true });
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe('F1 · Send status bar', () => {
  it('renders the model selector, token estimate, and disabled send button in the footer row', () => {
    const { getByTestId, getByText, getByLabelText, queryByLabelText } = render(
      <NolmeComposer
        inputValue=""
        onInputChange={vi.fn()}
        onSubmitMessage={vi.fn()}
      />,
    );

    expect(getByTestId('model-selector-pill')).toBeTruthy();
    expect(getByText('0 tokens (est)')).toBeTruthy();
    expect(getByLabelText('Send message')).toBeDisabled();
    expect(queryByLabelText('Add file')).toBeNull();
    expect(queryByLabelText('Voice input')).toBeNull();
  });

  it('clicking Send with text submits and clears via onInputChange', () => {
    const onSubmit = vi.fn();
    const onChange = vi.fn();
    const { getByLabelText } = render(
      <NolmeComposer
        inputValue="hi there"
        onInputChange={onChange}
        onSubmitMessage={onSubmit}
      />,
    );

    fireEvent.click(getByLabelText('Send message'));
    expect(onSubmit).toHaveBeenCalledWith('hi there');
    expect(onChange).toHaveBeenCalledWith('');
  });
});

describe('F2 · ModelSelectorPill styling and selection', () => {
  it('renders the compact 24px pill chrome', () => {
    const { getByTestId } = render(
      <NolmeComposer
        inputValue=""
        onInputChange={vi.fn()}
        onSubmitMessage={vi.fn()}
      />,
    );

    const pill = getByTestId('model-selector-pill');
    expect(pill.className).toMatch(/h-\[24px\]/);
    expect(pill.className).toMatch(/px-\[8px\]/);
    expect(pill.className).toMatch(/py-\[3px\]/);
    expect(pill.className).toMatch(/text-\[12px\]/);
    expect(pill.className).toMatch(/font-\[Satoshi:Medium\]/);
  });

  it('ModelSelectorPill standalone shows current model label and dispatches selection', () => {
    const { getByTestId, getByText } = render(<ModelSelectorPill />);
    expect(getByTestId('model-selector-pill').textContent).toContain('Opus');
    fireEvent.click(getByTestId('model-selector-pill'));
    fireEvent.click(getByText('Sonnet'));
    expect(updateBindingSpy).toHaveBeenCalledWith({ model: 'sonnet' });
    expect(locationAssignSpy).toHaveBeenCalledWith(expect.stringContaining('model=sonnet'));
  });
});

describe('R1 · Stop button visible when isRunning=true; clicking fires onStop', () => {
  it('shows Stop button and dispatches onStop on click', () => {
    const onStop = vi.fn();
    const { getByLabelText, queryByLabelText } = render(
      <NolmeComposer
        inputValue=""
        onInputChange={vi.fn()}
        onSubmitMessage={vi.fn()}
        onStop={onStop}
        isRunning={true}
      />,
    );
    fireEvent.click(getByLabelText('Stop run'));
    expect(onStop).toHaveBeenCalled();
    expect(queryByLabelText('Send message')).toBeNull();
  });
});

describe('R2 · Stop button hidden when isRunning=false', () => {
  it('does not render Stop button at idle', () => {
    const { queryByLabelText } = render(
      <NolmeComposer
        inputValue=""
        onInputChange={vi.fn()}
        onSubmitMessage={vi.fn()}
        onStop={vi.fn()}
        isRunning={false}
      />,
    );
    expect(queryByLabelText('Stop run')).toBeNull();
  });

  it('does not render Stop button when onStop is undefined even if isRunning=true', () => {
    const { queryByLabelText } = render(
      <NolmeComposer
        inputValue=""
        onInputChange={vi.fn()}
        onSubmitMessage={vi.fn()}
        isRunning={true}
      />,
    );
    expect(queryByLabelText('Stop run')).toBeNull();
  });
});
