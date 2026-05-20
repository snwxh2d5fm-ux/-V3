import { useState, useEffect, useCallback } from 'react';
import { generateCodes, listCodes, getCodeStats } from '@/lib/api';
import type { CodeRecord, PaginatedResponse } from '@/types';

export function CodeManagePage() {
  const [activeTab, setActiveTab] = useState<'invite' | 'redemption'>('invite');
  const [codes, setCodes] = useState<CodeRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [count, setCount] = useState('10');
  const [batchName, setBatchName] = useState('');
  const [expiry, setExpiry] = useState('30');
  const [confirmPw, setConfirmPw] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [codeStats, setCodeStats] = useState<Record<string, unknown>>({});
  const [error, setError] = useState<string | null>(null);

  const loadCodes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listCodes({ codeType: activeTab, page: 1, pageSize: 50 });
      if (res.code === 0 && res.data) {
        const p = res.data as unknown as PaginatedResponse<CodeRecord>;
        setCodes(p.list ?? []);
      }
    } catch {
      setError('加载失败，请重试');
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  const loadStats = useCallback(async () => {
    try {
      const res = await getCodeStats(activeTab);
      if (res.code === 0 && res.data) {
        setCodeStats(res.data as Record<string, unknown>);
      }
    } catch {
      // stats failure is non-blocking
    }
  }, [activeTab]);

  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      await loadCodes();
      if (!cancelled) await loadStats();
    };
    fetchData();
    return () => { cancelled = true; };
  }, [loadCodes, loadStats]);

  const handleGenerate = async () => {
    const qty = parseInt(count, 10);
    if (Number.isNaN(qty) || qty < 1 || qty > 500) {
      setError('数量需为 1-500 之间的整数');
      return;
    }
    if (!showConfirm) {
      setShowConfirm(true);
      return;
    }
    const res = await generateCodes({
      codeType: activeTab,
      count: parseInt(count, 10),
      batchName: batchName || undefined,
      expiresInDays: parseInt(expiry, 10),
      confirmPassword: confirmPw,
    });
    if (res.code === 0) {
      setShowConfirm(false);
      setConfirmPw('');
      setBatchName('');
      loadCodes();
      loadStats();
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">邀请码 / 兑换码管理</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          管理种子用户邀请码和付费会员兑换码
        </p>
      </div>

      {error && (
        <div className="rounded-md bg-red-950/50 px-3 py-2 text-xs text-red-400">{error}</div>
      )}

      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-3 text-center">
          <div className="text-xs text-[var(--muted-foreground)]">已生成</div>
          <div className="text-xl font-bold">{codeStats.generated as number ?? '--'}</div>
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-3 text-center">
          <div className="text-xs text-[var(--muted-foreground)]">已激活</div>
          <div className="text-xl font-bold">{codeStats.activated as number ?? '--'}</div>
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-3 text-center">
          <div className="text-xs text-[var(--muted-foreground)]">激活率</div>
          <div className="text-xl font-bold">{codeStats.activationRate as string ?? '--'}</div>
        </div>
      </div>

      <div className="flex gap-1 rounded-lg bg-[var(--muted)] p-1">
        <button
          data-testid="tab-invite"
          onClick={() => setActiveTab('invite')}
          className={`flex-1 rounded-md px-3 py-1.5 text-sm transition-colors ${
            activeTab === 'invite' ? 'bg-[var(--card)] text-[var(--foreground)]' : 'text-[var(--muted-foreground)]'
          }`}
        >
          邀请码（种子）
        </button>
        <button
          onClick={() => setActiveTab('redemption')}
          className={`flex-1 rounded-md px-3 py-1.5 text-sm transition-colors ${
            activeTab === 'redemption' ? 'bg-[var(--card)] text-[var(--foreground)]' : 'text-[var(--muted-foreground)]'
          }`}
        >
          兑换码（付费）
        </button>
      </div>

      <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
        <h2 className="mb-3 text-sm font-semibold">批量生成{activeTab === 'invite' ? '邀请码' : '兑换码'}</h2>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="mb-1 block text-xs text-[var(--muted-foreground)]">数量(1-500)</label>
            <input
              data-testid="code-count"
              type="number"
              min={1}
              max={500}
              value={count}
              onChange={(e) => setCount(e.target.value)}
              className="w-full rounded-md border border-[var(--border)] bg-[var(--input)] px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-[var(--muted-foreground)]">有效期(天)</label>
            <select
              data-testid="code-expiry"
              value={expiry}
              onChange={(e) => setExpiry(e.target.value)}
              className="w-full rounded-md border border-[var(--border)] bg-[var(--input)] px-2 py-1.5 text-sm"
            >
              <option value="30">30天</option>
              <option value="90">90天</option>
              <option value="180">180天</option>
              <option value="0">永久</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-[var(--muted-foreground)]">批次备注</label>
            <input
              data-testid="batch-name"
              type="text"
              value={batchName}
              onChange={(e) => setBatchName(e.target.value)}
              placeholder="例如：首批种子用户"
              className="w-full rounded-md border border-[var(--border)] bg-[var(--input)] px-2 py-1.5 text-sm"
            />
          </div>
        </div>

        {showConfirm && (
          <div className="mt-3 rounded-md bg-yellow-950/30 p-3">
            <label className="mb-1 block text-xs">请输入管理员密码确认</label>
            <input
              data-testid="confirm-password"
              type="password"
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              className="w-full rounded-md border border-[var(--border)] bg-[var(--input)] px-2 py-1.5 text-sm"
            />
          </div>
        )}

        <button
          data-testid="generate-button"
          onClick={handleGenerate}
          className="mt-3 rounded-md bg-[var(--primary)] px-4 py-1.5 text-sm text-white hover:opacity-90"
        >
          {showConfirm ? '确认生成' : '生成'}
        </button>
        {showConfirm && (
          <button
            onClick={() => setShowConfirm(false)}
            className="ml-2 rounded-md border border-[var(--border)] px-4 py-1.5 text-sm hover:bg-[var(--accent)]"
          >
            取消
          </button>
        )}
      </div>

      <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
        <h2 className="mb-3 text-sm font-semibold">
          {activeTab === 'invite' ? '邀请码' : '兑换码'}列表
        </h2>
        {loading ? (
          <div className="py-8 text-center text-sm text-[var(--muted-foreground)]">加载中...</div>
        ) : codes.length === 0 ? (
          <div className="py-8 text-center text-sm text-[var(--muted-foreground)]">暂无记录</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--border)] text-left text-[var(--muted-foreground)]">
                  <th className="pb-2">码</th>
                  <th className="pb-2">批次</th>
                  <th className="pb-2">状态</th>
                  <th className="pb-2">激活</th>
                  <th className="pb-2">过期</th>
                </tr>
              </thead>
              <tbody>
                {codes.map((c, i) => (
                  <tr key={i} data-testid="code-row" className="border-b border-[var(--border)] last:border-0">
                    <td className="py-2 font-mono">{c.code?.slice(0, 12)}...</td>
                    <td className="py-2">{c.batchName || c.batchId?.slice(0, 8)}</td>
                    <td className="py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs ${c.status === 'active' ? 'bg-green-950 text-green-400' : 'bg-[var(--muted)] text-[var(--muted-foreground)]'}`}>
                        {c.status === 'active' ? '有效' : c.status === 'used' ? '已用' : c.status === 'revoked' ? '已废' : '过期'}
                      </span>
                    </td>
                    <td className="py-2">{c.activationCount}/{c.maxActivations}</td>
                    <td className="py-2">{c.expiresAt ? new Date(c.expiresAt).toLocaleDateString() : '永久'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
