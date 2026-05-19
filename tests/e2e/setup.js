/**
 * E2E 全局 Setup — 连接 DevTools + 小 evaluate 分批种子注入
 *
 * readFileSync 在小程序运行时无文件系统权限，已废弃。
 * 改用多次极小 evaluate，每次只写一个 storage key，载荷几十字节不会断连。
 * 详见: inbox/NOTIFY_small_evaluate_20260514.md
 */

const automator = require('miniprogram-automator');
const path = require('path');

const PROJECT_PATH = path.resolve(__dirname, '../..');

module.exports = async function globalSetup() {
  console.log('\n========================================');
  console.log('  住港伴 V3 E2E 测试 — 环境初始化');
  console.log('========================================\n');

  const startTime = Date.now();

  try {
    const cliPath = process.env.WECHAT_IDE_CLI
      || '/Applications/wechatwebdevtools.app/Contents/MacOS/cli';
    const mp = await automator.launch({
      projectPath: PROJECT_PATH,
      cliPath,
    });

    const page = await mp.currentPage();
    if (page) {
      console.log(`   当前页面: ${page.path}`);
    }

    console.log(`✅ 小程序已连接 (${Date.now() - startTime}ms)`);

    // 小 evaluate 分批写入 — 每个只传几十字节，不会触发 WebSocket 断连
    const seeds = [
      // auth
      { key: 'auth_token',              label: 'auth_token',            val: 'e2e-test-token-c53f7a91' },
      { key: 'user_profile',            label: 'user_profile',          val: { openid: 'e2e-test-openid', nickname: 'E2E测试用户', avatarUrl: '' } },
      // processes
      { key: '__processes__',           label: 'processes',             val: { lines: [{ id: 'e2e-test-process', name: '学生→IANG', templateId: 'student_iang', pathType: 'student_iang', riskLevel: 'low', totalCycle: '7年', status: 'active', source: 'manual', stages: [{ id: 's1', name: '资格评估', phaseId: 'phase1', order: 0, status: 'completed', unlocked: true, steps: [{ name: '学校录取' }, { name: '签证获批' }], completedSteps: [0, 1] }, { id: 's2', name: '获批激活', phaseId: 'phase2', order: 1, status: 'current', unlocked: true, steps: [{ name: '入境激活' }, { name: '办理身份证' }, { name: '银行开户' }], completedSteps: [0] }, { id: 's3', name: '中期维持', phaseId: 'phase3', order: 2, status: 'pending', unlocked: false, steps: [{ name: '全日制学习' }, { name: 'IANG申请' }], completedSteps: [] }], currentStage: '获批激活' }], version: 1 } },
      // reminders
      { key: '__reminders__',           label: 'reminders',             val: { items: [{ id: 'e2e-test', title: 'E2E测试提醒', label: 'E2E测试提醒', deadline: '2026-12-31', description: 'E2E测试用提醒', type: 'manual', confidence: 'B', status: 'active', priority: 'normal', linkedDocIds: [], dependsOn: null, alerts: [], source: { type: 'manual' }, createdAt: '2026-05-13T00:00:00.000Z', updatedAt: '2026-05-13T00:00:00.000Z' }], version: 1 } },
    ];

    for (var i = 0; i < seeds.length; i++) {
      var s = seeds[i];
      try {
        await mp.evaluate(function (key, val) {
          wx.setStorageSync(key, val);
        }, s.key, s.val);
        console.log('  ✅ seed: ' + s.label);
      } catch (e) {
        console.error('  ❌ seed failed: ' + s.label + ' — ' + (e.message || e));
      }
    }

    console.log('✅ 种子数据注入完成 (' + (Date.now() - startTime) + 'ms)');

    global.__miniProgram__ = mp;
    global.__automator__ = automator;
  } catch (err) {
    console.error('❌ 连接失败:', err.message);
    console.error('\n请检查:');
    console.error('  1. 微信开发者工具是否已打开且开启了服务端口');
    console.error('  2. 项目是否已在开发者工具中打开:', PROJECT_PATH);
    throw err;
  }
};
