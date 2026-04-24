/**
 * Mount the CopilotKit v2 runtime at /api/copilotkit.
 *
 * Uses the v2 subpath of @copilotkit/runtime because the v1.56.3 React client
 * (@copilotkit/react-core) probes `GET {basePath}/info` for runtime handshake
 * — a route only the v2 server handles. v1 copilotRuntimeNodeExpressEndpoint
 * returns 404 for /info, which surfaces client-side as "runtime_info_fetch_failed".
 *
 * createCopilotExpressHandler returns an Express Router that serves:
 *   GET  {basePath}/info                         — runtime handshake
 *   POST {basePath}/agent/:agentId/run            — streamed run
 *   POST {basePath}/agent/:agentId/connect        — session hydration
 *   POST {basePath}/agent/:agentId/stop/:threadId — abort
 *   (plus other v2 routes)
 *
 * Auth: the CALLER mounts authenticateToken on /api/copilotkit before calling
 * mountCopilotKit. This module does NOT install its own auth.
 *
 * @module routes/copilotkit
 */

import { CopilotRuntime, createCopilotExpressHandler } from '@copilotkit/runtime/v2';
import { CcuSessionAgent } from '../agents/ccu-session-agent.js';

let _router = null;

function getRouter() {
  if (_router) return _router;
  const runtime = new CopilotRuntime({
    agents: { ccu: new CcuSessionAgent({ agentId: 'ccu', description: 'cc-agent-ui session wrapper' }) },
  });
  _router = createCopilotExpressHandler({
    runtime,
    basePath: '/api/copilotkit',
    // CORS is handled at the app level (app.use(cors(...)) in server/index.js).
    // Passing false here prevents duplicate CORS headers.
    cors: false,
  });
  return _router;
}

/**
 * Mount the CopilotKit router at /api/copilotkit.
 *
 * @param {import('express').Application} app
 */
export function mountCopilotKit(app) {
  app.use('/api/copilotkit', getRouter());
}
