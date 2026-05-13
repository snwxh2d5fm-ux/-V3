/**
 * E2E 全局 Setup — 仅连接 DevTools，不注入数据
 *
 * 设计决策: automator v0.12 的 mp.evaluate(大JSON) 无论放 setup 还是 beforeAll
 * 都会断开 WebSocket。ABC 测试全部证伪。最终方案: setup 只做连接，各 spec 自管理状态。
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
