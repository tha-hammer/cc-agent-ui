import { describe, it, expect, vi, beforeEach } from 'vitest';
import { lastValueFrom, toArray } from 'rxjs';

// vi.hoisted ensures these constants exist before vi.mock factories run
// (vi.mock is hoisted above imports, so non-hoisted consts aren't visible there).
const { fetchHistoryMock, readStateMock } = vi.hoisted(() => ({
  fetchHistoryMock: vi.fn(),
  readStateMock: vi.fn(),
}));

vi.mock('../../server/providers/registry.js', () => ({
  getProvider: (_name: string) => ({ fetchHistory: fetchHistoryMock }),
  getAllProviders: () => ['claude', 'cursor', 'codex', 'gemini'],
}));

vi.mock('../../server/agents/nolme-state-store.js', () => ({
  DEFAULT_NOLME_STATE: {
    schemaVersion: 1,
    phases: [],
    currentPhaseIndex: 0,
    currentReviewLine: '',
    resources: [],
    profile: null,
    quickActions: [],
    taskNotifications: [],
  },
  readState: readStateMock,
  writeState: vi.fn(),
}));

// Stub runtime entrypoints so importing the agent doesn't try to spin up real adapters.
vi.mock('../../server/claude-sdk.js',   () => ({ queryClaudeSDK: vi.fn() }));
vi.mock('../../server/cursor-cli.js',   () => ({ spawnCursor:    vi.fn() }));
vi.mock('../../server/openai-codex.js', () => ({ queryCodex:     vi.fn() }));
vi.mock('../../server/gemini-cli.js',   () => ({ spawnGemini:    vi.fn() }));

import { CcuSessionAgent } from '../../server/agents/ccu-session-agent.js';

const claudeBinding = {
  provider: 'claude' as const,
  sessionId: 's-abc',
  projectName: '-home-maceo-Dev-temp-testing',
  projectPath: '/home/maceo/Dev/temp_testing',
  model: 'sonnet',
};

function buildInput(overrides: object = {}) {
  return {
    threadId: claudeBinding.sessionId,
    runId: 'hydrate-1',
    messages: [],
    tools: [],
    context: [],
    forwardedProps: { binding: claudeBinding },
    ...overrides,
  } as any;
}

async function collect(obs: import('rxjs').Observable<any>) {
  return await lastValueFrom(obs.pipe(toArray()));
}

