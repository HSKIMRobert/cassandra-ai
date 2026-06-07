"use client";

import { useEffect, useState, useCallback } from "react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import {
  MessageSquare, Plus, X, Eye, Trash2, Send, Lock,
  FileSearch, AlertTriangle, Loader2, ChevronLeft, ChevronRight,
} from "lucide-react";

interface BoardPost {
  id: string;
  authorName: string;
  title: string;
  category: string;
  targetCorp: string | null;
  targetPerson: string | null;
  status: string;
  createdAt: string;
  content?: string;
}

const CATEGORY_LABELS: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  REPORT: { label: "제보", icon: <AlertTriangle className="w-3.5 h-3.5" />, color: "text-[var(--danger-glow)]" },
  ANALYSIS_REQUEST: { label: "분석 요청", icon: <FileSearch className="w-3.5 h-3.5" />, color: "text-[var(--accent-glow)]" },
  DISCUSSION: { label: "토론", icon: <MessageSquare className="w-3.5 h-3.5" />, color: "text-[var(--text-muted)]" },
};

export default function BoardPage() {
  const [posts, setPosts] = useState<BoardPost[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [detailPost, setDetailPost] = useState<BoardPost | null>(null);
  const [deletePw, setDeletePw] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  // 폼 상태
  const [form, setForm] = useState({
    authorName: "",
    password: "",
    title: "",
    content: "",
    category: "REPORT",
    targetCorp: "",
    targetPerson: "",
  });

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page) });
    if (category) params.set("category", category);
    const res = await fetch(`/api/board?${params}`);
    const data = await res.json();
    setPosts(data.posts);
    setTotalPages(data.totalPages);
    setLoading(false);
  }, [page, category]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
    const res = await fetch(`/api/board/${id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: deletePw }),
    });
    if (res.ok) {
      setDeleteTarget(null);
      setDeletePw("");
      fetchPosts();
    } else {
      const err = await res.json();
      alert(err.error || "삭제 실패");
    }
  };

  const fetchDetail = async (id: string) => {
    const res = await fetch(`/api/board/${id}`);
    const data = await res.json();
    setDetailPost(data);
  };

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <MessageSquare className="w-5 h-5" /> 제보·분석요청 게시판
        </h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
        >
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showForm ? "닫기" : "글쓰기"}
        </button>
      </div>

      {/* 글쓰기 폼 */}
      {showForm && (
        <form onSubmit={handleSubmit} className="p-4 rounded-xl bg-[var(--surface)] border border-[var(--border)] space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <input
              type="text" placeholder="닉네임" value={form.authorName}
              onChange={(e) => setForm({ ...form, authorName: e.target.value })}
              className="px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-sm text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
            />
            <input
              type="password" placeholder="비밀번호 *" value={form.password} required
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-sm text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
            />
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-sm text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
            >
              <option value="REPORT">제보</option>
              <option value="ANALYSIS_REQUEST">분석 요청</option>
              <option value="DISCUSSION">토론</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input
              type="text" placeholder="대상 회사명 (선택)" value={form.targetCorp}
              onChange={(e) => setForm({ ...form, targetCorp: e.target.value })}
              className="px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-sm text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
            />
            <input
              type="text" placeholder="대상 인물명 (선택)" value={form.targetPerson}
              onChange={(e) => setForm({ ...form, targetPerson: e.target.value })}
              className="px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-sm text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
            />
          </div>
          <input
            type="text" placeholder="제목 *" value={form.title} required
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-sm text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
          />
          <textarea
            placeholder="내용을 입력하세요. 특정 기업·인물에 대한 제보, 분석 요청, 또는 공시 이상 패턴에 대한 의견을 자유롭게 작성해주세요."
            value={form.content} required rows={4}
            onChange={(e) => setForm({ ...form, content: e.target.value })}
            className="w-full px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-sm text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] resize-y"
          />
          <div className="flex justify-between items-center">
            <p className="text-[10px] text-[var(--text-muted)]">
              ※ 제보된 정보는 시스템 학습 데이터로 활용될 수 있습니다.
            </p>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90"
            >
              <Send className="w-3.5 h-3.5" /> 등록
            </button>
          </div>
        </form>
      )}

      {/* 카테고리 필터 */}
      <div className="flex gap-2">
        <button
          onClick={() => { setCategory(""); setPage(1); }}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            !category ? "bg-[var(--accent)] text-white" : "bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)]"
          }`}
        >
          전체
        </button>
        {Object.entries(CATEGORY_LABELS).map(([key, val]) => (
          <button
            key={key}
            onClick={() => { setCategory(key); setPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 ${
              category === key ? "bg-[var(--accent)] text-white" : "bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)]"
            }`}
          >
            {val.icon} {val.label}
          </button>
        ))}
      </div>

      {/* 게시글 목록 */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[var(--accent-glow)]" /></div>
      ) : posts.length === 0 ? (
        <div className="text-center py-12 text-[var(--text-muted)] text-sm">
          <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
          아직 등록된 게시글이 없습니다. 첫 제보를 남겨주세요.
        </div>
      ) : (
        <div className="space-y-1">
          {posts.map((post) => {
            const cat = CATEGORY_LABELS[post.category] || CATEGORY_LABELS.DISCUSSION;
            return (
              <div
                key={post.id}
                className="p-3 rounded-lg bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--accent)]/50 transition-colors cursor-pointer"
                onClick={() => fetchDetail(post.id)}
              >
                <div className="flex items-center gap-2">
                  <span className={`flex items-center gap-0.5 text-[10px] font-medium ${cat.color}`}>
                    {cat.icon} {cat.label}
                  </span>
                  {(post.targetCorp || post.targetPerson) && (
                    <span className="text-[10px] text-[var(--text-muted)] px-1.5 py-0.5 rounded bg-[var(--border)]">
                      {[post.targetCorp, post.targetPerson].filter(Boolean).join(" · ")}
                    </span>
                  )}
                  <span className="text-[10px] text-[var(--text-muted)] ml-auto">
                    {format(new Date(post.createdAt), "MM/dd HH:mm", { locale: ko })}
                  </span>
                </div>
                <p className="text-sm font-medium mt-1.5">{post.title}</p>
                <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{post.authorName}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="p-1.5 rounded-lg hover:bg-[var(--surface)] disabled:opacity-30"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm text-[var(--text-muted)]">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="p-1.5 rounded-lg hover:bg-[var(--surface)] disabled:opacity-30"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 상세 모달 */}
      {detailPost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setDetailPost(null)}>
          <div
            className="w-full max-w-lg max-h-[80vh] overflow-y-auto rounded-xl bg-[var(--bg)] border border-[var(--border)] p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <span className={`flex items-center gap-1 text-xs font-medium ${CATEGORY_LABELS[detailPost.category]?.color}`}>
                {CATEGORY_LABELS[detailPost.category]?.icon} {CATEGORY_LABELS[detailPost.category]?.label}
              </span>
              <button onClick={() => setDetailPost(null)} className="p-1 rounded hover:bg-[var(--surface)]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <h3 className="text-lg font-bold">{detailPost.title}</h3>
            <div className="flex gap-2 text-xs text-[var(--text-muted)]">
              <span>{detailPost.authorName}</span>
              <span>{format(new Date(detailPost.createdAt), "yyyy-MM-dd HH:mm", { locale: ko })}</span>
            </div>
            {(detailPost.targetCorp || detailPost.targetPerson) && (
              <div className="flex gap-2">
                {detailPost.targetCorp && (
                  <a href={`/corp/${detailPost.targetCorp}`} className="px-2 py-1 rounded text-xs bg-[var(--accent)]/10 text-[var(--accent-glow)] hover:underline">
                    🏢 {detailPost.targetCorp}
                  </a>
                )}
                {detailPost.targetPerson && (
                  <span className="px-2 py-1 rounded text-xs bg-[var(--person-color)]/10 text-[var(--person-color)]">
                    👤 {detailPost.targetPerson}
                  </span>
                )}
              </div>
            )}
            <div className="text-sm whitespace-pre-wrap leading-relaxed text-[var(--text)]">
              {detailPost.content}
            </div>

            {/* 삭제 */}
            <div className="border-t border-[var(--border)] pt-3">
              {deleteTarget === detailPost.id ? (
                <div className="flex items-center gap-2">
                  <Lock className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                  <input
                    type="password" placeholder="비밀번호"
                    value={deletePw}
                    onChange={(e) => setDeletePw(e.target.value)}
                    className="flex-1 px-2 py-1 rounded text-sm bg-[var(--surface)] border border-[var(--border)] focus:outline-none focus:border-[var(--danger)]"
                    onKeyDown={(e) => e.key === "Enter" && handleDelete(detailPost.id)}
                  />
                  <button
                    onClick={() => handleDelete(detailPost.id)}
                    className="px-3 py-1 rounded text-xs bg-[var(--danger)] text-white"
                  >
                    삭제
                  </button>
                  <button onClick={() => { setDeleteTarget(null); setDeletePw(""); }} className="text-xs text-[var(--text-muted)]">
                    취소
                  </button>
                </div>
              ) : (
                <button
                  onClick={(e) => { e.stopPropagation(); setDeleteTarget(detailPost.id); }}
                  className="flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--danger)] transition-colors"
                >
                  <Trash2 className="w-3 h-3" /> 삭제
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
