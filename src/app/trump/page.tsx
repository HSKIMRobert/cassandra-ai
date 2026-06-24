"use client";

import { useEffect, useState, useCallback } from "react";
import { RefreshCw, TrendingUp, TrendingDown, AlertTriangle, Minus, Zap, Globe, MessageSquare, BarChart2 } from "lucide-react";

// ─── 타입 ───
interface Pick {
  ticker: string;
  name: string;
  action: "STRONG_BUY" | "BUY" | "WATCH" | "SELL" | "STRONG_SELL";
  reason: string;
  confidence: number;
  sector: string;
  priceTarget: string;
}

interface Analysis {
  summary: string;
  mood: "강경" | "중립" | "완화" | "불확실";
  keyTopics: string[];
  marketImpact: string;
  picks: Pick[];
  riskFactors: string[];
  nextCatalyst: string;
}

interface TrumpData {
  generatedAt: string;
  truthPosts: { title: string; text: string; date: string; link: string }[];
  truthSource: string | null;
  newsItems: { title: string; text: string; date: string; source: string; link: string }[];
  analysis: Analysis;
  analysisError?: string | null;
  fromCache?: boolean;
  cachedSecondsAgo?: number;
  stale?: boolean;
  error?: string;
}

// ─── 스타일 헬퍼 ───
const ACTION_META: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  STRONG_BUY:  { label: "강력매수", color: "#22c55e", bg: "bg-[#22c55e]/15 border-[#22c55e]/40", icon: <TrendingUp className="w-3 h-3" /> },
  BUY:         { label: "매수",     color: "#86efac", bg: "bg-[#22c55e]/10 border-[#22c55e]/25", icon: <TrendingUp className="w-3 h-3" /> },
  WATCH:       { label: "관망",     color: "#f59e0b", bg: "bg-[#f59e0b]/10 border-[#f59e0b]/30", icon: <Minus className="w-3 h-3" /> },
  SELL:        { label: "매도",     color: "#f87171", bg: "bg-[#ef4444]/10 border-[#ef4444]/25", icon: <TrendingDown className="w-3 h-3" /> },
  STRONG_SELL: { label: "강력매도", color: "#ef4444", bg: "bg-[#ef4444]/15 border-[#ef4444]/40", icon: <TrendingDown className="w-3 h-3" /> },
};

const MOOD_META: Record<string, { label: string; color: string; emoji: string }> = {
  강경:   { label: "강경 (Aggressive)", color: "#ef4444", emoji: "🔥" },
  중립:   { label: "중립 (Neutral)",    color: "#f59e0b", emoji: "⚖️" },
  완화:   { label: "완화 (Dovish)",     color: "#22c55e", emoji: "🕊️" },
  불확실: { label: "불확실 (Unknown)",  color: "#6c5ce7", emoji: "❓" },
};

function ConfidenceBar({ value }: { value: number }) {
  const color = value >= 70 ? "#22c55e" : value >= 40 ? "#f59e0b" : "#ef4444";
  return (
    <div className="flex items-center gap-1.5 mt-1">
      <div className="flex-1 h-1.5 bg-[var(--bg)] rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${value}%`, background: color }} />
      </div>
      <span className="text-[9px] font-mono" style={{ color }}>{value}%</span>
    </div>
  );
}

function timeAgo(iso: string) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return "방금";
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}

