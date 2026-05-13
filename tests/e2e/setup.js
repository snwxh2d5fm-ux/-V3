/**
 * E2E 全局 Setup — 连接 DevTools + 文件种子注入
 *
 * mp.evaluate(大JSON) 无论放 setup 还是 beforeAll 都会断开 WebSocket。
 * 解决方案: 种子数据写为 tests/e2e/fixtures/*.json，小程序通过
 * wx.getFileSystemManager().readFileSync() 自己读，evaluate 只传路径字符串。
 * 详见: inbox/NOTIFY_file_seed_approach_20260513.md
 */

const automator = require('miniprogram-automator');
const path = require('path');
const fs = require('fs');

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

    // 文件种子注入 — evaluate 只传路径字符串，大 JSON 由小程序自己读
    await mp.evaluate(function () {
      var fsm = wx.getFileSystemManager();

      // 读取 auth 种子并写入 storage
      try {
        var authRaw = fsm.readFileSync('tests/e2e/fixtures/auth.json', 'utf8');
        var auth = JSON.parse(authRaw);
        wx.setStorageSync('auth_token', auth.token);
        wx.setStorageSync('user_profile', auth.user_profile);
        console.log('[E2E setup] auth seeded from fixture');
      } catch (e) {
        console.error('[E2E setup] auth fixture read failed:', e.message);
      }

      // 读取 processes 种子
      try {
        var procRaw = fsm.readFileSync('tests/e2e/fixtures/processes.json', 'utf8');
        wx.setStorageSync('__processes__', JSON.parse(procRaw));
        console.log('[E2E setup] processes seeded from fixture');
      } catch (e) {
        console.error('[E2E setup] processes fixture read failed:', e.message);
      }

      // 读取 reminders 种子
      try {
        var remRaw = fsm.readFileSync('tests/e2e/fixtures/reminders.json', 'utf8');
        wx.setStorageSync('__reminders__', JSON.parse(remRaw));
        console.log('[E2E setup] reminders seeded from fixture');
      } catch (e) {
        console.error('[E2E setup] reminders fixture read failed:', e.message);
      }
    });

    console.log(`✅ 种子数据注入完成 (${Date.now() - startTime}ms)`);

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
