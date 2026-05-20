import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { adminLogin } from '@/lib/api';
import type { AdminUser, AuthState } from '@/types';

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    isAuthenticated: false,
    isLoading: true,
    apiKey: null,
    adminUser: null,
    error: null,
  });

  useEffect(() => {
    const storedKey = sessionStorage.getItem('zgb_admin_api_key');
    const storedUser = sessionStorage.getItem('zgb_admin_user');
    if (storedKey && storedUser) {
      try {
        setState({
          isAuthenticated: true,
          isLoading: false,
          apiKey: storedKey,
          adminUser: JSON.parse(storedUser) as AdminUser,
          error: null,
        });
      } catch {
        sessionStorage.removeItem('zgb_admin_api_key');
        sessionStorage.removeItem('zgb_admin_user');
        setState((s) => ({ ...s, isLoading: false }));
      }
    } else {
      setState((s) => ({ ...s, isLoading: false }));
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setState((s) => ({ ...s, isLoading: true, error: null }));
    try {
      const res = await adminLogin(email, password);
      if (res.code === 0 && res.data) {
        const apiKey = res.data.apiKey as string;
        const adminUser = res.data.adminUser as unknown as AdminUser;
        sessionStorage.setItem('zgb_admin_api_key', apiKey);
        sessionStorage.setItem('zgb_admin_user', JSON.stringify(adminUser));
        setState({
          isAuthenticated: true,
          isLoading: false,
          apiKey,
          adminUser,
          error: null,
        });
      } else {
        setState((s) => ({
          ...s,
          isLoading: false,
          error: res.msg || '登录失败',
        }));
      }
    } catch (err) {
      setState((s) => ({
        ...s,
        isLoading: false,
        error: err instanceof Error ? err.message : '网络错误',
      }));
    }
  }, []);

  const logout = useCallback(() => {
    sessionStorage.removeItem('zgb_admin_api_key');
    sessionStorage.removeItem('zgb_admin_user');
    setState({
      isAuthenticated: false,
      isLoading: false,
      apiKey: null,
      adminUser: null,
      error: null,
    });
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
