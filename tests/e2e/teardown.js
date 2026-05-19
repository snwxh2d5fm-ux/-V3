/**
 * E2E 全局 Teardown — 关闭小程序连接 + 清理
 */

const fs = require('fs');
const path = require('path');

module.exports = async function globalTeardown() {
  console.log('\n========================================');
  console.log('  住港伴 V3 E2E 测试 — 环境清理');
  console.log('========================================\n');

  if (global.__miniProgram__) {
    try {
      await global.__miniProgram__.close();
      console.log('✅ 小程序已关闭');
    } catch (err) {
      console.warn('⚠️  关闭小程序时出错:', err.message);
    }
  }

  // 生成测试汇总
  const reportsDir = path.resolve(__dirname, 'reports');
  if (fs.existsSync(reportsDir)) {
    console.log(`\n📊 测试报告目录: ${reportsDir}`);
    const files = fs.readdirSync(reportsDir).filter(f => f.endsWith('.html'));
    if (files.length > 0) {
      console.log(`   报告文件: ${files.join(', ')}`);
    }
  }

  console.log('\n✅ E2E 测试套件执行完毕\n');
};
