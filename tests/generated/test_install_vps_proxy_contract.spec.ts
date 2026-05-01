import { describe, expect, it } from 'vitest';
import { renderCaddyfile, renderNginxServerBlock } from '../../scripts/deploy/testable-proxy-renderers';
import { runInstall } from './deployHarness';

describe('TLS proxy setup contract', () => {
  it('renders Caddy HTTPS reverse proxy config', () => {
    expect(renderCaddyfile({ domain: 'app.example.com', upstream: '127.0.0.1:3001' }))
      .toContain('reverse_proxy 127.0.0.1:3001');
  });

  it('renders nginx WebSocket upgrade headers', () => {
    const config = renderNginxServerBlock({
      domain: 'app.example.com',
      upstream: '127.0.0.1:3001',
    });

    expect(config).toContain('proxy_set_header Upgrade $http_upgrade;');
    expect(config).toContain('proxy_set_header Connection "upgrade";');
  });

  it('skips proxy package installation when TLS is disabled', () => {
    const result = runInstall(['--dry-run', '--run-step', 'configure_proxy', '--ref', 'v1.28.0', '--no-tls']);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('TLS/proxy setup disabled');
    expect(result.stdout).not.toContain('apt-get install');
  });
});

