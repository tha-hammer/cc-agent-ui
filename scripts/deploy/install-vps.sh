#!/usr/bin/env bash
# install-vps.sh - Provision cc-agent-ui on a fresh Ubuntu VPS as a non-root
# systemd service. This script is idempotent for normal installs and supports
# dry-run/test modes for contract tests.

set -euo pipefail

SVC_USER="${CC_AGENT_UI_SVC_USER:-cloudcli}"
SVC_HOME="/home/${SVC_USER}"
REPO_URL="${CC_AGENT_UI_REPO_URL:-https://github.com/tha-hammer/cc-agent-ui.git}"
REPO_REF="${CC_AGENT_UI_REF:-}"
CLIENT_ID="${CC_AGENT_UI_CLIENT_ID:-}"
REPO_PARENT="${SVC_HOME}/Dev/cosmic-agent-memory"
REPO_DIR="${REPO_PARENT}/cc-agent-ui"
UNIT_SRC="${REPO_DIR}/scripts/deploy/cc-agent-ui.service"
UNIT_DST="/etc/systemd/system/cc-agent-ui.service"
INSTALL_ENV_DIR="/etc/cc-agent-ui"
INSTALL_ENV_FILE="${INSTALL_ENV_DIR}/install.env"
NODE_MAJOR="${CC_AGENT_UI_NODE_MAJOR:-22}"
SERVER_HOST="127.0.0.1"
SERVER_PORT="3001"
UPSTREAM="${SERVER_HOST}:${SERVER_PORT}"
DOMAIN="${CC_AGENT_UI_DOMAIN:-}"
EMAIL="${CC_AGENT_UI_EMAIL:-}"
PROXY="${CC_AGENT_UI_PROXY:-auto}"
TLS_ENABLED="false"
ALLOW_FLOATING_REF="false"
DRY_RUN="false"
PRINT_CONFIG="false"
VERIFY_ONLY="false"
RUN_STEP=""

AGENT_CLI_PACKAGES=(
  "@anthropic-ai/claude-code"
  "@openai/codex"
  "@google/gemini-cli"
)
AGENT_CLI_COMMANDS=(claude codex gemini)

log() { printf '\n[install-vps] %s\n' "$*"; }
die() { printf '\n[install-vps] ERROR: %s\n' "$*" >&2; exit 1; }

quote_cmd() {
  local out="" arg
  for arg in "$@"; do
    printf -v arg '%q' "$arg"
    out+="${arg} "
  done
  printf '%s' "${out% }"
}

run_cmd() {
  printf '%s\n' "$(quote_cmd "$@")"
  if [[ "${DRY_RUN}" == "true" ]]; then
    return 0
  fi
  "$@"
}

usage() {
  cat <<'EOF'
Usage:
  sudo bash scripts/deploy/install-vps.sh --ref v1.28.0 [options]

Required for normal installs:
  --ref <tag-or-sha>          Pinned release tag or commit SHA.
  --client-id <slug>          Commercial client slug. One client per VPS.

Options:
  --repo-url <url>            Git repository URL.
  --domain <host>             Public DNS name for TLS proxy setup.
  --email <address>           ACME/Let's Encrypt contact email.
  --proxy <caddy|nginx|none>  TLS reverse proxy implementation.
  --no-tls                    Skip TLS/proxy setup; keep local-only bind.
  --allow-floating-ref        Permit refs like main/master/develop.
  --verify-only               Run post-install health checks only.
  --print-config              Print normalized config and exit.
  --dry-run                   Print commands instead of executing them.
  --run-step <name>           Run one installer step, mainly for tests.
  --help                      Show this help.

Environment equivalents:
  CC_AGENT_UI_REPO_URL, CC_AGENT_UI_REF, CC_AGENT_UI_DOMAIN,
  CC_AGENT_UI_EMAIL, CC_AGENT_UI_PROXY, CC_AGENT_UI_CLIENT_ID
EOF
}

is_floating_ref() {
  case "$1" in
    main|master|develop|dev|trunk) return 0 ;;
    *) return 1 ;;
  esac
}

