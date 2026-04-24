/**
 * Mount the CopilotKit runtime at /api/copilotkit.
 *
 * Auth: the CALLER is responsible for mounting `authenticateToken` on
 * `/api/copilotkit` before calling {@link mountCopilotKit}. This module does
 * NOT install its own auth — auth ordering lives in server/index.js so the
 * existing middleware chain stays in one place.
 *
 * @module routes/copilotkit
 */

import { CopilotRuntime, copilotRuntimeNodeExpressEndpoint } from '@copilotkit/runtime';
import { CcuSessionAgent } from '../agents/ccu-session-agent.js';

let _runtime = null;
let _handler = null;

function getHandler() {
  if (_handler) return _handler;
  _runtime = new CopilotRuntime({
    agents: { ccu: new CcuSessionAgent({ agentId: 'ccu', description: 'cc-agent-ui session wrapper' }) },
  });
  _handler = copilotRuntimeNodeExpressEndpoint({ runtime: _runtime, endpoint: '/api/copilotkit' });
  return _handler;
}

/**
 * Mount the CopilotKit handler at /api/copilotkit.
 *
 * @param {import('express').Application} app
 */
export function mountCopilotKit(app) {
  const handler = getHandler();
  app.use('/api/copilotkit', (req, res, next) => {
    Promise.resolve(handler(req, res)).catch(next);
  });
}
