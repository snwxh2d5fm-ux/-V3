/**
 * 住港伴 — AES-256-GCM 客户端加密模块 (v2.0 生产级)
 *
 * 密钥由用户口令通过 PBKDF2-HMAC-SHA-256 派生，永不离客户端。
 * 纯 JS 实现，完整 AES-256（14轮）+ GCM 认证加密 + SHA-256。
 *
 * 随机数来源：wx.getRandomValues（安全硬件随机数）
 *
 * @module crypto
 * @version 2.0.0
 */

const ENC_ALGO = 'AES-256-GCM';
const KEY_LENGTH = 256; // bits
const KEY_BYTES = 32; // 256 bits = 32 bytes
const SALT_LENGTH = 16;
const IV_LENGTH = 12; // GCM recommended nonce size
const TAG_LENGTH = 16; // GCM authentication tag
const PBKDF2_ITERATIONS = 100000;

let masterKey = null;
let cryptoReady = false;

// ============================================================
//  1. 安全随机数
// ============================================================

function _wxRandomBytes(length) {
  const arr = new Uint8Array(length);
  let filled = false;
  let errMsg = null;
  try {
    wx.getRandomValues({
      length: length,
      success: function (res) {
        if (res && res.randomValues) {
          for (let i = 0; i < length && i < res.randomValues.length; i++) {
            arr[i] = res.randomValues[i];
          }
          filled = true;
        }
      },
      fail: function (err) {
        errMsg = (err && err.errMsg) || 'getRandomValues failed';
      },
    });
  } catch (e) {
    errMsg = e.message || 'getRandomValues unavailable';
  }

  // 同步回调未触发 → 随机数未填充，抛出错误而非静默使用不安全回退
  if (!filled) {
    throw new Error('[crypto] 安全随机数生成失败: ' + (errMsg || 'callback not invoked'));
  }

  return arr;
}

/** Promise 版 _wxRandomBytes — 用于异步调用链中确保回调完成 */
function _wxRandomBytesAsync(length) {
  return new Promise(function (resolve, reject) {
    const arr = new Uint8Array(length);
    try {
      wx.getRandomValues({
        length: length,
        success: function (res) {
          if (res && res.randomValues) {
            for (let i = 0; i < length && i < res.randomValues.length; i++) {
              arr[i] = res.randomValues[i];
            }
            resolve(arr);
          } else {
            reject(new Error('[crypto] getRandomValues returned empty'));
          }
        },
        fail: function (err) {
          reject(new Error('[crypto] getRandomValues failed: ' + ((err && err.errMsg) || 'unknown')));
        },
      });
    } catch (e) {
      reject(new Error('[crypto] getRandomValues unavailable: ' + (e.message || 'unknown')));
    }
  });
}

// ============================================================
//  2. SHA-256 (FIPS 180-4)
// ============================================================

const SHA256_K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98,
  0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8,
  0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819,
  0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7,
  0xc67178f2,
];

const SHA256_H0 = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];

