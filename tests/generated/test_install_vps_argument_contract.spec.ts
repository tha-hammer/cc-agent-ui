import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { runInstall } from './deployHarness';

describe('commercial VPS installer arguments', () => {
  it('keeps deploy shell entry points syntax valid', () => {
    execFileSync('bash', ['-n', 'scripts/deploy/install-vps.sh']);
    execFileSync('bash', ['-n', 'scripts/deploy/provision-vultr.sh']);
  });

  it('prints parsed config without performing installation', () => {
    const result = runInstall([
      '--print-config',
      '--ref', 'v1.28.0',
      '--client-id', 'acme',
      '--repo-url', 'https://example.invalid/repo.git',
      '--no-tls',
    ]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('repo_ref=v1.28.0');
    expect(result.stdout).toContain('client_id=acme');
    expect(result.stdout).toContain('repo_url=https://example.invalid/repo.git');
    expect(result.stdout).toContain('tls_enabled=false');
  });

  it('uses CLI flags before environment variables', () => {
    const result = runInstall([
      '--print-config',
      '--repo-url', 'https://example.invalid/cli.git',
      '--ref', 'v1.28.0',
      '--client-id', 'cli-client',
      '--domain', 'app.example.com',
      '--email', 'ops@example.com',
    ], {
      env: {
        CC_AGENT_UI_REPO_URL: 'https://example.invalid/env.git',
        CC_AGENT_UI_REF: 'v9.9.9',
      },
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('repo_url=https://example.invalid/cli.git');
    expect(result.stdout).toContain('repo_ref=v1.28.0');
    expect(result.stdout).toContain('client_id=cli-client');
    expect(result.stdout).toContain('domain=app.example.com');
    expect(result.stdout).toContain('email=ops@example.com');
  });

  it('requires a client id before a full commercial install can mutate the host', () => {
    const result = runInstall(['--dry-run', '--ref', 'v1.28.0', '--no-tls']);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('--client-id');
  });

  it('rejects unknown options', () => {
    const result = runInstall(['--print-config', '--ref', 'v1.28.0', '--does-not-exist']);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('unknown option');
  });

  it('prints help without requiring root or a release ref', () => {
    const result = runInstall(['--help']);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('--repo-url');
    expect(result.stdout).toContain('--client-id');
    expect(result.stdout).toContain('--verify-only');
  });
});
