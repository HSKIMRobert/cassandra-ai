import { prisma } from "./prisma";
import fs from "fs";
import path from "path";

let dartCorps: { corp_code: string; name: string; stock_code: string }[] = [];
try {
  const p = path.join(process.cwd(), "data", "dart-corp-codes.json");
  if (fs.existsSync(p)) dartCorps = JSON.parse(fs.readFileSync(p, "utf-8"));
} catch {}

export interface GraphNode {
  data: {
    id: string; label: string; type: "corp" | "person" | "fund" | "auditor";
    corpCode?: string;                                    // ✅ corp 노드 라우팅용
    flags?: string[]; marketCap?: number; isAdmin?: boolean; delistedAt?: string;
    role?: string; hop?: number; firmType?: string; opinion?: string;
  };
}

export interface GraphEdge {
  data: {
    id: string; source: string; target: string; label: string;
    type: "person_corp" | "fund_corp" | "fund_person" | "filing_flow" | "audit_corp";
    since?: string; until?: string; amount?: number; pct?: number;
  };
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  filings?: { date: string; title: string; type: string }[];
  stats?: { totalNodes: number; totalEdges: number; personCount: number; corpCount: number; fundCount: number; auditorCount: number; maxHop: number; };
}

// ─── 노드 헬퍼 ───
function addCorpNode(nodes: Map<string, GraphNode>, corp: any, hop: number) {
  const id = `corp-${corp.id}`;
  if (!nodes.has(id)) nodes.set(id, { data: {
    id, label: corp.companyName, type: "corp",
    corpCode: corp.corpCode,                              // ✅ 라우팅용 corpCode 포함
    marketCap: corp.marketCap ? Number(corp.marketCap) : undefined,
    isAdmin: corp.isAdmin, delistedAt: corp.delistedAt?.toISOString(), hop,
  }});
}
function addPersonNode(nodes: Map<string, GraphNode>, person: any, hop: number) {
  const id = `person-${person.id}`;
  if (!nodes.has(id)) nodes.set(id, { data: { id, label: person.name, type: "person", flags: person.flags, hop } });
}
function addFundNode(nodes: Map<string, GraphNode>, fund: any, hop: number) {
  const id = `fund-${fund.id}`;
  if (!nodes.has(id)) nodes.set(id, { data: { id, label: fund.name, type: "fund", flags: fund.flags, hop } });
}
function addAuditorNode(nodes: Map<string, GraphNode>, auditor: any, opinion: string, hop: number) {
  const id = `auditor-${auditor.id}`;
  if (!nodes.has(id)) nodes.set(id, { data: { id, label: auditor.name, type: "auditor", firmType: auditor.firmType, opinion, flags: auditor.flags, hop } });
}

