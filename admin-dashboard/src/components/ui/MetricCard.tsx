import { type ReactNode } from 'react';

interface MetricCardProps {
  label: string;
  value: number | string | null;
  change?: number;
  loading?: boolean;
  icon?: ReactNode;
}

export function MetricCard({ label, value, change, loading, icon }: MetricCardProps) {
  if (loading) {
    return (
      <div
        data-testid="metric-card-skeleton"
        className="animate-pulse rounded-lg border border-[var(--border)] bg-[var(--card)] p-4"
      >
        <div className="mb-2 h-3 w-16 rounded bg-[var(--muted)]" />
        <div className="h-7 w-24 rounded bg-[var(--muted)]" />
      </div>
    );
  }

  const displayValue =
    value === null || value === undefined ? '--' : typeof value === 'number' ? value.toLocaleString() : value;

  return (
    <div data-testid="metric-card" className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
      <div className="mb-1 flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
        {icon}
        {label}
      </div>
      <div className="text-2xl font-bold text-[var(--foreground)]">{displayValue}</div>
      {change !== undefined && (
        <div className={`mt-1 text-xs ${change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
          {change >= 0 ? '+' : ''}
          {change}
        </div>
      )}
    </div>
  );
}
