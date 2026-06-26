/**
 * 동명이인 자동 감지 + SameNameGroup 생성
 * 실행: npx tsx scripts/merge-samename.ts [--dry-run]
 *
 * 동일 이름의 Person이 2명 이상이면 SameNameGroup으로 묶음
 * (실제 병합 X — 그룹핑만. 수동 검토 후 병합은 별도)
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const isDryRun = process.argv.includes("--dry-run");

async function main() {
  console.log(`\n👥 동명이인 감지 ${isDryRun ? "(dry-run)" : ""}\n`);

  // 이름이 같은 Person 그룹 찾기
  const dupes = await prisma.$queryRaw<{ name: string; cnt: bigint }[]>`
    SELECT name, COUNT(*) as cnt
    FROM "Person"
    GROUP BY name
    HAVING COUNT(*) > 1
    ORDER BY cnt DESC
  `;

  console.log(`동명이인 이름 ${dupes.length}개\n`);

  let created = 0, skipped = 0;

  for (const { name, cnt } of dupes) {
    const persons = await prisma.person.findMany({
      where: { name },
      include: { _count: { select: { corpRelations: true } } },
      orderBy: { createdAt: "asc" },
    });

    // 이미 그룹이 있으면 스킵
    const existing = await prisma.sameNameGroup.findFirst({ where: { name } });
    if (existing) { skipped++; continue; }

    const personUids = persons.map(p => p.personUid).filter(Boolean) as string[];
    const note = persons
      .map(p => `${p.personUid || p.id}: 관계 ${p._count.corpRelations}개`)
      .join(" / ");

    console.log(`  ${name} (${cnt}명) — ${note}`);

    if (!isDryRun) {
      await prisma.sameNameGroup.create({
        data: { name, personIds: personUids, note },
      });
      created++;
    }
  }

  if (isDryRun) {
    console.log(`\n[dry-run] 실제 저장 없음. --dry-run 제거 후 재실행하세요.`);
  } else {
    console.log(`\n✅ 완료: SameNameGroup ${created}개 생성, ${skipped}개 스킵`);
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
