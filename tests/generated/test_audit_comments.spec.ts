// G-3 + G-8: audit-traceability comments are present in the code they describe.
// These static checks guarantee the audit findings remain discoverable in-source.
// See thoughts/searchable/shared/research/2026-04-16-session-handling-audit.md

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

describe('audit-traceability comments', () => {
  it('fork.js documents G-3 caller-minted UUID reliance', () => {
    const src = readFileSync(path.join(ROOT, 'server/fork.js'), 'utf8');
    expect(src).toMatch(/NOTE \(G-3\)/);
  });

  it('adapter.js documents G-8 caller-supplied sessionId trust', () => {
    const src = readFileSync(path.join(ROOT, 'server/providers/claude/adapter.js'), 'utf8');
    expect(src).toMatch(/NOTE \(G-8\)/);
  });

  it('projects.js documents the canonical encodeProjectPath rule (G-1 source of truth)', () => {
    const src = readFileSync(path.join(ROOT, 'server/projects.js'), 'utf8');
    expect(src).toMatch(/encodeProjectPath/);
    expect(src).toMatch(/\/\[\^a-zA-Z0-9\]\/g/);
  });
});
