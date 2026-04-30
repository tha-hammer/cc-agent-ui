# Commercial Vultr Installer TDD Implementation Plan

## Overview

Create a commercial-grade deployment path for cc-agent-ui on Vultr VPS instances. The near-term target remains a single Ubuntu VPS running a hardened `cc-agent-ui` systemd service as `cloudcli`, with optional TLS reverse proxy automation and a separate operator-side Vultr provisioning wrapper.

The implementation must be test-driven. Each behavior below starts with an observable failing test, then the smallest implementation that passes, then a refactor pass that keeps the installer idempotent and safe to re-run.

## Current State Analysis

The current VPS installer already provisions a non-root service user, installs Node 22 and bun, clones the repo, installs dependencies, installs a hardened systemd unit, starts the service, and verifies the systemd owner.

Key discoveries:

- `scripts/deploy/install-vps.sh` is a monolithic bash script that runs `main "$@"` unconditionally, which makes isolated unit tests difficult without root side effects: `scripts/deploy/install-vps.sh:182`.
- `install-vps.sh` currently defaults `CC_AGENT_UI_REF` to `main`, while docs only recommend tagged production releases: `scripts/deploy/install-vps.sh:28` and `docs/DEPLOY.md:107`.
- The service PATH already prioritizes `/home/cloudcli/.local/bin`, so user-owned agent CLI installs will win over `/usr/bin`: `scripts/deploy/cc-agent-ui.service:12`.
- The deployment guide states the app must not run as root because state lives in `~/.claude`, `~/.codex`, `~/.gemini`, `~/.cloudcli`, and other user home directories: `docs/DEPLOY.md:5`.
- The app exposes a public `/health` endpoint and has `/ws` WebSocket routing in the same Node server: `server/index.js:414` and `server/index.js:1512`.
- Current tests use Vitest and generated tests under `tests/generated`: `package.json:31` and `vitest.config.ts:9`.
- Existing server tests use local Express servers and temp dirs, which is the right pattern for deploy helper unit tests that do not touch real system state: `tests/generated/test_nolme_static_serve.spec.ts:13` and `tests/generated/test_app_route_skills_route.spec.ts:16`.

External Vultr findings to preserve in implementation:

- VKE is useful later for containerized, multi-node deployments, but VPS maps better to the current user-home state model. VKE is managed Kubernetes with service discovery, load balancing, rollouts, self-healing, and storage orchestration. Source: https://docs.vultr.com/support/products/vke/what-is-kubernetes-and-vultr-kubernetes-engine
- VKE minimums are one node pool, at least one worker node, at least 2 GB RAM, networking, and a supported Kubernetes version. Source: https://docs.vultr.com/support/products/vke/what-are-the-minimum-requirements-for-deploying-a-vultr-kubernetes-engine-cluster
- Vultr API calls can receive `429 Too Many Requests` above 30 requests per second per originating IP and should use retry/backoff. Source: https://docs.vultr.com/support/platform/api/what-rate-limits-apply-to-the-vultr-api
- Vultr API keys should be treated as powerful account credentials. Current docs say product-level API key scoping is not supported and recommend ACLs for source-IP restriction. Source: https://docs.vultr.com/support/platform/api/can-i-scope-api-keys-to-specific-products

## Desired End State

The deploy path has two scripts:

- `scripts/deploy/install-vps.sh`: runs on the target VPS as root. It installs system dependencies, creates or updates `cloudcli`, installs bun and the agent CLIs under `/home/cloudcli/.local`, checks out a pinned release, installs app deps, configures optional TLS proxying, starts systemd, and verifies app readiness.
- `scripts/deploy/provision-vultr.sh`: runs from an operator machine or CI. It uses `VULTR_API_KEY` to create or find account resources, provision a Vultr VPS, handle API retries/backoff, avoid token leakage, and execute the VPS installer through startup script or SSH.

Observable behaviors:

- Given the installer is invoked with commercial options, when it parses arguments, then config values come from CLI flags first, then environment, then safe defaults.
- Given no pinned ref is supplied, when commercial install starts, then it refuses to silently deploy floating `main` unless an explicit override is provided.
- Given `cloudcli` exists, when agent CLIs are installed, then `claude`, `codex`, and `gemini` resolve from `/home/cloudcli/.local/bin`.
- Given a domain and email are supplied, when TLS proxy setup runs, then Caddy or nginx config proxies `/` and WebSocket traffic to `127.0.0.1:3001`.
- Given `--no-tls` is supplied, when proxy setup runs, then no public TLS proxy is installed and the service remains bound locally.
- Given the service starts, when health checks run, then `/health`, `/`, `/app`, WebSocket readiness, service owner, and CLI availability are explicitly checked.
- Given Vultr API returns `429`, when the provisioner calls the API, then it retries with bounded exponential backoff without logging the token.
- Given required Vultr provisioning inputs are present, when the wrapper runs, then it creates or reuses SSH key/startup script/instance resources and records the instance IP without exposing secrets.
- Given a code improvement is released, when the operator rolls it out to a fleet, then the rollout advances through explicit rings, verifies health at each ring, and stops automatically on failure thresholds.
- Given a customer instance is already healthy on the prior release, when an upgrade fails, then the rollout tool can restore the prior ref and rerun health checks without requiring hand-edited SSH commands.

## Deployment Rollout Model By Client Count

The commercial installer starts as a per-instance VPS installer, but code improvements need a rollout layer once there is more than one customer. The rollout layer should be separate from `install-vps.sh`: the installer changes one host; the rollout controller decides which hosts receive the change, in what order, and when to stop.

Scale bands:

