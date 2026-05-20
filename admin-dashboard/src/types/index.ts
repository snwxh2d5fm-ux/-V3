// 住港伴运营后台 - Type definitions
export interface AdminUser {
  uid: string;
  email: string;
  name: string;
  role: 'super_admin' | 'pm' | 'ops' | 'content' | 'cs';
  status: 'active' | 'suspended';
}

export interface DashboardData {
  totalUsers: number;
  newUsers7d: number;
  activeUsers7d: number;
  usersByPath: Record<string, number>;
  usersByMembership: Record<string, number>;
  aiAccuracyAvg: number | null;
  aiConversations7d: number;
  safetyEvents7d: number;
  codesGenerated: number;
  codesActivated: number;
  complianceIssues?: boolean;
  k2LeakDetected?: boolean;
}

export interface TrendDataPoint {
  date: string;
  value: number;
}

export interface ApiResponse<T = unknown> {
  code: number;
  msg: string;
  data?: T;
}

export interface UserProfile {
  _openid: string;
  nickname: string;
  avatarUrl: string;
  selectedPath?: string;
  pathLabel?: string;
  primaryVisaType?: string;
  membershipTier?: string;
  onboardingCompleted: boolean;
  isLocked: boolean;
  freeTrialEndAt?: string;
  lastActiveAt?: string;
  createdAt: string;
}

export interface CodeRecord {
  code: string;
  codeType: 'invite' | 'redemption';
  status: 'active' | 'used' | 'expired' | 'revoked';
  planId?: string;
  planName?: string;
  batchId: string;
  batchName: string;
  activationCount: number;
  maxActivations: number;
  generatedBy: string;
  generatedAt: string;
  expiresAt?: string;
  note?: string;
}

export interface PaginatedResponse<T> {
  total: number;
  page: number;
  pageSize: number;
  list: T[];
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  apiKey: string | null;
  adminUser: AdminUser | null;
  error: string | null;
}
