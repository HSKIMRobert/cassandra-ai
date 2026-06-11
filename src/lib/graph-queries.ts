import { prisma } from "./prisma";
import fs from "fs";
import path from "path";

let dartCorps: { corp_code: string; name: string; stock_code: string }[] = [];
try {
  const p = path.join(process.cwd(), "data", "dart-corp-codes.json");
  if (fs.existsSync(p)) dartCorps = JSON.parse(fs.readFileSync(p, "utf-8"));
} catch {}

function getDartKey(): string {
  try {
    const env = fs.readFileSync(path.join(process.cwd(), ".env"), "utf-8");
    return (env.match(/DART_API_KEY=(.+)/) || [])[1]?.trim() || "";
  } catch { return ""; }
}

export interface GraphNode {
  data: { id: string; label: string; type: "corp" | "person" | "fund"; flags?: string[]; marketCap?: number; isAdmin?: boolean; delistedAt?: string; role?: string };
}

export interface GraphEdge {
  data: { id: string; source: string; target: string; label: string; type: "person_corp" | "fund_corp" | "fund_person" | "filing_flow" };
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  filings?: { date: string; title: string; type: string }[];
}

export async function buildClusterGraph(query: string): Promise<GraphData> {
  const nodes: Map<string, GraphNode> = new Map();
  const edges: GraphEdge[] = [];
  const filings: { date: string; title: string; type: string }[] = [];

  const corps = await prisma.corp.findMany({
    where: { OR: [{ companyName: { contains: query, mode: "insensitive" } }, { corpCode: { contains: query } }, { stockCode: { contains: query } }] },
    include: { personRelations: { include: { person: true } }, fundRelations: { include: { fund: true } } },
    take: 5,
  });

  const persons = await prisma.person.findMany({
    where: { name: { contains: query, mode: "insensitive" } },
    include: { corpRelations: { include: { corp: true } }, fundRelations: { include: { fund: true } } },
    take: 5,
  });

  const funds = await prisma.fund.findMany({
    where: { name: { contains: query, mode: "insensitive" } },
    include: { corpRelations: { include: { corp: true } }, personRelations: { include: { person: true } } },
    take: 5,
  });

  // Corp 노드 + 1-hop 관계
  for (const corp of corps) {
    addCorpNode(nodes, corp);
    for (const rel of corp.personRelations) { addPersonNode(nodes, rel.person); edges.push({ data: { id: `pc-${rel.id}`, source: `person-${rel.personId}`, target: `corp-${corp.id}`, label: rel.role, type: "person_corp" } }); }
    for (const rel of corp.fundRelations) { addFundNode(nodes, rel.fund); edges.push({ data: { id: `fc-${rel.id}`, source: `fund-${rel.fundId}`, target: `corp-${corp.id}`, label: rel.relationType, type: "fund_corp" } }); }
    
    // DB 관계가 없으면 PersonHistory에서 검색
    if (corp.personRelations.length === 0 && corp.fundRelations.length === 0) {
      const personHistories = await prisma.personHistory.findMany({
        where: { companyName: corp.companyName },
        select: { name: true, role: true, personUid: true, eventDate: true },
        orderBy: { eventDate: "desc" },
        take: 10,
      });
      const addedPersons = new Set<string>();
      for (const ph of personHistories) {
        if (addedPersons.has(ph.name)) continue;
        // 이미 그래프에 있는 인물인지 확인
        const existingPersonNode = [...nodes.values()].find(n => n.data.type === "person" && n.data.label === ph.name);
        const personNodeId = existingPersonNode ? existingPersonNode.data.id : `person-history-${ph.personUid}`;
        
        if (!existingPersonNode) {
          nodes.set(personNodeId, { data: { id: personNodeId, label: ph.name, type: "person" } });
        }
        addedPersons.add(ph.name);
        edges.push({
          data: { id: `ph-${ph.personUid}-${corp.id}`, source: personNodeId, target: `corp-${corp.id}`, label: ph.role, type: "person_corp" },
        });
      }
    }

    // 관계가 없으면 공시 요약
    if (corp.personRelations.length === 0 && corp.fundRelations.length === 0) {
      const dbFilings = await prisma.filing.findMany({ where: { corpId: corp.id }, orderBy: { filedAt: "desc" }, take: 20 });
      for (const f of dbFilings) {
        filings.push({ date: f.filedAt.toISOString().slice(0,10), title: f.title, type: f.filingType });
      }
    }
  }

  // Person 노드 확장
  for (const person of persons) {
    addPersonNode(nodes, person);
    for (const rel of person.corpRelations) { addCorpNode(nodes, rel.corp); edges.push({ data: { id: `pc-${rel.id}`, source: `person-${person.id}`, target: `corp-${rel.corpId}`, label: rel.role, type: "person_corp" } }); }
    for (const rel of person.fundRelations) { addFundNode(nodes, rel.fund); edges.push({ data: { id: `fp-${rel.id}`, source: `person-${person.id}`, target: `fund-${rel.fundId}`, label: rel.role, type: "fund_person" } }); }
  }

  // Fund 노드 확장
  for (const fund of funds) {
    addFundNode(nodes, fund);
    for (const rel of fund.corpRelations) { addCorpNode(nodes, rel.corp); edges.push({ data: { id: `fc-${rel.id}`, source: `fund-${fund.id}`, target: `corp-${rel.corpId}`, label: rel.relationType, type: "fund_corp" } }); }
    for (const rel of fund.personRelations) { addPersonNode(nodes, rel.person); edges.push({ data: { id: `fp-${rel.id}`, source: `fund-${fund.id}`, target: `person-${rel.personId}`, label: rel.role, type: "fund_person" } }); }
  }

  // DART 폴백
  if (nodes.size === 0) {
    const dartMatch = dartCorps.find((c) => c.name.includes(query) || c.stock_code === query);
    if (dartMatch) {
      nodes.set(`dart-${dartMatch.stock_code}`, { data: { id: `dart-${dartMatch.stock_code}`, label: dartMatch.name, type: "corp" } });
    }
  }

  return { nodes: Array.from(nodes.values()), edges, filings: filings.length > 0 ? filings : undefined };
}