| Client count | Deployment shape | Rollout approach | Operational requirement |
| --- | --- | --- | --- |
| 10 | One VPS per client, mostly manual operations acceptable | Operator runs `provision-vultr.sh` or `rollout-vps.sh` against a checked inventory; update 1 canary, then remaining clients | A simple `deployments/clients.json` inventory and per-host health checks are enough |
| 100 | One VPS per client, scripted fleet operations required | Ring rollout: internal/staging, 1-5 customer canaries, 20%, 50%, 100% | Central rollout ledger, retry policy, rollback command, and per-client version status |
| 1,000 | VPS fleet, regional grouping starts to matter | Batched rollout by region/account shard with concurrency limits and automatic pause on failures | Inventory must be queryable; rollout jobs must be resumable and auditable |
| 10,000 | Fleet orchestration becomes a product subsystem | Progressive delivery controller with health/error SLO gates and automated rollback by cohort | Central control plane, telemetry, release channels, and strong change windows |
| 100,000 | Single-VPS-per-client operations become expensive | Move most customers to clustered/containerized hosting or managed tenant pools; keep dedicated VPS for enterprise isolation | Kubernetes/VKE or equivalent, centralized config/secrets, distributed observability |
| 1,000,000 | Multi-region platform | Region-by-region progressive delivery, feature flags, canaries, and global rollback | Dedicated SRE/infra automation, platform control plane, multi-region failover |
| 10,000,000 | Internet-scale platform | Continuous delivery with strict blast-radius controls, feature flags, cell-based architecture, and automated incident response | Cell architecture, global traffic management, load shedding, compliance-grade audit trails |

Pragmatic interpretation:

- From 10 to 1,000 clients, we can keep dedicated VPS deployments if the rollout tool is careful, resumable, and health-gated.
- Around 10,000 clients, the installer is still useful for dedicated customer installs, but the default product architecture should start moving toward pooled infrastructure, release channels, and centralized telemetry.
- At 100,000 clients and above, "install script per customer VPS" becomes an enterprise/dedicated path, not the main platform path. The mainstream path should be Kubernetes/cluster/cell-based deployment with feature flags and automated progressive delivery.
- The TDD scope here should implement the first fleet-safe step: an inventory-driven VPS rollout wrapper that can update, verify, pause, and rollback code improvements across many existing VPS installs.

## What We Are Not Doing

- No Kubernetes/VKE deployment in this plan.
- No multi-tenant application architecture changes.
- No managed database, object storage, or persistent-volume migration.
- No customer billing, license enforcement, or marketplace packaging.
- No automatic migration of existing customer data from root-owned installs beyond preserving the existing documented migration path.
- No full global control plane implementation. This plan only introduces the rollout contracts and the first VPS-fleet rollout wrapper needed before a larger platform migration.

## Testing Strategy

- Framework: Vitest for contract/unit tests already included by `npm test`.
- Shell syntax: add `bash -n` checks from Vitest for both deploy scripts.
- Shell behavior: add a fake-command harness that runs deploy script functions with temp PATH shims and records commands instead of touching the host.
- HTTP/WebSocket checks: unit test generated command content and add a focused local Node health-check helper test where practical.
- Vultr API wrapper: unit test retry/backoff and token redaction by stubbing `curl` or a small shell function wrapper.

Proposed new test files:

- `tests/generated/test_install_vps_argument_contract.spec.ts`
- `tests/generated/test_install_vps_release_ref_contract.spec.ts`
- `tests/generated/test_install_vps_agent_cli_contract.spec.ts`
- `tests/generated/test_install_vps_proxy_contract.spec.ts`
- `tests/generated/test_install_vps_health_checks.spec.ts`
- `tests/generated/test_provision_vultr_contract.spec.ts`
- `tests/generated/test_rollout_vps_contract.spec.ts`
- `tests/generated/test_deployment_inventory_contract.spec.ts`
- `tests/generated/deployHarness.ts`

Proposed implementation files:

- `scripts/deploy/install-vps.sh`
- `scripts/deploy/provision-vultr.sh`
- `scripts/deploy/rollout-vps.sh`
- `scripts/deploy/lib/deploy-common.sh`
- `docs/DEPLOY.md`

## Behavior 1: Installer Entry Points Are Testable

### Test Specification

Given `install-vps.sh` and `provision-vultr.sh` are shell entry points, when tests load or syntax-check them, then tests can inspect functions and config without executing root-only installation side effects.

Edge cases:

- Direct execution still calls `main`.
- Test mode or library sourcing does not call `main`.
- `bash -n` passes for every shell file.

### TDD Cycle

#### Red: Write Failing Test

File: `tests/generated/test_install_vps_argument_contract.spec.ts`

```ts
import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';

describe('deploy shell entry points', () => {
  it('are bash syntax valid', () => {
    execFileSync('bash', ['-n', 'scripts/deploy/install-vps.sh']);
    execFileSync('bash', ['-n', 'scripts/deploy/provision-vultr.sh']);
  });

  it('can print parsed config without performing installation', () => {
    const output = execFileSync('bash', [
      'scripts/deploy/install-vps.sh',
      '--print-config',
      '--ref', 'v1.28.0',
      '--repo-url', 'https://example.invalid/repo.git',
      '--no-tls',
    ], { encoding: 'utf8' });

    expect(output).toContain('repo_ref=v1.28.0');
    expect(output).toContain('repo_url=https://example.invalid/repo.git');
    expect(output).toContain('tls_enabled=false');
  });
});
```

#### Green: Minimal Implementation

File: `scripts/deploy/install-vps.sh`

- Add `parse_args`.
- Add `--print-config`.
- Guard `main "$@"` so sourced/test config paths do not execute installation.
- Keep direct execution behavior unchanged except for new argument handling.

#### Refactor

Move shared helpers such as `log`, `die`, `require_command`, and argument normalization into `scripts/deploy/lib/deploy-common.sh` once the tests pass.

### Success Criteria

Automated:

