export function AlertBanner({ alerts }: { alerts: string[] }) {
  if (alerts.length === 0) return null;

  return (
    <div className="rounded-lg border border-red-900/50 bg-red-950/80 p-3">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-red-400">P0 告警</span>
      </div>
      <ul className="mt-1 space-y-1">
        {alerts.map((alert, i) => (
          <li key={i} className="text-xs text-red-300">
            {alert}
          </li>
        ))}
      </ul>
    </div>
  );
}
