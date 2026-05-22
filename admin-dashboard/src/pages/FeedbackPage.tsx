import { useEffect, useState } from 'react';
import { callAdminFunction } from '@/lib/api';

const TYPE_LABELS: Record<string, string> = {
  bug: '功能异常',
  feature: '功能建议',
  content: '内容错误',
  usability: '体验问题',
  speed: '速度投诉',
  code: '内测码相关',
};

export function FeedbackPage() {
  const [feedback, setFeedback] = useState<unknown[]>([]);
  const [stats, setStats] = useState<Record<string, unknown>>({});
  const [total, setTotal] = useState(0);
  const [typeFilter, setTypeFilter] = useState('全部');
  const [loading, setLoading] = useState(true);

  const loadData = async (typeFilter: string) => {
    setLoading(true);
    const p: Record<string, unknown> = { page: 1, pageSize: 50 };
    if (typeFilter !== '全部') p.type = typeFilter;
    const [f, s] = await Promise.all([
      callAdminFunction('/admin-feedback', { action: 'listFeedback', params: p }),
      callAdminFunction('/admin-feedback', { action: 'getStats' }),
    ]);
    if (f.code === 0) {
      const d = f.data as Record<string, unknown>;
      setFeedback((d.list || []) as unknown[]);
      setTotal((d.total as number) || 0);
    }
    if (s.code === 0) setStats((s.data as Record<string, unknown>) || {});
    setLoading(false);
  };

  useEffect(() => {
    loadData(typeFilter);
  }, [typeFilter]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">客服工单</h1>
        <p className="text-sm text-[var(--muted-foreground)]">⚠️ 内容已PII脱敏 (P0-04) · 含内测码兑换反馈</p>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {(
          [
            ['总工单', total],
            ['已处理', stats.resolved || 0],
            ['闭环率', stats.closureRate || '0%'],
            ['PII脱敏', '已启用'],
          ] as const
        ).map(([l, v]) => (
          <div key={l} className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-3 text-center">
            <div className="text-xs text-[var(--muted-foreground)]">{l}</div>
            <div className="text-xl font-bold">{String(v ?? '--')}</div>
          </div>
        ))}
      </div>

      {/* Type Filter */}
      <div className="flex gap-1 rounded-lg bg-[var(--muted)] p-1 flex-wrap">
        {['全部', 'bug', 'feature', 'code', 'usability', 'content', 'speed'].map((t) => (
          <button
            key={t}
            onClick={() => setTypeFilter(t)}
            className={`rounded-md px-3 py-1 text-xs transition-colors ${typeFilter === t ? 'bg-[var(--card)] text-[var(--foreground)]' : 'text-[var(--muted-foreground)]'}`}
          >
            {TYPE_LABELS[t] || t}
          </button>
        ))}
      </div>

      {/* Feedback List */}
      <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
        <h2 className="mb-3 text-sm font-semibold">
          反馈列表 ({typeFilter === '全部' ? '全部' : TYPE_LABELS[typeFilter] || typeFilter})
        </h2>
        {loading ? (
          <div className="py-8 text-center text-sm text-[var(--muted-foreground)]">加载中...</div>
        ) : feedback.length === 0 ? (
          <div className="py-8 text-center text-sm text-[var(--muted-foreground)]">暂无反馈</div>
        ) : (
          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {(feedback as any[]).map((f, i) => (
              <div key={i} className="rounded border border-[var(--border)] p-3 text-xs">
                <div className="flex justify-between mb-1 flex-wrap gap-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[var(--muted-foreground)] font-mono">{f.ticketId}</span>
                    <span className="rounded bg-[var(--muted)] px-1.5 py-0.5">
                      {TYPE_LABELS[f.type] || f.type || '未知'}
                    </span>
                  </div>
                  <span
                    className={`rounded px-1.5 py-0.5 ${f.status === 'resolved' ? 'bg-green-950 text-green-400' : f.status === 'in_progress' ? 'bg-blue-950 text-blue-400' : 'bg-yellow-950 text-yellow-400'}`}
                  >
                    {f.status === 'resolved' ? '已处理' : f.status === 'in_progress' ? '处理中' : f.status || '待处理'}
                  </span>
                </div>
                <p className="text-[var(--foreground)] mt-1 leading-relaxed">{f.content || '(无内容)'}</p>
                {f.contact?.nickname && <p className="text-[var(--muted-foreground)] mt-1">{f.contact.nickname}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