- `npm test -- tests/generated/test_install_vps_argument_contract.spec.ts` fails before the guard/options exist.
- The same test passes after minimal implementation.
- `bash -n scripts/deploy/install-vps.sh scripts/deploy/provision-vultr.sh` passes.

Manual:

- Running `sudo bash scripts/deploy/install-vps.sh --help` does not modify the server.
- Running the installer without `--print-config` still follows the install path.

## Behavior 2: Commercial Installs Require an Explicit Release Ref

### Test Specification

Given no `--ref` and no `CC_AGENT_UI_REF`, when the VPS installer runs in normal commercial mode, then it exits before cloning and prints an actionable error.

Given `--ref v1.28.0` or `CC_AGENT_UI_REF=v1.28.0`, when config is parsed, then that value is used for checkout.

Given `--ref main` is supplied, when no floating-ref override is supplied, then the installer rejects it.

Edge cases:

- Commit SHA refs are allowed.
- Semantic tag refs like `v1.28.0` are allowed.
- Floating refs like `main`, `master`, and `develop` require explicit `--allow-floating-ref`.

### TDD Cycle

#### Red: Write Failing Test

File: `tests/generated/test_install_vps_release_ref_contract.spec.ts`

```ts
import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';

describe('commercial release ref policy', () => {
  it('rejects missing release ref', () => {
    const result = spawnSync('bash', ['scripts/deploy/install-vps.sh', '--print-config'], {
      encoding: 'utf8',
      env: { ...process.env, CC_AGENT_UI_REF: '' },
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('--ref');
  });

  it('accepts pinned semver tag refs', () => {
    const result = spawnSync('bash', [
      'scripts/deploy/install-vps.sh',
      '--print-config',
      '--ref', 'v1.28.0',
      '--no-tls',
    ], { encoding: 'utf8' });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('repo_ref=v1.28.0');
  });
});
```

#### Green: Minimal Implementation

File: `scripts/deploy/install-vps.sh`

- Remove silent default to `main`.
- Accept `--ref` and `CC_AGENT_UI_REF`.
- Add `validate_repo_ref`.
- Add `--allow-floating-ref` only for explicit non-production operator use.

#### Refactor

Keep validation pure and testable in `deploy-common.sh`; `ensure_repo` should only consume normalized config.

### Success Criteria

Automated:

- Missing ref test fails before validation exists.
- Floating ref rejection is covered.
- Existing clone/update tests use pinned refs.

Manual:

- `sudo bash scripts/deploy/install-vps.sh --ref v1.28.0 --no-tls` proceeds.
- `sudo bash scripts/deploy/install-vps.sh --ref main` stops with a clear message.

## Behavior 3: Agent CLIs Install Under `/home/cloudcli/.local`

### Test Specification

Given the `cloudcli` user exists, when the installer installs agent CLIs, then it installs the npm packages with `npm install -g --prefix /home/cloudcli/.local` and verifies `claude`, `codex`, and `gemini` from that prefix.

Edge cases:

- Existing matching commands are accepted only if they resolve from `/home/cloudcli/.local/bin`.
- Root-owned `/usr/bin/claude` does not satisfy the user-owned install check.
- A failed CLI version command aborts installation.

### TDD Cycle

#### Red: Write Failing Test

File: `tests/generated/test_install_vps_agent_cli_contract.spec.ts`

```ts
import { describe, expect, it } from 'vitest';
import { runInstallFunctionWithFakes } from './deployHarness';

describe('agent CLI installation', () => {
  it('installs claude, codex, and gemini under cloudcli .local', async () => {
    const result = await runInstallFunctionWithFakes('install_agent_clis');

    expect(result.commands).toContainEqual(expect.arrayContaining([
      'npm', 'install', '-g', '--prefix', '/home/cloudcli/.local',
      '@anthropic-ai/claude-code', '@openai/codex', '@google/gemini-cli',
    ]));
    expect(result.commandsText).toContain('/home/cloudcli/.local/bin/claude --version');
    expect(result.commandsText).toContain('/home/cloudcli/.local/bin/codex --version');
    expect(result.commandsText).toContain('/home/cloudcli/.local/bin/gemini --version');
  });
});
```

#### Green: Minimal Implementation

File: `scripts/deploy/install-vps.sh`

- Add `install_agent_clis` after `ensure_bun` and before `ensure_repo`.
- Create `/home/cloudcli/.local/bin`.
- Run npm as `cloudcli` with `--prefix "$SVC_HOME/.local"`.
- Verify versions with `PATH="$SVC_HOME/.local/bin:$PATH"`.

#### Refactor

Introduce a small data list for package/command pairs so adding future CLIs does not duplicate logic.

### Success Criteria

Automated:

- Fake-command test verifies commands and order.
- Static test verifies service PATH still includes `/home/cloudcli/.local/bin` before `/usr/bin`.

Manual:

- On a fresh VPS: `sudo -u cloudcli -H bash -lc 'command -v claude codex gemini'` resolves all three.
- `claude --version`, `codex --version`, and `gemini --version` return non-empty versions as `cloudcli`.

## Behavior 4: CLI Options Normalize Deployment Configuration

### Test Specification

Given CLI flags and environment variables, when config is parsed, then flags override environment variables and normalized config is emitted consistently.

Required options:

- `--domain <host>`
- `--email <address>`
- `--no-tls`
- `--repo-url <url>`
- `--ref <tag-or-sha>`

Recommended additional option:

- `--proxy caddy|nginx|none`, defaulting to `caddy` when `--domain` and `--email` are supplied and `none` when `--no-tls` is supplied.

Edge cases:

- `--no-tls` with `--domain` is allowed but prints that TLS proxy setup is skipped.
- `--domain` without `--email` fails unless `--no-tls` is set.
- Unknown options fail.
- `--help` exits zero without side effects.

### TDD Cycle

#### Red: Write Failing Test

