import { useEffect, useState } from 'react';
import { getAIDashboard, getTopQueries } from '@/lib/api';

export function AIQualityPage() {
  const [dash, setDash] = useState<Record<string, unknown>>({});
  const [queries, setQueries] = useState<Array<{ query: string; count: number }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let c = false; setLoading(true);
    Promise.all([getAIDashboard(7), getTopQueries()]).then(([d, q]) => {
      if (c) return;
      if (d.code === 0) setDash(d.data as Record<string, unknown> || {});
      if (q.code === 0) setQueries((q.data || []) as Array<{ query: string; count: number }>);
      setLoading(false);
    });
    return () => { c = true; };
  }, []);

  if (loading) return <div className="py-8 text-center text-sm text-[var(--muted-foreground)]">加载中...</div>;

  return (
    <div className="space-y-6">
      <div><h1 className="text-xl font-bold">AI 质量监控</h1><p className="text-sm text-[var(--muted-foreground)]">⚠️ response_preview 不在此页面展示 (P0-05)</p></div>
      <div className="grid grid-cols-4 gap-4">
        {[['总对话', dash.conversations], ['安全事件', dash.safetyEvents], ['预估成本￥', dash.estimatedCostRMB], ['总Tokens', dash.totalTokens?.toLocaleString()]].map(([l, v], i) => (
          <div key={i} className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-3">
            <div className="text-xs text-[var(--muted-foreground)]">{l}</div>
            <div className="text-xl font-bold">{v ?? '--'}</div>
          </div>
        ))}
      </div>
      <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
        <h2 className="mb-3 text-sm font-semibold">高频问题 Top 20 (已脱敏)</h2>
        {queries.length === 0 ? <div className="text-xs text-[var(--muted-foreground)]">暂无数据</div> : (
          <div className="space-y-1 max-h-80 overflow-y-auto">
            {queries.map((q, i) => (
              <div key={i} className="flex justify-between text-xs py-1 border-b border-[var(--border)] last:border-0">
                <span className="truncate mr-4">{q.query}</span>
                <span className="text-[var(--primary)] font-semibold">{q.count}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