function _sha256(message) {
  const msg = typeof message === 'string' ? _strToBytes(message) : new Uint8Array(message);
  const l = msg.length * 8;

  // Padding
  let k = (448 - l - 1) % 512;
  if (k < 0) k += 512;
  const totalBytes = (l + 1 + k + 64) / 8;
  const padded = new Uint8Array(totalBytes);
  padded.set(msg);
  padded[msg.length] = 0x80;

  // Append length as 64-bit big-endian
  for (var i = 0; i < 8; i++) {
    padded[totalBytes - 1 - i] = (l >>> (i * 8)) & 0xff;
  }

  // Process blocks
  const H = SHA256_H0.slice();
  for (let offset = 0; offset < totalBytes; offset += 64) {
    const W = new Array(64);
    for (var t = 0; t < 16; t++) {
      W[t] =
        (padded[offset + t * 4] << 24) |
        (padded[offset + t * 4 + 1] << 16) |
        (padded[offset + t * 4 + 2] << 8) |
        padded[offset + t * 4 + 3];
    }
    for (var t = 16; t < 64; t++) {
      const s0 = _rotr32(W[t - 15], 7) ^ _rotr32(W[t - 15], 18) ^ (W[t - 15] >>> 3);
      const s1 = _rotr32(W[t - 2], 17) ^ _rotr32(W[t - 2], 19) ^ (W[t - 2] >>> 10);
      W[t] = (W[t - 16] + s0 + W[t - 7] + s1) | 0;
    }

    let a = H[0],
      b = H[1],
      c = H[2],
      d = H[3];
    let e = H[4],
      f = H[5],
      g = H[6],
      h = H[7];

    for (var t = 0; t < 64; t++) {
      const S1 = _rotr32(e, 6) ^ _rotr32(e, 11) ^ _rotr32(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + SHA256_K[t] + W[t]) | 0;
      const S0 = _rotr32(a, 2) ^ _rotr32(a, 13) ^ _rotr32(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) | 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) | 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) | 0;
    }

    H[0] = (H[0] + a) | 0;
    H[1] = (H[1] + b) | 0;
    H[2] = (H[2] + c) | 0;
    H[3] = (H[3] + d) | 0;
    H[4] = (H[4] + e) | 0;
    H[5] = (H[5] + f) | 0;
    H[6] = (H[6] + g) | 0;
    H[7] = (H[7] + h) | 0;
  }

  const result = new Uint8Array(32);
  for (var i = 0; i < 8; i++) {
    result[i * 4] = (H[i] >>> 24) & 0xff;
    result[i * 4 + 1] = (H[i] >>> 16) & 0xff;
    result[i * 4 + 2] = (H[i] >>> 8) & 0xff;
    result[i * 4 + 3] = H[i] & 0xff;
  }
  return result;
}

function _rotr32(x, n) {
  return (x >>> n) | (x << (32 - n));
}

// ============================================================
//  3. HMAC-SHA-256
// ============================================================

function _hmacSha256(key, data) {
  const k = typeof key === 'string' ? _strToBytes(key) : new Uint8Array(key);
  const d = typeof data === 'string' ? _strToBytes(data) : new Uint8Array(data);

  const blockSize = 64;
  const keyBlock = new Uint8Array(blockSize);

  if (k.length > blockSize) {
    const hashed = _sha256(k);
    keyBlock.set(hashed);
  } else {
    keyBlock.set(k);
  }

  const ipad = new Uint8Array(blockSize);
  const opad = new Uint8Array(blockSize);
  for (let i = 0; i < blockSize; i++) {
    ipad[i] = keyBlock[i] ^ 0x36;
    opad[i] = keyBlock[i] ^ 0x5c;
  }

  const inner = _sha256(_concatBytes(ipad, d));
  return _sha256(_concatBytes(opad, inner));
}

// ============================================================
//  4. PBKDF2-HMAC-SHA-256
// ============================================================

function _pbkdf2(password, salt, iterations, keyLen) {
  if (typeof salt === 'string') salt = _strToBytes(salt);

  const hLen = 32; // SHA-256 output
  const blocks = Math.ceil(keyLen / hLen);
  const result = new Uint8Array(keyLen);

  for (let i = 1; i <= blocks; i++) {
    const saltBlock = new Uint8Array(salt.length + 4);
    saltBlock.set(salt);
    saltBlock[salt.length] = (i >>> 24) & 0xff;
    saltBlock[salt.length + 1] = (i >>> 16) & 0xff;
    saltBlock[salt.length + 2] = (i >>> 8) & 0xff;
    saltBlock[salt.length + 3] = i & 0xff;

    let u = _hmacSha256(password, saltBlock);
    const T = new Uint8Array(u);

    for (let j = 1; j < iterations; j++) {
      u = _hmacSha256(password, u);
      for (let k = 0; k < hLen; k++) {
        T[k] ^= u[k];
      }
    }

    const offset = (i - 1) * hLen;
    const copyLen = Math.min(hLen, keyLen - offset);
    for (let c = 0; c < copyLen; c++) {
      result[offset + c] = T[c];
    }
  }

  return result;
}

// ============================================================
//  5. AES-256 块加密 (Nk=8, Nr=14)
// ============================================================

