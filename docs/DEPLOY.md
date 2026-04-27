# Deploying cc-agent-ui to a Production VPS

This guide is for operators provisioning a fresh single-tenant VPS for an Alpha customer.

> **⚠️ NEVER run cc-agent-ui as `root`.**
> The server reads and writes a lot of state under `$HOME` (`~/.claude/projects/`, `~/.cosmic-agent/MEMORY/`, `~/.cloudcli/auth.db`, `~/.codex/`, `~/.gemini/`, `~/.cursor/`, `~/.claude-code-ui/`). Running it as root means all that data lives under `/root/`, which:
> - Is the wrong place for application data on a Unix system.
> - Breaks file ownership invariants when other tools (`claude` CLI, `codex`, etc.) chown files.
> - Means a single bug in any spawned subprocess can damage the entire system.
> - Causes silent permission failures that look like "new projects can't be saved."
>
> The provided installer (`scripts/deploy/install-vps.sh`) creates a dedicated `cloudcli` user and refuses to install a systemd unit that declares `User=root`.

---

## Prerequisites

- A VPS running **Ubuntu 22.04 or 24.04** (other distros are not auto-tested — see [Manual install](#manual-install) below).
- Root SSH access to the VPS.
- A reverse proxy (nginx, Caddy, Cloudflare Tunnel, etc.) if you want public HTTPS access. The service binds to `127.0.0.1:3001` only; do NOT expose port 3001 directly.

---

## One-shot install (recommended)

SSH in as root, then:

```bash
curl -fsSL https://raw.githubusercontent.com/tha-hammer/cc-agent-ui/main/scripts/deploy/install-vps.sh | bash
```

Or, if you've already cloned the repo:

```bash
sudo bash scripts/deploy/install-vps.sh
```

The installer is idempotent — re-running it will pull the latest code, reinstall dependencies, and bounce the service.

What it does:

1. Verifies it's running on Ubuntu 22+ as root.
2. Installs Node 22 (via NodeSource), git, rsync, curl.
3. Creates the `cloudcli` user (no sudo group membership, login shell `/bin/bash` so operators can `sudo -u cloudcli -i` for maintenance).
4. Installs `bun` for `cloudcli`.
5. Clones the repo to `/home/cloudcli/Dev/cosmic-agent-memory/cc-agent-ui`.
6. Runs `npm install`.
7. Installs the hardened systemd unit at `/etc/systemd/system/cc-agent-ui.service`.
8. Starts and enables the service.

---

## Verify the install

```bash
# Service is up
sudo systemctl status cc-agent-ui

# Running as cloudcli (NOT root)
ps -o user= -p $(systemctl show -p MainPID --value cc-agent-ui)
# → expected output: cloudcli

# HTTP listener responds
curl -sS -o /dev/null -w 'HTTP %{http_code}\n' http://127.0.0.1:3001/
# → expected: HTTP 200

# Hardening score
sudo systemd-analyze security cc-agent-ui
# → expected: "Overall exposure level: ~3.2 OK :-)"

# Watch logs
sudo journalctl -u cc-agent-ui -f
```

---

## Public access (TLS + reverse proxy)

The service binds to `127.0.0.1:3001`. Add a reverse proxy on the same host:

### nginx (sample)

```nginx
server {
    listen 443 ssl http2;
    server_name your.domain.example;

    ssl_certificate /etc/letsencrypt/live/your.domain.example/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your.domain.example/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 300s;
    }
}
```

WebSocket upgrade headers (`Upgrade` / `Connection`) are required — the UI uses WebSocket for live session streaming.

---

## Updating to a new release

For a tagged release (recommended for production):

```bash
sudo CC_AGENT_UI_REF=v1.28.0 bash scripts/deploy/install-vps.sh
```

Or to track `main` (default):

```bash
sudo bash scripts/deploy/install-vps.sh
```

The installer is idempotent — re-running it pins to whatever `CC_AGENT_UI_REF` is set to (defaults to `main`). **Production operators should pin to tagged releases**, so a compromise of `main` doesn't propagate to running deployments on the next upgrade.

---

## Manual install

Use this if you're on a non-Ubuntu distro or the installer doesn't fit your environment.

```bash
# 1. Create the service user
sudo useradd -m -s /bin/bash cloudcli

# 2. Install Node 22
# (use your distro's package manager or NodeSource)

# 3. Install bun for cloudcli
sudo -u cloudcli -H bash -c 'curl -fsSL https://bun.sh/install | bash'

# 4. Clone and install
sudo -u cloudcli -H git clone https://github.com/tha-hammer/cc-agent-ui.git \
    /home/cloudcli/Dev/cosmic-agent-memory/cc-agent-ui
sudo -u cloudcli -H bash -lc \
    'cd /home/cloudcli/Dev/cosmic-agent-memory/cc-agent-ui && npm install --no-audit --no-fund'

# 5. Install the systemd unit
sudo install -m 644 -o root -g root \
    /home/cloudcli/Dev/cosmic-agent-memory/cc-agent-ui/scripts/deploy/cc-agent-ui.service \
    /etc/systemd/system/cc-agent-ui.service
sudo systemctl daemon-reload
sudo systemctl enable --now cc-agent-ui

# 6. Verify (see "Verify the install" above)
```

---

## Migrating an existing root-owned install

If you have an existing install where cc-agent-ui was running as root, follow this runbook to migrate without losing data:

```bash
# Run as root. Use set -euo pipefail so a failed step aborts the runbook.
set -euo pipefail

# 0. STOP the service
systemctl stop cc-agent-ui

# 1. Create the cloudcli user (skip if it already exists)
id cloudcli >/dev/null 2>&1 || useradd -m -s /bin/bash cloudcli

# 2. Migrate user data (preserves chat history, projects, MCP config, auth db).
#    Each rsync must succeed before its chown runs.
for D in .claude .cosmic-agent .cloudcli .codex .gemini .cursor .claude-code-ui; do
    if [ -d "/root/$D" ]; then
        rsync -aHAX "/root/$D/" "/home/cloudcli/$D/"
        chown -R cloudcli:cloudcli "/home/cloudcli/$D"
    fi
done

# 3. Migrate the repo (skip node_modules — reinstall is faster)
[ -d /root/Dev/cosmic-agent-memory ] || { echo "no repo at /root/Dev/cosmic-agent-memory — adapt this path"; exit 1; }
install -d -m 755 -o cloudcli -g cloudcli /home/cloudcli/Dev
rsync -aHAX --exclude=node_modules \
    /root/Dev/cosmic-agent-memory/ /home/cloudcli/Dev/cosmic-agent-memory/
chown -R cloudcli:cloudcli /home/cloudcli/Dev/cosmic-agent-memory
sudo -u cloudcli -H bash -lc \
    'cd /home/cloudcli/Dev/cosmic-agent-memory/cc-agent-ui && npm install --no-audit --no-fund'

# 4. Replace the systemd unit with the hardened one
[ -f /etc/systemd/system/cc-agent-ui.service ] && \
    cp /etc/systemd/system/cc-agent-ui.service /etc/systemd/system/cc-agent-ui.service.bak
install -m 644 -o root -g root \
    /home/cloudcli/Dev/cosmic-agent-memory/cc-agent-ui/scripts/deploy/cc-agent-ui.service \
    /etc/systemd/system/cc-agent-ui.service
systemctl daemon-reload

# 5. Start + verify
systemctl start cc-agent-ui
ps -o user= -p "$(systemctl show -p MainPID --value cc-agent-ui)"
# → cloudcli

# 6. After UAT confirms everything works, prune the /root originals (optional):
#    sudo rm -rf /root/.claude /root/.cosmic-agent /root/.cloudcli /root/.codex \
#                /root/.gemini /root/.cursor /root/.claude-code-ui /root/Dev/cosmic-agent-memory
```

---

## Operational notes

- **Logs** go to journald: `sudo journalctl -u cc-agent-ui -f`. No log rotation needed.
- **Memory cap** is 4 GiB (`MemoryMax=4G`) — bump if your usage demands.
- **Task cap** is 512 (`TasksMax=512`) — covers cc-agent-ui plus several spawned `claude`/`codex`/`gemini` CLI subprocesses.
- **Auto-restart** is on (`Restart=always`, `RestartSec=3`). Crashes recover transparently.
- **Hardening** is configured for defense-in-depth without breaking child CLIs:
    - Filesystem: read-only system, writable only `/home/cloudcli`.
    - Capabilities: zeroed (`CapabilityBoundingSet=`, `AmbientCapabilities=`).
    - Network: `AF_UNIX`, `AF_INET`, `AF_INET6`, `AF_NETLINK` only — no raw/packet sockets.
    - Kernel: tunables, modules, logs, control groups, clock, hostname all protected.
    - Filters deliberately NOT applied: `SystemCallFilter` (high false-positive rate for Node + spawn), `MemoryDenyWriteExecute` (V8 JIT requires W+X), `PrivateNetwork` (we need outbound HTTPS to the model APIs).

---

## Troubleshooting

**Service fails to start, journal shows `EACCES` on `/home/cloudcli/...`** — ownership wasn't fully reset after migration. Re-run `sudo chown -R cloudcli:cloudcli /home/cloudcli/`.

**"file path errors" / "can't save new project"** — almost always means the service is running as root and writing to `/root` instead of the user's home, AND the user expected data under their home directory. Run `ps -o user= -p $(systemctl show -p MainPID --value cc-agent-ui)`. If it says `root`, follow the migration runbook above.

**WebSocket disconnects through nginx** — confirm `proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection "upgrade";` is present in the location block.

**`bun: command not found` in the journal** — the systemd unit's `Environment=PATH=…` includes `/home/cloudcli/.bun/bin`. Confirm the binary exists at `/home/cloudcli/.bun/bin/bun`. If not, re-run the bun install step.
