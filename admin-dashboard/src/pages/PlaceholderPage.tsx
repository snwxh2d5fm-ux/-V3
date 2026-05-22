interface PlaceholderPageProps {
  title: string;
  description: string;
  phase?: string;
}

export function PlaceholderPage({ title, description, phase }: PlaceholderPageProps) {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-[var(--foreground)]">{title}</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">{description}</p>
      </div>
      <div className="flex h-60 items-center justify-center rounded-lg border border-dashed border-[var(--border)] bg-[var(--card)]">
        <div className="text-center">
          <div className="text-4xl">🔧</div>
          <p className="mt-2 text-sm text-[var(--muted-foreground)]">{phase ? `${phase} 开发中` : '即将上线'}</p>
        </div>
      </div>
    </div>
  );
}
