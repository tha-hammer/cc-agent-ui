import { describe, it, expect, vi, beforeEach } from 'vitest';
import { lastValueFrom, toArray } from 'rxjs';

vi.mock('../../server/claude-sdk.js',   () => ({ queryClaudeSDK: vi.fn(async (_c, _o, w) => w.send({ kind: 'complete' })) }));
vi.mock('../../server/cursor-cli.js',   () => ({ spawnCursor:    vi.fn(async (_c, _o, w) => w.send({ kind: 'complete' })) }));
vi.mock('../../server/openai-codex.js', () => ({ queryCodex:     vi.fn(async (_c, _o, w) => w.send({ kind: 'complete' })) }));
vi.mock('../../server/gemini-cli.js',   () => ({ spawnGemini:    vi.fn(async (_c, _o, w) => w.send({ kind: 'complete' })) }));

import { CcuSessionAgent } from '../../server/agents/ccu-session-agent.js';
import { queryClaudeSDK } from '../../server/claude-sdk.js';
import { spawnCursor } from '../../server/cursor-cli.js';
import { queryCodex } from '../../server/openai-codex.js';
import { spawnGemini } from '../../server/gemini-cli.js';

const PROJECT_PATH = '/home/maceo/Dev/temp_testing';
const PROJECT_NAME = '-home-maceo-Dev-temp-testing';

// Models picked from shared/modelConstants.js — must be valid catalog entries
// because CcuSessionAgent.buildProviderDispatch() normalises unknown values to
// the provider default before dispatch.
const VALID_MODEL: Record<'claude' | 'cursor' | 'codex' | 'gemini', string> = {
  claude: 'sonnet',
  cursor: 'auto',
  codex: 'gpt-5.4',
  gemini: 'gemini-2.5-flash',
};

function bindingFor(provider: 'claude' | 'cursor' | 'codex' | 'gemini') {
  return {
    provider,
    sessionId: `${provider}-s1`,
    projectName: PROJECT_NAME,
    projectPath: PROJECT_PATH,
    model: VALID_MODEL[provider],
    permissionMode: 'default' as const,
    toolsSettings: { allowedTools: ['Read'], disallowedTools: [], skipPermissions: false },
    sessionSummary: 'hi',
  };
}

async function runAgent(provider: 'claude' | 'cursor' | 'codex' | 'gemini', prompt: string) {
  const agent = new CcuSessionAgent({ agentId: 'ccu', description: 'cc-agent-ui session wrapper' });
  const binding = bindingFor(provider);
  await lastValueFrom(
    agent
      .run({
        threadId: binding.sessionId,
        runId: 'r1',
        messages: [{ id: 'u1', role: 'user', content: prompt }],
        tools: [],
        context: [],
        forwardedProps: { binding },
      } as any)
      .pipe(toArray()),
  );
}

describe('CcuSessionAgent — provider dispatch table (Phase 1 · B5+B6)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('claude → queryClaudeSDK with claude option shape', async () => {
    await runAgent('claude', 'hi claude');
    expect(queryClaudeSDK).toHaveBeenCalledTimes(1);
    expect(spawnCursor).not.toHaveBeenCalled();
    expect(queryCodex).not.toHaveBeenCalled();
    expect(spawnGemini).not.toHaveBeenCalled();
    const [prompt, opts] = (queryClaudeSDK as any).mock.calls[0];
    expect(prompt).toBe('hi claude');
    expect(opts).toEqual({
      projectPath: PROJECT_PATH,
      cwd: PROJECT_PATH,
      toolsSettings: { allowedTools: ['Read'], disallowedTools: [], skipPermissions: false },
      permissionMode: 'default',
      model: VALID_MODEL.claude,
      sessionSummary: 'hi',
      sessionId: 'claude-s1',
    });
  });

  it('cursor → spawnCursor with cursor option shape including skipPermissions + resume flag', async () => {
    await runAgent('cursor', 'hi cursor');
    expect(spawnCursor).toHaveBeenCalledTimes(1);
    expect(queryClaudeSDK).not.toHaveBeenCalled();
    const [prompt, opts] = (spawnCursor as any).mock.calls[0];
    expect(prompt).toBe('hi cursor');
    expect(opts).toEqual({
      cwd: PROJECT_PATH,
      projectPath: PROJECT_PATH,
      sessionId: 'cursor-s1',
      resume: true,
      model: VALID_MODEL.cursor,
      skipPermissions: false,
      sessionSummary: 'hi',
      toolsSettings: { allowedTools: ['Read'], disallowedTools: [], skipPermissions: false },
    });
  });

  it('codex → queryCodex with codex option shape (plan→default permission downgrade)', async () => {
    const agent = new CcuSessionAgent({ agentId: 'ccu', description: 'wrap' });
    const binding = { ...bindingFor('codex'), permissionMode: 'plan' as const };
    await lastValueFrom(
      agent
        .run({
          threadId: binding.sessionId,
          runId: 'r1',
          messages: [{ id: 'u1', role: 'user', content: 'hi codex' }],
          tools: [],
          context: [],
          forwardedProps: { binding },
        } as any)
        .pipe(toArray()),
    );
    expect(queryCodex).toHaveBeenCalledTimes(1);
    const [prompt, opts] = (queryCodex as any).mock.calls[0];
    expect(prompt).toBe('hi codex');
    expect(opts.permissionMode).toBe('default');
    expect(opts.resume).toBe(true);
    expect(opts.sessionId).toBe('codex-s1');
  });

  it('gemini → spawnGemini with gemini option shape preserving toolsSettings + permissionMode', async () => {
    await runAgent('gemini', 'hi gemini');
    expect(spawnGemini).toHaveBeenCalledTimes(1);
    const [prompt, opts] = (spawnGemini as any).mock.calls[0];
    expect(prompt).toBe('hi gemini');
    expect(opts).toEqual({
      cwd: PROJECT_PATH,
      projectPath: PROJECT_PATH,
      sessionId: 'gemini-s1',
      resume: true,
      model: VALID_MODEL.gemini,
      sessionSummary: 'hi',
      permissionMode: 'default',
      toolsSettings: { allowedTools: ['Read'], disallowedTools: [], skipPermissions: false },
    });
  });

  it('new-session run (empty sessionId) → resume: false for providers that use the flag', async () => {
    const agent = new CcuSessionAgent({ agentId: 'ccu', description: 'wrap' });
    const binding = { ...bindingFor('cursor'), sessionId: '' };
    await lastValueFrom(
      agent
        .run({
          threadId: '',
          runId: 'r1',
          messages: [{ id: 'u1', role: 'user', content: 'new session' }],
          tools: [],
          context: [],
          forwardedProps: { binding },
        } as any)
        .pipe(toArray()),
    );
    const [, opts] = (spawnCursor as any).mock.calls[0];
    expect(opts.resume).toBe(false);
    expect(opts.sessionId).toBe('');
  });

  it('unknown provider produces RUN_ERROR (defensive)', async () => {
    const agent = new CcuSessionAgent({ agentId: 'ccu', description: 'wrap' });
    const events = await lastValueFrom(
      agent
        .run({
          threadId: 's',
          runId: 'r',
          messages: [{ id: 'u', role: 'user', content: 'x' }],
          tools: [],
          context: [],
          forwardedProps: { binding: { ...bindingFor('claude'), provider: 'unknown-provider' as any } },
        } as any)
        .pipe(toArray()),
    );
    const types = events.map((e) => e.type);
    expect(types).toContain('RUN_ERROR');
    expect(queryClaudeSDK).not.toHaveBeenCalled();
  });
});
