/**
 * DART 구조화 API 파서
 * 임원현황 / 최대주주 / CB발행 / 감사의견 → 표준 타입으로 파싱
 * 스크립트(scripts/)와 API route 양쪽에서 재사용
 */

const DART_BASE = "https://opendart.fss.or.kr/api";

// ─── 공통 ───
function dartKey(): string {
  return process.env.DART_API_KEY || "";
}

async function dartGet(endpoint: string, params: Record<string, string>): Promise<any> {
  const url = new URL(`${DART_BASE}/${endpoint}`);
  url.searchParams.set("crtfc_key", dartKey());
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(10000) }).catch(() => null);
  if (!res?.ok) return null;
  return res.json().catch(() => null);
}

// ─── 역할 매핑 ───
export const ROLE_MAP: Record<string, string> = {
  "대표이사": "CEO", "사내이사": "DIRECTOR", "사외이사": "OUTSIDE_DIRECTOR",
  "감사": "AUDITOR", "감사위원회위원": "AUDITOR", "기타비상무이사": "DIRECTOR",
  "집행임원": "DIRECTOR", "이사회의장": "DIRECTOR", "부대표이사": "CEO",
  "공동대표이사": "CEO", "대표": "CEO",
};

// ─── 임원현황 ───
export interface OfficerRecord {
  name: string;
  role: string;         // 매핑 후 역할
  rawRole: string;      // 원본 직위
  birthDate?: string;
  since?: string;
}

export async function fetchOfficers(corpCode: string, year: number): Promise<OfficerRecord[]> {
  for (const reprt of ["11011", "11012"]) {
    const data = await dartGet("exctvSttus.json", { corp_code: corpCode, bsns_year: String(year), reprt_code: reprt });
    if (data?.status === "000" && data.list?.length > 0) {
      return data.list
        .map((o: any) => ({
          name: o.nm?.trim() || "",
          rawRole: o.ofcps?.trim() || "",
          role: ROLE_MAP[o.ofcps?.trim() || ""] || "DIRECTOR",
          birthDate: o.birth_dte?.trim() || undefined,
        }))
        .filter((o: OfficerRecord) => o.name.length >= 2);
    }
  }
  return [];
}

// ─── 최대주주 ───
export interface ShareholderRecord {
  name: string;
  role: string;         // "LARGEST_HOLDER" or "INSIDER"
  pct: number;
  shares: number;
  relationship?: string;
}

export async function fetchMajorShareholders(corpCode: string, year: number): Promise<ShareholderRecord[]> {
  const data = await dartGet("majorstock.json", { corp_code: corpCode, bsns_year: String(year), reprt_code: "11011" });
  if (data?.status !== "000" || !data.list?.length) return [];

  return data.list
    .map((s: any) => {
      const shares = parseInt(s.stkqy?.replace(/,/g, "") || "0", 10);
      const pct = parseFloat(s.stkqy_irds?.replace(/,/g, "") || "0");
      return {
        name: s.nm?.trim() || "",
        relationship: s.relate?.trim(),
        shares,
        pct,
        role: pct >= 5 ? "LARGEST_HOLDER" : "INSIDER",
      };
    })
    .filter((s: ShareholderRecord) => s.name.length >= 2);
}

// ─── CB / 신주인수권부사채 ───
export interface CbRecord {
  rceptNo: string;
  title: string;
  filedAt: string;
  type: "CB" | "BW" | "REFIX";
  amount?: number;        // 발행금액 (억원)
  convertPrice?: number;  // 전환가액
  maturity?: string;      // 만기일
}

// 공시 목록에서 CB 관련 항목만 추출 (Filing DB에서 호출)
export function parseCbFromTitle(title: string): { type: "CB" | "BW" | "REFIX" | null; riskScore: number } {
  if (/리픽싱|전환가액.*조정/.test(title)) return { type: "REFIX", riskScore: 3 };
  if (/전환사채/.test(title)) return { type: "CB", riskScore: 2 };
  if (/신주인수권/.test(title)) return { type: "BW", riskScore: 1 };
  return { type: null, riskScore: 0 };
}

// ─── 감사의견 ───
export interface AuditRecord {
  auditorName: string;
  firmType: "BIG4" | "MEDIUM" | "SMALL";
  opinion: string;          // "적정" | "한정" | "부적정" | "의견거절"
  fiscalYear: number;
  isSuspicious: boolean;
}

const BIG4 = ["삼일", "삼정", "한영", "안진"];
const MEDIUM_FIRMS = ["대주", "신한", "이촌", "태성", "진일", "삼화", "정동"];

function classifyFirm(name: string): "BIG4" | "MEDIUM" | "SMALL" {
  if (BIG4.some(f => name.includes(f))) return "BIG4";
  if (MEDIUM_FIRMS.some(f => name.includes(f))) return "MEDIUM";
  return "SMALL";
}

export async function fetchAuditOpinion(corpCode: string, year: number): Promise<AuditRecord | null> {
  const data = await dartGet("accnutAdtorNmCd.json", { corp_code: corpCode, bsns_year: String(year), reprt_code: "11011" });
  if (data?.status !== "000" || !data.list?.length) return null;

  const item = data.list[0];
  const auditorName: string = item.adtor?.trim() || "";
  const opinion: string = item.adt_opinion?.trim() || "";
  return {
    auditorName,
    firmType: classifyFirm(auditorName),
    opinion: opinion || "알수없음",
    fiscalYear: year,
    isSuspicious: opinion !== "적정",
  };
}

// ─── 공시 목록 (최근 N일) ───
export interface FilingListItem {
  rceptNo: string;
  title: string;
  filedAt: string;
  type: string;
}

export async function fetchRecentFilings(corpCode: string, days: number = 90): Promise<FilingListItem[]> {
  const end = new Date();
  const start = new Date(end.getTime() - days * 86400 * 1000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, "");

  const data = await dartGet("list.json", {
    corp_code: corpCode, bgn_de: fmt(start), end_de: fmt(end),
    pblntf_ty: "A", page_count: "100",
  });
  if (data?.status !== "000" || !data.list?.length) return [];

  return data.list.map((f: any) => ({
    rceptNo: f.rcept_no,
    title: f.report_nm,
    filedAt: `${f.rcept_dt.slice(0,4)}-${f.rcept_dt.slice(4,6)}-${f.rcept_dt.slice(6,8)}`,
    type: f.pblntf_ty,
  }));
}