is_allowed_pinned_ref() {
  local ref="$1"
  [[ "${ref}" =~ ^v[0-9]+(\.[0-9]+){1,3}([.-][A-Za-z0-9._-]+)?$ ]] && return 0
  [[ "${ref}" =~ ^[0-9a-fA-F]{7,40}$ ]] && return 0
  return 1
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --repo-url)
        [[ $# -ge 2 ]] || die "--repo-url requires a value"
        REPO_URL="$2"
        shift 2
        ;;
      --ref)
        [[ $# -ge 2 ]] || die "--ref requires a value"
        REPO_REF="$2"
        shift 2
        ;;
      --client-id)
        [[ $# -ge 2 ]] || die "--client-id requires a value"
        CLIENT_ID="$2"
        shift 2
        ;;
      --domain)
        [[ $# -ge 2 ]] || die "--domain requires a value"
        DOMAIN="$2"
        shift 2
        ;;
      --email)
        [[ $# -ge 2 ]] || die "--email requires a value"
        EMAIL="$2"
        shift 2
        ;;
      --proxy)
        [[ $# -ge 2 ]] || die "--proxy requires a value"
        PROXY="$2"
        shift 2
        ;;
      --no-tls)
        TLS_ENABLED="false"
        PROXY="none"
        shift
        ;;
      --allow-floating-ref)
        ALLOW_FLOATING_REF="true"
        shift
        ;;
      --verify-only)
        VERIFY_ONLY="true"
        shift
        ;;
      --print-config)
        PRINT_CONFIG="true"
        shift
        ;;
      --dry-run)
        DRY_RUN="true"
        shift
        ;;
      --run-step)
        [[ $# -ge 2 ]] || die "--run-step requires a value"
        RUN_STEP="$2"
        shift 2
        ;;
      --help|-h)
        usage
        exit 0
        ;;
      *)
        die "unknown option: $1"
        ;;
    esac
  done
}

normalize_proxy_config() {
  case "${PROXY}" in
    auto)
      if [[ -n "${DOMAIN}" || -n "${EMAIL}" ]]; then
        PROXY="caddy"
        TLS_ENABLED="true"
      else
        PROXY="none"
        TLS_ENABLED="false"
      fi
      ;;
    caddy|nginx)
      TLS_ENABLED="true"
      ;;
    none)
      TLS_ENABLED="false"
      ;;
    *)
      die "--proxy must be one of: caddy, nginx, none"
      ;;
  esac

  if [[ "${TLS_ENABLED}" == "true" ]]; then
    [[ -n "${DOMAIN}" ]] || die "--domain is required when TLS/proxy setup is enabled"
    [[ -n "${EMAIL}" ]] || die "--email is required when TLS/proxy setup is enabled"
  fi
}

validate_repo_ref() {
  [[ -n "${REPO_REF}" ]] || die "commercial installs require a pinned release; pass --ref vX.Y.Z or set CC_AGENT_UI_REF"

  if is_floating_ref "${REPO_REF}"; then
    [[ "${ALLOW_FLOATING_REF}" == "true" ]] || die "floating ref '${REPO_REF}' requires --allow-floating-ref"
    return 0
  fi

  is_allowed_pinned_ref "${REPO_REF}" || die "ref '${REPO_REF}' is not a semver tag or commit SHA"
}

validate_client_id() {
  [[ -n "${CLIENT_ID}" ]] || die "full commercial installs require --client-id because each VPS hosts exactly one client"
  [[ "${CLIENT_ID}" =~ ^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$ ]] || die "--client-id must be 1-64 characters: letters, numbers, dot, underscore, or dash"
}

validate_config() {
  validate_repo_ref
  normalize_proxy_config
}

print_config() {
  cat <<EOF
svc_user=${SVC_USER}
svc_home=${SVC_HOME}
repo_url=${REPO_URL}
repo_ref=${REPO_REF}
client_id=${CLIENT_ID}
repo_dir=${REPO_DIR}
domain=${DOMAIN}
email=${EMAIL}
proxy=${PROXY}
tls_enabled=${TLS_ENABLED}
allow_floating_ref=${ALLOW_FLOATING_REF}
verify_only=${VERIFY_ONLY}
dry_run=${DRY_RUN}
EOF
}

require_root() {
  [[ ${EUID} -eq 0 ]] || die "must run as root (try: sudo bash $0)"
}

require_ubuntu() {
  [[ -r /etc/os-release ]] || die "/etc/os-release not found"
  # shellcheck disable=SC1091
  . /etc/os-release
  [[ "${ID:-}" == "ubuntu" ]] || die "this installer targets Ubuntu (got ID=${ID:-unknown})"
  local major=${VERSION_ID%%.*}
  (( major >= 22 )) || die "Ubuntu ${VERSION_ID} too old; need 22.04 or newer"
  log "OS check: Ubuntu ${VERSION_ID}"
}

