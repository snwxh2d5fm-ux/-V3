/**
 * E2E 全局 Setup — 连接微信开发者工具 automator
 *
 * 前置条件:
 *   1. 微信开发者工具已安装且运行中
 *   2. CLI 服务端口已开启: 开发者工具 → 设置 → 安全 → 服务端口 (默认 9420)
 *   3. 项目已导入开发者工具 (手动打开项目)
 *
 * ⚠️ 注意: 不要在 setup 中 reLaunch，会断开 WebSocket 连接。
 *   automator.launch() 连接已打开的 DevTools 项目实例即可。
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
    // 连接到已在开发者工具中打开的项目
    // cliPath 通过 WECHAT_IDE_CLI 环境变量或默认路径，支持三机集群不同安装位置
    const cliPath = process.env.WECHAT_IDE_CLI
      || '/Applications/wechatwebdevtools.app/Contents/MacOS/cli';
    const mp = await automator.launch({
      projectPath: PROJECT_PATH,
      cliPath,
    });

    // 获取当前页面确认连通
    const page = await mp.currentPage();
    if (!page) {
      console.warn('⚠️  当前无页面，将在测试中导航');
    } else {
      console.log(`   当前页面: ${page.path}`);
    }

    console.log(`✅ 小程序已连接 (${Date.now() - startTime}ms)`);

    // 暴露全局引用
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
