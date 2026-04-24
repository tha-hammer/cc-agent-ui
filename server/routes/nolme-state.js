/**
 * GET /api/nolme/state/:sessionId — reads the Nolme sidecar state for a
 * given session. Mounted behind authenticateToken in server/index.js.
 *
 * Query params:
 *   provider    (required) — 'claude' | 'cursor' | 'codex' | 'gemini'
 *   projectName (required) — encoded project directory name
 *   projectPath (optional) — absolute project path (fallback encoding source)
 *
 * Returns 200 with the NolmeAgentState object (plan C-2). Falls through to
 * DEFAULT_NOLME_STATE on missing / malformed / wrong-schema sidecar (see
 * server/agents/nolme-state-store.js for the read-tolerance rules).
 *
 * @module routes/nolme-state
 */

import express from 'express';
import { readState } from '../agents/nolme-state-store.js';

const router = express.Router();

router.get('/state/:sessionId', async (req, res) => {
  const { sessionId } = req.params;
  const provider = typeof req.query.provider === 'string' ? req.query.provider : '';
  const projectName = typeof req.query.projectName === 'string' ? req.query.projectName : '';
  const projectPath = typeof req.query.projectPath === 'string' ? req.query.projectPath : '';

  if (!sessionId) {
    return res.status(400).json({ error: 'Missing sessionId' });
  }
  if (!provider) {
    return res.status(400).json({ error: 'Missing provider' });
  }

  try {
    const state = await readState({ sessionId, projectName, projectPath, provider });
    return res.json(state);
  } catch (err) {
    console.error('[routes/nolme-state] read failed:', err);
    return res.status(500).json({ error: 'Failed to read Nolme state' });
  }
});

export default router;
