import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { isReadableProjectPath } from '../../server/utils/readable-paths.js';

describe('readable project paths', () => {
  it('allows project-root files and Claude config files', () => {
    const projectRoot = path.join(os.tmpdir(), 'readable-paths-project');
    expect(isReadableProjectPath(path.join(projectRoot, 'REPORT.md'), { projectRoot })).toBe(true);
    expect(isReadableProjectPath(path.join(os.homedir(), '.claude', 'projects', 'session.jsonl'), { projectRoot })).toBe(true);
  });

  it('allows Claude async agent task output files under the current user temp root', () => {
    const outputPath = path.join(os.tmpdir(), 'claude-1000', '-home-maceo', 'tasks', 'agent.output');
    expect(isReadableProjectPath(outputPath, { projectRoot: '/workspace/demo-project', uid: 1000 })).toBe(true);
  });

  it('rejects unrelated temp files and non-output files in Claude task folders', () => {
    expect(isReadableProjectPath(
      path.join(os.tmpdir(), 'claude-1000', '-home-maceo', 'tasks', 'agent.txt'),
      { projectRoot: '/workspace/demo-project', uid: 1000 },
    )).toBe(false);
    expect(isReadableProjectPath(
      path.join(os.tmpdir(), 'other', '-home-maceo', 'tasks', 'agent.output'),
      { projectRoot: '/workspace/demo-project', uid: 1000 },
    )).toBe(false);
  });
});
