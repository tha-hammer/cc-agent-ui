import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('CcuSessionAgent — canonical helper reuse (Phase 1 · B1)', () => {
  const srcPath = path.join(process.cwd(), 'server', 'agents', 'ccu-session-agent.js');
  const src = fs.readFileSync(srcPath, 'utf8');

  it('imports encodeProjectPath from server/projects.js', () => {
    expect(src).toMatch(/from ['"]\.\.\/projects\.js['"]/);
    expect(src).toMatch(/encodeProjectPath/);
  });

  it('imports isSubagentSession from server/projects.js', () => {
    expect(src).toMatch(/isSubagentSession/);
  });

  it('imports isMetaSession from server/projects.js', () => {
    expect(src).toMatch(/isMetaSession/);
  });

  it('does not inline a second path-encoding regex', () => {
    expect(src).not.toMatch(/replace\(\s*\/\[\^a-zA-Z0-9\]\/g/);
    expect(src).not.toMatch(/replace\(\s*\/\[\\\\\/:\\s~_\]\/g/);
  });
});