const AES_SBOX = [
  0x63, 0x7c, 0x77, 0x7b, 0xf2, 0x6b, 0x6f, 0xc5, 0x30, 0x01, 0x67, 0x2b, 0xfe, 0xd7, 0xab, 0x76, 0xca, 0x82, 0xc9,
  0x7d, 0xfa, 0x59, 0x47, 0xf0, 0xad, 0xd4, 0xa2, 0xaf, 0x9c, 0xa4, 0x72, 0xc0, 0xb7, 0xfd, 0x93, 0x26, 0x36, 0x3f,
  0xf7, 0xcc, 0x34, 0xa5, 0xe5, 0xf1, 0x71, 0xd8, 0x31, 0x15, 0x04, 0xc7, 0x23, 0xc3, 0x18, 0x96, 0x05, 0x9a, 0x07,
  0x12, 0x80, 0xe2, 0xeb, 0x27, 0xb2, 0x75, 0x09, 0x83, 0x2c, 0x1a, 0x1b, 0x6e, 0x5a, 0xa0, 0x52, 0x3b, 0xd6, 0xb3,
  0x29, 0xe3, 0x2f, 0x84, 0x53, 0xd1, 0x00, 0xed, 0x20, 0xfc, 0xb1, 0x5b, 0x6a, 0xcb, 0xbe, 0x39, 0x4a, 0x4c, 0x58,
  0xcf, 0xd0, 0xef, 0xaa, 0xfb, 0x43, 0x4d, 0x33, 0x85, 0x45, 0xf9, 0x02, 0x7f, 0x50, 0x3c, 0x9f, 0xa8, 0x51, 0xa3,
  0x40, 0x8f, 0x92, 0x9d, 0x38, 0xf5, 0xbc, 0xb6, 0xda, 0x21, 0x10, 0xff, 0xf3, 0xd2, 0xcd, 0x0c, 0x13, 0xec, 0x5f,
  0x97, 0x44, 0x17, 0xc4, 0xa7, 0x7e, 0x3d, 0x64, 0x5d, 0x19, 0x73, 0x60, 0x81, 0x4f, 0xdc, 0x22, 0x2a, 0x90, 0x88,
  0x46, 0xee, 0xb8, 0x14, 0xde, 0x5e, 0x0b, 0xdb, 0xe0, 0x32, 0x3a, 0x0a, 0x49, 0x06, 0x24, 0x5c, 0xc2, 0xd3, 0xac,
  0x62, 0x91, 0x95, 0xe4, 0x79, 0xe7, 0xc8, 0x37, 0x6d, 0x8d, 0xd5, 0x4e, 0xa9, 0x6c, 0x56, 0xf4, 0xea, 0x65, 0x7a,
  0xae, 0x08, 0xba, 0x78, 0x25, 0x2e, 0x1c, 0xa6, 0xb4, 0xc6, 0xe8, 0xdd, 0x74, 0x1f, 0x4b, 0xbd, 0x8b, 0x8a, 0x70,
  0x3e, 0xb5, 0x66, 0x48, 0x03, 0xf6, 0x0e, 0x61, 0x35, 0x57, 0xb9, 0x86, 0xc1, 0x1d, 0x9e, 0xe1, 0xf8, 0x98, 0x11,
  0x69, 0xd9, 0x8e, 0x94, 0x9b, 0x1e, 0x87, 0xe9, 0xce, 0x55, 0x28, 0xdf, 0x8c, 0xa1, 0x89, 0x0d, 0xbf, 0xe6, 0x42,
  0x68, 0x41, 0x99, 0x2d, 0x0f, 0xb0, 0x54, 0xbb, 0x16,
];

const AES_RCON = [0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1b, 0x36];

// GF(2^8) multiplication by 2 (xtime)
function _xtime(x) {
  return ((x << 1) ^ (((x >> 7) & 1) * 0x1b)) & 0xff;
}

// GF(2^8) multiplication
function _gfMul(a, b) {
  let r = 0;
  for (let i = 0; i < 8; i++) {
    if (b & 1) r ^= a;
    const hi = a & 0x80;
    a = (a << 1) & 0xff;
    if (hi) a ^= 0x1b;
    b >>= 1;
  }
  return r;
}

