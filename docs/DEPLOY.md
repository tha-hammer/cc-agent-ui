# Deploying cc-agent-ui To A Commercial Vultr VPS

This guide is for operators provisioning a single-tenant customer VPS on Vultr:
one client per VPS. Do not host multiple customers on the same instance. The
service must run as the dedicated `cloudcli` user, not as `root`.

## Why Non-Root Matters

cc-agent-ui reads and writes state under the service user's home directory:

- `~/.claude/projects/`
- `~/.claude/skills/`
- `~/.codex/`
- `~/.gemini/`
- `~/.cloudcli/auth.db`
- `~/.cosmic-agent/MEMORY/`
- `~/.claude-code-ui/`

Running the service as `root` puts customer state under `/root`, creates
ownership drift when spawned CLIs write files, and turns a subprocess bug into a
host-level risk. The installer creates `cloudcli`, keeps it out of the sudo
group, and refuses to install a systemd unit that runs as root.

## Recommended VPS Install

Use a pinned release tag or commit SHA. Do not deploy production from a floating
branch unless you explicitly pass `--allow-floating-ref`.

```bash
sudo bash scripts/deploy/install-vps.sh \
  --repo-url https://github.com/tha-hammer/cc-agent-ui.git \
  --ref v1.28.0 \
  --client-id acme \
  --domain app.example.com \
  --email ops@example.com
```

For a private/internal smoke test without TLS:

```bash
sudo bash scripts/deploy/install-vps.sh \
  --repo-url https://github.com/tha-hammer/cc-agent-ui.git \
  --ref v1.28.0 \
  --client-id acme \
  --no-tls
```

Useful non-mutating commands:

```bash
bash scripts/deploy/install-vps.sh --help
bash scripts/deploy/install-vps.sh --print-config --ref v1.28.0 --client-id acme --no-tls
sudo bash scripts/deploy/install-vps.sh --verify-only --ref v1.28.0 --no-tls
```

## What The Installer Does

1. Verifies Ubuntu 22.04 or newer.
2. Installs Node.js 22, npm, git, rsync, curl, and CA certificates.
3. Creates the `cloudcli` service user if missing.
4. Installs bun for `cloudcli`.
5. Installs agent CLIs for `cloudcli` under `/home/cloudcli/.local`:
   `claude`, `codex`, and `gemini`.
6. Checks out the pinned app ref.
7. Runs `npm install --no-audit --no-fund`.
8. Writes `/etc/cc-agent-ui/install.env` with the client id, pinned ref, and
   `CC_AGENT_UI_SINGLE_TENANT=true`.
9. Installs the hardened systemd unit.
10. Optionally configures Caddy or nginx as a TLS reverse proxy.
11. Starts `cc-agent-ui` and runs health checks for `/health`, `/`, `/app`,
    WebSocket reachability, service ownership, and CLI versions.

The service binds to `127.0.0.1:3001`. Do not expose port 3001 directly.

## TLS Proxy Options

Caddy is the default when `--domain` and `--email` are provided. It handles
certificate issuance automatically:

```bash
sudo bash scripts/deploy/install-vps.sh \
  --ref v1.28.0 \
  --client-id acme \
  --domain app.example.com \
  --email ops@example.com \
  --proxy caddy
```

nginx is also supported:

```bash
sudo bash scripts/deploy/install-vps.sh \
  --ref v1.28.0 \
  --client-id acme \
  --domain app.example.com \
  --email ops@example.com \
  --proxy nginx
```

DNS must already point to the VPS before certificate issuance can succeed. Both
proxy modes must preserve WebSocket upgrade headers for live chat streaming.

## Verify An Install

```bash
sudo systemctl is-active cc-agent-ui
ps -o user= -p "$(systemctl show -p MainPID --value cc-agent-ui)"
curl -fsS http://127.0.0.1:3001/health
curl -fsS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3001/app
grep -Fx 'CC_AGENT_UI_SINGLE_TENANT=true' /etc/cc-agent-ui/install.env
sudo -u cloudcli -H bash -lc 'command -v claude codex gemini'
sudo -u cloudcli -H bash -lc 'claude --version && codex --version && gemini --version'
sudo systemd-analyze security cc-agent-ui
```

Expected:

- service is `active`
- process owner is `cloudcli`
- `/health` succeeds
- `/app` returns `200`
- `/etc/cc-agent-ui/install.env` records the single client assigned to the VPS
- `claude`, `codex`, and `gemini` resolve for `cloudcli`
- systemd exposure remains around `3.2 OK`

## Vultr Provisioning Wrapper

`scripts/deploy/provision-vultr.sh` runs from an operator machine or CI. It uses
the Vultr API to render or create the VPS resources needed for an install.

Keep the API token in the environment. Do not place it in command arguments,
startup scripts, git, or logs.

```bash
export VULTR_API_KEY=...

scripts/deploy/provision-vultr.sh \
  --dry-run \
  --label cc-agent-ui-test \
  --region ewr \
  --plan vc2-2c-4gb \
  --os-id 2284 \
  --ssh-key-name operator \
  --ssh-public-key-file ~/.ssh/id_ed25519.pub \
  --repo-url https://github.com/tha-hammer/cc-agent-ui.git \
  --ref v1.28.0 \
  --client-id acme \
  --no-tls
```

The wrapper's API client retries `429` and `5xx` responses with bounded backoff
and logs method/path/status without printing `VULTR_API_KEY`.

Render the startup script without making network calls:

```bash
scripts/deploy/provision-vultr.sh \
  --render-startup-script \
  --repo-url https://github.com/tha-hammer/cc-agent-ui.git \
  --ref v1.28.0 \
  --client-id acme \
  --domain app.example.com \
  --email ops@example.com
```

## API Key Safety

Vultr API keys should be treated as broad account credentials. Prefer source-IP
ACLs, sub-accounts, and short-lived operator environments. The installer must
never embed model provider secrets or Vultr API tokens in startup scripts.

## Updating A Customer VPS

Use the same installer with a newer pinned ref:

```bash
sudo bash scripts/deploy/install-vps.sh \
  --repo-url https://github.com/tha-hammer/cc-agent-ui.git \
  --ref v1.29.0 \
  --client-id acme \
  --domain app.example.com \
  --email ops@example.com
```

Rollback is the same command with the prior ref:

```bash
sudo bash scripts/deploy/install-vps.sh \
  --repo-url https://github.com/tha-hammer/cc-agent-ui.git \
  --ref v1.28.0 \
  --client-id acme \
  --domain app.example.com \
  --email ops@example.com
```

Fleet rollout, inventory, ring deployment, and automated rollback orchestration
are intentionally deferred to a separate plan.

## Troubleshooting

Service fails to start:

```bash
sudo journalctl -u cc-agent-ui -n 80 --no-pager
```

Wrong process owner:

```bash
ps -o user= -p "$(systemctl show -p MainPID --value cc-agent-ui)"
```

If it prints `root`, migrate the install to `cloudcli` before accepting
customer traffic.

WebSocket disconnects through a proxy:

- confirm `Upgrade` and `Connection` headers are forwarded
- keep `proxy_read_timeout` high enough for long-running agent streams

CLI command missing:

```bash
sudo -u cloudcli -H bash -lc 'echo $PATH; command -v claude codex gemini'
```

The systemd unit must include `/home/cloudcli/.local/bin` before `/usr/bin`.
