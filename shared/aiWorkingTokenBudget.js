/**
 * Canonical token-budget normalization for Nolme's ai-working utility bar.
 *
 * Consumers:
 * - server/index.js token-usage route
 * - server/agents/ag-ui-event-translator.js live state patches
 * - server/agents/ccu-session-agent.js sidecar persistence
 * - nolme-ui/src/hooks/useAiWorkingTokenBudget.ts route + hydrated reconciliation
 */

import { getModelContextWindow } from './modelConstants.js';

const UNSUPPORTED_PROVIDERS = new Set(['cursor', 'gemini']);

function asFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function asOptionalString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function clampPercent(value) {
  return Math.max(0, Math.min(100, value));
}

function normalizeSupportedBudget(raw, provider, source, updatedAt, model) {
  let used = asFiniteNumber(raw?.used);
  let total = asFiniteNumber(raw?.total);
  const budgetModel = model ?? asOptionalString(raw?.model);

  if (provider === 'codex') {
    used ??= asFiniteNumber(raw?.total_token_usage?.total_tokens);
    total ??= asFiniteNumber(raw?.model_context_window);
  }

  total ??= getModelContextWindow(provider, budgetModel);

  if (used === null || total === null || total <= 0) {
    return null;
  }

  const normalizedUsed = Math.max(0, Math.round(used));
  const normalizedTotal = Math.max(1, Math.round(total));
  const remaining = Math.max(normalizedTotal - normalizedUsed, 0);
  const usedPercent = clampPercent((normalizedUsed / normalizedTotal) * 100);

  return {
    provider,
    source,
    supported: true,
    used: normalizedUsed,
    total: normalizedTotal,
    remaining,
    usedPercent,
    remainingPercent: clampPercent(100 - usedPercent),
    model: budgetModel,
    breakdown: raw?.breakdown && typeof raw.breakdown === 'object' ? raw.breakdown : undefined,
    message: asOptionalString(raw?.message),
    updatedAt,
  };
}

function normalizeUnsupportedBudget(raw, provider, source, updatedAt) {
  return {
    provider,
    source,
    supported: false,
    used: null,
    total: null,
    remaining: null,
    usedPercent: 0,
    remainingPercent: 0,
    breakdown: undefined,
    message: asOptionalString(raw?.message) ?? `Token usage tracking not available for ${provider}`,
    updatedAt,
  };
}

/**
 * @param {unknown} raw
 * @param {{ provider?: string, model?: string, source?: 'route'|'live'|'persisted', updatedAt?: number }} [options]
 * @returns {null|{provider: string, source: string, supported: boolean, used: number|null, total: number|null, remaining: number|null, usedPercent: number, remainingPercent: number, model?: string, breakdown?: object, message?: string, updatedAt: number}}
 */
export function normalizeAiWorkingTokenBudget(raw, options = {}) {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const record = /** @type {Record<string, unknown>} */ (raw);
  const source = options.source ?? 'live';
  const updatedAt = asFiniteNumber(options.updatedAt) ?? asFiniteNumber(record.updatedAt) ?? Date.now();
  const provider = typeof options.provider === 'string' && options.provider
    ? options.provider
    : typeof record.provider === 'string' && record.provider
      ? record.provider
      : '';

  if (!provider) {
    return null;
  }

  if (record.supported === false || record.unsupported === true || UNSUPPORTED_PROVIDERS.has(provider)) {
    return normalizeUnsupportedBudget(record, provider, source, updatedAt);
  }

  return normalizeSupportedBudget(record, provider, source, updatedAt, asOptionalString(options.model));
}
