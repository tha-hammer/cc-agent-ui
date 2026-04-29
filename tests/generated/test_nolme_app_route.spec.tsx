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
  sessionsSpy,
  unifiedSessionMessagesSpy,
  deleteSessionSpy,
  deleteCodexSessionSpy,
  deleteGeminiSessionSpy,
  authenticatedFetchSpy,
  sendWsMessageSpy,
  webSocketState,
} = vi.hoisted(() => ({
  projectsSpy: vi.fn(),
  skillsSpy: vi.fn(),
  algorithmRunStateSpy: vi.fn(),
  algorithmRunEventsUrlSpy: vi.fn(),
  searchConversationsUrlSpy: vi.fn(),
  startAlgorithmRunSpy: vi.fn(),
  sessionsSpy: vi.fn(),
  unifiedSessionMessagesSpy: vi.fn(),
  deleteSessionSpy: vi.fn(),
  deleteCodexSessionSpy: vi.fn(),
  deleteGeminiSessionSpy: vi.fn(),
  authenticatedFetchSpy: vi.fn(),
  sendWsMessageSpy: vi.fn(),
  webSocketState: { latestMessage: null as unknown },
}));

function jsonResponse(body: unknown, ok = true) {
  return Promise.resolve({
    ok,
    json: async () => body,
  });
}

function deferredResponse() {
  let resolveResponse: (value: { ok: boolean; json: () => Promise<unknown> }) => void = () => {};
  const promise = new Promise<{ ok: boolean; json: () => Promise<unknown> }>((resolve) => {
    resolveResponse = resolve;
  });

  return {
    promise,
    resolve: (body: unknown, ok = true) => resolveResponse({
      ok,
      json: async () => body,
    }),
  };
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
    sessions: sessionsSpy,
    unifiedSessionMessages: unifiedSessionMessagesSpy,
    deleteSession: deleteSessionSpy,
    deleteCodexSession: deleteCodexSessionSpy,
    deleteGeminiSession: deleteGeminiSessionSpy,
  },
  authenticatedFetch: authenticatedFetchSpy,
}));

vi.mock('../../src/contexts/WebSocketContext', () => ({
  useWebSocket: () => ({
    sendMessage: sendWsMessageSpy,
    latestMessage: webSocketState.latestMessage,
    isConnected: true,
    ws: null,
  }),
}));

vi.mock('../../src/components/settings/view/Settings', () => ({
  default: ({ isOpen }: { isOpen: boolean }) => (isOpen ? <div role="dialog">Settings panel</div> : null),
}));

vi.mock('../../src/components/llm-logo-provider/SessionProviderLogo', () => ({
  default: ({ provider = 'claude', className }: { provider?: string; className?: string }) => (
    <span className={className}>{provider}</span>
  ),
}));

