// fork-prepare server unit tests (Behaviors 1-8 + 3b from the TDD plan)

import { describe, it, expect, vi } from 'vitest';
import { prepareFork } from '../../server/fork.js';

function makeFs(readReturn: string | (() => string)) {
  const writeFileSync = vi.fn();
  const readFileSync = vi.fn().mockImplementation(() => {
    return typeof readReturn === 'function' ? (readReturn as () => string)() : readReturn;
  });
  return {
    fsImpl: { readFileSync, writeFileSync } as any,
    writeFileSync,
    readFileSync,
  };
}

function asLines(strs: object[]) {
  return strs.map((o) => JSON.stringify(o)).join('\n') + '\n';
}

const FIXED_UUID = '7f5a5a5a-aaaa-4bbb-8ccc-dddddddddddd';

describe('prepareFork — Behavior 1: line count', () => {
  it('outputs exactly K lines when target uuid is at line K', async () => {
    const { fsImpl, writeFileSync } = makeFs(asLines([
      { uuid: 'u1', sessionId: 'parent', type: 'user' },
      { uuid: 'u2', sessionId: 'parent', type: 'assistant' },
      { uuid: 'u3', sessionId: 'parent', type: 'user' },
      { uuid: 'u4', sessionId: 'parent', type: 'assistant' },
    ]));

    await prepareFork({
      parentSessionId: 'parent',
      projectPath: '/p',
      parentMessageUuid: 'u3',
      ws: { send: vi.fn() },
      fsImpl,
      uuidImpl: () => FIXED_UUID,
    });

    const outLines = writeFileSync.mock.calls[0][1].trim().split('\n');
    expect(outLines).toHaveLength(3);
  });
});

describe('prepareFork — Behavior 2: mixed types preserved in order', () => {
  it('preserves mixed line types in original order', async () => {
    const { fsImpl, writeFileSync } = makeFs(asLines([
      { type: 'queue-operation', sessionId: 'parent' },
      { uuid: 'u1', type: 'user', sessionId: 'parent' },
      { type: 'progress', sessionId: 'parent' },
      { uuid: 'a1', type: 'assistant', sessionId: 'parent' },
    ]));

    await prepareFork({
      parentSessionId: 'parent',
      projectPath: '/p',
      parentMessageUuid: 'a1',
      ws: { send: vi.fn() },
      fsImpl,
      uuidImpl: () => FIXED_UUID,
    });

    const outLines = writeFileSync.mock.calls[0][1]
      .trim()
      .split('\n')
      .map((l: string) => JSON.parse(l));
    expect(outLines.map((l: any) => l.type)).toEqual(['queue-operation', 'user', 'progress', 'assistant']);
  });
});

describe('prepareFork — Behavior 3: sessionId rewritten on every output line', () => {
  it('rewrites sessionId on every line and emits session_created with the new UUID', async () => {
    const { fsImpl, writeFileSync } = makeFs(asLines(
      Array.from({ length: 3 }, (_, i) => ({ uuid: `u${i}`, sessionId: 'parent-uuid', type: 'user' })),
    ));
    const wsSend = vi.fn();

    await prepareFork({
      parentSessionId: 'parent-uuid',
      projectPath: '/p',
      parentMessageUuid: 'u2',
      ws: { send: wsSend },
      fsImpl,
      uuidImpl: () => FIXED_UUID,
    });

    const outLines = writeFileSync.mock.calls[0][1].trim().split('\n').map((l: string) => JSON.parse(l));
    const ids = new Set(outLines.map((l: any) => l.sessionId));
    expect(ids.size).toBe(1);
    expect([...ids][0]).toBe(FIXED_UUID);

    const frames = wsSend.mock.calls.map((c: any) => c[0]);
    const created = frames.find((f: any) => f.kind === 'session_created');
    expect(created).toBeDefined();
    expect(created.newSessionId).toBe(FIXED_UUID);
    expect(created.provider).toBe('claude');
  });
});

describe('prepareFork — Behavior 3b: sessionId assigned even when original missing', () => {
  it('sets sessionId on lines that originally lacked it', async () => {
    const { fsImpl, writeFileSync } = makeFs(asLines([
      { uuid: 'u1', type: 'user' }, // no sessionId
      { uuid: 'u2', type: 'assistant', sessionId: 'parent' },
    ]));

    await prepareFork({
      parentSessionId: 'parent',
      projectPath: '/p',
      parentMessageUuid: 'u2',
      ws: { send: vi.fn() },
      fsImpl,
      uuidImpl: () => FIXED_UUID,
    });

    const out = writeFileSync.mock.calls[0][1].trim().split('\n').map((l: string) => JSON.parse(l));
    out.forEach((l: any) => expect(l.sessionId).toBe(FIXED_UUID));
  });
});