ensure_packages() {
  log "Installing system packages"
  export DEBIAN_FRONTEND=noninteractive
  run_cmd apt-get update -qq
  run_cmd apt-get install -y -qq curl git rsync ca-certificates gnupg
  if ! command -v node >/dev/null 2>&1 || ! node --version | grep -q "^v${NODE_MAJOR}\."; then
    log "Installing Node.js ${NODE_MAJOR}.x via NodeSource"
    if [[ "${DRY_RUN}" == "true" ]]; then
      printf '%s\n' "curl -fsSL https://deb.nodesource.com/setup_${NODE_MAJOR}.x | bash -"
    else
      curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
    fi
    run_cmd apt-get install -y -qq nodejs
  fi
  if [[ "${DRY_RUN}" == "false" ]]; then
    log "Node: $(node --version) npm: $(npm --version)"
  fi
}

ensure_user() {
  if id "${SVC_USER}" >/dev/null 2>&1; then
    log "User ${SVC_USER} already exists"
  else
    log "Creating user ${SVC_USER}"
    run_cmd useradd -m -s /bin/bash "${SVC_USER}"
  fi

  if id -Gn "${SVC_USER}" 2>/dev/null | grep -qw sudo; then
    run_cmd gpasswd -d "${SVC_USER}" sudo
  fi
}

ensure_bun() {
  if [[ -x "${SVC_HOME}/.bun/bin/bun" && "${DRY_RUN}" == "false" ]]; then
    log "bun already installed ($("${SVC_HOME}/.bun/bin/bun" --version))"
    return
  fi
  log "Ensuring bun for ${SVC_USER}"
  run_cmd sudo -u "${SVC_USER}" -H bash -lc 'test -x "$HOME/.bun/bin/bun" || curl -fsSL https://bun.sh/install | bash'
}

install_agent_clis() {
  log "Installing agent CLIs for ${SVC_USER}"
  run_cmd install -d -m 755 -o "${SVC_USER}" -g "${SVC_USER}" "${SVC_HOME}/.local/bin"
  run_cmd sudo -u "${SVC_USER}" -H npm install -g --prefix "${SVC_HOME}/.local" "${AGENT_CLI_PACKAGES[@]}"

  local cmd
  for cmd in "${AGENT_CLI_COMMANDS[@]}"; do
    run_cmd sudo -u "${SVC_USER}" -H env "PATH=${SVC_HOME}/.local/bin:/usr/local/bin:/usr/bin:/bin" "${SVC_HOME}/.local/bin/${cmd}" --version
  done
}

ensure_repo() {
  if [[ -d "${REPO_DIR}/.git" ]]; then
    log "Repo already cloned at ${REPO_DIR}; fetching ${REPO_REF}"
    run_cmd sudo -u "${SVC_USER}" -H git -C "${REPO_DIR}" fetch --tags origin
    run_cmd sudo -u "${SVC_USER}" -H git -C "${REPO_DIR}" checkout --force "${REPO_REF}"
    if [[ "${DRY_RUN}" == "true" ]]; then
      printf '%s\n' "sudo -u ${SVC_USER} -H git -C ${REPO_DIR} pull --ff-only origin ${REPO_REF} # only when HEAD is a branch"
    elif sudo -u "${SVC_USER}" -H git -C "${REPO_DIR}" symbolic-ref -q HEAD >/dev/null; then
      run_cmd sudo -u "${SVC_USER}" -H git -C "${REPO_DIR}" pull --ff-only origin "${REPO_REF}"
    fi
  elif [[ -e "${REPO_DIR}" ]]; then
    die "${REPO_DIR} exists but is not a git checkout"
  else
    log "Cloning ${REPO_URL} (${REPO_REF})"
    run_cmd sudo -u "${SVC_USER}" -H mkdir -p "${REPO_PARENT}"
    run_cmd sudo -u "${SVC_USER}" -H git clone "${REPO_URL}" "${REPO_DIR}"
    run_cmd sudo -u "${SVC_USER}" -H git -C "${REPO_DIR}" checkout --force "${REPO_REF}"
  fi

  if [[ "${DRY_RUN}" == "false" ]]; then
    [[ -d "${REPO_DIR}/.git" ]] || die "repo dir ${REPO_DIR} missing after clone"
    log "Checked out: $(sudo -u "${SVC_USER}" -H git -C "${REPO_DIR}" describe --always --dirty)"
  fi
}

