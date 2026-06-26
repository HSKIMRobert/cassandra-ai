/**
 * Person UID 통합 유틸
 *
 * 기존 패턴이 5가지로 제각각:
 *   DART-${key}  /  DART-CRAWL-${name}  /  ELESTOCK-${name}
 *   ${name}-${birthDate||Date.now()}  /  makePersonUid(name, birthDate)
 *
 * 통합 포맷: "${name}_${birthDate}"  (birthDate 없으면 "unknown")
 * 특수문자 → "_" 치환, 30자 truncate
 */

// ─── 표준 personUid 생성 ───
export function makePersonUid(name: string, birthDate?: string | null): string {
  const n = name.trim().replace(/[^가-힣a-zA-Z0-9]/g, "_");
  const b = (birthDate?.trim() || "unknown").replace(/[^0-9-]/g, "");
  return `${n}_${b}`.slice(0, 50);
}

// ─── 레거시 UID → 표준 UID 변환 ───
// 기존 스크립트들이 생성한 UID를 표준 포맷으로 정규화 (DB 조회 시 폴백용)
export function normalizePersonUid(uid: string, name?: string, birthDate?: string): string {
  // 이미 표준 포맷이면 그대로
  if (/^[가-힣a-zA-Z0-9_]+_([0-9-]+|unknown)$/.test(uid)) return uid;
  // 레거시 → 표준으로 재생성 (name 있을 때)
  if (name) return makePersonUid(name, birthDate);
  // name 없으면 그대로 반환 (마이그레이션 시 처리)
  return uid;
}

// ─── DB에서 Person 찾기 (표준 UID + 레거시 폴백) ───
import { PrismaClient } from "@prisma/client";

export async function findPersonByUid(
  prisma: PrismaClient,
  name: string,
  birthDate?: string | null,
): Promise<{ id: string; personUid: string } | null> {
  const uid = makePersonUid(name, birthDate);

  // 1순위: 표준 UID
  const byUid = await prisma.person.findFirst({ where: { personUid: uid } });
  if (byUid) return byUid;

  // 2순위: 이름 + 생년월일 직접 매칭
  if (birthDate) {
    const byBirth = await prisma.person.findFirst({ where: { name, birthDate } });
    if (byBirth) return byBirth;
  }

  // 3순위: 이름만 (동명이인 위험 있음 — 단독 사용 주의)
  const byName = await prisma.person.findFirst({ where: { name } });
  return byName ?? null;
}

// ─── Person 찾거나 생성 (표준 UID 사용) ───
export async function findOrCreatePerson(
  prisma: PrismaClient,
  name: string,
  birthDate?: string | null,
  extra?: { flags?: string[]; bio?: string },
): Promise<{ id: string; personUid: string; name: string }> {
  const existing = await findPersonByUid(prisma, name, birthDate);
  if (existing) return existing as { id: string; personUid: string; name: string };

  const personUid = makePersonUid(name, birthDate);
  return prisma.person.create({
    data: { name, birthDate: birthDate ?? undefined, personUid, flags: extra?.flags ?? [], bio: extra?.bio },
  });
}
