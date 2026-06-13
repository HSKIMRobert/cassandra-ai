"use client";

import { useState, useEffect } from "react";
import { Calendar, User, AlertTriangle, Send, Loader2, Sparkles, Share2, Copy, Eye } from "lucide-react";

const STOCK_ELEMENTS: Record<string, { name: string; element: string; desc: string }> = {
    NVDA: { name:"엔비디아", element:"metal", desc:"AI 반도체·GPU — 금(金) 기운" },
    AAPL: { name:"애플", element:"metal", desc:"하드웨어·디자인 — 금(金) 기운" },
    TSLA: { name:"테슬라", element:"fire", desc:"전기차·에너지 — 화(火) 기운" },
    MSFT: { name:"마이크로소프트", element:"water", desc:"클라우드·소프트웨어 — 수(水) 기운" },
    AMZN: { name:"아마존", element:"water", desc:"이커머스·물류 — 수(水) 기운" },
    META: { name:"메타", element:"fire", desc:"SNS·메타버스 — 화(火) 기운" },
    GOOGL: { name:"구글", element:"water", desc:"검색·AI — 수(水) 기운" },
    AMD: { name:"AMD", element:"metal", desc:"반도체 — 금(金) 기운" },
    INTC: { name:"인텔", element:"metal", desc:"반도체 — 금(金) 기운" },
    MU: { name:"마이크론", element:"earth", desc:"메모리 반도체 — 토(土) 기운" },
    NFLX: { name:"넷플릭스", element:"fire", desc:"스트리밍 — 화(火) 기운" },
    PLTR: { name:"팔란티어", element:"water", desc:"빅데이터·AI — 수(水) 기운" },
    COIN: { name:"코인베이스", element:"fire", desc:"암호화폐 — 화(火) 기운" },
    TSM: { name:"TSMC", element:"earth", desc:"반도체 위탁생산 — 토(土) 기운" },
    ASML: { name:"ASML", element:"metal", desc:"반도체 장비 — 금(金) 기운" },
    "005930": { name:"삼성전자", element:"metal", desc:"반도체·가전 — 금(金) 기운" },
    "000660": { name:"SK하이닉스", element:"earth", desc:"메모리 반도체 — 토(土) 기운" },
    "035420": { name:"NAVER", element:"water", desc:"인터넷·AI — 수(水) 기운" },
    "035720": { name:"카카오", element:"fire", desc:"메신저·콘텐츠 — 화(火) 기운" },
    "051910": { name:"LG화학", element:"fire", desc:"배터리·화학 — 화(火) 기운" },
};

// 이름 → 티커 역매핑
const NAME_TO_TICKER: Record<string, string> = {};
Object.entries(STOCK_ELEMENTS).forEach(([ticker, v]) => {
    NAME_TO_TICKER[v.name] = ticker;
});

const ELEMENT_MATCH: Record<string, string> = {
    "wood-wood":"🌳 비화 — 안정적 동행", "wood-fire":"🌳🔥 상생 — 성장 에너지",
    "wood-earth":"🌳⛰️ 상극 — 인내 필요", "wood-metal":"🌳⚒️ 피극 — 손절 필수",
    "wood-water":"🌳💧 상생 — 안정적", "fire-wood":"🔥🌳 피극 — 조심",
    "fire-fire":"🔥 비화 — 단기 기회", "fire-earth":"🔥⛰️ 상생 — 비옥",
    "fire-metal":"🔥⚒️ 상극 — 변곡점", "fire-water":"🔥💧 피극 — 방어적",
    "earth-wood":"⛰️🌳 피극", "earth-fire":"⛰️🔥 상생 — 기초",
    "earth-earth":"⛰️ 비화 — 가치주", "earth-metal":"⛰️⚒️ 상생 — 수익",
    "earth-water":"⛰️💧 피극 — 유동성", "metal-wood":"⚒️🌳 상극 — 결단",
    "metal-fire":"⚒️🔥 피극 — 조정기", "metal-earth":"⚒️⛰️ 상생 — 누적",
    "metal-metal":"⚒️ 비화 — 경쟁", "metal-water":"⚒️💧 상생 — 현금화",
    "water-wood":"💧🌳 상생 — 성장", "water-fire":"💧🔥 상극 — 하락 경계",
    "water-earth":"💧⛰️ 피극 — 돌파", "water-metal":"💧⚒️ 피극 — 혼란",
    "water-water":"💧 비화 — 트렌드 추종",
};