// ─── corp BFS 처리 (단일 노드) ───
async function processCorpNode(
  id: string, hop: number, nextHop: number,
  nodes: Map<string, GraphNode>, edges: Map<string, GraphEdge>,
  filings: { date: string; title: string; type: string }[],
  queue: Array<{ id: string; type: "corp" | "person" | "fund"; hop: number }>,
) {
  const corp = await prisma.corp.findUnique({
    where: { id },
    include: { personRelations: { include: { person: true } }, fundRelations: { include: { fund: true } } },
  });
  if (!corp) return;

  for (const rel of corp.personRelations) {
    const pid = `person-${rel.personId}`;
    if (!nodes.has(pid)) { addPersonNode(nodes, rel.person, nextHop); queue.push({ id: rel.personId, type: "person", hop: nextHop }); }
    const eid = `pc-${rel.id}`;
    if (!edges.has(eid)) edges.set(eid, { data: { id: eid, source: pid, target: `corp-${corp.id}`, label: rel.role, type: "person_corp", since: rel.since?.toISOString().slice(0,10), until: rel.until?.toISOString().slice(0,10) } });
  }

  for (const rel of corp.fundRelations) {
    const fid = `fund-${rel.fundId}`;
    if (!nodes.has(fid)) { addFundNode(nodes, rel.fund, nextHop); queue.push({ id: rel.fundId, type: "fund", hop: nextHop }); }
    const eid = `fc-${rel.id}`;
    if (!edges.has(eid)) edges.set(eid, { data: { id: eid, source: fid, target: `corp-${corp.id}`, label: rel.relationType, type: "fund_corp", since: rel.at?.toISOString().slice(0,10), amount: rel.amount ? Number(rel.amount) : undefined, pct: rel.pct ?? undefined } });
  }

  // ✅ (prisma as any) 제거 — corpAuditRelation은 schema에 정의됨
  try {
    const auditRels = await prisma.corpAuditRelation.findMany({
      where: { corpId: id }, include: { auditor: true }, orderBy: { fiscalYear: "desc" }, take: 3,
    });
    for (const rel of auditRels) {
      const aid = `auditor-${rel.auditorId}`;
      if (!nodes.has(aid)) addAuditorNode(nodes, rel.auditor, rel.opinion, nextHop);
      const eid = `ac-${rel.id}`;
      if (!edges.has(eid)) edges.set(eid, { data: { id: eid, source: aid, target: `corp-${corp.id}`, label: `${rel.fiscalYear} 감사`, type: "audit_corp" } });
    }
  } catch { /* CorpAuditRelation 데이터 없음 — 무시 */ }

  // ✅ 조건 제거 — 관계 유무와 관계없이 항상 공시 표시 (hop=0 시드 회사만)
  if (hop === 0) {
    const dbFilings = await prisma.filing.findMany({ where: { corpId: corp.id }, orderBy: { filedAt: "desc" }, take: 20 });
    for (const f of dbFilings) filings.push({ date: f.filedAt.toISOString().slice(0,10), title: f.title, type: f.filingType });
  }
}

// ─── person BFS 처리 ───
async function processPersonNode(
  id: string, nextHop: number,
  nodes: Map<string, GraphNode>, edges: Map<string, GraphEdge>,
  queue: Array<{ id: string; type: "corp" | "person" | "fund"; hop: number }>,
) {
  const person = await prisma.person.findUnique({
    where: { id }, include: { corpRelations: { include: { corp: true } }, fundRelations: { include: { fund: true } } },
  });
  if (!person) return;

  for (const rel of person.corpRelations) {
    const cid = `corp-${rel.corpId}`;
    if (!nodes.has(cid)) { addCorpNode(nodes, rel.corp, nextHop); queue.push({ id: rel.corpId, type: "corp", hop: nextHop }); }
    const eid = `pc-${rel.id}`;
    if (!edges.has(eid)) edges.set(eid, { data: { id: eid, source: `person-${person.id}`, target: cid, label: rel.role, type: "person_corp", since: rel.since?.toISOString().slice(0,10), until: rel.until?.toISOString().slice(0,10) } });
  }

  for (const rel of person.fundRelations) {
    const fid = `fund-${rel.fundId}`;
    if (!nodes.has(fid)) { addFundNode(nodes, rel.fund, nextHop); queue.push({ id: rel.fundId, type: "fund", hop: nextHop }); }
    const eid = `fp-${rel.id}`;
    if (!edges.has(eid)) edges.set(eid, { data: { id: eid, source: `person-${person.id}`, target: fid, label: rel.role, type: "fund_person" } });
  }
}

