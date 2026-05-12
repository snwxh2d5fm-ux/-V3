/**
 * 住港伴 — 表单验证工具
 * 从旧版 utils/validator.ts 移植，适配原生小程序框架
 * 纯函数模块，无框架依赖
 */

/**
 * 验证手机号（中国大陆）
 */
function isValidChinesePhone(phone) {
  return /^1[3-9]\d{9}$/.test(phone);
}

/**
 * 验证手机号（香港）
 */
function isValidHKPhone(phone) {
  return /^[5-9]\d{7}$/.test(phone);
}

/**
 * 验证邮箱
 */
function isValidEmail(email) {
  return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email);
}

/**
 * 验证身份证号（中国大陆18位，含校验码验证）
 */
function isValidChineseID(id) {
  if (!/^[1-9]\d{5}(19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[\dXx]$/.test(id)) {
    return false;
  }
  // 校验码验证
  var weights = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
  var checkChars = '10X98765432';
  var sum = 0;
  for (var i = 0; i < 17; i++) {
    sum += parseInt(id[i]) * weights[i];
  }
  var checkChar = checkChars[sum % 11];
  return id[17].toUpperCase() === checkChar;
}

/**
 * 验证护照号格式（中国大陆）
 */
function isValidPassport(passport) {
  return /^[EeGgPpSsDd]\d{7,8}$/.test(passport);
}

/**
 * 验证香港身份证号码
 * 格式: X123456(A) 或 XX1234567(A)
 */
function isValidHKID(id) {
  return /^[A-Z]{1,2}\d{6,7}\([0-9A]\)$/.test(id);
}

/**
 * 非空验证
 */
function isNotEmpty(value) {
  return value && value.trim().length > 0;
}

/**
 * 字符串长度验证
 */
function isLengthBetween(value, min, max) {
  return value.length >= min && value.length <= max;
}

/**
 * 纯数字验证
 */
function isNumeric(value) {
  return /^\d+$/.test(value);
}

/**
 * 验证URL格式
 */
function isValidURL(url) {
  try {
    new URL(url);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * 密码强度检查
 * @returns {{ score: number, label: string }}
 */
function getPasswordStrength(password) {
  var score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 2) return { score: score, label: '弱' };
  if (score <= 4) return { score: score, label: '中' };
  return { score: score, label: '强' };
}

module.exports = {
  isValidChinesePhone,
  isValidHKPhone,
  isValidEmail,
  isValidChineseID,
  isValidPassport,
  isValidHKID,
  isNotEmpty,
  isLengthBetween,
  isNumeric,
  isValidURL,
  getPasswordStrength,
};
