"use client";

import { useEffect, useState, useCallback } from "react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import dynamic from "next/dynamic";
import {
  MessageSquare, Plus, X, Eye, Trash2, Send, Lock,
  FileSearch, AlertTriangle, Loader2, ChevronLeft, ChevronRight,
  CheckCircle2, Clock, BarChart2, Building2, User, ChevronDown, ChevronUp,
  FileText, TrendingUp,
} from "lucide-react";

const EntityGraph = dynamic(() => import("@/components/EntityGraph"), { ssr: false, loading: () => <div className="h-48 flex items-center justify-center text-xs text-[var(--text-muted)]"><Loader2 className="w-4 h-4 animate-spin mr-2" />그래프 로딩...</div> });

interface BoardPost {
  id: string; authorName: string; title: string; category: string;
  targetCorp: string | null; targetPerson: string | null;
  status: string; createdAt: string; content?: string;
  analysis?: string; reportPath?: string;
}

interface ReportData {
  targetName: string; targetType: string; stockCode?: string; market?: string;
  generatedAt: string;
  keyInfo?: { filingCount: number; signalCount: number; riskScore: number };
  disclosureStats?: Record<string, number>;
  officers?: { name: string; role: string; flags?: string[] }[];
  shareholders?: { name: string; pct: string }[];
  relatedCorps?: { personName: string; companyName: string; role: string }[];
  corpHistory?: { name: string; role: string; since?: string; until?: string; isCurrent: boolean; riskScore: number }[];
  signals?: { rule: string; score: number; date: string }[];
  aiAnalysis?: string;
}

const CATEGORY_LABELS: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  REPORT: { label: "제보", icon: <AlertTriangle className="w-3.5 h-3.5" />, color: "text-[var(--danger-glow)]" },
  ANALYSIS_REQUEST: { label: "분석 요청", icon: <FileSearch className="w-3.5 h-3.5" />, color: "text-[var(--accent-glow)]" },
  DISCUSSION: { label: "토론", icon: <MessageSquare className="w-3.5 h-3.5" />, color: "text-[var(--text-muted)]" },
};

const STATUS_BADGE: Record<string, { label: string; color: string }> = {
  PENDING: { label: "대기중", color: "text-[var(--text-muted)] bg-[var(--border)]" },
  PROCESSING: { label: "분석중", color: "text-[var(--warning)] bg-[var(--warning)]/10" },
  RESOLVED: { label: "분석완료", color: "text-[#00b894] bg-[#00b894]/10" },
  REVIEWED: { label: "검토완료", color: "text-[var(--accent-glow)] bg-[var(--accent)]/10" },
};

