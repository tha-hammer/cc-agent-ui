import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { runInstall } from './deployHarness';

describe('agent CLI installation contract', () => {
  it('installs claude, codex, and gemini under cloudcli .local', () => {
    const result = runInstall(['--dry-run', '--run-step', 'install_agent_clis', '--ref', 'v1.28.0', '--no-tls']);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('install -d -m 755 -o cloudcli -g cloudcli /home/cloudcli/.local /home/cloudcli/.local/bin /home/cloudcli/.local/lib /home/cloudcli/.local/share');
    expect(result.stdout).toContain('chown -R cloudcli:cloudcli /home/cloudcli/.local');
    expect(result.stdout).toContain('npm install -g --prefix /home/cloudcli/.local @anthropic-ai/claude-code @openai/codex @google/gemini-cli');
    expect(result.stdout).toContain('/home/cloudcli/.local/bin/claude --version');
    expect(result.stdout).toContain('/home/cloudcli/.local/bin/codex --version');
    expect(result.stdout).toContain('/home/cloudcli/.local/bin/gemini --version');
  });

  it('keeps cloudcli .local bin before system binaries in systemd PATH', () => {
    const unit = readFileSync('scripts/deploy/cc-agent-ui.service', 'utf8');

    expect(unit).toContain('Environment=PATH=/home/cloudcli/.bun/bin:/home/cloudcli/.local/bin:/usr/local/bin:/usr/bin:/bin');
  });
});
