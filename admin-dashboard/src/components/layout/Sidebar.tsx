import { NavLink } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';
import { LayoutDashboard, Users, Ticket, Cpu, Shield, Settings, LogOut } from 'lucide-react';

const navItems = [
  { to: '/admin', icon: LayoutDashboard, label: '仪表盘' },
  { to: '/admin/users', icon: Users, label: '用户管理' },
  { to: '/admin/codes', icon: Ticket, label: '邀请码/兑换码' },
  { to: '/admin/ai-quality', icon: Cpu, label: 'AI质量' },
  { to: '/admin/compliance', icon: Shield, label: '合规安全' },
  { to: '/admin/settings', icon: Settings, label: '设置' },
];

export function Sidebar() {
  const { logout, adminUser } = useAuth();

  const handleLogout = () => {
    logout();
    // ProtectedRoute will auto-redirect to /admin/login when isAuthenticated becomes false
  };

  return (
    <aside
      data-testid="sidebar"
      className="flex h-screen w-56 flex-col border-r border-[var(--border)] bg-[var(--card)]"
    >
      <div className="flex h-14 items-center gap-2 border-b border-[var(--border)] px-4">
        <div className="flex h-7 w-7 items-center justify-center rounded bg-[var(--primary)] text-xs font-bold text-white">
          Z
        </div>
        <span className="text-sm font-semibold">住港伴运营后台</span>
      </div>

      <nav className="flex-1 space-y-0.5 p-3">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/admin'}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                isActive
                  ? 'bg-[var(--primary)] text-white'
                  : 'text-[var(--secondary-foreground)] hover:bg-[var(--accent)] hover:text-[var(--accent-foreground)]'
              }`
            }
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-[var(--border)] p-3">
        <div className="mb-2 px-3 text-xs text-[var(--muted-foreground)]">
          {adminUser?.name || adminUser?.email}
        </div>
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-[var(--secondary-foreground)] transition-colors hover:bg-[var(--destructive)] hover:text-white"
        >
          <LogOut className="h-4 w-4" />
          退出登录
        </button>
      </div>
    </aside>
  );
}