function ReportView({ post, preloadedData }: { post: BoardPost; preloadedData?: ReportData }) {
  const [report, setReport] = useState<ReportData | null>(preloadedData || null);
  const [loading, setLoading] = useState(false);
  const [showGraph, setShowGraph] = useState(false);
  const [graphData, setGraphData] = useState<any>(null);
  const [open, setOpen] = useState(!!preloadedData);
  const [aiOpen, setAiOpen] = useState(false);

  const target = post.targetCorp || post.targetPerson;

  const loadReport = useCallback(async () => {
    if (report || loading || !target) return;
    setLoading(true);
    try {
      const safe = target.replace(/[^가-힣a-zA-Z0-9]/g, "_");
      const res = await fetch(`/Dart_Data/reports/${safe}.json`);
      if (res.ok) { setReport(await res.json()); }
    } catch {}
    setLoading(false);
  }, [report, loading, target]);

  const loadGraph = useCallback(async () => {
    if (graphData || !target) return;
    try {
      const res = await fetch(`/api/graph?q=${encodeURIComponent(target)}&depth=2`);
      const d = await res.json();
      if (d.nodes?.length > 0) setGraphData(d);
    } catch {}
  }, [graphData, target]);

  const handleOpen = () => {
    const next = !open;
    setOpen(next);
    if (next) { loadReport(); loadGraph(); }
  };

  if (post.status !== "RESOLVED" || !target) {
    return (
      <div className="mt-3 p-3 rounded-lg bg-[var(--border)]/20 text-xs text-[var(--text-muted)] flex items-center gap-2">
        <Clock className="w-3.5 h-3.5" />
        {post.status === "PENDING" ? "배치 처리 대기중 (오전 6시/오후 3시/오후 9시 자동 분석)" : "분석 진행중..."}
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-2">
      <button onClick={handleOpen} className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-[#00b894]/10 border border-[#00b894]/30 hover:bg-[#00b894]/20 transition-colors">
        <span className="flex items-center gap-2 text-sm font-medium text-[#00b894]">
          <BarChart2 className="w-4 h-4" /> 보고서 보기
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-[#00b894]" /> : <ChevronDown className="w-4 h-4 text-[#00b894]" />}
      </button>

      {open && (
        <div className="space-y-3 p-3 rounded-xl bg-[var(--surface)] border border-[var(--border)]">
          {loading && <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]"><Loader2 className="w-3.5 h-3.5 animate-spin" /> 보고서 로딩 중...</div>}

          {report && (
            <>
              {/* 주요 정보 */}
              <div>
                <h4 className="text-xs font-bold text-[var(--text-muted)] uppercase mb-2 flex items-center gap-1.5"><BarChart2 className="w-3.5 h-3.5" /> 주요 정보</h4>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: "공시건수", value: report.keyInfo?.filingCount ?? "-" },
                    { label: "위험신호", value: report.keyInfo?.signalCount ?? "-" },
                    { label: "위험점수", value: report.keyInfo?.riskScore ?? "-" },
                  ].map(({ label, value }) => (
                    <div key={label} className="text-center p-2 rounded-lg bg-[var(--bg)] border border-[var(--border)]">
                      <div className="text-base font-bold text-[var(--accent-glow)]">{value}</div>
                      <div className="text-[9px] text-[var(--text-muted)]">{label}</div>
                    </div>
                  ))}
                </div>
                {report.disclosureStats && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {Object.entries(report.disclosureStats).map(([k, v]) => (
                      <span key={k} className="px-2 py-0.5 rounded text-[10px] bg-[var(--border)] text-[var(--text-muted)]">{k}: {v}건</span>
                    ))}
                  </div>
                )}
              </div>

              {/* 경영진 */}
              {(report.officers?.length ?? 0) > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-[var(--text-muted)] uppercase mb-2 flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> 경영진</h4>
                  <div className="grid grid-cols-2 gap-1">
                    {report.officers!.slice(0, 8).map((o, i) => (
                      <div key={i} className="flex items-center gap-1.5 p-1.5 rounded bg-[var(--bg)] text-xs">
                        <span className="px-1.5 py-0.5 rounded text-[9px] bg-[var(--person-color)]/10 text-[var(--person-color)] shrink-0">{o.role}</span>
                        <span className="font-medium truncate">{o.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 주요주주 */}
              {(report.shareholders?.length ?? 0) > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-[var(--text-muted)] uppercase mb-2">주요주주</h4>
                  <div className="space-y-1">
                    {report.shareholders!.slice(0, 5).map((s, i) => (
                      <div key={i} className="flex items-center justify-between text-xs p-1.5 rounded bg-[var(--bg)]">
                        <span>{s.name}</span>
                        <span className="text-[var(--accent-glow)] font-mono">{s.pct}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 과거 참여 기업 (인물용) */}
              {(report.corpHistory?.length ?? 0) > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-[var(--text-muted)] uppercase mb-2 flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5" /> 과거 참여 기업</h4>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {report.corpHistory!.map((c, i) => (
                      <div key={i} className="flex items-center justify-between text-xs p-1.5 rounded bg-[var(--bg)]">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${c.isCurrent ? "bg-[#00b894]" : "bg-[var(--text-muted)]"}`} />
                          <span className="font-medium truncate">{c.name}</span>
                          <span className="text-[9px] text-[var(--text-muted)] shrink-0">{c.role}</span>
                        </div>
                        {c.riskScore > 0 && <span className="text-[9px] text-[var(--danger-glow)] shrink-0">위험{c.riskScore}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 연관기업 이력 (법인용) */}
              {(report.relatedCorps?.length ?? 0) > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-[var(--text-muted)] uppercase mb-2 flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5" /> 경영진 연관기업 이력</h4>
                  <div className="space-y-1 max-h-36 overflow-y-auto">
                    {report.relatedCorps!.slice(0, 12).map((r, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs p-1.5 rounded bg-[var(--bg)]">
                        <span className="text-[var(--person-color)] font-medium shrink-0">{r.personName}</span>
                        <span className="text-[var(--text-muted)]">→</span>
                        <span className="truncate">{r.companyName}</span>
                        <span className="text-[9px] text-[var(--text-muted)] shrink-0">{r.role}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* AI 분석 */}
              {report.aiAnalysis && (
                <div>
                  <button onClick={() => setAiOpen(!aiOpen)} className="w-full flex items-center justify-between text-xs font-bold text-[var(--text-muted)] uppercase mb-1 hover:text-[var(--text)]">
                    <span>🤖 DeepSeek AI 분석</span>
                    {aiOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                  {aiOpen && (
                    <pre className="text-xs whitespace-pre-wrap font-mono leading-relaxed text-[var(--text)] max-h-80 overflow-y-auto p-3 rounded bg-[var(--bg)] border border-[var(--border)]">{report.aiAnalysis}</pre>
                  )}
                </div>
              )}
            </>
          )}

          {/* 관계망 그래프 */}
          <div>
            <button onClick={() => { setShowGraph(!showGraph); if (!showGraph) loadGraph(); }} className="w-full flex items-center justify-between text-xs font-bold text-[var(--text-muted)] uppercase mb-2 hover:text-[var(--text)]">
              <span className="flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5" /> 관계망 그래프</span>
              {showGraph ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
            {showGraph && (
              graphData ? (
                <div className="rounded-lg overflow-hidden border border-[var(--border)]">
                  <EntityGraph data={graphData} currentDepth={2} maxDepth={3} />
                </div>
              ) : (
                <div className="h-32 flex items-center justify-center text-xs text-[var(--text-muted)]">
                  <Loader2 className="w-4 h-4 animate-spin mr-2" /> 그래프 데이터 로딩...
                </div>
              )
            )}
          </div>

          {!report && !loading && (
            <div className="text-xs text-[var(--text-muted)] text-center py-2">
              보고서 파일 없음 — 다음 배치 분석 시 생성됩니다
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface BatchReport {
  id: string; targetName: string; targetType: string;
  reportPath: string | null; processedAt: string | null; createdAt: string;
}

function ReportListPanel() {
  const [reports, setReports] = useState<BatchReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<BatchReport | null>(null);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);

  useEffect(() => {
    fetch("/api/batch-reports")
      .then((r) => r.json())
      .then((d) => { setReports(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const openReport = async (r: BatchReport) => {
    if (!r.reportPath) return;
    setSelected(r);
    setReportData(null);
    setLoadingReport(true);
    try {
      const url = `https://raw.githubusercontent.com/gameworkerkim/cassandra-ai/main/${r.reportPath}`;
      const res = await fetch(url);
      const data = await res.json();
      setReportData(data);
    } catch { setReportData(null); }
    setLoadingReport(false);
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[var(--accent-glow)]" /></div>;
  if (reports.length === 0) return (
    <div className="text-center py-12 text-[var(--text-muted)] text-sm">
      <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
      아직 완성된 보고서가 없습니다.<br />
      <span className="text-[10px]">분석 요청 후 오전 6시 / 오후 3시 / 오후 9시 배치 처리 시 생성됩니다.</span>
    </div>
  );

  if (selected) return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button onClick={() => { setSelected(null); setReportData(null); }} className="text-xs text-[var(--accent-glow)] hover:underline flex items-center gap-1">
          ← 목록으로
        </button>
        <span className="text-sm font-bold">{selected.targetName} 보고서</span>
        <span className="text-[10px] text-[var(--text-muted)] ml-auto">
          {selected.processedAt ? format(new Date(selected.processedAt), "yyyy-MM-dd HH:mm", { locale: ko }) : ""}
        </span>
      </div>
      {loadingReport ? (
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-[var(--accent-glow)]" /></div>
      ) : reportData ? (
        <ReportView post={{ status: "RESOLVED", reportPath: selected.reportPath } as any} preloadedData={reportData} />
      ) : (
        <div className="text-center py-8 text-sm text-[var(--text-muted)]">보고서를 불러올 수 없습니다.</div>
      )}
    </div>
  );

  return (
    <div className="space-y-2">
      <p className="text-[11px] text-[var(--text-muted)]">총 {reports.length}개 보고서</p>
      {reports.map((r) => (
        <div key={r.id} className="flex items-center gap-3 p-3 rounded-lg bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--accent)]/50 transition-colors cursor-pointer" onClick={() => openReport(r)}>
          <span className="text-lg">{r.targetType === "PERSON" ? "👤" : "🏢"}</span>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{r.targetName}</div>
            <div className="text-[10px] text-[var(--text-muted)]">
              {r.processedAt ? format(new Date(r.processedAt), "yyyy-MM-dd HH:mm", { locale: ko }) + " 분석 완료" : "처리중"}
            </div>
          </div>
          <span className="text-[10px] px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 font-medium flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> 완료
          </span>
          <FileText className="w-4 h-4 text-[var(--text-muted)]" />
        </div>
      ))}
    </div>
  );
}

export default function BoardPage() {
  const [tab, setTab] = useState<"board" | "reports">("board");
  const [posts, setPosts] = useState<BoardPost[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [detailPost, setDetailPost] = useState<BoardPost | null>(null);
  const [deletePw, setDeletePw] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [form, setForm] = useState({ authorName: "", password: "", title: "", content: "", category: "REPORT", targetCorp: "", targetPerson: "" });

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page) });
    if (category) params.set("category", category);
    const res = await fetch(`/api/board?${params}`);
    const data = await res.json();
    setPosts(data.posts || []);
    setTotalPages(data.totalPages || 1);
    setLoading(false);
  }, [page, category]);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // 분석 요청이면 BatchJob도 등록
    if (form.category === "ANALYSIS_REQUEST" && (form.targetCorp || form.targetPerson)) {
      await fetch("/api/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetName: (form.targetCorp || form.targetPerson)?.trim(), targetType: form.targetCorp ? "CORP" : "PERSON" }),
      });
    }
    const res = await fetch("/api/board", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setShowForm(false);
      setForm({ authorName: "", password: "", title: "", content: "", category: "REPORT", targetCorp: "", targetPerson: "" });
      fetchPosts();
    }
  };

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/board/${id}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: deletePw }) });
    if (res.ok) { setDeleteTarget(null); setDeletePw(""); setDetailPost(null); fetchPosts(); }
    else { const err = await res.json(); alert(err.error || "삭제 실패"); }
  };

  const fetchDetail = async (id: string) => {
    const res = await fetch(`/api/board/${id}`);
    const data = await res.json();
    setDetailPost(data);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 bg-[var(--surface)] rounded-xl p-1 border border-[var(--border)]">
          <button onClick={() => setTab("board")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === "board" ? "bg-[var(--accent)] text-white" : "text-[var(--text-muted)] hover:text-[var(--text)]"}`}>
            <MessageSquare className="w-3.5 h-3.5" /> 게시판
          </button>
          <button onClick={() => setTab("reports")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === "reports" ? "bg-[var(--accent)] text-white" : "text-[var(--text-muted)] hover:text-[var(--text)]"}`}>
            <TrendingUp className="w-3.5 h-3.5" /> 보고서
          </button>
        </div>
        {tab === "board" && (
          <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90">
            {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}{showForm ? "닫기" : "글쓰기"}
          </button>
        )}
      </div>

      {tab === "reports" && <ReportListPanel />}
      {tab === "reports" && null /* 아래 board 내용은 렌더 안 함 */}
      {tab === "board" && (<>

      {showForm && (
        <form onSubmit={handleSubmit} className="p-4 rounded-xl bg-[var(--surface)] border border-[var(--border)] space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <input type="text" placeholder="닉네임" value={form.authorName} onChange={(e) => setForm({ ...form, authorName: e.target.value })} className="px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-sm text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]" />
            <input type="password" placeholder="비밀번호 *" value={form.password} required onChange={(e) => setForm({ ...form, password: e.target.value })} className="px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-sm text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]" />
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-sm text-[var(--text)] focus:outline-none focus:border-[var(--accent)]">
              <option value="REPORT">제보</option>
              <option value="ANALYSIS_REQUEST">분석 요청</option>
              <option value="DISCUSSION">토론</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input type="text" placeholder="대상 회사명 (선택)" value={form.targetCorp} onChange={(e) => setForm({ ...form, targetCorp: e.target.value })} className="px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-sm text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]" />
            <input type="text" placeholder="대상 인물명 (선택)" value={form.targetPerson} onChange={(e) => setForm({ ...form, targetPerson: e.target.value })} className="px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-sm text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]" />
          </div>
          <input type="text" placeholder="제목 *" value={form.title} required onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-sm text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]" />
          <textarea placeholder="내용을 입력하세요. 특정 기업·인물에 대한 제보, 분석 요청, 또는 공시 이상 패턴에 대한 의견을 자유롭게 작성해주세요." value={form.content} required rows={4} onChange={(e) => setForm({ ...form, content: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-sm text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] resize-y" />
          {form.category === "ANALYSIS_REQUEST" && (form.targetCorp || form.targetPerson) && (
            <div className="text-[10px] text-[var(--accent-glow)] bg-[var(--accent)]/5 border border-[var(--accent)]/20 rounded px-3 py-2">
              ⏰ 분석 요청이 배치 큐에 등록됩니다. 오전 6시 / 오후 3시 / 오후 9시 중 가장 가까운 시간에 자동 분석됩니다.
            </div>
          )}
          <div className="flex justify-between items-center">
            <p className="text-[10px] text-[var(--text-muted)]">※ 제보된 정보는 시스템 학습 데이터로 활용될 수 있습니다.</p>
            <button type="submit" className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90"><Send className="w-3.5 h-3.5" /> 등록</button>
          </div>
        </form>
      )}

      <div className="flex gap-2 flex-wrap">
        <button onClick={() => { setCategory(""); setPage(1); }} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${!category ? "bg-[var(--accent)] text-white" : "bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)]"}`}>전체</button>
        {Object.entries(CATEGORY_LABELS).map(([key, val]) => (
          <button key={key} onClick={() => { setCategory(key); setPage(1); }} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 ${category === key ? "bg-[var(--accent)] text-white" : "bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)]"}`}>
            {val.icon} {val.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[var(--accent-glow)]" /></div>
      ) : posts.length === 0 ? (
        <div className="text-center py-12 text-[var(--text-muted)] text-sm"><MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />아직 등록된 게시글이 없습니다.</div>
      ) : (
        <div className="space-y-1">
          {posts.map((post) => {
            const cat = CATEGORY_LABELS[post.category] || CATEGORY_LABELS.DISCUSSION;
            const sb = STATUS_BADGE[post.status] || STATUS_BADGE.PENDING;
            return (
              <div key={post.id} className="p-3 rounded-lg bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--accent)]/50 transition-colors cursor-pointer" onClick={() => fetchDetail(post.id)}>
                <div className="flex items-center gap-2">
                  <span className={`flex items-center gap-0.5 text-[10px] font-medium ${cat.color}`}>{cat.icon} {cat.label}</span>
                  {(post.targetCorp || post.targetPerson) && (
                    <span className="text-[10px] text-[var(--text-muted)] px-1.5 py-0.5 rounded bg-[var(--border)]">{[post.targetCorp, post.targetPerson].filter(Boolean).join(" · ")}</span>
                  )}
                  <span className={`ml-auto text-[9px] px-1.5 py-0.5 rounded font-medium ${sb.color}`}>
                    {post.status === "RESOLVED" ? <><CheckCircle2 className="w-2.5 h-2.5 inline mr-0.5" />{sb.label}</> : sb.label}
                  </span>
                </div>
                <p className="text-sm font-medium mt-1.5">{post.title}</p>
                <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{post.authorName} · {format(new Date(post.createdAt), "MM/dd HH:mm", { locale: ko })}</p>
              </div>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded-lg hover:bg-[var(--surface)] disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button>
          <span className="text-sm text-[var(--text-muted)]">{page} / {totalPages}</span>
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1.5 rounded-lg hover:bg-[var(--surface)] disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
        </div>
      )}

      {/* 상세 모달 */}
      {detailPost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setDetailPost(null)}>
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl bg-[var(--bg)] border border-[var(--border)] p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <span className={`flex items-center gap-1 text-xs font-medium ${CATEGORY_LABELS[detailPost.category]?.color}`}>
                {CATEGORY_LABELS[detailPost.category]?.icon} {CATEGORY_LABELS[detailPost.category]?.label}
              </span>
              <div className="flex items-center gap-2">
                {(() => { const sb = STATUS_BADGE[detailPost.status] || STATUS_BADGE.PENDING; return <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${sb.color}`}>{sb.label}</span>; })()}
                <button onClick={() => setDetailPost(null)} className="p-1 rounded hover:bg-[var(--surface)]"><X className="w-4 h-4" /></button>
              </div>
            </div>

            <h3 className="text-lg font-bold">{detailPost.title}</h3>
            <div className="flex gap-2 text-xs text-[var(--text-muted)]">
              <span>{detailPost.authorName}</span>
              <span>{format(new Date(detailPost.createdAt), "yyyy-MM-dd HH:mm", { locale: ko })}</span>
            </div>

            {(detailPost.targetCorp || detailPost.targetPerson) && (
              <div className="flex gap-2">
                {detailPost.targetCorp && <a href={`/corp/${encodeURIComponent(detailPost.targetCorp.replace(/\s*(분석해줘|분석해|분석요청|알려줘|조사해줘|이사진|주주|관계자|정보)\s*/g, "").replace(/\s*(을|를|의|에|과|와|이|가|은|는)\s*/g, "").trim().split(/\s+/)[0])}`} className="px-2 py-1 rounded text-xs bg-[var(--accent)]/10 text-[var(--accent-glow)] hover:underline">🏢 {detailPost.targetCorp}</a>}
                {detailPost.targetPerson && <span className="px-2 py-1 rounded text-xs bg-[var(--person-color)]/10 text-[var(--person-color)]">👤 {detailPost.targetPerson}</span>}
              </div>
            )}

            <div className="text-sm whitespace-pre-wrap leading-relaxed">{detailPost.content}</div>

            {/* 분석 결과 / 보고서 보기 */}
            <ReportView post={detailPost} />

            <div className="border-t border-[var(--border)] pt-3">
              {deleteTarget === detailPost.id ? (
                <div className="flex items-center gap-2">
                  <Lock className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                  <input type="password" placeholder="비밀번호" value={deletePw} onChange={(e) => setDeletePw(e.target.value)} className="flex-1 px-2 py-1 rounded text-sm bg-[var(--surface)] border border-[var(--border)] focus:outline-none focus:border-[var(--danger)]" onKeyDown={(e) => e.key === "Enter" && handleDelete(detailPost.id)} />
                  <button onClick={() => handleDelete(detailPost.id)} className="px-3 py-1 rounded text-xs bg-[var(--danger)] text-white">삭제</button>
                  <button onClick={() => { setDeleteTarget(null); setDeletePw(""); }} className="text-xs text-[var(--text-muted)]">취소</button>
                </div>
              ) : (
                <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(detailPost.id); }} className="flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--danger)] transition-colors">
                  <Trash2 className="w-3 h-3" /> 삭제
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      </>)}
    </div>
  );
}
