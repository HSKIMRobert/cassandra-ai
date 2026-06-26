/**
 * Fund 노드 자동 생성
 * CB 발행 공시, 대주주 변경 공시에서 법인/펀드 투자자 감지 → Fund + CorpFundRelation 생성
 */

import { prisma } from "./prisma";
import { parseCbFromTitle } from "./dart-parsers";

// 법인 투자자 패턴 (개인 이름 제외)
const FUND_PATTERNS = [
  /투자조합/, /사모펀드|PEF|프라이빗에쿼티/, /자산운용/, /벤처캐피탈|VC/,
  /파트너스/, /인베스트/, /홀딩스|Holdings/, /캐피탈|Capital/,
  /그로스|Growth/, /에쿼티|Equity/, /파이낸스|Finance/,
];

export function isFundEntity(name: string): boolean {
  return FUND_PATTERNS.some(p => p.test(name));
}

// ─── Fund 찾거나 생성 ───
export async function findOrCreateFund(name: string, flags: string[] = []): Promise<{ id: string; name: string }> {
  const existing = await prisma.fund.findFirst({ where: { name } });
  if (existing) return existing;
  const fundUid = name.replace(/[^가-힣a-zA-Z0-9]/g, "_").slice(0, 40);
  return prisma.fund.create({ data: { name, fundUid, flags } });
}

// ─── 주요주주 중 법인 → CorpFundRelation 생성 ───
export interface FundRelationInput {
  fundName: string;
  corpId: string;
  relationType: string;
  pct?: number;
  amount?: number;
  at?: Date;
  source?: string;
}

export async function upsertCorpFundRelation(input: FundRelationInput): Promise<void> {
  const fund = await findOrCreateFund(input.fundName);

  // 기존 관계 확인 (fundId + corpId + relationType 기준)
  const existing = await prisma.corpFundRelation.findFirst({
    where: { fundId: fund.id, corpId: input.corpId, relationType: input.relationType },
  });
  if (existing) {
    await prisma.corpFundRelation.update({
      where: { id: existing.id },
      data: { pct: input.pct, amount: input.amount ? BigInt(input.amount) : undefined, at: input.at },
    });
  } else {
    await prisma.corpFundRelation.create({
      data: {
        fundId: fund.id, corpId: input.corpId, relationType: input.relationType,
        pct: input.pct, amount: input.amount ? BigInt(input.amount) : undefined,
        at: input.at, source: input.source,
      },
    });
  }
}

// ─── Filing DB에서 CB 공시 → Fund 노드 자동 생성 ───
export async function buildFundNodesFromFilings(corpId: string): Promise<number> {
  const filings = await prisma.filing.findMany({
    where: {
      corpId,
      OR: [
        { title: { contains: "전환사채" } },
        { title: { contains: "신주인수권" } },
        { title: { contains: "최대주주" } },
        { title: { contains: "대주주" } },
      ],
    },
    orderBy: { filedAt: "desc" },
    take: 50,
  });

  let created = 0;
  for (const filing of filings) {
    const { type } = parseCbFromTitle(filing.title);
    if (!type) continue;

    // 제목에서 법인명 추출 시도 (간이 휴리스틱)
    const match = filing.title.match(/[\(（]([^)）]{2,20})[\)）]/);
    if (!match) continue;
    const candidate = match[1].trim();
    if (!isFundEntity(candidate)) continue;

    await upsertCorpFundRelation({
      fundName: candidate,
      corpId,
      relationType: type === "CB" || type === "BW" ? "CB_ACQUIRER" : "INVESTOR",
      at: filing.filedAt,
      source: filing.rceptNo || undefined,
    });
    created++;
  }
  return created;
}

// ─── 주요주주 데이터에서 법인 분리 → Fund 생성 ───
export async function buildFundNodesFromShareholders(
  corpId: string,
  shareholders: { name: string; pct: number; shares: number }[],
  year: number,
): Promise<number> {
  let created = 0;
  for (const s of shareholders) {
    if (!isFundEntity(s.name)) continue;
    await upsertCorpFundRelation({
      fundName: s.name,
      corpId,
      relationType: s.pct >= 5 ? "LARGEST_HOLDER" : "INVESTOR",
      pct: s.pct,
      at: new Date(`${year}-12-31`),
    });
    created++;
  }
  return created;
}
