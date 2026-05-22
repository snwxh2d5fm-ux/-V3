/**
 * 住港伴 V3 — WeTest 云真机兼容性测试脚本
 *
 * 作用: 将本地测试用例转换为 WeTest 云真机可执行的脚本，
 *       在云端多机型上运行兼容性扫描。
 *
 * 前置条件:
 *   1. 注册腾讯 WeTest 账号 (wetest.qq.com)
 *   2. 获取 API Key
 *   3. 小程序已上传为开发版
 *
 * 使用:
 *   node scripts/ci/wetest-cloud.js --apikey=YOUR_KEY --version=v3.0.0
 *
 * 参考文档: https://wetest.qq.com/cloud/miniprogram
 */

const path = require('path');
const fs = require('fs');

// ============================================================
// 配置
// ============================================================
const CONFIG = {
  // 测试机型池 (覆盖主流机型)
  devices: [
    { model: 'iPhone 16 Pro Max', os: 'iOS 18', platform: 'ios' },
    { model: 'iPhone 13', os: 'iOS 17', platform: 'ios' },
    { model: 'iPhone SE (3rd)', os: 'iOS 17', platform: 'ios' },
    { model: 'Samsung Galaxy S24 Ultra', os: 'Android 14', platform: 'android' },
    { model: 'Xiaomi 14 Pro', os: 'Android 14', platform: 'android' },
    { model: 'Huawei P60 Pro', os: 'HarmonyOS 4', platform: 'android' },
    { model: 'OPPO Find X7', os: 'Android 14', platform: 'android' },
    { model: 'vivo X100 Pro', os: 'Android 14', platform: 'android' },
  ],

  // 测试用例
  testCases: [
    {
      name: '启动与登录',
      steps: [
        { action: 'launch', description: '冷启动小程序' },
        { action: 'wait', duration: 3000 },
        { action: 'screenshot', name: '01_launch' },
        { action: 'assert', condition: 'page_loaded', description: '页面正常加载' },
      ],
    },
    {
      name: 'TabBar 导航',
      steps: [
        { action: 'click_tab', tab: 'documents' },
        { action: 'wait', duration: 1000 },
        { action: 'screenshot', name: '02_tab_documents' },
        { action: 'click_tab', tab: 'process' },
        { action: 'wait', duration: 1000 },
        { action: 'screenshot', name: '03_tab_process' },
        { action: 'click_tab', tab: 'guidebooks' },
        { action: 'wait', duration: 1000 },
        { action: 'screenshot', name: '04_tab_guidebooks' },
        { action: 'click_tab', tab: 'reminders' },
        { action: 'wait', duration: 1000 },
        { action: 'screenshot', name: '05_tab_reminders' },
        { action: 'click_tab', tab: 'mine' },
        { action: 'wait', duration: 1000 },
        { action: 'screenshot', name: '06_tab_mine' },
      ],
    },
    {
      name: '流程控 — 工具栏入口',
      steps: [
        { action: 'click_tab', tab: 'process' },
        { action: 'wait', duration: 2000 },
        { action: 'screenshot', name: '07_process_toolbar' },
        { action: 'click', selector: '[data-action="guide"]', optional: true },
        { action: 'wait', duration: 2000 },
        { action: 'screenshot', name: '08_process_guide' },
        { action: 'navigate_back' },
      ],
    },
    {
      name: '证件夹 — 添加与画廊',
      steps: [
        { action: 'click_tab', tab: 'documents' },
        { action: 'wait', duration: 2000 },
        { action: 'screenshot', name: '09_documents_list' },
        { action: 'navigate', url: '/pages/documents/add/add' },
        { action: 'wait', duration: 2000 },
        { action: 'screenshot', name: '10_documents_add' },
      ],
    },
    {
      name: 'AI Chat — 对话测试',
      steps: [
        { action: 'navigate', url: '/pages/chat/index/index' },
        { action: 'wait', duration: 3000 },
        { action: 'screenshot', name: '11_chat_page' },
        { action: 'input', selector: 'textarea, input', text: '优才计划申请条件' },
        { action: 'wait', duration: 1000 },
        { action: 'click', selector: '.send-btn, [data-action="send"]', optional: true },
        { action: 'wait', duration: 5000 },
        { action: 'screenshot', name: '12_chat_response' },
      ],
    },
    {
      name: '异常场景 — 快速切换',
      steps: [
        { action: 'click_tab', tab: 'guidebooks' },
        { action: 'click_tab', tab: 'documents' },
        { action: 'click_tab', tab: 'reminders' },
        { action: 'click_tab', tab: 'process' },
        { action: 'click_tab', tab: 'mine' },
        { action: 'wait', duration: 500 },
        { action: 'screenshot', name: '13_rapid_switch' },
      ],
    },
  ],

  // 兼容性检查项
  compatibilityChecks: [
    { name: '页面白屏检测', description: '所有截图不应为纯白/纯黑' },
    { name: '文字截断', description: '文本元素不应被截断或溢出' },
    { name: '按钮可点击区域', description: '按钮大小 ≥ 44x44pt (iOS HIG)' },
    { name: '安全区域适配', description: '内容不应被刘海/底部指示条遮挡' },
    { name: '字体渲染', description: '中文字体无乱码/豆腐块' },
  ],
};

// ============================================================
// 生成 WeTest 脚本 (JSON 格式)
// ============================================================
function generateWeTestScript() {
  const script = {
    project: '住港伴V3',
    appid: 'wx08c2222c1bf042fd',
    miniprogram_version: 'trial', // 开发版
    devices: CONFIG.devices,
    test_cases: CONFIG.testCases,
    compatibility_checks: CONFIG.compatibilityChecks,
    settings: {
      timeout_per_step: 30000,
      retry_on_failure: 1,
      screenshot_quality: 80,
    },
  };

  const outDir = path.resolve(__dirname, '..', 'tests', 'e2e', 'reports');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const outPath = path.join(outDir, 'wetest-script.json');
  fs.writeFileSync(outPath, JSON.stringify(script, null, 2), 'utf-8');
  console.log(`✅ WeTest 脚本已生成: ${outPath}`);
  console.log('');
  console.log('下一步:');
  console.log('  1. 登录 https://wetest.qq.com/cloud/miniprogram');
  console.log('  2. 上传此脚本');
  console.log('  3. 选择机型池，启动兼容性测试');
  console.log('');
  console.log(`  API上传: curl -X POST https://wetest.qq.com/api/v1/miniprogram/upload \\
    -H "Authorization: Bearer YOUR_API_KEY" \\
    -F "script=@${outPath}"`);
}

// ============================================================
// 主函数
// ============================================================
function main() {
  const args = process.argv.slice(2);
  const apiKey = args.find((a) => a.startsWith('--apikey='))?.split('=')[1];
  const version = args.find((a) => a.startsWith('--version='))?.split('=')[1] || 'trial';

  if (!apiKey) {
    console.log('⚠️  未提供 --apikey，仅生成本地脚本文件');
    console.log('如需自动上传 WeTest，请添加 --apikey=YOUR_KEY\n');
  }

  generateWeTestScript();

  if (apiKey) {
    console.log(`📤 上传版本: ${version}`);
    // TODO: 实现 WeTest API 上传逻辑
    console.log('(API 上传功能开发中 — 请手动上传脚本)\n');
  }
}

main();