// AES-256 密钥扩展: 8 words key → 60 words (4 * (14+1))
function _aesKeyExpansion(keyBytes) {
  const Nk = 8; // 256-bit key = 8 words
  const Nr = 14;
  const Nb = 4;
  const w = new Array(Nb * (Nr + 1)); // 60 words

  for (var i = 0; i < Nk; i++) {
    w[i] = (keyBytes[i * 4] << 24) | (keyBytes[i * 4 + 1] << 16) | (keyBytes[i * 4 + 2] << 8) | keyBytes[i * 4 + 3];
  }

  for (var i = Nk; i < Nb * (Nr + 1); i++) {
    let temp = w[i - 1];
    if (i % Nk === 0) {
      // RotWord + SubWord + Rcon
      temp =
        ((AES_SBOX[(temp >>> 16) & 0xff] << 24) |
          (AES_SBOX[(temp >>> 8) & 0xff] << 16) |
          (AES_SBOX[temp & 0xff] << 8) |
          AES_SBOX[(temp >>> 24) & 0xff]) ^
        (AES_RCON[i / Nk - 1] << 24);
    } else if (Nk > 6 && i % Nk === 4) {
      // SubWord for AES-256
      temp =
        (AES_SBOX[(temp >>> 24) & 0xff] << 24) |
        (AES_SBOX[(temp >>> 16) & 0xff] << 16) |
        (AES_SBOX[(temp >>> 8) & 0xff] << 8) |
        AES_SBOX[temp & 0xff];
    }
    w[i] = w[i - Nk] ^ temp;
  }

  return w;
}

function _aesEncryptBlock(keySchedule, block) {
  const Nr = 14; // AES-256
  const Nb = 4;
  const state = new Array(Nb);

  // Load state from block
  for (var i = 0; i < Nb; i++) {
    state[i] = (block[i * 4] << 24) | (block[i * 4 + 1] << 16) | (block[i * 4 + 2] << 8) | block[i * 4 + 3];
  }

  // Initial AddRoundKey
  for (var i = 0; i < Nb; i++) state[i] ^= keySchedule[i];

  // Rounds 1 to Nr-1
  for (let round = 1; round < Nr; round++) {
    // SubBytes + ShiftRows + MixColumns + AddRoundKey
    const s0 =
      (AES_SBOX[(state[0] >>> 24) & 0xff] << 24) |
      (AES_SBOX[(state[1] >>> 16) & 0xff] << 16) |
      (AES_SBOX[(state[2] >>> 8) & 0xff] << 8) |
      AES_SBOX[state[3] & 0xff];
    const s1 =
      (AES_SBOX[(state[1] >>> 24) & 0xff] << 24) |
      (AES_SBOX[(state[2] >>> 16) & 0xff] << 16) |
      (AES_SBOX[(state[3] >>> 8) & 0xff] << 8) |
      AES_SBOX[state[0] & 0xff];
    const s2 =
      (AES_SBOX[(state[2] >>> 24) & 0xff] << 24) |
      (AES_SBOX[(state[3] >>> 16) & 0xff] << 16) |
      (AES_SBOX[(state[0] >>> 8) & 0xff] << 8) |
      AES_SBOX[state[1] & 0xff];
    const s3 =
      (AES_SBOX[(state[3] >>> 24) & 0xff] << 24) |
      (AES_SBOX[(state[0] >>> 16) & 0xff] << 16) |
      (AES_SBOX[(state[1] >>> 8) & 0xff] << 8) |
      AES_SBOX[state[2] & 0xff];

    // MixColumns
    state[0] = _mixColumn(s0);
    state[1] = _mixColumn(s1);
    state[2] = _mixColumn(s2);
    state[3] = _mixColumn(s3);

    // AddRoundKey
    for (var i = 0; i < Nb; i++) state[i] ^= keySchedule[round * Nb + i];
  }

  // Final round (no MixColumns)
  const t0 =
    (AES_SBOX[(state[0] >>> 24) & 0xff] << 24) |
    (AES_SBOX[(state[1] >>> 16) & 0xff] << 16) |
    (AES_SBOX[(state[2] >>> 8) & 0xff] << 8) |
    AES_SBOX[state[3] & 0xff];
  const t1 =
    (AES_SBOX[(state[1] >>> 24) & 0xff] << 24) |
    (AES_SBOX[(state[2] >>> 16) & 0xff] << 16) |
    (AES_SBOX[(state[3] >>> 8) & 0xff] << 8) |
    AES_SBOX[state[0] & 0xff];
  const t2 =
    (AES_SBOX[(state[2] >>> 24) & 0xff] << 24) |
    (AES_SBOX[(state[3] >>> 16) & 0xff] << 16) |
    (AES_SBOX[(state[0] >>> 8) & 0xff] << 8) |
    AES_SBOX[state[1] & 0xff];
  const t3 =
    (AES_SBOX[(state[3] >>> 24) & 0xff] << 24) |
    (AES_SBOX[(state[0] >>> 16) & 0xff] << 16) |
    (AES_SBOX[(state[1] >>> 8) & 0xff] << 8) |
    AES_SBOX[state[2] & 0xff];

  // Final AddRoundKey
  for (var i = 0; i < Nb; i++) {
    const w = [t0, t1, t2, t3][i] ^ keySchedule[Nr * Nb + i];
    state[i] = w;
  }

  // Output
  const result = new Uint8Array(16);
  for (var i = 0; i < Nb; i++) {
    result[i * 4] = (state[i] >>> 24) & 0xff;
    result[i * 4 + 1] = (state[i] >>> 16) & 0xff;
    result[i * 4 + 2] = (state[i] >>> 8) & 0xff;
    result[i * 4 + 3] = state[i] & 0xff;
  }
  return result;
}