File: `tests/generated/test_install_vps_argument_contract.spec.ts`

```ts
it('uses CLI flags before environment variables', () => {
  const output = execFileSync('bash', [
    'scripts/deploy/install-vps.sh',
    '--print-config',
    '--repo-url', 'https://example.invalid/cli.git',
    '--ref', 'v1.28.0',
    '--domain', 'app.example.com',
    '--email', 'ops@example.com',
  ], {
    encoding: 'utf8',
    env: {
      ...process.env,
      CC_AGENT_UI_REPO_URL: 'https://example.invalid/env.git',
      CC_AGENT_UI_REF: 'v9.9.9',
    },
  });

  expect(output).toContain('repo_url=https://example.invalid/cli.git');
  expect(output).toContain('repo_ref=v1.28.0');
  expect(output).toContain('domain=app.example.com');
  expect(output).toContain('email=ops@example.com');
});
```

#### Green: Minimal Implementation

File: `scripts/deploy/install-vps.sh`

- Add argument parsing before readonly config is finalized.
- Keep env var compatibility for `CC_AGENT_UI_REPO_URL` and `CC_AGENT_UI_REF`.
- Add help output and validation.

#### Refactor

Use one config print function shared by tests and operator diagnostics.

### Success Criteria

Automated:

- Option precedence test passes.
- Unknown option test exits non-zero.
- Help output test exits zero.

Manual:

- `sudo bash scripts/deploy/install-vps.sh --help` documents all commercial options.

## Behavior 5: Optional TLS Reverse Proxy Setup

### Test Specification

Given `--domain app.example.com --email ops@example.com --proxy caddy`, when proxy setup runs, then Caddy is installed/configured with automatic HTTPS and reverse proxying to `127.0.0.1:3001`.

Given `--domain app.example.com --email ops@example.com --proxy nginx`, when proxy setup runs, then nginx and certbot are installed/configured with WebSocket upgrade headers.

Given `--no-tls`, when proxy setup runs, then no proxy packages are installed.

Edge cases:

- The app service remains bound to `127.0.0.1:3001`.
- WebSocket upgrade headers are present in nginx config.
- Caddyfile uses `reverse_proxy 127.0.0.1:3001`.
- Config validation runs before service restart.

### TDD Cycle

#### Red: Write Failing Test

File: `tests/generated/test_install_vps_proxy_contract.spec.ts`

```ts
import { describe, expect, it } from 'vitest';
import { renderCaddyfile, renderNginxServerBlock } from '../../scripts/deploy/testable-proxy-renderers';

describe('TLS proxy config rendering', () => {
  it('renders Caddy HTTPS reverse proxy config', () => {
    expect(renderCaddyfile({ domain: 'app.example.com', upstream: '127.0.0.1:3001' }))
      .toContain('reverse_proxy 127.0.0.1:3001');
  });

  it('renders nginx WebSocket upgrade headers', () => {
    const config = renderNginxServerBlock({
      domain: 'app.example.com',
      upstream: '127.0.0.1:3001',
      email: 'ops@example.com',
    });

    expect(config).toContain('proxy_set_header Upgrade $http_upgrade;');
    expect(config).toContain('proxy_set_header Connection "upgrade";');
  });
});
```

#### Green: Minimal Implementation

Files:

- `scripts/deploy/install-vps.sh`
- `scripts/deploy/lib/deploy-common.sh`

Implementation notes:

- Keep the renderer logic deterministic and testable.
- Have shell installer write `/etc/caddy/Caddyfile` or nginx site config from renderer output.
- Install and validate with `caddy validate` or `nginx -t` before restart.
- Use Caddy as the default when possible because it reduces certificate handling complexity.

#### Refactor

Deduplicate upstream, domain, and WebSocket settings into a single normalized proxy config object/function.

### Success Criteria

Automated:

- Renderer tests pass.
- Fake-command tests verify `--no-tls` skips proxy package installation.
- Fake-command tests verify caddy/nginx validation happens before service restart.

Manual:

- With a real DNS A record, `https://<domain>/` and `https://<domain>/app` load.
- Browser WebSocket connection succeeds through the proxy.

## Behavior 6: Explicit Service, Route, WebSocket, and CLI Health Checks

### Test Specification

Given installation has finished, when `run_health_checks` executes, then it verifies:

- `systemctl is-active cc-agent-ui`
- systemd main PID owner is `cloudcli`
- `GET http://127.0.0.1:3001/health` returns success JSON
- `GET http://127.0.0.1:3001/` returns HTTP 200
- `GET http://127.0.0.1:3001/app` returns HTTP 200
- WebSocket upgrade path `/ws` is reachable and not a connection-refused failure
- `/home/cloudcli/.local/bin/claude`, `codex`, and `gemini` return versions

Edge cases:

- `/app` failure prints the last 50 journal lines.
- WebSocket auth rejection is acceptable only if the TCP/upgrade path reached the server; connection refused is not.
- Health checks can be run independently with `--verify-only`.

### TDD Cycle

#### Red: Write Failing Test

File: `tests/generated/test_install_vps_health_checks.spec.ts`

```ts
import { describe, expect, it } from 'vitest';
import { runInstallFunctionWithFakes } from './deployHarness';

describe('post-install health checks', () => {
  it('checks service, routes, websocket readiness, and agent cli versions', async () => {
    const result = await runInstallFunctionWithFakes('run_health_checks');

    expect(result.commandsText).toContain('systemctl is-active cc-agent-ui');
    expect(result.commandsText).toContain('http://127.0.0.1:3001/health');
    expect(result.commandsText).toContain('http://127.0.0.1:3001/');
    expect(result.commandsText).toContain('http://127.0.0.1:3001/app');
    expect(result.commandsText).toContain('/home/cloudcli/.local/bin/claude --version');
    expect(result.commandsText).toContain('/home/cloudcli/.local/bin/codex --version');
    expect(result.commandsText).toContain('/home/cloudcli/.local/bin/gemini --version');
  });
});
```