describe('NolmeAppRoute', () => {
  beforeEach(() => {
    localStorage.clear();
    FakeEventSource.instances = [];
    (globalThis as any).EventSource = FakeEventSource;
    (window as any).EventSource = FakeEventSource;
    window.history.replaceState({}, '', '/');
    webSocketState.latestMessage = null;

    projectsSpy.mockReset().mockReturnValue(jsonResponse([
      {
        name: 'demo-project',
        displayName: 'maceo',
        path: '/workspace/demo-project',
        fullPath: '/workspace/demo-project',
        sessionMeta: { hasMore: true, total: 2 },
        sessions: [
          {
            id: 'claude-session-1',
            summary: 'cool!! what do you mean by zero-knowledge',
            lastActivity: '2026-04-28T12:00:00.000Z',
            messageCount: 99,
          },
        ],
        codexSessions: [
          {
            id: 'codex-session-1',
            summary: 'KC Baker',
            createdAt: '2026-04-27T12:00:00.000Z',
            messageCount: 40,
          },
        ],
        geminiSessions: [],
        cursorSessions: [],
      },
    ]));
    skillsSpy.mockReset().mockReturnValue(jsonResponse({
      skills: [
        {
          id: 'codex:research-codebase',
          name: 'research-codebase',
          description: 'Trace code paths and produce a grounded research document.',
          path: '/home/maceo/.claude/skills/research-codebase/SKILL.md',
          relativePath: 'research-codebase/SKILL.md',
          source: 'claude',
        },
      ],
    }));
    algorithmRunStateSpy.mockReset().mockReturnValue(jsonResponse({ state: null }));
    algorithmRunEventsUrlSpy.mockReset().mockReturnValue('/api/algorithm-runs/alg_1/events?after=0&stream=1');
    searchConversationsUrlSpy.mockReset().mockImplementation((query: string) => `/api/search/conversations?q=${encodeURIComponent(query)}`);
    sessionsSpy.mockReset().mockReturnValue(jsonResponse({
      sessions: [
        {
          id: 'claude-session-2',
          summary: 'Loaded follow-up session',
          lastActivity: '2026-04-26T12:00:00.000Z',
          messageCount: 12,
        },
      ],
      hasMore: false,
    }));
    unifiedSessionMessagesSpy.mockReset().mockReturnValue(jsonResponse({
      messages: [
        {
          id: 'm1',
          sessionId: 'claude-session-1',
          provider: 'claude',
          kind: 'text',
          role: 'user',
          content: 'Existing question',
          timestamp: '2026-04-28T12:00:00.000Z',
        },
        {
          id: 'm2',
          sessionId: 'claude-session-1',
          provider: 'claude',
          kind: 'text',
          role: 'assistant',
          content: 'Existing answer',
          timestamp: '2026-04-28T12:01:00.000Z',
        },
      ],
    }));
    deleteSessionSpy.mockReset().mockReturnValue(jsonResponse({ success: true }));
    deleteCodexSessionSpy.mockReset().mockReturnValue(jsonResponse({ success: true }));
    deleteGeminiSessionSpy.mockReset().mockReturnValue(jsonResponse({ success: true }));
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
    sendWsMessageSpy.mockReset();
  });

  it('renders the /app shell without the old hard-coded Figma demo data', async () => {
    render(<NolmeAppRoute />);

    expect(screen.getByLabelText('Nolme app navigation')).toBeInTheDocument();
    expect(screen.getByRole('main', { name: /Projects and sessions/i })).toBeInTheDocument();
    expect(screen.getByLabelText('Phases and deliverables')).toBeInTheDocument();
    expect(screen.getByText('Projects')).toBeInTheDocument();
    expect(await screen.findByText('maceo')).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: /Claude model/i })).not.toBeInTheDocument();
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

  it('shows projects and sessions when the chat nav item is selected', async () => {
    render(<NolmeAppRoute />);

    fireEvent.click(screen.getByRole('button', { name: 'Chat' }));

    expect(await screen.findByRole('main', { name: /Projects and sessions/i })).toBeInTheDocument();
    expect(screen.getByText('cool!! what do you mean by zero-knowledge')).toBeInTheDocument();
    expect(screen.getByText('KC Baker')).toBeInTheDocument();
    expect(screen.getByText('99')).toBeInTheDocument();
    expect(screen.getByLabelText('claude session')).toBeInTheDocument();
    expect(screen.getByLabelText('codex session')).toBeInTheDocument();
  });

  it('shows a projects loading state instead of an empty browser while projects are scanning', async () => {
    const projectsResponse = deferredResponse();
    projectsSpy.mockReturnValueOnce(projectsResponse.promise);

    render(<NolmeAppRoute />);

    fireEvent.click(screen.getByRole('button', { name: 'Chat' }));

    expect(screen.getByRole('status', { name: /Loading projects/i })).toBeInTheDocument();
    expect(screen.queryByText('No projects found')).not.toBeInTheDocument();

    projectsResponse.resolve([
      {
        name: 'demo-project',
        displayName: 'maceo',
        path: '/workspace/demo-project',
        fullPath: '/workspace/demo-project',
        sessionMeta: { hasMore: false, total: 1 },
        sessions: [
          {
            id: 'claude-session-1',
            summary: 'cool!! what do you mean by zero-knowledge',
            lastActivity: '2026-04-28T12:00:00.000Z',
            messageCount: 99,
          },
        ],
        codexSessions: [],
        geminiSessions: [],
        cursorSessions: [],
      },
    ]);

    expect(await screen.findByText('cool!! what do you mean by zero-knowledge')).toBeInTheDocument();
  });

  it('opens the existing settings surface from the nav panel', () => {
    render(<NolmeAppRoute />);

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));

    expect(screen.getByRole('dialog')).toHaveTextContent('Settings panel');
  });

  it('sends user messages to the LLM through the chat websocket', async () => {
    render(<NolmeAppRoute />);

    fireEvent.click(await screen.findByRole('button', { name: /New session for maceo/i }));
    await screen.findByRole('combobox', { name: /Claude model/i });
    fireEvent.change(screen.getByLabelText('Message prompt'), {
      target: { value: 'Wire /app to live data' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => expect(sendWsMessageSpy).toHaveBeenCalledTimes(1));
    expect(sendWsMessageSpy).toHaveBeenCalledWith(expect.objectContaining({
      type: 'claude-command',
      command: 'Wire /app to live data',
      options: expect.objectContaining({
        projectPath: '/workspace/demo-project',
        cwd: '/workspace/demo-project',
        model: 'sonnet',
        resume: false,
        permissionMode: 'default',
      }),
    }));
    expect(startAlgorithmRunSpy).not.toHaveBeenCalled();
    expect(screen.getByText('Wire /app to live data')).toBeInTheDocument();
  });

  it('submits the user message on Enter and keeps Shift+Enter available for newlines', async () => {
    render(<NolmeAppRoute />);

    fireEvent.click(await screen.findByRole('button', { name: /New session for maceo/i }));
    await screen.findByRole('combobox', { name: /Claude model/i });
    const textarea = screen.getByLabelText('Message prompt');

    fireEvent.change(textarea, { target: { value: 'Send on enter' } });
    fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter', shiftKey: true });
    expect(sendWsMessageSpy).not.toHaveBeenCalled();

    fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter' });
    await waitFor(() => expect(sendWsMessageSpy).toHaveBeenCalledTimes(1));
    expect(sendWsMessageSpy).toHaveBeenCalledWith(expect.objectContaining({
      command: 'Send on enter',
    }));
  });

  it('uses the selected Claude model in the composer selector and LLM request', async () => {
    localStorage.setItem('claude-model', 'opus');
    render(<NolmeAppRoute />);

    fireEvent.click(await screen.findByRole('button', { name: /New session for maceo/i }));
    const modelSelect = await screen.findByRole('combobox', { name: /Claude model/i });
    expect(modelSelect).toHaveDisplayValue('Opus');
    fireEvent.change(modelSelect, { target: { value: 'haiku' } });
    expect(localStorage.getItem('claude-model')).toBe('haiku');
    fireEvent.change(screen.getByLabelText('Message prompt'), {
      target: { value: 'Use the selected model' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => expect(sendWsMessageSpy).toHaveBeenCalledTimes(1));
    expect(sendWsMessageSpy).toHaveBeenCalledWith(expect.objectContaining({
      options: expect.objectContaining({
        model: 'haiku',
      }),
    }));
  });

  it('loads an existing session inside /app and resumes it on the next send', async () => {
    render(<NolmeAppRoute />);

    fireEvent.click(await screen.findByRole('button', { name: /Open session cool!! what do you mean/i }));

    await waitFor(() => expect(unifiedSessionMessagesSpy).toHaveBeenCalledWith(
      'claude-session-1',
      'claude',
      expect.objectContaining({
        projectName: 'demo-project',
        projectPath: '/workspace/demo-project',
      }),
    ));
    expect(screen.getByRole('log', { name: /Conversation history/i })).toHaveClass('nolme-app__messages');
    expect(await screen.findByText('Existing question')).toBeInTheDocument();
    expect(screen.getByText('Existing answer')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Message prompt'), {
      target: { value: 'Continue this session' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => expect(sendWsMessageSpy).toHaveBeenCalledTimes(1));
    expect(sendWsMessageSpy).toHaveBeenCalledWith(expect.objectContaining({
      command: 'Continue this session',
      options: expect.objectContaining({
        sessionId: 'claude-session-1',
        resume: true,
      }),
    }));
  });

  it('applies project and selected-session metadata from project update events', async () => {
    const oneMinuteAgo = new Date(Date.now() - 65_000).toISOString();
    const { rerender } = render(<NolmeAppRoute />);
    fireEvent.click(screen.getByRole('button', { name: 'Chat' }));

    expect(await screen.findByText('99')).toBeInTheDocument();

    webSocketState.latestMessage = {
      type: 'projects_updated',
      changedFile: '/workspace/demo-project/.claude/projects/claude-session-1.jsonl',
      projects: [
        {
          name: 'demo-project',
          displayName: 'maceo',
          path: '/workspace/demo-project',
          fullPath: '/workspace/demo-project',
          sessionMeta: { hasMore: true, total: 2 },
          sessions: [
            {
              id: 'claude-session-1',
              summary: 'cool!! what do you mean by zero-knowledge',
              lastActivity: oneMinuteAgo,
              messageCount: 100,
            },
          ],
          codexSessions: [],
          geminiSessions: [],
          cursorSessions: [],
        },
      ],
    };

    rerender(<NolmeAppRoute />);

    expect(await screen.findByText('100')).toBeInTheDocument();
    expect(screen.getByText('1 min ago')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Open session cool!! what do you mean/i })).toBeInTheDocument();
  });

  it('refreshes the selected /app session when its project file changes', async () => {
    const { rerender } = render(<NolmeAppRoute />);

    fireEvent.click(await screen.findByRole('button', { name: /Open session cool!! what do you mean/i }));
    expect(await screen.findByText('Existing answer')).toBeInTheDocument();

    unifiedSessionMessagesSpy.mockReturnValueOnce(jsonResponse({
      messages: [
        {
          id: 'm1-new',
          sessionId: 'claude-session-1',
          provider: 'claude',
          kind: 'text',
          role: 'user',
          content: 'Existing question',
          timestamp: '2026-04-28T12:00:00.000Z',
        },
        {
          id: 'm2-new',
          sessionId: 'claude-session-1',
          provider: 'claude',
          kind: 'text',
          role: 'assistant',
          content: 'Updated answer',
          timestamp: '2026-04-29T12:01:00.000Z',
        },
      ],
    }));

    webSocketState.latestMessage = {
      type: 'projects_updated',
      changedFile: '/workspace/demo-project/.claude/projects/claude-session-1.jsonl',
      projects: [
        {
          name: 'demo-project',
          displayName: 'maceo',
          path: '/workspace/demo-project',
          fullPath: '/workspace/demo-project',
          sessions: [
            {
              id: 'claude-session-1',
              summary: 'cool!! what do you mean by zero-knowledge',
              lastActivity: '2026-04-29T12:01:00.000Z',
              messageCount: 100,
            },
          ],
          codexSessions: [],
          geminiSessions: [],
          cursorSessions: [],
        },
      ],
    };

    rerender(<NolmeAppRoute />);

    await waitFor(() => expect(unifiedSessionMessagesSpy).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('Updated answer')).toBeInTheDocument();
    expect(screen.queryByText('Existing answer')).not.toBeInTheDocument();
  });

  it('does not refresh the selected /app session when another project file changes', async () => {
    const { rerender } = render(<NolmeAppRoute />);

    fireEvent.click(await screen.findByRole('button', { name: /Open session cool!! what do you mean/i }));
    expect(await screen.findByText('Existing answer')).toBeInTheDocument();
    expect(unifiedSessionMessagesSpy).toHaveBeenCalledTimes(1);

    unifiedSessionMessagesSpy.mockReturnValueOnce(jsonResponse({
      messages: [
        {
          id: 'other',
          sessionId: 'claude-session-1',
          provider: 'claude',
          kind: 'text',
          role: 'assistant',
          content: 'Should not replace the selected session',
          timestamp: '2026-04-29T12:01:00.000Z',
        },
      ],
    }));

    webSocketState.latestMessage = {
      type: 'projects_updated',
      changedFile: '/workspace/demo-project/.claude/projects/another-session.jsonl',
      projects: [],
    };
    rerender(<NolmeAppRoute />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(unifiedSessionMessagesSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Existing answer')).toBeInTheDocument();
    expect(screen.queryByText('Should not replace the selected session')).not.toBeInTheDocument();
  });

  it('keeps the existing transcript visible when selected-session refresh fails', async () => {
    const { rerender } = render(<NolmeAppRoute />);

    fireEvent.click(await screen.findByRole('button', { name: /Open session cool!! what do you mean/i }));
    expect(await screen.findByText('Existing answer')).toBeInTheDocument();

    unifiedSessionMessagesSpy.mockReturnValueOnce(jsonResponse({ error: 'Refresh failed' }, false));

    webSocketState.latestMessage = {
      type: 'projects_updated',
      changedFile: '/workspace/demo-project/.claude/projects/claude-session-1.jsonl',
      projects: [],
    };
    rerender(<NolmeAppRoute />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Refresh failed');
    expect(screen.getByText('Existing answer')).toBeInTheDocument();
  });

  it('keeps the latest selected-session refresh result when overlapping refreshes resolve out of order', async () => {
    const { rerender } = render(<NolmeAppRoute />);

    fireEvent.click(await screen.findByRole('button', { name: /Open session cool!! what do you mean/i }));
    expect(await screen.findByText('Existing answer')).toBeInTheDocument();

    const firstRefresh = deferredResponse();
    const secondRefresh = deferredResponse();
    unifiedSessionMessagesSpy
      .mockReturnValueOnce(firstRefresh.promise)
      .mockReturnValueOnce(secondRefresh.promise);

    webSocketState.latestMessage = {
      type: 'projects_updated',
      changedFile: '/workspace/demo-project/.claude/projects/claude-session-1.jsonl',
      projects: [],
    };
    rerender(<NolmeAppRoute />);

    webSocketState.latestMessage = {
      type: 'projects_updated',
      changedFile: '/workspace/demo-project/.claude/projects/claude-session-1.jsonl',
      projects: [],
      sequence: 2,
    };
    rerender(<NolmeAppRoute />);

    secondRefresh.resolve({
      messages: [
        {
          id: 'newer',
          sessionId: 'claude-session-1',
          provider: 'claude',
          kind: 'text',
          role: 'assistant',
          content: 'Newer response',
          timestamp: '2026-04-29T12:02:00.000Z',
        },
      ],
    });

    expect(await screen.findByText('Newer response')).toBeInTheDocument();

    firstRefresh.resolve({
      messages: [
        {
          id: 'older',
          sessionId: 'claude-session-1',
          provider: 'claude',
          kind: 'text',
          role: 'assistant',
          content: 'Older response',
          timestamp: '2026-04-29T12:01:00.000Z',
        },
      ],
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText('Newer response')).toBeInTheDocument();
    expect(screen.queryByText('Older response')).not.toBeInTheDocument();
  });

  it('shows completed task notifications from the selected session as deliverables', async () => {
    unifiedSessionMessagesSpy.mockReturnValue(jsonResponse({
      messages: [
        {
          id: 'artifact-1',
          sessionId: 'claude-session-1',
          provider: 'claude',
          kind: 'task_notification',
          status: 'completed',
          summary: 'Selected session report completed',
          timestamp: '2026-04-29T12:00:00.000Z',
        },
      ],
    }));
    render(<NolmeAppRoute />);

    fireEvent.click(await screen.findByRole('button', { name: /Open session cool!! what do you mean/i }));

    expect(await screen.findByText('Selected session report completed')).toBeInTheDocument();
    expect(screen.getByText('Completed task output')).toBeInTheDocument();
  });

  it('falls back to the final assistant report when no artifact notification exists', async () => {
    unifiedSessionMessagesSpy.mockReturnValue(jsonResponse({
      messages: [
        {
          id: 'final-report',
          sessionId: 'claude-session-1',
          provider: 'claude',
          kind: 'text',
          role: 'assistant',
          content: [
            'REPORT DELIVERED',
            '',
            '# ICP shortlist',
            '',
            'Final findings are ready.',
          ].join('\n'),
          timestamp: '2026-04-29T12:00:00.000Z',
        },
      ],
    }));
    render(<NolmeAppRoute />);

    fireEvent.click(await screen.findByRole('button', { name: /Open session cool!! what do you mean/i }));

    expect(await screen.findByText('ICP shortlist')).toBeInTheDocument();
    expect(screen.getByText('Final assistant report')).toBeInTheDocument();
  });

  it('uses selected-session deliverables instead of stale local active-run artifacts', async () => {
    localStorage.setItem('nolme-active-algorithm-run-id', 'alg_stale');
    algorithmRunStateSpy.mockReturnValue(jsonResponse({
      state: {
        runId: 'alg_stale',
        provider: 'claude',
        status: 'completed',
        sessionId: 'different-session',
        deliverables: [
          { id: 'stale', title: 'Stale run artifact', subtitle: 'Old run', tone: 'document' },
        ],
      },
    }));
    unifiedSessionMessagesSpy.mockReturnValue(jsonResponse({
      messages: [
        {
          id: 'artifact-selected',
          sessionId: 'claude-session-1',
          provider: 'claude',
          kind: 'task_notification',
          status: 'completed',
          summary: 'Selected session artifact',
          timestamp: '2026-04-29T12:00:00.000Z',
        },
      ],
    }));

    render(<NolmeAppRoute />);

    expect(await screen.findByText('Stale run artifact')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Chat' }));
    fireEvent.click(await screen.findByRole('button', { name: /Open session cool!! what do you mean/i }));

    expect(await screen.findByText('Selected session artifact')).toBeInTheDocument();
    expect(screen.queryByText('Stale run artifact')).not.toBeInTheDocument();
  });

  it('deletes an existing provider-supported session from the projects browser', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<NolmeAppRoute />);

    fireEvent.click(await screen.findByRole('button', { name: /Delete session cool!! what do you mean/i }));

    await waitFor(() => expect(deleteSessionSpy).toHaveBeenCalledWith('demo-project', 'claude-session-1'));
    expect(screen.queryByText('cool!! what do you mean by zero-knowledge')).not.toBeInTheDocument();
    confirmSpy.mockRestore();
  });

  it('loads more Claude sessions for a project', async () => {
    render(<NolmeAppRoute />);

    fireEvent.click(await screen.findByRole('button', { name: /Show more sessions for maceo/i }));

    await waitFor(() => expect(sessionsSpy).toHaveBeenCalledWith('demo-project', 5, 1));
    expect(await screen.findByText('Loaded follow-up session')).toBeInTheDocument();
  });

  it('renders live phases and deliverables from an active Algorithm run', async () => {
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
    localStorage.setItem('nolme-active-algorithm-run-id', 'alg_1');
    algorithmRunStateSpy.mockReturnValue(jsonResponse({ state: liveRunState }));

    render(<NolmeAppRoute />);

    expect(await screen.findAllByText(/Implement/)).toHaveLength(2);
    expect(screen.getByText('Run summary')).toBeInTheDocument();
    expect(screen.getByText('Wiring live data into /app.')).toBeInTheDocument();
  });

  it('derives Algorithm phase progress from live chat output', async () => {
    const { rerender } = render(<NolmeAppRoute />);

    webSocketState.latestMessage = {
      id: 'algorithm-progress-1',
      provider: 'claude',
      kind: 'text',
      role: 'assistant',
      content: [
        'Entering the SAL ALGORITHM... (v3.8.1)',
        'TASK: Research recruiting agency market for AI app ICP',
        'OBSERVE 1/7',
      ].join('\n'),
      timestamp: '2026-04-29T12:36:00.000Z',
    };
    rerender(<NolmeAppRoute />);

    expect(await screen.findByText('P1: Observe')).toBeInTheDocument();
    expect(screen.getByText('P7: Learn')).toBeInTheDocument();
    expect(screen.getByText('Task 1 of 7')).toBeInTheDocument();
    expect(screen.getByText('Research recruiting agency market for AI app ICP')).toBeInTheDocument();
    expect(screen.queryByText('No phases yet')).not.toBeInTheDocument();
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
