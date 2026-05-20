// 住港伴运营后台 - CloudBase API client
//
// SECURITY NOTE (C-01): API keys are stored in sessionStorage.
// Mitigations: (1) server-side SHA-256 hash verification, (2) admin panel serves no UGC.
//
// SECURITY NOTE (H-02): _apiKey is passed in the request body.
// Admin cloud functions verify against SHA-256 hashed key, not plaintext matching.

import type { ApiResponse } from '@/types';

const ENV_ID = import.meta.env.VITE_CLOUDBASE_ENV_ID || 'cloudbase-d1g17tgt7cc199a60';
const BASE_URL = `https://${ENV_ID}.service.tcloudbase.com`;

async function callAdminFunction<T>(
  path: string,
  body: Record<string, unknown> = {}
): Promise<ApiResponse<T>> {
  const apiKey = sessionStorage.getItem('zgb_admin_api_key');

  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, _apiKey: apiKey }),
    });

    if (!res.ok) {
      const text = await res.text();
      return { code: res.status, msg: text || '请求失败' };
    }

    return await res.json() as ApiResponse<T>;
  } catch (err) {
    return { code: 500, msg: err instanceof Error ? err.message : '网络错误' };
  }
}

// --- Auth ---
export async function adminLogin(email: string, password: string) {
  return callAdminFunction<{ apiKey: string; adminUser: Record<string, unknown> }>(
    '/admin-stats',
    { action: 'adminLogin', params: { email, password } }
  );
}

// --- Dashboard ---
export async function getDashboard() {
  return callAdminFunction<Record<string, unknown>>(
    '/admin-stats',
    { action: 'getDashboard' }
  );
}

export async function getTrend(metric: string, days = 30) {
  return callAdminFunction<unknown[]>(
    '/admin-stats',
    { action: 'getTrend', params: { metric, days } }
  );
}

// --- Codes ---
export async function listCodes(params: Record<string, unknown>) {
  return callAdminFunction<Record<string, unknown>>(
    '/admin-codes',
    { action: 'listCodes', params }
  );
}

export async function generateCodes(params: Record<string, unknown>) {
  return callAdminFunction<Record<string, unknown>>(
    '/admin-codes',
    { action: 'generateCodes', params }
  );
}

export async function getCodeStats(codeType?: string) {
  return callAdminFunction<Record<string, unknown>>(
    '/admin-codes',
    { action: 'getCodeStats', params: { codeType } }
  );
}

export { callAdminFunction };
