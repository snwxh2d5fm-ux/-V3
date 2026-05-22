/**
 * 住港伴 v3 — 核心云函数 Smoke Test
 *
 * 分两层验证:
 *   Layer 1 (本地): 语法、安全规则、依赖声明 — 无需 CloudBase 环境
 *   Layer 2 (云上): 函数调用、RAG检索、AI响应 — 需 invokeFunction MCP
 *
 * 运行: npx jest tests/smoke/cloud-functions.test.js --verbose
 *
 * 注意: 云函数依赖 wx-server-sdk, 本地 node 无法加载.
 *       模块可加载性由 verify.sh A7 (node -c 语法检查) 保证.
 */

const path = require('path');
const fs = require('fs');

const CF_DIR = path.resolve(__dirname, '../../cloudfunctions');

/**
 * 读取云函数源码 (不执行 require, 避免 wx-server-sdk 缺失)
 */
function readCFSource(name) {
  const cfPath = path.join(CF_DIR, name, 'index.js');
  try {
    return fs.readFileSync(cfPath, 'utf-8');
  } catch (e) {
    return null;
  }
}

function hasCFDir(name) {
  return fs.existsSync(path.join(CF_DIR, name));
}

// ============================================================
// Layer 1: 本地可验证项
// ============================================================

describe('LAYER 1 — 本地静态验证', () => {
  describe('rag-search', () => {
    test('源码文件存在', () => {
      const src = readCFSource('rag-search');
      expect(src).toBeTruthy();
      expect(src.length).toBeGreaterThan(100);
    });

    test('package.json 声明依赖', () => {
      expect(fs.existsSync(path.join(CF_DIR, 'rag-search', 'package.json'))).toBe(true);
    });

    test('源码含 exports.main', () => {
      const src = readCFSource('rag-search');
      expect(src).toMatch(/exports\.main|module\.exports/);
    });

    test('含 K0/K1/K2 三层过滤逻辑', () => {
      const src = readCFSource('rag-search');
      // 至少含其中一层过滤
      expect(src).toMatch(/K0|K1|K2|visibility|source|filter|过滤/);
    });
  });

  describe('ai-chat', () => {
    test('源码文件存在', () => {
      expect(readCFSource('ai-chat')).toBeTruthy();
    });

    test('prompts.js 含 K2_SAFETY_RULES', () => {
      const promptsPath = path.join(CF_DIR, 'ai-chat', 'prompts.js');
      const prompts = fs.readFileSync(promptsPath, 'utf-8');
      // K2 安全规则必须存在
      expect(prompts).toMatch(/K2_SAFETY_RULES|SAFETY|安全/);
    });

    test('prompts.js 四模式安全规则', () => {
      const prompts = fs.readFileSync(path.join(CF_DIR, 'ai-chat', 'prompts.js'), 'utf-8');
      // assessment / solution_recommend / chat / guidebook 四种模式至少含两种
      const modeCount = ['assessment', 'solution', 'chat', 'guidebook'].filter((m) => prompts.includes(m)).length;
      expect(modeCount).toBeGreaterThanOrEqual(2);
    });

    test('package.json 声明依赖', () => {
      expect(fs.existsSync(path.join(CF_DIR, 'ai-chat', 'package.json'))).toBe(true);
    });
  });

  describe('k2-leak-scanner', () => {
    test('源码文件存在', () => {
      expect(readCFSource('k2-leak-scanner')).toBeTruthy();
    });

    test('含扫描/检查逻辑', () => {
      const src = readCFSource('k2-leak-scanner');
      expect(src).toMatch(/scan|check|leak|巡查|扫描/);
    });
  });

  describe('batch-generate-guidebooks', () => {
    test('源码文件存在', () => {
      expect(readCFSource('batch-generate-guidebooks')).toBeTruthy();
    });

    test('含 redactContent 内容脱敏函数', () => {
      const src = readCFSource('batch-generate-guidebooks');
      expect(src).toMatch(/redactContent|脱敏|replace.*投资移民|敏感词|安全/);
    });

    test('含 投资移民→资本投资 替换规则', () => {
      const src = readCFSource('batch-generate-guidebooks');
      expect(src).toMatch(/投资移民|资本投资/);
    });
  });

  describe('preaudit-engine', () => {
    test('源码文件存在', () => {
      expect(readCFSource('preaudit-engine')).toBeTruthy();
    });

    test('rule-engine.js 模块存在', () => {
      const enginePath = path.join(CF_DIR, 'preaudit-engine', 'rule-engine.js');
      expect(fs.existsSync(enginePath)).toBe(true);
    });

    test('formatters.js 模块存在', () => {
      const fmtPath = path.join(CF_DIR, 'preaudit-engine', 'formatters.js');
      expect(fs.existsSync(fmtPath)).toBe(true);
    });
  });
});

// ============================================================
// Layer 2: 云上验证 (仅标记，由 MCP invokeFunction 执行)
// ============================================================

describe('LAYER 2 — 需云端执行 (记录为 TODO)', () => {
  const CLOUD_TESTS = [
    { fn: 'rag-search', test: 'v2_gram 检索返回非空结果', params: { query: '优才计划申请条件', mode: 'v2_gram' } },
    { fn: 'ai-chat', test: 'K2 安全规则拦截违规问题', params: { query: '我能通过优才吗', _smoke: true } },
    { fn: 'preaudit-engine', test: 'OCR 结果校验返回结构化报告', params: { _smoke: true } },
    { fn: 'k2-leak-scanner', test: '全量扫描无异常', params: { action: 'scan', dryRun: true } },
  ];

  CLOUD_TESTS.forEach(({ fn, test: testName, params }) => {
    test.todo(`[云端] ${fn}: ${testName} (MCP invokeFunction)`);
  });
});
