import { useEffect, useState } from 'react';
import { getRevenueSummary, listOrders } from '@/lib/api';

export function RevenuePage() {
  const [summary, setSummary] = useState<Record<string, unknown>>({});
  const [orders, setOrders] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let c = false; setLoading(true);
    Promise.all([getRevenueSummary(), listOrders({ page: 1, pageSize: 20 })]).then(([s, o]) => {
      if (c) return;
      if (s.code === 0) setSummary(s.data as Record<string, unknown> || {});
      if (o.code === 0) setOrders(((o.data as Record<string, unknown>)?.list || []) as unknown[]);
      setLoading(false);
    });
    return () => { c = true; };
  }, []);

  if (loading) return <div className="py-8 text-center text-sm text-[var(--muted-foreground)]">加载中...</div>;

  return (
    <div className="space-y-6">
      <div><h1 className="text-xl font-bold">财务看板</h1><p className="text-sm text-[var(--muted-foreground)]">收入概览 · 订单管理</p></div>
      <div className="grid grid-cols-4 gap-4">
        {[['总收入 ¥', (summary.totalRevenue as number) ? ((summary.totalRevenue as number)/100).toFixed(2) : '0'], ['订单数', summary.orderCount], ['客单价 ¥', summary.avgOrder ? ((summary.avgOrder as number)/100).toFixed(2) : '0'], ['套餐', Object.keys(summary.revenueByPlan as object||{}).length || 0]].map(([l, v], i) => (
          <div key={i} className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-3">
            <div className="text-xs text-[var(--muted-foreground)]">{l}</div>
            <div className="text-xl font-bold">{String(v ?? '--')}</div>
          </div>
        ))}
      </div>
      <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
        <h2 className="mb-3 text-sm font-semibold">最近订单</h2>
        {orders.length === 0 ? <div className="text-xs text-[var(--muted-foreground)]">暂无订单</div> : (
          <table className="w-full text-xs"><thead><tr className="border-b border-[var(--border)] text-left text-[var(--muted-foreground)]"><th className="pb-2">产品</th><th className="pb-2">金额</th><th className="pb-2">状态</th><th className="pb-2">时间</th></tr></thead>
            <tbody>{(orders as any[]).map((o, i) => (
              <tr key={i} className="border-b border-[var(--border)] last:border-0"><td className="py-2">{o.productName || o._id}</td><td className="py-2">¥{(o.amount/100).toFixed(0)}</td><td className="py-2"><span className={`rounded px-1.5 py-0.5 ${o.status === 'completed' ? 'bg-green-950 text-green-400' : 'bg-yellow-950 text-yellow-400'}`}>{o.status}</span></td><td className="py-2">{String(o.createdAt||'').slice(0,10)}</td></tr>
            ))}</tbody></table>
        )}
      </div>
    </div>
  );
}