describe('CcuSessionAgent.connect — session hydration (Phase 1 · B9)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchHistoryMock.mockReset();
    readStateMock.mockReset();
  });

  it('emits RUN_STARTED first and RUN_FINISHED last', async () => {
    fetchHistoryMock.mockResolvedValue({ messages: [], total: 0, hasMore: false, offset: 0, limit: null });
    readStateMock.mockResolvedValue({
      schemaVersion: 1,
      phases: [],
      currentPhaseIndex: 0,
      currentReviewLine: '',
      resources: [],
      profile: null,
      quickActions: [],
      taskNotifications: [],
    });

    const agent = new CcuSessionAgent({ agentId: 'ccu', description: 'wrap' });
    const events = await collect(agent.connect(buildInput()));

    expect(events[0].type).toBe('RUN_STARTED');
    expect(events[events.length - 1].type).toBe('RUN_FINISHED');
  });

  it('replays prior text messages via the translator (each → TEXT_MESSAGE_* triad)', async () => {
    fetchHistoryMock.mockResolvedValue({
      messages: [
        { id: 'm1', sessionId: 's-abc', provider: 'claude', kind: 'text', role: 'user', content: 'hello', timestamp: '2026-01-01T00:00:00Z' },
        { id: 'm2', sessionId: 's-abc', provider: 'claude', kind: 'text', role: 'assistant', content: 'hi there', timestamp: '2026-01-01T00:00:01Z' },
      ],
      total: 2,
      hasMore: false,
      offset: 0,
      limit: null,
    });
    readStateMock.mockResolvedValue({
      schemaVersion: 1,
      phases: [],
      currentPhaseIndex: 0,
      currentReviewLine: '',
      resources: [],
      profile: null,
      quickActions: [],
      taskNotifications: [],
    });

    const agent = new CcuSessionAgent({ agentId: 'ccu', description: 'wrap' });
    const events = await collect(agent.connect(buildInput()));

    // Two text messages → two full triads
    const textEvents = events.filter((e) => e.type.startsWith('TEXT_MESSAGE_'));
    expect(textEvents.map((e) => e.type)).toEqual([
      'TEXT_MESSAGE_START', 'TEXT_MESSAGE_CONTENT', 'TEXT_MESSAGE_END',
      'TEXT_MESSAGE_START', 'TEXT_MESSAGE_CONTENT', 'TEXT_MESSAGE_END',
    ]);
    expect((textEvents[1] as any).delta).toBe('hello');
    expect((textEvents[4] as any).delta).toBe('hi there');
  });

  it('emits STATE_SNAPSHOT carrying the sidecar NolmeAgentState', async () => {
    fetchHistoryMock.mockResolvedValue({ messages: [], total: 0, hasMore: false, offset: 0, limit: null });
    const fixtureState = {
      schemaVersion: 1,
      phases: [{ id: 'p1', label: 'Phase 1', title: 'Audience & venue', status: 'active' }],
      currentPhaseIndex: 0,
      currentReviewLine: 'Reviewing audience + venue plan',
      resources: [],
      profile: { name: 'Aria', role: 'Community Lead', skills: ['events'], integrations: ['luma'] },
      quickActions: ['Draft brief'],
      taskNotifications: [],
    };
    readStateMock.mockResolvedValue(fixtureState);

    const agent = new CcuSessionAgent({ agentId: 'ccu', description: 'wrap' });
    const events = await collect(agent.connect(buildInput()));

    const snapshot = events.find((e) => e.type === 'STATE_SNAPSHOT') as any;
    expect(snapshot).toBeDefined();
    expect(snapshot.snapshot).toEqual(fixtureState);
  });

  it('calls fetchHistory with {projectName, projectPath, limit: null, offset: 0}', async () => {
    fetchHistoryMock.mockResolvedValue({ messages: [], total: 0, hasMore: false, offset: 0, limit: null });
    readStateMock.mockResolvedValue({
      schemaVersion: 1, phases: [], currentPhaseIndex: 0, currentReviewLine: '',
      resources: [], profile: null, quickActions: [], taskNotifications: [],
    });

    const agent = new CcuSessionAgent({ agentId: 'ccu', description: 'wrap' });
    await collect(agent.connect(buildInput()));

    expect(fetchHistoryMock).toHaveBeenCalledTimes(1);
    expect(fetchHistoryMock).toHaveBeenCalledWith('s-abc', {
      projectName: '-home-maceo-Dev-temp-testing',
      projectPath: '/home/maceo/Dev/temp_testing',
      limit: null,
      offset: 0,
    });
  });

  it('emits RUN_ERROR if fetchHistory throws (robust hydration)', async () => {
    fetchHistoryMock.mockRejectedValue(new Error('disk gone'));
    readStateMock.mockResolvedValue({
      schemaVersion: 1, phases: [], currentPhaseIndex: 0, currentReviewLine: '',
      resources: [], profile: null, quickActions: [], taskNotifications: [],
    });

    const agent = new CcuSessionAgent({ agentId: 'ccu', description: 'wrap' });
    const events = await collect(agent.connect(buildInput()));

    const err = events.find((e) => e.type === 'RUN_ERROR') as any;
    expect(err).toBeDefined();
    expect(err.message).toMatch(/disk gone/);
  });

  it('emits RUN_ERROR when binding is missing', async () => {
    const agent = new CcuSessionAgent({ agentId: 'ccu', description: 'wrap' });
    const events = await collect(agent.connect({ ...buildInput(), forwardedProps: {} } as any));
    expect(events.some((e) => e.type === 'RUN_ERROR')).toBe(true);
    expect(fetchHistoryMock).not.toHaveBeenCalled();
  });

  it('emits STATE_SNAPSHOT with defaults if sidecar read returns defaults', async () => {
    fetchHistoryMock.mockResolvedValue({ messages: [], total: 0, hasMore: false, offset: 0, limit: null });
    const defaults = {
      schemaVersion: 1, phases: [], currentPhaseIndex: 0, currentReviewLine: '',
      resources: [], profile: null, quickActions: [], taskNotifications: [],
    };
    readStateMock.mockResolvedValue(defaults);

    const agent = new CcuSessionAgent({ agentId: 'ccu', description: 'wrap' });
    const events = await collect(agent.connect(buildInput()));

    const snap = events.find((e) => e.type === 'STATE_SNAPSHOT') as any;
    expect(snap.snapshot).toEqual(defaults);
  });

  it('event order is RUN_STARTED → replay → STATE_SNAPSHOT → RUN_FINISHED', async () => {
    fetchHistoryMock.mockResolvedValue({
      messages: [
        { id: 'm1', sessionId: 's-abc', provider: 'claude', kind: 'text', role: 'user', content: 'q', timestamp: '2026' },
      ],
      total: 1, hasMore: false, offset: 0, limit: null,
    });
    readStateMock.mockResolvedValue({
      schemaVersion: 1, phases: [], currentPhaseIndex: 0, currentReviewLine: '',
      resources: [], profile: null, quickActions: [], taskNotifications: [],
    });

    const agent = new CcuSessionAgent({ agentId: 'ccu', description: 'wrap' });
    const events = await collect(agent.connect(buildInput()));

    const types = events.map((e) => e.type);
    const runStartedIdx = types.indexOf('RUN_STARTED');
    const snapshotIdx = types.indexOf('STATE_SNAPSHOT');
    const runFinishedIdx = types.indexOf('RUN_FINISHED');
    const firstTextStart = types.indexOf('TEXT_MESSAGE_START');

    expect(runStartedIdx).toBe(0);
    expect(firstTextStart).toBeGreaterThan(runStartedIdx);
    expect(snapshotIdx).toBeGreaterThan(firstTextStart);
    expect(runFinishedIdx).toBeGreaterThan(snapshotIdx);
  });
});
