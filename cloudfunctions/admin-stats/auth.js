/**
 * 住港伴 V4 — 共享认证工具
 *
 * scrypt 密码哈希 + 暴力破解防护 (loginAttempts)
 * API Key 仍使用 SHA-256 (API Key 是服务器生成的随机长字符串, 无需 scrypt)
 *
 * Schema 约定 (admin_users 集合):
 *   loginAttempts: number (default 0)
 *   lockedUntil: ISO timestamp (null when not locked)
 *   passwordHash: scrypt format "salt:hash" (legacy SHA-256 format will auto-migrate)
 */
const crypto = require('crypto');

const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 30;

/**
 * Hash password with scrypt + random salt
 * Returns "salt:hash" format string
 */
async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, SCRYPT_PARAMS, (err, key) => {
      if (err) reject(err);
      else resolve(salt + ':' + key.toString('hex'));
    });
  });
}

/**
 * Verify password against stored scrypt hash ("salt:hash" format)
 * Returns { valid: boolean, needsMigration: boolean }
 */
async function verifyPassword(password, storedHash) {
  if (!storedHash || !storedHash.includes(':')) {
    // Not scrypt format — legacy SHA-256, try verifyLegacy instead
    return { valid: false, needsMigration: false };
  }
  const [salt, key] = storedHash.split(':');
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, SCRYPT_PARAMS, (err, derivedKey) => {
      if (err) reject(err);
      else resolve({ valid: derivedKey.toString('hex') === key, needsMigration: false });
    });
  });
}

/**
 * Legacy SHA-256 verification for migration path
 * Returns { valid: boolean, needsMigration: true }
 * Caller should re-hash with scrypt after successful migration
 */
function verifyLegacy(password, sha256Hash) {
  const h = crypto.createHash('sha256').update(String(password)).digest('hex');
  return { valid: h === sha256Hash, needsMigration: true };
}

/**
 * SHA-256 utility (for API Key hashing only)
 */
function sha256(s) {
  return crypto.createHash('sha256').update(String(s)).digest('hex');
}

/**
 * Check if client IP is in the whitelist (P0-08 IP白名单)
 * Reads process.env.IP_WHITELIST (comma-separated IPs)
 * If env var not set, skip check (allow all)
 * Returns { allowed: boolean, reason: string }
 */
function checkIPWhitelist(ip) {
  const whitelist = process.env.IP_WHITELIST;
  if (!whitelist || !whitelist.trim()) {
    return { allowed: true, reason: 'IP_WHITELIST not configured, allowing all' };
  }
  const ips = whitelist.split(',').map((s) => s.trim()).filter(Boolean);
  if (ips.length === 0) {
    return { allowed: true, reason: 'IP_WHITELIST empty, allowing all' };
  }
  if (!ip || !ip.trim()) {
    return { allowed: false, reason: 'Unable to determine client IP' };
  }
  // Support CIDR-style entries (e.g. "192.168.1.0/24")
  const allowed = ips.some((entry) => {
    if (entry.includes('/')) {
      // CIDR match — extract base IP and prefix
      const [baseIp, prefixStr] = entry.split('/');
      const prefix = parseInt(prefixStr, 10);
      if (Number.isNaN(prefix) || prefix < 0 || prefix > 32) return ip === entry;
      const ipNum = ipToInt(ip);
      const baseNum = ipToInt(baseIp);
      if (ipNum === null || baseNum === null) return false;
      const mask = ~(2 ** (32 - prefix) - 1);
      return (ipNum & mask) === (baseNum & mask);
    }
    return ip === entry;
  });
  return {
    allowed,
    reason: allowed ? '' : 'IP 不在白名单中',
  };
}

/** Convert dotted IPv4 to 32-bit integer */
function ipToInt(ip) {
  if (!ip) return null;
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) return null;
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

/**
 * Check if an admin account is locked due to too many login attempts
 * Returns { locked: boolean, reason: string, retryAfterMinutes: number }
 */
function checkLockout(admin) {
  const attempts = admin.loginAttempts || 0;
  if (attempts < MAX_LOGIN_ATTEMPTS) {
    return { locked: false, reason: '', retryAfterMinutes: 0 };
  }

  const lockedUntil = admin.lockedUntil ? new Date(admin.lockedUntil) : null;
  if (lockedUntil && lockedUntil > new Date()) {
    const remaining = Math.ceil((lockedUntil - new Date()) / 60000);
    return { locked: true, reason: `账户已锁定，请约${remaining}分钟后再试`, retryAfterMinutes: remaining };
  }

  // Lock expired — not locked
  return { locked: false, reason: '', retryAfterMinutes: 0 };
}

module.exports = {
  hashPassword,
  verifyPassword,
  verifyLegacy,
  sha256,
  checkLockout,
  checkIPWhitelist, // P0-08 IP白名单
  MAX_LOGIN_ATTEMPTS,
  LOCKOUT_MINUTES,
};
