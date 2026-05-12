/**
 * 住港伴 — AES-256-GCM 客户端加密模块
 * 密钥由用户口令通过 PBKDF2 派生，永不离客户端
 * 使用微信小程序原生 Crypto API
 */
const ENC_ALGO = 'AES-GCM';
const KEY_LENGTH = 256;
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const PBKDF2_ITERATIONS = 100000;

let masterKey = null;
let cryptoReady = false;

async function initCrypto() {
  try {
    // 尝试加载已保存的密钥派生参数
    const salt = wx.getStorageSync('__crypto_salt__');
    if (salt) {
      // 已有密钥，标记就绪
      cryptoReady = true;
      console.log('[加密] 模块初始化完成');
    }
    return true;
  } catch (e) {
    console.error('[加密] 初始化失败:', e);
    return false;
  }
}

// 从用户口令派生加密密钥
async function deriveKey(password, salt) {
  if (!salt) {
    salt = generateSalt();
    wx.setStorageSync('__crypto_salt__', arrayBufferToBase64(salt));
  }
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']
  );
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
  masterKey = key;
  cryptoReady = true;
  return key;
}

// 设置主密钥
function setMasterKey(key) {
  masterKey = key;
  cryptoReady = true;
}

// 加密数据
async function encrypt(plaintext) {
  if (!cryptoReady || !masterKey) throw new Error('加密模块未就绪，请先设置密钥');
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const enc = new TextEncoder();
  const ciphertext = await crypto.subtle.encrypt(
    { name: ENC_ALGO, iv },
    masterKey,
    enc.encode(plaintext)
  );
  // 返回 IV + 密文 的 Base64 编码
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(ciphertext), iv.length);
  return arrayBufferToBase64(combined.buffer);
}

// 解密数据
async function decrypt(combinedBase64) {
  if (!cryptoReady || !masterKey) throw new Error('加密模块未就绪，请先设置密钥');
  const combined = base64ToArrayBuffer(combinedBase64);
  const iv = combined.slice(0, IV_LENGTH);
  const ciphertext = combined.slice(IV_LENGTH);
  const decrypted = await crypto.subtle.decrypt(
    { name: ENC_ALGO, iv: new Uint8Array(iv) },
    masterKey,
    ciphertext
  );
  return new TextDecoder().decode(decrypted);
}

// 加密文件
async function encryptFile(filePath, outputPath) {
  const fs = wx.getFileSystemManager();
  return new Promise((resolve, reject) => {
    fs.readFile({
      filePath,
      success: async (res) => {
        try {
          const encrypted = await encrypt(arrayBufferToBase64(res.data));
          fs.writeFile({
            filePath: outputPath,
            data: encrypted,
            encoding: 'utf-8',
            success: () => resolve(outputPath),
            fail: reject
          });
        } catch (e) { reject(e); }
      },
      fail: reject
    });
  });
}

// --- 辅助函数 ---
function generateSalt() {
  return crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
}

function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// 检查是否已加密
function isEncrypted(data) {
  try {
    atob(data);
    return true;
  } catch (e) {
    return false;
  }
}

module.exports = {
  initCrypto, deriveKey, setMasterKey, encrypt, decrypt, encryptFile,
  isEncrypted, arrayBufferToBase64, base64ToArrayBuffer
};
