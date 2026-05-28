import { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, RefreshCw, AlertCircle, XCircle, Clock, Filter } from 'lucide-react';

interface CFError {
  _id: string;
  fnName: string;
  action: string;
  errorMsg: string;
  errorStack?: string;
  severity: 'critical' | 'high';
  context?: Record<string, unknown>;
  createdAt: string;
}

interface ErrorSummary {
  checkedAt: string;
  last24h: {
    totalErrors: number;
    critical: number;
    high: number;
    functionsAffected: number;
  };
  functions: Array<{
    fnName: string;
    total: number;
    critical: number;
    high: number;
    lastError: string;
    lastMsg: string;
  }>;
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'text-red-500 bg-red-500/10 border-red-500/30',
  high: 'text-orange-500 bg-orange-500/10 border-orange-500/30',
};

export function CFErrorsPage() {
  const [summary, setSummary] = useState<ErrorSummary | null>(null);
  const [errors, setErrors] = useState<CFError[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterFn, setFilterFn] = useState('');
  const [filterSeverity, setFilterSeverity] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // 从 cf-alert HTTP 云函数获取健康状态
      const envId = import.meta.env.VITE_CLOUDBASE_ENV_ID;
      if (!envId) {
        setError('VITE_CLOUDBASE_ENV_ID 环境变量未配置');
        setLoading(false);
        return;
      }
      const resp = await fetch(
        `https://${envId}.service.tcloudbase.com/cf-alert/status`
      );
      const data = await resp.json();
      setSummary(data);

      // 取最近错误详情
      if (data.functions && data.functions.length > 0) {
        setErrors(
          data.functions.map((f: ErrorSummary['functions'][0]) => ({
            _id: f.fnName + f.lastError,
            fnName: f.fnName,
            action: '',
            errorMsg: f.lastMsg,
            severity: f.critical > 0 ? 'critical' : 'high',
            createdAt: f.lastError,
          }))
        );
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    // 每30秒自动刷新
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const filteredErrors = errors.filter((e) => {
    if (filterFn && e.fnName !== filterFn) return false;
    if (filterSeverity && e.severity !== filterSeverity) return false;
    return true;
  });

  const fnNames = [...new Set(errors.map((e) => e.fnName))].sort();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">云函数错误监控</h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            实时监控所有云函数异常 · 企微告警 · 30秒自动刷新
          </p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm transition-colors hover:bg-[var(--accent)] disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          刷新
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-600">
          <XCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* 概览卡片 */}
      {summary && (
        <div className="grid grid-cols-4 gap-4">
          <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
            <div className="mb-1 text-xs text-[var(--muted-foreground)]">24h 错误总数</div>
            <div className="text-2xl font-bold">
              {summary.last24h.totalErrors}
            </div>
          </div>
          <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-4">
            <div className="mb-1 text-xs text-[var(--muted-foreground)]">严重 (Critical)</div>
            <div className="text-2xl font-bold text-red-500">
              {summary.last24h.critical}
            </div>
          </div>
          <div className="rounded-lg border border-orange-500/30 bg-orange-500/5 p-4">
            <div className="mb-1 text-xs text-[var(--muted-foreground)]">高危 (High)</div>
            <div className="text-2xl font-bold text-orange-500">
              {summary.last24h.high}
            </div>
          </div>
          <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
            <div className="mb-1 text-xs text-[var(--muted-foreground)]">受影响函数</div>
            <div className="text-2xl font-bold">
              {summary.last24h.functionsAffected}
            </div>
          </div>
        </div>
      )}

      {/* 筛选栏 */}
      <div className="flex items-center gap-3">
        <Filter className="h-4 w-4 text-[var(--muted-foreground)]" />
        <select
          value={filterFn}
          onChange={(e) => setFilterFn(e.target.value)}
          className="rounded border border-[var(--border)] bg-[var(--card)] px-2 py-1 text-sm"
        >
          <option value="">全部云函数</option>
          {fnNames.map((fn) => (
            <option key={fn} value={fn}>{fn}</option>
          ))}
        </select>
        <select
          value={filterSeverity}
          onChange={(e) => setFilterSeverity(e.target.value)}
          className="rounded border border-[var(--border)] bg-[var(--card)] px-2 py-1 text-sm"
        >
          <option value="">全部严重度</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
        </select>
      </div>

      {/* 按云函数汇总表 */}
      {summary && summary.functions.length > 0 ? (
        <div className="rounded-lg border border-[var(--border)] overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[var(--muted)]">
              <tr>
                <th className="px-4 py-3 text-left font-medium">云函数</th>
                <th className="px-4 py-3 text-center font-medium">总错误</th>
                <th className="px-4 py-3 text-center font-medium">Critical</th>
                <th className="px-4 py-3 text-center font-medium">High</th>
                <th className="px-4 py-3 text-left font-medium">最近错误</th>
                <th className="px-4 py-3 text-left font-medium">最近时间</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {summary.functions.map((fn) => (
                <tr key={fn.fnName} className="hover:bg-[var(--accent)]/50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {fn.critical > 0 ? (
                        <AlertCircle className="h-3.5 w-3.5 text-red-500" />
                      ) : (
                        <AlertTriangle className="h-3.5 w-3.5 text-orange-500" />
                      )}
                      <span className="font-mono font-medium">{fn.fnName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center font-semibold">{fn.total}</td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs border ${SEVERITY_COLORS.critical}`}
                    >
                      {fn.critical}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs border ${SEVERITY_COLORS.high}`}
                    >
                      {fn.high}
                    </span>
                  </td>
                  <td className="px-4 py-3 max-w-xs truncate text-[var(--muted-foreground)]">
                    {fn.lastMsg}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-[var(--muted-foreground)]">
                    <Clock className="inline h-3 w-3 mr-1" />
                    {new Date(fn.lastError).toLocaleString('zh-CN', {
                      timeZone: 'Asia/Shanghai',
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center py-12 text-[var(--muted-foreground)]">
          <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
          加载中...
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 text-[var(--muted-foreground)]">
          <AlertTriangle className="mb-2 h-8 w-8 text-green-400" />
          <p className="text-sm">最近24小时无云函数异常</p>
          <p className="text-xs mt-1">一切运行正常</p>
        </div>
      )}

      {/* 告警配置提示 */}
      <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
        <h3 className="mb-2 text-sm font-semibold">告警配置</h3>
        <p className="text-xs text-[var(--muted-foreground)]">
          云函数错误通过企微机器人实时推送。冷却期60秒，同函数同错误不会重复告警。
        </p>
        <p className="text-xs text-[var(--muted-foreground)] mt-1">
          CloudBase 环境变量: <code className="rounded bg-[var(--muted)] px-1">WECOM_WEBHOOK_URL</code>
          {' '}— 配置企微机器人 Webhook 地址以启用告警。
        </p>
      </div>
    </div>
  );
}
