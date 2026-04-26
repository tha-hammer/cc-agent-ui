import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  makeApiError,
  validatePermissionDecisionBody,
  validateQuestionAnswerBody,
  validateRunId,
  validateStartRunRequest,
} from '../../server/algorithm-runs/contracts.js';

describe('Algorithm Run contract validation', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'algorithm-contracts-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('rejects unsupported schema versions and providers', () => {
    expect(validateStartRunRequest({ schemaVersion: 2 }).ok).toBe(false);
    expect(validateStartRunRequest({
      schemaVersion: 1,
      provider: 'nolme',
      projectPath: tempDir,
      prompt: 'run',
    }).ok).toBe(false);
  });

  it('rejects run ids that can escape the run store', () => {
    expect(validateRunId('../escape').ok).toBe(false);
    expect(validateRunId('.hidden').ok).toBe(false);
    expect(validateRunId('with/slash').ok).toBe(false);
    expect(validateRunId('bad%2Fescape').ok).toBe(false);
    expect(validateRunId('valid-run_123').ok).toBe(true);
  });

  it('returns versioned API error envelopes', () => {
    expect(makeApiError('invalid_request', 'bad')).toEqual({
      ok: false,
      schemaVersion: 1,
      error: { code: 'invalid_request', message: 'bad' },
    });
  });

  it('validates start and decision bodies', () => {
    expect(validateStartRunRequest({
      schemaVersion: 1,
      provider: 'claude',
      projectPath: 'relative/path',
      prompt: 'run',
    }).ok).toBe(false);
    expect(validateStartRunRequest({
      schemaVersion: 1,
      provider: 'claude',
      projectPath: tempDir,
      prompt: 'run',
    }).ok).toBe(true);
    expect(validateQuestionAnswerBody({ schemaVersion: 1, answer: '' }).ok).toBe(false);
    expect(validatePermissionDecisionBody({ schemaVersion: 1, allow: 'yes' }).ok).toBe(false);
    expect(validatePermissionDecisionBody({ schemaVersion: 1, allow: true }).ok).toBe(true);
  });
});

