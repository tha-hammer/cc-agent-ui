import { describe, expect, it } from 'vitest';
import { runInstall } from './deployHarness';

describe('commercial release ref policy', () => {
  it('rejects missing release ref', () => {
    const result = runInstall(['--print-config'], {
      env: {
        CC_AGENT_UI_REF: '',
      },
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('--ref');
  });

  it('accepts pinned semver tag refs', () => {
    const result = runInstall(['--print-config', '--ref', 'v1.28.0', '--no-tls']);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('repo_ref=v1.28.0');
  });

  it('accepts commit SHA refs', () => {
    const result = runInstall([
      '--print-config',
      '--ref', '0123456789abcdef0123456789abcdef01234567',
      '--no-tls',
    ]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('repo_ref=0123456789abcdef0123456789abcdef01234567');
  });

  it('rejects floating refs unless explicitly allowed', () => {
    const result = runInstall(['--print-config', '--ref', 'main', '--no-tls']);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('--allow-floating-ref');
  });

  it('accepts floating refs only with explicit override', () => {
    const result = runInstall([
      '--print-config',
      '--ref', 'main',
      '--allow-floating-ref',
      '--no-tls',
    ]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('allow_floating_ref=true');
  });
});

