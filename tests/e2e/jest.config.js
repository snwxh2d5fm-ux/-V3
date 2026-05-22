/**
 * 住港伴 V3 — miniprogram-automator E2E 测试配置
 *
 * 运行方式:
 *   npx jest -c tests/e2e/jest.config.js --verbose          # 全量
 *   npx jest -c tests/e2e/jest.config.js --testPathPattern=smoke   # 冒烟
 *   npx jest -c tests/e2e/jest.config.js --testPathPattern=documents # 单模块
 */

const path = require('path');

module.exports = {
  testEnvironment: 'node',
  rootDir: path.resolve(__dirname, '../..'),
  testMatch: ['<rootDir>/tests/e2e/specs/**/*.test.js'],
  globalSetup: '<rootDir>/tests/e2e/setup.js',
  globalTeardown: '<rootDir>/tests/e2e/teardown.js',

  testTimeout: 60000, // E2E 操作可能较慢
  maxWorkers: 1, // 微信开发者工具不支持并行
  verbose: true,
  bail: false,
  reporters: [
    'default',
    [
      'jest-html-reporter',
      {
        pageTitle: '住港伴 V3 E2E 测试报告',
        outputPath: '<rootDir>/tests/e2e/reports/e2e-report.html',
        includeFailureMsg: true,
        includeSuiteFailure: true,
        dateFormat: 'yyyy-mm-dd HH:MM:ss',
      },
    ],
  ],
};
