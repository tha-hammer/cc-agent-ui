import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';

vi.mock('../../src/components/main-content/view/subcomponents/MobileMenuButton', () => ({
  default: () => <div data-testid="mobile-menu-button" />,
}));

vi.mock('../../src/components/main-content/view/subcomponents/MainContentTabSwitcher', () => ({
  default: () => <div data-testid="tab-switcher" />,
}));

vi.mock('../../src/components/main-content/view/subcomponents/MainContentTitle', () => ({
  default: () => <div data-testid="main-content-title" />,
}));

import MainContentHeader from '../../src/components/main-content/view/subcomponents/MainContentHeader';

describe('MainContentHeader Nolme entry', () => {
  (globalThis as any).ResizeObserver = class {
    observe() {}
    disconnect() {}
  };

  const project = { name: 'proj', displayName: 'Project', fullPath: '/repo/proj' } as any;
  const session = { id: 'session-1', __provider: 'claude', summary: 'Hello' } as any;

  it('shows the Nolme entry when a concrete session is selected', () => {
    const onOpenNolme = vi.fn();
    const { getByRole } = render(
      <MainContentHeader
        activeTab="chat"
        setActiveTab={vi.fn()}
        selectedProject={project}
        selectedSession={session}
        shouldShowTasksTab={false}
        isMobile={false}
        onMenuClick={vi.fn()}
        onOpenNolme={onOpenNolme}
      />,
    );

    fireEvent.click(getByRole('button', { name: /open in nolme/i }));
    expect(onOpenNolme).toHaveBeenCalledTimes(1);
  });

  it('hides the Nolme entry when no session is selected', () => {
    const { queryByRole } = render(
      <MainContentHeader
        activeTab="chat"
        setActiveTab={vi.fn()}
        selectedProject={project}
        selectedSession={null}
        shouldShowTasksTab={false}
        isMobile={false}
        onMenuClick={vi.fn()}
        onOpenNolme={vi.fn()}
      />,
    );

    expect(queryByRole('button', { name: /open in nolme/i })).toBeNull();
  });
});
