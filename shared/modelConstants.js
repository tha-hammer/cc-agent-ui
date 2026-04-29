/**
 * Centralized Model Definitions
 * Single source of truth for all supported AI models
 */

/**
 * Claude (Anthropic) Models
 *
 * Note: Claude uses two different formats:
 * - SDK format ('sonnet', 'opus') - used by the UI and claude-sdk.js
 * - API format ('claude-sonnet-4.5') - used by slash commands for display
 */
export const CLAUDE_MODELS = {
  // Models in SDK format (what the actual SDK accepts)
  OPTIONS: [
    { value: "sonnet", label: "Sonnet" },
    { value: "opus", label: "Opus" },
    { value: "haiku", label: "Haiku" },
    { value: "opusplan", label: "Opus Plan" },
    { value: "sonnet[1m]", label: "Sonnet [1M]" },
  ],

  DEFAULT: "sonnet",
};

export const MODEL_CONTEXT_WINDOWS = {
  claude: {
    DEFAULT: 200000,
    sonnet: 200000,
    opus: 200000,
    haiku: 200000,
    opusplan: 200000,
    "sonnet[1m]": 1000000,
  },
  cursor: {
    DEFAULT: 200000,
  },
  codex: {
    DEFAULT: 200000,
  },
  gemini: {
    DEFAULT: 1000000,
  },
};

function normalizeProvider(provider) {
  return typeof provider === "string" && provider.trim()
    ? provider.trim().toLowerCase()
    : "claude";
}

function normalizeModel(model) {
  return typeof model === "string" ? model.trim() : "";
}

/**
 * Returns the known context window for a provider/model pair. Raw provider
 * model names are accepted so JSONL history can use `message.model` directly.
 */
export function getModelContextWindow(provider = "claude", model = "") {
  const normalizedProvider = normalizeProvider(provider);
  const normalizedModel = normalizeModel(model);
  const catalog = MODEL_CONTEXT_WINDOWS[normalizedProvider] || MODEL_CONTEXT_WINDOWS.claude;

  if (normalizedModel && catalog[normalizedModel]) {
    return catalog[normalizedModel];
  }

  const lowerModel = normalizedModel.toLowerCase();
  if (normalizedProvider === "claude") {
    if (lowerModel.includes("1m") || lowerModel.includes("1000000")) {
      return MODEL_CONTEXT_WINDOWS.claude["sonnet[1m]"];
    }
    if (
      lowerModel.includes("claude") ||
      lowerModel.includes("sonnet") ||
      lowerModel.includes("opus") ||
      lowerModel.includes("haiku")
    ) {
      return MODEL_CONTEXT_WINDOWS.claude.DEFAULT;
    }
  }

  return catalog.DEFAULT || MODEL_CONTEXT_WINDOWS.claude.DEFAULT;
}

/**
 * Cursor Models
 */
export const CURSOR_MODELS = {
  OPTIONS: [
    { value: "opus-4.6-thinking", label: "Claude 4.6 Opus (Thinking)" },
    { value: "gpt-5.3-codex", label: "GPT-5.3" },
    { value: "gpt-5.2-high", label: "GPT-5.2 High" },
    { value: "gemini-3-pro", label: "Gemini 3 Pro" },
    { value: "opus-4.5-thinking", label: "Claude 4.5 Opus (Thinking)" },
    { value: "gpt-5.2", label: "GPT-5.2" },
    { value: "gpt-5.1", label: "GPT-5.1" },
    { value: "gpt-5.1-high", label: "GPT-5.1 High" },
    { value: "composer-1", label: "Composer 1" },
    { value: "auto", label: "Auto" },
    { value: "sonnet-4.5", label: "Claude 4.5 Sonnet" },
    { value: "sonnet-4.5-thinking", label: "Claude 4.5 Sonnet (Thinking)" },
    { value: "opus-4.5", label: "Claude 4.5 Opus" },
    { value: "gpt-5.1-codex", label: "GPT-5.1 Codex" },
    { value: "gpt-5.1-codex-high", label: "GPT-5.1 Codex High" },
    { value: "gpt-5.1-codex-max", label: "GPT-5.1 Codex Max" },
    { value: "gpt-5.1-codex-max-high", label: "GPT-5.1 Codex Max High" },
    { value: "opus-4.1", label: "Claude 4.1 Opus" },
    { value: "grok", label: "Grok" },
  ],

  DEFAULT: "gpt-5-3-codex",
};

/**
 * Codex (OpenAI) Models
 */
export const CODEX_MODELS = {
  OPTIONS: [
    { value: "gpt-5.4", label: "GPT-5.4" },
    { value: "gpt-5.3-codex", label: "GPT-5.3 Codex" },
    { value: "gpt-5.2-codex", label: "GPT-5.2 Codex" },
    { value: "gpt-5.2", label: "GPT-5.2" },
    { value: "gpt-5.1-codex-max", label: "GPT-5.1 Codex Max" },
    { value: "o3", label: "O3" },
    { value: "o4-mini", label: "O4-mini" },
  ],

  DEFAULT: "gpt-5.4",
};

/**
 * Gemini Models
 */
export const GEMINI_MODELS = {
  OPTIONS: [
    { value: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro Preview" },
    { value: "gemini-3-pro-preview", label: "Gemini 3 Pro Preview" },
    { value: "gemini-3-flash-preview", label: "Gemini 3 Flash Preview" },
    { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
    { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
    { value: "gemini-2.0-flash-lite", label: "Gemini 2.0 Flash Lite" },
    { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
    { value: "gemini-2.0-pro-exp", label: "Gemini 2.0 Pro Experimental" },
    {
      value: "gemini-2.0-flash-thinking-exp",
      label: "Gemini 2.0 Flash Thinking",
    },
  ],

  DEFAULT: "gemini-2.5-flash",
};