describe('prepareFork — Behavior 4: uuid and parentUuid preserved verbatim', () => {
  it('preserves uuid and parentUuid unchanged', async () => {
    const { fsImpl, writeFileSync } = makeFs(asLines([
      { uuid: 'u1', parentUuid: null, sessionId: 'p' },
      { uuid: 'u2', parentUuid: 'u1', sessionId: 'p' },
      { uuid: 'u3', parentUuid: 'u2', sessionId: 'p' },
    ]));

    await prepareFork({
      parentSessionId: 'p',
      projectPath: '/p',
      parentMessageUuid: 'u3',
      ws: { send: vi.fn() },
      fsImpl,
      uuidImpl: () => FIXED_UUID,
    });

    const out = writeFileSync.mock.calls[0][1].trim().split('\n').map((l: string) => JSON.parse(l));
    expect(out.map((l: any) => ({ u: l.uuid, p: l.parentUuid }))).toEqual([
      { u: 'u1', p: null },
      { u: 'u2', p: 'u1' },
      { u: 'u3', p: 'u2' },
    ]);
  });
});

describe('prepareFork — first-user uuid rewrite (G-5 grouping fix, 2026-04-16)', () => {
  it('rewrites the first type:user entry uuid so getSessions grouping does not collapse parent and fork', async () => {
    const { fsImpl, writeFileSync } = makeFs(asLines([
      { type: 'queue-operation', sessionId: 'p' },
      { type: 'user', uuid: 'root-user-uuid', parentUuid: null, sessionId: 'p' },
      { type: 'assistant', uuid: 'asst-1', parentUuid: 'root-user-uuid', sessionId: 'p' },
    ]));
    let uuidCall = 0;
    const uuids = ['new-session-uuid', 'new-root-uuid'];
    const uuidImpl = () => uuids[uuidCall++];

    await prepareFork({
      parentSessionId: 'p',
      projectPath: '/p',
      parentMessageUuid: 'asst-1',
      ws: { send: vi.fn() },
      fsImpl,
      uuidImpl,
    });

    const out = writeFileSync.mock.calls[0][1].trim().split('\n').map((l: string) => JSON.parse(l));
    const rootUser = out.find((l: any) => l.type === 'user');
    const asst = out.find((l: any) => l.type === 'assistant');
    expect(rootUser.uuid).toBe('new-root-uuid');
    expect(rootUser.uuid).not.toBe('root-user-uuid');
    // The assistant's parentUuid should follow the rewrite.
    expect(asst.parentUuid).toBe('new-root-uuid');
  });

  it('preserves non-first-user uuids and non-root parentUuids', async () => {
    // A later user turn has parentUuid = assistant-1's uuid, which we don't rewrite.
    const { fsImpl, writeFileSync } = makeFs(asLines([
      { type: 'user', uuid: 'root-user', parentUuid: null, sessionId: 'p' },
      { type: 'assistant', uuid: 'asst-1', parentUuid: 'root-user', sessionId: 'p' },
      { type: 'user', uuid: 'user-2', parentUuid: 'asst-1', sessionId: 'p' },
      { type: 'assistant', uuid: 'asst-2', parentUuid: 'user-2', sessionId: 'p' },
    ]));
    let uuidCall = 0;
    const uuids = ['new-session-uuid', 'new-root-uuid'];
    const uuidImpl = () => uuids[uuidCall++];

    await prepareFork({
      parentSessionId: 'p',
      projectPath: '/p',
      parentMessageUuid: 'asst-2',
      ws: { send: vi.fn() },
      fsImpl,
      uuidImpl,
    });

    const out = writeFileSync.mock.calls[0][1].trim().split('\n').map((l: string) => JSON.parse(l));
    // Non-root entries: uuids unchanged, non-root parentUuids unchanged.
    expect(out[1].uuid).toBe('asst-1');
    expect(out[2].uuid).toBe('user-2');
    expect(out[2].parentUuid).toBe('asst-1'); // not rewritten — asst-1 was not the root
    expect(out[3].uuid).toBe('asst-2');
    expect(out[3].parentUuid).toBe('user-2');
  });

  it('still finds the fork target when the target IS the root user (edge case)', async () => {
    const { fsImpl, writeFileSync } = makeFs(asLines([
      { type: 'user', uuid: 'root-user', parentUuid: null, sessionId: 'p' },
    ]));
    const wsSend = vi.fn();
    let uuidCall = 0;
    const uuids = ['new-session-uuid', 'new-root-uuid'];
    const uuidImpl = () => uuids[uuidCall++];

    await prepareFork({
      parentSessionId: 'p',
      projectPath: '/p',
      parentMessageUuid: 'root-user', // fork AT the root
      ws: { send: wsSend },
      fsImpl,
      uuidImpl,
    });

    // The write should have happened (target was found before rewrite overwrote it).
    expect(writeFileSync).toHaveBeenCalled();
    const frames = wsSend.mock.calls.map((c: any) => c[0]);
    expect(frames.some((f: any) => f.kind === 'session_created')).toBe(true);
    expect(frames.some((f: any) => f.kind === 'error')).toBe(false);
  });
});