#### Green: Minimal Implementation

File: `scripts/deploy/install-vps.sh`

- Rename current `start_service` ownership check into `start_service` plus `run_health_checks`.
- Add `--verify-only`.
- Add route checks and version checks.
- Add a small Node one-liner or helper for WebSocket readiness using the installed `ws` package from the app checkout.

#### Refactor

Make each check a small function so failures identify the exact broken subsystem.

### Success Criteria

Automated:

- Fake-command test verifies all expected checks are present.
- `npm test -- tests/generated/test_install_vps_health_checks.spec.ts` passes.

Manual:

- `sudo bash scripts/deploy/install-vps.sh --ref v1.28.0 --verify-only` can be run after install.
- A failed `/app` check includes enough diagnostics to act immediately.

## Behavior 7: Vultr API Wrapper Uses Backoff and Does Not Leak Tokens

### Test Specification

Given `VULTR_API_KEY` is set, when `provision-vultr.sh` calls Vultr API endpoints, then it uses a wrapper that:

- Does not print the token.
- Does not require `set -x`.
- Retries `429` responses with bounded exponential backoff.
- Fails after the configured retry limit.
- Parses response JSON through a deterministic helper.

Edge cases:

- Missing `VULTR_API_KEY` fails before any network call.
- `401` fails immediately.
- `5xx` retries with backoff.
- Logs include method/path/status, not authorization headers.

### TDD Cycle

#### Red: Write Failing Test

File: `tests/generated/test_provision_vultr_contract.spec.ts`

```ts
import { describe, expect, it } from 'vitest';
import { runProvisionFunctionWithFakeCurl } from './deployHarness';

describe('Vultr API wrapper', () => {
  it('retries 429 without logging the API token', async () => {
    const result = await runProvisionFunctionWithFakeCurl('vultr_api GET /v2/regions', {
      token: 'secret-token',
      statuses: [429, 429, 200],
    });

    expect(result.exitCode).toBe(0);
    expect(result.stderr).not.toContain('secret-token');
    expect(result.calls).toHaveLength(3);
    expect(result.sleepDurations.length).toBeGreaterThanOrEqual(2);
  });
});
```

#### Green: Minimal Implementation

File: `scripts/deploy/provision-vultr.sh`

- Add `require_vultr_token`.
- Add `vultr_api METHOD PATH [json_body]`.
- Use a temporary curl config or equivalent safe mechanism so the bearer token is not echoed in logs.
- Add `retry_with_backoff`.

#### Refactor

Move retry/logging helpers into `deploy-common.sh` only if both scripts need them.

### Success Criteria

Automated:

- 429 retry test fails before wrapper exists.
- Missing token test passes.
- Token redaction test passes.

Manual:

- Running with `VULTR_API_KEY` provisions or discovers resources without printing the token.

## Behavior 8: Vultr Provisioner Creates or Reuses VPS Resources

### Test Specification

Given required inputs are supplied, when the provisioner runs, then it:

- Determines region, plan, and OS.
- Creates or reuses an SSH key.
- Creates or updates a startup script that runs `install-vps.sh` with `--repo-url`, `--ref`, and TLS options.
- Creates an instance with label, region, plan, OS, SSH key, startup script, and optional firewall group.
- Polls until the instance is active and returns the IP address.

Edge cases:

- Existing instance with the same label requires `--reuse-existing` or fails.
- Startup scripts are limited in size, so large install payloads should fetch the installer from the pinned ref instead of embedding the full repo.
- Provisioner supports dry-run output for review.
- The install command never embeds model provider secrets.

### TDD Cycle

#### Red: Write Failing Test

File: `tests/generated/test_provision_vultr_contract.spec.ts`

```ts
it('builds a startup script using pinned repo/ref and TLS options', async () => {
  const result = await runProvisionFunctionWithFakeCurl('render_startup_script', {
    args: [
      '--repo-url', 'https://github.com/tha-hammer/cc-agent-ui.git',
      '--ref', 'v1.28.0',
      '--domain', 'app.example.com',
      '--email', 'ops@example.com',
    ],
  });

  expect(result.stdout).toContain('--repo-url https://github.com/tha-hammer/cc-agent-ui.git');
  expect(result.stdout).toContain('--ref v1.28.0');
  expect(result.stdout).toContain('--domain app.example.com');
  expect(result.stdout).toContain('--email ops@example.com');
  expect(result.stdout).not.toContain('VULTR_API_KEY');
});
```

#### Green: Minimal Implementation

File: `scripts/deploy/provision-vultr.sh`

- Add argument parser for Vultr-side options: `--label`, `--region`, `--plan`, `--os-id`, `--ssh-key-name`, `--ssh-public-key-file`, `--repo-url`, `--ref`, `--domain`, `--email`, `--no-tls`, `--dry-run`, `--reuse-existing`.
- Implement read-only discovery first.
- Implement render startup script.
- Implement create calls after tests validate payloads.

#### Refactor

Separate "render request payload" functions from "send request" functions. Unit tests should cover payloads without network.

### Success Criteria

Automated:

- Dry-run and payload tests pass without a real Vultr token.
- API wrapper retry tests pass.
- `bash -n scripts/deploy/provision-vultr.sh` passes.

Manual:

- With a disposable Vultr project, dry-run output is reviewed and then a real run provisions a VPS.
- The new VPS reaches `cc-agent-ui` service active and `/app` returns 200.

## Behavior 9: Documentation Matches Commercial Workflow

### Test Specification

Given the deploy docs are updated, when an operator reads them, then they see:

