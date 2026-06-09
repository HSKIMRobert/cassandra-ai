import { PrismaClient } from "@prisma/client";

/**
 * SEED TEMPLATE — 로컬에서 복사하여 사용:
 *   cp prisma/seed.template.ts prisma/seed.ts
 *   # seed.ts 내부의 익명화된 데이터를 실제 백테스팅 데이터로 교체
 *   npm run db:seed
 *
 * ※ 블랙리스트/실제 인물·법인 데이터는 공익 목적 로컬 전용입니다.
 *   GitHub에 절대 커밋하지 마세요.
 */

const prisma = new PrismaClient();

async function main() {
  // 초기화
  await prisma.signal.deleteMany();
  await prisma.filing.deleteMany();
  await prisma.fundPersonRelation.deleteMany();
  await prisma.corpFundRelation.deleteMany();
  await prisma.corpPersonRelation.deleteMany();
  await prisma.fund.deleteMany();
  await prisma.person.deleteMany();
  await prisma.corp.deleteMany();

  // ─── 예시: 익명화된 샘플 데이터 ───
  // 실제 백테스팅 데이터는 로컬 seed.ts 에서 관리합니다.

  const corpA = await prisma.corp.create({
    data: {
      corpCode: "00000001",
      stockCode: "000001",
      companyName: "예시기업A",
      market: "KOSDAQ",
      marketCap: 35000000000 as any,
      isAdmin: false,
    },
  });

  const corpB = await prisma.corp.create({
    data: {
      corpCode: "00000002",
      stockCode: "000002",
      companyName: "예시기업B",
      market: "KOSDAQ",
      marketCap: 15000000000n,
      isAdmin: false,
    },
  });

  const personX = await prisma.person.create({
    data: {
      personUid: "P-TEMPLATE-001",
      name: "홍길동",
      aliases: [],
      flags: [],
    },
  });

  await prisma.corpPersonRelation.create({
    data: {
      personId: personX.id,
      corpId: corpA.id,
      role: "CEO",
      description: "예시 데이터 — 실제 백테스팅 시 교체 필요",
      since: new Date("2024-01-01"),
    },
  });

  const fundY = await prisma.fund.create({
    data: {
      fundUid: "F-TEMPLATE-001",
      name: "예시투자조합",
      fundType: "invest_assoc",
      flags: [],
    },
  });

  await prisma.corpFundRelation.create({
    data: {
      fundId: fundY.id,
      corpId: corpA.id,
      relationType: "CB_ACQUIRER",
      description: "예시 데이터",
      amount: 1000000000n,
      at: new Date("2024-06-01"),
    },
  });

  await prisma.filing.create({
    data: {
      rceptNo: "20240601000001",
      corpId: corpA.id,
      filingType: "CB_ISSUANCE",
      title: "전환사채권 발행결정 (예시)",
      summary: "실제 백테스팅 데이터로 교체 필요",
      filedAt: new Date("2024-06-01"),
    },
  });

  await prisma.signal.create({
    data: {
      corpId: corpA.id,
      ruleName: "EXAMPLE_RULE",
      score: 0.50,
      detail: "예시 신호 — 실제 데이터로 교체 필요",
      firedAt: new Date("2024-06-02"),
    },
  });

  console.log("");
  console.log("템플릿 시드 완료 — 실제 백테스팅 데이터는 prisma/seed.ts 에서 관리하세요.");
  console.log("절대 GitHub에 실제 블랙리스트 데이터를 커밋하지 마세요.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
