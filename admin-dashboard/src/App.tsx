import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/hooks/use-auth';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { AppLayout } from '@/components/layout/AppLayout';
import { LoginPage } from '@/pages/LoginPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { CodeManagePage } from '@/pages/CodeManagePage';
import { SettingsPage } from '@/pages/SettingsPage';
import { PlaceholderPage } from '@/pages/PlaceholderPage';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/admin/login" element={<LoginPage />} />

          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/admin" element={<DashboardPage />} />
              <Route
                path="/admin/users"
                element={
                  <PlaceholderPage
                    title="用户管理"
                    description="用户列表与详情"
                    phase="Phase 2"
                  />
                }
              />
              <Route path="/admin/codes" element={<CodeManagePage />} />
              <Route
                path="/admin/ai-quality"
                element={
                  <PlaceholderPage
                    title="AI质量监控"
                    description="准确率趋势与安全事件"
                    phase="Phase 2"
                  />
                }
              />
              <Route
                path="/admin/compliance"
                element={
                  <PlaceholderPage
                    title="合规安全"
                    description="敏感词/K2泄露/内容审核"
                    phase="Phase 2"
                  />
                }
              />
              <Route path="/admin/settings" element={<SettingsPage />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
