import { NextRequest, NextResponse } from "next/server";
import { buildDeepGraph, getPersonTimeline } from "@/lib/graph-queries";
import { prisma } from "@/lib/prisma";
import { getCache, setCache } from "@/lib/redis-cache";

const DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions";

async function callDeepSeek(prompt: string, systemPrompt: string): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("DEEPSEEK_API_KEY 환경변수 없음");
  const res = await fetch(DEEPSEEK_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: "deepseek-chat", messages: [{ role: "system", content: systemPrompt }, { role: "user", content: prompt }], max_tokens: 2048, temperature: 0.3 }),
  });
  if (!res.ok) throw new Error(`DeepSeek API 오류: ${res.status}`);
  const json = await res.json();
  return json.choices?.[0]?.message?.content ?? "";
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { query, depth = 2 } = body as { query: string; depth?: number };
    if (!query || query.trim().length < 2) return NextResponse.json({ error: "검색어 필요" }, { status: 400 });

    const cacheKey = `cluster-analysis:${query}:${depth}`;
    const cachedEntry = await getCache(cacheKey);
    if (cachedEntry) return NextResponse.json({ analysis: cachedEntry.data, cached: true });

    const graphData = await buildDeepGraph(query.trim(), Math.min(depth, 3));
    const corpNodes = graphData.nodes.filter(n => n.data.type === "corp");
    const signalsByCorpName: Record<string, string[]> = {};

    const sortedCorpNodes = [...corpNodes].sort((a, b) => (b.data.flags?.length ?? 0) - (a.data.flags?.length ?? 0));
    for (const cn of sortedCorpNodes.slice(0, 30)) {
      const corpId = cn.data.id.replace("corp-", "");
      const signals = await prisma.signal.findMany({ where: { corpId }, orderBy: { firedAt: "desc" }, take: 5, select: { ruleName: true, score: true, firedAt: true, detail: true } });
      if (signals.length > 0) signalsByCorpName[cn.data.label] = signals.map(s => `${s.ruleName}(점수:${s.score.toFixed(0)}) ${s.firedAt.toISOString().slice(0,10)}`);
    }

    const personNodes = graphData.nodes.filter(n => n.data.type === "person");
    const personTimelines: Record<string, string> = {};
    const sortedPersonNodes = [...personNodes].sort((a, b) => (b.data.flags?.length ?? 0) - (a.data.flags?.length ?? 0));
    for (const pn of sortedPersonNodes.slice(0, 15)) {
      const personId = pn.data.id.replace("person-", "");
      try {
        const timeline = await getPersonTimeline(personId);
        if (timeline.length > 0) personTimelines[pn.data.label] = timeline.map(t => `${t.companyName}(${t.role}) ${t.since ?? "?"} ~ ${t.until ?? "현재"}`).join(", ");
      } catch { /* ignore */ }
    }

    const nodesSummary = {
      corps: corpNodes.map(n => n.data.label).join(", ") || "없음",
      persons: personNodes.map(n => n.data.label).join(", ") || "없음",
      funds: graphData.nodes.filter(n => n.data.type === "fund").map(n => n.data.label).join(", ") || "없음",
      auditors: graphData.nodes.filter(n => n.data.type === "auditor").map(n => n.data.label).join(", ") || "없음",
    };

    const edgesSummary = graphData.edges.slice(0, 20).map(e => {
      const src = graphData.nodes.find(n => n.data.id === e.data.source)?.data.label ?? e.data.source;
      const tgt = graphData.nodes.find(n => n.data.id === e.data.target)?.data.label ?? e.data.target;
      const extras = [e.data.since ? `from ${e.data.since}` : "", e.data.until ? `~${e.data.until}` : "", e.data.amount ? `${(e.data.amount / 1e8).toFixed(1)}억` : "", e.data.pct ? `${e.data.pct.toFixed(1)}%` : ""].filter(Boolean).join(" ");
      return `${src} →[${e.data.label}]→ ${tgt}${extras ? " (" + extras + ")" : ""}`;
    }).join("\n");

    const signalStr = Object.entries(signalsByCorpName).map(([corp, sigs]) => `[${corp}] ${sigs.join(" / ")}`).join("\n") || "감지된 시그널 없음";
    const timelineStr = Object.entries(personTimelines).map(([name, hist]) => `[${name}] ${hist}`).join("\n") || "이력 데이터 없음";

    const systemPrompt = `당신은 한국 주식 시장 불공정거래·작전세력 분석 전문가입니다. DART 공시 데이터, 관계망 분석, CB(전환사채) 패턴을 기반으로 작전세력 구도를 식별합니다. 분석 결과는 한국어로 명확하게 작성하고, 확인되지 않은 사실은 "의심" 또는 "주의"로 표기합니다. 응답은 다음 형식으로 구성하세요: 1. 관계망 요약 2. 위험 시그널 분석 3. 작전 패턴 의심 여부 4. 핵심 인물/법인 역할 5. 투자 주의 사항`;

    const userPrompt = `검색어: "${query}" (${depth}hop 관계망 분석)\n\n## 노드 현황\n- 연결 기업(${corpNodes.length}): ${nodesSummary.corps}\n- 연결 인물(${personNodes.length}): ${nodesSummary.persons}\n- 연결 법인/조합(${graphData.nodes.filter(n => n.data.type === "fund").length}): ${nodesSummary.funds}\n- 감사인(${graphData.nodes.filter(n => n.data.type === "auditor").length}): ${nodesSummary.auditors}\n\n## 관계망 엣지\n${edgesSummary}\n\n## 위험 시그널\n${signalStr}\n\n## 인물 이력 타임라인\n${timelineStr}`;

    const analysis = await callDeepSeek(userPrompt, systemPrompt);
    await setCache(cacheKey, analysis, 30 * 60);

    return NextResponse.json({ analysis, cached: false, meta: { query, depth, nodeCount: graphData.stats?.totalNodes ?? 0, edgeCount: graphData.stats?.totalEdges ?? 0, signalCorpCount: Object.keys(signalsByCorpName).length } });
  } catch (err: any) {
    console.error("[analyze-cluster] 오류:", err);
    return NextResponse.json({ error: err.message ?? "분석 실패" }, { status: 500 });
  }
}
