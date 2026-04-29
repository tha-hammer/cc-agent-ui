import { fireEvent, render, screen, waitFor, act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import NolmeAppRoute from '../../src/components/nolme-app/view/NolmeAppRoute';

const {
  projectsSpy,
  skillsSpy,
  algorithmRunStateSpy,
  algorithmRunEventsUrlSpy,
  searchConversationsUrlSpy,
  startAlgorithmRunSpy,
  authenticatedFetchSpy,
} = vi.hoisted(() => ({
  projectsSpy: vi.fn(),
  skillsSpy: vi.fn(),
  algorithmRunStateSpy: vi.fn(),
  algorithmRunEventsUrlSpy: vi.fn(),
  searchConversationsUrlSpy: vi.fn(),
  startAlgorithmRunSpy: vi.fn(),
  authenticatedFetchSpy: vi.fn(),
}));

function jsonResponse(body: unknown, ok = true) {
  return Promise.resolve({
    ok,
    json: async () => body,
  });
}

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  url: string;
  closed = false;
  listeners = new Map<string, Array<(event: { data: string }) => void>>();

  constructor(url: string) {
    this.url = url;
    FakeEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: (event: { data: string }) => void) {
    const listeners = this.listeners.get(type) || [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  close() {
    this.closed = true;
  }

  emit(type: string, payload: unknown = {}) {
    for (const listener of this.listeners.get(type) || []) {
      listener({ data: JSON.stringify(payload) });
    }
  }
}

vi.mock('../../src/utils/api', () => ({
  api: {
    projects: projectsSpy,
    skills: skillsSpy,
    algorithmRunState: algorithmRunStateSpy,
    algorithmRunEventsUrl: algorithmRunEventsUrlSpy,
    searchConversationsUrl: searchConversationsUrlSpy,
    startAlgorithmRun: startAlgorithmRunSpy,
  },
  authenticatedFetch: authenticatedFetchSpy,
}));

vi.mock('../../src/components/settings/view/Settings', () => ({
  default: ({ isOpen }: { isOpen: boolean }) => (isOpen ? <div role="dialog">Settings panel</div> : null),
}));

describe('NolmeAppRoute', () => {
  beforeEach(() => {
    localStorage.clear();
    FakeEventSource.instances = [];
    (globalThis as any).EventSource = FakeEventSource;
    (window as any).EventSource = FakeEventSource;

    projectsSpy.mockReset().mockReturnValue(jsonResponse([
      { name: 'demo-project', displayName: 'Demo Project', path: '/workspace/demo-project' },
    ]));
    skillsSpy.mockReset().mockReturnValue(jsonResponse({
      skills: [
        {
          id: 'codex:research-codebase',
          name: 'research-codebase',
          description: 'Trace code paths and produce a grounded research document.',
          path: '/home/maceo/.codex/skills/research-codebase/SKILL.md',
          relativePath: 'research-codebase/SKILL.md',
          source: 'codex',
        },
      ],
    }));
    algorithmRunStateSpy.mockReset().mockReturnValue(jsonResponse({ state: null }));
    algorithmRunEventsUrlSpy.mockReset().mockReturnValue('/api/algorithm-runs/alg_1/events?after=0&stream=1');
    searchConversationsUrlSpy.mockReset().mockImplementation((query: string) => `/api/search/conversations?q=${encodeURIComponent(query)}`);
    startAlgorithmRunSpy.mockReset().mockReturnValue(jsonResponse({
      ok: true,
      run: {
        runId: 'alg_1',
        provider: 'claude',
        status: 'running',
        eventCursor: { sequence: 1 },
        phases: [
          { id: 'research', label: 'P1', title: 'Research', status: 'complete' },
          { id: 'implement', label: 'P2', title: 'Implement', status: 'active' },
        ],
        currentPhaseIndex: 1,
        currentReviewLine: 'Wiring live data into /app.',
        deliverables: [
          { id: 'summary', title: 'Run summary', subtitle: 'Markdown artifact', tone: 'document' },
        ],
      },
    }));
    authenticatedFetchSpy.mockReset();
  });

  it('renders the /app shell without the old hard-coded Figma demo data', () => {
    render(<NolmeAppRoute />);

    expect(screen.getByLabelText('Nolme app navigation')).toBeInTheDocument();
    expect(screen.getByRole('main', { name: /nolme chat stream/i })).toBeInTheDocument();
    expect(screen.getByLabelText('Phases and deliverables')).toBeInTheDocument();
    expect(screen.getByText(/start an algorithm run to populate chat/i)).toBeInTheDocument();
    expect(screen.getByText('No phases yet')).toBeInTheDocument();
    expect(screen.getByText('No deliverables yet')).toBeInTheDocument();
    expect(screen.queryByText(/Audience spreadsheet/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Luma - Curated venue list/i)).not.toBeInTheDocument();
  });

  it('loads user skills from the skills API and selects one for the composer', async () => {
    render(<NolmeAppRoute />);

    fireEvent.click(screen.getByRole('button', { name: 'Tasks' }));

    expect(await screen.findByText('research-codebase')).toBeInTheDocument();
    expect(skillsSpy).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /research-codebase/i }));

    expect(screen.getByRole('main', { name: /nolme chat stream/i })).toBeInTheDocument();
    expect(screen.getByText('research-codebase')).toBeInTheDocument();
  });

  it('opens the existing settings surface from the nav panel', () => {
    render(<NolmeAppRoute />);

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));

    expect(screen.getByRole('dialog')).toHaveTextContent('Settings panel');
  });

  it('starts an Algorithm run and renders live phases and deliverables from the response', async () => {
    const liveRunState = {
      runId: 'alg_1',
      provider: 'claude',
      status: 'running',
      eventCursor: { sequence: 1 },
      phases: [
        { id: 'research', label: 'P1', title: 'Research', status: 'complete' },
        { id: 'implement', label: 'P2', title: 'Implement', status: 'active' },
      ],
      currentPhaseIndex: 1,
      currentReviewLine: 'Wiring live data into /app.',
      deliverables: [
        { id: 'summary', title: 'Run summary', subtitle: 'Markdown artifact', tone: 'document' },
      ],
    };
    startAlgorithmRunSpy.mockReturnValueOnce(jsonResponse({
      ok: true,
      run: liveRunState,
    }));
    algorithmRunStateSpy.mockReturnValue(jsonResponse({ state: liveRunState }));

    render(<NolmeAppRoute />);

    fireEvent.click(screen.getByRole('button', { name: 'Tasks' }));
    fireEvent.click(await screen.findByRole('button', { name: /research-codebase/i }));
    fireEvent.change(screen.getByLabelText('Algorithm prompt'), {
      target: { value: 'Wire /app to live data' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));

    await waitFor(() => expect(startAlgorithmRunSpy).toHaveBeenCalledTimes(1));
    expect(startAlgorithmRunSpy).toHaveBeenCalledWith(expect.objectContaining({
      provider: 'claude',
      projectPath: '/workspace/demo-project',
      prompt: 'Wire /app to live data',
      metadata: expect.objectContaining({
        taskTitle: 'research-codebase',
      }),
    }));
    expect(await screen.findAllByText(/Implement/)).toHaveLength(2);
    expect(screen.getByText('Run summary')).toBeInTheDocument();
    expect(screen.getByText('Wiring live data into /app.')).toBeInTheDocument();
  });

  it('streams project/session search results from the search API', async () => {
    render(<NolmeAppRoute />);

    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    fireEvent.change(screen.getByPlaceholderText('Search projects and sessions'), {
      target: { value: 'algorithm' },
    });

    await waitFor(() => expect(searchConversationsUrlSpy).toHaveBeenCalledWith('algorithm'));
    const source = FakeEventSource.instances.find((instance) => instance.url.includes('/api/search/conversations'));
    expect(source).toBeDefined();

    act(() => {
      source?.emit('result', {
        projectResult: {
          projectName: 'demo-project',
          projectDisplayName: 'Demo Project',
          sessions: [
            {
              sessionId: 'sess_1',
              sessionSummary: 'Algorithm wiring session',
              provider: 'claude',
              matches: [
                { timestamp: '2026-04-29T12:00:00.000Z', snippet: 'Algorithm run API wiring' },
              ],
            },
          ],
        },
        totalMatches: 1,
        scannedProjects: 1,
        totalProjects: 1,
      });
    });

    expect(await screen.findByText('Demo Project')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Algorithm wiring session/i })).toBeInTheDocument();
  });
});