describe('prepareFork — Behavior 5: output path uses canonical encoding', () => {
  it('writes output under encoded project dir with temp_testing → temp-testing', async () => {
    const { fsImpl, writeFileSync } = makeFs(asLines([{ uuid: 'u1', sessionId: 'p' }]));

    await prepareFork({
      parentSessionId: 'p',
      projectPath: '/home/maceo/Dev/temp_testing',
      parentMessageUuid: 'u1',
      ws: { send: vi.fn() },
      fsImpl,
      uuidImpl: () => FIXED_UUID,
    });

    const [pathArg] = writeFileSync.mock.calls[0];
    expect(pathArg).toMatch(/\.claude\/projects\/-home-maceo-Dev-temp-testing\/[0-9a-f-]{36}\.jsonl$/);
  });

  it('applies full-alphabet encoding (underscore, colon, whitespace, tilde)', async () => {
    const { fsImpl, writeFileSync } = makeFs(asLines([{ uuid: 'u1', sessionId: 'p' }]));

    await prepareFork({
      parentSessionId: 'p',
      projectPath: '/a/b c_d~e',
      parentMessageUuid: 'u1',
      ws: { send: vi.fn() },
      fsImpl,
      uuidImpl: () => FIXED_UUID,
    });

    const [pathArg] = writeFileSync.mock.calls[0];
    expect(pathArg).toContain('/-a-b-c-d-e/');
  });
});

describe('prepareFork — G-4: session_created carries fromFork marker', () => {
  it('sets fromFork: true on the emitted frame', async () => {
    const { fsImpl } = makeFs(asLines([{ uuid: 'u1', sessionId: 'p' }]));
    const wsSend = vi.fn();

    await prepareFork({
      parentSessionId: 'p',
      projectPath: '/p',
      parentMessageUuid: 'u1',
      ws: { send: wsSend },
      fsImpl,
      uuidImpl: () => FIXED_UUID,
    });

    const frames = wsSend.mock.calls.map((c: any) => c[0]);
    const created = frames.find((f: any) => f.kind === 'session_created');
    expect(created).toBeDefined();
    expect(created.fromFork).toBe(true);
  });
});

describe('prepareFork — Behavior 6: session_created emitted exactly once', () => {
  it('emits session_created exactly once on success', async () => {
    const { fsImpl } = makeFs(asLines([{ uuid: 'u1', sessionId: 'p' }]));
    const wsSend = vi.fn();

    await prepareFork({
      parentSessionId: 'p',
      projectPath: '/p',
      parentMessageUuid: 'u1',
      ws: { send: wsSend },
      fsImpl,
      uuidImpl: () => FIXED_UUID,
    });

    const frames = wsSend.mock.calls.map((c: any) => c[0]);
    const created = frames.filter((f: any) => f.kind === 'session_created');
    expect(created).toHaveLength(1);
  });
});

describe('prepareFork — Behavior 7: error when target uuid not in parent', () => {
  it('emits error and writes no file when target uuid is absent', async () => {
    const { fsImpl, writeFileSync } = makeFs(asLines([{ uuid: 'u1', sessionId: 'p' }]));
    const wsSend = vi.fn();

    await prepareFork({
      parentSessionId: 'p',
      projectPath: '/p',
      parentMessageUuid: 'missing-uuid',
      ws: { send: wsSend },
      fsImpl,
      uuidImpl: () => FIXED_UUID,
    });

    expect(writeFileSync).not.toHaveBeenCalled();
    const frames = wsSend.mock.calls.map((c: any) => c[0]);
    const err = frames.find((f: any) => f.kind === 'error');
    expect(err).toBeDefined();
    expect(err.sessionId).toBe('p');
    expect(err.provider).toBe('claude');
    expect(err.content).toMatch(/not found/i);
    expect(frames.some((f: any) => f.kind === 'session_created')).toBe(false);
  });
});

describe('prepareFork — Behavior 8: error when parent JSONL missing', () => {
  it('emits error on read failure; no file written', async () => {
    const fsImpl: any = {
      readFileSync: vi.fn().mockImplementation(() => {
        const e: any = new Error('ENOENT');
        e.code = 'ENOENT';
        throw e;
      }),
      writeFileSync: vi.fn(),
    };
    const wsSend = vi.fn();

    await prepareFork({
      parentSessionId: 'p',
      projectPath: '/p',
      parentMessageUuid: 'u1',
      ws: { send: wsSend },
      fsImpl,
      uuidImpl: () => FIXED_UUID,
    });

    expect(fsImpl.writeFileSync).not.toHaveBeenCalled();
    const frames = wsSend.mock.calls.map((c: any) => c[0]);
    const err = frames.find((f: any) => f.kind === 'error');
    expect(err).toBeDefined();
    expect(err.sessionId).toBe('p');
  });
});
