import { useEffect, useState } from 'react';
import { callAdminFunction } from '@/lib/api';

export function ContentPage() {
  const [articles, setArticles] = useState<unknown[]>([]);
  const [tasks, setTasks] = useState<Record<string, unknown>>({});
  const [hotwords, setHotwords] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let c = false;
    setLoading(true);
    Promise.all([
      callAdminFunction('/admin-content', { action: 'getArticleRanking' }),
      callAdminFunction('/admin-content', { action: 'getTaskCompletion' }),
      callAdminFunction('/admin-content', { action: 'getSearchHotwords' }),
    ]).then(([a, t, h]) => {
      if (c) return;
      if (a.code === 0) setArticles((a.data as unknown[]) || []);
      if (t.code === 0) setTasks((t.data as Record<string, unknown>) || {});
      if (h.code === 0) setHotwords((h.data as unknown[]) || []);
      setLoading(false);
    });
    return () => {
      c = true;
    };
  }, []);

  if (loading) return <div className="py-8 text-center text-sm text-[var(--muted-foreground)]">加载中...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">内容运营</h1>
        <p className="text-sm text-[var(--muted-foreground)]">攻略书排行 · 任务完成率 · 搜索热词</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
          <h2 className="mb-3 text-sm font-semibold">攻略书文章</h2>
          {articles.length === 0 ? (
            <div className="text-xs text-[var(--muted-foreground)]">暂无文章</div>
          ) : (
            <div className="space-y-1 max-h-64 overflow-y-auto text-xs">
              {(articles as any[]).map((a, i) => (
                <div key={i} className="flex justify-between py-1 border-b border-[var(--border)] last:border-0">
                  <span>{a.title || a._id}</span>
                  <span className="text-[var(--muted-foreground)]">{a.category || ''}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
          <h2 className="mb-3 text-sm font-semibold">任务完成率</h2>
          <div className="text-xl font-bold">{String(tasks.tasks ?? 0)} 条任务</div>
          {Boolean(tasks.byCategory) && (
            <div className="mt-2 space-y-1 text-xs">
              {Object.entries(tasks.byCategory as Record<string, { total: number; completed: number }>).map(
                ([cat, v]) => (
                  <div key={cat} className="flex justify-between">
                    <span>{cat}</span>
                    <span>
                      {v.completed}/{v.total}
                    </span>
                  </div>
                ),
              )}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
        <h2 className="mb-3 text-sm font-semibold">搜索热词 Top 20</h2>
        {hotwords.length === 0 ? (
          <div className="text-xs text-[var(--muted-foreground)]">暂无数据</div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {(hotwords as any[]).map((w, i) => (
              <span key={i} className="rounded-full border border-[var(--border)] px-3 py-1 text-xs">
                {w.word || w.query} <span className="text-[var(--primary)]">{w.count}</span>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
