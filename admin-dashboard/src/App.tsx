import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/hooks/use-auth';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { AppLayout } from '@/components/layout/AppLayout';
import { LoginPage } from '@/pages/LoginPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { UserListPage } from '@/pages/UserListPage';
import { CodeManagePage } from '@/pages/CodeManagePage';
import { AIQualityPage } from '@/pages/AIQualityPage';
import { CompliancePage } from '@/pages/CompliancePage';
import { RevenuePage } from '@/pages/RevenuePage';
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
              <Route path="/admin/users" element={<UserListPage />} />
              <Route path="/admin/codes" element={<CodeManagePage />} />
              <Route path="/admin/ai-quality" element={<AIQualityPage />} />
              <Route path="/admin/compliance" element={<CompliancePage />} />
              <Route path="/admin/revenue" element={<RevenuePage />} />
              <Route path="/admin/content" element={<PlaceholderPage title="内容运营" description="攻略书排行 · 任务完成率 · 搜索热词" phase="Phase 3" />} />
              <Route path="/admin/feedback" element={<PlaceholderPage title="客服工单" description="反馈处理 · 效率统计 · 满意度分析" phase="Phase 3" />} />
              <Route path="/admin/system" element={<PlaceholderPage title="系统健康" description="云函数 · 数据库 · API延迟" phase="Phase 3" />} />
              <Route path="/admin/settings" element={<SettingsPage />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
