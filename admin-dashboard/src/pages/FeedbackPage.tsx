import { useEffect, useState } from 'react';
import { callAdminFunction } from '@/lib/api';

export function FeedbackPage() {
  const [feedback, setFeedback] = useState<unknown[]>([]);
  const [stats, setStats] = useState<Record<string, unknown>>({});
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let c = false; setLoading(true);
    Promise.all([
      callAdminFunction('/admin-feedback', { action: 'listFeedback', params: { page: 1, pageSize: 50 } }),
      callAdminFunction('/admin-feedback', { action: 'getStats' }),
    ]).then(([f, s]) => {
      if (c) return;
      if (f.code === 0) { const d = f.data as Record<string, unknown>; setFeedback((d.list || []) as unknown[]); setTotal(d.total as number || 0); }
      if (s.code === 0) setStats(s.data as Record<string, unknown> || {});
      setLoading(false);
    });
    return () => { c = true; };
  }, []);

  if (loading) return <div className="py-8 text-center text-sm text-[var(--muted-foreground)]">加载中...</div>;

  return (
    <div className="space-y-6">
      <div><h1 className="text-xl font-bold">客服工单</h1><p className="text-sm text-[var(--muted-foreground)]">⚠️ 内容已PII脱敏 (P0-04)</p></div>

      <div className="grid grid-cols-3 gap-4">
        {[['总工单', total], ['已处理', stats.resolved], ['闭环率', stats.closureRate]].map(([l, v], i) => (
          <div key={i} className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-3 text-center">
            <div className="text-xs text-[var(--muted-foreground)]">{l}</div>
            <div className="text-xl font-bold">{v ?? '--'}</div>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
        <h2 className="mb-3 text-sm font-semibold">反馈列表</h2>
        {feedback.length === 0 ? <div className="text-xs text-[var(--muted-foreground)]">暂无反馈</div> : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {(feedback as any[]).map((f, i) => (
              <div key={i} className="rounded border border-[var(--border)] p-3 text-xs">
                <div className="flex justify-between mb-1">
                  <span className="text-[var(--muted-foreground)]">{f.ticketId} · {f.type || '未知'}</span>
                  <span className={`rounded px-1.5 py-0.5 ${f.status === 'resolved' ? 'bg-green-950 text-green-400' : 'bg-yellow-950 text-yellow-400'}`}>{f.status}</span>
                </div>
                <p className="text-[var(--foreground)]">{f.content}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