export default function TrumpPage() {
  const [data, setData] = useState<TrumpData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<"picks" | "news" | "truth">("picks");

  const load = useCallback(async (force = false) => {
    if (force) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await fetch(`/api/trump${force ? "?refresh=1" : ""}`);
      const json = await res.json();
      setData(json);
    } catch {
      // keep previous
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const picks = data?.analysis?.picks ?? [];
  const analysis = data?.analysis;

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <main className="max-w-5xl mx-auto px-4 py-6 space-y-4">

        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              🇺🇸 <span>Trump Pick</span>
            </h1>
            <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
              트루스소셜 + 뉴스 → Claude AI 분석 → 영향 종목 BUY/SELL
            </p>
          </div>
          <div className="flex items-center gap-2">
            {data && (
              <span className="text-[10px] text-[var(--text-muted)]">
                {data.fromCache ? `캐시 ${data.cachedSecondsAgo ? Math.floor(data.cachedSecondsAgo / 60) + "분 전" : ""}` : "실시간"}
                {data.stale && " ⚠️ 오래된 캐시"}
                {" · 갱신: "}{timeAgo(data.generatedAt)}
              </span>
            )}
            <button
              onClick={() => load(true)}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#dc2626]/10 border border-[#dc2626]/30 text-[#dc2626] text-xs hover:bg-[#dc2626]/20 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${refreshing ? "animate-spin" : ""}`} />
              {refreshing ? "분석 중…" : "새로 분석"}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="rounded-xl bg-[var(--surface)] border border-[var(--border)] p-12 text-center">
            <div className="text-3xl mb-3 animate-pulse">🇺🇸</div>
            <p className="text-sm text-[var(--text-muted)]">트루스소셜 & 뉴스 수집 중… Claude가 분석 중입니다</p>
            <p className="text-[10px] text-[var(--text-muted)] mt-1">약 10~20초 소요</p>
          </div>
        ) : data?.error && !analysis ? (
          <div className="rounded-xl bg-[var(--surface)] border border-red-500/30 p-8 text-center">
            <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-2" />
            <p className="text-sm text-red-400">{data.error}</p>
          </div>
        ) : (
          <>
            {/* ─── API 키 오류 배너 ─── */}
            {data?.analysisError && (
              <div className="rounded-xl bg-[#f59e0b]/10 border border-[#f59e0b]/40 p-4 flex items-start gap-3">
                <AlertTriangle className="w-4 h-4 text-[#f59e0b] mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-[#f59e0b]">Claude 분석 실패</p>
                  <p className="text-[11px] text-[var(--text-muted)] mt-0.5">{data.analysisError}</p>
                  {data.analysisError.includes("ANTHROPIC_API_KEY") && (
                    <p className="text-[11px] text-[#f59e0b] mt-1">
                      Vercel 대시보드 → Settings → Environment Variables → <code className="bg-[#f59e0b]/20 px-1 rounded">ANTHROPIC_API_KEY</code> 추가 후 재배포
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* ─── 트럼프 무드 + 요약 ─── */}
            {analysis && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* 무드 카드 */}
                <div className="rounded-xl bg-[var(--surface)] border border-[var(--border)] p-4 flex flex-col items-center justify-center gap-1">
                  <div className="text-3xl">{MOOD_META[analysis.mood]?.emoji ?? "❓"}</div>
                  <div className="text-sm font-bold mt-1" style={{ color: MOOD_META[analysis.mood]?.color }}>
                    {MOOD_META[analysis.mood]?.label ?? analysis.mood}
                  </div>
                  <div className="text-[9px] text-[var(--text-muted)]">현재 트럼프 태도</div>
                </div>

                {/* 요약 */}
                <div className="sm:col-span-2 rounded-xl bg-[var(--surface)] border border-[var(--border)] p-4 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[var(--text-muted)]">
                    <Zap className="w-3.5 h-3.5 text-[#f59e0b]" /> AI 분석 요약
                  </div>
                  <p className="text-sm leading-relaxed">{analysis.summary}</p>
                  {/* 핵심 토픽 */}
                  {analysis.keyTopics?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {analysis.keyTopics.map((t, i) => (
                        <span key={i} className="px-2 py-0.5 rounded-full bg-[#dc2626]/10 border border-[#dc2626]/20 text-[#f87171] text-[10px]">
                          #{t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ─── 시장 영향 + 리스크 ─── */}
            {analysis && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-xl bg-[var(--surface)] border border-[var(--border)] p-4">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[var(--text-muted)] mb-2">
                    <BarChart2 className="w-3.5 h-3.5 text-[#6c5ce7]" /> 시장 전반 영향
                  </div>
                  <p className="text-sm leading-relaxed">{analysis.marketImpact}</p>
                  {analysis.nextCatalyst && (
                    <div className="mt-3 text-[11px] text-[#f59e0b] bg-[#f59e0b]/10 rounded-lg px-3 py-2">
                      📅 다음 이벤트: {analysis.nextCatalyst}
                    </div>
                  )}
                </div>
                <div className="rounded-xl bg-[var(--surface)] border border-[var(--border)] p-4">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[var(--text-muted)] mb-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-[#ef4444]" /> 리스크 요인
                  </div>
                  {analysis.riskFactors?.length > 0 ? (
                    <ul className="space-y-1.5">
                      {analysis.riskFactors.map((r, i) => (
                        <li key={i} className="text-[11px] text-[var(--text-muted)] flex items-start gap-1.5">
                          <span className="text-[#ef4444] mt-0.5">▸</span> {r}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-[11px] text-[var(--text-muted)]">데이터 부족</p>
                  )}
                </div>
              </div>
            )}

            {/* ─── 탭: 종목 픽 / 뉴스 / 트루스소셜 ─── */}
            <div className="rounded-xl bg-[var(--surface)] border border-[var(--border)] overflow-hidden">
              {/* 탭 헤더 */}
              <div className="flex border-b border-[var(--border)]">
                {[
                  { key: "picks", label: `📊 종목 픽 (${picks.length})`, },
                  { key: "news",  label: `📰 뉴스 (${data?.newsItems?.length ?? 0})` },
                  { key: "truth", label: `🦅 트루스소셜 (${data?.truthPosts?.length ?? 0})` },
                ].map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setTab(key as typeof tab)}
                    className={`px-4 py-3 text-xs font-semibold transition-colors border-b-2 ${
                      tab === key
                        ? "border-[#dc2626] text-[#f87171] bg-[#dc2626]/05"
                        : "border-transparent text-[var(--text-muted)] hover:text-[var(--text)]"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* ─── 종목 픽 탭 ─── */}
              {tab === "picks" && (
                <div className="p-4">
                  {picks.length === 0 ? (
                    <p className="text-sm text-[var(--text-muted)] text-center py-8">분석 데이터 없음</p>
                  ) : (
                    <>
                      {/* STRONG BUY / BUY 먼저 */}
                      {(["STRONG_BUY", "BUY", "WATCH", "SELL", "STRONG_SELL"] as const).map(action => {
                        const group = picks.filter(p => p.action === action);
                        if (!group.length) return null;
                        const meta = ACTION_META[action];
                        return (
                          <div key={action} className="mb-4">
                            <h3 className="text-[10px] font-bold mb-2 flex items-center gap-1.5" style={{ color: meta.color }}>
                              {meta.icon} {meta.label}
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {group.map((p, i) => (
                                <div key={i} className={`rounded-lg border p-3 ${meta.bg}`}>
                                  <div className="flex items-start justify-between gap-2">
                                    <div>
                                      <div className="flex items-center gap-1.5">
                                        <span className="font-bold text-sm font-mono" style={{ color: meta.color }}>{p.ticker}</span>
                                        <span className="text-[10px] text-[var(--text-muted)]">{p.name}</span>
                                      </div>
                                      <div className="text-[9px] text-[var(--text-muted)] mt-0.5">{p.sector}</div>
                                    </div>
                                    <div className="text-right shrink-0">
                                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold`} style={{ color: meta.color, background: `${meta.color}20` }}>
                                        {meta.label}
                                      </span>
                                      <div className="text-[9px] text-[var(--text-muted)] mt-1">{p.priceTarget}</div>
                                    </div>
                                  </div>
                                  <p className="text-[11px] text-[var(--text-muted)] mt-2 leading-relaxed">{p.reason}</p>
                                  <ConfidenceBar value={p.confidence} />
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                      <p className="text-[9px] text-[var(--text-muted)] mt-2">
                        ⚠️ AI 분석 참고용 — 투자 결정은 본인 판단으로. 신뢰도(Confidence)는 데이터 풍부도 기준.
                      </p>
                    </>
                  )}
                </div>
              )}

              {/* ─── 뉴스 탭 ─── */}
              {tab === "news" && (
                <div className="divide-y divide-[var(--border)]">
                  {(data?.newsItems ?? []).length === 0 ? (
                    <p className="text-sm text-[var(--text-muted)] text-center py-8">뉴스 없음</p>
                  ) : (
                    (data?.newsItems ?? []).map((n, i) => (
                      <div key={i} className="px-4 py-3 hover:bg-[var(--bg)] transition-colors">
                        <div className="flex items-start gap-2">
                          <Globe className="w-3.5 h-3.5 text-[var(--text-muted)] mt-0.5 shrink-0" />
                          <div className="min-w-0">
                            {n.link ? (
                              <a href={n.link} target="_blank" rel="noopener noreferrer"
                                className="text-xs font-semibold hover:text-[#f87171] transition-colors line-clamp-2">
                                {n.title}
                              </a>
                            ) : (
                              <p className="text-xs font-semibold">{n.title}</p>
                            )}
                            {n.text && <p className="text-[10px] text-[var(--text-muted)] mt-0.5 line-clamp-2">{n.text}</p>}
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[9px] text-[var(--text-muted)]">{timeAgo(n.date)}</span>
                              <span className="text-[9px] text-[#6c5ce7]">{n.source}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* ─── 트루스소셜 탭 ─── */}
              {tab === "truth" && (
                <div className="p-4">
                  {(data?.truthPosts ?? []).length === 0 ? (
                    <div className="text-center py-8">
                      <div className="text-2xl mb-2">🦅</div>
                      <p className="text-sm text-[var(--text-muted)]">트루스소셜 RSS 접근 불가</p>
                      <p className="text-[10px] text-[var(--text-muted)] mt-1">
                        서버 환경에서 truthsocial.com RSS 차단 중 — 뉴스 탭에서 트럼프 SNS 관련 내용 확인 가능
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="text-[10px] text-[var(--text-muted)] flex items-center gap-1.5">
                        <MessageSquare className="w-3 h-3" />
                        출처: {data?.truthSource}
                      </div>
                      {data?.truthPosts.map((p, i) => (
                        <div key={i} className="rounded-lg bg-[var(--bg)] border border-[var(--border)] p-3">
                          <div className="flex items-start gap-2">
                            <div className="w-7 h-7 rounded-full bg-[#dc2626]/20 flex items-center justify-center text-sm shrink-0">🇺🇸</div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-[#f87171]">Donald J. Trump</span>
                                <span className="text-[9px] text-[var(--text-muted)]">@realDonaldTrump</span>
                                <span className="text-[9px] text-[var(--text-muted)]">{timeAgo(p.date)}</span>
                              </div>
                              {p.title && <p className="text-xs font-semibold mt-1">{p.title}</p>}
                              {p.text && <p className="text-[11px] text-[var(--text-muted)] mt-0.5 leading-relaxed">{p.text}</p>}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 정보 출처 푸터 */}
            <p className="text-[9px] text-[var(--text-muted)] text-center pb-4">
              데이터 출처: Truth Social RSS · Google News RSS · Claude Haiku 분석 · 1시간 캐시
              {data?.fromCache && ` · 마지막 분석: ${new Date(data.generatedAt).toLocaleString("ko-KR")}`}
            </p>
          </>
        )}
      </main>
    </div>
  );
}
