// 住港伴 V4 — Admin API client (HTTP gateway)
const BASE = 'https://cloudbase-d1g17tgt7cc199a60.service.tcloudbase.com';
import type { ApiResponse } from '@/types';

async function call<T>(path: string, body: Record<string, unknown> = {}): Promise<ApiResponse<T>> {
  const key = sessionStorage.getItem('zgb_admin_api_key');
  try {
    const r = await fetch(`${BASE}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, _apiKey: key }) });
    return await r.json() as ApiResponse<T>;
  } catch (e) { return { code: 500, msg: (e as Error).message }; }
}

// Auth
export const adminLogin = (email: string, password: string) =>
  call<{ apiKey: string; adminUser: Record<string, unknown> }>('/admin-stats', { action: 'adminLogin', params: { email, password } });

// Dashboard
export const getDashboard = () => call<Record<string, unknown>>('/admin-stats', { action: 'getDashboard' });
export const getTrend = (metric: string, days = 30) => call('/admin-stats', { action: 'getTrend', params: { metric, days } });

// Codes
export const listCodes = (p: Record<string, unknown>) => call<Record<string, unknown>>('/admin-codes', { action: 'listCodes', params: p });
export const generateCodes = (p: Record<string, unknown>) => call<Record<string, unknown>>('/admin-codes', { action: 'generateCodes', params: p });
export const getCodeStats = (codeType?: string) => call<Record<string, unknown>>('/admin-codes', { action: 'getCodeStats', params: { codeType } });

// Users
export const listUsers = (p: Record<string, unknown>) => call<Record<string, unknown>>('/admin-users', { action: 'listUsers', params: p });
export const getUserDetail = (openid: string) => call<Record<string, unknown>>('/admin-users', { action: 'getUserDetail', params: { openid } });

// Revenue
export const getRevenueSummary = (p?: Record<string, unknown>) => call<Record<string, unknown>>('/admin-revenue', { action: 'getRevenueSummary', params: p || {} });
export const listOrders = (p: Record<string, unknown>) => call<Record<string, unknown>>('/admin-revenue', { action: 'listOrders', params: p });
export const listInvoices = (p: Record<string, unknown>) => call<Record<string, unknown>>('/admin-revenue', { action: 'listInvoices', params: p });

// AI Quality
export const getAIDashboard = (days = 7) => call<Record<string, unknown>>('/admin-ai-quality', { action: 'getAIDashboard', params: { days } });
export const getTopQueries = () => call<unknown[]>('/admin-ai-quality', { action: 'getTopQueries' });

// Compliance
export const getComplianceStatus = () => call<Record<string, unknown>>('/admin-compliance', { action: 'getComplianceStatus' });
export const getModerationLogs = (p: Record<string, unknown>) => call<Record<string, unknown>>('/admin-compliance', { action: 'getModerationLogs', params: p });

// Generic caller for pages that need direct access
export const callAdminFunction = call;
