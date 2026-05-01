import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('commercial deploy documentation', () => {
  it('documents pinned install, CLIs, TLS, and provisioning safety', () => {
    const docs = readFileSync('docs/DEPLOY.md', 'utf8');

    expect(docs).toContain('--ref v');
    expect(docs).toContain('--client-id');
    expect(docs).toContain('one client per VPS');
    expect(docs).toContain('claude');
    expect(docs).toContain('codex');
    expect(docs).toContain('gemini');
    expect(docs).toContain('VULTR_API_KEY');
    expect(docs).toContain('--no-tls');
    expect(docs).toContain('/app');
  });
});
