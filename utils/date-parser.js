/**
 * 住港伴 — 日期解析器
 * 支持中英文、繁体、农历等多种日期格式
 */
function parseDateFromText(text) {
  if (!text) return [];
  const dates = [];
  // ISO 格式: 2026-05-07
  const iso = text.match(/\d{4}-\d{2}-\d{2}/g);
  if (iso) iso.forEach(d => dates.push({ date: d, format: 'ISO', original: d }));

  // 中文格式: 2026年5月7日, 2026年05月07日
  const cn = text.match(/(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/g);
  if (cn) cn.forEach(d => {
    const m = d.match(/(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
    dates.push({ date: `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`, format: 'CN', original: d });
  });

  // 英文格式: May 7, 2026 / 7 May 2026 / 07/05/2026
  const en1 = text.match(/(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4}/gi);
  if (en1) en1.forEach(d => {
    const parsed = new Date(d);
    if (!isNaN(parsed)) dates.push({ date: parsed.toISOString().slice(0,10), format: 'EN', original: d });
  });
  const en2 = text.match(/\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}/gi);
  if (en2) en2.forEach(d => {
    const parsed = new Date(d);
    if (!isNaN(parsed)) dates.push({ date: parsed.toISOString().slice(0,10), format: 'EN', original: d });
  });

  // 斜杠格式: 07/05/2026
  const slash = text.match(/\d{2}\/\d{2}\/\d{4}/g);
  if (slash) slash.forEach(d => {
    const parts = d.split('/');
    dates.push({ date: `${parts[2]}-${parts[1]}-${parts[0]}`, format: 'SLASH', original: d });
  });

  return dates;
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
