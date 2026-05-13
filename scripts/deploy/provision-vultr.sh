#!/usr/bin/env bash
# provision-vultr.sh - Operator-side Vultr provisioning wrapper for cc-agent-ui.

set -euo pipefail

API_BASE="${VULTR_API_BASE:-https://api.vultr.com}"
MAX_RETRIES="${VULTR_API_MAX_RETRIES:-5}"
LABEL=""
REGION=""
PLAN=""
OS_ID=""
SSH_KEY_NAME=""
SSH_PUBLIC_KEY_FILE=""
REPO_URL="${CC_AGENT_UI_REPO_URL:-https://github.com/tha-hammer/cc-agent-ui.git}"
REPO_REF="${CC_AGENT_UI_REF:-}"
# cc-agent-ui install-vps.sh also requires a pinned agent-memory monorepo ref
# so packages/session-protocol and app surfaces resolve deterministically.
MONOREPO_URL="${CC_AGENT_UI_MONOREPO_URL:-https://github.com/tha-hammer/agent-memory.git}"
MONOREPO_REF="${CC_AGENT_UI_MONOREPO_REF:-}"
REQUIRED_MONOREPO_APPS_RAW="${CC_AGENT_UI_REQUIRED_MONOREPO_APPS:-cosmic-agent-core,silmari-genui,cosmic-video}"
CLIENT_ID="${CC_AGENT_UI_CLIENT_ID:-}"
DOMAIN=""
EMAIL=""
NO_TLS="false"
DRY_RUN="false"
REUSE_EXISTING="false"
RENDER_STARTUP_SCRIPT="false"
API_SMOKE_TEST="false"
API_SMOKE_METHOD=""
API_SMOKE_PATH=""
PRINT_API_PAYLOAD=""

die() { printf '[provision-vultr] ERROR: %s\n' "$*" >&2; exit 1; }
log() { printf '[provision-vultr] %s\n' "$*" >&2; }

usage() {
  cat <<'EOF'
Usage:
  scripts/deploy/provision-vultr.sh --label NAME --region ewr --plan vc2-2c-4gb \
    --os-id 2284 --ssh-key-name operator --ssh-public-key-file ~/.ssh/id_ed25519.pub \
    --repo-url https://github.com/tha-hammer/cc-agent-ui.git --ref v1.28.0 \
    --monorepo-ref v1.28.0 [options]

Options:
  --label <name>                 Vultr instance label.
  --region <id>                  Vultr region id.
  --plan <id>                    Vultr plan id.
  --os-id <id>                   Vultr OS id.
  --ssh-key-name <name>          Name for reusable Vultr SSH key.
  --ssh-public-key-file <path>   Local SSH public key file.
  --repo-url <url>               Installer repo URL.
  --ref <tag-or-sha>             Pinned installer/app ref.
  --monorepo-url <url>           Agent-memory monorepo URL.
  --monorepo-ref <tag-or-sha>    Pinned monorepo ref for packages/apps.
  --client-id <slug>             Commercial client slug. One client per VPS.
  --domain <host>                Public DNS name for TLS setup.
  --email <address>              ACME contact email.
  --no-tls                       Render startup script without TLS setup.
  --dry-run                      Print payload instead of creating resources.
  --reuse-existing               Reuse matching instance label if found.
  --render-startup-script        Print startup script and exit.
  --api-smoke-test <method> <path>  Exercise the Vultr API wrapper.
  --print-api-payload <kind>     Print an API payload for tests.
EOF
}

json_escape() {
  local value="$1"
  value=${value//\\/\\\\}
  value=${value//\"/\\\"}
  value=${value//$'\n'/\\n}
  printf '%s' "$value"
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --label) LABEL="$2"; shift 2 ;;
      --region) REGION="$2"; shift 2 ;;
      --plan) PLAN="$2"; shift 2 ;;
      --os-id) OS_ID="$2"; shift 2 ;;
      --ssh-key-name) SSH_KEY_NAME="$2"; shift 2 ;;
      --ssh-public-key-file) SSH_PUBLIC_KEY_FILE="$2"; shift 2 ;;
      --repo-url) REPO_URL="$2"; shift 2 ;;
      --ref) REPO_REF="$2"; shift 2 ;;
      --monorepo-url) MONOREPO_URL="$2"; shift 2 ;;
      --monorepo-ref) MONOREPO_REF="$2"; shift 2 ;;
      --client-id) CLIENT_ID="$2"; shift 2 ;;
      --domain) DOMAIN="$2"; shift 2 ;;
      --email) EMAIL="$2"; shift 2 ;;
      --no-tls) NO_TLS="true"; shift ;;
      --dry-run) DRY_RUN="true"; shift ;;
      --reuse-existing) REUSE_EXISTING="true"; shift ;;
      --render-startup-script) RENDER_STARTUP_SCRIPT="true"; shift ;;
      --api-smoke-test)
        [[ $# -ge 3 ]] || die "--api-smoke-test requires method and path"
        API_SMOKE_TEST="true"
        API_SMOKE_METHOD="$2"
        API_SMOKE_PATH="$3"
        shift 3
        ;;
      --print-api-payload)
        [[ $# -ge 2 ]] || die "--print-api-payload requires a value"
        PRINT_API_PAYLOAD="$2"
        shift 2
        ;;
      --help|-h) usage; exit 0 ;;
      *) die "unknown option: $1" ;;
    esac
  done
}

