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
# Q1 (SSE wire protocol) split a shared package out of cc-agent-ui:
# `@cosmic-agent/session-protocol` lives in the agent-memory monorepo's
# packages/ dir. cc-agent-ui's package.json declares `file:../packages/...`
# so the monorepo clone has to land alongside the cc-agent-ui clone.
# Current monorepo layout also carries:
#   - apps/cosmic-agent-core  (AAI source tree)
#   - apps/silmari-genui      (genui framework app)
#   - apps/cosmic-video       (video compositor/transcriber app)
MONOREPO_URL="${CC_AGENT_UI_MONOREPO_URL:-https://github.com/tha-hammer/agent-memory.git}"
MONOREPO_REF="${CC_AGENT_UI_MONOREPO_REF:-}"
# Comma-separated app directories expected under <monorepo>/apps.
# Defaults reflect the current production surfaces:
#   - cosmic-agent-core (AAI infrastructure)
#   - silmari-genui     (second UI surface)
#   - cosmic-video      (video processing app)
REQUIRED_MONOREPO_APPS_RAW="${CC_AGENT_UI_REQUIRED_MONOREPO_APPS:-cosmic-agent-core,silmari-genui,cosmic-video}"
REPO_PARENT="${SVC_HOME}/Dev/cosmic-agent-memory"
REPO_DIR="${REPO_PARENT}/cc-agent-ui"
MONOREPO_DIR="${REPO_PARENT}/_monorepo"
PACKAGES_LINK="${REPO_PARENT}/packages"
APPS_LINK="${REPO_PARENT}/apps"
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
REQUIRED_MONOREPO_APPS=()

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
  --ref <tag-or-sha>          Pinned cc-agent-ui release tag or commit SHA.
  --monorepo-ref <tag-or-sha> Pinned agent-memory monorepo ref. Provides
                              packages/session-protocol/ (required by
                              cc-agent-ui via file:../packages) plus the apps/
                              subtree (cosmic-agent-core, silmari-genui,
                              cosmic-video) for one-client-per-VPS routing.
  --client-id <slug>          Commercial client slug. One client per VPS.

Options:
  --repo-url <url>            cc-agent-ui git repository URL.
  --monorepo-url <url>        agent-memory monorepo URL.
  --domain <host>             Public DNS name for TLS proxy setup.
  --email <address>           ACME/Let's Encrypt contact email.
  --proxy <caddy|nginx|none>  TLS reverse proxy implementation.
  --no-tls                    Skip TLS/proxy setup; keep local-only bind.
  --allow-floating-ref        Permit refs like main/master/develop (applies
                              to BOTH --ref and --monorepo-ref).
  --verify-only               Run post-install health checks only.
  --print-config              Print normalized config and exit.
  --dry-run                   Print commands instead of executing them.
  --run-step <name>           Run one installer step, mainly for tests.
  --help                      Show this help.

