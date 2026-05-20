import { useEffect, useState } from 'react';
import { getDashboard } from '@/lib/api';

const PATH_LABELS: Record<string, string> = {
  qmas: '优才计划', ttps_b: '高才通B类', ttps_a: '高才通A类',
  asmtp: '专才计划', iang: 'IANG', student_iang: '赴港升学',
  dependent: '受养人', renewal: '续签', pr: '永居冲刺'
};

const PATH_COLORS: Record<string, string> = ['#3b82f6','#22c55e','#eab308','#ef4444','#8b5cf6','#ec4899','#14b8a6','#f97316','#6366f1'];

type PathData = { path: string; label: string; count: number; pct: number };

export function PathAnalysisPage() {
  const [paths, setPaths] = useState<PathData[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let c = false; setLoading(true);
    getDashboard().then(r => {
      if (c) return;
      if (r.code === 0 && r.data) {
        const d = r.data as Record<string, unknown>;
        const byPath = (d.usersByPath || {}) as Record<string, number>;
        const t = Object.values(byPath).reduce((a,b) => (a as number)+(b as number), 0) as number || 1;
        const list = Object.entries(byPath).map(([k, v], i) => ({
          path: k, label: PATH_LABELS[k] || k,
          count: v as number,
          pct: Math.round((v as number) / t * 100)
        })).sort((a, b) => b.count - a.count);
        setPaths(list); setTotal(t);
      }
      setLoading(false);
    });
    return () => { c = true; };
  }, []);

  if (loading) return <div className="py-8 text-center text-sm text-[var(--muted-foreground)]">加载中...</div>;

  return (
    <div className="space-y-6">
      <div><h1 className="text-xl font-bold">路径分析</h1><p className="text-sm text-[var(--muted-foreground)]">以身份路径为第一分析维度 · 共 {total} 位用户</p></div>

      <div className="grid grid-cols-1 gap-4">
        {paths.map((p, i) => (
          <div key={p.path} className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full" style={{ background: PATH_COLORS[i % PATH_COLORS.length] }} />
                <span className="text-sm font-semibold">{p.label}</span>
                <span className="text-xs text-[var(--muted-foreground)] font-mono">{p.path}</span>
              </div>
              <span className="text-sm font-bold">{p.count} 人 · {p.pct}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-[var(--muted)] overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(p.pct, 2)}%`, background: PATH_COLORS[i % PATH_COLORS.length] }} />
            </div>
          </div>
        ))}
      </div>

      {paths.length === 0 && (
        <div className="py-8 text-center text-sm text-[var(--muted-foreground)]">暂无路径数据 — 等待用户完成初次评估</div>
      )}
    </div>
  );
}