require_vultr_token() {
  [[ -n "${VULTR_API_KEY:-}" ]] || die "VULTR_API_KEY is required"
}

next_test_status() {
  local first rest
  first="${VULTR_TEST_HTTP_STATUSES%%,*}"
  if [[ "${VULTR_TEST_HTTP_STATUSES}" == *","* ]]; then
    rest="${VULTR_TEST_HTTP_STATUSES#*,}"
  else
    rest="${first}"
  fi
  VULTR_TEST_HTTP_STATUSES="${rest}"
  TEST_STATUS_REPLY="${first}"
}

vultr_api() {
  local method="$1"
  local path="$2"
  local body="${3:-}"
  local attempt status response_file config_file

  require_vultr_token

  for ((attempt = 1; attempt <= MAX_RETRIES; attempt++)); do
    if [[ -n "${VULTR_TEST_HTTP_STATUSES:-}" ]]; then
      next_test_status
      status="${TEST_STATUS_REPLY}"
      printf 'attempt=%s status=%s\n' "${attempt}" "${status}"
    else
      response_file="$(mktemp)"
      config_file="$(mktemp)"
      chmod 600 "${config_file}"
      printf 'header = "Authorization: Bearer %s"\n' "${VULTR_API_KEY}" > "${config_file}"
      printf 'header = "Content-Type: application/json"\n' >> "${config_file}"
      if [[ -n "${body}" ]]; then
        status="$(curl -sS -o "${response_file}" -w '%{http_code}' --config "${config_file}" -X "${method}" --data "${body}" "${API_BASE}${path}")"
      else
        status="$(curl -sS -o "${response_file}" -w '%{http_code}' --config "${config_file}" -X "${method}" "${API_BASE}${path}")"
      fi
      log "attempt=${attempt} method=${method} path=${path} status=${status}"
    fi

    case "${status}" in
      2*)
        if [[ -n "${response_file:-}" ]]; then
          cat "${response_file}"
          rm -f "${response_file}" "${config_file}"
        fi
        return 0
        ;;
      401|403)
        rm -f "${response_file:-}" "${config_file:-}"
        die "Vultr API authorization failed with status ${status}"
        ;;
      429|5*)
        rm -f "${response_file:-}" "${config_file:-}"
        if (( attempt == MAX_RETRIES )); then
          die "Vultr API failed after ${attempt} attempts with status ${status}"
        fi
        if [[ -z "${VULTR_TEST_HTTP_STATUSES:-}" ]]; then
          sleep $((attempt * attempt))
        fi
        ;;
      *)
        rm -f "${response_file:-}" "${config_file:-}"
        die "Vultr API request failed with status ${status}"
        ;;
    esac
  done
}

shell_quote() {
  local out="" arg
  for arg in "$@"; do
    printf -v arg '%q' "$arg"
    out+="${arg} "
  done
  printf '%s' "${out% }"
}