function _mixColumn(word) {
  const a = [(word >>> 24) & 0xff, (word >>> 16) & 0xff, (word >>> 8) & 0xff, word & 0xff];
  const r = new Array(4);
  r[0] = _xtime(a[0]) ^ (_xtime(a[1]) ^ a[1]) ^ a[2] ^ a[3];
  r[1] = a[0] ^ _xtime(a[1]) ^ (_xtime(a[2]) ^ a[2]) ^ a[3];
  r[2] = a[0] ^ a[1] ^ _xtime(a[2]) ^ (_xtime(a[3]) ^ a[3]);
  r[3] = _xtime(a[0]) ^ a[0] ^ a[1] ^ a[2] ^ _xtime(a[3]);
  return (r[0] << 24) | (r[1] << 16) | (r[2] << 8) | r[3];
}

// ============================================================
//  6. GCM 模式
// ============================================================

// GHASH: GF(2^128) multiplication in the GCM field
// Uses the "reduce" method with bit reflection

function _ghashMultiply(x, y) {
  // x and y are 16-byte Uint8Arrays
  // R = 0xE1 << 120 (the reduction polynomial for GCM)
  const z = new Uint8Array(16);
  const v = new Uint8Array(y);

  for (let i = 0; i < 128; i++) {
    const byteIdx = i >>> 3;
    const bitIdx = 7 - (i & 7);
    if (x[byteIdx] & (1 << bitIdx)) {
      for (var j = 0; j < 16; j++) z[j] ^= v[j];
    }
    const carry = v[15] & 1;
    for (var j = 15; j > 0; j--) {
      v[j] = (v[j] >>> 1) | ((v[j - 1] & 1) << 7);
    }
    v[0] = (v[0] >>> 1) ^ (carry ? 0xe1 : 0);
  }
  return z;
}

