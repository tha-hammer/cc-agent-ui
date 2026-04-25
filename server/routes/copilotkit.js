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
import { SafeInMemoryAgentRunner } from '../lib/safe-in-memory-agent-runner.js';

let _router = null;
const runner = new SafeInMemoryAgentRunner();

function parseAuthenticatedUserId(value) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isInteger(parsed) ? parsed : null;
}

function getRouter() {
  if (_router) return _router;
  const runtime = new CopilotRuntime({
    runner,
    agents: ({ request }) => {
      const userId = parseAuthenticatedUserId(request.headers.get('x-cc-user-id'));
      return {
        ccu: new CcuSessionAgent({
          agentId: 'ccu',
          description: 'cc-agent-ui session wrapper',
          userId,
        }),
      };
    },
  });
  // Mode + basePath geometry explained:
  //
  // The v1.56.3 @copilotkit/react-core client probes POST {basePath} (bare, no
  // suffix) with a JSON envelope `{ method, params, body }` as its FIRST
  // handshake step. That's single-route mode. v2's multi-route mode does not
  // register a handler at the bare base URL, so the probe 404s even when
  // GET {basePath}/info also exists.
  //
  // Using single-route accepts the envelope on POST and dispatches all
  // operations (info, agent/run, agent/connect, agent/stop) through method
  // names in the body. Matches what the client tries first.
  //
  // basePath '/' is required because Express strips the '/api/copilotkit'
  // mount prefix before the Router sees the request (see express.mjs:42-45
  // in the package for router.post(normalizedBase, handler) registration —
  // if basePath were '/api/copilotkit', the Router would try to match POST
  // /api/copilotkit against a post-strip URL of '/' → no match → 404).
  _router = createCopilotExpressHandler({
    runtime,
    basePath: '/',
    mode: 'single-route',
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
  app.use('/api/copilotkit', (req, _res, next) => {
    const userId = parseAuthenticatedUserId(req.user?.id);
    if (userId !== null) {
      req.headers['x-cc-user-id'] = String(userId);
    }
    next();
  }, getRouter());
}
