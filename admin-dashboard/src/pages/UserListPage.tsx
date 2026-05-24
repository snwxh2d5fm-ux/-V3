import { useEffect, useState } from 'react';
import { listUsers } from '@/lib/api';
import { callAdminFunction } from '@/lib/api';

interface EnrichedUser {
  _openid: string;
  persona: number;
  personaLabel: string;
  selectedPath: string;
  pathLabel: string;
  membershipTier: string;
  userStatus: string;
  isLocked: boolean;
  onboardingCompleted: boolean;
  switchCount: number;
  lastActiveAt: number;
  createdAt: number;
}

const PERSONA_FILTERS = ['全部', '在职人士', '企业主', '海外华人', '受养人', '在校学生'];
const PERSONA_ID_MAP: Record<string, number> = { '在校学生': 1, '在职人士': 2, '企业主': 3, '海外华人': 4, '受养人': 5 };
const STATUS_MAP: Record<string, string> = { 已抵港: 'green', 评估中: 'blue', 已选路径: 'yellow', 未提交: 'muted' };
const PATH_LABELS: Record<string, string> = {
  qmas: '优才',
  ttps_b: '高才B',
  ttps_a: '高才A',
  asmtp: '专才',
  iang: 'IANG',
  student_iang: '升学',
  dependent: '受养人',
  renewal: '续签',
  pr: '永居',
};

export function UserListPage() {
  const [users, setUsers] = useState<EnrichedUser[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [personaFilter, setPersonaFilter] = useState('全部');
  const [stats, setStats] = useState<Record<string, Record<string, number>>>({});

  useEffect(() => {
    loadStats();
  }, []);
  useEffect(() => {
    loadUsers();
  }, [personaFilter]);

  const loadUsers = async () => {
    setLoading(true);
    const p: Record<string, unknown> = { page: 1, pageSize: 50 };
    if (personaFilter !== '全部') {
      const pid = PERSONA_ID_MAP[personaFilter];
      if (pid) p.filter = { persona: pid };
    }
    const r = await listUsers(p);
    if (r.code === 0 && r.data) {
      const d = r.data as Record<string, unknown>;
      setUsers((d.list || []) as EnrichedUser[]);
      setTotal((d.total as number) || 0);
    }
    setLoading(false);
  };

  const loadStats = async () => {
    const r = await callAdminFunction('/admin-users', { action: 'getUserStats' });
    if (r.code === 0) setStats((r.data as Record<string, Record<string, number>>) || {});
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">用户管理</h1>
        <p className="text-sm text-[var(--muted-foreground)]">共 {total} 位用户</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { title: '身份分布', data: stats.byPersona },
          { title: '路径分布', data: stats.byPath, labels: PATH_LABELS },
          { title: '会员分布', data: stats.byMembership },
          { title: '状态分布', data: stats.byStatus },
        ].map((group, i) => (
          <div key={i} className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-3">
            <div className="mb-2 text-xs text-[var(--muted-foreground)]">{group.title}</div>
            <div className="space-y-1">
              {Object.entries(group.data || {}).map(([k, v]) => (
                <div key={k} className="flex justify-between text-xs">
                  <span>{group.labels ? group.labels[k] || k : k}</span>
                  <span className="text-[var(--primary)] font-semibold">{v}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1 rounded-lg bg-[var(--muted)] p-1 flex-wrap">
        {PERSONA_FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setPersonaFilter(f)}
            className={`rounded-md px-3 py-1 text-xs transition-colors ${personaFilter === f ? 'bg-[var(--card)] text-[var(--foreground)]' : 'text-[var(--muted-foreground)]'}`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* User Table */}
      {loading ? (
        <div className="py-8 text-center text-sm text-[var(--muted-foreground)]">加载中...</div>
      ) : users.length === 0 ? (
        <div className="py-8 text-center text-sm text-[var(--muted-foreground)]">暂无用户</div>
      ) : (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[var(--border)] text-left text-[var(--muted-foreground)]">
                <th className="px-3 py-2">用户</th>
                <th className="px-3 py-2">身份</th>
                <th className="px-3 py-2">路径</th>
                <th className="px-3 py-2">会员</th>
                <th className="px-3 py-2">状态</th>
                <th className="px-3 py-2">切换</th>
                <th className="px-3 py-2">最近活跃</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u, i) => {
                const stColor = STATUS_MAP[u.userStatus] || 'muted';
                return (
                  <tr key={i} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--accent)]">
                    <td className="px-3 py-2 font-mono">{u._openid?.slice(0, 10)}…</td>
                    <td className="px-3 py-2">
                      <span className="rounded bg-[var(--muted)] px-1.5 py-0.5">{u.personaLabel}</span>
                    </td>
                    <td className="px-3 py-2">{PATH_LABELS[u.selectedPath] || u.pathLabel || u.selectedPath || '—'}</td>
                    <td className="px-3 py-2">{u.membershipTier === 'free_trial' ? '免费试用' : u.membershipTier}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded px-1.5 py-0.5 ${stColor === 'green' ? 'bg-green-950 text-green-400' : stColor === 'blue' ? 'bg-blue-950 text-blue-400' : stColor === 'yellow' ? 'bg-yellow-950 text-yellow-400' : 'bg-[var(--muted)] text-[var(--muted-foreground)]'}`}
                      >
                        {u.userStatus}
                      </span>
                    </td>
                    <td className="px-3 py-2">{u.switchCount || 0}</td>
                    <td className="px-3 py-2">
                      {u.lastActiveAt ? new Date(u.lastActiveAt).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