- Recommended VPS path.
- VKE deferred/future path rationale.
- One-shot VPS install with pinned ref.
- Provisioner usage with safe `VULTR_API_KEY` handling.
- TLS options for Caddy/nginx and `--no-tls`.
- Verification commands including agent CLI versions and `/app`.
- Upgrade and rollback guidance.

Edge cases:

- Docs do not recommend piping unpinned `main` into production.
- Docs do not expose or persist API tokens.
- Docs call out DNS prerequisites for TLS.

### TDD Cycle

#### Red: Write Failing Test

File: `tests/generated/test_install_vps_docs_contract.spec.ts`

```ts
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('commercial deploy documentation', () => {
  it('documents pinned install, CLIs, TLS, and provisioning safety', () => {
    const docs = readFileSync('docs/DEPLOY.md', 'utf8');

    expect(docs).toContain('--ref v');
    expect(docs).toContain('claude');
    expect(docs).toContain('codex');
    expect(docs).toContain('gemini');
    expect(docs).toContain('VULTR_API_KEY');
    expect(docs).toContain('--no-tls');
    expect(docs).toContain('/app');
  });
});
```

#### Green: Minimal Implementation

File: `docs/DEPLOY.md`

- Update install commands to use pinned refs.
- Add commercial provisioning section.
- Add TLS examples for Caddy and nginx.
- Add CLI verification.
- Add Vultr API cautions: no token logging, backoff on 429, ACL/sub-account recommendation.

#### Refactor

Keep the doc split clear: target VPS install, operator-side Vultr provisioning, future Kubernetes notes.

### Success Criteria

Automated:

- Documentation contract test passes.

Manual:

- A fresh operator can follow the docs without reading script internals.

## Behavior 10: Deployment Inventory Tracks Customer Hosts And Release State

### Test Specification

Given multiple commercial VPS installs exist, when the rollout tool reads inventory, then it can determine each customer's host, SSH target, current release, desired release, rollout ring, region, health status, and rollback ref.

Edge cases:

- Missing required inventory fields fail validation before any SSH command runs.
- Duplicate customer ids fail validation.
- Duplicate hostnames are allowed only when an explicit shared-host field is present.
- Inventory can be filtered by ring, region, customer id, current ref, and release channel.

### TDD Cycle

#### Red: Write Failing Test

File: `tests/generated/test_deployment_inventory_contract.spec.ts`

```ts
import { describe, expect, it } from 'vitest';
import { validateDeploymentInventory, selectRolloutTargets } from '../../scripts/deploy/testable-rollout-inventory';

describe('deployment inventory contract', () => {
  it('validates required customer host rollout fields', () => {
    const inventory = {
      clients: [
        {
          id: 'acme',
          host: 'acme.example.com',
          sshTarget: 'root@acme.example.com',
          currentRef: 'v1.28.0',
          desiredRef: 'v1.29.0',
          rollbackRef: 'v1.28.0',
          ring: 'canary',
          region: 'ewr',
          channel: 'stable',
        },
      ],
    };

    expect(validateDeploymentInventory(inventory)).toEqual({ ok: true, errors: [] });
  });

  it('selects rollout targets by ring and region', () => {
    const targets = selectRolloutTargets(sampleInventory, { ring: 'canary', region: 'ewr' });
    expect(targets.every((target) => target.ring === 'canary' && target.region === 'ewr')).toBe(true);
  });
});
```

#### Green: Minimal Implementation

Files:

- `scripts/deploy/rollout-vps.sh`
- `scripts/deploy/lib/deploy-common.sh`
- Optional testable helper module if shell-only parsing becomes brittle.

Implementation notes:

- Start with JSON inventory: `deployments/clients.json` or an operator-supplied path via `--inventory`.
- Validate inventory in dry-run mode before making changes.
- Print a clear rollout plan: selected client count, rings, concurrency, target ref, rollback ref.

#### Refactor

Keep inventory validation separate from SSH execution so future storage can move from JSON to a database or control plane without changing rollout behavior.

### Success Criteria

Automated:

- Inventory validation tests fail before helper exists.
- Duplicate id and missing field tests pass.
- Selection by ring/region/channel passes.

Manual:

- `scripts/deploy/rollout-vps.sh --inventory deployments/clients.json --dry-run --ring canary --ref vX.Y.Z` prints selected targets and exits without SSH.

## Behavior 11: VPS Rollouts Advance Through Health-Gated Rings

### Test Specification

Given an inventory of client VPS installs and a target release ref, when `rollout-vps.sh` runs, then it updates only the selected ring, verifies health for each target, writes a rollout ledger entry, and stops before the next ring until explicitly resumed.

Default rings:

- `internal`
- `canary`
- `early`
- `standard`
- `enterprise`

Default client-count policy:

- 10 clients: update 1 canary, then all remaining customers after approval.
- 100 clients: update internal, 1-5 canaries, 20%, 50%, 100%.
- 1,000 clients: update by ring and region with fixed concurrency limits.
- 10,000+ clients: require a platform rollout controller; the VPS script can still update dedicated installs but must not pretend to be the whole platform rollout system.

Edge cases:

- If any target fails install or health checks, the ring pauses.
- If failure rate crosses `--max-failure-rate`, the ring pauses.
- `--concurrency` limits simultaneous SSH sessions.
- `--resume <rollout-id>` continues an interrupted rollout without re-updating already healthy targets.
- `--approve-next-ring` is required before moving from canary to larger cohorts.

### TDD Cycle

#### Red: Write Failing Test

File: `tests/generated/test_rollout_vps_contract.spec.ts`

