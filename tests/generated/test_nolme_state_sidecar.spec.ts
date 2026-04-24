import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readState, writeState, DEFAULT_NOLME_STATE } from '../../server/agents/nolme-state-store.js';

let tmpHome: string;
let originalHome: string | undefined;

function binding() {
  return {
    provider: 'claude',
    sessionId: 's-abc',
    projectName: '-home-tmp-proj',
    projectPath: '/home/tmp/proj',
  };
}

describe('nolme-state-store (Phase 1 · B8)', () => {
  beforeEach(() => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'nolme-sidecar-'));
    originalHome = process.env.HOME;
    process.env.HOME = tmpHome;
  });
  afterEach(() => {
    if (originalHome === undefined) delete process.env.HOME;
    else process.env.HOME = originalHome;
    fs.rmSync(tmpHome, { recursive: true, force: true });
  });

  it('DEFAULT_NOLME_STATE matches the C-2 contract (schemaVersion 1, empty arrays, nulls)', () => {
    expect(DEFAULT_NOLME_STATE).toEqual({
      schemaVersion: 1,
      phases: [],
      currentPhaseIndex: 0,
      currentReviewLine: '',
      resources: [],
      profile: null,
      quickActions: [],
      taskNotifications: [],
    });
  });

  it('readState returns DEFAULT_NOLME_STATE when no sidecar file exists', async () => {
    const state = await readState(binding());
    expect(state).toEqual(DEFAULT_NOLME_STATE);
  });

  it('writeState persists to ~/.claude/projects/<projectName>/<sessionId>.nolme-state.json', async () => {
    const stateIn = {
      ...DEFAULT_NOLME_STATE,
      phases: [{ id: 'p1', label: 'Phase 1', title: 'Audience & venue', status: 'active' }],
      currentPhaseIndex: 0,
    };
    await writeState(binding(), stateIn);
    const expectedPath = path.join(
      tmpHome,
      '.claude',
      'projects',
      '-home-tmp-proj',
      's-abc.nolme-state.json',
    );
    expect(fs.existsSync(expectedPath)).toBe(true);
    const raw = fs.readFileSync(expectedPath, 'utf8');
    expect(JSON.parse(raw)).toEqual(stateIn);
  });

  it('writeState creates parent directories if they do not exist', async () => {
    // tmpHome is empty — the .claude/projects/-home-tmp-proj/ dir must be created.
    await writeState(binding(), DEFAULT_NOLME_STATE);
    const dir = path.join(tmpHome, '.claude', 'projects', '-home-tmp-proj');
    expect(fs.statSync(dir).isDirectory()).toBe(true);
  });

  it('readState round-trips a written state', async () => {
    const stateIn = {
      ...DEFAULT_NOLME_STATE,
      resources: [
        {
          id: 'r1',
          badge: 'P1',
          title: 'Workflow brief',
          subtitle: 'Google Document',
          tone: 'emerald',
          action: 'download',
        },
      ],
    };
    await writeState(binding(), stateIn);
    const stateOut = await readState(binding());
    expect(stateOut).toEqual(stateIn);
  });

  it('readState rejects state with a mismatched schemaVersion and returns defaults', async () => {
    // Pre-populate a bogus sidecar with schemaVersion: 99.
    const dir = path.join(tmpHome, '.claude', 'projects', '-home-tmp-proj');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, 's-abc.nolme-state.json'),
      JSON.stringify({ schemaVersion: 99, phases: [{ id: 'bogus' }] }),
    );
    const state = await readState(binding());
    expect(state).toEqual(DEFAULT_NOLME_STATE);
  });

  it('readState tolerates malformed JSON by returning defaults', async () => {
    const dir = path.join(tmpHome, '.claude', 'projects', '-home-tmp-proj');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 's-abc.nolme-state.json'), '{ not valid json');
    const state = await readState(binding());
    expect(state).toEqual(DEFAULT_NOLME_STATE);
  });

  it('uses encodeProjectPath when binding lacks projectName but has projectPath', async () => {
    const b = { ...binding(), projectName: '' };
    await writeState(b, DEFAULT_NOLME_STATE);
    // encodeProjectPath('/home/tmp/proj') → '-home-tmp-proj'
    const expectedDir = path.join(tmpHome, '.claude', 'projects', '-home-tmp-proj');
    expect(fs.existsSync(path.join(expectedDir, 's-abc.nolme-state.json'))).toBe(true);
  });
});
