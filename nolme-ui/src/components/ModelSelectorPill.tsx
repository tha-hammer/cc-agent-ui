import { useState } from 'react';
import { useCcuSessionState } from '../hooks/useCcuSessionState';
import type { SessionProvider } from '../lib/types';
import {
  CLAUDE_MODELS,
  CURSOR_MODELS,
  CODEX_MODELS,
  GEMINI_MODELS,
} from '../../../shared/modelConstants.js';
import caretDownIcon from '../assets/figma/input-caret-down.svg';

export interface ModelOption {
  value: string;
  label: string;
}

const CATALOG: Record<SessionProvider, { options: ModelOption[]; default: string }> = {
  claude: { options: CLAUDE_MODELS.OPTIONS, default: CLAUDE_MODELS.DEFAULT },
  cursor: { options: CURSOR_MODELS.OPTIONS, default: CURSOR_MODELS.DEFAULT },
  codex: { options: CODEX_MODELS.OPTIONS, default: CODEX_MODELS.DEFAULT },
  gemini: { options: GEMINI_MODELS.OPTIONS, default: GEMINI_MODELS.DEFAULT },
};

function isKnownModel(provider: SessionProvider, model: string | undefined): boolean {
  if (!model) return false;
  return CATALOG[provider]?.options.some((o) => o.value === model) ?? false;
}

function labelForModel(provider: SessionProvider, model: string | undefined, fallbackLabel: string): string {
  const match = CATALOG[provider]?.options.find((o) => o.value === model);
  return match?.label ?? fallbackLabel;
}

export function ModelSelectorPill() {
  const { binding, updateBinding } = useCcuSessionState();
  const [open, setOpen] = useState(false);

  if (!binding) return null;

  const catalog = CATALOG[binding.provider];
  const options = catalog?.options ?? [];

  // Self-heal: if the persisted binding.model isn't in the provider's catalog
  // (e.g. left over from an older catalog version), fall through to the
  // provider default for display + dispatch. The user can re-select to
  // persist a valid value.
  const known = isKnownModel(binding.provider, binding.model);
  const effectiveModel = known ? binding.model : catalog?.default;
  const displayLabel = labelForModel(binding.provider, effectiveModel, effectiveModel ?? 'Select model');

  const handleSelect = (newId: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set('model', newId);
    updateBinding({ model: newId });
    window.location.assign(url.toString());
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-[24px] items-center gap-[4px] whitespace-nowrap rounded-[999px] bg-nolme-purple-500 px-[8px] py-[3px] font-[Satoshi:Medium] text-[12px] leading-[18px] text-white"
        data-testid="model-selector-pill"
        title={`Provider: ${binding.provider}${known ? '' : ' — invalid persisted model, click to choose'}`}
      >
        <span className="truncate max-w-[140px]">{displayLabel}</span>
        <img alt="" aria-hidden="true" src={caretDownIcon} className="h-[12px] w-[12px] shrink-0" />
      </button>
      {open && (
        <ul
          role="listbox"
          className="absolute right-0 bottom-full mb-1 min-w-[180px] max-h-[260px] overflow-auto rounded-[8px] border border-nolme-border-input bg-white p-1 shadow-md z-10"
        >
          {options.map((o) => (
            <li key={o.value}>
              <button
                type="button"
                onClick={() => handleSelect(o.value)}
                className={`block w-full rounded-[4px] px-2 py-1 text-left text-[14px] hover:bg-nolme-purple-100 ${
                  o.value === effectiveModel ? 'bg-nolme-purple-100 text-nolme-purple-600 font-medium' : 'text-nolme-neutral-800'
                }`}
              >
                {o.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