install_deps() {
  log "Running npm install"
  run_cmd sudo -u "${SVC_USER}" -H bash -lc 'cd "$1" && npm install --no-audit --no-fund' _ "${REPO_DIR}"
}

write_install_metadata() {
  log "Writing install metadata"
  if [[ "${DRY_RUN}" == "true" ]]; then
    printf '%s\n' "write ${INSTALL_ENV_FILE}"
    return
  fi

  install -d -m 755 -o root -g root "${INSTALL_ENV_DIR}"
  cat > "${INSTALL_ENV_FILE}" <<EOF
CC_AGENT_UI_CLIENT_ID=${CLIENT_ID}
CC_AGENT_UI_REPO_URL=${REPO_URL}
CC_AGENT_UI_REF=${REPO_REF}
CC_AGENT_UI_DOMAIN=${DOMAIN}
CC_AGENT_UI_SERVICE_USER=${SVC_USER}
CC_AGENT_UI_SINGLE_TENANT=true
EOF
  chmod 0644 "${INSTALL_ENV_FILE}"
}

install_unit() {
  [[ "${DRY_RUN}" == "true" || -f "${UNIT_SRC}" ]] || die "unit template not found at ${UNIT_SRC}"
  log "Installing systemd unit"
  if [[ "${DRY_RUN}" == "true" ]]; then
    printf '%s\n' "install -m 644 -o root -g root ${UNIT_SRC} ${UNIT_DST}"
    printf '%s\n' "systemctl daemon-reload"
    return
  fi

  local staged
  staged=$(mktemp -p /root cc-agent-ui.service.XXXXXX)
  install -m 600 -o root -g root "${UNIT_SRC}" "${staged}"
  trap 'rm -f "${staged}"' RETURN
  if grep -Eq '^[[:space:]]*User[[:space:]]*=[[:space:]]*root[[:space:]]*$' "${staged}"; then
    die "unit declares User=root; refusing to install"
  fi
  grep -Eq "^[[:space:]]*User[[:space:]]*=[[:space:]]*${SVC_USER}[[:space:]]*$" "${staged}" || die "unit does not declare User=${SVC_USER}"
  install -m 644 -o root -g root "${staged}" "${UNIT_DST}"
  systemctl daemon-reload
}

render_caddyfile() {
  cat <<EOF
${DOMAIN} {
  encode zstd gzip
  reverse_proxy ${UPSTREAM}
}
EOF
}

render_nginx_server_block() {
  cat <<EOF
server {
    listen 80;
    server_name ${DOMAIN};

    location / {
        proxy_pass http://${UPSTREAM};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_read_timeout 300s;
    }
}
EOF
}

configure_proxy() {
  if [[ "${TLS_ENABLED}" != "true" || "${PROXY}" == "none" ]]; then
    log "TLS/proxy setup disabled"
    return
  fi

  case "${PROXY}" in
    caddy)
      log "Configuring Caddy TLS reverse proxy"
      run_cmd apt-get install -y -qq caddy
      if [[ "${DRY_RUN}" == "true" ]]; then
        printf '%s\n' "write /etc/caddy/Caddyfile"
      else
        render_caddyfile > /etc/caddy/Caddyfile
      fi
      run_cmd caddy validate --config /etc/caddy/Caddyfile
      run_cmd systemctl enable caddy
      run_cmd systemctl reload caddy
      ;;
    nginx)
      log "Configuring nginx TLS reverse proxy"
      run_cmd apt-get install -y -qq nginx certbot python3-certbot-nginx
      if [[ "${DRY_RUN}" == "true" ]]; then
        printf '%s\n' "write /etc/nginx/sites-available/cc-agent-ui.conf"
      else
        render_nginx_server_block > /etc/nginx/sites-available/cc-agent-ui.conf
        ln -sf /etc/nginx/sites-available/cc-agent-ui.conf /etc/nginx/sites-enabled/cc-agent-ui.conf
      fi
      run_cmd nginx -t
      run_cmd systemctl reload nginx
      run_cmd certbot --nginx -d "${DOMAIN}" --email "${EMAIL}" --agree-tos --non-interactive --redirect
      ;;
  esac
}

