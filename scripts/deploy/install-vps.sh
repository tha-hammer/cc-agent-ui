#!/usr/bin/env bash
# install-vps.sh — Provision cc-agent-ui on a fresh Ubuntu VPS as a non-root systemd service.
#
# Usage (as root on the target VPS):
#   curl -fsSL https://raw.githubusercontent.com/tha-hammer/cc-agent-ui/main/scripts/deploy/install-vps.sh | bash
#   # or, after cloning:
#   sudo bash scripts/deploy/install-vps.sh
#
# Idempotent: safe to re-run. Exits 0 if everything is already set up.
#
# What it does:
#   1. Verifies running as root, on Ubuntu 22+/24+.
#   2. Creates the `cloudcli` service user (no sudo).
#   3. Installs system dependencies (node 22, npm, git, rsync, curl).
#   4. Installs bun for the cloudcli user.
#   5. Clones (or updates) the repo to /home/cloudcli/Dev/cosmic-agent-memory.
#   6. Runs `npm install` in cc-agent-ui/.
#   7. Installs the hardened systemd unit.
#   8. Enables and starts the service.
#
# CRITICAL: This script REFUSES to install a unit with `User=root`. cc-agent-ui must
# never run as root in production — see docs/DEPLOY.md for rationale.

set -euo pipefail

readonly SVC_USER="cloudcli"
readonly SVC_HOME="/home/${SVC_USER}"
readonly REPO_URL="${CC_AGENT_UI_REPO_URL:-https://github.com/tha-hammer/cc-agent-ui.git}"
# Pin to a specific tag or commit by setting CC_AGENT_UI_REF (e.g. CC_AGENT_UI_REF=v1.28.0).
# Defaults to `main` for first-time installs; production operators should pin to tagged releases.
readonly REPO_REF="${CC_AGENT_UI_REF:-main}"
readonly REPO_PARENT="${SVC_HOME}/Dev/cosmic-agent-memory"
readonly REPO_DIR="${REPO_PARENT}/cc-agent-ui"
readonly UNIT_SRC="${REPO_DIR}/scripts/deploy/cc-agent-ui.service"
readonly UNIT_DST="/etc/systemd/system/cc-agent-ui.service"
readonly NODE_MAJOR=22

log() { printf '\n\033[1;36m[install-vps]\033[0m %s\n' "$*"; }
die() { printf '\n\033[1;31m[install-vps] ERROR:\033[0m %s\n' "$*" >&2; exit 1; }

require_root() {
  [[ ${EUID} -eq 0 ]] || die "must run as root (try: sudo bash $0)"
}

require_ubuntu() {
  [[ -r /etc/os-release ]] || die "/etc/os-release not found"
  # shellcheck disable=SC1091
  . /etc/os-release
  [[ "${ID:-}" == "ubuntu" ]] || die "this installer targets Ubuntu (got ID=${ID:-unknown}). Patch for your distro or run the steps in docs/DEPLOY.md manually."
  local major=${VERSION_ID%%.*}
  (( major >= 22 )) || die "Ubuntu ${VERSION_ID} too old; need 22.04 or newer."
  log "OS check: Ubuntu ${VERSION_ID} ✓"
}

ensure_packages() {
  log "Installing system packages (apt)…"
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -qq
  apt-get install -y -qq curl git rsync ca-certificates gnupg
  if ! command -v node >/dev/null 2>&1 || ! node --version | grep -q "^v${NODE_MAJOR}\."; then
    log "Installing Node.js ${NODE_MAJOR}.x via NodeSource…"
    curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
    apt-get install -y -qq nodejs
  fi
  log "Node: $(node --version)  npm: $(npm --version)"
}

ensure_user() {
  if id "${SVC_USER}" >/dev/null 2>&1; then
    log "User ${SVC_USER} already exists ✓"
  else
    log "Creating user ${SVC_USER}…"
    useradd -m -s /bin/bash "${SVC_USER}"
  fi
  # Ensure NOT in sudo (least privilege)
  if id -Gn "${SVC_USER}" | grep -qw sudo; then
    log "Removing ${SVC_USER} from sudo group…"
    gpasswd -d "${SVC_USER}" sudo
  fi
}

ensure_bun() {
  if [[ -x "${SVC_HOME}/.bun/bin/bun" ]]; then
    log "bun already installed ✓ ($(sudo -u "${SVC_USER}" "${SVC_HOME}/.bun/bin/bun" --version))"
    return
  fi
  log "Installing bun for ${SVC_USER}…"
  sudo -u "${SVC_USER}" -H bash -c 'curl -fsSL https://bun.sh/install | bash'
}

