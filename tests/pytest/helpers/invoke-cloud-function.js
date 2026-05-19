#!/usr/bin/env node
/**
 * 云函数 main() 调用辅助脚本
 *
 * 在纯 Node.js 环境（无真实 wx-server-sdk）中调用云函数的 exports.main。
 * 依赖 NODE_PATH 指向 wx-server-sdk mock 目录。
 *
 * 用法:
 *   NODE_PATH=tests/pytest/mocks/node_modules \
 *     node invoke-cloud-function.js <functionName> <cloudfunctionsDir> <paramsJson>
 *
 * paramsJson 示例: '{"query":"优才计划","topK":3}'
 *
 * 输出: JSON 序列化的 main() 返回值，或 { error: ... }
 */
'use strict';

var functionName = process.argv[2];
var cloudfunctionsDir = process.argv[3];
var paramsJson = process.argv[4];

if (!functionName || !cloudfunctionsDir || !paramsJson) {
  console.log(JSON.stringify({
    error: 'Usage: invoke-cloud-function.js <functionName> <cloudfunctionsDir> <paramsJson>'
  }));
  process.exit(0);
}

try {
  var path = require('path');
  var indexPath = path.resolve(cloudfunctionsDir, functionName, 'index.js');

  // 清除 require 缓存以确保每次都是新的加载
  delete require.cache[indexPath];

  var mod = require(indexPath);

  if (typeof mod.main !== 'function') {
    console.log(JSON.stringify({ error: 'exports.main is not a function' }));
    process.exit(0);
  }

  var params = JSON.parse(paramsJson);
  var promise = mod.main(params);

  // 支持 sync 和 async main
  Promise.resolve(promise).then(function(result) {
    console.log(JSON.stringify(result));
  }).catch(function(err) {
    console.log(JSON.stringify({ error: err.message }));
  });
} catch (err) {
  console.log(JSON.stringify({ error: err.message }));
}
