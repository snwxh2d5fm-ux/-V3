/**
 * 住港伴 v3 — CloudBase 数据库 Schema 全集
 * 15 个集合定义，对齐 PRD v4 + GAP 分析报告
 * 
 * 部署: 通过微信开发者工具 → 云开发 → 数据库 → 创建集合
 * 或: npx @cloudbase/cli db create --file schema.json
 */

const SCHEMA = {

  // ============================================================
  // 1. users — 用户集合
  // ============================================================
  users: {
    description: '用户核心信息，PRD v3 要求 ~20 字段',
    indexes: [
      { key: { _openid: 1 }, unique: true },
      { key: { phoneHash: 1 }, sparse: true },
      { key: { membershipExpireAt: 1 } }
    ],
    defaultDoc: {
      _openid: '',
      status: 'active',             // active/locked/deleted
      freeTrialStartAt: null,       // 免费试用起始时间 (ISO)
      freeTrialEndAt: null,         // 试用到期日
      membershipLevel: 'free',      // free/basic/pro/premium
      membershipExpireAt: null,
      selectedPath: '',             // qmas/ttps_a/ttps_b/asmpt/student_iang/...
      currentPhase: '',             // 当前所处阶段
      milestoneStatus: {},          // { phase1: verified, phase2: locked }
      authorizedLabels: [],         // 已授权PII标签列表
      privacySettings: { mode: 'L1', encryptionEnabled: true },
      deviceId: '',
      phoneHash: '',
      createdAt: null,
      lastLoginAt: null
    }
  },

  // ============================================================
  // 2. orders — 订单集合
  // ============================================================
  orders: {
    description: '支付订单',
    indexes: [
      { key: { _openid: 1 } },
      { key: { orderNo: 1 }, unique: true },
      { key: { createdAt: -1 } }
    ],
    defaultDoc: {
      _openid: '',
      orderNo: '',
      productId: '',
      productType: 'membership',    // membership / 单次服务
      amount: 0,
      membershipMonths: 12,
      status: 'pending',            // pending/paid/refunded/cancelled
      paymentChannel: 'wechat_pay',
      paidAt: null,
      createdAt: null
    }
  },

  // ============================================================
  // 3. user_documents — 证件元数据 (脱敏后云端存储)
  // ============================================================
  user_documents: {
    description: '证件加密元数据，明文仅存本地',
    indexes: [
      { key: { _openid: 1 } },
      { key: { status: 1 } }
    ],
    defaultDoc: {
      _openid: '',
      docType: '',                  // id_card/hk_permit/degree_cert/...
      slotKey: '',                  // 所属槽位
      status: 'active',             // active/archived
      archiveReason: '',
      mode: 'local',                // local/anonymized
      ocrHash: '',                  // OCR字段哈希(用于云端去重)
      encryptedFields: '',          // AES-256-GCM 密文
      validFrom: null,
      validTo: null,
      createdAt: null,
      updatedAt: null
    }
  },

  // ============================================================
  // 4. reminders — 提醒集合
  // ============================================================
  reminders: {
    description: '用户提醒数据',
    indexes: [
      { key: { _openid: 1 } },
      { key: { deadline: 1 } },
      { key: { status: 1 } }
    ],
    defaultDoc: {
      _openid: '',
      title: '',
      description: '',
      type: '',                     // visa/renewal/document/medical/...
      deadline: null,
      status: 'active',             // active/completed/snoozed/ignored
      confidence: 'B',              // A/B/C/D置信度
      parentIds: [],                // 前置提醒ID列表
      relatedDocIds: [],            // 关联证件ID
      ruleKey: '',                  // 触发规则键
      createdAt: null,
      updatedAt: null
    }
  },

  // ============================================================
  // 5. processes — 流程集合
  // ============================================================
  processes: {
    description: '用户流程进度',
    indexes: [
      { key: { _openid: 1 } },
      { key: { templateId: 1 } }
    ],
    defaultDoc: {
      _openid: '',
      templateId: '',               // 12条模板之一
      pathName: '',
      currentPhase: 1,              // 1-4
      phases: [
        { phase: 1, name: '申请', status: 'in_progress', milestones: [], startedAt: null, completedAt: null },
        { phase: 2, name: '获批', status: 'locked', milestones: [] },
        { phase: 3, name: '续签', status: 'locked', milestones: [] },
        { phase: 4, name: '永居', status: 'locked', milestones: [] }
      ],
      decisionPoints: [],           // 关键决策节点状态
      riskLevel: '',                // 低/中/高
      createdAt: null,
      updatedAt: null
    }
  },

  // ============================================================
  // 6. guides — 指引牌内容库
  // ============================================================
  guides: {
    description: '结构化指引条目 (6层信息深度)',
    indexes: [
      { key: { guideId: 1 }, unique: true },
      { key: { path: 1, phase: 1 } },
      { key: { confidence: 1 } }
    ],
    defaultDoc: {
      guideId: '',
      path: '',                     // 适用路径
      phase: 1,                     // 适用阶段
      category: '',                 // 分类
      title: '',
      content: [
        { layer: 1, label: '法律依据', text: '', confidence: 'A', sourceRef: '' },
        { layer: 2, label: '标准要求', text: '', confidence: 'B', sourceRef: '' },
        { layer: 3, label: '材料清单', text: '', confidence: 'B', sourceRef: '' },
        { layer: 4, label: '常见问题', text: '', confidence: 'C', sourceRef: '' },
        { layer: 5, label: '特殊情况', text: '', confidence: 'C', sourceRef: '' },
        { layer: 6, label: '用户经验', text: '', confidence: 'D', sourceRef: '' }
      ],
      confidence: 'B',
      version: 1,
      createdAt: null,
      updatedAt: null
    }
  },

  // ============================================================
  // 7. guidebook_articles — 攻略书文章
  // ============================================================
  guidebook_articles: {
    description: '采集+清洗后的攻略内容',
    indexes: [
      { key: { contentHash: 1 }, unique: true },
      { key: { knowledge_domain: 1 } },
      { key: { usefulCount: -1 } }
    ],
    defaultDoc: {
      title: '',
      content: '',
      mergedContent: '',            // 原文+OCR融合
      ocrText: '',
      summary: '',
      sourceUrl: '',
      sourcePlatform: 'xiaohongshu',
      author: '',
      publishedAt: '',
      knowledgeDomain: 'QMAS',      // QMAS/TTPS/IANG/LIFE/...
      topics: [],
      usefulCount: 0,
      notUsefulCount: 0,
      wordCount: 0,
      grade: 'yellow',              // 质量等级
      confidence: 'low',
      images: [],
      ocrStats: { imagesTotal: 0, imagesSuccess: 0 },
      contentHash: '',
      collectedAt: null
    }
  },

  // ============================================================
  // 8. policy_snapshots — 政策快照
  // ============================================================
  policy_snapshots: {
    description: '官方信息源抓取快照',
    indexes: [
      { key: { sourceUrl: 1, capturedAt: -1 } },
      { key: { status: 1 } }
    ],
    defaultDoc: {
      sourceUrl: '',
      sourceName: '',               // 入境处/劳工局/税务局/教育局
      title: '',
      rawContent: '',
      extractedText: '',
      capturedAt: null,
      diffDetail: {},               // 与上一版本的差异
      affectedGuides: [],           // 受影响的指引牌ID
      affectedUserSegments: [],     // 受影响的用户群
      status: 'new'                 // new/unchanged/changed
    }
  },

  // ============================================================
  // 9. policy_updates — 政策推送
  // ============================================================
  policy_updates: {
    description: '面向用户的政策变更推送',
    indexes: [
      { key: { publishedAt: -1 } },
      { key: { severity: 1 } }
    ],
    defaultDoc: {
      title: '',
      summary: '',
      detail: '',
      sourceRef: '',
      severity: 'info',             // critical/important/info
      affectedPaths: [],
      publishedAt: null
    }
  },

  // ============================================================
  // 10. material_checks — 材料检查模板
  // ============================================================
  material_checks: {
    description: '效率宝材料检查规则',
    indexes: [
      { key: { docType: 1 } },
      { key: { path: 1 } }
    ],
    defaultDoc: {
      docType: '',
      path: '',
      rules: [],                    // JSON Schema 检查规则
      validSamples: [],             // 合格样本描述
      invalidSamples: [],           // 不合格样本描述
      createdAt: null
    }
  },

  // ============================================================
  // 11. subscriptions — 订阅消息
  // ============================================================
  subscriptions: {
    description: '小程序订阅消息模板',
    indexes: [
      { key: { _openid: 1 } }
    ],
    defaultDoc: {
      _openid: '',
      templateId: '',
      templateType: '',             // reminder/policy/update
      subscribed: true,
      subscribedAt: null
    }
  },

  // ============================================================
  // 12. rate_limits — 频率限制
  // ============================================================
  rate_limits: {
    description: '滑动窗口频率限制记录',
    indexes: [
      { key: { key: 1 } },
      { key: { windowStart: 1 }, expireAfterSeconds: 3600 }
    ],
    defaultDoc: {
      key: '',                      // _openid + action
      windowStart: null,
      count: 0,
      maxCount: 10                  // 每小时上限
    }
  },

  // ============================================================
  // 13. audit_logs — 审计日志
  // ============================================================
  audit_logs: {
    description: '用户操作审计追溯',
    indexes: [
      { key: { _openid: 1, createdAt: -1 } },
      { key: { action: 1 } }
    ],
    defaultDoc: {
      _openid: '',
      action: '',                   // upload_doc/view_doc/delete_doc/change_privacy
      detail: {},                   // 脱敏后的操作详情
      ipHash: '',
      deviceFingerprint: '',
      createdAt: null
    }
  },

  // ============================================================
  // 14. content_audit — 内容审核
  // ============================================================
  content_audit: {
    description: '用户生成内容审核记录',
    indexes: [
      { key: { _openid: 1 } },
      { key: { result: 1 } }
    ],
    defaultDoc: {
      _openid: '',
      contentHash: '',
      contentType: '',              // text/image
      result: '',                   // pass/block/review
      riskLabel: '',
      checkedAt: null
    }
  },

  // ============================================================
  // 15. ai_conversations — AI对话历史
  // ============================================================
  ai_conversations: {
    description: 'AI对话记录（脱敏后存储）',
    indexes: [
      { key: { _openid: 1, createdAt: -1 } },
      { key: { sessionId: 1 } }
    ],
    defaultDoc: {
      _openid: '',
      sessionId: '',
      mode: '',                     // assess/qa/general
      messages: [],                 // [{ role, content, timestamp }]
      topicSummary: '',
      createdAt: null,
      updatedAt: null
    }
  }
};