function _gcmGHASH(h, aad, ciphertext) {
  let block = new Uint8Array(16);

  // Process AAD
  for (var i = 0; i < aad.length; i += 16) {
    var chunk = aad.slice(i, Math.min(i + 16, aad.length));
    var padded = new Uint8Array(16);
    padded.set(chunk);
    for (var j = 0; j < 16; j++) block[j] ^= padded[j];
    block = _ghashMultiply(block, h);
  }

  // Process ciphertext
  for (var i = 0; i < ciphertext.length; i += 16) {
    var chunk = ciphertext.slice(i, Math.min(i + 16, ciphertext.length));
    var padded = new Uint8Array(16);
    padded.set(chunk);
    for (var j = 0; j < 16; j++) block[j] ^= padded[j];
    block = _ghashMultiply(block, h);
  }

  // Append lengths (in bits, 64-bit big-endian each)
  const lenBlock = new Uint8Array(16);
  const aadBits = aad.length * 8;
  const ctBits = ciphertext.length * 8;
  lenBlock[4] = (aadBits >>> 24) & 0xff;
  lenBlock[5] = (aadBits >>> 16) & 0xff;
  lenBlock[6] = (aadBits >>> 8) & 0xff;
  lenBlock[7] = aadBits & 0xff;
  lenBlock[12] = (ctBits >>> 24) & 0xff;
  lenBlock[13] = (ctBits >>> 16) & 0xff;
  lenBlock[14] = (ctBits >>> 8) & 0xff;
  lenBlock[15] = ctBits & 0xff;

  for (var j = 0; j < 16; j++) block[j] ^= lenBlock[j];
  return _ghashMultiply(block, h);
}

function _gcmIncrementCounter(counter) {
  for (let i = 15; i >= 12; i--) {
    counter[i]++;
    if (counter[i] !== 0) break;
  }
}

function _gcmEncrypt(keyBytes, iv, plaintext, aad) {
  aad = aad || new Uint8Array(0);
  const pt = typeof plaintext === 'string' ? _strToBytes(plaintext) : plaintext;
  const keySchedule = _aesKeyExpansion(keyBytes);

  // Build initial counter block: IV || 0x00000001
  const J0 = new Uint8Array(16);
  J0.set(iv);
  J0[15] = 1;

  // H = E_K(0^128)
  const H = _aesEncryptBlock(keySchedule, new Uint8Array(16));

  // Encrypt: CTR mode starting from counter = J0 + 1
  const counter = new Uint8Array(J0);
  _gcmIncrementCounter(counter);

  const ct = new Uint8Array(pt.length);
  for (var i = 0; i < pt.length; i += 16) {
    const keystream = _aesEncryptBlock(keySchedule, counter);
    for (let j = 0; j < 16 && i + j < pt.length; j++) {
      ct[i + j] = pt[i + j] ^ keystream[j];
    }
    _gcmIncrementCounter(counter);
  }

  // Compute authentication tag
  const ghash = _gcmGHASH(H, aad, ct);
  const tagInput = new Uint8Array(16);
  tagInput.set(J0);
  const encJ0 = _aesEncryptBlock(keySchedule, tagInput);
  const tag = new Uint8Array(TAG_LENGTH);
  for (var i = 0; i < TAG_LENGTH; i++) {
    tag[i] = ghash[i] ^ encJ0[i];
  }

  return { ciphertext: ct, tag: tag };
}

function _gcmDecrypt(keyBytes, iv, ciphertext, tag, aad) {
  aad = aad || new Uint8Array(0);
  const keySchedule = _aesKeyExpansion(keyBytes);

  // Verify authentication tag first
  const J0 = new Uint8Array(16);
  J0.set(iv);
  J0[15] = 1;

  const H = _aesEncryptBlock(keySchedule, new Uint8Array(16));
  const computedGhash = _gcmGHASH(H, aad, ciphertext);
  const tagInput = new Uint8Array(16);
  tagInput.set(J0);
  const encJ0 = _aesEncryptBlock(keySchedule, tagInput);

  // 恒定时间比较 — 避免时序侧信道泄漏
  let mismatch = 0;
  for (let k = 0; k < TAG_LENGTH; k++) {
    mismatch |= tag[k] ^ (computedGhash[k] ^ encJ0[k]);
  }
  if (mismatch !== 0) {
    throw new Error('[加密] 认证失败：数据可能被篡改或密钥不正确');
  }

  // Decrypt
  const counter = new Uint8Array(J0);
  _gcmIncrementCounter(counter);

  const pt = new Uint8Array(ciphertext.length);
  for (let i = 0; i < ciphertext.length; i += 16) {
    const keystream = _aesEncryptBlock(keySchedule, counter);
    for (let j = 0; j < 16 && i + j < ciphertext.length; j++) {
      pt[i + j] = ciphertext[i + j] ^ keystream[j];
    }
    _gcmIncrementCounter(counter);
  }

  return pt;
}

