#!/usr/bin/env node
/**
 * 云函数依赖验证辅助脚本
 *
 * 在纯 Node.js 环境（无 wx-server-sdk）中验证云函数模块结构。
 * 依赖 NODE_PATH 指向 wx-server-sdk mock 目录。
 *
 * 用法:
 *   NODE_PATH=tests/pytest/mocks/node_modules \
 *     node verify-cloud-function.js <functionName> <cloudfunctionsDir>
 *
 * 输出: JSON { name, hasExportsMain, isMainFunction, exportsKeys, error? }
 */
'use strict';

const functionName = process.argv[2];
const cloudfunctionsDir = process.argv[3];

if (!functionName || !cloudfunctionsDir) {
  console.error(JSON.stringify({ error: 'Usage: verify-cloud-function.js <functionName> <cloudfunctionsDir>' }));
  process.exit(1);
}

try {
  const path = require('path');
  const targetDir = path.resolve(cloudfunctionsDir, functionName);
  const indexPath = path.join(targetDir, 'index.js');

  // 清除 require 缓存以确保每次都是新的加载
  delete require.cache[indexPath];

  const mod = require(indexPath);

  const result = {
    name: functionName,
    hasExportsMain: typeof mod.main === 'function',
    isMainFunction: typeof mod.main === 'function',
    mainType: typeof mod.main,
    exportsKeys: Object.keys(mod),
  };

  console.log(JSON.stringify(result));
} catch (err) {
  const result = {
    name: functionName,
    hasExportsMain: false,
    isMainFunction: false,
    mainType: 'N/A',
    exportsKeys: [],
    error: err.message,
  };
  // Always write JSON to stdout for easy parsing
  console.log(JSON.stringify(result));
}
