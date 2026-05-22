import { useState } from 'react';

export function SystemPage() {
  const [envId] = useState(import.meta.env.VITE_CLOUDBASE_ENV_ID || 'cloudbase-d1g17tgt7cc199a60');

  return (
    <div className="space-y-6">
      <div><h1 className="text-xl font-bold">系统健康</h1><p className="text-sm text-[var(--muted-foreground)]">云函数 · 数据库 · API 状态</p></div>

      <div className="grid grid-cols-3 gap-4">
        {[
          ['CloudBase 环境', envId, 'text-green-400'],
          ['admin-* 云函数', '8 个已部署', 'text-green-400'],
          ['HTTP 网关', '8 个路径', 'text-green-400'],
          ['NoSQL 集合', '49 个', 'text-[var(--primary)]'],
          ['API 鉴权', 'SHA-256', 'text-green-400'],
          ['部署分支', 'feature/admin-dashboard', 'text-[var(--muted-foreground)]'],
        ].map(([l, v, cls], i) => (
          <div key={i} className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-3">
            <div className="text-xs text-[var(--muted-foreground)]">{l}</div>
            <div className={`text-sm font-bold ${cls || ''}`}>{v}</div>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
        <h2 className="mb-3 text-sm font-semibold">网关端点</h2>
        <div className="grid grid-cols-2 gap-2 text-xs font-mono">
          {['admin-stats','admin-codes','admin-users','admin-revenue','admin-ai-quality','admin-compliance','admin-content','admin-feedback'].map(fn => (
            <div key={fn} className="rounded bg-[var(--muted)] px-2 py-1.5">
              https://{envId}.service.tcloudbase.com/{fn}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
