import { useEffect, useState } from 'react';
import { getComplianceStatus, getModerationLogs } from '@/lib/api';

export function CompliancePage() {
  const [status, setStatus] = useState<Record<string, unknown>>({});
  const [logs, setLogs] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let c = false; setLoading(true);
    Promise.all([getComplianceStatus(), getModerationLogs({ page: 1, pageSize: 20 })]).then(([s, l]) => {
      if (c) return;
      if (s.code === 0) setStatus(s.data as Record<string, unknown> || {});
      if (l.code === 0) setLogs(((l.data as Record<string, unknown>)?.list || []) as unknown[]);
      setLoading(false);
    });
    return () => { c = true; };
  }, []);

  if (loading) return <div className="py-8 text-center text-sm text-[var(--muted-foreground)]">加载中...</div>;

  return (
    <div className="space-y-6">
      <div><h1 className="text-xl font-bold">合规安全</h1><p className="text-sm text-[var(--muted-foreground)]">敏感词 / K2泄露 / 内容审核</p></div>
      <div className="grid grid-cols-3 gap-4">
        {[['审核日志', status.moderationLogs], ['安全触发', status.safetyTriggers], ['K2告警', status.k2LeakDetected ? '是' : '否', status.k2LeakDetected ? 'text-red-400' : 'text-green-400']].map(([l, v, cls], i) => (
          <div key={i} className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-3">
            <div className="text-xs text-[var(--muted-foreground)]">{l}</div>
            <div className={`text-xl font-bold ${cls || ''}`}>{String(v ?? '--')}</div>
          </div>
        ))}
      </div>
      <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
        <h2 className="mb-3 text-sm font-semibold">内容审核日志</h2>
        {logs.length === 0 ? <div className="text-xs text-[var(--muted-foreground)]">暂无记录</div> : (
          <div className="space-y-1 max-h-64 overflow-y-auto text-xs">
            {logs.map((l: any, i) => (
              <div key={i} className="flex justify-between py-1 border-b border-[var(--border)] last:border-0">
                <span className="truncate mr-4">{l.content?.slice(0,60) || l._id}</span>
                <span className="text-[var(--muted-foreground)]">{String(l.createdAt||'').slice(0,10)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
