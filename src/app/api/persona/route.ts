/**
 * 페르소나 투자 분석 API — 실시간 주가 데이터 기반 분석 + Redis
 * 한국인 인기주식 프리캐싱 (첫 요청 시 자동)
 */
import { NextRequest, NextResponse } from "next/server";
import { getCache, setCache } from "@/lib/redis-cache";

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)";

interface PersonaConfig {
    name: string; title: string; avatar: string; color: string;
    style: string; quote: string;
    analyze(price: number, changePct: number, name: string, ticker: string, stockType: StockType): { score: number; summary: string; action: string };
}

type StockType = "normal" | "leveraged" | "inverse" | "etf" | "defensive" | "tech";

function classifyStock(ticker: string, name: string): StockType {
    const t = ticker.toUpperCase();
    const n = name;
    // 레버리지 ETF
    if (["SOXL","TQQQ","SOXS","SQQQ","NVDL","TSLL","AMDL","FNGU","BULZ","SPXL","TECL","UPRO","UDOW","LABU","NAIL","YINN","YANG","CURE","DFEN","UTSL","RETL","WANT","TPOR","BNKU","KORU"].includes(t)) return "leveraged";
    // 인버스
    if (t.includes("S") && (t.includes("QQQ") || t.includes("SPX") || t.includes("DOW"))) return "inverse";
    if (["SH","SDS","SPXU","SQQQ","TZA","FAZ","ERY","SCO","DUG","SEF"].includes(t)) return "inverse";
    // 방어 ETF/주식
    if (["SCHD","JEPI","JEPQ","DIVO","XLP","XLU","XLV","GLD","TLT","IEF","BND","AGG","LQD","TIP","DIA"].includes(t)) return "defensive";
    // 일반 ETF
    if (["QQQ","SPY","IWM","VTI","VOO","ARKK","SMH","SOXX","XLK","XLF","XLE","XLI","XLY","XLB","XLC","XLRE","VGT","VUG"].includes(t)) return "etf";
    // 기술주
    if (["NVDA","TSLA","PLTR","AMD","MSFT","META","GOOGL","AAPL","AMZN","ARM","SNOW","COIN","SOFI","RBLX","NET","CRWD","DDOG","SHOP","SQ","UBER"].includes(t)) return "tech";
    return "normal";
}

