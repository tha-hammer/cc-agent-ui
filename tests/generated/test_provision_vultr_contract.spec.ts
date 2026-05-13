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
      '--monorepo-ref', 'v1.28.0',
      '--client-id', 'acme',
      '--domain', 'app.example.com',
      '--email', 'ops@example.com',
    ]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('git -C "${tmp_dir}/cc-agent-ui" fetch --tags origin');
    expect(result.stdout).toContain('git -C "${tmp_dir}/cc-agent-ui" checkout --force v1.28.0');
    expect(result.stdout).toContain('--repo-url https://github.com/tha-hammer/cc-agent-ui.git');
    expect(result.stdout).toContain('--ref v1.28.0');
    expect(result.stdout).toContain('--monorepo-ref v1.28.0');
    expect(result.stdout).toContain('--client-id acme');
    expect(result.stdout).toContain('export CC_AGENT_UI_CLIENT_ID=acme');
    expect(result.stdout).toContain('export CC_AGENT_UI_MONOREPO_REF=v1.28.0');
    expect(result.stdout).toContain('export CC_AGENT_UI_REQUIRED_MONOREPO_APPS=cosmic-agent-core\\,silmari-genui\\,cosmic-video');
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
      '--monorepo-ref', 'v1.28.0',
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
      '--monorepo-ref', 'v1.28.0',
      '--no-tls',
    ]);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('--client-id');
  });

  it('requires a monorepo ref when rendering a startup script directly', () => {
    const result = runProvision([
      '--render-startup-script',
      '--repo-url', 'https://github.com/tha-hammer/cc-agent-ui.git',
      '--ref', 'v1.28.0',
      '--client-id', 'acme',
      '--no-tls',
    ]);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('--monorepo-ref');
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
      '--monorepo-ref', 'v1.28.0',
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
    expect(result.stdout).toContain('"monorepo_ref":"v1.28.0"');
    expect(result.stdout).toContain('"required_monorepo_apps":"cosmic-agent-core,silmari-genui,cosmic-video"');
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
      '--monorepo-ref', 'v1.28.0',
      '--client-id', 'acme',
      '--no-tls',
    ]);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('--ssh-key-name');
  });

  it('encodes startup scripts as base64 before sending them to Vultr', () => {
    const result = runProvision(['--print-api-payload', 'startup-script'], {
      env: {
        VULTR_TEST_STARTUP_SCRIPT: '#!/usr/bin/env bash\necho e2e',
        VULTR_TEST_LABEL: 'cc-agent-ui-test',
      },
    });

    expect(result.status).toBe(0);
    const payload = JSON.parse(result.stdout);
    expect(payload).toEqual({
      name: 'cc-agent-ui-test-installer',
      type: 'boot',
      script: Buffer.from('#!/usr/bin/env bash\necho e2e', 'utf8').toString('base64'),
    });
  });
});