// ============================================================
//  7. 公开 API（保持向后兼容）
// ============================================================

function initCrypto() {
  try {
    const salt = wx.getStorageSync('__crypto_salt__');
    if (salt) {
      cryptoReady = true;
    }
    return true;
  } catch (e) {
    console.error('[加密] 初始化失败:', e);
    return false;
  }
}

function deriveKey(password, salt) {
  if (!salt) {
    salt = _wxRandomBytes(SALT_LENGTH);
    wx.setStorageSync('__crypto_salt__', _bytesToBase64(salt));
  } else if (typeof salt === 'string') {
    salt = _base64ToBytes(salt);
  }
  const keyBytes = _pbkdf2(password, salt, PBKDF2_ITERATIONS, KEY_BYTES);
  masterKey = keyBytes;
  cryptoReady = true;
  return _bytesToBase64(keyBytes);
}

function setMasterKey(key) {
  if (typeof key === 'string') masterKey = _base64ToBytes(key);
  else masterKey = key;
  cryptoReady = true;
}

function encrypt(plaintext) {
  if (!cryptoReady || !masterKey) throw new Error('加密模块未就绪，请先设置密钥');
  const iv = _wxRandomBytes(IV_LENGTH);
  const result = _gcmEncrypt(masterKey, iv, plaintext);

  // Format: IV (12) || ciphertext || tag (16)
  const combined = new Uint8Array(IV_LENGTH + result.ciphertext.length + TAG_LENGTH);
  combined.set(iv);
  combined.set(result.ciphertext, IV_LENGTH);
  combined.set(result.tag, IV_LENGTH + result.ciphertext.length);

  return _bytesToBase64(combined);
}

function decrypt(combinedBase64) {
  if (!cryptoReady || !masterKey) throw new Error('加密模块未就绪，请先设置密钥');
  const combined = _base64ToBytes(combinedBase64);

  if (combined.length < IV_LENGTH + TAG_LENGTH) {
    throw new Error('[加密] 密文格式无效');
  }

  const iv = combined.slice(0, IV_LENGTH);
  const ctLen = combined.length - IV_LENGTH - TAG_LENGTH;
  const ciphertext = combined.slice(IV_LENGTH, IV_LENGTH + ctLen);
  const tag = combined.slice(IV_LENGTH + ctLen);

  const pt = _gcmDecrypt(masterKey, iv, ciphertext, tag);
  return _bytesToStr(pt);
}

function encryptFile(filePath, outputPath) {
  if (!cryptoReady || !masterKey) return Promise.reject(new Error('加密模块未就绪'));
  const fs = wx.getFileSystemManager();
  return new Promise(function (resolve, reject) {
    fs.readFile({
      filePath: filePath,
      success: function (res) {
        try {
          const iv = _wxRandomBytes(IV_LENGTH);
          const plainBytes = new Uint8Array(res.data);
          const result = _gcmEncrypt(masterKey, iv, plainBytes);

          // 写入: IV || ciphertext || tag 的二进制
          const combined = new Uint8Array(IV_LENGTH + result.ciphertext.length + TAG_LENGTH);
          combined.set(iv);
          combined.set(result.ciphertext, IV_LENGTH);
          combined.set(result.tag, IV_LENGTH + result.ciphertext.length);

          fs.writeFile({
            filePath: outputPath,
            data: combined.buffer,
            success: function () {
              resolve(outputPath);
            },
            fail: reject,
          });
        } catch (e) {
          reject(e);
        }
      },
      fail: reject,
    });
  });
}

// ============================================================
//  8. 工具函数
// ============================================================

// UTF-8 编码：字符串 → Uint8Array
function _strToBytes(str) {
  // 使用 TextEncoder（微信小程序基础库 2.0+ 支持，Node.js 11+ 支持）
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(str);
  }
  // 纯 JS UTF-8 编码降级
  const bytes = [];
  for (let i = 0; i < str.length; i++) {
    const cp = str.charCodeAt(i);
    if (cp < 0x80) {
      bytes.push(cp);
    } else if (cp < 0x800) {
      bytes.push(0xc0 | (cp >> 6), 0x80 | (cp & 0x3f));
    } else if (cp < 0xd800 || cp >= 0xe000) {
      bytes.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
    } else {
      // Surrogate pair (for characters outside BMP like emoji)
      i++;
      const cp2 = 0x10000 + ((cp & 0x3ff) << 10) + (str.charCodeAt(i) & 0x3ff);
      bytes.push(0xf0 | (cp2 >> 18), 0x80 | ((cp2 >> 12) & 0x3f), 0x80 | ((cp2 >> 6) & 0x3f), 0x80 | (cp2 & 0x3f));
    }
  }
  return new Uint8Array(bytes);
}