// ─── fund BFS 처리 ───
async function processFundNode(
  id: string, nextHop: number,
  nodes: Map<string, GraphNode>, edges: Map<string, GraphEdge>,
  queue: Array<{ id: string; type: "corp" | "person" | "fund"; hop: number }>,
) {
  const fund = await prisma.fund.findUnique({
    where: { id }, include: { corpRelations: { include: { corp: true } }, personRelations: { include: { person: true } } },
  });
  if (!fund) return;

  for (const rel of fund.corpRelations) {
    const cid = `corp-${rel.corpId}`;
    if (!nodes.has(cid)) { addCorpNode(nodes, rel.corp, nextHop); queue.push({ id: rel.corpId, type: "corp", hop: nextHop }); }
    const eid = `fc-${rel.id}`;
    if (!edges.has(eid)) edges.set(eid, { data: { id: eid, source: `fund-${fund.id}`, target: cid, label: rel.relationType, type: "fund_corp", since: rel.at?.toISOString().slice(0,10), amount: rel.amount ? Number(rel.amount) : undefined, pct: rel.pct ?? undefined } });
  }

  for (const rel of fund.personRelations) {
    const pid = `person-${rel.personId}`;
    if (!nodes.has(pid)) { addPersonNode(nodes, rel.person, nextHop); queue.push({ id: rel.personId, type: "person", hop: nextHop }); }
    const eid = `fp-${rel.id}`;
    if (!edges.has(eid)) edges.set(eid, { data: { id: eid, source: `person-${rel.personId}`, target: `fund-${fund.id}`, label: rel.role, type: "fund_person" } });
  }
}

// ─── BFS 메인 — hop 단위 병렬 처리 ───
export async function buildDeepGraph(query: string, depth: number = 1): Promise<GraphData> {
  const nodes: Map<string, GraphNode> = new Map();
  const edges: Map<string, GraphEdge> = new Map();
  const filings: { date: string; title: string; type: string }[] = [];
  const visitedCorps = new Set<string>();
  const visitedPersons = new Set<string>();
  const visitedFunds = new Set<string>();

  const [seedCorps, seedPersons, seedFunds] = await Promise.all([
    prisma.corp.findMany({ where: { OR: [{ companyName: { contains: query, mode: "insensitive" } }, { corpCode: { contains: query } }, { stockCode: { contains: query } }] }, take: 5 }),
    prisma.person.findMany({ where: { name: { contains: query, mode: "insensitive" } }, take: 5 }),
    prisma.fund.findMany({ where: { name: { contains: query, mode: "insensitive" } }, take: 5 }),
  ]);

  let currentHopItems: Array<{ id: string; type: "corp" | "person" | "fund"; hop: number }> = [];
  for (const c of seedCorps) { addCorpNode(nodes, c, 0); currentHopItems.push({ id: c.id, type: "corp", hop: 0 }); }
  for (const p of seedPersons) { addPersonNode(nodes, p, 0); currentHopItems.push({ id: p.id, type: "person", hop: 0 }); }
  for (const f of seedFunds) { addFundNode(nodes, f, 0); currentHopItems.push({ id: f.id, type: "fund", hop: 0 }); }

  // ✅ hop 단위 병렬 처리 — 같은 hop의 노드를 Promise.all로 동시 실행
  for (let hop = 0; hop < depth; hop++) {
    const thisHop = currentHopItems.filter(n => n.hop === hop);
    if (thisHop.length === 0) break;

    const nextQueue: Array<{ id: string; type: "corp" | "person" | "fund"; hop: number }> = [];
    const nextHop = hop + 1;

    await Promise.all(thisHop.map(async (item) => {
      if (item.type === "corp") {
        if (visitedCorps.has(item.id)) return;
        visitedCorps.add(item.id);
        await processCorpNode(item.id, item.hop, nextHop, nodes, edges, filings, nextQueue);
      } else if (item.type === "person") {
        if (visitedPersons.has(item.id)) return;
        visitedPersons.add(item.id);
        await processPersonNode(item.id, nextHop, nodes, edges, nextQueue);
      } else {
        if (visitedFunds.has(item.id)) return;
        visitedFunds.add(item.id);
        await processFundNode(item.id, nextHop, nodes, edges, nextQueue);
      }
    }));

    currentHopItems = [...currentHopItems, ...nextQueue];
  }

  if (nodes.size === 0) {
    const dartMatch = dartCorps.find((c) => c.name.includes(query) || c.stock_code === query);
    if (dartMatch) nodes.set(`dart-${dartMatch.stock_code}`, { data: { id: `dart-${dartMatch.stock_code}`, label: dartMatch.name, type: "corp", corpCode: dartMatch.corp_code, hop: 0 } });
  }

  const nodesArr = Array.from(nodes.values());
  const edgesArr = Array.from(edges.values());
  return {
    nodes: nodesArr, edges: edgesArr,
    filings: filings.length > 0 ? filings : undefined,
    stats: { totalNodes: nodesArr.length, totalEdges: edgesArr.length, personCount: nodesArr.filter(n => n.data.type === "person").length, corpCount: nodesArr.filter(n => n.data.type === "corp").length, fundCount: nodesArr.filter(n => n.data.type === "fund").length, auditorCount: nodesArr.filter(n => n.data.type === "auditor").length, maxHop: depth },
  };
}