const PERSONAS: Record<string, PersonaConfig> = {
    buffett: {
        name: "워런 버핏", title: "가치 투자의 대가", avatar: "👴", color: "#22c55e",
        style: "장기 가치 투자, 경제적 해자, 저평가 우량주",
        quote: "\"남들이 욕심낼 때 두려워하고, 남들이 두려워할 때 욕심내라\"",
        analyze(p, ch, n, t, type) {
            if (type === "leveraged") return { score: 15, summary: `⚠️ ${n}은(는) 3배 레버리지 ETF입니다. 버핏은 파생상품을 "대량살상무기"라고 불렀으며, 레버리지는 가치 투자의 반대 개념입니다. 장기 보유 시 횡보장에서 가치가 소멸되므로 절대 비추천합니다. QQQ나 SPY 같은 현물 ETF를 고려하세요.`, action: "SELL" };
            if (type === "inverse") return { score: 10, summary: `${n}은 인버스 ETF로, 시장 하락에 베팅하는 상품입니다. 버핏은 "미국에 베팅하지 말라"고 했습니다. 공매도와 인버스는 가치 투자 철학과 정면으로 배치됩니다. 절대 비추천합니다.`, action: "SELL" };

            const absCh = Math.abs(ch);
            if (ch < -5) return { score: 78, summary: `큰 폭 하락으로 ${n}의 내재가치 대비 저평가 구간에 진입했습니다. 버핏이라면 "공포에 사라"는 원칙대로 분할 매수에 들어갈 시점입니다. PER과 PBR 지표를 확인하고, 현금흐름이 견조하다면 장기 보유 전략을 추천합니다.`, action: "BUY" };
            if (ch < -2) return { score: 68, summary: `조정 국면에서 ${n}은 가치 투자 관점에서 매력적인 가격대로 접근 중입니다. 경제적 해자가 있는 기업이라면 3-5년 보유 관점에서 분할 매수를 고려하세요. 단기 변동성에 흔들리지 마세요.`, action: "BUY" };
            if (ch > 10) return { score: 35, summary: `과열 구간입니다. ${n}의 현재 주가는 내재가치를 크게 상회할 가능성이 높습니다. 버핏은 "남들이 욕심낼 때 두려워하라"고 했습니다. 차익 실현을 고려할 시점입니다.`, action: "SELL" };
            if (ch > 5) return { score: 45, summary: `상승세지만 ${n}의 PER이 역사적 평균을 상회할 수 있습니다. 가치 투자자라면 추가 매수보다는 보유하며 기다리는 전략이 적합합니다. 배당 수익률과 자사주 매입 여부를 확인하세요.`, action: "HOLD" };
            return { score: 62, summary: `${n}은 안정적인 비즈니스 모델을 갖춘 기업입니다. 현재 밸류에이션은 적정 수준으로, 버핏의 "영원히 보유할 주식" 리스트에 오를 자격이 있습니다. 분할 매수로 포트폴리오에 편입하세요.`, action: "BUY" };
        }
    },
    wood: {
        name: "캐시 우드", title: "혁신 기술의 선구자", avatar: "👩‍💼", color: "#a855f7",
        style: "파괴적 혁신, AI·로보틱스·유전체·핀테크 집중",
        quote: "\"혁신은 디플레이션의 가장 강력한 힘입니다\"",
        analyze(p, ch, n, t, type) {
            if (type === "leveraged") return { score: 40, summary: `${n}은 레버리지 ETF로, 우드의 혁신 투자 철학과도 일부 부합할 수 있으나, 그녀는 개별 혁신 기업의 장기 성장에 베팅합니다. 3배 레버리지는 단기 트레이딩 도구일 뿐입니다. ARKK나 개별 기술주를 대신 고려하세요.`, action: "SELL" };
            if (type === "inverse") return { score: 20, summary: `인버스 ETF는 혁신의 반대 방향입니다. 우드는 인류의 진보와 기술 혁신에 베팅합니다. 시장 하락에 베팅하는 인버스 상품은 그녀의 투자 철학과 완전히 반대됩니다.`, action: "SELL" };
            const techTickers = ["NVDA","TSLA","PLTR","AMD","MSFT","META","GOOGL","AMZN","AAPL","ARM","SNOW","COIN","SOFI","RBLX"];
            const isTech = techTickers.includes(t) || t.startsWith("00");
            const absCh = Math.abs(ch);
            if (ch < -10) return { score: isTech ? 75 : 55, summary: `급락은 혁신 기업에게 오히려 기회입니다. ${n}의 기술력과 특허 포트폴리오는 변하지 않았습니다. 우드는 이런 급락장에서 "5년 후를 보고 산다"며 공격적 매수에 나섭니다. 다만 비중은 포트폴리오의 5% 이내로 제한하세요.`, action: isTech ? "BUY" : "HOLD" };
            if (ch < -5) return { score: isTech ? 68 : 52, summary: `${n}의 단기 조정은 혁신 사이클의 자연스러운 과정입니다. 기술 로드맵과 R&D 투자가 견조하다면, 우드의 "파괴적 혁신" 관점에서 매수 기회로 볼 수 있습니다.`, action: isTech ? "BUY" : "HOLD" };
            if (ch > 15) return { score: 80, summary: `${n}의 폭발적 상승은 혁신 기술이 시장에서 인정받고 있다는 신호입니다. 캐시 우드는 이런 모멘텀을 "5년 후 세상을 바꿀 기술"의 초기 신호로 해석합니다. 추가 상승 여력이 있지만, 일부 차익 실현도 고려하세요.`, action: "BUY" };
            if (ch > 5) return { score: 70, summary: `${n}의 상승세는 혁신의 S-커브 초기 단계를 보여줍니다. ARK의 분석 프레임워크로 보면, 아직 전체 시장 침투율이 낮아 장기 성장 여력이 충분합니다.`, action: "BUY" };
            return { score: isTech ? 65 : 50, summary: `${n}은(는) 우드의 관심 종목입니다. 기술적 우위와 시장 선점 효과를 고려할 때, 혁신 포트폴리오의 일부로 편입을 검토할 만합니다. 변동성을 감안해 분할 매수하세요.`, action: isTech ? "BUY" : "HOLD" };
        }
    },
    dalio: {
        name: "레이 달리오", title: "올웨더 전략가", avatar: "🧓", color: "#f59e0b",
        style: "거시경제 사이클, 리스크 패리티, 글로벌 자산배분",
        quote: "\"고통 + 성찰 = 진보\"",
        analyze(p, ch, n, t, type) {
            if (type === "leveraged") return { score: 25, summary: `레버리지 ETF ${n}은 리스크 패리티 전략과 정반대입니다. 달리오는 "변동성을 평준화하라"고 조언합니다. 3배 레버리지는 포트폴리오의 변동성을 극단적으로 높이므로 올웨더 전략에 부적합합니다.`, action: "SELL" };
            if (type === "inverse") return { score: 20, summary: `인버스 ETF는 지속적 하락을 전제로 합니다. 달리오의 올웨더 전략은 모든 경제 환경에서 살아남는 포트폴리오를 추구합니다. 단기 방향성 베팅은 그의 철학과 맞지 않습니다.`, action: "SELL" };
            const defenseTickers = ["SCHD","JEPI","XLP","XLU","XLV","GLD"];
            const isDefense = defenseTickers.includes(t);
            const absCh = Math.abs(ch);

            // 변동성 기반 리스크 평가
            const isHighVol = absCh > 8;
            const isRecovering = ch < -3;

            if (isRecovering) return { score: 65, summary: `하락장에서 ${n}은 리스크 패리티 관점에서 포트폴리오 다각화 기회를 제공합니다. 달리오의 올웨더 전략은 "모든 환경에서 살아남는" 자산 배분을 추구합니다. 현재 비중을 5-10%로 제한하고, 방어주·채권·금과 함께 배분하세요.`, action: "BUY" };
            if (isHighVol) return { score: 42, summary: `${n}의 높은 변동성은 거시경제 불확실성의 신호입니다. 달리오라면 현금 비중을 늘리고, 금·국채 등 안전자산으로 헤지할 것을 권장합니다. "현금은 쓰레기가 아니다"라는 그의 조언을 기억하세요.`, action: "SELL" };
            if (isDefense && ch > 0) return { score: 72, summary: `${n}은 인플레이션 헤지와 경기 방어적 특성을 동시에 갖춘 자산입니다. 달리오의 "All Weather" 포트폴리오에서 핵심 구성 요소로 적합합니다. 장기 보유로 안정적 수익을 기대할 수 있습니다.`, action: "BUY" };
            if (ch > 8) return { score: 48, summary: `${n}의 강한 상승은 시장 과열의 신호일 수 있습니다. 달리오의 "경제 머신" 모델로 보면, 현재 사이클 후반부의 특징입니다. 일부 차익 실현과 리밸런싱을 권장합니다.`, action: "HOLD" };
            return { score: 58, summary: `${n}은 거시경제 사이클에서 중립적 포지션입니다. 달리오의 조언대로 "다각화는 투자의 유일한 공짜 점심"입니다. 이 종목 하나에 집중하기보다 전체 포트폴리오 맥락에서 비중을 결정하세요.`, action: "HOLD" };
        }
    },
};

