import { useEffect, useState } from 'react';
import { listUsers } from '@/lib/api';
import type { UserProfile } from '@/types';

export function UserListPage() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let c = false; setLoading(true);
    listUsers({ page: 1, pageSize: 50 }).then(r => {
      if (c) return;
      if (r.code === 0 && r.data) {
        const d = r.data as Record<string, unknown>;
        setUsers((d.list || []) as UserProfile[]);
        setTotal(d.total as number || 0);
      }
      setLoading(false);
    });
    return () => { c = true; };
  }, []);

  return (
    <div className="space-y-4">
      <div><h1 className="text-xl font-bold">用户管理</h1><p className="text-sm text-[var(--muted-foreground)]">共 {total} 位用户</p></div>
      {loading ? <div className="py-8 text-center text-sm text-[var(--muted-foreground)]">加载中...</div> : users.length === 0 ? <div className="py-8 text-center text-sm text-[var(--muted-foreground)]">暂无用户</div> : (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] overflow-hidden">
          <table className="w-full text-xs">
            <thead><tr className="border-b border-[var(--border)] text-left text-[var(--muted-foreground)]"><th className="px-4 py-2">用户</th><th className="px-4 py-2">签证类型</th><th className="px-4 py-2">会员</th><th className="px-4 py-2">状态</th><th className="px-4 py-2">最近活跃</th></tr></thead>
            <tbody>
              {users.map((u, i) => (
                <tr key={i} className="border-b border-[var(--border)] last:border-0">
                  <td className="px-4 py-2 font-mono">{u._openid?.slice(0,10)}...</td>
                  <td className="px-4 py-2">{u.primaryVisaType || u.selectedPath || '—'}</td>
                  <td className="px-4 py-2">{u.membershipTier || 'free_trial'}</td>
                  <td className="px-4 py-2"><span className={`rounded px-1.5 py-0.5 ${u.isLocked ? 'bg-red-950 text-red-400' : 'bg-green-950 text-green-400'}`}>{u.isLocked ? '已锁' : '正常'}</span></td>
                  <td className="px-4 py-2">{u.lastActiveAt ? new Date(u.lastActiveAt).toLocaleDateString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
