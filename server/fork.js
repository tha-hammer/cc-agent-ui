import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { randomUUID } from 'node:crypto';
import { createNormalizedMessage } from './providers/types.js';
import { encodeProjectPath } from './projects.js';

// NOTE (G-3): the forked session id is minted here via randomUUID() and written
// to disk under that id. We rely on `claude --resume <id>` accepting any UUID
// provided the corresponding JSONL exists — undocumented-but-stable behavior.
// If a future SDK tightens validation, this breaks and we pivot to SDK
// forkSession (which limits us to end-of-conversation forks only).
// See thoughts/searchable/shared/research/2026-04-16-session-handling-audit.md

function emitError(ws, content, sessionId) {
  ws.send(createNormalizedMessage({
    kind: 'error',
    content,
    sessionId: sessionId || '',
    provider: 'claude',
  }));
}

/**
 * Slice a parent session JSONL up through a target message uuid, rewrite sessionId
 * on every copied line to a fresh UUID, and write the result as a new JSONL in the
 * same project dir. Emit `session_created` so the client navigates to the new session.
 *
 * @param {{parentSessionId: string, projectPath: string, parentMessageUuid: string, ws: object, fsImpl?: object, uuidImpl?: () => string}} args
 */
export async function prepareFork(args) {
  const {
    parentSessionId,
    projectPath,
    parentMessageUuid,
    ws,
    fsImpl = fs,
    uuidImpl = randomUUID,
  } = args;

  const projectsDir = path.join(os.homedir(), '.claude', 'projects', encodeProjectPath(projectPath));
  const parentPath = path.join(projectsDir, `${parentSessionId}.jsonl`);

  let raw;
  try {
    raw = fsImpl.readFileSync(parentPath, 'utf8');
  } catch (err) {
    emitError(ws, `Failed to read parent session JSONL: ${err.message}`, parentSessionId);
    return;
  }

  const lines = raw.split('\n').filter(Boolean);
  const newSessionId = uuidImpl();
  // Rewrite the first `type: 'user'` entry's uuid (the "root" user message)
  // to a fresh UUID so getSessions() in projects.js doesn't group this fork
  // with the parent. The sidebar groups sessions that share a first-user-uuid
  // (for native `--fork-session` branch visualization). A mid-conversation
  // JSONL slice is a semantically separate conversation and shouldn't be
  // collapsed — otherwise the parent disappears from the sidebar when the
  // fork lands (observed 2026-04-16 smoke). See audit G-5 follow-up.
  const newRootUuid = uuidImpl();
  let oldRootUuid = null;

  const keep = [];
  let foundTarget = false;
  for (const line of lines) {
    let parsed;
    try {
      parsed = JSON.parse(line);
    } catch {
      continue;
    }
    // Compare against the ORIGINAL uuid before any rewrite — otherwise
    // forking at the root user entry would miss the match below.
    const origUuid = parsed.uuid;
    parsed.sessionId = newSessionId;
    // First user entry: capture its old uuid and rewrite to a new one.
    if (oldRootUuid === null && parsed.type === 'user' && parsed.uuid && parsed.parentUuid == null) {
      oldRootUuid = parsed.uuid;
      parsed.uuid = newRootUuid;
    } else if (oldRootUuid !== null && parsed.parentUuid === oldRootUuid) {
      // Immediate children of the root user point their parentUuid at it.
      // Retarget to the new root uuid to keep the graph consistent.
      parsed.parentUuid = newRootUuid;
    }
    keep.push(JSON.stringify(parsed));
    if (origUuid === parentMessageUuid) {
      foundTarget = true;
      break;
    }
  }

  if (!foundTarget) {
    emitError(
      ws,
      `Fork target uuid ${parentMessageUuid} not found in parent session`,
      parentSessionId,
    );
    return;
  }

  const outPath = path.join(projectsDir, `${newSessionId}.jsonl`);
  try {
    fsImpl.writeFileSync(outPath, keep.join('\n') + '\n');
  } catch (err) {
    emitError(ws, `Failed to write forked session JSONL: ${err.message}`, parentSessionId);
    return;
  }

  ws.send(createNormalizedMessage({
    kind: 'session_created',
    newSessionId,
    sessionId: newSessionId,
    fromFork: true,
    provider: 'claude',
  }));
}
