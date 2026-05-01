import { describe, expect, it } from 'vitest';
import { runInstall } from './deployHarness';

describe('post-install health checks', () => {
  it('checks service, routes, websocket readiness, and agent cli versions', () => {
    const result = runInstall(['--dry-run', '--run-step', 'run_health_checks', '--ref', 'v1.28.0', '--no-tls']);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('systemctl is-active cc-agent-ui');
    expect(result.stdout).toContain('http://127.0.0.1:3001/health');
    expect(result.stdout).toContain('http://127.0.0.1:3001/');
    expect(result.stdout).toContain('http://127.0.0.1:3001/app');
    expect(result.stdout).toContain('node -e');
    expect(result.stdout).toContain('/home/cloudcli/.local/bin/claude --version');
    expect(result.stdout).toContain('/home/cloudcli/.local/bin/codex --version');
    expect(result.stdout).toContain('/home/cloudcli/.local/bin/gemini --version');
  });

  it('supports verify-only mode without installation steps', () => {
    const result = runInstall(['--dry-run', '--verify-only', '--ref', 'v1.28.0', '--no-tls']);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('systemctl is-active cc-agent-ui');
    expect(result.stdout).not.toContain('apt-get update');
  });
});