export async function buildClusterGraph(query: string): Promise<GraphData> { return buildDeepGraph(query, 1); }

// ─── 인물 타임라인 ───
export interface TimelineEntry {
  companyName: string; companyId: string; corpCode?: string;
  role: string; since: string | null; until: string | null; isCurrent: boolean;
  signals: { type: string; firedAt: string; score: number }[];
}

export async function getPersonTimeline(personId: string): Promise<TimelineEntry[]> {
  const relations = await prisma.corpPersonRelation.findMany({
    where: { personId },
    include: { corp: { include: { signals: { orderBy: { firedAt: "desc" }, take: 5 } } } },
    orderBy: [{ since: "asc" }, { corpId: "asc" }],
  });
  return relations.map((rel) => ({
    companyName: rel.corp.companyName,
    companyId: rel.corp.id,
    corpCode: rel.corp.corpCode,                         // ✅ corpCode 추가
    role: rel.role,
    since: rel.since?.toISOString().slice(0,10) ?? null,
    until: rel.until?.toISOString().slice(0,10) ?? null,
    isCurrent: rel.until === null,
    signals: rel.corp.signals.map(s => ({ type: s.ruleName, firedAt: s.firedAt.toISOString().slice(0,10), score: s.score })),
  }));
}

export async function getAuditorRiskSummary(auditorId: string) {
  const audits = await prisma.corpAuditRelation.findMany({
    where: { auditorId },
    include: { corp: { include: { signals: { where: { firedAt: { gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) } } } } } },
  });
  return {
    totalCorps: audits.length,
    suspiciousCount: audits.filter(a => a.isSuspicious).length,
    nonCleanOpinions: audits.filter(a => a.opinion !== "적정").length,
    corpList: audits.map(a => ({ corpName: a.corp.companyName, fiscalYear: a.fiscalYear, opinion: a.opinion, signalCount: a.corp.signals.length })),
  };
}

// ─── 통합 검색 ───
export async function searchAll(query: string) {
  if (!query || query.length < 1) return { corps: [], persons: [], funds: [] };
  const tokens = query.split(/\s+/).filter(t => t.length >= 2);

  // ✅ 단일 토큰: OR / 복합 토큰: AND (정확도 향상)
  const corpWhere = tokens.length <= 1
    ? { OR: tokens.flatMap(t => [{ companyName: { contains: t, mode: "insensitive" as const } }, { corpCode: { contains: t } }, { stockCode: { contains: t } }]) }
    : { AND: tokens.map(t => ({ companyName: { contains: t, mode: "insensitive" as const } })) };

  const [corps, persons, funds] = await Promise.all([
    prisma.corp.findMany({ where: corpWhere, include: { _count: { select: { filings: true, signals: true } } }, take: 10 }),
    prisma.person.findMany({ where: { name: { contains: query, mode: "insensitive" } }, include: { _count: { select: { corpRelations: true } } }, take: 10 }),
    prisma.fund.findMany({ where: { name: { contains: query, mode: "insensitive" } }, take: 10 }),
  ]);
  return { corps, persons, funds };
}
