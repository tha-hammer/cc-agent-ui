import { getModelContextWindow } from '../../../../../shared/modelConstants';

type TokenBudget = Record<string, unknown>;

type ContextUsageBarProps = {
  tokenBudget: TokenBudget | null;
  provider?: string;
  model?: string;
  className?: string;
};

function asFiniteNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, value));
}

function formatPercentage(value: number) {
  if (value > 0 && value < 1) return '<1%';
  return `${Math.round(value)}%`;
}

export default function ContextUsageBar({
  tokenBudget,
  provider = 'claude',
  model,
  className = '',
}: ContextUsageBarProps) {
  if (tokenBudget?.supported === false) return null;

  const used = Math.max(0, asFiniteNumber(tokenBudget?.used) ?? 0);
  const total = Math.max(1, asFiniteNumber(tokenBudget?.total) ?? getModelContextWindow(provider, model));
  const rawPercent = asFiniteNumber(tokenBudget?.usedPercent) ?? ((used / total) * 100);
  const percentage = clampPercent(rawPercent);
  const label = formatPercentage(percentage);
  const title = `${used.toLocaleString()} / ${total.toLocaleString()} tokens`;

  return (
    <div
      className={`flex min-w-[108px] items-center gap-2 text-xs font-medium text-muted-foreground ${className}`}
      title={title}
      aria-label={`Context used ${label}`}
    >
      <div className="h-2 w-20 overflow-hidden rounded-full bg-muted" aria-hidden="true">
        <span
          className="block h-full rounded-full bg-primary transition-[width] duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="tabular-nums">{label}</span>
    </div>
  );
}