// ============================================================
// 数据库初始化脚本 (CloudBase CLI)
// ============================================================
function generateInitScript() {
  const lines = [
    '#!/bin/bash',
    '# 住港伴 v3 — CloudBase 数据库初始化',
    '# 使用方法: bash scripts/init-db.sh',
    '',
    'ENV_ID="cloudbase-d1g17tgt7cc199a60"',
    '',
    'collections=('
  ];
  
  Object.keys(SCHEMA).forEach(name => {
    lines.push(`  "${name}"`);
  });
  
  lines.push(')');
  lines.push('');
  lines.push('echo "🏗️  初始化 ${#collections[@]} 个数据库集合..."');
  lines.push('');
  lines.push('for coll in "${collections[@]}"; do');
  lines.push('  echo "  📦 创建集合: $coll"');
  lines.push('  tcb db createCollection "$coll" --envId "$ENV_ID" 2>/dev/null || echo "    (已存在)"');
  lines.push('done');
  lines.push('');
  lines.push('echo "✅ 数据库初始化完成"');
  
  // 索引创建
  lines.push('');
  lines.push('echo ""');
  lines.push('echo "🔍 创建索引..."');
  Object.entries(SCHEMA).forEach(([name, def]) => {
    if (def.indexes) {
      def.indexes.forEach(idx => {
        const keyStr = JSON.stringify(idx.key);
        const unique = idx.unique ? ' --unique' : '';
        lines.push(`tcb db createIndex "${name}" '${keyStr}' --envId "$ENV_ID"${unique} 2>/dev/null`);
      });
    }
  });
  
  lines.push('');
  lines.push('echo "✅ 全部完成"');
  
  return lines.join('\n');
}

module.exports = { SCHEMA, generateInitScript };