Environment equivalents:
  CC_AGENT_UI_REPO_URL, CC_AGENT_UI_REF, CC_AGENT_UI_DOMAIN,
  CC_AGENT_UI_EMAIL, CC_AGENT_UI_PROXY, CC_AGENT_UI_CLIENT_ID,
  CC_AGENT_UI_MONOREPO_URL, CC_AGENT_UI_MONOREPO_REF,
  CC_AGENT_UI_REQUIRED_MONOREPO_APPS
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
      --monorepo-url)
        [[ $# -ge 2 ]] || die "--monorepo-url requires a value"
        MONOREPO_URL="$2"
        shift 2
        ;;
      --monorepo-ref)
        [[ $# -ge 2 ]] || die "--monorepo-ref requires a value"
        MONOREPO_REF="$2"
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

validate_monorepo_ref() {
  # Format-only check: tolerates empty MONOREPO_REF so paths that don't need
  # the monorepo (--print-config without --monorepo-ref, --run-step
  # install_agent_clis, etc.) don't have to invent a placeholder. The
  # presence requirement is enforced separately by require_monorepo_ref.
  [[ -n "${MONOREPO_REF}" ]] || return 0

  if is_floating_ref "${MONOREPO_REF}"; then
    [[ "${ALLOW_FLOATING_REF}" == "true" ]] || die "floating monorepo ref '${MONOREPO_REF}' requires --allow-floating-ref"
    return 0
  fi

  is_allowed_pinned_ref "${MONOREPO_REF}" || die "monorepo ref '${MONOREPO_REF}' is not a semver tag or commit SHA"
}

require_monorepo_ref() {
  # Hard requirement. Called from the full install path and from
  # `--run-step ensure_monorepo_packages` — anything that actually clones
  # the monorepo.
  [[ -n "${MONOREPO_REF}" ]] || die "commercial installs require a pinned monorepo ref so packages/session-protocol matches the cc-agent-ui release; pass --monorepo-ref vX.Y.Z or set CC_AGENT_UI_MONOREPO_REF"
}

validate_client_id() {
  [[ -n "${CLIENT_ID}" ]] || die "full commercial installs require --client-id because each VPS hosts exactly one client"
  [[ "${CLIENT_ID}" =~ ^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$ ]] || die "--client-id must be 1-64 characters: letters, numbers, dot, underscore, or dash"
}

validate_config() {
  validate_repo_ref
  validate_monorepo_ref
  normalize_proxy_config
}

parse_required_monorepo_apps() {
  REQUIRED_MONOREPO_APPS=()
  local raw_apps app
  IFS=',' read -r -a raw_apps <<< "${REQUIRED_MONOREPO_APPS_RAW}"

  for app in "${raw_apps[@]}"; do
    # Trim leading/trailing ASCII whitespace so env values like
    # "foo, bar" are accepted.
    app="${app#"${app%%[![:space:]]*}"}"
    app="${app%"${app##*[![:space:]]}"}"
    [[ -n "${app}" ]] || continue
    REQUIRED_MONOREPO_APPS+=("${app}")
  done

  [[ "${#REQUIRED_MONOREPO_APPS[@]}" -gt 0 ]] || die "CC_AGENT_UI_REQUIRED_MONOREPO_APPS resolved to an empty app list"
}

verify_required_monorepo_surfaces() {
  local missing_paths=() app

  [[ -d "${MONOREPO_DIR}/packages/session-protocol" ]] || missing_paths+=("packages/session-protocol")
  for app in "${REQUIRED_MONOREPO_APPS[@]}"; do
    [[ -d "${MONOREPO_DIR}/apps/${app}" ]] || missing_paths+=("apps/${app}")
  done

  if [[ "${#missing_paths[@]}" -gt 0 ]]; then
    die "monorepo ref '${MONOREPO_REF}' at '${MONOREPO_URL}' is missing required surfaces: ${missing_paths[*]} (these must exist in GitHub before provisioning)"
  fi
}

print_config() {
  cat <<EOF
svc_user=${SVC_USER}
svc_home=${SVC_HOME}
repo_url=${REPO_URL}
repo_ref=${REPO_REF}
monorepo_url=${MONOREPO_URL}
monorepo_ref=${MONOREPO_REF}
required_monorepo_apps=${REQUIRED_MONOREPO_APPS_RAW}
client_id=${CLIENT_ID}
repo_dir=${REPO_DIR}
monorepo_dir=${MONOREPO_DIR}
packages_link=${PACKAGES_LINK}
apps_link=${APPS_LINK}
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
  run_cmd install -d -m 755 -o "${SVC_USER}" -g "${SVC_USER}" "${SVC_HOME}/.local" "${SVC_HOME}/.local/bin" "${SVC_HOME}/.local/lib" "${SVC_HOME}/.local/share"
  run_cmd chown -R "${SVC_USER}:${SVC_USER}" "${SVC_HOME}/.local"
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

ensure_monorepo_packages() {
  # cc-agent-ui's package.json declares
  # `"@cosmic-agent/session-protocol": "file:../packages/session-protocol"`.
  # That `..` resolves to ${REPO_PARENT}, so we must ensure
  # ${REPO_PARENT}/packages/session-protocol/ exists at install time.
  #
  # Strategy: clone the agent-memory monorepo into ${REPO_PARENT}/_monorepo
  # (idempotent fetch + checkout, mirroring ensure_repo), then symlink both:
  #   - ${REPO_PARENT}/packages -> ${MONOREPO_DIR}/packages  (required)
  #   - ${REPO_PARENT}/apps     -> ${MONOREPO_DIR}/apps      (operational)
  # This keeps shared protocol + app surfaces in lockstep with the pinned
  # monorepo ref and avoids copy-on-update drift.
  if [[ -d "${MONOREPO_DIR}/.git" ]]; then
    log "Monorepo already cloned at ${MONOREPO_DIR}; fetching ${MONOREPO_REF}"
    run_cmd sudo -u "${SVC_USER}" -H git -C "${MONOREPO_DIR}" fetch --tags origin
    run_cmd sudo -u "${SVC_USER}" -H git -C "${MONOREPO_DIR}" checkout --force "${MONOREPO_REF}"
    if [[ "${DRY_RUN}" == "true" ]]; then
      printf '%s\n' "sudo -u ${SVC_USER} -H git -C ${MONOREPO_DIR} pull --ff-only origin ${MONOREPO_REF} # only when HEAD is a branch"
    elif sudo -u "${SVC_USER}" -H git -C "${MONOREPO_DIR}" symbolic-ref -q HEAD >/dev/null; then
      run_cmd sudo -u "${SVC_USER}" -H git -C "${MONOREPO_DIR}" pull --ff-only origin "${MONOREPO_REF}"
    fi
  elif [[ -e "${MONOREPO_DIR}" ]]; then
    die "${MONOREPO_DIR} exists but is not a git checkout"
  else
    log "Cloning ${MONOREPO_URL} (${MONOREPO_REF}) into ${MONOREPO_DIR}"
    run_cmd sudo -u "${SVC_USER}" -H mkdir -p "${REPO_PARENT}"
    run_cmd sudo -u "${SVC_USER}" -H git clone "${MONOREPO_URL}" "${MONOREPO_DIR}"
    run_cmd sudo -u "${SVC_USER}" -H git -C "${MONOREPO_DIR}" checkout --force "${MONOREPO_REF}"
  fi

  if [[ "${DRY_RUN}" == "false" ]]; then
    [[ -d "${MONOREPO_DIR}/.git" ]] || die "monorepo dir ${MONOREPO_DIR} missing after clone"
    verify_required_monorepo_surfaces
    log "Monorepo checked out: $(sudo -u "${SVC_USER}" -H git -C "${MONOREPO_DIR}" describe --always --dirty)"
  fi

  # Symlink ${REPO_PARENT}/packages -> ${MONOREPO_DIR}/packages so that
  # cc-agent-ui's `file:../packages/session-protocol` resolves to the cloned
  # monorepo's packages/ subtree.
  if [[ "${DRY_RUN}" == "true" ]]; then
    printf '%s\n' "sudo -u ${SVC_USER} -H ln -sfn ${MONOREPO_DIR}/packages ${PACKAGES_LINK}"
    printf '%s\n' "sudo -u ${SVC_USER} -H ln -sfn ${MONOREPO_DIR}/apps ${APPS_LINK}"
    return 0
  fi

  if [[ -L "${PACKAGES_LINK}" ]]; then
    local current
    current=$(readlink -f "${PACKAGES_LINK}" || true)
    if [[ "${current}" != "${MONOREPO_DIR}/packages" ]]; then
      log "Refreshing stale ${PACKAGES_LINK} symlink (was ${current})"
      run_cmd sudo -u "${SVC_USER}" -H ln -sfn "${MONOREPO_DIR}/packages" "${PACKAGES_LINK}"
    fi
  elif [[ -e "${PACKAGES_LINK}" ]]; then
    die "${PACKAGES_LINK} exists and is not a symlink — refusing to clobber"
  else
    log "Linking ${PACKAGES_LINK} -> ${MONOREPO_DIR}/packages"
    run_cmd sudo -u "${SVC_USER}" -H ln -sfn "${MONOREPO_DIR}/packages" "${PACKAGES_LINK}"
  fi

  # Symlink ${REPO_PARENT}/apps -> ${MONOREPO_DIR}/apps so one-client-per-VPS
  # deployments can access monorepo app surfaces in a stable path.
  [[ -d "${MONOREPO_DIR}/apps" ]] || die "${MONOREPO_DIR}/apps is missing"
  if [[ -L "${APPS_LINK}" ]]; then
    local current_apps
    current_apps=$(readlink -f "${APPS_LINK}" || true)
    if [[ "${current_apps}" != "${MONOREPO_DIR}/apps" ]]; then
      log "Refreshing stale ${APPS_LINK} symlink (was ${current_apps})"
      run_cmd sudo -u "${SVC_USER}" -H ln -sfn "${MONOREPO_DIR}/apps" "${APPS_LINK}"
    fi
  elif [[ -e "${APPS_LINK}" ]]; then
    die "${APPS_LINK} exists and is not a symlink — refusing to clobber"
  else
    log "Linking ${APPS_LINK} -> ${MONOREPO_DIR}/apps"
    run_cmd sudo -u "${SVC_USER}" -H ln -sfn "${MONOREPO_DIR}/apps" "${APPS_LINK}"
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
CC_AGENT_UI_MONOREPO_URL=${MONOREPO_URL}
CC_AGENT_UI_MONOREPO_REF=${MONOREPO_REF}
CC_AGENT_UI_REQUIRED_MONOREPO_APPS=${REQUIRED_MONOREPO_APPS_RAW}
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

  local i
  for ((i = 1; i <= 60; i++)); do
    curl -fsS "${url}" >/dev/null && return 0
    sleep 1
  done

  journalctl -u cc-agent-ui -n 50 --no-pager || true
  die "health check failed for ${url}"
}

check_websocket_readiness() {
  local script
  script='const net=require("node:net");const s=net.connect(3001,"127.0.0.1",()=>{s.write("GET /ws HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: Upgrade\r\nUpgrade: websocket\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\nSec-WebSocket-Version: 13\r\n\r\n")});s.setTimeout(5000);s.on("data",()=>{s.destroy();process.exit(0)});s.on("error",(e)=>{console.error(e.message);process.exit(1)});s.on("timeout",()=>{console.error("websocket readiness timeout");process.exit(1)});'
  if [[ "${DRY_RUN}" == "true" ]]; then
    run_cmd node -e "${script}"
    return 0
  fi

  local i
  for ((i = 1; i <= 60; i++)); do
    node -e "${script}" && return 0
    sleep 1
  done

  journalctl -u cc-agent-ui -n 50 --no-pager || true
  die "websocket readiness check failed"
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

Service:        cc-agent-ui.service (User=${SVC_USER})
Client:         ${CLIENT_ID}
Working dir:    ${REPO_DIR}
Monorepo dir:   ${MONOREPO_DIR}
Packages link:  ${PACKAGES_LINK} -> ${MONOREPO_DIR}/packages
Apps link:      ${APPS_LINK} -> ${MONOREPO_DIR}/apps
Bind:           http://${UPSTREAM}
cc-agent-ui ref: ${REPO_REF}
Monorepo ref:   ${MONOREPO_REF}
Proxy:          ${PROXY}

Verify:
  sudo bash scripts/deploy/install-vps.sh --ref ${REPO_REF} --monorepo-ref ${MONOREPO_REF} --verify-only --no-tls
  journalctl -u cc-agent-ui -f
EOF
}

run_named_step() {
  case "${RUN_STEP}" in
    install_agent_clis) install_agent_clis ;;
    ensure_monorepo_packages)
      require_monorepo_ref
      ensure_monorepo_packages
      ;;
    configure_proxy) configure_proxy ;;
    run_health_checks) run_health_checks ;;
    "") die "--run-step requires a step name" ;;
    *) die "unknown run step: ${RUN_STEP}" ;;
  esac
}

main() {
  parse_args "$@"
  parse_required_monorepo_apps
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
  require_monorepo_ref
  require_root
  require_ubuntu
  ensure_packages
  ensure_user
  ensure_bun
  install_agent_clis
  ensure_repo
  ensure_monorepo_packages
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
