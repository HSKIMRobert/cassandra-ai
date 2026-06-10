import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toJSON } from "@/lib/serialize";
import crypto from "crypto";

// 게시글 목록 조회
export async function GET(req: NextRequest) {
  const category = req.nextUrl.searchParams.get("category") || undefined;
  const page = parseInt(req.nextUrl.searchParams.get("page") || "1");
  const limit = 20;
  const skip = (page - 1) * limit;

  const where = category ? { category } : {};
  const [posts, total] = await Promise.all([
    prisma.boardPost.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      select: {
        id: true,
        authorName: true,
        title: true,
        category: true,
        targetCorp: true,
        targetPerson: true,
        status: true,
        createdAt: true,
      },
    }),
    prisma.boardPost.count({ where }),
  ]);

  return NextResponse.json(toJSON({ posts, total, page, totalPages: Math.ceil(total / limit) }));
}

// 게시글 작성
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { authorName, password, title, content, category, targetCorp, targetPerson } = body;

  if (!title?.trim() || !content?.trim() || !password?.trim()) {
    return NextResponse.json({ error: "제목, 내용, 비밀번호는 필수입니다." }, { status: 400 });
  }

  const pwHash = crypto.createHash("sha256").update(password).digest("hex");

  const post = await prisma.boardPost.create({
    data: {
      authorName: authorName?.trim() || "익명",
      password: pwHash,
      title: title.trim(),
      content: content.trim(),
      category: category || "REPORT",
      targetCorp: targetCorp?.trim() || null,
      targetPerson: targetPerson?.trim() || null,
    },
  });

  // 분석 요청이면 비동기 분석 실행
  const searchTarget = targetCorp?.trim() || targetPerson?.trim();
  if (searchTarget && (category === "REPORT" || category === "ANALYSIS_REQUEST")) {
    runBoardAnalysis(post.id, searchTarget).catch(() => {});
  }

  return NextResponse.json(toJSON(post), { status: 201 });
}

async function runBoardAnalysis(postId: string, target: string) {
  // DART 공시 분석 (chat API와 동일한 로직)
  const { prisma: prismaClient } = await import("@/lib/prisma");
  try {
    // DB에서 회사 검색
    const corp = await (await import("@/lib/prisma")).prisma.corp.findFirst({
      where: { companyName: { contains: target, mode: "insensitive" } },
      include: { filings: { orderBy: { filedAt: "desc" }, take: 30 } },
    });

    if (corp && corp.filings.length > 0) {
      const titles = corp.filings.slice(0, 10).map(f => f.title);
      const categories = countCategories(corp.filings);
      const signals = generateSignals(categories);
      
      const analysis = `📊 ${corp.companyName} 분석 (${corp.filings.length}건 공시)\n\n` +
        Object.entries(categories).filter(([,v]) => v > 0).map(([k,v]) => `· ${k}: ${v}건`).join("\n") +
        "\n\n" + (signals.length > 0 ? signals.join("\n") : "· 특이사항 없음") +
        "\n\n✅ 카산드라 AI 갱신 완료. 검색해보세요.";

      await (await import("@/lib/prisma")).prisma.boardPost.update({
        where: { id: postId },
        data: { analysis, status: "RESOLVED" },
      });
    } else {
      await (await import("@/lib/prisma")).prisma.boardPost.update({
        where: { id: postId },
        data: { analysis: `⏳ DART에서 '${target}' 관련 공시를 찾을 수 없습니다. 심층 분석이 필요하면 DART 웹사이트에서 직접 검색해보세요.\n\n✅ 카산드라 AI 검토 완료.`, status: "RESOLVED" },
      });
    }
  } catch {}
}

function countCategories(filings: any[]): Record<string, number> {
  const cats: Record<string, number> = {};
  filings.forEach((f: any) => {
    const t = f.title || "";
    if (/전환사채|신주인수권|사채/.test(t)) cats['CB/BW'] = (cats['CB/BW'] || 0) + 1;
    else if (/소송|판결|가처분/.test(t)) cats['소송'] = (cats['소송'] || 0) + 1;
    else if (/최대주주/.test(t)) cats['대주주변경'] = (cats['대주주변경'] || 0) + 1;
    else if (/유상증자|무상증자|감자|주식병합/.test(t)) cats['증자/감자'] = (cats['증자/감자'] || 0) + 1;
    else if (/상호변경|사명/.test(t)) cats['사명변경'] = (cats['사명변경'] || 0) + 1;
    else if (/매매.*정지/.test(t)) cats['매매정지'] = (cats['매매정지'] || 0) + 1;
    else cats['기타'] = (cats['기타'] || 0) + 1;
  });
  return cats;
}

function generateSignals(cats: Record<string, number>): string[] {
  const s: string[] = [];
  if ((cats['증자/감자'] || 0) >= 3) s.push(`⚠️ 증자/감자 ${cats['증자/감자']}회 — 빈번한 자본 변동`);
  if ((cats['매매정지'] || 0) >= 2) s.push(`⚠️ 매매정지 ${cats['매매정지']}회`);
  if (cats['사명변경']) s.push(`🔄 사명변경 감지`);
  if ((cats['CB/BW'] || 0) >= 2) s.push(`💰 CB/BW ${cats['CB/BW']}회`);
  if (cats['소송']) s.push(`⚖️ 소송 ${cats['소송']}건`);
  if (cats['대주주변경']) s.push(`👤 대주주변경 ${cats['대주주변경']}회`);
  return s;
}
