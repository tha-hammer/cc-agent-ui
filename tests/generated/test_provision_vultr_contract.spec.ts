import { describe, expect, it } from 'vitest';
import { runProvision } from './deployHarness';

describe('Vultr provisioner contract', () => {
  it('requires a Vultr API token for API calls', () => {
    const result = runProvision(['--api-smoke-test', 'GET', '/v2/regions']);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('VULTR_API_KEY');
  });

  it('retries 429 without logging the API token', () => {
    const result = runProvision(['--api-smoke-test', 'GET', '/v2/regions'], {
      env: {
        VULTR_API_KEY: 'secret-token',
        VULTR_TEST_HTTP_STATUSES: '429,429,200',
      },
    });

    expect(result.status).toBe(0);
    expect(result.stderr).not.toContain('secret-token');
    expect(result.stdout).toContain('attempt=3 status=200');
  });

  it('builds a startup script using pinned repo/ref and TLS options', () => {
    const result = runProvision([
      '--render-startup-script',
      '--repo-url', 'https://github.com/tha-hammer/cc-agent-ui.git',
      '--ref', 'v1.28.0',
      '--client-id', 'acme',
      '--domain', 'app.example.com',
      '--email', 'ops@example.com',
    ]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('git -C "${tmp_dir}/cc-agent-ui" fetch --tags origin');
    expect(result.stdout).toContain('git -C "${tmp_dir}/cc-agent-ui" checkout --force v1.28.0');
    expect(result.stdout).toContain('--repo-url https://github.com/tha-hammer/cc-agent-ui.git');
    expect(result.stdout).toContain('--ref v1.28.0');
    expect(result.stdout).toContain('--client-id acme');
    expect(result.stdout).toContain('export CC_AGENT_UI_CLIENT_ID=acme');
    expect(result.stdout).toContain('--domain app.example.com');
    expect(result.stdout).toContain('--email ops@example.com');
    expect(result.stdout).not.toContain('VULTR_API_KEY');
  });

  it('renders startup checkout in a way that also supports commit SHA refs', () => {
    const sha = '4d96713227f6a3c4c62a096199b13032a1fb747a';
    const result = runProvision([
      '--render-startup-script',
      '--repo-url', 'https://github.com/tha-hammer/cc-agent-ui.git',
      '--ref', sha,
      '--client-id', 'sha-client',
      '--no-tls',
    ]);

    expect(result.status).toBe(0);
    expect(result.stdout).not.toContain(`--branch ${sha}`);
    expect(result.stdout).toContain(`git -C "\${tmp_dir}/cc-agent-ui" checkout --force ${sha}`);
    expect(result.stdout).toContain(`--ref ${sha}`);
  });

  it('requires a client id when rendering a startup script directly', () => {
    const result = runProvision([
      '--render-startup-script',
      '--repo-url', 'https://github.com/tha-hammer/cc-agent-ui.git',
      '--ref', 'v1.28.0',
      '--no-tls',
    ]);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('--client-id');
  });

  it('prints a dry-run provisioning payload without network access', () => {
    const result = runProvision([
      '--dry-run',
      '--label', 'cc-agent-ui-test',
      '--region', 'ewr',
      '--plan', 'vc2-2c-4gb',
      '--os-id', '2284',
      '--ssh-key-name', 'operator',
      '--ssh-public-key-file', '/tmp/operator.pub',
      '--repo-url', 'https://github.com/tha-hammer/cc-agent-ui.git',
      '--ref', 'v1.28.0',
      '--client-id', 'acme',
      '--no-tls',
    ]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('"label":"cc-agent-ui-test"');
    expect(result.stdout).toContain('"client_id":"acme"');
    expect(result.stdout).toContain('"region":"ewr"');
    expect(result.stdout).toContain('"plan":"vc2-2c-4gb"');
    expect(result.stdout).toContain('"ssh_key_name":"operator"');
    expect(result.stdout).toContain('"ssh_public_key_file":"/tmp/operator.pub"');
  });

  it('requires ssh key inputs when creating an instance payload', () => {
    const result = runProvision([
      '--dry-run',
      '--label', 'cc-agent-ui-test',
      '--region', 'ewr',
      '--plan', 'vc2-2c-4gb',
      '--os-id', '2284',
      '--repo-url', 'https://github.com/tha-hammer/cc-agent-ui.git',
      '--ref', 'v1.28.0',
      '--client-id', 'acme',
      '--no-tls',
    ]);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('--ssh-key-name');
  });
});
