import { useEffect, useState } from 'react';
<<<<<<< HEAD
import { getRevenueSummary, listOrders } from '@/lib/api';
=======
import { getRevenueSummary, listOrders, listInvoices } from '@/lib/api';
>>>>>>> feature/admin-dashboard

export function RevenuePage() {
  const [summary, setSummary] = useState<Record<string, unknown>>({});
  const [orders, setOrders] = useState<unknown[]>([]);
<<<<<<< HEAD
=======
  const [invoices, setInvoices] = useState<unknown[]>([]);
  const [invoiceTotal, setInvoiceTotal] = useState(0);
>>>>>>> feature/admin-dashboard
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let c = false; setLoading(true);
<<<<<<< HEAD
    Promise.all([getRevenueSummary(), listOrders({ page: 1, pageSize: 20 })]).then(([s, o]) => {
      if (c) return;
      if (s.code === 0) setSummary(s.data as Record<string, unknown> || {});
      if (o.code === 0) setOrders(((o.data as Record<string, unknown>)?.list || []) as unknown[]);
=======
    Promise.all([
      getRevenueSummary(),
      listOrders({ page: 1, pageSize: 20 }),
      listInvoices({ page: 1, pageSize: 50 }),
    ]).then(([s, o, inv]) => {
      if (c) return;
      if (s.code === 0) setSummary(s.data as Record<string, unknown> || {});
      if (o.code === 0) setOrders(((o.data as Record<string, unknown>)?.list || []) as unknown[]);
      if (inv.code === 0) {
        const d = inv.data as Record<string, unknown>;
        setInvoices((d.list || []) as unknown[]);
        setInvoiceTotal(d.total as number || 0);
      }
>>>>>>> feature/admin-dashboard
      setLoading(false);
    });
    return () => { c = true; };
  }, []);

  if (loading) return <div className="py-8 text-center text-sm text-[var(--muted-foreground)]">加载中...</div>;

  return (
    <div className="space-y-6">
<<<<<<< HEAD
      <div><h1 className="text-xl font-bold">财务看板</h1><p className="text-sm text-[var(--muted-foreground)]">收入概览 · 订单管理</p></div>
      <div className="grid grid-cols-4 gap-4">
        {[['总收入 ¥', (summary.totalRevenue as number) ? ((summary.totalRevenue as number)/100).toFixed(2) : '0'], ['订单数', summary.orderCount], ['客单价 ¥', summary.avgOrder ? ((summary.avgOrder as number)/100).toFixed(2) : '0'], ['套餐', Object.keys(summary.revenueByPlan as object||{}).length || 0]].map(([l, v], i) => (
          <div key={i} className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-3">
            <div className="text-xs text-[var(--muted-foreground)]">{l}</div>
            <div className="text-xl font-bold">{String(v ?? '--')}</div>
          </div>
        ))}
      </div>
=======
      <div><h1 className="text-xl font-bold">财务看板</h1><p className="text-sm text-[var(--muted-foreground)]">收入概览 · 订单管理 · 开票申请</p></div>

      {/* Revenue Summary */}
      <div className="grid grid-cols-4 gap-4">
        {[
          ['总收入 ¥', ((summary.totalRevenue as number) || 0) / 100],
          ['订单数', summary.orderCount || 0],
          ['客单价 ¥', ((summary.avgOrder as number) || 0) / 100],
          ['开票申请', invoiceTotal],
        ].map(([l, v], i) => (
          <div key={i} className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-3">
            <div className="text-xs text-[var(--muted-foreground)]">{l}</div>
            <div className="text-xl font-bold">{typeof v === 'number' ? v.toLocaleString() : v}</div>
          </div>
        ))}
      </div>

      {/* Orders */}
>>>>>>> feature/admin-dashboard
      <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
        <h2 className="mb-3 text-sm font-semibold">最近订单</h2>
        {orders.length === 0 ? <div className="text-xs text-[var(--muted-foreground)]">暂无订单</div> : (
          <table className="w-full text-xs"><thead><tr className="border-b border-[var(--border)] text-left text-[var(--muted-foreground)]"><th className="pb-2">产品</th><th className="pb-2">金额</th><th className="pb-2">状态</th><th className="pb-2">时间</th></tr></thead>
            <tbody>{(orders as any[]).map((o, i) => (
<<<<<<< HEAD
              <tr key={i} className="border-b border-[var(--border)] last:border-0"><td className="py-2">{o.productName || o._id}</td><td className="py-2">¥{(o.amount/100).toFixed(0)}</td><td className="py-2"><span className={`rounded px-1.5 py-0.5 ${o.status === 'completed' ? 'bg-green-950 text-green-400' : 'bg-yellow-950 text-yellow-400'}`}>{o.status}</span></td><td className="py-2">{String(o.createdAt||'').slice(0,10)}</td></tr>
=======
              <tr key={i} className="border-b border-[var(--border)] last:border-0"><td className="py-2">{o.productName || o._id}</td><td className="py-2">¥{((o.amount || 0) / 100).toFixed(0)}</td><td className="py-2"><span className={`rounded px-1.5 py-0.5 ${o.status === 'completed' ? 'bg-green-950 text-green-400' : 'bg-yellow-950 text-yellow-400'}`}>{o.status}</span></td><td className="py-2">{String(o.createdAt || '').slice(0, 10)}</td></tr>
            ))}</tbody></table>
        )}
      </div>

      {/* Invoice Applications */}
      <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
        <h2 className="mb-3 text-sm font-semibold">开票申请 ({invoiceTotal})</h2>
        {invoices.length === 0 ? <div className="text-xs text-[var(--muted-foreground)]">暂无开票申请</div> : (
          <table className="w-full text-xs"><thead><tr className="border-b border-[var(--border)] text-left text-[var(--muted-foreground)]"><th className="pb-2">发票号</th><th className="pb-2">类型</th><th className="pb-2">抬头</th><th className="pb-2">金额</th><th className="pb-2">状态</th><th className="pb-2">时间</th></tr></thead>
            <tbody>{(invoices as any[]).map((inv, i) => (
              <tr key={i} className="border-b border-[var(--border)] last:border-0">
                <td className="py-2 font-mono">{inv.invoiceNumber || '待开具'}</td>
                <td className="py-2">{inv.invoiceType === 'company' ? '企业' : '个人'}</td>
                <td className="py-2">{inv.title || '—'}</td>
                <td className="py-2">¥{((inv.amount || 0) / 100).toFixed(0)}</td>
                <td className="py-2"><span className={`rounded px-1.5 py-0.5 ${inv.status === 'issued' ? 'bg-green-950 text-green-400' : inv.status === 'rejected' ? 'bg-red-950 text-red-400' : 'bg-yellow-950 text-yellow-400'}`}>{inv.status === 'issued' ? '已开' : inv.status === 'rejected' ? '已驳' : '待开'}</span></td>
                <td className="py-2">{String(inv.applyAt || inv.createdAt || '').slice(0, 10)}</td>
              </tr>
>>>>>>> feature/admin-dashboard
            ))}</tbody></table>
        )}
      </div>
    </div>
  );
}
