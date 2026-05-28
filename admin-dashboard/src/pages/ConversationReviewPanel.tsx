import { useEffect, useState, useCallback } from 'react';
import { MessageSquare, ChevronLeft, ChevronRight, Search, RefreshCw } from 'lucide-react';
import {
  listConversations,
  getConversationDetail,
  submitReview,
  submitCorrection,
  approveCorrection,
  rejectCorrection,
} from '@/lib/api';
import { useAuth } from '@/hooks/use-auth';
import type { ConversationListItem, ConversationDetail as ConvDetail, ReviewScores } from '@/types';

const MODELS = ['全部', 'deepseek-chat', 'deepseek-reasoner', 'hunyuan'];
const STATUSES = ['全部', 'unreviewed', 'reviewed', 'corrected'];
const QUALITIES = ['全部', 'excellent', 'good', 'needs_improvement', 'wrong'];
const ERROR_TAGS = ['factual_error', 'outdated_policy', 'rag_mismatch', 'compliance_breach', 'incomplete_answer'];
const OVERALL_LABELS: Record<string, string> = {
  excellent: '优秀',
  good: '合格',
  needs_improvement: '需改进',
  wrong: '错误',
};

export function ConversationReviewPanel() {
  const { adminUser } = useAuth();
  const canApprove = adminUser?.role === 'pm' || adminUser?.role === 'super_admin';

  // List state
  const [list, setList] = useState<ConversationListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Record<string, string>>({
    model: '全部',
    reviewStatus: '全部',
    overall: '全部',
  });

  // Detail state
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ConvDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Review form state
  const [scores, setScores] = useState<ReviewScores>({ accuracy: 3, completeness: 3, compliance: 3, usefulness: 3 });
  const [overall, setOverall] = useState('good');
  const [errorTags, setErrorTags] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Correction state
  const [correctAnswer, setCorrectAnswer] = useState('');
  const [sourceRefs, setSourceRefs] = useState('');
  const [correctionType, setCorrectionType] = useState('factual_correction');
  const [submittingCorr, setSubmittingCorr] = useState(false);

  // Load list
  const loadList = useCallback(
    async (p: number) => {
      setLoading(true);
      const params: Record<string, unknown> = { page: p, pageSize: 20 };
      if (filters.model !== '全部') params.model = filters.model;
      if (filters.reviewStatus !== '全部') params.reviewStatus = filters.reviewStatus;
      if (filters.overall !== '全部') params.overall = filters.overall;
      const res = await listConversations(params);
      if (res.code === 0 && res.data) {
        setList(res.data.list);
        setTotal(res.data.total);
      }
      setLoading(false);
    },
    [filters],
  );

  useEffect(() => {
    loadList(page);
  }, [page, loadList]);

  // Load detail
  const openDetail = async (id: string) => {
    setSelectedId(id);
    setDetailLoading(true);
    setDetail(null);
    const res = await getConversationDetail(id);
    if (res.code === 0 && res.data) {
      setDetail(res.data);
      // Pre-fill review if exists
      if (res.data.review) {
        setScores(res.data.review.scores);
        setOverall(res.data.review.overall);
        setErrorTags(res.data.review.error_tags || []);
        setNote(res.data.review.note || '');
      } else {
        setScores({ accuracy: 3, completeness: 3, compliance: 3, usefulness: 3 });
        setOverall('good');
        setErrorTags([]);
        setNote('');
      }
      setCorrectAnswer('');
      setSourceRefs('');
    }
    setDetailLoading(false);
  };

  const closeDetail = () => {
    setSelectedId(null);
    setDetail(null);
  };

  // Submit review
  const handleSubmitReview = async () => {
    if (!selectedId) return;
    setSubmitting(true);
    const res = await submitReview({ conversationId: selectedId, scores, overall, errorTags, note });
    if (res.code === 0) {
      openDetail(selectedId);
      loadList(page);
    } else {
      alert(res.msg || '提交失败');
    }
    setSubmitting(false);
  };

  // Submit correction
  const handleSubmitCorrection = async () => {
    if (!selectedId || !detail?.review) return;
    setSubmittingCorr(true);
    const refs = sourceRefs.split('\n').filter(Boolean);
    const res = await submitCorrection({
      conversationId: selectedId,
      reviewId: detail.review.reviewed_at,
      correctAnswer,
      sourceRefs: refs,
      correctionType,
    });
    if (res.code === 0) {
      openDetail(selectedId);
    } else {
      alert(res.msg || '提交失败');
    }
    setSubmittingCorr(false);
  };

  // Approve/Reject
  const handleApprove = async (correctionId: string) => {
    const res = await approveCorrection(correctionId);
    if (res.code === 0) openDetail(selectedId!);
  };
  const handleReject = async (correctionId: string) => {
    const reason = prompt('驳回原因:');
    if (!reason) return;
    const res = await rejectCorrection(correctionId, reason);
    if (res.code === 0) openDetail(selectedId!);
  };

  const toggleErrorTag = (tag: string) => {
    setErrorTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  };

  const canReview = adminUser?.role !== 'cs';
  const canCorrect = canReview && ['needs_improvement', 'wrong'].includes(overall);

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-0">
      {/* Left: List */}
      <div className={`flex flex-col border-r border-[var(--border)] ${selectedId ? 'w-96' : 'flex-1'}`}>
        {/* Filters */}
        <div className="flex flex-wrap gap-2 border-b border-[var(--border)] p-3">
          {[
            { k: 'model', opts: MODELS },
            { k: 'reviewStatus', opts: STATUSES },
            { k: 'overall', opts: QUALITIES },
          ].map((g) => (
            <select
              key={g.k}
              value={filters[g.k] || '全部'}
              onChange={(e) => {
                setFilters((f) => ({ ...f, [g.k]: e.target.value }));
                setPage(1);
              }}
              className="rounded border border-[var(--border)] bg-[var(--card)] px-2 py-1 text-xs"
            >
              {g.opts.map((o) => (
                <option key={o} value={o}>
                  {o === '全部' ? (g.k === 'model' ? '模型' : g.k === 'reviewStatus' ? '状态' : '质量') : o}
                </option>
              ))}
            </select>
          ))}
          <button
            onClick={() => {
              setFilters({ model: '全部', reviewStatus: '全部', overall: '全部' });
              setPage(1);
            }}
            className="rounded border border-[var(--border)] px-2 py-1 text-xs hover:bg-[var(--accent)]"
          >
            <Search className="inline h-3 w-3 mr-1" />
            清除
          </button>
          <button
            onClick={() => loadList(page)}
            className="rounded border border-[var(--border)] px-2 py-1 text-xs hover:bg-[var(--accent)]"
          >
            <RefreshCw className="inline h-3 w-3 mr-1" />
            刷新
          </button>
        </div>

        {/* Summary */}
        <div className="px-3 py-2 text-xs text-[var(--muted-foreground)]">
          {total}条对话 · {list.filter((l) => l.review_status !== 'unreviewed').length}条已标记
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="py-8 text-center text-sm text-[var(--muted-foreground)]">加载中...</div>
          ) : list.length === 0 ? (
            <div className="py-8 text-center text-sm text-[var(--muted-foreground)]">暂无对话</div>
          ) : (
            list.map((item) => (
              <div
                key={item._id}
                onClick={() => openDetail(item._id)}
                className={`cursor-pointer border-b border-[var(--border)] p-3 transition-colors hover:bg-[var(--accent)] ${selectedId === item._id ? 'bg-[var(--accent)]' : ''}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-[var(--muted-foreground)] font-mono">
                    {new Date(item.timestamp).toLocaleString('zh-CN', {
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded ${item.review_status === 'corrected' ? 'bg-green-950 text-green-400' : item.review_status === 'reviewed' ? 'bg-blue-950 text-blue-400' : 'text-[var(--muted-foreground)]'}`}
                  >
                    {item.review_status === 'corrected'
                      ? '已纠正'
                      : item.review_status === 'reviewed'
                        ? OVERALL_LABELS[item.overall_rating || ''] || '已标记'
                        : '未标记'}
                  </span>
                </div>
                <div className="text-sm truncate">{item.query_preview}</div>
                <div className="flex items-center gap-2 mt-1 text-xs text-[var(--muted-foreground)]">
                  <span>{item._openid_prefix}***</span>
                  <span>·</span>
                  <span>{item.model}</span>
                  {item.path_label && (
                    <>
                      <span>·</span>
                      <span>{item.path_label}</span>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pagination */}
        {total > 20 && (
          <div className="flex items-center justify-between border-t border-[var(--border)] p-3 text-xs">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="rounded border border-[var(--border)] px-2 py-1 disabled:opacity-30"
            >
              <ChevronLeft className="h-3 w-3" />
            </button>
            <span className="text-[var(--muted-foreground)]">
              {page} / {Math.ceil(total / 20)}
            </span>
            <button
              disabled={page >= Math.ceil(total / 20)}
              onClick={() => setPage((p) => p + 1)}
              className="rounded border border-[var(--border)] px-2 py-1 disabled:opacity-30"
            >
              <ChevronRight className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>

      {/* Right: Detail */}
      {selectedId && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {detailLoading ? (
            <div className="flex items-center justify-center h-full text-sm text-[var(--muted-foreground)]">
              加载中...
            </div>
          ) : detail ? (
            <div className="flex h-full">
              {/* Conversation */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <button
                    onClick={closeDetail}
                    className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                  >
                    <ChevronLeft className="inline h-3 w-3" /> 返回列表
                  </button>
                  <span className="text-xs text-[var(--muted-foreground)]">
                    {detail._openid_prefix}*** · {detail.path_label} ·{' '}
                    {new Date(detail.timestamp).toLocaleString('zh-CN')}
                  </span>
                </div>
                {detail.is_test_data && (
                  <div className="rounded bg-yellow-950/50 px-3 py-1.5 text-xs text-yellow-400">⚠️ 测试数据</div>
                )}
                {detail.messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`rounded-lg p-3 ${msg.role === 'user' ? 'bg-[var(--muted)] ml-8' : 'bg-[var(--card)] border border-[var(--border)] mr-8'}`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold text-[var(--muted-foreground)]">
                        {msg.role === 'user' ? <MessageSquare className="inline h-3 w-3" /> : '🤖'}{' '}
                        {msg.role === 'user' ? '用户' : 'AI'}
                      </span>
                      {msg.tokens > 0 && (
                        <span className="text-xs text-[var(--muted-foreground)]">{msg.tokens} tokens</span>
                      )}
                    </div>
                    <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
                    {msg.source_chunks && msg.source_chunks.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-[var(--border)]">
                        <div className="text-xs text-[var(--muted-foreground)] mb-1">引用来源:</div>
                        {msg.source_chunks.map((sc, j) => (
                          <div key={j} className="text-xs text-[var(--primary)] ml-2">
                            · {sc.title}
                          </div>
                        ))}
                      </div>
                    )}
                    {msg.source_chunks === null && msg.role === 'assistant' && (
                      <div className="mt-1 text-xs text-[var(--muted-foreground)] italic">RAG来源未记录</div>
                    )}
                    {msg.safety_triggered && msg.safety_triggered.length > 0 && (
                      <div className="mt-2 text-xs text-red-400">🚨 安全触发: {msg.safety_triggered.join(', ')}</div>
                    )}
                  </div>
                ))}
              </div>

              {/* Review Panel */}
              <div className="w-80 border-l border-[var(--border)] overflow-y-auto p-4 space-y-4">
                <h3 className="text-sm font-semibold">质量标记</h3>

                {/* Score sliders */}
                {(['accuracy', 'completeness', 'compliance', 'usefulness'] as const).map((dim) => (
                  <div key={dim}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-[var(--muted-foreground)]">
                        {
                          { accuracy: '准确性', completeness: '完整性', compliance: '合规性', usefulness: '有用性' }[
                            dim
                          ]
                        }
                      </span>
                      <span className="font-semibold">{scores[dim]}/5</span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={5}
                      value={scores[dim]}
                      onChange={(e) => setScores((s) => ({ ...s, [dim]: Number(e.target.value) }))}
                      disabled={!canReview || !!detail.review}
                      className="w-full h-1.5 rounded-full appearance-none bg-[var(--muted)] cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[var(--primary)]"
                    />
                  </div>
                ))}

                <div className="text-xs text-right text-[var(--muted-foreground)]">
                  总分: {Object.values(scores).reduce((a, b) => a + b, 0)}/20
                </div>

                {/* Overall */}
                <div>
                  <div className="text-xs text-[var(--muted-foreground)] mb-1">综合标记</div>
                  <div className="flex gap-1">
                    {Object.entries(OVERALL_LABELS).map(([k, v]) => (
                      <button
                        key={k}
                        onClick={() => setOverall(k)}
                        disabled={!canReview || !!detail.review}
                        className={`flex-1 rounded px-2 py-1 text-xs transition-colors ${overall === k ? 'bg-[var(--primary)] text-white' : 'border border-[var(--border)] hover:bg-[var(--accent)]'}`}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Error tags */}
                <div>
                  <div className="text-xs text-[var(--muted-foreground)] mb-1">错误类型</div>
                  <div className="flex flex-wrap gap-1">
                    {ERROR_TAGS.map((tag) => (
                      <button
                        key={tag}
                        onClick={() => toggleErrorTag(tag)}
                        disabled={!canReview || !!detail.review}
                        className={`rounded px-2 py-0.5 text-xs transition-colors ${errorTags.includes(tag) ? 'bg-[var(--primary)] text-white' : 'border border-[var(--border)] hover:bg-[var(--accent)]'}`}
                      >
                        {
                          {
                            factual_error: '事实错误',
                            outdated_policy: '政策过时',
                            rag_mismatch: 'RAG引用错误',
                            compliance_breach: '合规风险',
                            incomplete_answer: '回答不完整',
                          }[tag]
                        }
                      </button>
                    ))}
                  </div>
                </div>

                {/* Note */}
                <div>
                  <div className="text-xs text-[var(--muted-foreground)] mb-1">备注</div>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    maxLength={500}
                    disabled={!canReview || !!detail.review}
                    placeholder="标记原因..."
                    className="w-full rounded border border-[var(--border)] bg-[var(--card)] p-2 text-xs resize-none h-16"
                  />
                </div>

                {!detail.review && canReview && (
                  <button
                    onClick={handleSubmitReview}
                    disabled={submitting}
                    className="w-full rounded bg-[var(--primary)] px-3 py-2 text-sm text-white hover:opacity-90 disabled:opacity-50"
                  >
                    {submitting ? '提交中...' : '提交标记'}
                  </button>
                )}
                {detail.review && (
                  <div className="rounded bg-[var(--muted)] p-3 text-xs space-y-1">
                    <div className="text-[var(--muted-foreground)]">
                      已由 {detail.review.reviewer} 标记为{' '}
                      {OVERALL_LABELS[detail.review.overall] || detail.review.overall}
                    </div>
                    {detail.review.note && <div>"{detail.review.note}"</div>}
                  </div>
                )}

                {/* Correction section */}
                {canCorrect && !detail.correction && (
                  <div className="border-t border-[var(--border)] pt-4 space-y-3">
                    <h3 className="text-sm font-semibold">补充正确答案</h3>
                    <textarea
                      value={correctAnswer}
                      onChange={(e) => setCorrectAnswer(e.target.value)}
                      maxLength={2000}
                      placeholder="输入正确答案..."
                      className="w-full rounded border border-[var(--border)] bg-[var(--card)] p-2 text-xs resize-none h-24"
                    />
                    <select
                      value={correctionType}
                      onChange={(e) => setCorrectionType(e.target.value)}
                      className="w-full rounded border border-[var(--border)] bg-[var(--card)] px-2 py-1 text-xs"
                    >
                      <option value="factual_correction">事实修正</option>
                      <option value="supplementary">补充说明</option>
                      <option value="compliance_fix">合规修正</option>
                    </select>
                    <textarea
                      value={sourceRefs}
                      onChange={(e) => setSourceRefs(e.target.value)}
                      placeholder="来源引用(每行一个)"
                      className="w-full rounded border border-[var(--border)] bg-[var(--card)] p-2 text-xs resize-none h-12"
                    />
                    <button
                      onClick={handleSubmitCorrection}
                      disabled={submittingCorr || !correctAnswer.trim()}
                      className="w-full rounded bg-[var(--primary)] px-3 py-2 text-sm text-white hover:opacity-90 disabled:opacity-50"
                    >
                      {submittingCorr ? '提交中...' : '提交审核'}
                    </button>
                  </div>
                )}

                {/* Existing correction with approve/reject */}
                {detail.correction && (
                  <div className="border-t border-[var(--border)] pt-4 space-y-2">
                    <h3 className="text-sm font-semibold">正确答案</h3>
                    <div className="rounded bg-[var(--muted)] p-3 text-xs space-y-2">
                      <div className="text-[var(--muted-foreground)]">
                        状态: {{ pending: '待审核', approved: '已采纳', rejected: '已驳回' }[detail.correction.status]}
                      </div>
                      <div className="whitespace-pre-wrap">{detail.correction.correct_answer}</div>
                      {detail.correction.source_refs.length > 0 && (
                        <div className="text-[var(--muted-foreground)]">
                          来源: {detail.correction.source_refs.join(', ')}
                        </div>
                      )}
                    </div>
                    {detail.correction.status === 'pending' && canApprove && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleApprove(detail.correction!.submitted_at)}
                          className="flex-1 rounded bg-green-700 px-3 py-1.5 text-xs text-white hover:bg-green-600"
                        >
                          采纳
                        </button>
                        <button
                          onClick={() => handleReject(detail.correction!.submitted_at)}
                          className="flex-1 rounded bg-red-700 px-3 py-1.5 text-xs text-white hover:bg-red-600"
                        >
                          驳回
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-sm text-[var(--muted-foreground)]">
              加载失败
            </div>
          )}
        </div>
      )}
    </div>
  );
}