```ts
import { describe, expect, it } from 'vitest';
import { runRolloutWithFakeSsh } from './deployHarness';

describe('health-gated VPS rollouts', () => {
  it('updates only canary targets and records health-gated ledger results', async () => {
    const result = await runRolloutWithFakeSsh([
      '--inventory', 'fixtures/clients.json',
      '--ring', 'canary',
      '--ref', 'v1.29.0',
      '--concurrency', '2',
    ]);

    expect(result.sshCommandsText).toContain('install-vps.sh --ref v1.29.0 --verify-only');
    expect(result.updatedTargets.every((target) => target.ring === 'canary')).toBe(true);
    expect(result.ledger).toContainEqual(expect.objectContaining({
      targetRef: 'v1.29.0',
      ring: 'canary',
      status: 'healthy',
    }));
  });

  it('pauses the ring when a health check fails', async () => {
    const result = await runRolloutWithFakeSsh(['--inventory', 'fixtures/clients.json', '--ring', 'canary', '--ref', 'v1.29.0'], {
      failHealthFor: ['acme'],
    });

    expect(result.exitCode).not.toBe(0);
    expect(result.ledger).toContainEqual(expect.objectContaining({ clientId: 'acme', status: 'failed' }));
    expect(result.stderr).toContain('paused');
  });
});
```

#### Green: Minimal Implementation

File: `scripts/deploy/rollout-vps.sh`

- Parse rollout options: `--inventory`, `--ref`, `--ring`, `--region`, `--channel`, `--concurrency`, `--max-failure-rate`, `--dry-run`, `--resume`, `--approve-next-ring`.
- For each selected target, run remote install with pinned `--ref` and matching TLS options.
- Run remote `--verify-only`.
- Write a local JSONL ledger under `deployments/rollouts/<rollout-id>.jsonl`.
- Stop on failures and print exact resume command.

#### Refactor

Extract target selection, command rendering, and ledger writing into testable helpers. Keep raw SSH execution thin.

### Success Criteria

Automated:

- Fake SSH tests prove only selected ring targets update.
- Health failure tests prove automatic pause.
- Resume tests prove already healthy targets are skipped.

Manual:

- Run against two disposable VPS installs: one canary succeeds, one induced failure pauses rollout and prints rollback/resume instructions.

## Behavior 12: Rollback Restores The Prior Ref And Re-Verifies Health

### Test Specification

Given a rollout has failed or an operator requests rollback, when `rollout-vps.sh --rollback <rollout-id>` runs, then it restores each affected target to its recorded `rollbackRef`, runs `--verify-only`, and records rollback status in the ledger.

Edge cases:

- Rollback refuses to run if no rollback ref is recorded.
- Rollback targets only hosts touched by the rollout unless `--all-selected` is supplied.
- Rollback failure leaves the ledger with `rollback_failed` status and prints manual SSH commands.

### TDD Cycle

#### Red: Write Failing Test

File: `tests/generated/test_rollout_vps_contract.spec.ts`

```ts
it('rolls back touched targets to their recorded rollback refs', async () => {
  const result = await runRolloutWithFakeSsh([
    '--rollback', 'rollout-123',
    '--ledger-dir', 'fixtures/rollouts',
  ]);

  expect(result.sshCommandsText).toContain('install-vps.sh --ref v1.28.0');
  expect(result.sshCommandsText).toContain('install-vps.sh --verify-only --ref v1.28.0');
  expect(result.ledger).toContainEqual(expect.objectContaining({ status: 'rollback_healthy' }));
});
```

#### Green: Minimal Implementation

File: `scripts/deploy/rollout-vps.sh`

- Add `--rollback <rollout-id>`.
- Read affected targets from ledger.
- Execute installer with recorded rollback refs.
- Re-run health checks.

#### Refactor

Make rollback use the same command renderer and health-check result parser as forward rollout.

### Success Criteria

Automated:

- Rollback tests pass with fake ledger and fake SSH.
- Missing rollback ref test fails safely before SSH.

Manual:

- Induce a canary deployment failure, run rollback, and verify service returns to previous ref.

## Behavior 13: Scale Gates Tell Operators When VPS Rollouts Are No Longer Enough

### Test Specification

Given the operator asks for a rollout plan for a client count, when `rollout-vps.sh --plan-scale <count>` runs, then it prints the recommended deployment model and required controls for that scale band.

Edge cases:

- Counts below 1 fail validation.
- 10, 100, 1,000, 10,000, 100,000, 1,000,000, and 10,000,000 map to explicit recommendations.
- At 100,000 and above, the tool recommends Kubernetes/cluster/cell-based platform rollout rather than per-customer VPS automation as the primary path.

### TDD Cycle

#### Red: Write Failing Test

File: `tests/generated/test_rollout_vps_contract.spec.ts`

```ts
import { recommendDeploymentModel } from '../../scripts/deploy/testable-rollout-scale';

it.each([
  [10, 'single-vps-fleet'],
  [100, 'ringed-vps-fleet'],
  [1000, 'regional-vps-fleet'],
  [10000, 'progressive-delivery-controller'],
  [100000, 'clustered-platform'],
  [1000000, 'multi-region-platform'],
  [10000000, 'cell-based-global-platform'],
])('maps %i clients to %s', (clientCount, expectedModel) => {
  expect(recommendDeploymentModel(clientCount).model).toBe(expectedModel);
});
```

#### Green: Minimal Implementation

File: `scripts/deploy/rollout-vps.sh`

- Add `--plan-scale <count>`.
- Print the same scale-band recommendations from this plan.
- Exit without requiring inventory or network calls.

#### Refactor

Keep scale recommendations declarative so docs and CLI output can share the same table later.

### Success Criteria

Automated:

- Scale recommendation tests pass.
- Invalid count tests pass.

Manual:

- `scripts/deploy/rollout-vps.sh --plan-scale 100000` clearly says the default path should be a clustered/cell-based platform and the VPS rollout tool is for dedicated installs only.

## Integration and E2E Testing

Integration tests:

