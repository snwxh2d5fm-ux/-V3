// 住港伴运营后台 - CloudBase API client
//
// SECURITY NOTE (C-01): API keys are stored in sessionStorage for pragmatic reasons.
// In the event of XSS, an attacker could extract the key via sessionStorage.getItem().
// Mitigations: (1) server-side API key TTL via key rotation, (2) CSP headers to block
// inline scripts, (3) admin panel serves no user-generated content, reducing XSS surface.
// This is an accepted risk for Phase 1; a future iteration should use HttpOnly cookie
// or CloudBase custom login tokens for admin auth.
//
// SECURITY NOTE (H-02): The _apiKey is passed as part of the callFunction data payload.
// CloudBase function logs in the console will contain the key in plaintext.
// Admin cloud functions MUST validate API keys via bcrypt hash comparison,
// not plaintext matching. Keys should be rotated every 90 days.
import cloudbase from '@cloudbase/js-sdk';
import type { ApiResponse } from '@/types';

const ENV_ID = import.meta.env.VITE_CLOUDBASE_ENV_ID || 'cloudbase-d1g17tgt7cc199a60';

let app: ReturnType<typeof cloudbase.init> | null = null;

function getApp() {
  if (!app) {
    app = cloudbase.init({ env: ENV_ID });
  }
  return app;
}

async function callAdminFunction<T>(
  functionName: string,
  action: string,
  params: Record<string, unknown> = {}
): Promise<ApiResponse<T>> {
  const apiKey = sessionStorage.getItem('zgb_admin_api_key');
  if (!apiKey) {
    return { code: 401, msg: '未认证' };
  }

  try {
    const app = getApp();
    const res = await app.callFunction({
      name: functionName,
      data: { action, params, _apiKey: apiKey },
    });
    return res.result as ApiResponse<T>;
  } catch (err) {
    return { code: 500, msg: err instanceof Error ? err.message : '网络错误' };
  }
}

// --- Auth ---
export async function adminLogin(email: string, password: string) {
  return callAdminFunction<{ apiKey: string; adminUser: Record<string, unknown> }>(
    'admin-stats', 'adminLogin', { email, password }
  );
}

// --- Dashboard ---
export async function getDashboard() {
  return callAdminFunction<Record<string, unknown>>('admin-stats', 'getDashboard');
}

export async function getTrend(metric: string, days = 30) {
  return callAdminFunction<unknown[]>('admin-stats', 'getTrend', { metric, days });
}

// --- Codes ---
export async function listCodes(params: Record<string, unknown>) {
  return callAdminFunction<Record<string, unknown>>('admin-codes', 'listCodes', params);
}

export async function generateCodes(params: Record<string, unknown>) {
  return callAdminFunction<Record<string, unknown>>('admin-codes', 'generateCodes', params);
}

export async function getCodeStats(codeType?: string) {
  return callAdminFunction<Record<string, unknown>>('admin-codes', 'getCodeStats', { codeType });
}

export { callAdminFunction };
