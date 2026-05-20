import { useAuth } from '@/hooks/use-auth';

export function SettingsPage() {
  const { adminUser } = useAuth();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">后台设置</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">管理员账户与系统配置</p>
      </div>
      <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
        <h2 className="mb-3 text-sm font-semibold">当前管理员</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-[var(--muted-foreground)]">邮箱</span>
            <span>{adminUser?.email}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--muted-foreground)]">姓名</span>
            <span>{adminUser?.name || '—'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--muted-foreground)]">角色</span>
            <span className="rounded bg-[var(--muted)] px-2 py-0.5 text-xs">{adminUser?.role}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
