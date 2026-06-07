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

  return NextResponse.json(toJSON(post), { status: 201 });
}
