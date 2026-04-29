import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import NolmeAppRoute from '../../src/components/nolme-app/view/NolmeAppRoute';

describe('NolmeAppRoute', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the full Figma shell for the authenticated /app surface', () => {
    render(<NolmeAppRoute />);

    expect(screen.getByLabelText('Nolme app navigation')).toBeInTheDocument();
    expect(screen.getByRole('main', { name: /nolme chat stream/i })).toBeInTheDocument();
    expect(screen.getByLabelText('Phases and deliverables')).toBeInTheDocument();
    expect(screen.getByText(/Populated questions to ensure properly taking on task/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /bring up any blockers/i })).toBeInTheDocument();
  });

  it('moves through the question, working, and artifact views', () => {
    render(<NolmeAppRoute />);

    fireEvent.click(screen.getByRole('button', { name: /bring up any blockers/i }));
    expect(screen.getByRole('region', { name: /clarifying question/i })).toBeInTheDocument();
    expect(screen.getByText(/How much distance outside the Bay Area/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(screen.getByText(/Gathering people in a 15 mile radius/i)).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(screen.getByText(/Venues selected on Luma account and ready to review/i)).toBeInTheDocument();
    expect(screen.getByText('Luma - Curated venue list')).toBeInTheDocument();
  });
});
