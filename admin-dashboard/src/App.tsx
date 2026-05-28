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
import { ContentPage } from '@/pages/ContentPage';
import { FeedbackPage } from '@/pages/FeedbackPage';
import { SystemPage } from '@/pages/SystemPage';
import { PathAnalysisPage } from '@/pages/PathAnalysisPage';
import { LifecycleFunnelPage } from '@/pages/LifecycleFunnelPage';
import { PageAnalyticsPage } from '@/pages/PageAnalyticsPage';
import { ShareAnalyticsPage } from '@/pages/ShareAnalyticsPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { CFErrorsPage } from '@/pages/CFErrorsPage';

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
              <Route path="/admin/revenue" element={<RevenuePage />} />
              <Route path="/admin/paths" element={<PathAnalysisPage />} />
              <Route path="/admin/funnel" element={<LifecycleFunnelPage />} />
              <Route path="/admin/ai-quality" element={<AIQualityPage />} />
              <Route path="/admin/compliance" element={<CompliancePage />} />
              <Route path="/admin/content" element={<ContentPage />} />
              <Route path="/admin/feedback" element={<FeedbackPage />} />
              <Route path="/admin/analytics" element={<PageAnalyticsPage />} />
              <Route path="/admin/share" element={<ShareAnalyticsPage />} />
              <Route path="/admin/system" element={<SystemPage />} />
              <Route path="/admin/settings" element={<SettingsPage />} />
              <Route path="/admin/cf-errors" element={<CFErrorsPage />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
