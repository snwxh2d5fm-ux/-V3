import { useEffect, useState } from 'react';
import { Users, TrendingUp, Cpu, Shield, Ticket, Activity } from 'lucide-react';
import { getDashboard } from '@/lib/api';
import { MetricCard } from '@/components/ui/MetricCard';
import { AlertBanner } from '@/components/ui/AlertBanner';
import type { DashboardData } from '@/types';

type LoadingState = 'idle' | 'loading' | 'loaded' | 'error';

export function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loadState, setLoadState] = useState<LoadingState>('idle');
  const [alerts, setAlerts] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    setLoadState('loading');
    getDashboard()
      .then((res) => {
        if (cancelled) return;
        if (res.code === 0 && res.data) {
          const d = res.data as DashboardData;
          setData(d);
          setLoadState('loaded');

          const newAlerts: string[] = [];
          if (d.complianceIssues) newAlerts.push('合规敏感词检测未通过');
          if (d.k2LeakDetected) newAlerts.push('K2信息泄露告警');
          setAlerts(newAlerts);
        } else {
          setLoadState('error');
        }
      })
      .catch(() => { if (!cancelled) setLoadState('error'); });
    return () => { cancelled = true; };
  }, []);

  const isLoading = loadState === 'idle' || loadState === 'loading';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-[var(--foreground)]">运营仪表盘</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">住港伴核心运营数据概览</p>
      </div>

      {/* P0 Alerts */}
      <AlertBanner alerts={alerts} />

      {/* Metric Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <MetricCard
          label="累计用户"
          value={data?.totalUsers ?? null}
          change={data?.newUsers7d}
          loading={isLoading}
          icon={<Users className="h-3.5 w-3.5" />}
        />
        <MetricCard
          label="7日新增"
          value={data?.newUsers7d ?? null}
          loading={isLoading}
          icon={<TrendingUp className="h-3.5 w-3.5" />}
        />
        <MetricCard
          label="7日活跃"
          value={data?.activeUsers7d ?? null}
          loading={isLoading}
          icon={<Activity className="h-3.5 w-3.5" />}
        />
        <MetricCard
          label="AI准确率"
          value={data?.aiAccuracyAvg !== null && data?.aiAccuracyAvg !== undefined ? `${data.aiAccuracyAvg}%` : null}
          loading={isLoading}
          icon={<Cpu className="h-3.5 w-3.5" />}
        />
        <MetricCard
          label="7日安全事件"
          value={data?.safetyEvents7d ?? null}
          loading={isLoading}
          icon={<Shield className="h-3.5 w-3.5" />}
        />
        <MetricCard
          label="邀请码激活"
          value={data?.codesActivated != null && data?.codesGenerated != null ? `${data.codesActivated}/${data.codesGenerated}` : null}
          loading={isLoading}
          icon={<Ticket className="h-3.5 w-3.5" />}
        />
      </div>

      {/* Path Distribution */}
      {data?.usersByPath && Object.keys(data.usersByPath).length > 0 && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
          <h2 className="mb-3 text-sm font-semibold">路径分布</h2>
          <div className="flex flex-wrap gap-2">
            {Object.entries(data.usersByPath).map(([path, count]) => (
              <div
                key={path}
                className="flex items-center gap-2 rounded-full border border-[var(--border)] px-3 py-1 text-xs"
              >
                <span className="text-[var(--secondary-foreground)]">{path}</span>
                <span className="font-semibold text-[var(--primary)]">{count as number}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {loadState === 'loaded' && !data && (
        <div className="flex h-40 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--card)] text-sm text-[var(--muted-foreground)]">
          暂无数据 — 等待第一个用户激活
        </div>
      )}

      {/* Error state */}
      {loadState === 'error' && (
        <div className="flex h-40 items-center justify-center rounded-lg border border-red-900/50 bg-red-950/30 text-sm text-red-400">
          数据加载失败 — 请检查API连接后刷新页面
        </div>
      )}
    </div>
  );
}