render_startup_script() {
  [[ -n "${REPO_REF}" ]] || die "--ref is required"
  [[ -n "${MONOREPO_REF}" ]] || die "--monorepo-ref is required"
  validate_client_id

  local install_args
  install_args=(
    --repo-url "${REPO_URL}"
    --ref "${REPO_REF}"
    --monorepo-url "${MONOREPO_URL}"
    --monorepo-ref "${MONOREPO_REF}"
    --client-id "${CLIENT_ID}"
  )
  if [[ "${NO_TLS}" == "true" ]]; then
    install_args+=(--no-tls)
  else
    [[ -n "${DOMAIN}" ]] && install_args+=(--domain "${DOMAIN}")
    [[ -n "${EMAIL}" ]] && install_args+=(--email "${EMAIL}")
  fi

  cat <<EOF
#!/usr/bin/env bash
set -euo pipefail
export CC_AGENT_UI_REPO_URL=$(printf '%q' "${REPO_URL}")
export CC_AGENT_UI_REF=$(printf '%q' "${REPO_REF}")
export CC_AGENT_UI_MONOREPO_URL=$(printf '%q' "${MONOREPO_URL}")
export CC_AGENT_UI_MONOREPO_REF=$(printf '%q' "${MONOREPO_REF}")
export CC_AGENT_UI_REQUIRED_MONOREPO_APPS=$(printf '%q' "${REQUIRED_MONOREPO_APPS_RAW}")
export CC_AGENT_UI_CLIENT_ID=$(printf '%q' "${CLIENT_ID}")
apt-get update -qq
apt-get install -y -qq curl git ca-certificates
tmp_dir="\$(mktemp -d)"
git clone $(printf '%q' "${REPO_URL}") "\${tmp_dir}/cc-agent-ui"
git -C "\${tmp_dir}/cc-agent-ui" fetch --tags origin
git -C "\${tmp_dir}/cc-agent-ui" checkout --force $(printf '%q' "${REPO_REF}")
bash "\${tmp_dir}/cc-agent-ui/scripts/deploy/install-vps.sh" $(shell_quote "${install_args[@]}")
EOF
}

validate_dry_run_inputs() {
  [[ -n "${LABEL}" ]] || die "--label is required"
  if [[ -z "${CLIENT_ID}" ]]; then
    CLIENT_ID="${LABEL}"
  fi
  validate_client_id
  [[ -n "${REGION}" ]] || die "--region is required"
  [[ -n "${PLAN}" ]] || die "--plan is required"
  [[ -n "${OS_ID}" ]] || die "--os-id is required"
  [[ -n "${SSH_KEY_NAME}" ]] || die "--ssh-key-name is required"
  [[ -n "${SSH_PUBLIC_KEY_FILE}" ]] || die "--ssh-public-key-file is required"
  [[ -n "${REPO_REF}" ]] || die "--ref is required"
  [[ -n "${MONOREPO_REF}" ]] || die "--monorepo-ref is required"
  [[ -n "${REQUIRED_MONOREPO_APPS_RAW}" ]] || die "CC_AGENT_UI_REQUIRED_MONOREPO_APPS cannot be empty"
}

validate_client_id() {
  [[ -n "${CLIENT_ID}" ]] || die "--client-id is required because each VPS hosts exactly one client"
  [[ "${CLIENT_ID}" =~ ^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$ ]] || die "--client-id must be 1-64 characters: letters, numbers, dot, underscore, or dash"
}

print_dry_run_payload() {
  validate_dry_run_inputs
  local startup_script
  startup_script="$(render_startup_script)"
  printf '{"label":"%s","client_id":"%s","region":"%s","plan":"%s","os_id":%s,"ssh_key_name":"%s","ssh_public_key_file":"%s","repo_url":"%s","ref":"%s","monorepo_url":"%s","monorepo_ref":"%s","required_monorepo_apps":"%s","reuse_existing":%s,"startup_script":"%s"}\n' \
    "$(json_escape "${LABEL}")" \
    "$(json_escape "${CLIENT_ID}")" \
    "$(json_escape "${REGION}")" \
    "$(json_escape "${PLAN}")" \
    "${OS_ID}" \
    "$(json_escape "${SSH_KEY_NAME}")" \
    "$(json_escape "${SSH_PUBLIC_KEY_FILE}")" \
    "$(json_escape "${REPO_URL}")" \
    "$(json_escape "${REPO_REF}")" \
    "$(json_escape "${MONOREPO_URL}")" \
    "$(json_escape "${MONOREPO_REF}")" \
    "$(json_escape "${REQUIRED_MONOREPO_APPS_RAW}")" \
    "${REUSE_EXISTING}" \
    "$(json_escape "${startup_script}")"
}

build_startup_script_payload() {
  local startup_script="$1"
  local label="$2"
  STARTUP_SCRIPT="${startup_script}" LABEL="${label}" node -e 'console.log(JSON.stringify({name: `${process.env.LABEL}-installer`, type: "boot", script: Buffer.from(process.env.STARTUP_SCRIPT, "utf8").toString("base64")}))'
}

print_api_payload() {
  case "${PRINT_API_PAYLOAD}" in
    startup-script)
      build_startup_script_payload "${VULTR_TEST_STARTUP_SCRIPT:-}" "${VULTR_TEST_LABEL:-cc-agent-ui-test}"
      ;;
    "")
      die "--print-api-payload requires a payload kind"
      ;;
    *)
      die "unknown API payload kind: ${PRINT_API_PAYLOAD}"
      ;;
  esac
}

