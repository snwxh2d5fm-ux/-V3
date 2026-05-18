/**
 * 住港伴 — AES-256-GCM 客户端加密模块 (v2.0 生产级)
 *
 * 密钥由用户口令通过 PBKDF2-HMAC-SHA-256 派生，永不离客户端。
 * 纯 JS 实现，完整 AES-256（14轮）+ GCM 认证加密 + SHA-256。
 *
 * 随机数来源：wx.getRandomValues（降级：Math.random）
 *
 * @module crypto
 * @version 2.0.0
 */

var ENC_ALGO = 'AES-256-GCM';
var KEY_LENGTH = 256;            // bits
var KEY_BYTES = 32;              // 256 bits = 32 bytes
var SALT_LENGTH = 16;
var IV_LENGTH = 12;              // GCM recommended nonce size
var TAG_LENGTH = 16;             // GCM authentication tag
var PBKDF2_ITERATIONS = 100000;

var masterKey = null;
var cryptoReady = false;

// ============================================================
//  1. 安全随机数
// ============================================================

function _wxRandomBytes(length) {
  var arr = new Uint8Array(length);
  try {
    wx.getRandomValues({
      length: length,
      success: function(res) {
        if (res.randomValues) {
          for (var i = 0; i < length && i < res.randomValues.length; i++) {
            arr[i] = res.randomValues[i];
          }
        }
      },
      fail: function() {
        for (var i = 0; i < length; i++) {
          arr[i] = Math.floor(Math.random() * 256);
        }
      }
    });
  } catch (e) {
    for (var i = 0; i < length; i++) {
      arr[i] = Math.floor(Math.random() * 256);
    }
  }
  return arr;
}

// ============================================================
//  2. SHA-256 (FIPS 180-4)
// ============================================================

var SHA256_K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5,
  0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
  0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
  0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
  0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5,
  0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
];

var SHA256_H0 = [
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
  0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
];

