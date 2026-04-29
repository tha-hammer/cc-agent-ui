import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ContextUsageBar from '../../src/components/chat/view/subcomponents/ContextUsageBar';

describe('ContextUsageBar', () => {
  it('renders used context as a horizontal bar with percentage text', () => {
    render(<ContextUsageBar tokenBudget={{ used: 50_000, total: 200_000 }} provider="claude" model="sonnet" />);

    expect(screen.getByLabelText('Context used 25%')).toBeInTheDocument();
    expect(screen.getByText('25%')).toBeInTheDocument();
  });

  it('falls back to the selected model context window when total is absent', () => {
    render(<ContextUsageBar tokenBudget={{ used: 250_000 }} provider="claude" model="sonnet[1m]" />);

    expect(screen.getByLabelText('Context used 25%')).toHaveAttribute(
      'title',
      '250,000 / 1,000,000 tokens',
    );
  });
});
