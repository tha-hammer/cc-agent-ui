/**
 * NolmeAgentState sidecar store.
 *
 * Persists per-session NolmeAgentState (phases, currentPhaseIndex, resources,
 * profile, quickActions, taskNotifications) at:
 *   ~/.claude/projects/<encoded-project-path>/<sessionId>.nolme-state.json
 *
 * The canonical encoding helper (encodeProjectPath from server/projects.js) is
 * reused so this file stays aligned with the session-handling audit (G-1).
 *
 * Schema contract (plan C-2):
 *   {
 *     schemaVersion: 1,
 *     phases: NolmePhase[],
 *     currentPhaseIndex: number,
 *     currentReviewLine: string,
 *     resources: NolmeResource[],
 *     profile: NolmeAgentProfile | null,
 *     quickActions: string[],
 *     taskNotifications: { status, summary, ts }[]
 *   }
 *
 * Reads tolerate missing file, malformed JSON, and schema-version mismatch — all
 * three cases return DEFAULT_NOLME_STATE. This keeps Nolme hydration robust
 * against corrupt/legacy sidecars without bubbling errors into the run.
 *
 * @module agents/nolme-state-store
 */

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { encodeProjectPath } from '../projects.js';

/** @readonly */
export const DEFAULT_NOLME_STATE = Object.freeze({
  schemaVersion: 1,
  phases: [],
  currentPhaseIndex: 0,
  currentReviewLine: '',
  resources: [],
  profile: null,
  quickActions: [],
  taskNotifications: [],
});

/**
 * Resolve the on-disk directory for a session's sidecar. Prefers the binding's
 * `projectName` (the existing encoded form cc-agent-ui already computes); falls
 * back to `encodeProjectPath(projectPath)` when projectName is empty/missing.
 *
 * @param {{ projectName?: string, projectPath?: string }} binding
 * @returns {string}
 */
function resolveSessionDir(binding) {
  const projectName = binding?.projectName && binding.projectName.length > 0
    ? binding.projectName
    : encodeProjectPath(binding?.projectPath || '');
  return path.join(os.homedir(), '.claude', 'projects', projectName);
}

/**
 * @param {{ sessionId: string, projectName?: string, projectPath?: string }} binding
 * @returns {string}
 */
function resolveSidecarPath(binding) {
  if (!binding?.sessionId) {
    throw new Error('nolme-state-store: binding.sessionId is required');
  }
  return path.join(resolveSessionDir(binding), `${binding.sessionId}.nolme-state.json`);
}

/**
 * Deep clone DEFAULT_NOLME_STATE so callers can safely mutate the result.
 * @returns {ReturnType<typeof makeDefaultState>}
 */
function makeDefaultState() {
  return {
    schemaVersion: 1,
    phases: [],
    currentPhaseIndex: 0,
    currentReviewLine: '',
    resources: [],
    profile: null,
    quickActions: [],
    taskNotifications: [],
  };
}

/**
 * Read the sidecar for a session. Returns DEFAULT_NOLME_STATE on any failure
 * (missing file, bad JSON, schema-version mismatch).
 *
 * @param {{ sessionId: string, projectName?: string, projectPath?: string }} binding
 * @returns {Promise<import('./nolme-state-store.js').NolmeAgentStateLike>}
 */
export async function readState(binding) {
  const sidecarPath = resolveSidecarPath(binding);
  let raw;
  try {
    raw = await fs.readFile(sidecarPath, 'utf8');
  } catch (err) {
    if (err && typeof err === 'object' && 'code' in err && err.code === 'ENOENT') {
      return makeDefaultState();
    }
    console.warn('[nolme-state-store] read failed:', err);
    return makeDefaultState();
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return makeDefaultState();
  }
  if (!parsed || typeof parsed !== 'object' || parsed.schemaVersion !== 1) {
    return makeDefaultState();
  }
  return parsed;
}

/**
 * Write the sidecar for a session. Creates parent directories if missing. The
 * caller is responsible for supplying a state object that conforms to C-2;
 * validation is intentionally light so in-flight writes can include partially
 * populated state without rejection.
 *
 * @param {{ sessionId: string, projectName?: string, projectPath?: string }} binding
 * @param {object} state
 * @returns {Promise<void>}
 */
export async function writeState(binding, state) {
  const dir = resolveSessionDir(binding);
  const sidecarPath = resolveSidecarPath(binding);
  await fs.mkdir(dir, { recursive: true });
  const payload = { ...state, schemaVersion: 1 };
  await fs.writeFile(sidecarPath, JSON.stringify(payload, null, 2), 'utf8');
}