function makeRefCode(nickname: string): string {
    return nickname.replace(/[^a-zA-Z0-9가-힣]/g, "").slice(0, 8).toUpperCase() || "USER";
}

export default function SajuPage() {
    const [birthDate, setBirthDate] = useState("1990-01-01");
    const [birthHour, setBirthHour] = useState<number | null>(null);
    const [gender, setGender] = useState("");
    const [nickname, setNickname] = useState("");
    const [agreed, setAgreed] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [stockQuery, setStockQuery] = useState("");
    const [stockResult, setStockResult] = useState<{ stock: string; analysis: string } | null>(null);
    const [stockHistory, setStockHistory] = useState<{ stock: string; analysis: string }[]>([]);
    const [queryCount, setQueryCount] = useState(0);
    const [maxQueries, setMaxQueries] = useState(3);
    const [inviteCode, setInviteCode] = useState("");
    const [inviteInput, setInviteInput] = useState("");
    const [inviteBonus, setInviteBonus] = useState(false);
    const [visitors, setVisitors] = useState({ today: 0, total: 0 });
    const [copied, setCopied] = useState(false);
    const [nickDup, setNickDup] = useState("");
    const [refStats, setRefStats] = useState<{ total: number; daily: number } | null>(null);

    useEffect(() => {
        // localStorage 캐싱
        const cached = localStorage.getItem("saju-profile");
        if (cached) {
            try {
                const p = JSON.parse(cached);
                if (p.birthDate) setBirthDate(p.birthDate);
                if (p.birthHour !== undefined) setBirthHour(p.birthHour);
                if (p.gender) setGender(p.gender);
                if (p.nickname) { setNickname(p.nickname); setInviteCode(makeRefCode(p.nickname)); }
                setAgreed(true);
            } catch {}
        }
        const hist = localStorage.getItem("saju-stock-history");
        if (hist) { try { setStockHistory(JSON.parse(hist)); } catch {} }

        // 하루 질문 횟수 + 초대 보너스
        const todayKey = `saju-quota-${new Date().toISOString().slice(0,10)}`;
        const cnt = parseInt(localStorage.getItem(todayKey) || "0");
        setQueryCount(cnt);
        const bonus = localStorage.getItem("saju-invite-bonus");
        if (bonus === "true") { setMaxQueries(6); setInviteBonus(true); }

        // URL에서 추천인 코드 파싱 + 기록
        const urlParams = new URLSearchParams(window.location.search);
        const ref = urlParams.get("ref");
        if (ref) {
            setInviteInput(ref.toUpperCase());
            applyInviteCode(ref.toUpperCase());
            // 레퍼럴 기록
            fetch("/api/referral", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ refCode: ref.toUpperCase() }) }).catch(() => {});
            // 레퍼럴 통계 조회
            fetch(`/api/referral?refCode=${encodeURIComponent(ref.toUpperCase())}`).then(r => r.json()).then(d => {
                if (d.total !== undefined) setRefStats(d);
            }).catch(() => {});
        }

        // 방문자 카운터
        fetch("/api/pageview", { method: "POST", body: JSON.stringify({ path: "/saju" }) }).catch(() => {});
        fetch("/api/pageview?path=/saju").then(r => r.json()).then(d => {
            setVisitors({ today: d.today || 0, total: d.total || 0 });
        }).catch(() => {});
    }, []);

    const applyInviteCode = (code: string) => {
        if (!code.trim()) return;
        const uc = code.trim().toUpperCase();
        localStorage.setItem("saju-invite-bonus", "true");
        localStorage.setItem("saju-inviter", uc);
        setMaxQueries(6);
        setInviteBonus(true);
        setInviteInput(uc);
        // 레퍼럴 기록
        fetch("/api/referral", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ refCode: uc }) }).catch(() => {});
        fetch(`/api/referral?refCode=${encodeURIComponent(uc)}`).then(r => r.json()).then(d => {
            if (d.total !== undefined) setRefStats(d);
        }).catch(() => {});
    };

    const hours = Array.from({ length: 24 }, (_, i) => i);
    const hourLabels: Record<number, string> = {
        0:"자시(23-01)",1:"축시(01-03)",3:"인시(03-05)",5:"묘시(05-07)",
        7:"진시(07-09)",9:"사시(09-11)",11:"오시(11-13)",13:"미시(13-15)",
        15:"신시(15-17)",17:"유시(17-19)",19:"술시(19-21)",21:"해시(21-23)"
    };

    const submitSaju = async () => {
        if (!agreed) { setError("위험 고지에 동의해주세요."); return; }
        if (nickname.trim().length < 2) { setNickDup("닉네임은 2자 이상 입력해주세요."); return; }
        setLoading(true); setError(""); setNickDup("");
        try {
            const res = await fetch("/api/saju", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ birthDate, birthHour, gender, nickname: nickname.trim() }),
            });
            const data = await res.json();
            if (data.error) { setError(data.error); return; }
            setResult(data);
            setInviteCode(makeRefCode(nickname.trim()));
            localStorage.setItem("saju-profile", JSON.stringify({ birthDate, birthHour, gender, nickname: nickname.trim() }));
        } catch { setError("서버 오류가 발생했습니다."); }
        finally { setLoading(false); }
    };

    const findStock = (query: string) => {
        const upper = query.toUpperCase().trim();
        // 티커 우선
        if (STOCK_ELEMENTS[upper]) return { ticker: upper, ...STOCK_ELEMENTS[upper] };
        // 이름 검색
        const byName = NAME_TO_TICKER[query.trim()];
        if (byName) return { ticker: byName, ...STOCK_ELEMENTS[byName] };
        return null;
    };

    const askStock = (e: React.FormEvent) => {
        e.preventDefault();
        if (!stockQuery.trim() || !result) return;

        // 하루 3개 제한 체크
        const todayKey = `saju-quota-${new Date().toISOString().slice(0,10)}`;
        const cnt = parseInt(localStorage.getItem(todayKey) || "0");
        if (cnt >= maxQueries) {
            setStockResult({ stock: "제한", analysis: `오늘 질문 가능 횟수(${maxQueries}회)를 모두 사용했습니다.\n\n친구 초대로 +3회 추가 가능! 아래 초대 링크를 공유해보세요.` });
            return;
        }

        const stock = findStock(stockQuery);
        if (!stock) { setStockResult({ stock: stockQuery, analysis: "해당 종목의 오행 데이터가 아직 준비되지 않았습니다. (코스피200·나스닥100 한정)\n예: NVDA, TSLA, 삼성전자, SK하이닉스" }); return; }

        const myEl = result.profile.element;
        const key = `${myEl}-${stock.element}`;
        const match = ELEMENT_MATCH[key] || "중립적인 상호작용";

        const advice = result.today.relation?.includes("재성")
            ? "오늘 재물운이 좋은 날입니다. 단기 매매 타이밍으로 적합합니다."
            : result.today.relation?.includes("관성")
            ? "관성의 날 — 압박이 있을 수 있으니 방어적 접근을 추천합니다."
            : "중립적인 흐름입니다. 장기적 관점에서 접근하세요.";

        const analysis = `${stock.name}(${stock.ticker}) — ${stock.desc}\n\n사주 궁합: ${match}\n\n${advice}\n\n※ 장기: ${result.today.relation?.includes("재성") ? "3-6개월 보유 추천" : result.today.relation?.includes("관성") ? "1개월 내 단기 대응" : "분할 매수 접근"}`;

        setStockResult({ stock: stock.ticker, analysis });
        setStockQuery("");

        const newCnt = cnt + 1;
        localStorage.setItem(todayKey, String(newCnt));
        setQueryCount(newCnt);

        const newHist = [{ stock: stock.ticker, analysis }, ...stockHistory].slice(0, 10);
        setStockHistory(newHist);
        localStorage.setItem("saju-stock-history", JSON.stringify(newHist));
    };

    const shareText = `🔮 사주로 보는 주식 궁합 — 무료!\n\n사주 팔자로 나스닥·코스닥 종목과의 궁합을 분석해드립니다.\n\n내 사주와 맞는 종목은?\n👉 https://dart-monitor-pi.vercel.app/saju?ref=${inviteCode}`;
    const handleCopy = () => { navigator.clipboard.writeText(shareText); setCopied(true); setTimeout(() => setCopied(false), 2000); };

    const fortuneKeys = ["재물운","사업운","학업운","연애운","건강운"];
    const fortuneColors = ["#f59e0b","#22c55e","#6c5ce7","#ec4899","#3b82f6"];
    const elMap: any = { wood:"🌳", fire:"🔥", earth:"⛰️", metal:"⚒️", water:"💧" };

    return (
        <div className="max-w-3xl mx-auto space-y-6 py-6 px-4">
            {/* 헤더 */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">🔮 사주로 보는 주식 궁합</h1>
                    <p className="text-xs text-[var(--text-muted)] mt-1">사주 기반 나스닥·코스닥 종목 궁합 분석</p>
                </div>
                <div className="text-right">
                    <div className="flex items-center gap-1 text-[10px] text-[var(--text-muted)] justify-end">
                        <Eye className="w-3 h-3" /> 오늘 {visitors.today}명
                    </div>
                    <div className="text-[10px] text-[var(--text-muted)]">누적 {visitors.total}명</div>
                </div>
            </div>

            {/* 입력 폼 */}
            <div className="rounded-xl bg-[var(--surface)] border border-[var(--border)] p-4 space-y-3">
                <h2 className="text-sm font-bold flex items-center gap-2"><Calendar className="w-4 h-4" /> 사주 정보 입력</h2>

                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="text-[10px] text-[var(--text-muted)]">생년월일</label>
                        <input type="date" value={birthDate} onChange={e => setBirthDate(e.target.value)}
                            className="w-full mt-1 px-3 py-1.5 rounded bg-[var(--bg)] border border-[var(--border)] text-xs" />
                    </div>
                    <div>
                        <label className="text-[10px] text-[var(--text-muted)]">태어난 시간 (선택)</label>
                        <select value={birthHour ?? ""} onChange={e => setBirthHour(e.target.value ? Number(e.target.value) : null)}
                            className="w-full mt-1 px-3 py-1.5 rounded bg-[var(--bg)] border border-[var(--border)] text-xs">
                            <option value="">모름</option>
                            {hours.map(h => (
                                <option key={h} value={h}>{h}시 {hourLabels[h] ? `(${hourLabels[h]})` : ""}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="text-[10px] text-[var(--text-muted)]">성별</label>
                        <select value={gender} onChange={e => setGender(e.target.value)}
                            className="w-full mt-1 px-3 py-1.5 rounded bg-[var(--bg)] border border-[var(--border)] text-xs">
                            <option value="">선택</option>
                            <option value="male">남성</option>
                            <option value="female">여성</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-[10px] text-[var(--text-muted)]">닉네임 * (중복불가)</label>
                        <input type="text" value={nickname} onChange={e => { setNickname(e.target.value); setNickDup(""); }}
                            placeholder="홍길동" className="w-full mt-1 px-3 py-1.5 rounded bg-[var(--bg)] border border-[var(--border)] text-xs" />
                        {nickDup && <p className="text-[#ef4444] text-[9px] mt-0.5">{nickDup}</p>}
                    </div>
                </div>

                {/* 추천인 코드 */}
                <div>
                    <label className="text-[10px] text-[var(--text-muted)]">추천인 코드 (선택)</label>
                    <div className="flex gap-2 mt-1">
                        <input type="text" value={inviteInput} onChange={e => setInviteInput(e.target.value)}
                            placeholder="친구 코드 입력" className="flex-1 px-3 py-1.5 rounded bg-[var(--bg)] border border-[var(--border)] text-xs" />
                        <button onClick={() => applyInviteCode(inviteInput)}
                            className="px-3 py-1.5 rounded bg-[#22c55e]/20 text-[#22c55e] text-xs hover:bg-[#22c55e]/30">
                            적용
                        </button>
                    </div>
                    {inviteBonus && <p className="text-[#22c55e] text-[9px] mt-0.5">추천인 적용 완료! 오늘 질문 {maxQueries}회 가능</p>}
                </div>

                <label className="flex items-start gap-2 text-[10px] text-[var(--text-muted)] cursor-pointer">
                    <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} className="mt-0.5" />
                    <span>주의: 사주의 통변을 다 적용한 것이 아니며, 취미와 재미로 살펴보시기 바랍니다. 사주 기반 주식 투자는 과학·퀀트 영역이 아니며 리스크가 큽니다. 본 서비스는 결과에 대해 책임지지 않습니다.</span>
                </label>

                <button onClick={submitSaju} disabled={loading}
                    className="w-full py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium disabled:opacity-50">
                    {loading ? <span className="flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> 분석 중...</span> : "🔮 사주 분석하기"}
                </button>
                {error && <p className="text-[#ef4444] text-[10px]">{error}</p>}
            </div>

            {/* 사주 결과 */}
            {result && (
                <div className="rounded-xl bg-[var(--surface)] border border-[var(--border)] p-4 space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="w-14 h-14 rounded-full bg-[var(--accent)]/20 flex items-center justify-center text-3xl">
                            {elMap[result.profile.element]}
                        </div>
                        <div>
                            <h3 className="font-bold text-xl">{result.profile.ilju}</h3>
                            <p className="text-xs text-[var(--text-muted)]">
                                {result.profile.elementKr} · {result.profile.polarity} · {result.nickname || "사용자"}님
                            </p>
                        </div>
                        <div className="ml-auto text-right">
                            <div className="text-xs text-[var(--text-muted)]">오늘의 일진</div>
                            <div className="font-bold text-base">{result.today.ilju}</div>
                            <div className="text-xs text-[var(--accent-glow)]">{result.today.relation}</div>
                        </div>
                    </div>

                    {/* 5운 — 폰트 확대 */}
                    <div className="grid grid-cols-5 gap-2">
                        {fortuneKeys.map((key, i) => (
                            <div key={key} className="text-center rounded bg-[var(--bg)] p-3">
                                <div className="text-xl">{["💰","📈","📚","💕","💪"][i]}</div>
                                <div className="text-xs font-bold mt-1" style={{ color: fortuneColors[i] }}>{key}</div>
                                <div className="text-lg font-bold mt-1">{result.fortune?.[key] ?? "-"}<span className="text-[10px] text-[var(--text-muted)]">점</span></div>
                            </div>
                        ))}
                    </div>

                    <div className="text-sm text-[var(--text-muted)] space-y-1 bg-[var(--bg)] rounded p-3">
                        <p><Sparkles className="w-4 h-4 inline" /> {result.summary?.header}</p>
                        <p>⚠ {result.summary?.caution}</p>
                        <p>📌 {result.summary?.investFocus}</p>
                    </div>

                    {/* 주식 채팅 */}
                    <div className="border-t border-[var(--border)] pt-3">
                        <h4 className="text-xs font-semibold mb-2">
                            💬 종목 사주 궁합 물어보기
                            <span className="text-[10px] text-[var(--text-muted)] ml-1">
                                (오늘 {queryCount}/{maxQueries}회)
                            </span>
                        </h4>
                        {queryCount < maxQueries ? (
                            <form onSubmit={askStock} className="flex gap-2">
                                <input type="text" value={stockQuery} onChange={e => setStockQuery(e.target.value)}
                                    placeholder="티커 또는 종목명 (예: NVDA, 테슬라, 삼성전자, SK하이닉스)"
                                    className="flex-1 px-3 py-2 rounded bg-[var(--bg)] border border-[var(--border)] text-sm" />
                                <button type="submit" className="px-4 py-2 rounded bg-[var(--accent)] text-white text-sm"><Send className="w-4 h-4" /></button>
                            </form>
                        ) : (
                            <p className="text-xs text-[var(--warning)]">오늘 질문 횟수를 모두 사용했습니다. 친구 초대로 +3회 추가하세요!</p>
                        )}
                        {stockResult && (
                            <div className="mt-2 p-3 rounded bg-[var(--bg)] text-xs whitespace-pre-wrap leading-relaxed">{stockResult.analysis}</div>
                        )}
                        {stockHistory.length > 0 && (
                            <div className="mt-2">
                                <div className="text-[10px] text-[var(--text-muted)] mb-1">이전 질문</div>
                                {stockHistory.slice(0, 5).map((h, i) => (
                                    <div key={i} className="text-[10px] text-[var(--text-muted)] py-0.5 border-b border-[var(--border)] last:border-0">
                                        <button onClick={() => setStockResult(h)} className="hover:text-[var(--text)] text-left">
                                            {h.stock} — {h.analysis.slice(0, 50)}...
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* 친구 초대 + 후킹 */}
                    {inviteCode && (
                        <div className="border-t border-[var(--border)] pt-3">
                            <h4 className="text-xs font-semibold flex items-center gap-1 mb-2"><Share2 className="w-3 h-3" /> 친구 초대 (+3회 보너스)</h4>
                            <div className="bg-[var(--bg)] rounded p-2 text-[10px] text-left font-mono whitespace-pre-wrap mb-2 text-[var(--text-muted)]">{shareText}</div>
                            <div className="flex gap-2">
                                <button onClick={handleCopy} className="flex-1 py-1.5 rounded bg-[var(--accent)] text-white text-xs">
                                    {copied ? "✅ 복사 완료!" : <span className="flex items-center justify-center gap-1"><Copy className="w-3 h-3" /> 초대 메시지 복사</span>}
                                </button>
                            </div>
                            <p className="text-[9px] text-[var(--text-muted)] mt-1 text-center">추천인 코드: <strong className="text-[var(--accent-glow)]">{inviteCode}</strong></p>
                            {refStats && (
                                <p className="text-[9px] text-[var(--text-muted)] text-center">
                                    📊 오늘 {refStats.daily}명 · 누적 {refStats.total}명 유입
                                </p>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* 리스크 고지 */}
            <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-[10px] text-[var(--text-muted)] space-y-1">
                <p className="flex items-center gap-1"><AlertTriangle className="w-3 h-3 text-[var(--warning)]" /> <strong>리스크 고지</strong></p>
                <p>사주를 기반으로 한 주식 투자는 과학과 통계, 퀀트의 영역이 아니며 리스크가 매우 큽니다. 모든 투자는 반드시 투자 전문가와 상의하여 결정하시기 바랍니다. 본 서비스는 투자 결과에 대해 어떠한 책임도 지지 않습니다.</p>
            </div>
        </div>
    );
}