start_service() {
  log "Enabling and starting cc-agent-ui"
  run_cmd systemctl enable cc-agent-ui
  run_cmd systemctl restart cc-agent-ui
  if [[ "${DRY_RUN}" == "false" ]]; then
    local i
    for ((i = 0; i < 30; i++)); do
      systemctl --quiet is-active cc-agent-ui && break
      sleep 1
    done
  fi
  run_health_checks
}

check_http() {
  local url="$1"
  if [[ "${DRY_RUN}" == "true" ]]; then
    printf '%s\n' "curl -fsS ${url}"
    return 0
  fi
  if ! curl -fsS "${url}" >/dev/null; then
    journalctl -u cc-agent-ui -n 50 --no-pager || true
    die "health check failed for ${url}"
  fi
}

check_websocket_readiness() {
  local script
  script='const net=require("node:net");const s=net.connect(3001,"127.0.0.1",()=>{s.write("GET /ws HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: Upgrade\r\nUpgrade: websocket\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\nSec-WebSocket-Version: 13\r\n\r\n")});s.setTimeout(5000);s.on("data",()=>{s.destroy();process.exit(0)});s.on("error",(e)=>{console.error(e.message);process.exit(1)});s.on("timeout",()=>{console.error("websocket readiness timeout");process.exit(1)});'
  run_cmd node -e "${script}"
}

run_health_checks() {
  log "Running health checks"
  run_cmd systemctl is-active cc-agent-ui
  run_cmd bash -lc "owner=\$(ps -o user= -p \"\$(systemctl show -p MainPID --value cc-agent-ui)\" | tr -d ' '); test \"\$owner\" = '${SVC_USER}'"
  if [[ -n "${CLIENT_ID}" ]]; then
    run_cmd test -r "${INSTALL_ENV_FILE}"
    run_cmd grep -Fx "CC_AGENT_UI_CLIENT_ID=${CLIENT_ID}" "${INSTALL_ENV_FILE}"
    run_cmd grep -Fx "CC_AGENT_UI_SINGLE_TENANT=true" "${INSTALL_ENV_FILE}"
  fi
  check_http "http://${UPSTREAM}/health"
  check_http "http://${UPSTREAM}/"
  check_http "http://${UPSTREAM}/app"
  check_websocket_readiness

  local cmd
  for cmd in "${AGENT_CLI_COMMANDS[@]}"; do
    run_cmd sudo -u "${SVC_USER}" -H env "PATH=${SVC_HOME}/.local/bin:/usr/local/bin:/usr/bin:/bin" "${SVC_HOME}/.local/bin/${cmd}" --version
  done
}

post_install_summary() {
  cat <<EOF

cc-agent-ui installed successfully.

Service:     cc-agent-ui.service (User=${SVC_USER})
Client:      ${CLIENT_ID}
Working dir: ${REPO_DIR}
Bind:        http://${UPSTREAM}
Ref:         ${REPO_REF}
Proxy:       ${PROXY}

Verify:
  sudo bash scripts/deploy/install-vps.sh --ref ${REPO_REF} --verify-only --no-tls
  journalctl -u cc-agent-ui -f
EOF
}

run_named_step() {
  case "${RUN_STEP}" in
    install_agent_clis) install_agent_clis ;;
    configure_proxy) configure_proxy ;;
    run_health_checks) run_health_checks ;;
    "") die "--run-step requires a step name" ;;
    *) die "unknown run step: ${RUN_STEP}" ;;
  esac
}

main() {
  parse_args "$@"
  validate_config

  if [[ "${PRINT_CONFIG}" == "true" ]]; then
    print_config
    return 0
  fi

  if [[ -n "${RUN_STEP}" ]]; then
    run_named_step
    return 0
  fi

  if [[ "${VERIFY_ONLY}" == "true" ]]; then
    run_health_checks
    return 0
  fi

  validate_client_id
  require_root
  require_ubuntu
  ensure_packages
  ensure_user
  ensure_bun
  install_agent_clis
  ensure_repo
  install_deps
  write_install_metadata
  install_unit
  configure_proxy
  start_service
  post_install_summary
}

if [[ -z "${BASH_SOURCE[0]:-}" || "${BASH_SOURCE[0]:-}" == "$0" ]]; then
  main "$@"
fi
