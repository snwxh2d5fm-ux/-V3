import { useEffect, useState } from 'react';
import { getAIDashboard, getTopQueries, listConversations } from '@/lib/api';
import { ConversationReviewPanel } from '@/pages/ConversationReviewPanel';

type TabKey = 'overview' | 'review';

export function AIQualityPage() {
  const [tab, setTab] = useState<TabKey>('overview');
  const [dash, setDash] = useState<Record<string, unknown>>({});
  const [queries, setQueries] = useState<Array<{ query: string; count: number }>>([]);
  const [reviewedCount, setReviewedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let c = false;
    setLoading(true);
    Promise.all([
      getAIDashboard(7),
      getTopQueries(),
      listConversations({ page: 1, pageSize: 1, reviewStatus: 'reviewed' }),
      listConversations({ page: 1, pageSize: 1 }),
    ]).then(([d, q, reviewed, all]) => {
      if (c) return;
      if (d.code === 0) setDash((d.data as Record<string, unknown>) || {});
      if (q.code === 0) setQueries((q.data || []) as Array<{ query: string; count: number }>);
      if (reviewed.code === 0) setReviewedCount(reviewed.data?.total || 0);
      if (all.code === 0) setTotalCount(all.data?.total || 0);
      setLoading(false);
    });
    return () => {
      c = true;
    };
  }, []);

  return (
    <div className="space-y-4">
      {/* Tab Bar */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 rounded-lg bg-[var(--muted)] p-1">
          {[
            { key: 'overview' as TabKey, label: '质量总览' },
            { key: 'review' as TabKey, label: `对话审核${totalCount > 0 ? ` (${reviewedCount}/${totalCount})` : ''}` },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`rounded-md px-4 py-1.5 text-sm transition-colors ${tab === t.key ? 'bg-[var(--card)] text-[var(--foreground)]' : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {tab === 'overview' ? (
        <div className="space-y-6">
          <div>
            <h1 className="text-xl font-bold">AI 质量监控</h1>
            <p className="text-sm text-[var(--muted-foreground)]">运营仪表盘 · 高频问题 · 标注进度</p>
          </div>

          {loading ? (
            <div className="py-8 text-center text-sm text-[var(--muted-foreground)]">加载中...</div>
          ) : (
            <>
              <div className="grid grid-cols-4 gap-4">
                {(
                  [
                    ['总对话', dash.conversations],
                    ['安全事件', dash.safetyEvents],
                    ['预估成本￥', dash.estimatedCostRMB],
                    ['总Tokens', dash.totalTokens?.toLocaleString()],
                  ] as const
                ).map(([l, v]) => (
                  <div key={l} className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-3">
                    <div className="text-xs text-[var(--muted-foreground)]">{l}</div>
                    <div className="text-xl font-bold">{String(v ?? '--')}</div>
                  </div>
                ))}
              </div>

              {/* Review progress card */}
              <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
                <h2 className="mb-3 text-sm font-semibold">标注进度</h2>
                <div className="flex items-center gap-4">
                  <div className="flex-1 h-2 rounded-full bg-[var(--muted)] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[var(--primary)] transition-all"
                      style={{ width: totalCount > 0 ? `${Math.round((reviewedCount / totalCount) * 100)}%` : '0%' }}
                    />
                  </div>
                  <span className="text-sm font-semibold text-[var(--primary)]">
                    {reviewedCount}/{totalCount}
                  </span>
                </div>
                <div className="mt-2 text-xs text-[var(--muted-foreground)]">
                  已标记 {reviewedCount} 条，覆盖率{' '}
                  {totalCount > 0 ? Math.round((reviewedCount / totalCount) * 100) : 0}%
                </div>
              </div>

              <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
                <h2 className="mb-3 text-sm font-semibold">高频问题 Top 20 (已脱敏)</h2>
                {queries.length === 0 ? (
                  <div className="text-xs text-[var(--muted-foreground)]">暂无数据</div>
                ) : (
                  <div className="space-y-1 max-h-80 overflow-y-auto">
                    {queries.map((q, i) => (
                      <div
                        key={i}
                        className="flex justify-between text-xs py-1 border-b border-[var(--border)] last:border-0"
                      >
                        <span className="truncate mr-4">{q.query}</span>
                        <span className="text-[var(--primary)] font-semibold">{q.count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      ) : (
        <ConversationReviewPanel />
      )}
    </div>
  );
}
