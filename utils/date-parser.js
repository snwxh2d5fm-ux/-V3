/**
 * 住港伴 — 日期解析器
 * 支持中英文、繁体、农历等多种日期格式
 */
function parseDateFromText(text) {
  if (!text) return [];
  var dates = [];
  var seen = {};

  // ISO 格式: 2026-05-07
  var isoRe = /\d{4}-\d{2}-\d{2}/g;
  var m;
  while ((m = isoRe.exec(text)) !== null) {
    if (!seen[m[0]]) { seen[m[0]] = true; dates.push({ date: m[0], format: 'ISO', original: m[0], label: extractContext(text, m.index, m[0]) }); }
  }

  // 中文格式: 2026年8月15日（含前/后/止等上下文）
  var cnRe = /(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/g;
  while ((m = cnRe.exec(text)) !== null) {
    var dateStr = m[1] + '-' + m[2].padStart(2,'0') + '-' + m[3].padStart(2,'0');
    if (!seen[dateStr]) {
      seen[dateStr] = true;
      var orig = m[0];
      var label = extractContext(text, m.index, orig);
      dates.push({ date: dateStr, format: 'CN', original: orig, label: label });
    }
  }

  // 英文格式
  var enRe = /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4}/gi;
  while ((m = enRe.exec(text)) !== null) {
    var p = new Date(m[0]);
    if (!isNaN(p)) {
      var ds = p.toISOString().slice(0,10);
      if (!seen[ds]) { seen[ds] = true; dates.push({ date: ds, format: 'EN', original: m[0], label: extractContext(text, m.index, m[0]) }); }
    }
  }

  // 斜杠格式: 07/05/2026
  var slRe = /\d{2}\/\d{2}\/\d{4}/g;
  while ((m = slRe.exec(text)) !== null) {
    var parts = m[0].split('/');
    var ds2 = parts[2] + '-' + parts[1] + '-' + parts[0];
    if (!seen[ds2]) { seen[ds2] = true; dates.push({ date: ds2, format: 'SLASH', original: m[0], label: extractContext(text, m.index, m[0]) }); }
  }

  return dates;
}

/** 从日期前后提取事件上下文 */
function extractContext(text, idx, dateStr) {
  var before = text.substring(Math.max(0, idx - 20), idx).replace(/\s+/g, '');
  var after = text.substring(idx + dateStr.length, Math.min(text.length, idx + dateStr.length + 30)).trim();
  // 去掉日期前的修饰词
  before = before.replace(/[之前此后至到应须须在从于於]/g, '').trim();
  // 日期后紧跟的关键词提示
  if (/^前/.test(after)) {
    return (before || '') + (after.substring(1).trim() || '截止日');
  }
  if (/^(?:止|截止|到期|过期)/.test(after)) {
    return (before || '') + (after.replace(/^(?:止|截止|到期|过期)/, '截止').trim() || '截止日');
  }
  if (/^(?:开始|起|生效)/.test(after)) {
    return (before || '') + '起' + (after.replace(/^(?:开始|起|生效)/, '').trim() || '');
  }
  // 取日期后15字符作为标签
  var label = after.substring(0, 20).replace(/[，,。.；;！!？?\s]+/g, '').trim();
  if (!label && before) label = before;
  return label || '关键日期';
}

// 计算倒计时
function getCountdown(targetDate) {
  const now = new Date();
  const target = new Date(targetDate);
  const diff = target.getTime() - now.getTime();
  const days = Math.ceil(diff / 86400000);
  return {
    days,
    hours: Math.floor((diff % 86400000) / 3600000),
    isPast: diff < 0,
    isToday: days === 0,
    isUpcoming: days > 0 && days <= 7,
    isWithinMonth: days > 0 && days <= 30,
    display: days > 0 ? `还有 ${days} 天` : days === 0 ? '今天' : `已过期 ${Math.abs(days)} 天`
  };
}

// 日期格式化
function formatDate(dateStr, format = 'CN') {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  if (format === 'CN') return `${y}年${m}月${day}日`;
  if (format === 'ISO') return `${y}-${m}-${day}`;
  return `${y}/${m}/${day}`;
}

module.exports = { parseDateFromText, getCountdown, formatDate };