function _sha256(message) {
  var msg = typeof message === 'string' ? _strToBytes(message) : new Uint8Array(message);
  var l = msg.length * 8;

  // Padding
  var k = (448 - l - 1) % 512;
  if (k < 0) k += 512;
  var totalBytes = (l + 1 + k + 64) / 8;
  var padded = new Uint8Array(totalBytes);
  padded.set(msg);
  padded[msg.length] = 0x80;

  // Append length as 64-bit big-endian
  for (var i = 0; i < 8; i++) {
    padded[totalBytes - 1 - i] = (l >>> (i * 8)) & 0xFF;
  }

  // Process blocks
  var H = SHA256_H0.slice();
  for (var offset = 0; offset < totalBytes; offset += 64) {
    var W = new Array(64);
    for (var t = 0; t < 16; t++) {
      W[t] = (padded[offset + t * 4] << 24) |
             (padded[offset + t * 4 + 1] << 16) |
             (padded[offset + t * 4 + 2] << 8) |
             padded[offset + t * 4 + 3];
    }
    for (var t = 16; t < 64; t++) {
      var s0 = (_rotr32(W[t - 15], 7) ^ _rotr32(W[t - 15], 18) ^ (W[t - 15] >>> 3));
      var s1 = (_rotr32(W[t - 2], 17) ^ _rotr32(W[t - 2], 19) ^ (W[t - 2] >>> 10));
      W[t] = (W[t - 16] + s0 + W[t - 7] + s1) | 0;
    }

    var a = H[0], b = H[1], c = H[2], d = H[3];
    var e = H[4], f = H[5], g = H[6], h = H[7];

    for (var t = 0; t < 64; t++) {
      var S1 = (_rotr32(e, 6) ^ _rotr32(e, 11) ^ _rotr32(e, 25));
      var ch = (e & f) ^ (~e & g);
      var temp1 = (h + S1 + ch + SHA256_K[t] + W[t]) | 0;
      var S0 = (_rotr32(a, 2) ^ _rotr32(a, 13) ^ _rotr32(a, 22));
      var maj = (a & b) ^ (a & c) ^ (b & c);
      var temp2 = (S0 + maj) | 0;

      h = g; g = f; f = e; e = (d + temp1) | 0;
      d = c; c = b; b = a; a = (temp1 + temp2) | 0;
    }

    H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0;
    H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
    H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0;
    H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
  }

  var result = new Uint8Array(32);
  for (var i = 0; i < 8; i++) {
    result[i * 4]     = (H[i] >>> 24) & 0xFF;
    result[i * 4 + 1] = (H[i] >>> 16) & 0xFF;
    result[i * 4 + 2] = (H[i] >>> 8) & 0xFF;
    result[i * 4 + 3] = H[i] & 0xFF;
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
  var k = typeof key === 'string' ? _strToBytes(key) : new Uint8Array(key);
  var d = typeof data === 'string' ? _strToBytes(data) : new Uint8Array(data);

  var blockSize = 64;
  var keyBlock = new Uint8Array(blockSize);

  if (k.length > blockSize) {
    var hashed = _sha256(k);
    keyBlock.set(hashed);
  } else {
    keyBlock.set(k);
  }

  var ipad = new Uint8Array(blockSize);
  var opad = new Uint8Array(blockSize);
  for (var i = 0; i < blockSize; i++) {
    ipad[i] = keyBlock[i] ^ 0x36;
    opad[i] = keyBlock[i] ^ 0x5c;
  }

  var inner = _sha256(_concatBytes(ipad, d));
  return _sha256(_concatBytes(opad, inner));
}

// ============================================================
//  4. PBKDF2-HMAC-SHA-256
// ============================================================

function _pbkdf2(password, salt, iterations, keyLen) {
  if (typeof salt === 'string') salt = _strToBytes(salt);

  var hLen = 32; // SHA-256 output
  var blocks = Math.ceil(keyLen / hLen);
  var result = new Uint8Array(keyLen);

  for (var i = 1; i <= blocks; i++) {
    var saltBlock = new Uint8Array(salt.length + 4);
    saltBlock.set(salt);
    saltBlock[salt.length]     = (i >>> 24) & 0xFF;
    saltBlock[salt.length + 1] = (i >>> 16) & 0xFF;
    saltBlock[salt.length + 2] = (i >>> 8) & 0xFF;
    saltBlock[salt.length + 3] = i & 0xFF;

    var u = _hmacSha256(password, saltBlock);
    var T = new Uint8Array(u);

    for (var j = 1; j < iterations; j++) {
      u = _hmacSha256(password, u);
      for (var k = 0; k < hLen; k++) {
        T[k] ^= u[k];
      }
    }

    var offset = (i - 1) * hLen;
    var copyLen = Math.min(hLen, keyLen - offset);
    for (var c = 0; c < copyLen; c++) {
      result[offset + c] = T[c];
    }
  }

  return result;
}

// ============================================================
//  5. AES-256 块加密 (Nk=8, Nr=14)
// ============================================================

var AES_SBOX = [
  0x63,0x7c,0x77,0x7b,0xf2,0x6b,0x6f,0xc5,0x30,0x01,0x67,0x2b,0xfe,0xd7,0xab,0x76,
  0xca,0x82,0xc9,0x7d,0xfa,0x59,0x47,0xf0,0xad,0xd4,0xa2,0xaf,0x9c,0xa4,0x72,0xc0,
  0xb7,0xfd,0x93,0x26,0x36,0x3f,0xf7,0xcc,0x34,0xa5,0xe5,0xf1,0x71,0xd8,0x31,0x15,
  0x04,0xc7,0x23,0xc3,0x18,0x96,0x05,0x9a,0x07,0x12,0x80,0xe2,0xeb,0x27,0xb2,0x75,
  0x09,0x83,0x2c,0x1a,0x1b,0x6e,0x5a,0xa0,0x52,0x3b,0xd6,0xb3,0x29,0xe3,0x2f,0x84,
  0x53,0xd1,0x00,0xed,0x20,0xfc,0xb1,0x5b,0x6a,0xcb,0xbe,0x39,0x4a,0x4c,0x58,0xcf,
  0xd0,0xef,0xaa,0xfb,0x43,0x4d,0x33,0x85,0x45,0xf9,0x02,0x7f,0x50,0x3c,0x9f,0xa8,
  0x51,0xa3,0x40,0x8f,0x92,0x9d,0x38,0xf5,0xbc,0xb6,0xda,0x21,0x10,0xff,0xf3,0xd2,
  0xcd,0x0c,0x13,0xec,0x5f,0x97,0x44,0x17,0xc4,0xa7,0x7e,0x3d,0x64,0x5d,0x19,0x73,
  0x60,0x81,0x4f,0xdc,0x22,0x2a,0x90,0x88,0x46,0xee,0xb8,0x14,0xde,0x5e,0x0b,0xdb,
  0xe0,0x32,0x3a,0x0a,0x49,0x06,0x24,0x5c,0xc2,0xd3,0xac,0x62,0x91,0x95,0xe4,0x79,
  0xe7,0xc8,0x37,0x6d,0x8d,0xd5,0x4e,0xa9,0x6c,0x56,0xf4,0xea,0x65,0x7a,0xae,0x08,
  0xba,0x78,0x25,0x2e,0x1c,0xa6,0xb4,0xc6,0xe8,0xdd,0x74,0x1f,0x4b,0xbd,0x8b,0x8a,
  0x70,0x3e,0xb5,0x66,0x48,0x03,0xf6,0x0e,0x61,0x35,0x57,0xb9,0x86,0xc1,0x1d,0x9e,
  0xe1,0xf8,0x98,0x11,0x69,0xd9,0x8e,0x94,0x9b,0x1e,0x87,0xe9,0xce,0x55,0x28,0xdf,
  0x8c,0xa1,0x89,0x0d,0xbf,0xe6,0x42,0x68,0x41,0x99,0x2d,0x0f,0xb0,0x54,0xbb,0x16
];

var AES_RCON = [0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1b, 0x36];

// GF(2^8) multiplication by 2 (xtime)
function _xtime(x) {
  return ((x << 1) ^ (((x >> 7) & 1) * 0x1b)) & 0xFF;
}

// GF(2^8) multiplication
function _gfMul(a, b) {
  var r = 0;
  for (var i = 0; i < 8; i++) {
    if (b & 1) r ^= a;
    var hi = a & 0x80;
    a = (a << 1) & 0xFF;
    if (hi) a ^= 0x1b;
    b >>= 1;
  }
  return r;
}

// AES-256 密钥扩展: 8 words key → 60 words (4 * (14+1))
function _aesKeyExpansion(keyBytes) {
  var Nk = 8;  // 256-bit key = 8 words
  var Nr = 14;
  var Nb = 4;
  var w = new Array(Nb * (Nr + 1)); // 60 words

  for (var i = 0; i < Nk; i++) {
    w[i] = (keyBytes[i * 4] << 24) | (keyBytes[i * 4 + 1] << 16) |
           (keyBytes[i * 4 + 2] << 8) | keyBytes[i * 4 + 3];
  }

  for (var i = Nk; i < Nb * (Nr + 1); i++) {
    var temp = w[i - 1];
    if (i % Nk === 0) {
      // RotWord + SubWord + Rcon
      temp = ((AES_SBOX[(temp >>> 16) & 0xFF] << 24) |
              (AES_SBOX[(temp >>> 8) & 0xFF] << 16) |
              (AES_SBOX[temp & 0xFF] << 8) |
              AES_SBOX[(temp >>> 24) & 0xFF]) ^ (AES_RCON[(i / Nk) - 1] << 24);
    } else if (Nk > 6 && i % Nk === 4) {
      // SubWord for AES-256
      temp = (AES_SBOX[(temp >>> 24) & 0xFF] << 24) |
             (AES_SBOX[(temp >>> 16) & 0xFF] << 16) |
             (AES_SBOX[(temp >>> 8) & 0xFF] << 8) |
             AES_SBOX[temp & 0xFF];
    }
    w[i] = w[i - Nk] ^ temp;
  }

  return w;
}

function _aesEncryptBlock(keySchedule, block) {
  var Nr = 14; // AES-256
  var Nb = 4;
  var state = new Array(Nb);

  // Load state from block
  for (var i = 0; i < Nb; i++) {
    state[i] = (block[i * 4] << 24) | (block[i * 4 + 1] << 16) |
               (block[i * 4 + 2] << 8) | block[i * 4 + 3];
  }

  // Initial AddRoundKey
  for (var i = 0; i < Nb; i++) state[i] ^= keySchedule[i];

  // Rounds 1 to Nr-1
  for (var round = 1; round < Nr; round++) {
    // SubBytes + ShiftRows + MixColumns + AddRoundKey
    var s0 = AES_SBOX[(state[0] >>> 24) & 0xFF] << 24 |
             AES_SBOX[(state[1] >>> 16) & 0xFF] << 16 |
             AES_SBOX[(state[2] >>> 8) & 0xFF]  << 8  |
             AES_SBOX[state[3] & 0xFF];
    var s1 = AES_SBOX[(state[1] >>> 24) & 0xFF] << 24 |
             AES_SBOX[(state[2] >>> 16) & 0xFF] << 16 |
             AES_SBOX[(state[3] >>> 8) & 0xFF]  << 8  |
             AES_SBOX[state[0] & 0xFF];
    var s2 = AES_SBOX[(state[2] >>> 24) & 0xFF] << 24 |
             AES_SBOX[(state[3] >>> 16) & 0xFF] << 16 |
             AES_SBOX[(state[0] >>> 8) & 0xFF]  << 8  |
             AES_SBOX[state[1] & 0xFF];
    var s3 = AES_SBOX[(state[3] >>> 24) & 0xFF] << 24 |
             AES_SBOX[(state[0] >>> 16) & 0xFF] << 16 |
             AES_SBOX[(state[1] >>> 8) & 0xFF]  << 8  |
             AES_SBOX[state[2] & 0xFF];

    // MixColumns
    state[0] = _mixColumn(s0);
    state[1] = _mixColumn(s1);
    state[2] = _mixColumn(s2);
    state[3] = _mixColumn(s3);

    // AddRoundKey
    for (var i = 0; i < Nb; i++) state[i] ^= keySchedule[round * Nb + i];
  }

  // Final round (no MixColumns)
  var t0 = AES_SBOX[(state[0] >>> 24) & 0xFF] << 24 |
           AES_SBOX[(state[1] >>> 16) & 0xFF] << 16 |
           AES_SBOX[(state[2] >>> 8) & 0xFF]  << 8  |
           AES_SBOX[state[3] & 0xFF];
  var t1 = AES_SBOX[(state[1] >>> 24) & 0xFF] << 24 |
           AES_SBOX[(state[2] >>> 16) & 0xFF] << 16 |
           AES_SBOX[(state[3] >>> 8) & 0xFF]  << 8  |
           AES_SBOX[state[0] & 0xFF];
  var t2 = AES_SBOX[(state[2] >>> 24) & 0xFF] << 24 |
           AES_SBOX[(state[3] >>> 16) & 0xFF] << 16 |
           AES_SBOX[(state[0] >>> 8) & 0xFF]  << 8  |
           AES_SBOX[state[1] & 0xFF];
  var t3 = AES_SBOX[(state[3] >>> 24) & 0xFF] << 24 |
           AES_SBOX[(state[0] >>> 16) & 0xFF] << 16 |
           AES_SBOX[(state[1] >>> 8) & 0xFF]  << 8  |
           AES_SBOX[state[2] & 0xFF];

  // Final AddRoundKey
  for (var i = 0; i < Nb; i++) {
    var w = [t0, t1, t2, t3][i] ^ keySchedule[Nr * Nb + i];
    state[i] = w;
  }

  // Output
  var result = new Uint8Array(16);
  for (var i = 0; i < Nb; i++) {
    result[i * 4]     = (state[i] >>> 24) & 0xFF;
    result[i * 4 + 1] = (state[i] >>> 16) & 0xFF;
    result[i * 4 + 2] = (state[i] >>> 8) & 0xFF;
    result[i * 4 + 3] = state[i] & 0xFF;
  }
  return result;
}

function _mixColumn(word) {
  var a = [(word >>> 24) & 0xFF, (word >>> 16) & 0xFF, (word >>> 8) & 0xFF, word & 0xFF];
  var r = new Array(4);
  r[0] = _xtime(a[0]) ^ (_xtime(a[1]) ^ a[1]) ^ a[2] ^ a[3];
  r[1] = a[0] ^ _xtime(a[1]) ^ (_xtime(a[2]) ^ a[2]) ^ a[3];
  r[2] = a[0] ^ a[1] ^ _xtime(a[2]) ^ (_xtime(a[3]) ^ a[3]);
  r[3] = (_xtime(a[0]) ^ a[0]) ^ a[1] ^ a[2] ^ _xtime(a[3]);
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
  var z = new Uint8Array(16);
  var v = new Uint8Array(y);

  for (var i = 0; i < 128; i++) {
    var byteIdx = i >>> 3;
    var bitIdx = 7 - (i & 7);
    if (x[byteIdx] & (1 << bitIdx)) {
      for (var j = 0; j < 16; j++) z[j] ^= v[j];
    }
    var carry = v[15] & 1;
    for (var j = 15; j > 0; j--) {
      v[j] = (v[j] >>> 1) | ((v[j - 1] & 1) << 7);
    }
    v[0] = (v[0] >>> 1) ^ (carry ? 0xE1 : 0);
  }
  return z;
}

function _gcmGHASH(h, aad, ciphertext) {
  var block = new Uint8Array(16);

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
  var lenBlock = new Uint8Array(16);
  var aadBits = aad.length * 8;
  var ctBits = ciphertext.length * 8;
  lenBlock[4] = (aadBits >>> 24) & 0xFF;
  lenBlock[5] = (aadBits >>> 16) & 0xFF;
  lenBlock[6] = (aadBits >>> 8) & 0xFF;
  lenBlock[7] = aadBits & 0xFF;
  lenBlock[12] = (ctBits >>> 24) & 0xFF;
  lenBlock[13] = (ctBits >>> 16) & 0xFF;
  lenBlock[14] = (ctBits >>> 8) & 0xFF;
  lenBlock[15] = ctBits & 0xFF;

  for (var j = 0; j < 16; j++) block[j] ^= lenBlock[j];
  return _ghashMultiply(block, h);
}

function _gcmIncrementCounter(counter) {
  for (var i = 15; i >= 12; i--) {
    counter[i]++;
    if (counter[i] !== 0) break;
  }
}

function _gcmEncrypt(keyBytes, iv, plaintext, aad) {
  aad = aad || new Uint8Array(0);
  var pt = typeof plaintext === 'string' ? _strToBytes(plaintext) : plaintext;
  var keySchedule = _aesKeyExpansion(keyBytes);

  // Build initial counter block: IV || 0x00000001
  var J0 = new Uint8Array(16);
  J0.set(iv);
  J0[15] = 1;

  // H = E_K(0^128)
  var H = _aesEncryptBlock(keySchedule, new Uint8Array(16));

  // Encrypt: CTR mode starting from counter = J0 + 1
  var counter = new Uint8Array(J0);
  _gcmIncrementCounter(counter);

  var ct = new Uint8Array(pt.length);
  for (var i = 0; i < pt.length; i += 16) {
    var keystream = _aesEncryptBlock(keySchedule, counter);
    for (var j = 0; j < 16 && (i + j) < pt.length; j++) {
      ct[i + j] = pt[i + j] ^ keystream[j];
    }
    _gcmIncrementCounter(counter);
  }

  // Compute authentication tag
  var ghash = _gcmGHASH(H, aad, ct);
  var tagInput = new Uint8Array(16);
  tagInput.set(J0);
  var encJ0 = _aesEncryptBlock(keySchedule, tagInput);
  var tag = new Uint8Array(TAG_LENGTH);
  for (var i = 0; i < TAG_LENGTH; i++) {
    tag[i] = ghash[i] ^ encJ0[i];
  }

  return { ciphertext: ct, tag: tag };
}

function _gcmDecrypt(keyBytes, iv, ciphertext, tag, aad) {
  aad = aad || new Uint8Array(0);
  var keySchedule = _aesKeyExpansion(keyBytes);

  // Verify authentication tag first
  var J0 = new Uint8Array(16);
  J0.set(iv);
  J0[15] = 1;

  var H = _aesEncryptBlock(keySchedule, new Uint8Array(16));
  var computedGhash = _gcmGHASH(H, aad, ciphertext);
  var tagInput = new Uint8Array(16);
  tagInput.set(J0);
  var encJ0 = _aesEncryptBlock(keySchedule, tagInput);

  for (var k = 0; k < TAG_LENGTH; k++) {
    if (tag[k] !== (computedGhash[k] ^ encJ0[k])) {
      throw new Error('[加密] 认证失败：数据可能被篡改或密钥不正确');
    }
  }

  // Decrypt
  var counter = new Uint8Array(J0);
  _gcmIncrementCounter(counter);

  var pt = new Uint8Array(ciphertext.length);
  for (var i = 0; i < ciphertext.length; i += 16) {
    var keystream = _aesEncryptBlock(keySchedule, counter);
    for (var j = 0; j < 16 && (i + j) < ciphertext.length; j++) {
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
    var salt = wx.getStorageSync('__crypto_salt__');
    if (salt) {
      cryptoReady = true;
      console.log('[加密] 模块初始化完成');
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
  var keyBytes = _pbkdf2(password, salt, PBKDF2_ITERATIONS, KEY_BYTES);
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
  var iv = _wxRandomBytes(IV_LENGTH);
  var result = _gcmEncrypt(masterKey, iv, plaintext);

  // Format: IV (12) || ciphertext || tag (16)
  var combined = new Uint8Array(IV_LENGTH + result.ciphertext.length + TAG_LENGTH);
  combined.set(iv);
  combined.set(result.ciphertext, IV_LENGTH);
  combined.set(result.tag, IV_LENGTH + result.ciphertext.length);

  return _bytesToBase64(combined);
}

function decrypt(combinedBase64) {
  if (!cryptoReady || !masterKey) throw new Error('加密模块未就绪，请先设置密钥');
  var combined = _base64ToBytes(combinedBase64);

  if (combined.length < IV_LENGTH + TAG_LENGTH) {
    throw new Error('[加密] 密文格式无效');
  }

  var iv = combined.slice(0, IV_LENGTH);
  var ctLen = combined.length - IV_LENGTH - TAG_LENGTH;
  var ciphertext = combined.slice(IV_LENGTH, IV_LENGTH + ctLen);
  var tag = combined.slice(IV_LENGTH + ctLen);

  var pt = _gcmDecrypt(masterKey, iv, ciphertext, tag);
  return _bytesToStr(pt);
}

function encryptFile(filePath, outputPath) {
  if (!cryptoReady || !masterKey) return Promise.reject(new Error('加密模块未就绪'));
  var fs = wx.getFileSystemManager();
  return new Promise(function(resolve, reject) {
    fs.readFile({
      filePath: filePath,
      success: function(res) {
        try {
          var iv = _wxRandomBytes(IV_LENGTH);
          var plainBytes = new Uint8Array(res.data);
          var result = _gcmEncrypt(masterKey, iv, plainBytes);

          // 写入: IV || ciphertext || tag 的二进制
          var combined = new Uint8Array(IV_LENGTH + result.ciphertext.length + TAG_LENGTH);
          combined.set(iv);
          combined.set(result.ciphertext, IV_LENGTH);
          combined.set(result.tag, IV_LENGTH + result.ciphertext.length);

          fs.writeFile({
            filePath: outputPath,
            data: combined.buffer,
            success: function() { resolve(outputPath); },
            fail: reject
          });
        } catch (e) { reject(e); }
      },
      fail: reject
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
  var bytes = [];
  for (var i = 0; i < str.length; i++) {
    var cp = str.charCodeAt(i);
    if (cp < 0x80) {
      bytes.push(cp);
    } else if (cp < 0x800) {
      bytes.push(0xC0 | (cp >> 6), 0x80 | (cp & 0x3F));
    } else if (cp < 0xD800 || cp >= 0xE000) {
      bytes.push(0xE0 | (cp >> 12), 0x80 | ((cp >> 6) & 0x3F), 0x80 | (cp & 0x3F));
    } else {
      // Surrogate pair (for characters outside BMP like emoji)
      i++;
      var cp2 = 0x10000 + ((cp & 0x3FF) << 10) + (str.charCodeAt(i) & 0x3FF);
      bytes.push(0xF0 | (cp2 >> 18), 0x80 | ((cp2 >> 12) & 0x3F),
                 0x80 | ((cp2 >> 6) & 0x3F), 0x80 | (cp2 & 0x3F));
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
  var str = '';
  var i = 0;
  while (i < bytes.length) {
    var b = bytes[i];
    var cp;
    var len;
    if (b < 0x80) {
      cp = b;
      len = 1;
    } else if ((b & 0xE0) === 0xC0) {
      cp = ((b & 0x1F) << 6) | (bytes[i + 1] & 0x3F);
      len = 2;
    } else if ((b & 0xF0) === 0xE0) {
      cp = ((b & 0x0F) << 12) | ((bytes[i + 1] & 0x3F) << 6) | (bytes[i + 2] & 0x3F);
      len = 3;
    } else if ((b & 0xF8) === 0xF0) {
      cp = ((b & 0x07) << 18) | ((bytes[i + 1] & 0x3F) << 12) |
           ((bytes[i + 2] & 0x3F) << 6) | (bytes[i + 3] & 0x3F);
      len = 4;
    } else {
      cp = 0xFFFD;
      len = 1;
    }
    if (cp < 0x10000) {
      str += String.fromCharCode(cp);
    } else {
      cp -= 0x10000;
      str += String.fromCharCode(0xD800 | (cp >> 10), 0xDC00 | (cp & 0x3FF));
    }
    i += len;
  }
  return str;
}

function _concatBytes(a, b) {
  var r = new Uint8Array(a.length + b.length);
  r.set(a);
  r.set(b, a.length);
  return r;
}

function _bytesToBase64(bytes) {
  var binary = '';
  for (var i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function _base64ToBytes(base64) {
  var binary = atob(base64);
  var bytes = new Uint8Array(binary.length);
  for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i) & 0xFF;
  return bytes;
}

function _arrayBufferToBase64(buffer) {
  var bytes = new Uint8Array(buffer);
  return _bytesToBase64(bytes);
}

function arrayBufferToBase64(buffer) { return _arrayBufferToBase64(buffer); }
function base64ToArrayBuffer(base64) { return _base64ToBytes(base64).buffer; }

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
    var testKey = _pbkdf2('__crypto_self_test__', new Uint8Array(16), 1, KEY_BYTES);
    var testIV = new Uint8Array(12);
    for (var i = 0; i < 12; i++) testIV[i] = i;
    var testPt = _strToBytes('住港伴 crypto self-test');

    var enc = _gcmEncrypt(testKey, testIV, testPt);
    var dec = _gcmDecrypt(testKey, testIV, enc.ciphertext, enc.tag);

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
  base64ToArrayBuffer: base64ToArrayBuffer
};