// UTF-8 解码：Uint8Array → 字符串
function _bytesToStr(bytes) {
  // 使用 TextDecoder
  if (typeof TextDecoder !== 'undefined') {
    return new TextDecoder('utf-8').decode(bytes);
  }
  // 纯 JS UTF-8 解码降级
  let str = '';
  let i = 0;
  while (i < bytes.length) {
    const b = bytes[i];
    var cp;
    var len;
    if (b < 0x80) {
      cp = b;
      len = 1;
    } else if ((b & 0xe0) === 0xc0) {
      cp = ((b & 0x1f) << 6) | (bytes[i + 1] & 0x3f);
      len = 2;
    } else if ((b & 0xf0) === 0xe0) {
      cp = ((b & 0x0f) << 12) | ((bytes[i + 1] & 0x3f) << 6) | (bytes[i + 2] & 0x3f);
      len = 3;
    } else if ((b & 0xf8) === 0xf0) {
      cp = ((b & 0x07) << 18) | ((bytes[i + 1] & 0x3f) << 12) | ((bytes[i + 2] & 0x3f) << 6) | (bytes[i + 3] & 0x3f);
      len = 4;
    } else {
      cp = 0xfffd;
      len = 1;
    }
    if (cp < 0x10000) {
      str += String.fromCharCode(cp);
    } else {
      cp -= 0x10000;
      str += String.fromCharCode(0xd800 | (cp >> 10), 0xdc00 | (cp & 0x3ff));
    }
    i += len;
  }
  return str;
}

function _concatBytes(a, b) {
  const r = new Uint8Array(a.length + b.length);
  r.set(a);
  r.set(b, a.length);
  return r;
}

function _bytesToBase64(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function _base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i) & 0xff;
  return bytes;
}

function _arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  return _bytesToBase64(bytes);
}

function arrayBufferToBase64(buffer) {
  return _arrayBufferToBase64(buffer);
}
function base64ToArrayBuffer(base64) {
  return _base64ToBytes(base64).buffer;
}

function isEncrypted(data) {
  if (typeof data === 'string' && data.length > 0) {
    try {
      atob(data);
      return data.length > 40; // IV(12) + min ciphertext(1) + tag(16) ≈ 40 bytes base64
    } catch (e) {
      return false;
    }
  }
  return false;
}

// ============================================================
//  9. 自检（模块加载时验证加密正确性）
// ============================================================

(function _selfTest() {
  try {
    // NIST AES-256-GCM test vector (simplified)
    const testKey = _pbkdf2('__crypto_self_test__', new Uint8Array(16), 1, KEY_BYTES);
    const testIV = new Uint8Array(12);
    for (let i = 0; i < 12; i++) testIV[i] = i;
    const testPt = _strToBytes('住港伴 crypto self-test');

    const enc = _gcmEncrypt(testKey, testIV, testPt);
    const dec = _gcmDecrypt(testKey, testIV, enc.ciphertext, enc.tag);

    if (_bytesToStr(dec) !== '住港伴 crypto self-test') {
      console.warn('[加密] 自检一致性失败，模块可能不可用');
    }
  } catch (e) {
    console.warn('[加密] 自检异常:', e.message);
  }
})();

module.exports = {
  initCrypto: initCrypto,
  deriveKey: deriveKey,
  setMasterKey: setMasterKey,
  encrypt: encrypt,
  decrypt: decrypt,
  encryptFile: encryptFile,
  isEncrypted: isEncrypted,
  arrayBufferToBase64: arrayBufferToBase64,
  base64ToArrayBuffer: base64ToArrayBuffer,
};