- `npm test -- tests/generated/test_install_vps_argument_contract.spec.ts`
- `npm test -- tests/generated/test_install_vps_release_ref_contract.spec.ts`
- `npm test -- tests/generated/test_install_vps_agent_cli_contract.spec.ts`
- `npm test -- tests/generated/test_install_vps_proxy_contract.spec.ts`
- `npm test -- tests/generated/test_install_vps_health_checks.spec.ts`
- `npm test -- tests/generated/test_provision_vultr_contract.spec.ts`
- `npm test -- tests/generated/test_deployment_inventory_contract.spec.ts`
- `npm test -- tests/generated/test_rollout_vps_contract.spec.ts`

Full local quality gates:

- `npm test`
- `npm run typecheck`
- `npm run build`
- `bash -n scripts/deploy/install-vps.sh scripts/deploy/provision-vultr.sh`

Manual VPS acceptance:

1. Create a disposable Ubuntu 24.04 Vultr VPS.
2. Run `sudo bash scripts/deploy/install-vps.sh --repo-url <repo> --ref vX.Y.Z --domain <dns-name> --email <ops-email>`.
3. Verify:
   - `systemctl is-active cc-agent-ui`
   - `ps -o user= -p "$(systemctl show -p MainPID --value cc-agent-ui)"` prints `cloudcli`
   - `curl -fsS http://127.0.0.1:3001/health`
   - `curl -fsS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3001/app` prints `200`
   - `sudo -u cloudcli -H bash -lc 'command -v claude codex gemini && claude --version && codex --version && gemini --version'`
   - Public HTTPS domain loads `/` and `/app` when TLS enabled.
4. Run the installer again with the same arguments and confirm idempotence.
5. Run `sudo bash scripts/deploy/install-vps.sh --ref vX.Y.Z --verify-only`.

Manual Vultr provisioning acceptance:

1. Export `VULTR_API_KEY` in the operator shell.
2. Run `scripts/deploy/provision-vultr.sh --dry-run --label cc-agent-ui-test --region <region> --plan <plan> --os-id <ubuntu-24-id> --repo-url <repo> --ref vX.Y.Z --no-tls`.
3. Confirm dry-run output omits the token.
4. Run without `--dry-run` against a disposable instance.
5. Confirm the output includes instance id, IP, and SSH command.
6. SSH to the instance and run `sudo bash /home/cloudcli/Dev/cosmic-agent-memory/cc-agent-ui/scripts/deploy/install-vps.sh --verify-only --ref vX.Y.Z --no-tls`.

Manual rollout acceptance:

1. Create an inventory with three disposable VPS targets: one `internal`, one `canary`, and one `standard`.
2. Run `scripts/deploy/rollout-vps.sh --inventory deployments/clients.json --dry-run --ring canary --ref vX.Y.Z`.
3. Confirm only the canary target is selected.
4. Run the canary rollout for real and confirm the ledger records `healthy`.
5. Re-run the same rollout with `--resume <rollout-id>` and confirm the healthy canary is skipped.
6. Induce one failing health check and confirm rollout pauses before larger rings.
7. Run `scripts/deploy/rollout-vps.sh --rollback <rollout-id>` and confirm the touched target returns to its prior ref.

## Implementation Order

1. Add deploy test harness and shell entry point testability.
2. Add argument parsing and release ref validation.
3. Add user-owned agent CLI installation.
4. Add health checks and `--verify-only`.
5. Add TLS proxy renderer tests and implementation.
6. Add Vultr API wrapper tests and implementation.
7. Add Vultr resource provisioning tests and implementation.
8. Add deployment inventory validation tests and implementation.
9. Add health-gated VPS rollout tests and implementation.
10. Add rollback ledger tests and implementation.
11. Add scale-band recommendation tests and implementation.
12. Update docs and documentation contract tests.
13. Run local quality gates.
14. Run disposable VPS and rollout acceptance.

## Risk Notes

- Shell scripts are easy to overfit with static tests. Use fake-command execution for behavior, not only string matching.
- `curl -H "Authorization: Bearer $VULTR_API_KEY"` may leak in process listings. Prefer a temporary curl config/header mechanism, remove it on exit, and avoid debug tracing.
- Installing global npm packages as root is not enough. The acceptance criterion is command resolution from `/home/cloudcli/.local/bin`.
- WebSocket readiness must distinguish "server/auth rejected me" from "proxy or Node route is unavailable."
- TLS automation requires DNS to already point to the VPS. The installer should fail clearly if certificate issuance cannot succeed.
- Existing deployments that rely on default `main` need a clear migration note because the commercial installer should prefer explicit pinned refs.
- Per-VPS rollout automation scales operationally only while the fleet remains manageable. At 100,000+ clients, the script should guide operators toward clustered/cell-based platform rollout instead of encouraging massive SSH fanout.
- Rollout ledgers become operational records. They must be append-only enough for audit, but easy to migrate to a central control plane later.
- Feature flags are the safer mechanism for risky product behavior changes at high scale. The rollout tool handles binary/code deployment; it should not be the only blast-radius control.

## References

- Existing installer: `scripts/deploy/install-vps.sh`
- Existing systemd unit: `scripts/deploy/cc-agent-ui.service`
- Deployment guide: `docs/DEPLOY.md`
- Test config: `vitest.config.ts`
- Health endpoint and WebSocket routing: `server/index.js`
- Vultr VKE overview: https://docs.vultr.com/support/products/vke/what-is-kubernetes-and-vultr-kubernetes-engine
- Vultr VKE requirements: https://docs.vultr.com/support/products/vke/what-are-the-minimum-requirements-for-deploying-a-vultr-kubernetes-engine-cluster
- Vultr API rate limits: https://docs.vultr.com/support/platform/api/what-rate-limits-apply-to-the-vultr-api
- Vultr API key scoping: https://docs.vultr.com/support/platform/api/can-i-scope-api-keys-to-specific-products