// Yahoo Finance 가격 조회
async function fetchPrice(ticker: string): Promise<{ price: number; changePct: number } | null> {
    try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?range=1d&interval=1d`;
        const res = await fetch(url, { headers: { "User-Agent": UA } });
        if (!res.ok) return null;
        const json = await res.json();
        const meta = json.chart?.result?.[0]?.meta;
        if (!meta) return null;
        const price = meta.regularMarketPrice || 0;
        const prev = meta.previousClose || meta.chartPreviousClose || price;
        return { price, changePct: prev ? ((price - prev) / prev) * 100 : 0 };
    } catch { return null; }
}

// 한국인 인기주식 (프리캐싱 대상)
const POPULAR_STOCKS = [
    // 한국
    { ticker: "005930.KS", name: "삼성전자" }, { ticker: "000660.KS", name: "SK하이닉스" },
    { ticker: "035420.KS", name: "NAVER" }, { ticker: "035720.KS", name: "카카오" },
    // 미국
    { ticker: "NVDA", name: "엔비디아" }, { ticker: "TSLA", name: "테슬라" },
    { ticker: "AAPL", name: "애플" }, { ticker: "MSFT", name: "MS" },
    { ticker: "META", name: "메타" }, { ticker: "PLTR", name: "팔란티어" },
    { ticker: "SOXL", name: "반도체3배" }, { ticker: "TQQQ", name: "나스닥3배" },
];

export async function GET(req: NextRequest) {
    const stock = req.nextUrl.searchParams.get("stock")?.toUpperCase();
    const name = req.nextUrl.searchParams.get("name") || stock;
    const persona = req.nextUrl.searchParams.get("persona") || "buffett";
    const preCache = req.nextUrl.searchParams.get("precache") === "true";

    if (!stock && !preCache) return NextResponse.json({ error: "stock required" }, { status: 400 });

    // ─── 프리캐싱 (한국인 인기주식 × 3페르소나) ───
    if (preCache) {
        const results: any[] = [];
        for (const s of POPULAR_STOCKS) {
            const quote = await fetchPrice(s.ticker);
            const p = quote?.price || 0;
            const ch = quote?.changePct || 0;
            for (const pid of Object.keys(PERSONAS)) {
                const per = PERSONAS[pid];
                const cacheKey = `persona:${s.ticker}:${pid}`;
                const r = { stock: s.ticker, name: s.name, ...per.analyze(p, ch, s.name, s.ticker, classifyStock(s.ticker, s.name)), generatedAt: new Date().toISOString() };
                await setCache(cacheKey, r);
                results.push({ ticker: s.ticker, persona: pid, score: r.score, cached: true });
            }
        }
        return NextResponse.json({ precached: results.length, stocks: POPULAR_STOCKS.length, personas: Object.keys(PERSONAS).length, results: results.slice(0, 12) });
    }

    // ─── 단일 종목 분석 ───
    const cacheKey = `persona:${stock}:${persona}`;
    const cached = await getCache(cacheKey);
    if (cached && !cached.stale) return NextResponse.json({ ...cached.data, fromCache: true });

    // 실시간 가격 조회
    const yahooTicker = stock!.includes(".") ? stock : /^\d+$/.test(stock) ? `${stock}.KS` : stock;
    const quote = await fetchPrice(yahooTicker);

    const p = PERSONAS[persona] || PERSONAS.buffett;
    const result = {
        stock: stock!, name: name || stock!,
        persona, personaName: p.name, personaTitle: p.title,
        personaAvatar: p.avatar, personaColor: p.color,
        personaStyle: p.style, personaQuote: p.quote,
        currentPrice: quote?.price || null,
        changePct: quote?.changePct || null,
        ...p.analyze(quote?.price || 0, quote?.changePct || 0, name || stock!, stock!, classifyStock(stock!, name || stock!)),
        generatedAt: new Date().toISOString(),
    };

    await setCache(cacheKey, result);
    return NextResponse.json(result);
}
