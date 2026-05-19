/**
 * 清除所有测试用户数据 — 真机测试前执行
 * 通过 automator 连接 DevTools，清空 wx.storage + 测试fixtures
 */
const automator = require('miniprogram-automator');
const fs = require('fs');
const path = require('path');

async function main() {
  console.log('🧹 住港伴 V3 — 测试数据清理\n');

  // 1. 连接 DevTools 中的小程序
  let mp;
  try {
    mp = await automator.connect({ wsEndpoint: 'ws://127.0.0.1:15412' });
    console.log('✅ 已连接小程序');
  } catch (e) {
    console.log('⚠️ 无法连接 DevTools (需先在IDE中打开项目并开启auto模式)');
    console.log('   手动操作: 打开微信开发者工具 → 设置 → 安全 → 开启服务端口');
  }

  if (mp) {
    // 2. 清空所有本地存储
    try {
      await mp.evaluate(() => {
        wx.clearStorageSync();
        return true;
      });
      console.log('✅ wx.clearStorageSync() — 所有本地数据已清除');
    } catch (e) {
      console.log('⚠️ clearStorage 失败:', e.message);
    }

    // 3. 验证清空
    try {
      const info = await mp.evaluate(() => {
        return {
          storageSize: wx.getStorageInfoSync().keys.length,
          currentPage: getCurrentPages()[0]?.route || 'unknown'
        };
      });
      console.log(`   剩余key数: ${info.storageSize}`);
      console.log(`   当前页面: ${info.currentPage}`);
    } catch (e) {}

    await mp.close();
    console.log('✅ 小程序已断开');
  }

  // 4. 清空测试fixtures
  const fixturesDir = path.resolve(__dirname, 'fixtures');
  const files = ['case-processes.json', 'processes.json', 'case-vault-meta.json', 'documents.json'];
  files.forEach(f => {
    const p = path.join(fixturesDir, f);
    if (fs.existsSync(p)) {
      fs.writeFileSync(p, '{}');
      console.log(`  清空 fixture: ${f}`);
    }
  });

  console.log('\n✅ 清理完成 — 可进行真机测试');
}

main().catch(e => { console.error(e); process.exit(1); });