ensure_repo() {
  if [[ -d "${REPO_DIR}/.git" ]]; then
    log "Repo already cloned at ${REPO_DIR}; fetching ref ${REPO_REF}…"
    sudo -u "${SVC_USER}" -H git -C "${REPO_DIR}" fetch --tags origin
    sudo -u "${SVC_USER}" -H git -C "${REPO_DIR}" checkout --force "${REPO_REF}"
    # If REPO_REF is a branch (not a tag/commit), fast-forward to remote.
    if sudo -u "${SVC_USER}" -H git -C "${REPO_DIR}" symbolic-ref -q HEAD >/dev/null; then
      sudo -u "${SVC_USER}" -H git -C "${REPO_DIR}" pull --ff-only origin "${REPO_REF}"
    fi
  elif [[ -e "${REPO_DIR}" ]]; then
    die "${REPO_DIR} exists but is not a git checkout — refusing to clobber. Inspect or remove it manually."
  else
    log "Cloning ${REPO_URL} (ref ${REPO_REF}) → ${REPO_DIR}…"
    sudo -u "${SVC_USER}" -H mkdir -p "${REPO_PARENT}"
    sudo -u "${SVC_USER}" -H git clone "${REPO_URL}" "${REPO_DIR}"
    sudo -u "${SVC_USER}" -H git -C "${REPO_DIR}" checkout --force "${REPO_REF}"
  fi
  [[ -d "${REPO_DIR}/.git" ]] || die "repo dir ${REPO_DIR} missing after clone"
  log "Checked out: $(sudo -u "${SVC_USER}" -H git -C "${REPO_DIR}" describe --always --dirty)"
}

install_deps() {
  log "Running npm install in ${REPO_DIR}…"
  sudo -u "${SVC_USER}" -H bash -lc 'cd "$1" && npm install --no-audit --no-fund' _ "${REPO_DIR}"
}

install_unit() {
  [[ -f "${UNIT_SRC}" ]] || die "unit template not found at ${UNIT_SRC}"
  # Copy the unit to a root-owned temp file BEFORE the security checks so the
  # checked bytes are the bytes installed (closes a TOCTOU window where the
  # unprivileged repo owner could swap the file between grep and install).
  local staged
  staged=$(mktemp -p /root cc-agent-ui.service.XXXXXX)
  install -m 600 -o root -g root "${UNIT_SRC}" "${staged}"
  trap 'rm -f "${staged}"' RETURN
  if grep -Eq '^[[:space:]]*User[[:space:]]*=[[:space:]]*root[[:space:]]*$' "${staged}"; then
    die "unit declares User=root — refusing to install. cc-agent-ui must not run as root."
  fi
  if ! grep -Eq "^[[:space:]]*User[[:space:]]*=[[:space:]]*${SVC_USER}[[:space:]]*$" "${staged}"; then
    die "unit does not declare User=${SVC_USER} — bailing."
  fi
  log "Installing systemd unit → ${UNIT_DST}"
  install -m 644 -o root -g root "${staged}" "${UNIT_DST}"
  systemctl daemon-reload
}

start_service() {
  log "Enabling + starting cc-agent-ui…"
  systemctl enable cc-agent-ui
  systemctl restart cc-agent-ui

  # Poll up to 30s for service to reach active state.
  local i
  for ((i = 0; i < 30; i++)); do
    if systemctl --quiet is-active cc-agent-ui; then break; fi
    sleep 1
  done
  if ! systemctl --quiet is-active cc-agent-ui; then
    journalctl -u cc-agent-ui -n 50 --no-pager
    die "service failed to reach active state within 30s; see journal above."
  fi

  local pid owner
  pid=$(systemctl show -p MainPID --value cc-agent-ui)
  owner=$(ps -o user= -p "${pid}" 2>/dev/null || true)
  [[ "${owner}" == "${SVC_USER}" ]] || die "service running as '${owner}', expected '${SVC_USER}'."
  log "service running as ${SVC_USER} (PID ${pid}) ✓"
}

post_install_summary() {
  cat <<EOF

================================================================================
  cc-agent-ui installed successfully.

  Service:       cc-agent-ui.service     (User=${SVC_USER})
  Working dir:   ${REPO_DIR}
  Bind:          127.0.0.1:3001  (proxy with nginx/Caddy for public access)
  Logs:          journalctl -u cc-agent-ui -f
  Restart:       sudo systemctl restart cc-agent-ui

  Verify:
    curl -sS -o /dev/null -w 'HTTP %{http_code}\\n' http://127.0.0.1:3001/
    systemd-analyze security cc-agent-ui

  See docs/DEPLOY.md for TLS, reverse proxy, and operational notes.
================================================================================

EOF
}

main() {
  require_root
  require_ubuntu
  ensure_packages
  ensure_user
  ensure_bun
  ensure_repo
  install_deps
  install_unit
  start_service
  post_install_summary
}

main "$@"