ensure_ssh_key() {
  [[ -r "${SSH_PUBLIC_KEY_FILE}" ]] || die "SSH public key file not readable: ${SSH_PUBLIC_KEY_FILE}"

  local keys_response existing_id public_key body create_response ssh_key_id
  keys_response="$(vultr_api GET /v2/ssh-keys)"
  existing_id="$(printf '%s' "${keys_response}" | SSH_KEY_NAME="${SSH_KEY_NAME}" node -e 'let s="";process.stdin.on("data",d=>s+=d);process.stdin.on("end",()=>{const j=JSON.parse(s);const key=(j.ssh_keys||[]).find(k=>k.name===process.env.SSH_KEY_NAME);console.log(key?.id || "")})')"
  if [[ -n "${existing_id}" ]]; then
    printf '%s\n' "${existing_id}"
    return 0
  fi

  public_key="$(< "${SSH_PUBLIC_KEY_FILE}")"
  body="$(SSH_KEY_NAME="${SSH_KEY_NAME}" SSH_PUBLIC_KEY="${public_key}" node -e 'console.log(JSON.stringify({name: process.env.SSH_KEY_NAME, ssh_key: process.env.SSH_PUBLIC_KEY}))')"
  create_response="$(vultr_api POST /v2/ssh-keys "${body}")"
  ssh_key_id="$(printf '%s' "${create_response}" | node -e 'let s="";process.stdin.on("data",d=>s+=d);process.stdin.on("end",()=>{const j=JSON.parse(s);console.log(j.ssh_key?.id || "")})')"
  [[ -n "${ssh_key_id}" ]] || die "failed to parse ssh key id"
  printf '%s\n' "${ssh_key_id}"
}

provision_instance() {
  validate_dry_run_inputs
  require_vultr_token
  command -v node >/dev/null 2>&1 || die "node is required to build Vultr JSON payloads"

  local startup_script startup_body startup_response script_id ssh_key_id instance_body instance_response instance_id
  startup_script="$(render_startup_script)"
  startup_body="$(build_startup_script_payload "${startup_script}" "${LABEL}")"
  startup_response="$(vultr_api POST /v2/startup-scripts "${startup_body}")"
  script_id="$(printf '%s' "${startup_response}" | node -e 'let s="";process.stdin.on("data",d=>s+=d);process.stdin.on("end",()=>{const j=JSON.parse(s);console.log(j.startup_script?.id || "")})')"
  [[ -n "${script_id}" ]] || die "failed to parse startup script id"

  ssh_key_id="$(ensure_ssh_key)"
  instance_body="$(LABEL="${LABEL}" REGION="${REGION}" PLAN="${PLAN}" OS_ID="${OS_ID}" SCRIPT_ID="${script_id}" SSH_KEY_ID="${ssh_key_id}" node -e 'console.log(JSON.stringify({region: process.env.REGION, plan: process.env.PLAN, os_id: Number(process.env.OS_ID), label: process.env.LABEL, script_id: process.env.SCRIPT_ID, sshkey_id: [process.env.SSH_KEY_ID]}))')"
  instance_response="$(vultr_api POST /v2/instances "${instance_body}")"
  instance_id="$(printf '%s' "${instance_response}" | node -e 'let s="";process.stdin.on("data",d=>s+=d);process.stdin.on("end",()=>{const j=JSON.parse(s);console.log(j.instance?.id || "")})')"
  [[ -n "${instance_id}" ]] || die "failed to parse instance id"

  printf 'instance_id=%s\n' "${instance_id}"
}

main() {
  parse_args "$@"

  if [[ -n "${PRINT_API_PAYLOAD}" ]]; then
    print_api_payload
    return 0
  fi

  if [[ "${API_SMOKE_TEST}" == "true" ]]; then
    vultr_api "${API_SMOKE_METHOD}" "${API_SMOKE_PATH}"
    return 0
  fi

  if [[ "${RENDER_STARTUP_SCRIPT}" == "true" ]]; then
    render_startup_script
    return 0
  fi

  if [[ "${DRY_RUN}" == "true" ]]; then
    print_dry_run_payload
    return 0
  fi

  provision_instance
}

if [[ -z "${BASH_SOURCE[0]:-}" || "${BASH_SOURCE[0]:-}" == "$0" ]]; then
  main "$@"
fi