function addCorpNode(nodes: Map<string, GraphNode>, corp: any) {
  const id = `corp-${corp.id}`;
  if (!nodes.has(id)) nodes.set(id, { data: { id, label: corp.companyName, type: "corp", marketCap: corp.marketCap ? Number(corp.marketCap) : undefined, isAdmin: corp.isAdmin, delistedAt: corp.delistedAt?.toISOString() } });
}
function addPersonNode(nodes: Map<string, GraphNode>, person: any) {
  const id = `person-${person.id}`;
  if (!nodes.has(id)) nodes.set(id, { data: { id, label: person.name, type: "person", flags: person.flags } });
}
function addFundNode(nodes: Map<string, GraphNode>, fund: any) {
  const id = `fund-${fund.id}`;
  if (!nodes.has(id)) nodes.set(id, { data: { id, label: fund.name, type: "fund", flags: fund.flags } });
}

export async function searchAll(query: string) {
  if (!query || query.length < 1) return { corps: [], persons: [], funds: [] };
  const tokens = query.split(/\s+/).filter(t => t.length >= 2);
  const [corps, persons, funds] = await Promise.all([
    prisma.corp.findMany({ where: { OR: tokens.flatMap(t => [{ companyName: { contains: t, mode: "insensitive" as const } }, { corpCode: { contains: t } }, { stockCode: { contains: t } }]) }, include: { _count: { select: { filings: true, signals: true } } }, take: 10 }),
    prisma.person.findMany({ where: { name: { contains: query, mode: "insensitive" } }, include: { _count: { select: { corpRelations: true } } }, take: 10 }),
    prisma.fund.findMany({ where: { name: { contains: query, mode: "insensitive" } }, take: 10 }),
  ]);
  return { corps, persons, funds };
}
