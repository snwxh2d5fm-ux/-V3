// 住港伴运营后台 - CloudBase API client
import cloudbase from '@cloudbase/js-sdk';
import type { ApiResponse } from '@/types';

const ENV_ID = 'cloudbase-d1g17tgt7cc199a60';

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
    return { code: 500, msg: err instanceof Error ? err.message : '未知错误' };
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
