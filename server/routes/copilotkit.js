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
  // basePath MUST be '/' when the router is mounted via app.use('/api/copilotkit', ...)
  // because Express strips the mount prefix before the Router sees the request.
  // createCopilotExpressHandler's source (node_modules/@copilotkit/runtime/dist/v2/
  // runtime/endpoints/express.mjs:42-45) registers its routes as literally
  // `${normalizedBase}/*` and `${normalizedBase}` — if basePath is '/api/copilotkit'
  // and we mounted at '/api/copilotkit', the Router matches /api/copilotkit/info
  // against a post-strip URL of /info → no match → 404 (exactly the symptom we hit).
  // With basePath: '/', the Router registers '/' + '*' which matches everything
  // reaching it, and the inner fetch-handler strips the '/' no-op basePath leaving
  // /info / /agent/ccu/run etc. intact for its own route table.
  _router = createCopilotExpressHandler({
    runtime,
    basePath: '/',
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
